<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatGroupCourseMeta,
		getPaymentStatusLabel
	} from '$lib/groups.js';
	import {
		getPaymentStatusBadgeVariant
	} from '$lib/payments.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatPhone } from '$lib/phone.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const activeGroups = $derived(data.groups.filter((group) => group.active));
	const inactiveGroups = $derived(data.groups.filter((group) => !group.active));
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold tracking-tight">Grupos</h2>
			<p class="text-muted-foreground text-sm">
				Consulta los cursos activos, sus horarios y los alumnos con plan mensual o créditos por clase.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button href="/dashboard/grupos/asistencia">
				<CalendarCheckIcon data-icon="inline-start" />
				Registrar asistencia
			</Button>
			<Button variant="outline" href="/dashboard/configuraciones/cursos">
				<BookOpenIcon data-icon="inline-start" />
				Gestionar cursos
			</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Description>Cursos activos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{data.activeCourseCount}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Total de cursos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{data.groups.length}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Inscripciones en grupos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{data.totalEnrollments}</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	{#if data.groups.length === 0}
		<Card.Root>
			<Card.Content class="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-sm">
				<p>No hay cursos registrados para mostrar grupos.</p>
				<Button href="/dashboard/configuraciones/cursos">
					<BookOpenIcon data-icon="inline-start" />
					Crear primer curso
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		{#if activeGroups.length > 0}
			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-semibold">Cursos activos</h3>
				{#each activeGroups as group (group.id)}
					<Card.Root>
						<Card.Header>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="flex flex-col gap-2">
									<div class="flex flex-wrap items-center gap-2">
										<Card.Title>{group.name}</Card.Title>
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
									href="/dashboard/grupos/asistencia?courseId={group.id}"
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
									No hay alumnos con inscripción mensual ni créditos por clase activos en este grupo.
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
												Incluye pagos sin alumno asignado y clases sueltas cobradas en este curso.
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
				<h3 class="text-lg font-semibold">Cursos inactivos</h3>
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
