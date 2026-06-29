<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import {
		formatPaymentDate,
		PURCHASE_TYPE_LABELS,
		type PurchaseType
	} from '$lib/payments.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
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
							No hay pagos registrados.
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
							<Table.Cell class="text-end font-medium">
								{formatPrice(payment.totalAmount)}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
