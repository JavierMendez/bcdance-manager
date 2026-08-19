<script lang="ts">
	import DropInQuickRegisterDialog from '$lib/components/attendance/drop-in-quick-register-dialog.svelte';
	import FullPassStudentPicker from '$lib/components/attendance/full-pass-student-picker.svelte';
	import AttendanceStatusToggle from '$lib/components/attendance/attendance-status-toggle.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		ATTENDANCE_STATUS_LABELS,
		FULL_PASS_HOURS_PER_CLASS,
		formatSessionDate,
		getAttendanceStatusBadgeVariant,
		getTodaySessionDate,
		toFullPassAttendanceMember,
		type AttendanceMember,
		type AttendanceStatus,
		type EligibleFullPassStudent
	} from '$lib/attendance.js';
	import { formatCourseDays } from '$lib/courses.js';
	import { formatPrice } from '$lib/payment-plans.js';
	import { formatDiscountPercent } from '$lib/payments.js';
	import { enhance } from '$app/forms';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LockIcon from '@lucide/svelte/icons/lock';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import XIcon from '@lucide/svelte/icons/x';
	import type { PageData } from './$types.js';

	let {
		data,
		form
	}: {
		data: PageData;
		form: import('./$types.js').ActionData;
	} = $props();

	let selectedCourseId = $state('');
	let sessionDate = $state(getTodaySessionDate());
	let statuses = $state<Record<number, AttendanceStatus | ''>>({});
	let submitting = $state(false);
	let showSavedNotice = $state(false);
	let showDropInNotice = $state(false);
	let showDropInAttendedNotice = $state(false);
	let dropInDialogOpen = $state(false);
	let addedFullPassMembers = $state<AttendanceMember[]>([]);
	let clientAddedStudentIds = $state<Set<number>>(new Set());

	const dropInErrors = $derived(
		form?.mode === 'registerDropIn' ? (form.errors ?? {}) : {}
	);
	const dropInValues = $derived(
		form?.mode === 'registerDropIn' ? (form.values ?? null) : null
	);
	const dropInMessage = $derived(
		form?.mode === 'registerDropIn' ? (form.message ?? null) : null
	);

	$effect.pre(() => {
		selectedCourseId = data.course ? String(data.course.id) : '';
		sessionDate = data.sessionDate;
		showSavedNotice = false;
		showDropInNotice = false;
		showDropInAttendedNotice = false;
		addedFullPassMembers = [];
		clientAddedStudentIds = new Set();

		const nextStatuses: Record<number, AttendanceStatus | ''> = {};
		for (const member of data.members) {
			nextStatuses[member.studentId] = member.currentStatus ?? '';
		}
		statuses = nextStatuses;
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		if (params.get('saved') === '1') {
			showSavedNotice = true;
			showDropInNotice = params.get('dropIn') === '1';
			showDropInAttendedNotice = params.get('attended') === '1';
			params.delete('saved');
			params.delete('dropIn');
			params.delete('attended');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}
	});

	$effect(() => {
		if (form?.mode === 'registerDropIn' && (form.errors || form.message)) {
			dropInDialogOpen = true;
		}
	});

	const displayMembers = $derived.by(() => {
		const memberIds = new Set(data.members.map((member) => member.studentId));
		const extraMembers = addedFullPassMembers.filter((member) => !memberIds.has(member.studentId));

		return [...data.members, ...extraMembers].sort((a, b) =>
			a.fullName.localeCompare(b.fullName, 'es')
		);
	});

	const excludedFullPassStudentIds = $derived(
		new Set(displayMembers.map((member) => member.studentId))
	);

	const entriesPayload = $derived(
		JSON.stringify(
			displayMembers
				.filter((member) => member.canRegisterAttendance && statuses[member.studentId])
				.map((member) => ({
					studentId: member.studentId,
					entitlementId: member.entitlementId,
					status: statuses[member.studentId]
				}))
		)
	);

	const membersRequiringMark = $derived(
		displayMembers.filter((member) => member.canRegisterAttendance)
	);

	const allMarked = $derived(
		membersRequiringMark.length > 0 &&
			membersRequiringMark.every((member) => statuses[member.studentId] !== '')
	);

	const dropInMembers = $derived(
		displayMembers.filter((member) => member.entitlementType === 'drop_in')
	);
	const enrolledMembers = $derived(
		displayMembers.filter((member) => member.entitlementType !== 'drop_in')
	);
	const attendanceEditable = $derived(data.attendanceEditable);

	function addFullPassStudent(student: EligibleFullPassStudent) {
		const member = toFullPassAttendanceMember(student);
		addedFullPassMembers = [...addedFullPassMembers, member];
		clientAddedStudentIds = new Set([...clientAddedStudentIds, student.studentId]);
		statuses = {
			...statuses,
			[student.studentId]: ''
		};
	}

	function removeAddedFullPassStudent(studentId: number) {
		addedFullPassMembers = addedFullPassMembers.filter((member) => member.studentId !== studentId);
		const nextClientAdded = new Set(clientAddedStudentIds);
		nextClientAdded.delete(studentId);
		clientAddedStudentIds = nextClientAdded;

		const nextStatuses = { ...statuses };
		delete nextStatuses[studentId];
		statuses = nextStatuses;
	}

	function isClientAddedFullPass(studentId: number) {
		return clientAddedStudentIds.has(studentId);
	}

	function canEditMemberAttendance(member: AttendanceMember) {
		return attendanceEditable && member.canRegisterAttendance;
	}

	function applyFilters() {
		if (!selectedCourseId) {
			return;
		}

		const params = new URLSearchParams({
			groupId: selectedCourseId,
			date: sessionDate
		});

		window.location.href = `/dashboard/clases/asistencia?${params.toString()}`;
	}
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold tracking-tight">Registrar asistencia</h2>
			<p class="text-muted-foreground text-sm">
				Marca asistencia o falta por alumno. La lista inicial muestra inscripciones mensuales
				vigentes. Agrega alumnos full pass bajo demanda. El full pass descuenta
				{FULL_PASS_HOURS_PER_CLASS} h por clase asistida. Usa el registro rápido para alumnos que
				pagan por clase sin inscripción.
			</p>
		</div>
		<Button variant="outline" href="/dashboard/clases">
			<ArrowLeftIcon data-icon="inline-start" />
			Volver a clases
		</Button>
	</div>

	{#if showSavedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="flex items-center gap-2 py-4 text-sm">
				<CheckIcon />
				<span>
					{#if showDropInNotice && showDropInAttendedNotice}
						El pago por clase y la asistencia se registraron correctamente.
					{:else if showDropInNotice}
						El pago por clase se registró correctamente.
					{:else}
						La asistencia se guardó correctamente.
					{/if}
				</span>
			</Card.Content>
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
				<CalendarCheckIcon />
				Selección de clase
			</Card.Title>
			<Card.Description>Elige la clase y la fecha de la sesión a registrar.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Field.FieldGroup>
				<div class="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
					<Field.Field>
						<Field.FieldLabel for="courseId">Clase</Field.FieldLabel>
						<select
							id="courseId"
							class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
							bind:value={selectedCourseId}
						>
							<option value="">Selecciona una clase</option>
							{#each data.courses as course (course.id)}
								<option value={String(course.id)}>{course.name}</option>
							{/each}
						</select>
					</Field.Field>
					<Field.Field>
						<Field.FieldLabel for="sessionDate">Fecha de clase</Field.FieldLabel>
						<Input
							id="sessionDate"
							type="date"
							bind:value={sessionDate}
							min={data.course?.startDate ?? undefined}
							max={data.course?.endDate ?? undefined}
						/>
					</Field.Field>
					<Button type="button" onclick={applyFilters} disabled={!selectedCourseId}>
						Cargar alumnos
					</Button>
				</div>
			</Field.FieldGroup>
		</Card.Content>
	</Card.Root>

	{#if data.course}
		{#if data.attendanceValidationError}
			<Card.Root class="border-amber-500/40 bg-amber-500/5">
				<Card.Content class="flex items-center gap-2 py-4 text-sm">
					<LockIcon class="size-4 shrink-0" />
					<span>{data.attendanceValidationError}</span>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<Card.Title>{data.course.name}</Card.Title>
					<Card.Description>
						{data.sessionDateLabel} · {data.course.schedule} · {formatCourseDays(data.course.days)}
					</Card.Description>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<FullPassStudentPicker
						students={data.eligibleFullPassStudents}
						excludedStudentIds={excludedFullPassStudentIds}
						disabled={!attendanceEditable}
						onSelect={addFullPassStudent}
					/>
					<Button
						variant="secondary"
						disabled={!attendanceEditable}
						onclick={() => (dropInDialogOpen = true)}
					>
						<UserPlusIcon data-icon="inline-start" />
						Pago por clase
					</Button>
				</div>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if displayMembers.length === 0 && data.sessionDropInPayments.length === 0}
					<div class="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
						No hay alumnos con inscripción mensual vigente en esta clase.
						{#if data.eligibleFullPassStudents.length > 0}
							<span class="mt-2 block">
								Usa "Agregar full pass" para incluir alumnos con full pass.
							</span>
						{/if}
						{#if data.eligibleStudents.length > 0 && data.dropInPlans.length > 0}
							<span class="mt-2 block">
								Usa "Pago por clase" para registrar un alumno que paga sin inscripción.
							</span>
						{/if}
					</div>
				{:else if displayMembers.length > 0}
					<form
							method="POST"
							action="?/save"
							use:enhance={() => {
								submitting = true;
								return async ({ update }) => {
									await update();
									submitting = false;
								};
							}}
						>
							<input type="hidden" name="groupId" value={data.course.id} />
							<input type="hidden" name="sessionDate" value={data.sessionDate} />
							<input type="hidden" name="entries" value={entriesPayload} />

							{#if enrolledMembers.length > 0}
								<div class="flex flex-col gap-3">
									<h3 class="text-sm font-semibold">Alumnos inscritos</h3>
									<div class="rounded-xl border">
										<Table.Root>
											<Table.Header>
												<Table.Row>
													<Table.Head>Alumno</Table.Head>
													<Table.Head>Modalidad</Table.Head>
													<Table.Head>Cobertura</Table.Head>
													<Table.Head>Registro</Table.Head>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{#each enrolledMembers as member (member.studentId)}
													<Table.Row>
														<Table.Cell class="font-medium">{member.fullName}</Table.Cell>
														<Table.Cell>
															<div class="flex flex-col gap-0.5">
																<span>{member.modalityLabel}</span>
																<span class="text-muted-foreground text-xs">{member.planName}</span>
															</div>
														</Table.Cell>
														<Table.Cell>
															<div class="flex flex-col gap-0.5">
																<span>{member.coverageLabel}</span>
																{#if !member.canRegisterAttendance}
																	<span class="text-destructive text-xs">Pago no vigente</span>
																{/if}
															</div>
														</Table.Cell>
														<Table.Cell>
															<div class="flex items-center gap-2">
																<AttendanceStatusToggle
																	value={statuses[member.studentId]}
																	savedStatus={member.currentStatus}
																	disabled={!canEditMemberAttendance(member)}
																	onValueChange={(next) => {
																		statuses = {
																			...statuses,
																			[member.studentId]: next
																		};
																	}}
																/>
																{#if isClientAddedFullPass(member.studentId) && attendanceEditable}
																	<ConfirmDialog
																		title={`¿Quitar a ${member.fullName}?`}
																		description="Se quitará al alumno de la lista de asistencia antes de guardar."
																		confirmLabel="Quitar"
																		onConfirm={() =>
																			removeAddedFullPassStudent(member.studentId)}
																	>
																		{#snippet children({ props })}
																			<Button
																				{...props}
																				type="button"
																				variant="ghost"
																				size="icon-sm"
																				aria-label={`Quitar a ${member.fullName}`}
																			>
																				<XIcon />
																			</Button>
																		{/snippet}
																	</ConfirmDialog>
																{/if}
															</div>
														</Table.Cell>
													</Table.Row>
												{/each}
											</Table.Body>
										</Table.Root>
									</div>
								</div>
							{/if}

							{#if dropInMembers.length > 0}
								<div class="flex flex-col gap-3">
									<h3 class="text-sm font-semibold">Pagos por clase</h3>
									<div class="rounded-xl border">
										<Table.Root>
											<Table.Header>
												<Table.Row>
													<Table.Head>Alumno</Table.Head>
													<Table.Head>Plan</Table.Head>
													<Table.Head>Créditos</Table.Head>
													<Table.Head>Registro</Table.Head>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{#each dropInMembers as member (member.studentId)}
													<Table.Row>
														<Table.Cell class="font-medium">{member.fullName}</Table.Cell>
														<Table.Cell>
															<div class="flex flex-col gap-0.5">
																<span>{member.modalityLabel}</span>
																<span class="text-muted-foreground text-xs">{member.planName}</span>
															</div>
														</Table.Cell>
														<Table.Cell>
															<div class="flex flex-col gap-0.5">
																<span>{member.coverageLabel}</span>
																{#if !member.canRegisterAttendance}
																	<span class="text-destructive text-xs">Pago no vigente</span>
																{/if}
															</div>
														</Table.Cell>
														<Table.Cell>
															<div class="flex items-center gap-2">
																<AttendanceStatusToggle
																	value={statuses[member.studentId]}
																	savedStatus={member.currentStatus}
																	disabled={!canEditMemberAttendance(member)}
																	onValueChange={(next) => {
																		statuses = {
																			...statuses,
																			[member.studentId]: next
																		};
																	}}
																/>
																{#if isClientAddedFullPass(member.studentId) && attendanceEditable}
																	<ConfirmDialog
																		title={`¿Quitar a ${member.fullName}?`}
																		description="Se quitará al alumno de la lista de asistencia antes de guardar."
																		confirmLabel="Quitar"
																		onConfirm={() =>
																			removeAddedFullPassStudent(member.studentId)}
																	>
																		{#snippet children({ props })}
																			<Button
																				{...props}
																				type="button"
																				variant="ghost"
																				size="icon-sm"
																				aria-label={`Quitar a ${member.fullName}`}
																			>
																				<XIcon />
																			</Button>
																		{/snippet}
																	</ConfirmDialog>
																{/if}
															</div>
														</Table.Cell>
													</Table.Row>
												{/each}
											</Table.Body>
										</Table.Root>
									</div>
								</div>
							{/if}

							<div class="mt-4 flex items-center justify-between gap-4">
								<p class="text-muted-foreground text-sm">
									{#if !attendanceEditable}
										La clase ya finalizó. Solo puedes consultar el registro de esta sesión.
									{:else if membersRequiringMark.length === 0}
										No hay alumnos con pago vigente para registrar en esta sesión.
									{:else if allMarked}
										Todos los alumnos tienen un estado seleccionado.
									{:else}
										Marca asistencia o falta para cada alumno antes de guardar.
									{/if}
								</p>
								<Button
									type="submit"
									disabled={
										submitting ||
										!attendanceEditable ||
										!allMarked ||
										membersRequiringMark.length === 0
									}
								>
									{submitting ? 'Guardando...' : 'Guardar asistencia'}
								</Button>
							</div>
						</form>
				{/if}

				<div class="flex flex-col gap-3">
					<div>
						<h3 class="text-sm font-semibold">Pagos por clase de esta sesión</h3>
						<p class="text-muted-foreground text-sm">
							Ingresos del {data.sessionDateLabel} para esta clase, incluyendo pagos sin alumno.
						</p>
					</div>
					{#if data.sessionDropInPayments.length === 0}
						<div class="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
							No hay pagos por clase registrados en esta fecha.
						</div>
					{:else}
						<div class="rounded-xl border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Alumno</Table.Head>
										<Table.Head>Plan</Table.Head>
										<Table.Head>Clases</Table.Head>
										<Table.Head>Monto</Table.Head>
										<Table.Head>Método</Table.Head>
										<Table.Head>Asistencia</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each data.sessionDropInPayments as payment (payment.paymentId)}
										<Table.Row>
											<Table.Cell class="font-medium">{payment.studentName}</Table.Cell>
											<Table.Cell>{payment.planName}</Table.Cell>
											<Table.Cell>{payment.classesGranted}</Table.Cell>
											<Table.Cell>
												<div class="flex flex-col gap-0.5 text-sm">
													<span>{formatPrice(payment.totalAmount)}</span>
													{#if payment.discountPercent > 0}
														<span class="text-muted-foreground text-xs">
															Desc. {formatDiscountPercent(payment.discountPercent)}
														</span>
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell>{payment.paymentMethod}</Table.Cell>
											<Table.Cell>
												{#if payment.attendanceStatus}
													<Badge variant={getAttendanceStatusBadgeVariant(payment.attendanceStatus)}>
														{ATTENDANCE_STATUS_LABELS[payment.attendanceStatus]}
													</Badge>
												{:else}
													<span class="text-muted-foreground text-sm">Solo pago</span>
												{/if}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<DropInQuickRegisterDialog
			bind:open={dropInDialogOpen}
			groupId={data.course.id}
			sessionDate={data.sessionDate}
			students={data.eligibleStudents}
			dropInPlans={data.dropInPlans}
			paymentMethods={data.paymentMethods}
			errors={dropInErrors}
			values={dropInValues}
			message={dropInMessage}
		/>
	{/if}
</div>
