<script lang="ts">
	import PaymentPlanDialog from '$lib/components/payment-plans/payment-plan-dialog.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatClassesIncluded,
		formatHoursIncluded,
		formatPlanType,
		formatPrice,
		type SerializedPaymentPlan
	} from '$lib/payment-plans.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();

	let paymentPlans = $derived(data.paymentPlans);
	let createOpen = $state(false);
	let editOpen = $state(false);
	let editingPlan = $state<SerializedPaymentPlan | null>(null);
	let optimisticPaymentPlans = $state<SerializedPaymentPlan[] | null>(null);

	const displayedPaymentPlans = $derived(optimisticPaymentPlans ?? paymentPlans);

	const createErrors = $derived(form?.mode === 'create' ? (form.errors ?? {}) : {});
	const editErrors = $derived(form?.mode === 'edit' ? (form.errors ?? {}) : {});
	const createValues = $derived(form?.mode === 'create' ? (form.values ?? null) : null);
	const editValues = $derived(form?.mode === 'edit' ? (form.values ?? null) : null);

	function handlePaymentPlanSaved(data: Record<string, unknown>) {
		const paymentPlan = data.paymentPlan as SerializedPaymentPlan;
		const current = optimisticPaymentPlans ?? paymentPlans;
		const index = current.findIndex((plan) => plan.id === paymentPlan.id);

		if (index === -1) {
			optimisticPaymentPlans = [paymentPlan, ...current];
		} else {
			optimisticPaymentPlans = current.map((plan) =>
				plan.id === paymentPlan.id ? paymentPlan : plan
			);
		}
	}

	function openEdit(plan: SerializedPaymentPlan) {
		editingPlan = plan;
		editOpen = true;
	}

	$effect(() => {
		if (form?.mode === 'create' && form.errors) {
			createOpen = true;
		}

		if (form?.mode === 'edit' && form.errors && form.id) {
			editOpen = true;
			if (!editingPlan || editingPlan.id !== form.id) {
				const current = optimisticPaymentPlans ?? paymentPlans;
				editingPlan = current.find((plan) => plan.id === form.id) ?? editingPlan;
			}
		}
	});

	$effect(() => {
		data.paymentPlans;
		optimisticPaymentPlans = null;
	});
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Planes de pago</h2>
			<p class="text-muted-foreground text-sm">
				Catálogo de planes disponibles para asignar a los alumnos.
			</p>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<PlusIcon data-icon="inline-start" />
			Nuevo plan
		</Button>
	</div>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Tipo</Table.Head>
					<Table.Head>Nombre</Table.Head>
					<Table.Head>Descripción</Table.Head>
					<Table.Head>Precio</Table.Head>
					<Table.Head>Periodicidad</Table.Head>
					<Table.Head>Incluye</Table.Head>
					<Table.Head class="text-end">Acciones</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if displayedPaymentPlans.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="text-muted-foreground h-24 text-center">
							No hay planes de pago registrados.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each displayedPaymentPlans as plan (plan.id)}
						<Table.Row>
							<Table.Cell>{formatPlanType(plan.planType)}</Table.Cell>
							<Table.Cell class="font-medium">{plan.name}</Table.Cell>
							<Table.Cell class="max-w-xs truncate">{plan.description}</Table.Cell>
							<Table.Cell>{formatPrice(plan.price)}</Table.Cell>
							<Table.Cell>{plan.billingPeriod}</Table.Cell>
							<Table.Cell>
								{plan.planType === 'monthly' || plan.planType === 'drop_in'
									? formatClassesIncluded(plan.classesIncluded)
									: formatHoursIncluded(plan.hoursIncluded)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex justify-end">
									<Button variant="outline" size="sm" onclick={() => openEdit(plan)}>
										<PencilIcon data-icon="inline-start" />
										Editar
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<PaymentPlanDialog
	bind:open={createOpen}
	mode="create"
	errors={createErrors}
	values={createValues}
	onSuccess={handlePaymentPlanSaved}
/>

<PaymentPlanDialog
	bind:open={editOpen}
	mode="edit"
	paymentPlan={editingPlan}
	errors={editErrors}
	values={editValues}
	onClosed={() => (editingPlan = null)}
	onSuccess={handlePaymentPlanSaved}
/>
