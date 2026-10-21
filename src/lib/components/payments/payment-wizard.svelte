<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import PhoneInput from '$lib/components/phone-input.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatPhone, extractPhoneDigits } from '$lib/phone.js';
	import {
		PURCHASE_TYPES,
		PURCHASE_TYPE_LABELS,
		getPurchaseTypeDescription,
		buildEnrollmentModalityOptions,
		getEnrollmentModalityKey,
		calculatePaymentTotals,
		calculateWizardTotal,
		buildPaymentSummary,
		formatDiscountPercent,
		parseDiscountPercent,
		DROP_IN_DEFAULT_CLASSES,
		FULL_PASS_DEFAULT_HOURS,
		DROP_IN_GUEST_LABEL,
		validatePaymentWizard,
		type PaymentMethod,
		type PaymentWizardData,
		type PurchaseType,
		type WizardCourse,
		type WizardPaymentPlan,
		type WizardStudent
	} from '$lib/payments.js';
	import { cn } from '$lib/utils.js';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CheckIcon from '@lucide/svelte/icons/check';

	let {
		students,
		courses,
		plans,
		paymentMethods,
		intent = 'payment',
		initialGroupId = '',
		initialStudentId = '',
		enrolledStudentIds = [],
		errors = {},
		values = null
	}: {
		students: WizardStudent[];
		courses: WizardCourse[];
		plans: WizardPaymentPlan[];
		paymentMethods: readonly PaymentMethod[];
		intent?: 'payment' | 'enrollment';
		initialGroupId?: string;
		initialStudentId?: string;
		enrolledStudentIds?: readonly number[];
		errors?: Partial<Record<keyof PaymentWizardData, string>> & {
			newFullName?: string;
			newPhone?: string;
		};
		values?: (PaymentWizardData & {
			studentMode?: string;
			newFullName?: string;
			newPhone?: string;
		}) | null;
	} = $props();

	const isEnrollment = $derived(intent === 'enrollment');
	const lockCourse = $derived(isEnrollment && Boolean(initialGroupId));

	const steps = $derived(
		isEnrollment
			? (['Alumno', 'Modalidad', 'Pago', 'Confirmación'] as const)
			: (['Alumno', 'Tipo de compra', 'Detalle', 'Pago', 'Confirmación'] as const)
	);

	const confirmationStep = $derived(steps.length - 1);
	const paymentStep = $derived(isEnrollment ? 2 : 3);
	const detailStep = $derived(2);

	let currentStep = $state(0);
	let submitting = $state(false);

	let studentMode = $state<'existing' | 'new'>('existing');
	let studentId = $state('');
	let studentPickerOpen = $state(false);
	let studentSearch = $state('');
	const filteredStudents = $derived.by(() => {
		const query = studentSearch.trim().toLowerCase();
		const queryDigits = query.replace(/\D/g, '');
		return students.filter((student) =>
			student.fullName.toLowerCase().includes(query) ||
			formatPhone(student.phone).toLowerCase().includes(query) ||
			(queryDigits.length > 0 && (student.phone?.replace(/\D/g, '') ?? '').includes(queryDigits))
		);
	});

	function selectPaymentStudent(id: string) {
		studentId = id;
		studentPickerOpen = false;
		studentSearch = '';
		clearStudentIdError();
	}
	let newFullName = $state('');
	let newPhone = $state('');
	let purchaseType = $state<PurchaseType>('monthly_only');
	let courseId = $state('');
	let monthlyPlanId = $state('');
	let fullPassPlanId = $state('');
	let dropInPlanId = $state('');
	let paymentMethod = $state<PaymentMethod>('Efectivo');
	let paidAt = $state('');
	let discountPercent = $state('0');
	let notes = $state('');
	let stepErrors = $state<
		Partial<Record<keyof PaymentWizardData, string>> & {
			newFullName?: string;
			newPhone?: string;
		}
	>({});

	const enrolledStudentIdSet = $derived(new Set(enrolledStudentIds));
	const isSelectedStudentEnrolled = $derived(
		isEnrollment &&
			studentMode === 'existing' &&
			studentId !== '' &&
			enrolledStudentIdSet.has(Number(studentId))
	);

	const monthlyPlans = $derived(plans.filter((plan) => plan.planType === 'monthly'));
	const fullPassPlans = $derived(plans.filter((plan) => plan.planType === 'full_pass'));
	const dropInPlans = $derived(plans.filter((plan) => plan.planType === 'drop_in'));
	const enrollmentModalityOptions = $derived(
		isEnrollment ? buildEnrollmentModalityOptions(monthlyPlans, fullPassPlans, dropInPlans) : []
	);
	const selectedModalityKey = $derived(
		getEnrollmentModalityKey({ purchaseType, monthlyPlanId, fullPassPlanId, dropInPlanId })
	);
	const selectedModalityOption = $derived(
		enrollmentModalityOptions.find((option) => option.key === selectedModalityKey) ?? null
	);

	const errorLabels: Record<string, string> = {
		studentId: 'Alumno',
		newFullName: 'Nombre completo',
		newPhone: 'Teléfono',
		purchaseType: 'Modalidad',
		courseId: 'Clase',
		monthlyPlanId: 'Plan mensual',
		fullPassPlanId: 'Plan full pass',
		dropInPlanId: 'Plan por clase',
		paymentMethod: 'Método de pago',
		paidAt: 'Fecha de pago',
		discountPercent: 'Descuento'
	};

	const confirmationErrors = $derived(
		Object.entries(errors).map(([key, message]) => ({
			label: errorLabels[key] ?? key,
			message
		}))
	);
	const needsMonthly = $derived(
		purchaseType === 'monthly_only' || purchaseType === 'combined'
	);
	const needsFullPass = $derived(
		purchaseType === 'full_pass_only' || purchaseType === 'combined'
	);
	const needsDropIn = $derived(purchaseType === 'drop_in_only');

	const wizardData = $derived({
		studentId,
		purchaseType,
		courseId,
		monthlyPlanId,
		fullPassPlanId,
		dropInPlanId,
		paymentMethod,
		paidAt,
		discountPercent,
		notes
	} satisfies PaymentWizardData);

	const selectedStudent = $derived(students.find((student) => student.id === Number(studentId)));
	const selectedCourse = $derived(courses.find((course) => course.id === Number(courseId)));
	const selectedMonthlyPlan = $derived(
		monthlyPlans.find((plan) => plan.id === Number(monthlyPlanId))
	);
	const selectedFullPassPlan = $derived(
		fullPassPlans.find((plan) => plan.id === Number(fullPassPlanId))
	);
	const selectedDropInPlan = $derived(
		dropInPlans.find((plan) => plan.id === Number(dropInPlanId))
	);
	const subtotalAmount = $derived(
		calculateWizardTotal(
			purchaseType,
			plans,
			Number(monthlyPlanId),
			Number(fullPassPlanId),
			Number(dropInPlanId)
		)
	);
	const paymentTotals = $derived.by(() => {
		const parsed = parseDiscountPercent(discountPercent);
		return calculatePaymentTotals(subtotalAmount, Number.isNaN(parsed) ? 0 : parsed);
	});

	const enrollmentStudentName = $derived(
		isEnrollment && studentMode === 'new' ? newFullName : (selectedStudent?.fullName ?? '')
	);

	const summary = $derived(
		buildPaymentSummary(
			purchaseType,
			enrollmentStudentName,
			selectedCourse?.name ?? null,
			selectedMonthlyPlan?.name ?? null,
			selectedFullPassPlan?.name ?? null,
			selectedDropInPlan?.name ?? null,
			selectedDropInPlan?.classesIncluded ?? DROP_IN_DEFAULT_CLASSES,
			paymentTotals
		)
	);

	$effect(() => {
		if (!paidAt) {
			const now = new Date();
			now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
			paidAt = now.toISOString().slice(0, 16);
		}
	});

	$effect(() => {
		if (values) {
			studentMode = values.studentMode === 'new' ? 'new' : 'existing';
			studentId = values.studentId;
			newFullName = values.newFullName ?? '';
			newPhone = extractPhoneDigits(values.newPhone ?? '');
			purchaseType = values.purchaseType;
			courseId = values.courseId;
			monthlyPlanId = values.monthlyPlanId;
			fullPassPlanId = values.fullPassPlanId;
			dropInPlanId = values.dropInPlanId;
			paymentMethod = values.paymentMethod;
			paidAt = values.paidAt;
			discountPercent = values.discountPercent ?? '0';
			notes = values.notes;
		} else {
			if (initialGroupId) {
				courseId = initialGroupId;
			}

			if (initialStudentId) {
				studentMode = 'existing';
				studentId = initialStudentId;
			}
		}
	});

	$effect(() => {
		if (Object.keys(errors).length > 0) {
			stepErrors = errors;
			currentStep = confirmationStep;
		}
	});

	function clearStudentIdError() {
		if (stepErrors.studentId) {
			const { studentId: _removed, ...rest } = stepErrors;
			stepErrors = rest;
		}
	}

	function selectModality(option: (typeof enrollmentModalityOptions)[number]) {
		purchaseType = option.purchaseType;
		monthlyPlanId = option.monthlyPlanId;
		fullPassPlanId = option.fullPassPlanId;
		dropInPlanId = option.dropInPlanId;
		stepErrors = {};
	}

	function validateCurrentStep() {
		if (isEnrollment && currentStep === 0) {
			const enrollmentErrors: Partial<Record<'studentId' | 'newFullName' | 'newPhone', string>> = {};

			if (studentMode === 'existing') {
				if (!studentId) {
					enrollmentErrors.studentId = 'Selecciona un alumno.';
				} else if (enrolledStudentIdSet.has(Number(studentId))) {
					enrollmentErrors.studentId = 'Este alumno ya está inscrito en esta clase.';
				}
			} else {
				if (!newFullName.trim()) {
					enrollmentErrors.newFullName = 'El nombre completo es obligatorio.';
				}
			}

			stepErrors = enrollmentErrors;
			return Object.keys(enrollmentErrors).length === 0;
		}

		if (isEnrollment && currentStep === 1) {
			const partial: PaymentWizardData = {
				studentId: studentMode === 'existing' ? studentId : '0',
				purchaseType,
				courseId,
				monthlyPlanId,
				fullPassPlanId,
				dropInPlanId,
				paymentMethod: 'Efectivo',
				paidAt: paidAt || '2000-01-01T00:00',
				discountPercent: '0',
				notes
			};

			const { errors: validationErrors } = validatePaymentWizard(partial, plans, courses);
			const filtered: Partial<Record<keyof PaymentWizardData, string>> = {};

			if (!selectedModalityKey) {
				filtered.purchaseType = 'Selecciona una modalidad.';
			}

			if (validationErrors.courseId) filtered.courseId = validationErrors.courseId;
			if (validationErrors.monthlyPlanId) filtered.monthlyPlanId = validationErrors.monthlyPlanId;
			if (validationErrors.fullPassPlanId) filtered.fullPassPlanId = validationErrors.fullPassPlanId;
			if (validationErrors.dropInPlanId) filtered.dropInPlanId = validationErrors.dropInPlanId;

			stepErrors = filtered;
			return Object.keys(filtered).length === 0;
		}

		const includesPlanDetails = isEnrollment ? currentStep >= 1 : currentStep >= detailStep;
		const includesPaymentDetails = currentStep >= paymentStep;

		const partial: PaymentWizardData = {
			studentId: currentStep >= 0 ? studentId : '',
			purchaseType: currentStep >= 1 ? purchaseType : 'monthly_only',
			courseId: includesPlanDetails && (needsMonthly || needsDropIn) ? courseId : '',
			monthlyPlanId: includesPlanDetails && needsMonthly ? monthlyPlanId : '',
			fullPassPlanId: includesPlanDetails && needsFullPass ? fullPassPlanId : '',
			dropInPlanId: includesPlanDetails && needsDropIn ? dropInPlanId : '',
			paymentMethod: includesPaymentDetails ? paymentMethod : 'Efectivo',
			paidAt: includesPaymentDetails ? paidAt : '',
			discountPercent: includesPaymentDetails ? discountPercent : '0',
			notes
		};

		const { errors: validationErrors } = validatePaymentWizard(partial, plans, courses);
		const filtered: Partial<Record<keyof PaymentWizardData, string>> = {};

		if (currentStep === 1 && !isEnrollment) {
			if (validationErrors.purchaseType) filtered.purchaseType = validationErrors.purchaseType;
			if (validationErrors.studentId) filtered.studentId = validationErrors.studentId;
		}

		if (currentStep === detailStep && !isEnrollment) {
			if (validationErrors.courseId) filtered.courseId = validationErrors.courseId;
			if (validationErrors.monthlyPlanId) filtered.monthlyPlanId = validationErrors.monthlyPlanId;
			if (validationErrors.fullPassPlanId) filtered.fullPassPlanId = validationErrors.fullPassPlanId;
			if (validationErrors.dropInPlanId) filtered.dropInPlanId = validationErrors.dropInPlanId;
		}

		if (currentStep === paymentStep) {
			if (validationErrors.paymentMethod) filtered.paymentMethod = validationErrors.paymentMethod;
			if (validationErrors.paidAt) filtered.paidAt = validationErrors.paidAt;
			if (validationErrors.discountPercent) filtered.discountPercent = validationErrors.discountPercent;
		}

		stepErrors = filtered;
		return Object.keys(filtered).length === 0;
	}

	function nextStep() {
		if (validateCurrentStep()) {
			currentStep = Math.min(currentStep + 1, steps.length - 1);
		}
	}

	function previousStep() {
		stepErrors = {};
		currentStep = Math.max(currentStep - 1, 0);
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-3">
		<div class="flex items-center justify-between gap-4">
			{#each steps as step, index (step)}
				<div class="flex flex-1 flex-col items-center gap-2">
					<div
						class={cn(
							'flex size-8 items-center justify-center rounded-full border text-sm font-medium',
							index < currentStep && 'bg-primary text-primary-foreground border-primary',
							index === currentStep && 'border-primary text-primary',
							index > currentStep && 'text-muted-foreground'
						)}
					>
						{#if index < currentStep}
							<CheckIcon />
						{:else}
							{index + 1}
						{/if}
					</div>
					<span class="text-muted-foreground hidden text-center text-xs sm:block">{step}</span>
				</div>
				{#if index < steps.length - 1}
					<Separator class="hidden flex-1 sm:block" />
				{/if}
			{/each}
		</div>
	</div>

	<form
		method="POST"
		action="?/register"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				try {
					if (result.type === 'redirect') {
						submitting = false;
						goto(result.location);
						return;
					}

					await update({ reset: false, invalidateAll: false });
				} finally {
					submitting = false;
				}
			};
		}}
	>
		<input type="hidden" name="studentMode" value={studentMode} />
		<input type="hidden" name="studentId" value={studentMode === 'existing' ? studentId : ''} />
		<input type="hidden" name="newFullName" value={studentMode === 'new' ? newFullName : ''} />
		<input type="hidden" name="newPhone" value={studentMode === 'new' ? newPhone : ''} />
		<input type="hidden" name="purchaseType" value={purchaseType} />
		<input type="hidden" name="courseId" value={courseId} />
		<input type="hidden" name="groupId" value={courseId} />
		<input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
		<input type="hidden" name="fullPassPlanId" value={fullPassPlanId} />
		<input type="hidden" name="dropInPlanId" value={dropInPlanId} />
		<input type="hidden" name="paymentMethod" value={paymentMethod} />
		<input type="hidden" name="paidAt" value={paidAt} />
		<input type="hidden" name="discountPercent" value={discountPercent} />
		<input type="hidden" name="notes" value={notes} />

		<div class="rounded-xl border p-6">
			{#if currentStep === 0}
				<FieldGroup>
					{#if isEnrollment}
						<Field>
							<FieldLabel>¿Cómo quieres registrar al alumno?</FieldLabel>
							<div class="flex flex-wrap gap-2">
								<Button
									type="button"
									variant={studentMode === 'existing' ? 'default' : 'outline'}
									size="sm"
									onclick={() => (studentMode = 'existing')}
								>
									Alumno existente
								</Button>
								<Button
									type="button"
									variant={studentMode === 'new' ? 'default' : 'outline'}
									size="sm"
									onclick={() => (studentMode = 'new')}
								>
									Nuevo alumno
								</Button>
							</div>
						</Field>

						{#if studentMode === 'existing'}
							<Field data-invalid={stepErrors.studentId || isSelectedStudentEnrolled ? true : undefined}>
								<FieldLabel for="studentId">Alumno</FieldLabel>
								<FieldDescription>Selecciona el alumno que quieres inscribir en esta clase.</FieldDescription>
								<select
									id="studentId"
									bind:value={studentId}
									onchange={clearStudentIdError}
									class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
								>
									<option value="">Selecciona un alumno</option>
									{#each students as student (student.id)}
										<option value={String(student.id)}>
											{student.phone
												? `${student.fullName} — ${formatPhone(student.phone)}`
												: student.fullName}
										</option>
									{/each}
								</select>
								{#if stepErrors.studentId}
									<FieldError>{stepErrors.studentId}</FieldError>
								{:else if isSelectedStudentEnrolled}
									<FieldError>Este alumno ya está inscrito en esta clase.</FieldError>
								{/if}
							</Field>
						{:else}
							<Field data-invalid={stepErrors.newFullName ? true : undefined}>
								<FieldLabel for="newFullName">Nombre completo</FieldLabel>
								<Input id="newFullName" bind:value={newFullName} required />
								{#if stepErrors.newFullName}
									<FieldError>{stepErrors.newFullName}</FieldError>
								{/if}
							</Field>
							<Field data-invalid={stepErrors.newPhone ? true : undefined}>
								<FieldLabel for="newPhone">Teléfono</FieldLabel>
								<PhoneInput
									id="newPhone"
									bind:value={newPhone}
								/>
								{#if stepErrors.newPhone}
									<FieldError>{stepErrors.newPhone}</FieldError>
								{/if}
							</Field>
						{/if}
					{:else}
					<Field data-invalid={stepErrors.studentId ? true : undefined}>
						<FieldLabel for="studentId">Alumno</FieldLabel>
						<FieldDescription>
							Opcional para pagos por clase. Déjalo vacío para registrar un pago ocasional sin
							alumno.
						</FieldDescription>
						<PopoverPrimitive.Root bind:open={studentPickerOpen}>
							<PopoverPrimitive.Trigger>
								{#snippet child({ props })}
									<Button {...props} id="studentId" type="button" variant="outline"
										class="w-full justify-between" aria-invalid={stepErrors.studentId ? true : undefined}>
										<span class="truncate">{selectedStudent
											? `${selectedStudent.fullName}${selectedStudent.phone ? ` — ${formatPhone(selectedStudent.phone)}` : ''}`
											: `${DROP_IN_GUEST_LABEL} — pago ocasional`}</span>
										<ChevronsUpDownIcon data-icon="inline-end" class="opacity-50" />
									</Button>
								{/snippet}
							</PopoverPrimitive.Trigger>
							<PopoverPrimitive.Portal>
								<PopoverPrimitive.Content
									class="bg-popover text-popover-foreground flex w-[var(--bits-popover-anchor-width)] flex-col gap-2 rounded-lg border p-2 shadow-md outline-hidden"
									sideOffset={6} align="start">
									<Input placeholder="Buscar por nombre o teléfono..." bind:value={studentSearch} aria-label="Buscar alumno" />
									<div class="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
										<button type="button" class="hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-2 text-left text-sm" onclick={() => selectPaymentStudent('')}>
											{DROP_IN_GUEST_LABEL} — pago ocasional
										</button>
										{#each filteredStudents as student (student.id)}
											<button type="button" class="hover:bg-accent hover:text-accent-foreground flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm transition-colors" onclick={() => selectPaymentStudent(String(student.id))}>
												<span class="font-medium">{student.fullName}</span>
												{#if student.phone}<span class="text-muted-foreground text-xs">{formatPhone(student.phone)}</span>{/if}
											</button>
										{:else}
											<p class="text-muted-foreground px-2 py-4 text-center text-sm">
												{students.length === 0 ? 'No hay alumnos disponibles.' : 'No se encontraron alumnos.'}
											</p>
										{/each}
									</div>
								</PopoverPrimitive.Content>
							</PopoverPrimitive.Portal>
						</PopoverPrimitive.Root>
						{#if stepErrors.studentId}
							<FieldError>{stepErrors.studentId}</FieldError>
						{/if}
					</Field>
					{/if}
				</FieldGroup>
			{:else if currentStep === 1}
				{#if isEnrollment}
					<div class="flex flex-col gap-4">
						{#if lockCourse && selectedCourse}
							<div class="bg-muted/50 rounded-lg border px-3 py-2 text-sm">
								<span class="text-muted-foreground">Clase: </span>
								<span class="font-medium">{selectedCourse.name}</span>
							</div>
						{/if}

						{#if enrollmentModalityOptions.length === 0}
							<p class="text-muted-foreground text-sm">
								No hay planes de pago configurados. Créalos en Configuraciones.
							</p>
						{:else}
							<div class="grid gap-4 md:grid-cols-2">
								{#each enrollmentModalityOptions as option (option.key)}
									<button
										type="button"
										class="text-start"
										onclick={() => selectModality(option)}
									>
										<Card.Root
											class={cn(
												'h-full transition-colors',
												selectedModalityKey === option.key &&
													'border-primary ring-primary ring-1'
											)}
										>
											<Card.Header>
												<Card.Title class="text-base">{option.title}</Card.Title>
												<Card.Description>{option.description}</Card.Description>
											</Card.Header>
											<Card.Content>
												<p class="text-lg font-semibold">{formatPrice(option.price)}</p>
											</Card.Content>
										</Card.Root>
									</button>
								{/each}
							</div>
						{/if}

						{#if stepErrors.purchaseType}
							<p class="text-destructive text-sm">{stepErrors.purchaseType}</p>
						{/if}
						{#if stepErrors.monthlyPlanId}
							<p class="text-destructive text-sm">{stepErrors.monthlyPlanId}</p>
						{/if}
						{#if stepErrors.fullPassPlanId}
							<p class="text-destructive text-sm">{stepErrors.fullPassPlanId}</p>
						{/if}
						{#if stepErrors.dropInPlanId}
							<p class="text-destructive text-sm">{stepErrors.dropInPlanId}</p>
						{/if}
					</div>
				{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each PURCHASE_TYPES as type (type)}
						<button
							type="button"
							class="text-start"
							onclick={() => (purchaseType = type)}
						>
							<Card.Root
								class={cn(
									'h-full transition-colors',
									purchaseType === type && 'border-primary ring-primary ring-1'
								)}
							>
								<Card.Header>
									<Card.Title class="text-base">{PURCHASE_TYPE_LABELS[type]}</Card.Title>
									<Card.Description>{getPurchaseTypeDescription(type)}</Card.Description>
								</Card.Header>
							</Card.Root>
						</button>
					{/each}
				</div>
				{/if}
			{:else if currentStep === detailStep && !isEnrollment}
				<FieldGroup>
					{#if needsMonthly}
						<Field data-invalid={stepErrors.courseId ? true : undefined}>
							<FieldLabel for="courseId">Clase</FieldLabel>
							{#if lockCourse && selectedCourse}
								<Input value={selectedCourse.name} disabled readonly />
							{:else}
								<select
									id="courseId"
									bind:value={courseId}
									class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
								>
									<option value="">Selecciona una clase</option>
									{#each courses as course (course.id)}
										<option value={String(course.id)}>{course.name}</option>
									{/each}
								</select>
							{/if}
							{#if stepErrors.courseId}
								<FieldError>{stepErrors.courseId}</FieldError>
							{/if}
						</Field>

						<Field data-invalid={stepErrors.monthlyPlanId ? true : undefined}>
							<FieldLabel for="monthlyPlanId">Plan mensual</FieldLabel>
							<select
								id="monthlyPlanId"
								bind:value={monthlyPlanId}
								class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
							>
								<option value="">Selecciona un plan mensual</option>
								{#each monthlyPlans as plan (plan.id)}
									<option value={String(plan.id)}>
										{plan.name} — {formatPrice(plan.price)}
									</option>
								{/each}
							</select>
							{#if monthlyPlans.length === 0}
								<FieldDescription>
									No hay planes mensuales en el catálogo. Créalos en Configuraciones.
								</FieldDescription>
							{/if}
							{#if stepErrors.monthlyPlanId}
								<FieldError>{stepErrors.monthlyPlanId}</FieldError>
							{/if}
						</Field>
					{/if}

					{#if needsFullPass}
						<Field data-invalid={stepErrors.fullPassPlanId ? true : undefined}>
							<FieldLabel for="fullPassPlanId">Plan full pass</FieldLabel>
							<select
								id="fullPassPlanId"
								bind:value={fullPassPlanId}
								class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
							>
								<option value="">Selecciona un plan full pass</option>
								{#each fullPassPlans as plan (plan.id)}
									<option value={String(plan.id)}>
										{plan.name} — {formatPrice(plan.price)} ({plan.hoursIncluded ??
											FULL_PASS_DEFAULT_HOURS} h)
									</option>
								{/each}
							</select>
							{#if fullPassPlans.length === 0}
								<FieldDescription>
									No hay planes full pass en el catálogo. Créalos en Configuraciones.
								</FieldDescription>
							{/if}
							{#if stepErrors.fullPassPlanId}
								<FieldError>{stepErrors.fullPassPlanId}</FieldError>
							{/if}
						</Field>
					{/if}

					{#if needsDropIn}
						<Field data-invalid={stepErrors.courseId ? true : undefined}>
							<FieldLabel for="courseId-dropin">Clase</FieldLabel>
							<FieldDescription>
								Clase a la que asistirá el alumno con este pago por clase.
							</FieldDescription>
							{#if lockCourse && selectedCourse}
								<Input value={selectedCourse.name} disabled readonly />
							{:else}
								<select
									id="courseId-dropin"
									bind:value={courseId}
									class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
								>
									<option value="">Selecciona una clase</option>
									{#each courses as course (course.id)}
										<option value={String(course.id)}>{course.name}</option>
									{/each}
								</select>
							{/if}
							{#if stepErrors.courseId}
								<FieldError>{stepErrors.courseId}</FieldError>
							{/if}
						</Field>

						<Field data-invalid={stepErrors.dropInPlanId ? true : undefined}>
							<FieldLabel for="dropInPlanId">Plan por clase</FieldLabel>
							<select
								id="dropInPlanId"
								bind:value={dropInPlanId}
								class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
							>
								<option value="">Selecciona un plan por clase</option>
								{#each dropInPlans as plan (plan.id)}
									<option value={String(plan.id)}>
										{plan.name} — {formatPrice(plan.price)} ({plan.classesIncluded ??
											DROP_IN_DEFAULT_CLASSES} clase{(plan.classesIncluded ??
											DROP_IN_DEFAULT_CLASSES) === 1
											? ''
											: 's'})
									</option>
								{/each}
							</select>
							{#if dropInPlans.length === 0}
								<FieldDescription>
									No hay planes por clase en el catálogo. Créalos en Configuraciones.
								</FieldDescription>
							{/if}
							{#if stepErrors.dropInPlanId}
								<FieldError>{stepErrors.dropInPlanId}</FieldError>
							{/if}
						</Field>
					{/if}
				</FieldGroup>
			{:else if currentStep === paymentStep}
				<FieldGroup>
					<Field data-invalid={stepErrors.paymentMethod ? true : undefined}>
						<FieldLabel for="paymentMethod">Método de pago</FieldLabel>
						<select
							id="paymentMethod"
							bind:value={paymentMethod}
							class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
						>
							{#each paymentMethods as method (method)}
								<option value={method}>{method}</option>
							{/each}
						</select>
						{#if stepErrors.paymentMethod}
							<FieldError>{stepErrors.paymentMethod}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={stepErrors.paidAt ? true : undefined}>
						<FieldLabel for="paidAt">Fecha y hora del pago</FieldLabel>
						<Input id="paidAt" type="datetime-local" bind:value={paidAt} />
						{#if stepErrors.paidAt}
							<FieldError>{stepErrors.paidAt}</FieldError>
						{/if}
					</Field>

					<Field>
						<FieldLabel for="notes">Notas</FieldLabel>
						<Textarea id="notes" bind:value={notes} placeholder="Observaciones opcionales" />
					</Field>

					<Field data-invalid={stepErrors.discountPercent ? true : undefined}>
						<FieldLabel for="discountPercent">Descuento (%)</FieldLabel>
						<FieldDescription>Opcional. Porcentaje de descuento sobre el subtotal.</FieldDescription>
						<Input
							id="discountPercent"
							type="number"
							min="0"
							max="100"
							step="1"
							bind:value={discountPercent}
							placeholder="0"
						/>
						{#if stepErrors.discountPercent}
							<FieldError>{stepErrors.discountPercent}</FieldError>
						{/if}
					</Field>

					<div class="bg-muted space-y-2 rounded-lg p-4">
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Subtotal</span>
							<span>{formatPrice(paymentTotals.subtotalAmount)}</span>
						</div>
						{#if paymentTotals.discountPercent > 0}
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">
									Descuento ({formatDiscountPercent(paymentTotals.discountPercent)})
								</span>
								<span class="text-destructive">-{formatPrice(paymentTotals.discountAmount)}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between border-t pt-2">
							<span class="font-medium">{isEnrollment ? 'Total a cobrar' : 'Total a registrar'}</span>
							<span class="text-2xl font-bold">{formatPrice(paymentTotals.totalAmount)}</span>
						</div>
					</div>
				</FieldGroup>
			{:else if currentStep === confirmationStep}
				<div class="flex flex-col gap-4">
					<div class="flex items-center gap-2">
						<Badge>
							{isEnrollment && selectedModalityOption
								? selectedModalityOption.title
								: PURCHASE_TYPE_LABELS[purchaseType]}
						</Badge>
						<span class="text-muted-foreground text-sm">{summary}</span>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-sm">Alumno</p>
							<p class="font-medium">
								{isEnrollment && studentMode === 'new'
									? newFullName
									: (selectedStudent?.fullName ?? DROP_IN_GUEST_LABEL)}
							</p>
						</div>
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-sm">Método de pago</p>
							<p class="font-medium">{paymentMethod}</p>
						</div>
						{#if needsMonthly && selectedCourse && selectedMonthlyPlan}
							<div class="rounded-lg border p-4">
								<p class="text-muted-foreground text-sm">Plan mensual</p>
								<p class="font-medium">{selectedMonthlyPlan.name}</p>
								<p class="text-muted-foreground text-sm">{selectedCourse.name}</p>
							</div>
						{/if}
						{#if needsFullPass && selectedFullPassPlan}
							<div class="rounded-lg border p-4">
								<p class="text-muted-foreground text-sm">Full pass</p>
								<p class="font-medium">{selectedFullPassPlan.name}</p>
								<p class="text-muted-foreground text-sm">
									{selectedFullPassPlan.hoursIncluded ?? FULL_PASS_DEFAULT_HOURS} horas
								</p>
							</div>
						{/if}
						{#if needsDropIn && selectedCourse && selectedDropInPlan}
							<div class="rounded-lg border p-4">
								<p class="text-muted-foreground text-sm">Clase suelta</p>
								<p class="font-medium">{selectedDropInPlan.name}</p>
								<p class="text-muted-foreground text-sm">
									{selectedCourse.name} — {selectedDropInPlan.classesIncluded ??
										DROP_IN_DEFAULT_CLASSES} clase{(selectedDropInPlan.classesIncluded ??
										DROP_IN_DEFAULT_CLASSES) === 1
										? ''
										: 's'}
								</p>
							</div>
						{/if}
						<div class="rounded-lg border p-4 sm:col-span-2">
							<div class="space-y-2">
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Subtotal</span>
									<span>{formatPrice(paymentTotals.subtotalAmount)}</span>
								</div>
								{#if paymentTotals.discountPercent > 0}
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">
											Descuento ({formatDiscountPercent(paymentTotals.discountPercent)})
										</span>
										<span class="text-destructive">
											-{formatPrice(paymentTotals.discountAmount)}
										</span>
									</div>
								{/if}
								<div class="flex items-center justify-between border-t pt-2">
									<span class="text-muted-foreground">Total</span>
									<span class="text-2xl font-bold">{formatPrice(paymentTotals.totalAmount)}</span>
								</div>
							</div>
						</div>
					</div>

					{#if confirmationErrors.length > 0}
						<div class="bg-destructive/10 text-destructive rounded-lg border border-destructive/30 px-4 py-3 text-sm">
							<p class="font-medium">
								{isEnrollment
									? 'No se pudo completar la inscripción:'
									: 'No se pudo completar el registro del pago:'}
							</p>
							<ul class="mt-2 list-disc ps-4">
								{#each confirmationErrors as error (error.label)}
									<li>{error.label}: {error.message}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between pt-4">
			<Button type="button" variant="outline" onclick={previousStep} disabled={currentStep === 0 || submitting}>
				<ChevronLeftIcon data-icon="inline-start" />
				Anterior
			</Button>

			{#if currentStep < steps.length - 1}
				<Button
					type="button"
					onclick={nextStep}
					disabled={isEnrollment && currentStep === 0 && isSelectedStudentEnrolled}
				>
					Siguiente
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			{:else}
				<Button type="submit" disabled={submitting}>
					{submitting
						? isEnrollment
							? 'Inscribiendo...'
							: 'Registrando...'
						: isEnrollment
							? 'Inscribir alumno'
							: 'Registrar pago'}
				</Button>
			{/if}
		</div>
	</form>
</div>
