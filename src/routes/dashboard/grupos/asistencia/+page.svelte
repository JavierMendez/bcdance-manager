<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		ATTENDANCE_STATUS_LABELS,
		FULL_PASS_HOURS_PER_CLASS,
		formatSessionDate,
		getAttendanceStatusBadgeVariant,
		getTodaySessionDate,
		type AttendanceStatus
	} from '$lib/attendance.js';
	import { formatCourseDays } from '$lib/courses.js';
	import { enhance } from '$app/forms';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CheckIcon from '@lucide/svelte/icons/check';
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

	$effect.pre(() => {
		selectedCourseId = data.course ? String(data.course.id) : '';
		sessionDate = data.sessionDate;
		showSavedNotice = false;

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
			params.delete('saved');
			const nextUrl = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, '');
			history.replaceState({}, '', nextUrl);
		}
	});

	const entriesPayload = $derived(
		JSON.stringify(
			data.members
				.filter((member) => statuses[member.studentId])
				.map((member) => ({
					studentId: member.studentId,
					entitlementId: member.entitlementId,
					status: statuses[member.studentId]
				}))
		)
	);

	const allMarked = $derived(
		data.members.length > 0 &&
			data.members.every((member) => statuses[member.studentId] !== '')
	);

	function applyFilters() {
		if (!selectedCourseId) {
			return;
		}

		const params = new URLSearchParams({
			courseId: selectedCourseId,
			date: sessionDate
		});

		window.location.href = `/dashboard/grupos/asistencia?${params.toString()}`;
	}
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold tracking-tight">Registrar asistencia</h2>
			<p class="text-muted-foreground text-sm">
				Marca asistencia o falta por alumno. El full pass descuenta {FULL_PASS_HOURS_PER_CLASS} h
				por clase asistida.
			</p>
		</div>
		<Button variant="outline" href="/dashboard/grupos">
			<ArrowLeftIcon data-icon="inline-start" />
			Volver a grupos
		</Button>
	</div>

	{#if showSavedNotice}
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="flex items-center gap-2 py-4 text-sm">
				<CheckIcon />
				<span>La asistencia se guardó correctamente.</span>
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
			<Card.Description>Elige el curso y la fecha de la sesión a registrar.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Field.FieldGroup>
				<div class="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
					<Field.Field>
						<Field.FieldLabel for="courseId">Curso</Field.FieldLabel>
						<select
							id="courseId"
							class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
							bind:value={selectedCourseId}
						>
							<option value="">Selecciona un curso</option>
							{#each data.courses as course (course.id)}
								<option value={String(course.id)}>{course.name}</option>
							{/each}
						</select>
					</Field.Field>
					<Field.Field>
						<Field.FieldLabel for="sessionDate">Fecha de clase</Field.FieldLabel>
						<Input id="sessionDate" type="date" bind:value={sessionDate} />
					</Field.Field>
					<Button type="button" onclick={applyFilters} disabled={!selectedCourseId}>
						Cargar alumnos
					</Button>
				</div>
			</Field.FieldGroup>
		</Card.Content>
	</Card.Root>

	{#if data.course}
		<Card.Root>
			<Card.Header>
				<Card.Title>{data.course.name}</Card.Title>
				<Card.Description>
					{data.sessionDateLabel} · {data.course.schedule} · {formatCourseDays(data.course.days)}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.members.length === 0}
					<div class="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
						No hay alumnos inscritos con vigencia activa en este curso.
					</div>
				{:else}
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
						<input type="hidden" name="courseId" value={data.course.id} />
						<input type="hidden" name="sessionDate" value={data.sessionDate} />
						<input type="hidden" name="entries" value={entriesPayload} />

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
									{#each data.members as member (member.studentId)}
										<Table.Row>
											<Table.Cell class="font-medium">{member.fullName}</Table.Cell>
											<Table.Cell>
												<div class="flex flex-col gap-0.5">
													<span>{member.modalityLabel}</span>
													<span class="text-muted-foreground text-xs">{member.planName}</span>
												</div>
											</Table.Cell>
											<Table.Cell>{member.coverageLabel}</Table.Cell>
											<Table.Cell>
												<ToggleGroup.Root
													type="single"
													variant="outline"
													value={statuses[member.studentId] || undefined}
													onValueChange={(value) => {
														statuses = {
															...statuses,
															[member.studentId]: (value as AttendanceStatus) ?? ''
														};
													}}
												>
													<ToggleGroup.Item value="attended" aria-label="Asistió">
														{ATTENDANCE_STATUS_LABELS.attended}
													</ToggleGroup.Item>
													<ToggleGroup.Item value="absent" aria-label="Falta">
														{ATTENDANCE_STATUS_LABELS.absent}
													</ToggleGroup.Item>
												</ToggleGroup.Root>
												{#if member.currentStatus}
													<div class="mt-2">
														<Badge variant={getAttendanceStatusBadgeVariant(member.currentStatus)}>
															Guardado: {ATTENDANCE_STATUS_LABELS[member.currentStatus]}
														</Badge>
													</div>
												{/if}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>

						<div class="mt-4 flex items-center justify-between gap-4">
							<p class="text-muted-foreground text-sm">
								{#if allMarked}
									Todos los alumnos tienen un estado seleccionado.
								{:else}
									Marca asistencia o falta para cada alumno antes de guardar.
								{/if}
							</p>
							<Button type="submit" disabled={submitting || !allMarked}>
								{submitting ? 'Guardando...' : 'Guardar asistencia'}
							</Button>
						</div>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
