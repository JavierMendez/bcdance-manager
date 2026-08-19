<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import {
		buildPaymentListSearchParams,
		formatDiscountPercent,
		formatPaymentDate,
		PAYMENT_METHODS,
		paymentListHasActiveFilters,
		PURCHASE_TYPE_LABELS,
		PURCHASE_TYPES,
		type PaymentListFilters,
		type PaymentMethod,
		type PurchaseType
	} from '$lib/payments.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let purchaseType = $state<PurchaseType | ''>('');
	let paymentMethod = $state<PaymentMethod | ''>('');
	let fromDate = $state('');
	let toDate = $state('');

	const hasActiveFilters = $derived(paymentListHasActiveFilters(data.filters));
	const rangeStart = $derived(
		data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1
	);
	const rangeEnd = $derived(
		Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)
	);

	$effect.pre(() => {
		searchQuery = data.filters.q;
		purchaseType = data.filters.type;
		paymentMethod = data.filters.method;
		fromDate = data.filters.from;
		toDate = data.filters.to;
	});

	$effect(() => {
		const query = searchQuery;

		if (query.trim() === data.filters.q) {
			return;
		}

		const timeout = setTimeout(() => {
			navigate({ q: query.trim(), page: 1 });
		}, 300);

		return () => clearTimeout(timeout);
	});

	function currentFilters(): PaymentListFilters {
		return {
			q: searchQuery.trim(),
			type: purchaseType,
			method: paymentMethod,
			from: fromDate,
			to: toDate
		};
	}

	function navigate(patch: Partial<PaymentListFilters> & { page?: number }) {
		const filters = { ...currentFilters(), ...patch };
		const page = patch.page ?? 1;
		const params = buildPaymentListSearchParams(filters, page);
		const href = params.size > 0 ? `/dashboard/pagos?${params.toString()}` : '/dashboard/pagos';

		goto(href, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function clearFilters() {
		searchQuery = '';
		purchaseType = '';
		paymentMethod = '';
		fromDate = '';
		toDate = '';
		goto('/dashboard/pagos', { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Pagos</h2>
			<p class="text-muted-foreground text-sm">
				Historial de pagos registrados y acceso al asistente de registro.
			</p>
		</div>
		<Button href="/dashboard/pagos/registrar">
			<PlusIcon data-icon="inline-start" />
			Registrar pago
		</Button>
	</div>

	<Field.FieldGroup>
		<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
			<Field.Field class="min-w-56 flex-1">
				<Field.FieldLabel for="payment-search">Buscar</Field.FieldLabel>
				<Input
					id="payment-search"
					placeholder="Buscar por nombre de alumno..."
					bind:value={searchQuery}
					aria-label="Buscar por nombre de alumno"
				/>
			</Field.Field>
			<Field.Field class="w-full sm:w-56">
				<Field.FieldLabel for="payment-type-filter">Tipo</Field.FieldLabel>
				<select
					id="payment-type-filter"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
					bind:value={purchaseType}
					onchange={() => navigate({ type: purchaseType, page: 1 })}
				>
					<option value="">Todos</option>
					{#each PURCHASE_TYPES as type (type)}
						<option value={type}>{PURCHASE_TYPE_LABELS[type]}</option>
					{/each}
				</select>
			</Field.Field>
			<Field.Field class="w-full sm:w-44">
				<Field.FieldLabel for="payment-method-filter">Método</Field.FieldLabel>
				<select
					id="payment-method-filter"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
					bind:value={paymentMethod}
					onchange={() => navigate({ method: paymentMethod, page: 1 })}
				>
					<option value="">Todos</option>
					{#each PAYMENT_METHODS as method (method)}
						<option value={method}>{method}</option>
					{/each}
				</select>
			</Field.Field>
			<Field.Field class="w-full sm:w-40">
				<Field.FieldLabel for="payment-from">Desde</Field.FieldLabel>
				<Input
					id="payment-from"
					type="date"
					bind:value={fromDate}
					oninput={(event) => navigate({ from: event.currentTarget.value, page: 1 })}
				/>
			</Field.Field>
			<Field.Field class="w-full sm:w-40">
				<Field.FieldLabel for="payment-to">Hasta</Field.FieldLabel>
				<Input
					id="payment-to"
					type="date"
					bind:value={toDate}
					oninput={(event) => navigate({ to: event.currentTarget.value, page: 1 })}
				/>
			</Field.Field>
			{#if hasActiveFilters}
				<Button variant="outline" onclick={clearFilters}>Limpiar</Button>
			{/if}
		</div>
	</Field.FieldGroup>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Fecha</Table.Head>
					<Table.Head>Alumno</Table.Head>
					<Table.Head>Tipo</Table.Head>
					<Table.Head>Método</Table.Head>
					<Table.Head class="text-end">Monto</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.payments.length === 0}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground h-24 text-center">
							{hasActiveFilters ? 'No se encontraron pagos.' : 'No hay pagos registrados.'}
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.payments as payment (payment.id)}
						<Table.Row>
							<Table.Cell>{formatPaymentDate(payment.paidAt)}</Table.Cell>
							<Table.Cell class="font-medium">{payment.studentName}</Table.Cell>
							<Table.Cell>
								{PURCHASE_TYPE_LABELS[payment.purchaseType as PurchaseType]}
							</Table.Cell>
							<Table.Cell>{payment.paymentMethod}</Table.Cell>
							<Table.Cell class="text-end">
								<div class="flex flex-col items-end gap-0.5">
									<span class="font-medium">{formatPrice(payment.totalAmount)}</span>
									{#if payment.discountPercent > 0}
										<span class="text-muted-foreground text-xs">
											-{formatDiscountPercent(payment.discountPercent)} ({formatPrice(
												payment.subtotalAmount
											)})
										</span>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	{#if data.pagination.total > 0}
		<div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
			<p class="text-muted-foreground text-sm">
				Mostrando {rangeStart}–{rangeEnd} de {data.pagination.total}
			</p>
			{#if data.pagination.totalPages > 1}
				<Pagination.Root
					count={data.pagination.total}
					perPage={data.pagination.pageSize}
					page={data.pagination.page}
					onPageChange={(nextPage) => navigate({ page: nextPage })}
				>
					{#snippet children({ pages, currentPage })}
						<Pagination.Content>
							<Pagination.Item>
								<Pagination.Previous />
							</Pagination.Item>
							{#each pages as pageItem (pageItem.key)}
								{#if pageItem.type === 'ellipsis'}
									<Pagination.Item>
										<Pagination.Ellipsis />
									</Pagination.Item>
								{:else}
									<Pagination.Item>
										<Pagination.Link page={pageItem} isActive={currentPage === pageItem.value}>
											{pageItem.value}
										</Pagination.Link>
									</Pagination.Item>
								{/if}
							{/each}
							<Pagination.Item>
								<Pagination.Next />
							</Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			{/if}
		</div>
	{/if}
</div>
