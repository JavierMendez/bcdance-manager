<script lang="ts">
	import StudentDialog from '$lib/components/students/student-dialog.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { formatEnrollmentDate, type SerializedStudent } from '$lib/students.js';
	import { enhance } from '$app/forms';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();

	let students = $derived(data.students);
	let createOpen = $state(false);
	let editOpen = $state(false);
	let editingStudent = $state<SerializedStudent | null>(null);
	let optimisticStudents = $state<SerializedStudent[] | null>(null);

	const displayedStudents = $derived(optimisticStudents ?? students);

	function handleStudentSaved(data: Record<string, unknown>) {
		const updated = data.student as SerializedStudent;
		const current = optimisticStudents ?? students;
		const index = current.findIndex((student) => student.id === updated.id);

		if (index === -1) {
			optimisticStudents = [updated, ...current];
		} else {
			optimisticStudents = current.map((student) =>
				student.id === updated.id ? updated : student
			);
		}
	}

	function openEdit(student: SerializedStudent) {
		editingStudent = student;
		editOpen = true;
	}

	const createErrors = $derived(form?.mode === 'create' ? (form.errors ?? {}) : {});
	const editErrors = $derived(form?.mode === 'edit' ? (form.errors ?? {}) : {});
	const createValues = $derived(form?.mode === 'create' ? (form.values ?? null) : null);
	const editValues = $derived(form?.mode === 'edit' ? (form.values ?? null) : null);

	$effect(() => {
		if (form?.mode === 'create' && form.errors) {
			createOpen = true;
		}

		if (form?.mode === 'edit' && form.errors && form.id) {
			editOpen = true;
			if (!editingStudent || editingStudent.id !== form.id) {
				const current = optimisticStudents ?? students;
				editingStudent = current.find((student) => student.id === form.id) ?? editingStudent;
			}
		}
	});
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Alumnos</h2>
			<p class="text-muted-foreground text-sm">Gestiona el registro y estado de los alumnos.</p>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<PlusIcon data-icon="inline-start" />
			Nuevo alumno
		</Button>
	</div>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Nombre completo</Table.Head>
					<Table.Head>Teléfono</Table.Head>
					<Table.Head>Correo electrónico</Table.Head>
					<Table.Head>Fecha de inscripción</Table.Head>
					<Table.Head>Estado</Table.Head>
					<Table.Head class="text-end">Acciones</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if displayedStudents.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="text-muted-foreground h-24 text-center">
							No hay alumnos registrados.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each displayedStudents as student (student.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{student.fullName}</Table.Cell>
							<Table.Cell>{student.phone}</Table.Cell>
							<Table.Cell>{student.email}</Table.Cell>
							<Table.Cell>{formatEnrollmentDate(student.enrolledAt)}</Table.Cell>
							<Table.Cell>
								<Badge variant={student.active ? 'default' : 'secondary'}>
									{student.active ? 'Activo' : 'Inactivo'}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center justify-end gap-2">
									<Button variant="outline" size="sm" onclick={() => openEdit(student)}>
										<PencilIcon data-icon="inline-start" />
										Editar
									</Button>
									<form
										id="toggle-student-{student.id}"
										method="POST"
										action="?/toggleActive"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update({ reset: false });
												if (result.type === 'success' && result.data?.student) {
													const updated = result.data.student as SerializedStudent;
													const current = optimisticStudents ?? students;
													optimisticStudents = current.map((item) =>
														item.id === updated.id ? updated : item
													);
												}
											};
										}}
									>
										<input type="hidden" name="id" value={student.id} />
										<input type="hidden" name="active" value={String(!student.active)} />
										<Switch
											checked={student.active}
											aria-label="Activar o desactivar alumno"
											onCheckedChange={() => {
												(
													document.getElementById(
														`toggle-student-${student.id}`
													) as HTMLFormElement | null
												)?.requestSubmit();
											}}
										/>
									</form>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<StudentDialog
	bind:open={createOpen}
	mode="create"
	errors={createErrors}
	values={createValues}
	onSuccess={handleStudentSaved}
/>

<StudentDialog
	bind:open={editOpen}
	mode="edit"
	student={editingStudent}
	errors={editErrors}
	values={editValues}
	onSuccess={handleStudentSaved}
	onClosed={() => (editingStudent = null)}
/>
