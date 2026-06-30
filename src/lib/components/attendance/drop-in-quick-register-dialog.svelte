<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import {
		DROP_IN_DEFAULT_CLASSES,
		DROP_IN_GUEST_LABEL,
		type PaymentMethod,
		type QuickDropInFormData,
		type WizardPaymentPlan,
		type WizardStudent
	} from '$lib/payments.js';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	let {
		open = $bindable(false),
		courseId,
		sessionDate,
		students,
		dropInPlans,
		paymentMethods,
		errors = {},
		values = null,
		message = null,
		onClosed
	}: {
		open?: boolean;
		courseId: number;
		sessionDate: string;
		students: WizardStudent[];
		dropInPlans: WizardPaymentPlan[];
		paymentMethods: readonly PaymentMethod[];
		errors?: Partial<Record<keyof QuickDropInFormData, string>>;
		values?: QuickDropInFormData | null;
		message?: string | null;
		onClosed?: () => void;
	} = $props();

	const formId = $props.id();

	let studentId = $state('');
	let dropInPlanId = $state('');
	let paymentMethod = $state<PaymentMethod>('Efectivo');
	let notes = $state('');
	let submitting = $state(false);

	const selectedPlan = $derived(dropInPlans.find((plan) => plan.id === Number(dropInPlanId)));
	const submitLabel = $derived(
		studentId ? 'Registrar pago y asistencia' : 'Registrar pago'
	);

	$effect(() => {
		if (open) {
			studentId = values?.studentId ?? '';
			dropInPlanId = values?.dropInPlanId ?? '';
			paymentMethod = values?.paymentMethod ?? 'Efectivo';
			notes = values?.notes ?? '';
		}
	});

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			submitting = false;
			onClosed?.();
		}
	}
</script>

<Dialog.Root open={open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Pago por clase</Dialog.Title>
			<Dialog.Description>
				Registra un pago ocasional. Si seleccionas un alumno, también se marcará como asistió en
				esta sesión.
			</Dialog.Description>
		</Dialog.Header>

		<form
			id="drop-in-quick-form-{formId}"
			method="POST"
			action="?/registerDropIn"
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							submitting = false;
							open = false;
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
			<input type="hidden" name="courseId" value={courseId} />
			<input type="hidden" name="sessionDate" value={sessionDate} />

			<FieldGroup>
				{#if message}
					<p class="text-destructive text-sm">{message}</p>
				{/if}

				<Field data-invalid={errors.studentId ? true : undefined}>
					<FieldLabel for="studentId-{formId}">Alumno (opcional)</FieldLabel>
					<FieldDescription>
						Déjalo vacío para registrar solo el pago. Si eliges un alumno, se registrará su
						asistencia en esta sesión.
					</FieldDescription>
					<select
						id="studentId-{formId}"
						name="studentId"
						bind:value={studentId}
						class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
					>
						<option value="">{DROP_IN_GUEST_LABEL} — solo registrar pago</option>
						{#each students as student (student.id)}
							<option value={String(student.id)}>{student.fullName} — {student.email}</option>
						{/each}
					</select>
					{#if errors.studentId}
						<FieldError>{errors.studentId}</FieldError>
					{/if}
				</Field>

				<Field data-invalid={errors.dropInPlanId ? true : undefined}>
					<FieldLabel for="dropInPlanId-{formId}">Plan por clase</FieldLabel>
					<select
						id="dropInPlanId-{formId}"
						name="dropInPlanId"
						bind:value={dropInPlanId}
						required
						class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
					>
						<option value="">Selecciona un plan</option>
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
							No hay planes por clase. Créalos en Configuraciones → Planes de pago.
						</FieldDescription>
					{/if}
					{#if errors.dropInPlanId}
						<FieldError>{errors.dropInPlanId}</FieldError>
					{/if}
				</Field>

				<Field data-invalid={errors.paymentMethod ? true : undefined}>
					<FieldLabel for="paymentMethod-{formId}">Método de pago</FieldLabel>
					<select
						id="paymentMethod-{formId}"
						name="paymentMethod"
						bind:value={paymentMethod}
						required
						class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
					>
						{#each paymentMethods as method (method)}
							<option value={method}>{method}</option>
						{/each}
					</select>
					{#if errors.paymentMethod}
						<FieldError>{errors.paymentMethod}</FieldError>
					{/if}
				</Field>

				<Field>
					<FieldLabel for="notes-{formId}">Notas</FieldLabel>
					<Textarea
						id="notes-{formId}"
						name="notes"
						bind:value={notes}
						placeholder="Observaciones opcionales"
					/>
				</Field>

				{#if selectedPlan}
					<div class="bg-muted rounded-lg p-4">
						<p class="text-sm font-medium">Total a registrar</p>
						<p class="text-2xl font-bold">{formatPrice(selectedPlan.price)}</p>
						<p class="text-muted-foreground mt-1 text-xs">
							{#if studentId}
								Se descontará 1 clase al marcar asistencia en esta sesión.
							{:else}
								Solo se registrará el ingreso del pago, sin asistencia ni vigencia.
							{/if}
						</p>
					</div>
				{/if}
			</FieldGroup>
		</form>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button
				type="submit"
				form="drop-in-quick-form-{formId}"
				disabled={submitting || dropInPlans.length === 0}
			>
				{submitting ? 'Registrando...' : submitLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
