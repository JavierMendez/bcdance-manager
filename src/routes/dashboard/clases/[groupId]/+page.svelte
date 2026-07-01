<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatClassMeta, getPaymentStatusLabel } from '$lib/groups.js';
	import { getPaymentStatusBadgeVariant } from '$lib/payments.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatPhone } from '$lib/phone.js';
	import { formatCourseDays } from '$lib/courses.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const classGroup = $derived(data.classGroup);
	let activeTab = $state<'resumen' | 'alumnos' | 'asistencia' | 'pagos'>('resumen');
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-2">
			<Button variant="ghost" class="w-fit px-0" href="/dashboard/clases">
				<ArrowLeftIcon data-icon="inline-start" />
				Volver a clases
			</Button>
			<div>
				<h2 class="text-2xl font-bold tracking-tight">{classGroup.name}</h2>
				<p class="text-muted-foreground text-sm">{classGroup.description}</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/dashboard/clases/{classGroup.id}/inscribir">
				<UserPlusIcon data-icon="inline-start" />
				Inscribir alumno
			</Button>
			<Button variant="outline" href="/dashboard/clases/asistencia?groupId={classGroup.id}">
				<CalendarCheckIcon data-icon="inline-start" />
				Registrar asistencia
			</Button>
		</div>
	</div>

	<div class="flex flex-wrap gap-2 border-b pb-2">
		<Button
			variant={activeTab === 'resumen' ? 'default' : 'ghost'}
			size="sm"
			onclick={() => (activeTab = 'resumen')}
		>
			Resumen
		</Button>
		<Button
			variant={activeTab === 'alumnos' ? 'default' : 'ghost'}
			size="sm"
			onclick={() => (activeTab = 'alumnos')}
		>
			Alumnos
		</Button>
		<Button
			variant={activeTab === 'asistencia' ? 'default' : 'ghost'}
			size="sm"
			onclick={() => (activeTab = 'asistencia')}
		>
			Asistencia
		</Button>
		<Button
			variant={activeTab === 'pagos' ? 'default' : 'ghost'}
			size="sm"
			onclick={() => (activeTab = 'pagos')}
		>
			Pagos
		</Button>
	</div>

	{#if activeTab === 'resumen'}
		<div class="grid gap-4 sm:grid-cols-3">
			<Card.Root>
				<Card.Header>
					<Card.Description>Estado</Card.Description>
					<Card.Title class="text-lg">
						{classGroup.active ? 'Vigente' : 'Finalizada o próxima'}
					</Card.Title>
				</Card.Header>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Description>Alumnos inscritos</Card.Description>
					<Card.Title class="text-3xl font-bold tabular-nums">{classGroup.enrolledCount}</Card.Title>
				</Card.Header>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Description>Programa</Card.Description>
					<Card.Title class="text-lg">{classGroup.name}</Card.Title>
				</Card.Header>
			</Card.Root>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Horario y vigencia</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<div class="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
					<ClockIcon />
					<span>{classGroup.schedule}</span>
				</div>
				<p class="text-muted-foreground text-sm">
					{formatCourseDays(classGroup.days)} · {formatClassMeta(classGroup)}
				</p>
			</Card.Content>
		</Card.Root>
	{:else if activeTab === 'alumnos'}
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between">
				<Card.Title>Alumnos inscritos</Card.Title>
				<Button size="sm" href="/dashboard/clases/{classGroup.id}/inscribir">
					<UserPlusIcon data-icon="inline-start" />
					Inscribir
				</Button>
			</Card.Header>
			<Card.Content>
				{#if classGroup.members.length === 0}
					<p class="text-muted-foreground text-sm">No hay alumnos inscritos en esta clase.</p>
				{:else}
					<div class="rounded-xl border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Alumno</Table.Head>
									<Table.Head>Contacto</Table.Head>
									<Table.Head>Modalidad</Table.Head>
									<Table.Head>Plan</Table.Head>
									<Table.Head>Estado pago</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each classGroup.members as member (member.studentId)}
									<Table.Row>
										<Table.Cell class="font-medium">{member.fullName}</Table.Cell>
										<Table.Cell>{formatPhone(member.phone)}</Table.Cell>
										<Table.Cell>{member.modalityLabel}</Table.Cell>
										<Table.Cell>{member.planName}</Table.Cell>
										<Table.Cell>
											<Badge variant={getPaymentStatusBadgeVariant(member.paymentStatus)}>
												{getPaymentStatusLabel(member.paymentStatus)}
											</Badge>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if activeTab === 'asistencia'}
		<Card.Root>
			<Card.Header>
				<Card.Title>Asistencia</Card.Title>
				<Card.Description>Registra la asistencia del día para esta clase.</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/dashboard/clases/asistencia?groupId={classGroup.id}">
					<CalendarCheckIcon data-icon="inline-start" />
					Registrar asistencia de hoy
				</Button>
			</Card.Footer>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>Pagos por clase</Card.Title>
				<Card.Description>Pagos sueltos registrados en esta clase.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if classGroup.dropInPayments.length === 0}
					<p class="text-muted-foreground text-sm">No hay pagos por clase registrados.</p>
				{:else}
					<div class="rounded-xl border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Alumno</Table.Head>
									<Table.Head>Plan</Table.Head>
									<Table.Head>Monto</Table.Head>
									<Table.Head>Método</Table.Head>
									<Table.Head>Fecha</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each classGroup.dropInPayments as payment (payment.paymentId)}
									<Table.Row>
										<Table.Cell class="font-medium">{payment.studentName}</Table.Cell>
										<Table.Cell>{payment.planName}</Table.Cell>
										<Table.Cell>{formatPrice(payment.totalAmount)}</Table.Cell>
										<Table.Cell>{payment.paymentMethod}</Table.Cell>
										<Table.Cell>{payment.paidAtLabel}</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				{/if}
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" href="/dashboard/pagos/registrar?groupId={classGroup.id}">
					<WalletIcon data-icon="inline-start" />
					Registrar pago
				</Button>
			</Card.Footer>
		</Card.Root>
	{/if}
</div>
