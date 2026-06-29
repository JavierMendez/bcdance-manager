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
		type PaymentPlanFormValues,
		type PlanType
	} from '$lib/payment-plans.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';
	import { cn } from '$lib/utils.js';

	let {
		open = $bindable(false),
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		errors?: Record<string, string>;
		values?: PaymentPlanFormValues | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();

	let name = $state('');
	let description = $state('');
	let price = $state('');
	let billingPeriod = $state<PaymentPlanFormValues['billingPeriod']>('Mensual');
	let planType = $state<PlanType>('monthly');
	let classesIncluded = $state('');
	let hoursIncluded = $state('12');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			name = values?.name ?? '';
			description = values?.description ?? '';
			price = values?.price ?? '';
			billingPeriod = values?.billingPeriod ?? 'Mensual';
			planType = values?.planType ?? 'monthly';
			classesIncluded = values?.classesIncluded ?? '';
			hoursIncluded = values?.hoursIncluded ?? '12';
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
			<Dialog.Title>Nuevo plan de pago</Dialog.Title>
			<Dialog.Description>
				Agrega un plan al catálogo para usarlo en la gestión de alumnos y pagos.
			</Dialog.Description>
		</Dialog.Header>

		<form
			id="payment-plan-form-{formId}"
			method="POST"
			action="?/create"
			use:enhance={createDialogSubmitHandler({
				setSubmitting: (value) => (submitting = value),
				setOpen: (value) => (open = value),
				onSuccess,
				onClosed
			})}
		>
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
						bind:value={description}
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
						<FieldDescription>Precio en pesos chilenos (CLP).</FieldDescription>
						{#if errors.price}
							<FieldError>{errors.price}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.billingPeriod ? true : undefined}>
						<FieldLabel for="billingPeriod-{formId}">Periodicidad</FieldLabel>
						<select
							id="billingPeriod-{formId}"
							name="billingPeriod"
							bind:value={billingPeriod}
							required
							aria-invalid={errors.billingPeriod ? true : undefined}
							class={cn(
								'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
							)}
						>
							{#each BILLING_PERIODS as period (period)}
								<option value={period}>{period}</option>
							{/each}
						</select>
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
				{:else}
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
				{/if}
			</FieldGroup>
		</form>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="payment-plan-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : 'Crear plan'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
