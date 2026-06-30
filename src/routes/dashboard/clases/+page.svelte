<script lang="ts">
	import ClassCreationWizard from '$lib/components/classes/class-creation-wizard.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatGroupCourseMeta,
		getPaymentStatusLabel,
		type ClassGroup
	} from '$lib/groups.js';
	import {
		getPaymentStatusBadgeVariant
	} from '$lib/payments.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatPhone } from '$lib/phone.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();

	let createOpen = $state(false);
	let optimisticGroups = $state<ClassGroup[] | null>(null);

	const groups = $derived(optimisticGroups ?? data.groups);
	const activeGroups = $derived(groups.filter((group) => group.active));
	const inactiveGroups = $derived(groups.filter((group) => !group.active));

	const createErrors = $derived(form?.mode === 'createClass' ? (form.errors ?? {}) : {});
	const createValues = $derived(form?.mode === 'createClass' ? (form.values ?? null) : null);

	function handleClassCreated(result: Record<string, unknown>) {
		const classGroup = result.classGroup as ClassGroup;
		const current = optimisticGroups ?? data.groups;
		optimisticGroups = [classGroup, ...current];
	}

	$effect(() => {
		if (form?.mode === 'createClass' && form.errors) {
			createOpen = true;
		}
	});

	$effect(() => {
		data.groups;
		optimisticGroups = null;
	});
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold tracking-tight">Clases</h2>
			<p class="text-muted-foreground text-sm">
				Consulta las clases activas, sus horarios y los alumnos con plan mensual o créditos por clase.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button onclick={() => (createOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				Nueva clase
			</Button>
			<Button variant="outline" href="/dashboard/clases/asistencia">
				<CalendarCheckIcon data-icon="inline-start" />
				Registrar asistencia
			</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Description>Clases activas</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{data.activeClassCount}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Total de clases</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{groups.length}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Inscripciones en clases</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{data.totalEnrollments}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	{#if groups.length === 0}
		<Card.Root>
			<Card.Content class="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-sm">
				<p>Aún no tienes clases. Crea la primera.</p>
				<Button onclick={() => (createOpen = true)}>
					<PlusIcon data-icon="inline-start" />
					Nueva clase
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		{#if activeGroups.length > 0}
			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-semibold">Clases activas</h3>
				{#each activeGroups as group (group.id)}
					<Card.Root>
						<Card.Header>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="flex flex-col gap-2">
									<div class="flex flex-wrap items-center gap-2">
										<Card.Title>
											<a href="/dashboard/clases/{group.id}" class="hover:underline">
												{group.name}
											</a>
										</Card.Title>
										<Badge>Vigente</Badge>
										<Badge variant="secondary">
											<UsersIcon />
											{group.enrolledCount} alumno{group.enrolledCount === 1 ? '' : 's'}
											{#if group.dropInCount > 0}
												· {group.dropInCount} por clase
											{/if}
										</Badge>
										{#if group.dropInPayments.length > 0}
											<Badge variant="outline">
												{group.dropInPayments.length} pago{group.dropInPayments.length === 1 ? '' : 's'} por clase
											</Badge>
										{/if}
									</div>
									<Card.Description>{group.description}</Card.Description>
								</div>
								<Button
									size="sm"
									variant="outline"
									href="/dashboard/clases/{group.id}"
								>
									Ver clase
								</Button>
								<Button
									size="sm"
									href="/dashboard/clases/asistencia?groupId={group.id}"
								>
									Registrar asistencia
								</Button>
							</div>
						</Card.Header>
						<Card.Content class="flex flex-col gap-4">
							<div class="grid gap-3 sm:grid-cols-2">
								<div class="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
									<ClockIcon />
									<span>{group.schedule}</span>
								</div>
								<div class="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
									<CalendarDaysIcon />
									<span>{formatGroupCourseMeta(group)}</span>
								</div>
							</div>

							{#if group.members.length === 0 && group.dropInPayments.length === 0}
								<div class="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
									No hay alumnos con inscripción mensual ni créditos por clase activos en esta clase.
								</div>
							{:else}
								{#if group.members.length > 0}
									<div class="rounded-xl border">
										<Table.Root>
											<Table.Header>
												<Table.Row>
													<Table.Head>Alumno</Table.Head>
													<Table.Head>Contacto</Table.Head>
													<Table.Head>Modalidad</Table.Head>
													<Table.Head>Plan</Table.Head>
													<Table.Head>Cobertura</Table.Head>
													<Table.Head>Estado pago</Table.Head>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{#each group.members as member (member.studentId)}
													<Table.Row>
														<Table.Cell>
															<div class="flex flex-col gap-0.5">
																<span class="font-medium">{member.fullName}</span>
																{#if !member.studentActive}
																	<span class="text-muted-foreground text-xs">Alumno inactivo</span>
																{/if}
															</div>
														</Table.Cell>
														<Table.Cell>
															<span class="text-sm">{formatPhone(member.phone)}</span>
														</Table.Cell>
														<Table.Cell>{member.modalityLabel}</Table.Cell>
														<Table.Cell>{member.planName}</Table.Cell>
														<Table.Cell>{member.coverageLabel}</Table.Cell>
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

								{#if group.dropInPayments.length > 0}
									<div class="flex flex-col gap-3">
										<div>
											<h4 class="text-sm font-semibold">Pagos por clase registrados</h4>
											<p class="text-muted-foreground text-sm">
												Incluye pagos sin alumno asignado y clases sueltas cobradas en esta clase.
											</p>
										</div>
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
													{#each group.dropInPayments as payment (payment.paymentId)}
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
									</div>
								{/if}
							{/if}
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}

		{#if inactiveGroups.length > 0}
			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-semibold">Clases finalizadas</h3>
				{#each inactiveGroups as group (group.id)}
					<Card.Root class="opacity-90">
						<Card.Header>
							<div class="flex flex-wrap items-center gap-2">
								<Card.Title>{group.name}</Card.Title>
								<Badge variant="secondary">Finalizado o próximo</Badge>
								<Badge variant="outline">
									<UsersIcon />
									{group.enrolledCount} alumno{group.enrolledCount === 1 ? '' : 's'}
								</Badge>
							</div>
							<Card.Description>{group.description}</Card.Description>
						</Card.Header>
						<Card.Content class="flex flex-col gap-4">
							<p class="text-muted-foreground text-sm">{formatGroupCourseMeta(group)}</p>

							{#if group.members.length > 0}
								<div class="rounded-xl border">
									<Table.Root>
										<Table.Header>
											<Table.Row>
												<Table.Head>Alumno</Table.Head>
												<Table.Head>Modalidad</Table.Head>
												<Table.Head>Plan</Table.Head>
												<Table.Head>Cobertura</Table.Head>
												<Table.Head>Estado pago</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#each group.members as member (member.studentId)}
												<Table.Row>
													<Table.Cell class="font-medium">{member.fullName}</Table.Cell>
													<Table.Cell>{member.modalityLabel}</Table.Cell>
													<Table.Cell>{member.planName}</Table.Cell>
													<Table.Cell>{member.coverageLabel}</Table.Cell>
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
				{/each}
			</div>
		{/if}
	{/if}
</div>

<ClassCreationWizard
	bind:open={createOpen}
	programs={data.programs}
	errors={createErrors}
	values={createValues}
	onSuccess={handleClassCreated}
/>
