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
		EXPENSE_CATEGORY_LABELS,
		EXPENSE_CATEGORIES,
		toExpenseFormValues,
		type ExpenseFormValues
	} from '$lib/cash-flow.js';
	import type { PaymentMethod } from '$lib/payments.js';
	import { enhance } from '$app/forms';

	let {
		open = $bindable(false),
		paymentMethods,
		errors = {},
		values = null,
		message = null,
		onClosed
	}: {
		open?: boolean;
		paymentMethods: readonly PaymentMethod[];
		errors?: Partial<Record<keyof ExpenseFormValues, string>>;
		values?: ExpenseFormValues | null;
		message?: string | null;
		onClosed?: () => void;
	} = $props();

	const formId = $props.id();

	let amount = $state('');
	let category = $state<ExpenseFormValues['category']>('');
	let description = $state('');
	let paymentMethod = $state<PaymentMethod>('Efectivo');
	let paidAt = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			const defaults = toExpenseFormValues();
			amount = values?.amount ?? defaults.amount;
			category = values?.category ?? defaults.category;
			description = values?.description ?? defaults.description;
			paymentMethod = values?.paymentMethod ?? defaults.paymentMethod;
			paidAt = values?.paidAt ?? defaults.paidAt;
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
			<Dialog.Title>Registrar egreso</Dialog.Title>
			<Dialog.Description>
				Registra una salida de dinero como renta, insumos, nómina u otros gastos del negocio.
			</Dialog.Description>
		</Dialog.Header>

		<form
			id="expense-form-{formId}"
			method="POST"
			action="?/createExpense"
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							open = false;
						}

						await update({ invalidateAll: true });
					} finally {
						submitting = false;
					}
				};
			}}
		>
			<FieldGroup>
				{#if message}
					<p class="text-destructive text-sm">{message}</p>
				{/if}

				<Field data-invalid={errors.amount ? true : undefined}>
					<FieldLabel for="amount-{formId}">Monto (MXN)</FieldLabel>
					<FieldDescription>Monto entero en pesos mexicanos.</FieldDescription>
					<Input
						id="amount-{formId}"
						name="amount"
						type="number"
						min="1"
						step="1"
						bind:value={amount}
						required
					/>
					{#if errors.amount}
						<FieldError>{errors.amount}</FieldError>
					{/if}
				</Field>

				<Field data-invalid={errors.category ? true : undefined}>
					<FieldLabel for="category-{formId}">Categoría</FieldLabel>
					<select
						id="category-{formId}"
						name="category"
						bind:value={category}
						required
						class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
					>
						<option value="">Selecciona una categoría</option>
						{#each EXPENSE_CATEGORIES as value (value)}
							<option {value}>{EXPENSE_CATEGORY_LABELS[value]}</option>
						{/each}
					</select>
					{#if errors.category}
						<FieldError>{errors.category}</FieldError>
					{/if}
				</Field>

				<Field data-invalid={errors.description ? true : undefined}>
					<FieldLabel for="description-{formId}">Descripción</FieldLabel>
					<Textarea
						id="description-{formId}"
						name="description"
						bind:value={description}
						placeholder="Ej. Renta del local de junio"
						required
					/>
					{#if errors.description}
						<FieldError>{errors.description}</FieldError>
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

				<Field data-invalid={errors.paidAt ? true : undefined}>
					<FieldLabel for="paidAt-{formId}">Fecha del egreso</FieldLabel>
					<Input id="paidAt-{formId}" name="paidAt" type="date" bind:value={paidAt} required />
					{#if errors.paidAt}
						<FieldError>{errors.paidAt}</FieldError>
					{/if}
				</Field>
			</FieldGroup>
		</form>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="expense-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : 'Registrar egreso'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
