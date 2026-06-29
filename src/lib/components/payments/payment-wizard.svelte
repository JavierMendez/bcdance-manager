<script lang="ts">
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
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import {
		PURCHASE_TYPES,
		PURCHASE_TYPE_LABELS,
		getPurchaseTypeDescription,
		calculateWizardTotal,
		buildPaymentSummary,
		FULL_PASS_DEFAULT_HOURS,
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
		errors = {},
		values = null
	}: {
		students: WizardStudent[];
		courses: WizardCourse[];
		plans: WizardPaymentPlan[];
		paymentMethods: readonly PaymentMethod[];
		errors?: Partial<Record<keyof PaymentWizardData, string>>;
		values?: PaymentWizardData | null;
	} = $props();

	const steps = [
		'Alumno',
		'Tipo de compra',
		'Detalle',
		'Pago',
		'Confirmación'
	] as const;

	let currentStep = $state(0);
	let submitting = $state(false);

	let studentId = $state('');
	let purchaseType = $state<PurchaseType>('monthly_only');
	let courseId = $state('');
	let monthlyPlanId = $state('');
	let fullPassPlanId = $state('');
	let paymentMethod = $state<PaymentMethod>('Efectivo');
	let paidAt = $state('');
	let notes = $state('');
	let stepErrors = $state<Partial<Record<keyof PaymentWizardData, string>>>({});

	const monthlyPlans = $derived(plans.filter((plan) => plan.planType === 'monthly'));
	const fullPassPlans = $derived(plans.filter((plan) => plan.planType === 'full_pass'));
	const needsMonthly = $derived(
		purchaseType === 'monthly_only' || purchaseType === 'combined'
	);
	const needsFullPass = $derived(
		purchaseType === 'full_pass_only' || purchaseType === 'combined'
	);

	const wizardData = $derived({
		studentId,
		purchaseType,
		courseId,
		monthlyPlanId,
		fullPassPlanId,
		paymentMethod,
		paidAt,
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
	const totalAmount = $derived(
		calculateWizardTotal(
			purchaseType,
			plans,
			Number(monthlyPlanId),
			Number(fullPassPlanId)
		)
	);

	const summary = $derived(
		selectedStudent
			? buildPaymentSummary(
					purchaseType,
					selectedStudent.fullName,
					selectedCourse?.name ?? null,
					selectedMonthlyPlan?.name ?? null,
					selectedFullPassPlan?.name ?? null,
					totalAmount
				)
			: ''
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
			studentId = values.studentId;
			purchaseType = values.purchaseType;
			courseId = values.courseId;
			monthlyPlanId = values.monthlyPlanId;
			fullPassPlanId = values.fullPassPlanId;
			paymentMethod = values.paymentMethod;
			paidAt = values.paidAt;
			notes = values.notes;
		}
	});

	$effect(() => {
		if (Object.keys(errors).length > 0) {
			stepErrors = errors;
			currentStep = 4;
		}
	});

	function validateCurrentStep() {
		const partial: PaymentWizardData = {
			studentId: currentStep >= 0 ? studentId : '',
			purchaseType: currentStep >= 1 ? purchaseType : 'monthly_only',
			courseId: currentStep >= 2 && needsMonthly ? courseId : '',
			monthlyPlanId: currentStep >= 2 && needsMonthly ? monthlyPlanId : '',
			fullPassPlanId: currentStep >= 2 && needsFullPass ? fullPassPlanId : '',
			paymentMethod: currentStep >= 3 ? paymentMethod : 'Efectivo',
			paidAt: currentStep >= 3 ? paidAt : '',
			notes
		};

		const { errors: validationErrors } = validatePaymentWizard(partial, plans, courses);
		const filtered: Partial<Record<keyof PaymentWizardData, string>> = {};

		if (currentStep === 0 && validationErrors.studentId) {
			filtered.studentId = validationErrors.studentId;
		}

		if (currentStep === 1 && validationErrors.purchaseType) {
			filtered.purchaseType = validationErrors.purchaseType;
		}

		if (currentStep === 2) {
			if (validationErrors.courseId) filtered.courseId = validationErrors.courseId;
			if (validationErrors.monthlyPlanId) filtered.monthlyPlanId = validationErrors.monthlyPlanId;
			if (validationErrors.fullPassPlanId) filtered.fullPassPlanId = validationErrors.fullPassPlanId;
		}

		if (currentStep === 3) {
			if (validationErrors.paymentMethod) filtered.paymentMethod = validationErrors.paymentMethod;
			if (validationErrors.paidAt) filtered.paidAt = validationErrors.paidAt;
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
		<input type="hidden" name="studentId" value={studentId} />
		<input type="hidden" name="purchaseType" value={purchaseType} />
		<input type="hidden" name="courseId" value={courseId} />
		<input type="hidden" name="monthlyPlanId" value={monthlyPlanId} />
		<input type="hidden" name="fullPassPlanId" value={fullPassPlanId} />
		<input type="hidden" name="paymentMethod" value={paymentMethod} />
		<input type="hidden" name="paidAt" value={paidAt} />
		<input type="hidden" name="notes" value={notes} />

		<div class="rounded-xl border p-6">
			{#if currentStep === 0}
				<FieldGroup>
					<Field data-invalid={stepErrors.studentId ? true : undefined}>
						<FieldLabel for="studentId">Alumno</FieldLabel>
						<FieldDescription>Selecciona el alumno que realiza el pago.</FieldDescription>
						<select
							id="studentId"
							bind:value={studentId}
							class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
						>
							<option value="">Selecciona un alumno</option>
							{#each students as student (student.id)}
								<option value={String(student.id)}>{student.fullName} — {student.email}</option>
							{/each}
						</select>
						{#if stepErrors.studentId}
							<FieldError>{stepErrors.studentId}</FieldError>
						{/if}
					</Field>
				</FieldGroup>
			{:else if currentStep === 1}
				<div class="grid gap-4 md:grid-cols-3">
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
			{:else if currentStep === 2}
				<FieldGroup>
					{#if needsMonthly}
						<Field data-invalid={stepErrors.courseId ? true : undefined}>
							<FieldLabel for="courseId">Curso</FieldLabel>
							<select
								id="courseId"
								bind:value={courseId}
								class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
							>
								<option value="">Selecciona un curso</option>
								{#each courses as course (course.id)}
									<option value={String(course.id)}>{course.name}</option>
								{/each}
							</select>
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
				</FieldGroup>
			{:else if currentStep === 3}
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

					<div class="bg-muted rounded-lg p-4">
						<p class="text-sm font-medium">Total a registrar</p>
						<p class="text-2xl font-bold">{formatPrice(totalAmount)}</p>
					</div>
				</FieldGroup>
			{:else}
				<div class="flex flex-col gap-4">
					<div class="flex items-center gap-2">
						<Badge>{PURCHASE_TYPE_LABELS[purchaseType]}</Badge>
						<span class="text-muted-foreground text-sm">{summary}</span>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-sm">Alumno</p>
							<p class="font-medium">{selectedStudent?.fullName}</p>
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
						<div class="rounded-lg border p-4 sm:col-span-2">
							<p class="text-muted-foreground text-sm">Total</p>
							<p class="text-2xl font-bold">{formatPrice(totalAmount)}</p>
						</div>
					</div>

					{#if Object.keys(errors).length > 0}
						<p class="text-destructive text-sm">
							Revisa los datos del formulario antes de registrar el pago.
						</p>
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
				<Button type="button" onclick={nextStep}>
					Siguiente
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			{:else}
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Registrando...' : 'Registrar pago'}
				</Button>
			{/if}
		</div>
	</form>
</div>
