<script lang="ts">
	import ProgramDialog from '$lib/components/programs/program-dialog.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { SerializedProgramWithUsage } from '$lib/programs.js';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();

	let programs = $derived(data.programs);
	let editOpen = $state(false);
	let editingProgram = $state<SerializedProgramWithUsage | null>(null);
	let optimisticPrograms = $state<SerializedProgramWithUsage[] | null>(null);

	const displayedPrograms = $derived(optimisticPrograms ?? programs);

	const editErrors = $derived(form?.mode === 'edit' ? (form.errors ?? {}) : {});
	const editValues = $derived(form?.mode === 'edit' ? (form.values ?? null) : null);

	function handleProgramSaved(data: Record<string, unknown>) {
		const program = data.program as SerializedProgramWithUsage;
		const current = optimisticPrograms ?? programs;
		const index = current.findIndex((item) => item.id === program.id);

		if (index === -1) {
			return;
		}

		optimisticPrograms = current.map((item) =>
			item.id === program.id ? { ...item, name: program.name, description: program.description } : item
		);
	}

	function openEdit(program: SerializedProgramWithUsage) {
		editingProgram = program;
		editOpen = true;
	}

	$effect(() => {
		if (form?.mode === 'edit' && form.errors && form.id) {
			editOpen = true;
			if (!editingProgram || editingProgram.id !== form.id) {
				const current = optimisticPrograms ?? programs;
				editingProgram = current.find((program) => program.id === form.id) ?? editingProgram;
			}
		}
	});

	$effect(() => {
		data.programs;
		optimisticPrograms = null;
	});
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Programas</h2>
			<p class="text-muted-foreground text-sm">
				Plantillas de referencia al crear clases. Los programas se registran al dar de alta una
				nueva clase.
			</p>
		</div>
	</div>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Nombre</Table.Head>
					<Table.Head>Descripción</Table.Head>
					<Table.Head>Usado en</Table.Head>
					<Table.Head class="text-end">Acciones</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if displayedPrograms.length === 0}
					<Table.Row>
						<Table.Cell colspan={4} class="text-muted-foreground h-24 text-center">
							No hay programas registrados. Crea tu primera clase para registrar un programa.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each displayedPrograms as program (program.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{program.name}</Table.Cell>
							<Table.Cell class="max-w-md truncate">{program.description}</Table.Cell>
							<Table.Cell>
								{program.classCount} clase{program.classCount === 1 ? '' : 's'}
							</Table.Cell>
							<Table.Cell>
								<div class="flex justify-end">
									<Button variant="outline" size="sm" onclick={() => openEdit(program)}>
										<PencilIcon data-icon="inline-start" />
										Editar
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<ProgramDialog
	bind:open={editOpen}
	mode="edit"
	program={editingProgram}
	errors={editErrors}
	values={editValues}
	onClosed={() => (editingProgram = null)}
	onSuccess={handleProgramSaved}
/>
