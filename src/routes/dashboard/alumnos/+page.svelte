<script lang="ts">
	import StudentDialog from '$lib/components/students/student-dialog.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import {
		getPaymentStatusBadgeVariant,
		PAYMENT_STATUS_LABELS,
		type PaymentStatus
	} from '$lib/payments.js';
	import { formatEnrollmentDate, formatPhone, type SerializedStudent } from '$lib/students.js';
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
	let searchQuery = $state('');
	let activeFilter = $state<'all' | 'active' | 'inactive'>('all');
	let paymentFilter = $state<'all' | PaymentStatus>('all');

	const displayedStudents = $derived(optimisticStudents ?? students);
	const filteredStudents = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const queryDigits = query.replace(/\D/g, '');

		return displayedStudents.filter((student) => {
			if (activeFilter === 'active' && !student.active) {
				return false;
			}

			if (activeFilter === 'inactive' && student.active) {
				return false;
			}

			if (paymentFilter !== 'all' && student.paymentStatus !== paymentFilter) {
				return false;
			}

			if (!query) {
				return true;
			}

			const phone = formatPhone(student.phone).toLowerCase();
			const digits = student.phone?.replace(/\D/g, '') ?? '';

			return (
				student.fullName.toLowerCase().includes(query) ||
				phone.includes(query) ||
				(queryDigits.length > 0 && digits.includes(queryDigits))
			);
		});
	});
	const totalStudentCount = $derived(displayedStudents.length);
	const currentPaymentStudentCount = $derived(
		displayedStudents.filter(
			(student) => student.paymentStatus === 'vigente' || student.paymentStatus === 'por_vencer'
		).length
	);
	const overduePaymentStudentCount = $derived(
		displayedStudents.filter((student) => student.paymentStatus === 'vencido').length
	);

	function handleStudentSaved(data: Record<string, unknown>) {
		const updated = data.student as SerializedStudent;
		const current = optimisticStudents ?? students;
		const index = current.findIndex((student) => student.id === updated.id);

		if (index === -1) {
			optimisticStudents = [updated, ...current];
		} else {
			optimisticStudents = current.map((student) =>
				student.id === updated.id ? { ...student, ...updated } : student
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

<div class="flex flex-1 flex-col gap-6">
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

	<div class="grid gap-4 sm:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Description>Total de alumnos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums">{totalStudentCount}</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Alumnos con pagos vigentes</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums text-emerald-600">
					{currentPaymentStudentCount}
				</Card.Title>
			</Card.Header>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Description>Alumnos con pagos vencidos</Card.Description>
				<Card.Title class="text-3xl font-bold tabular-nums text-destructive">
					{overduePaymentStudentCount}
				</Card.Title>
			</Card.Header>
		</Card.Root>
	</div>

	<Field.FieldGroup>
		<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
			<Field.Field class="min-w-56 flex-1">
				<Field.FieldLabel for="student-search">Buscar</Field.FieldLabel>
				<Input
					id="student-search"
					placeholder="Buscar por nombre o teléfono..."
					bind:value={searchQuery}
					aria-label="Buscar por nombre o teléfono"
				/>
			</Field.Field>
			<Field.Field class="w-full sm:w-44">
				<Field.FieldLabel for="student-active-filter">Estado</Field.FieldLabel>
				<select
					id="student-active-filter"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
					bind:value={activeFilter}
				>
					<option value="all">Todos</option>
					<option value="active">Activo</option>
					<option value="inactive">Inactivo</option>
				</select>
			</Field.Field>
			<Field.Field class="w-full sm:w-44">
				<Field.FieldLabel for="student-payment-filter">Pago</Field.FieldLabel>
				<select
					id="student-payment-filter"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
					bind:value={paymentFilter}
				>
					<option value="all">Todos</option>
					<option value="vigente">{PAYMENT_STATUS_LABELS.vigente}</option>
					<option value="por_vencer">{PAYMENT_STATUS_LABELS.por_vencer}</option>
					<option value="vencido">{PAYMENT_STATUS_LABELS.vencido}</option>
				</select>
			</Field.Field>
		</div>
	</Field.FieldGroup>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Nombre completo</Table.Head>
					<Table.Head>Teléfono</Table.Head>
					<Table.Head>Fecha de inscripción</Table.Head>
					<Table.Head>Estado</Table.Head>
					<Table.Head>Pago</Table.Head>
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
				{:else if filteredStudents.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="text-muted-foreground h-24 text-center">
							No se encontraron alumnos.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each filteredStudents as student (student.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{student.fullName}</Table.Cell>
							<Table.Cell>{formatPhone(student.phone) || '—'}</Table.Cell>
							<Table.Cell>{formatEnrollmentDate(student.enrolledAt)}</Table.Cell>
							<Table.Cell>
								<Badge variant={student.active ? 'default' : 'secondary'}>
									{student.active ? 'Activo' : 'Inactivo'}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								<Badge variant={getPaymentStatusBadgeVariant(student.paymentStatus)}>
									{PAYMENT_STATUS_LABELS[student.paymentStatus]}
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
														item.id === updated.id ? { ...item, ...updated } : item
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
