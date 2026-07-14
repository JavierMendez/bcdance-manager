<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatDaysUntilExpiry } from '$lib/dashboard.js';
	import {
		getPaymentStatusBadgeVariant,
		PAYMENT_STATUS_LABELS
	} from '$lib/payments.js';
	import { formatPhone } from '$lib/students.js';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const todayClasses = $derived(data.todayClasses);
	const expiringPayments = $derived(data.expiringPayments);
	const expiringPaymentsTotal = $derived(data.expiringPaymentsTotal);
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold tracking-tight">Inicio</h2>
		<p class="text-muted-foreground text-sm">Clases del día y accesos rápidos a tus tareas.</p>
	</div>

	<Card.Root>
		<Card.Header class="flex flex-row items-start justify-between gap-4 space-y-0">
			<div class="flex flex-col gap-1.5">
				<Card.Title>Pagos por vencer</Card.Title>
				<Card.Description>
					Alumnos activos con plan mensual que vence en los próximos 7 días
				</Card.Description>
			</div>
			{#if expiringPaymentsTotal > expiringPayments.length}
				<Button variant="ghost" size="sm" href="/dashboard/alumnos">Ver todos</Button>
			{/if}
		</Card.Header>
		<Card.Content>
			{#if expiringPayments.length === 0}
				<div class="text-muted-foreground flex min-h-32 items-center justify-center text-sm">
					No hay pagos próximos a vencer.
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each expiringPayments as student (student.id)}
						<div
							class="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex flex-col gap-1">
								<div class="flex flex-wrap items-center gap-2">
									<p class="font-medium">{student.fullName}</p>
									<Badge variant={getPaymentStatusBadgeVariant(student.paymentStatus)}>
										{PAYMENT_STATUS_LABELS[student.paymentStatus]}
									</Badge>
								</div>
								<p class="text-muted-foreground text-sm">
									{student.planName} · {formatDaysUntilExpiry(student.daysRemaining)}
								</p>
								{#if student.phone}
									<p class="text-muted-foreground text-sm">{formatPhone(student.phone)}</p>
								{/if}
							</div>
							<Button
								size="sm"
								href="/dashboard/pagos/registrar?studentId={student.id}"
							>
								Registrar pago
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Clases de hoy</Card.Title>
			<Card.Description>Clases activas programadas para el día de hoy</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if todayClasses.length === 0}
				<div class="text-muted-foreground flex min-h-32 items-center justify-center text-sm">
					No hay clases programadas para hoy.
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each todayClasses as classItem (classItem.id)}
						<div
							class="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<p class="font-medium">{classItem.name}</p>
								<p class="text-muted-foreground text-sm">
									{classItem.schedule} · {classItem.enrolledCount} alumno{classItem.enrolledCount === 1 ? '' : 's'}
								</p>
							</div>
							<Button size="sm" href="/dashboard/clases/asistencia?groupId={classItem.id}">
								Pasar lista
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

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
				<Button variant="outline" class="h-auto justify-start py-3" href="/dashboard/clases">
					<UsersIcon data-icon="inline-start" />
					<span class="flex flex-col items-start gap-0.5 text-left">
						<span>Ver clases</span>
						<span class="text-muted-foreground text-xs font-normal">
							Horarios, alumnos y asistencia
						</span>
					</span>
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>
