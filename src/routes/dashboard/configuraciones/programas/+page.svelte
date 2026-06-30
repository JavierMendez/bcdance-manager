<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
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
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.programs.length === 0}
					<Table.Row>
						<Table.Cell colspan={3} class="text-muted-foreground h-24 text-center">
							No hay programas registrados. Crea tu primera clase para registrar un programa.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.programs as program (program.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{program.name}</Table.Cell>
							<Table.Cell class="max-w-md truncate">{program.description}</Table.Cell>
							<Table.Cell>
								{program.classCount} clase{program.classCount === 1 ? '' : 's'}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>
