<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatDashboardChartAxisLabel,
		formatDashboardCurrency,
		formatRecentPaymentDate,
		getPurchaseTypeLabel
	} from '$lib/dashboard.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatPhone } from '$lib/phone.js';
	import {
		getPaymentStatusBadgeVariant,
		PAYMENT_STATUS_LABELS
	} from '$lib/payments.js';
	import { BarChart, PieChart } from 'layerchart';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const dashboard = $derived(data.dashboard);

	const revenueChartConfig = {
		revenue: {
			label: 'Ingresos',
			color: 'var(--chart-1)'
		}
	} satisfies Chart.ChartConfig;

	const statusChartConfig = {
		vigente: {
			label: 'Vigente',
			color: 'var(--chart-1)'
		},
		por_vencer: {
			label: 'Por vencer',
			color: 'var(--chart-4)'
		},
		vencido: {
			label: 'Vencido',
			color: 'var(--chart-2)'
		}
	} satisfies Chart.ChartConfig;

	const paymentStatusPieData = $derived(
		dashboard.paymentStatusChart.filter((entry) => entry.count > 0)
	);

	const hasRevenueChartData = $derived(
		dashboard.monthlyRevenueChartDisplay.some((entry) => entry.revenue > 0)
	);

	const revenueChartRenderKey = $derived(
		dashboard.monthlyRevenueChartDisplay
			.map((entry) => `${entry.monthKey}:${entry.revenue}`)
			.join('|')
	);

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
			<h2 class="text-2xl font-bold tracking-tight">Inicio</h2>
			<p class="text-muted-foreground text-sm">
				Resumen del negocio, alertas de cobranza y accesos rápidos.
			</p>
		</div>
		<Button href="/dashboard/pagos/registrar">
			<PlusIcon data-icon="inline-start" />
			Registrar pago
		</Button>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Acciones rápidas</Card.Title>
			<Card.Description>Accesos directos a las tareas más frecuentes</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<Button variant="outline" class="h-auto justify-start py-3" href="/dashboard/pagos/registrar">
					<WalletIcon data-icon="inline-start" />
					<span class="flex flex-col items-start gap-0.5 text-left">
						<span>Registrar pago</span>
						<span class="text-muted-foreground text-xs font-normal">
							Renovar plan o vender full pass
						</span>
					</span>
				</Button>
				<Button variant="outline" class="h-auto justify-start py-3" href="/dashboard/alumnos">
					<UserPlusIcon data-icon="inline-start" />
					<span class="flex flex-col items-start gap-0.5 text-left">
						<span>Gestionar alumnos</span>
						<span class="text-muted-foreground text-xs font-normal">
							Altas, edición y estado de pago
						</span>
					</span>
				</Button>
				<Button
					variant="outline"
					class="h-auto justify-start py-3"
					href="/dashboard/configuraciones/planes-de-pago"
				>
					<CreditCardIcon data-icon="inline-start" />
					<span class="flex flex-col items-start gap-0.5 text-left">
						<span>Planes de pago</span>
						<span class="text-muted-foreground text-xs font-normal">
							Precios y tipos de cobertura
						</span>
					</span>
				</Button>
				<Button variant="outline" class="h-auto justify-start py-3" href="/dashboard/configuraciones/cursos">
					<UsersIcon data-icon="inline-start" />
					<span class="flex flex-col items-start gap-0.5 text-left">
						<span>Catálogo de cursos</span>
						<span class="text-muted-foreground text-xs font-normal">
							Horarios y disponibilidad
						</span>
					</span>
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<Card.Root>
			<Card.Header>
				<Card.Description>Alumnos activos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">
					{dashboard.activeStudents}
				</Card.Title>
			</Card.Header>
			<Card.Footer class="flex items-center justify-between">
				<p class="text-muted-foreground text-sm">
					{dashboard.totalStudents} registrados en total
				</p>
				<Button variant="ghost" size="sm" href="/dashboard/alumnos">
					Ver alumnos
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Ingresos del mes</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">
					{formatDashboardCurrency(dashboard.monthlyRevenue)}
				</Card.Title>
			</Card.Header>
			<Card.Footer class="flex items-center justify-between">
				<p class="text-muted-foreground text-sm">
					{dashboard.monthlyPaymentsCount} pagos registrados
				</p>
				<Button variant="ghost" size="sm" href="/dashboard/pagos">
					Ver pagos
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Description>Pagos por vencer</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">
					{dashboard.expiringSoonCount}
				</Card.Title>
			</Card.Header>
			<Card.Footer class="flex items-center justify-between">
				<p class="text-muted-foreground text-sm">Alumnos activos en los próximos 7 días</p>
				<Button variant="ghost" size="sm" href="/dashboard/alumnos">
					Revisar
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root class={dashboard.expiredCount > 0 ? 'border-destructive/40' : undefined}>
			<Card.Header>
				<Card.Description>Pagos vencidos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">
					{dashboard.expiredCount}
				</Card.Title>
			</Card.Header>
			<Card.Footer class="flex items-center justify-between">
				<p class="text-muted-foreground text-sm">Requieren renovación o cobro</p>
				<Button variant="ghost" size="sm" href="/dashboard/pagos/registrar">
					Cobrar
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>

	<div class="grid gap-4 xl:grid-cols-3">
		<Card.Root class="xl:col-span-2">
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<TrendingUpIcon />
					Ingresos mensuales
				</Card.Title>
				<Card.Description>Últimos 6 meses de pagos registrados</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if !hasRevenueChartData}
					<div class="text-muted-foreground flex min-h-[260px] items-center justify-center text-sm">
						Aún no hay ingresos registrados para mostrar la tendencia.
					</div>
				{:else}
					{#key revenueChartRenderKey}
						<Chart.Container
							config={revenueChartConfig}
							class="aspect-auto h-[280px] min-h-[280px] w-full"
						>
							<BarChart
								data={dashboard.monthlyRevenueChartDisplay}
								x="monthKey"
								axis="x"
								height={280}
								bandPadding={0.28}
								legend
								series={[
									{
										key: 'revenue',
										label: revenueChartConfig.revenue.label,
										color: 'var(--color-revenue)'
									}
								]}
								props={{
									xAxis: {
										format: (value: string) => formatDashboardChartAxisLabel(value)
									},
									yAxis: {
										format: formatAxisCurrency
									}
								}}
							>
								{#snippet tooltip()}
									<Chart.Tooltip labelKey="monthFullLabel">
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
				<Card.Title class="flex items-center gap-2">
					<UsersIcon />
					Estado de pagos
				</Card.Title>
				<Card.Description>Distribución entre alumnos activos</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if dashboard.activeStudents === 0}
					<div class="text-muted-foreground flex min-h-[220px] items-center justify-center text-sm">
						No hay alumnos activos registrados.
					</div>
				{:else if paymentStatusPieData.length === 0}
					<div class="text-muted-foreground flex min-h-[220px] items-center justify-center text-sm">
						Sin datos de cobertura para mostrar.
					</div>
				{:else}
					<Chart.Container config={statusChartConfig} class="aspect-auto h-[220px] min-h-[220px] w-full">
						<PieChart
							data={paymentStatusPieData}
							key="status"
							label="label"
							value="count"
							c="fill"
							innerRadius={0.58}
							height={220}
						>
							{#snippet tooltip()}
								<Chart.Tooltip nameKey="status">
									{#snippet formatter({ value, name })}
										<div class="flex w-full items-center justify-between gap-4">
											<span class="text-muted-foreground">{name}</span>
											<span class="font-mono font-medium tabular-nums">
												{value} alumno{Number(value) === 1 ? '' : 's'}
											</span>
										</div>
									{/snippet}
								</Chart.Tooltip>
							{/snippet}
						</PieChart>
					</Chart.Container>
				{/if}

				<div class="flex flex-col gap-2">
					{#each dashboard.paymentStatusChart as item (item.status)}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-2">
								<span
									class="size-2.5 rounded-[2px]"
									style="background-color: {item.fill}"
								></span>
								<span>{item.label}</span>
							</div>
							<span class="font-medium tabular-nums">{item.count}</span>
						</div>
					{/each}
				</div>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" size="sm" class="w-full" href="/dashboard/alumnos">
					Gestionar alumnos
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>

	<div class="grid gap-4 xl:grid-cols-2">
		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between gap-4">
				<div class="flex flex-col gap-1.5">
					<Card.Title class="flex items-center gap-2">
						<AlertTriangleIcon />
						Requieren atención
					</Card.Title>
					<Card.Description>
						Alumnos activos con pago por vencer o vencido
					</Card.Description>
				</div>
				<Button variant="outline" size="sm" href="/dashboard/pagos/registrar">
					Registrar pago
				</Button>
			</Card.Header>
			<Card.Content>
				{#if dashboard.studentsNeedingAttention.length === 0}
					<div class="text-muted-foreground flex min-h-[180px] items-center justify-center text-sm">
						Todos los alumnos activos tienen su pago al día.
					</div>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Alumno</Table.Head>
								<Table.Head>Estado</Table.Head>
								<Table.Head class="text-end">Acción</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each dashboard.studentsNeedingAttention as student (student.id)}
								<Table.Row>
									<Table.Cell>
										<div class="flex flex-col gap-0.5">
											<span class="font-medium">{student.fullName}</span>
											<span class="text-muted-foreground text-xs">{formatPhone(student.phone)}</span>
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant={getPaymentStatusBadgeVariant(student.paymentStatus)}>
											{PAYMENT_STATUS_LABELS[student.paymentStatus]}
										</Badge>
									</Table.Cell>
									<Table.Cell class="text-end">
										<Button variant="ghost" size="sm" href="/dashboard/pagos/registrar">
											Cobrar
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Content>
			{#if dashboard.studentsNeedingAttention.length > 0}
				<Card.Footer>
					<Button variant="ghost" size="sm" href="/dashboard/alumnos">
						Ver todos los alumnos
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				</Card.Footer>
			{/if}
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between gap-4">
				<div class="flex flex-col gap-1.5">
					<Card.Title class="flex items-center gap-2">
						<WalletIcon />
						Últimos pagos
					</Card.Title>
					<Card.Description>Actividad reciente de cobros</Card.Description>
				</div>
				<Button variant="outline" size="sm" href="/dashboard/pagos">
					Ver historial
				</Button>
			</Card.Header>
			<Card.Content>
				{#if dashboard.recentPayments.length === 0}
					<div class="text-muted-foreground flex min-h-[180px] flex-col items-center justify-center gap-3 text-sm">
						<p>Aún no hay pagos registrados.</p>
						<Button href="/dashboard/pagos/registrar">
							<PlusIcon data-icon="inline-start" />
							Registrar primer pago
						</Button>
					</div>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Alumno</Table.Head>
								<Table.Head>Fecha</Table.Head>
								<Table.Head class="text-end">Monto</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each dashboard.recentPayments as payment (payment.id)}
								<Table.Row>
									<Table.Cell>
										<div class="flex flex-col gap-0.5">
											<span class="font-medium">{payment.studentName}</span>
											<span class="text-muted-foreground text-xs">
												{getPurchaseTypeLabel(payment.purchaseType)}
											</span>
										</div>
									</Table.Cell>
									<Table.Cell>{formatRecentPaymentDate(payment.paidAt)}</Table.Cell>
									<Table.Cell class="text-end font-medium tabular-nums">
										{formatPrice(payment.totalAmount)}
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
