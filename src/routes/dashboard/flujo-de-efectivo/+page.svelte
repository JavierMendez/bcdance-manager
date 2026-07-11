<script lang="ts">
	import ExpenseDialog from '$lib/components/cash-flow/expense-dialog.svelte';
	import AdditionalIncomeDialog from '$lib/components/cash-flow/additional-income-dialog.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		CASH_FLOW_PERIOD_PRESETS,
		formatCashFlowChartAxisLabel,
		formatCashFlowCurrency,
		type CashFlowPeriodPreset
	} from '$lib/cash-flow.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { BarChart } from 'layerchart';
	import type { PageData } from './$types.js';

	let {
		data,
		form
	}: {
		data: PageData;
		form: import('./$types.js').ActionData;
	} = $props();

	let selectedPreset = $state<CashFlowPeriodPreset>('this_month');
	let fromDate = $state('');
	let toDate = $state('');
	let expenseDialogOpen = $state(false);
	let additionalIncomeDialogOpen = $state(false);
	let showSavedNotice = $state(false);
	let showDeletedNotice = $state(false);
	let showIncomeSavedNotice = $state(false);
	let showIncomeDeletedNotice = $state(false);

	const expenseErrors = $derived(
		form?.mode === 'createExpense' ? (form.errors ?? {}) : {}
	);
	const expenseValues = $derived(form?.mode === 'createExpense' ? (form.values ?? null) : null);
	const additionalIncomeErrors = $derived(
		form?.mode === 'createAdditionalIncome' ? (form.errors ?? {}) : {}
	);
	const additionalIncomeValues = $derived(
		form?.mode === 'createAdditionalIncome' ? (form.values ?? null) : null
	);

	const summary = $derived(data.summary);
	const hasChartData = $derived(
		summary.chartDisplayPoints.some((point) => point.income > 0 || point.expenses > 0)
	);

	const chartRenderKey = $derived(
		`${data.period.from}-${data.period.to}-${summary.totalIncome}-${summary.totalExpenses}-${summary.chartDisplayPoints.length}`
	);

	const cashFlowChartConfig = {
		income: { label: 'Ingresos', color: 'var(--chart-1)' },
		expenses: { label: 'Egresos', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;

	$effect.pre(() => {
		selectedPreset = data.period.preset;
		fromDate = data.period.from;
		toDate = data.period.to;
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		if (params.get('saved') === '1') {
			showSavedNotice = true;
			params.delete('saved');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}

		if (params.get('deleted') === '1') {
			showDeletedNotice = true;
			params.delete('deleted');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}

		if (params.get('incomeSaved') === '1') {
			showIncomeSavedNotice = true;
			params.delete('incomeSaved');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}

		if (params.get('incomeDeleted') === '1') {
			showIncomeDeletedNotice = true;
			params.delete('incomeDeleted');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}
	});

	$effect(() => {
		if (form?.mode === 'createExpense' && form.errors) {
			expenseDialogOpen = true;
		}
	});

	$effect(() => {
		if (form?.mode === 'createAdditionalIncome' && form.errors) {
			additionalIncomeDialogOpen = true;
		}
	});

	function applyPeriod() {
		const params = new URLSearchParams();

		if (selectedPreset === 'custom') {
			if (!fromDate || !toDate) {
				return;
			}

			params.set('preset', 'custom');
			params.set('from', fromDate);
			params.set('to', toDate);
		} else {
			params.set('preset', selectedPreset);
		}

		goto(`/dashboard/flujo-de-efectivo?${params.toString()}`);
	}

	function formatAxisCurrency(value: number) {
		if (value >= 1_000_000) {
			return `${Math.round(value / 1_000_000)}M`;
		}

		if (value >= 1_000) {
			return `${Math.round(value / 1_000)}k`;
		}

		return String(value);
	}
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold tracking-tight">Flujo de efectivo</h2>
			<p class="text-muted-foreground text-sm">
				Compara ingresos (pagos e ingresos adicionales) y egresos del negocio en el periodo que
				elijas.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => (additionalIncomeDialogOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				Registrar ingreso adicional
			</Button>
			<Button onclick={() => (expenseDialogOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				Registrar egreso
			</Button>
		</div>
	</div>

	{#if showSavedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="py-4 text-sm">El egreso se registró correctamente.</Card.Content>
		</Card.Root>
	{/if}

	{#if showDeletedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="py-4 text-sm">El egreso se eliminó correctamente.</Card.Content>
		</Card.Root>
	{/if}

	{#if showIncomeSavedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="py-4 text-sm">El ingreso adicional se registró correctamente.</Card.Content>
		</Card.Root>
	{/if}

	{#if showIncomeDeletedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="py-4 text-sm">El ingreso adicional se eliminó correctamente.</Card.Content>
		</Card.Root>
	{/if}

	{#if form?.message}
		<Card.Root class="border-destructive/40">
			<Card.Content class="text-destructive py-4 text-sm">{form.message}</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<ArrowLeftRightIcon />
				Periodo
			</Card.Title>
			<Card.Description>
				{data.period.label} · independiente de las fechas de las clases
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
				<div class="flex flex-col gap-2">
					<label for="preset" class="text-sm font-medium">Vista rápida</label>
					<select
						id="preset"
						class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						bind:value={selectedPreset}
					>
						{#each CASH_FLOW_PERIOD_PRESETS as preset (preset.value)}
							<option value={preset.value}>{preset.label}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-2">
					<label for="fromDate" class="text-sm font-medium">Desde</label>
					<Input
						id="fromDate"
						type="date"
						bind:value={fromDate}
						disabled={selectedPreset !== 'custom'}
					/>
				</div>
				<div class="flex flex-col gap-2">
					<label for="toDate" class="text-sm font-medium">Hasta</label>
					<Input
						id="toDate"
						type="date"
						bind:value={toDate}
						disabled={selectedPreset !== 'custom'}
					/>
				</div>
				<Button type="button" onclick={applyPeriod}>Aplicar periodo</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<ArrowUpIcon class="text-emerald-600" />
					Ingresos
				</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums text-emerald-600">
					{formatCashFlowCurrency(summary.totalIncome)}
				</Card.Title>
			</Card.Header>
			<Card.Footer>
				<p class="text-muted-foreground text-sm">
					{summary.incomeCount} ingreso{summary.incomeCount === 1 ? '' : 's'} registrado{summary.incomeCount ===
					1
						? ''
						: 's'}
				</p>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<ArrowDownIcon class="text-destructive" />
					Egresos
				</Card.Description>
				<Card.Title class="text-destructive text-3xl font-bold tabular-nums">
					{formatCashFlowCurrency(summary.totalExpenses)}
				</Card.Title>
			</Card.Header>
			<Card.Footer>
				<p class="text-muted-foreground text-sm">
					{summary.expenseCount} egreso{summary.expenseCount === 1 ? '' : 's'} registrado{summary.expenseCount ===
					1
						? ''
						: 's'}
				</p>
			</Card.Footer>
		</Card.Root>

		<Card.Root class={summary.netCashFlow >= 0 ? 'border-emerald-500/30' : 'border-destructive/40'}>
			<Card.Header>
				<Card.Description class="flex items-center gap-2">
					<MinusIcon />
					Flujo neto
				</Card.Description>
				<Card.Title
					class={`text-3xl font-bold tabular-nums ${summary.netCashFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
				>
					{formatCashFlowCurrency(summary.netCashFlow)}
				</Card.Title>
			</Card.Header>
			<Card.Footer>
				<p class="text-muted-foreground text-sm">
					{summary.netCashFlow >= 0 ? 'Superávit en el periodo' : 'Déficit en el periodo'}
				</p>
			</Card.Footer>
		</Card.Root>
	</div>

	<div class="grid gap-4 xl:grid-cols-3">
		<Card.Root class="xl:col-span-2">
			<Card.Header>
				<Card.Title>Ingresos vs egresos</Card.Title>
				<Card.Description>Comparación visual del periodo seleccionado</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if !hasChartData}
					<div class="text-muted-foreground flex min-h-[260px] items-center justify-center text-sm">
						No hay movimientos en este periodo para graficar.
					</div>
				{:else}
					{#key chartRenderKey}
						<Chart.Container
							config={cashFlowChartConfig}
							class="aspect-auto h-[280px] min-h-[280px] w-full"
						>
							<BarChart
								data={summary.chartDisplayPoints}
								x="key"
								axis="x"
								height={280}
								bandPadding={0.28}
								groupPadding={0.12}
								seriesLayout="group"
								legend
								series={[
									{
										key: 'income',
										label: cashFlowChartConfig.income.label,
										color: 'var(--color-income)'
									},
									{
										key: 'expenses',
										label: cashFlowChartConfig.expenses.label,
										color: 'var(--color-expenses)'
									}
								]}
								props={{
									xAxis: {
										format: (value: string) => formatCashFlowChartAxisLabel(value)
									},
									yAxis: {
										format: formatAxisCurrency
									}
								}}
							>
								{#snippet tooltip()}
									<Chart.Tooltip labelKey="fullLabel">
										{#snippet formatter({ value, name })}
											<div class="flex w-full items-center justify-between gap-4">
												<span class="text-muted-foreground">{name}</span>
												<span class="font-mono font-medium tabular-nums">
													{formatPrice(Number(value))}
												</span>
											</div>
										{/snippet}
									</Chart.Tooltip>
								{/snippet}
							</BarChart>
						</Chart.Container>
					{/key}
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Egresos por categoría</Card.Title>
				<Card.Description>Distribución de salidas de dinero</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if summary.categoryBreakdown.length === 0}
					<div class="text-muted-foreground flex min-h-[260px] items-center justify-center text-sm">
						Sin egresos en este periodo.
					</div>
				{:else}
					{#each summary.categoryBreakdown as item (item.category)}
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium">{item.label}</span>
								<span class="tabular-nums">{formatCashFlowCurrency(item.amount)}</span>
							</div>
							<div class="bg-muted h-2 overflow-hidden rounded-full">
								<div
									class="bg-chart-2 h-full rounded-full"
									style={`width: ${item.percentage}%`}
								></div>
							</div>
							<p class="text-muted-foreground text-xs">{item.percentage}% del total de egresos</p>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Movimientos del periodo</Card.Title>
			<Card.Description>
				Lista cronológica de ingresos y egresos registrados
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if summary.movements.length === 0}
				<div class="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
					No hay movimientos en este periodo. Registra pagos, ingresos adicionales o egresos para ver el flujo de efectivo.
				</div>
			{:else}
				<div class="rounded-xl border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Fecha</Table.Head>
								<Table.Head>Tipo</Table.Head>
								<Table.Head>Concepto</Table.Head>
								<Table.Head>Detalle</Table.Head>
								<Table.Head>Método</Table.Head>
								<Table.Head class="text-right">Monto</Table.Head>
								<Table.Head class="w-12"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each summary.movements as movement (movement.id)}
								<Table.Row>
									<Table.Cell class="text-sm">{movement.paidAtLabel}</Table.Cell>
									<Table.Cell>
										<Badge variant={movement.type === 'income' ? 'default' : 'secondary'}>
											{movement.type === 'income' ? 'Ingreso' : 'Egreso'}
										</Badge>
									</Table.Cell>
									<Table.Cell class="font-medium">{movement.label}</Table.Cell>
									<Table.Cell>{movement.detail}</Table.Cell>
									<Table.Cell>{movement.paymentMethod}</Table.Cell>
									<Table.Cell
										class={`text-right font-medium tabular-nums ${movement.type === 'income' ? 'text-emerald-600' : 'text-destructive'}`}
									>
										{movement.type === 'income' ? '+' : '−'}{formatCashFlowCurrency(movement.amount)}
									</Table.Cell>
									<Table.Cell>
										{#if movement.sourceKind === 'expense'}
											<form
												method="POST"
												action="?/deleteExpense"
												use:enhance={() => {
													return async ({ update }) => {
														await update({ invalidateAll: true });
													};
												}}
											>
												<input type="hidden" name="expenseId" value={movement.sourceId} />
												<Button
													type="submit"
													variant="ghost"
													size="icon-sm"
													aria-label="Eliminar egreso"
												>
													<Trash2Icon />
												</Button>
											</form>
										{:else if movement.sourceKind === 'additional_income'}
											<form
												method="POST"
												action="?/deleteAdditionalIncome"
												use:enhance={() => {
													return async ({ update }) => {
														await update({ invalidateAll: true });
													};
												}}
											>
												<input
													type="hidden"
													name="additionalIncomeId"
													value={movement.sourceId}
												/>
												<Button
													type="submit"
													variant="ghost"
													size="icon-sm"
													aria-label="Eliminar ingreso adicional"
												>
													<Trash2Icon />
												</Button>
											</form>
										{/if}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<ExpenseDialog
		bind:open={expenseDialogOpen}
		paymentMethods={data.paymentMethods}
		errors={expenseErrors}
		values={expenseValues}
	/>

	<AdditionalIncomeDialog
		bind:open={additionalIncomeDialogOpen}
		paymentMethods={data.paymentMethods}
		errors={additionalIncomeErrors}
		values={additionalIncomeValues}
	/>
</div>
