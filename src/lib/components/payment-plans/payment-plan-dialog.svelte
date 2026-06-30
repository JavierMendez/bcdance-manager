<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
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
	import {
		BILLING_PERIODS,
		PLAN_TYPES,
		toPaymentPlanFormValues,
		type PaymentPlanFormValues,
		type PlanType,
		type SerializedPaymentPlan
	} from '$lib/payment-plans.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';
	import { cn } from '$lib/utils.js';

	type Mode = 'create' | 'edit';

	let {
		open = $bindable(false),
		mode,
		paymentPlan = null,
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		mode: Mode;
		paymentPlan?: SerializedPaymentPlan | null;
		errors?: Record<string, string>;
		values?: PaymentPlanFormValues | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();
	const action = $derived(mode === 'create' ? '?/create' : '?/update');
	const title = $derived(mode === 'create' ? 'Nuevo plan de pago' : 'Editar plan de pago');
	const description = $derived(
		mode === 'create'
			? 'Agrega un plan al catálogo para usarlo en la gestión de alumnos y pagos.'
			: 'Actualiza los datos del plan. Los pagos ya registrados conservan el precio histórico.'
	);

	let name = $state('');
	let descriptionValue = $state('');
	let price = $state('');
	let billingPeriod = $state<PaymentPlanFormValues['billingPeriod']>('Mensual');
	let planType = $state<PlanType>('monthly');
	let classesIncluded = $state('');
	let hoursIncluded = $state('12');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			const defaults = paymentPlan ? toPaymentPlanFormValues(paymentPlan) : null;
			name = values?.name ?? defaults?.name ?? '';
			descriptionValue = values?.description ?? defaults?.description ?? '';
			price = values?.price ?? defaults?.price ?? '';
			billingPeriod = values?.billingPeriod ?? defaults?.billingPeriod ?? 'Mensual';
			planType = values?.planType ?? defaults?.planType ?? 'monthly';
			classesIncluded = values?.classesIncluded ?? defaults?.classesIncluded ?? '';
			hoursIncluded = values?.hoursIncluded ?? defaults?.hoursIncluded ?? '12';
		}
	});

	$effect(() => {
		if (planType === 'drop_in') {
			billingPeriod = 'Por clase';
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
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		{#key `${mode}-${paymentPlan?.id ?? 'new'}`}
			<form
				id="payment-plan-form-{formId}"
				method="POST"
				{action}
				use:enhance={createDialogSubmitHandler({
					setSubmitting: (value) => (submitting = value),
					setOpen: (value) => (open = value),
					onSuccess,
					onClosed
				})}
			>
				{#if mode === 'edit' && paymentPlan}
					<input type="hidden" name="id" value={paymentPlan.id} />
				{/if}

				<FieldGroup>
					<Field data-invalid={errors.name ? true : undefined}>
						<FieldLabel for="name-{formId}">Nombre</FieldLabel>
						<Input
							id="name-{formId}"
							name="name"
							bind:value={name}
							placeholder="Ej. Plan mensual 4 clases"
							required
							aria-invalid={errors.name ? true : undefined}
						/>
						{#if errors.name}
							<FieldError>{errors.name}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.description ? true : undefined}>
						<FieldLabel for="description-{formId}">Descripción</FieldLabel>
						<Textarea
							id="description-{formId}"
							name="description"
							bind:value={descriptionValue}
							required
							aria-invalid={errors.description ? true : undefined}
						/>
						{#if errors.description}
							<FieldError>{errors.description}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.planType ? true : undefined}>
						<FieldLabel for="planType-{formId}">Tipo de plan</FieldLabel>
						<select
							id="planType-{formId}"
							name="planType"
							bind:value={planType}
							required
							class={cn(
								'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none'
							)}
						>
							{#each PLAN_TYPES as type (type.value)}
								<option value={type.value}>{type.label}</option>
							{/each}
						</select>
						{#if errors.planType}
							<FieldError>{errors.planType}</FieldError>
						{/if}
					</Field>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={errors.price ? true : undefined}>
							<FieldLabel for="price-{formId}">Precio</FieldLabel>
							<Input
								id="price-{formId}"
								name="price"
								type="number"
								min="1"
								step="1"
								bind:value={price}
								placeholder="45000"
								required
								aria-invalid={errors.price ? true : undefined}
							/>
							<FieldDescription>Precio en pesos mexicanos (MXN).</FieldDescription>
							{#if errors.price}
								<FieldError>{errors.price}</FieldError>
							{/if}
						</Field>

						<Field data-invalid={errors.billingPeriod ? true : undefined}>
							<FieldLabel for="billingPeriod-{formId}">Periodicidad</FieldLabel>
							{#if planType === 'drop_in'}
								<input type="hidden" name="billingPeriod" value="Por clase" />
								<Input id="billingPeriod-{formId}" value="Por clase" disabled readonly />
							{:else}
								<select
									id="billingPeriod-{formId}"
									name="billingPeriod"
									bind:value={billingPeriod}
									required
									aria-invalid={errors.billingPeriod ? true : undefined}
									class={cn(
										'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none'
									)}
								>
									{#each BILLING_PERIODS as period (period)}
										<option value={period}>{period}</option>
									{/each}
								</select>
							{/if}
							{#if errors.billingPeriod}
								<FieldError>{errors.billingPeriod}</FieldError>
							{/if}
						</Field>
					</div>

					{#if planType === 'monthly'}
						<Field data-invalid={errors.classesIncluded ? true : undefined}>
							<FieldLabel for="classesIncluded-{formId}">Clases incluidas</FieldLabel>
							<Input
								id="classesIncluded-{formId}"
								name="classesIncluded"
								type="number"
								min="1"
								step="1"
								bind:value={classesIncluded}
								placeholder="4"
								aria-invalid={errors.classesIncluded ? true : undefined}
							/>
							<FieldDescription>Opcional. Cantidad de clases que incluye el plan.</FieldDescription>
							{#if errors.classesIncluded}
								<FieldError>{errors.classesIncluded}</FieldError>
							{/if}
						</Field>
					{:else if planType === 'full_pass'}
						<Field data-invalid={errors.hoursIncluded ? true : undefined}>
							<FieldLabel for="hoursIncluded-{formId}">Horas incluidas</FieldLabel>
							<Input
								id="hoursIncluded-{formId}"
								name="hoursIncluded"
								type="number"
								min="1"
								step="1"
								bind:value={hoursIncluded}
								placeholder="12"
								required
								aria-invalid={errors.hoursIncluded ? true : undefined}
							/>
							<FieldDescription>Horas disponibles para cualquier curso.</FieldDescription>
							{#if errors.hoursIncluded}
								<FieldError>{errors.hoursIncluded}</FieldError>
							{/if}
						</Field>
					{:else}
						<Field data-invalid={errors.classesIncluded ? true : undefined}>
							<FieldLabel for="classesIncluded-{formId}">Clases incluidas</FieldLabel>
							<Input
								id="classesIncluded-{formId}"
								name="classesIncluded"
								type="number"
								min="1"
								step="1"
								bind:value={classesIncluded}
								placeholder="1"
								aria-invalid={errors.classesIncluded ? true : undefined}
							/>
							<FieldDescription>
								Cantidad de clases que otorga este pago (por defecto 1 clase suelta).
							</FieldDescription>
							{#if errors.classesIncluded}
								<FieldError>{errors.classesIncluded}</FieldError>
							{/if}
						</Field>
					{/if}
				</FieldGroup>
			</form>
		{/key}

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="payment-plan-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : mode === 'create' ? 'Crear plan' : 'Guardar cambios'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
