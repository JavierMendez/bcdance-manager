<script lang="ts">
	import CourseDialog from '$lib/components/courses/course-dialog.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		formatCourseDate,
		formatCourseDays,
		type SerializedCourse
	} from '$lib/courses.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();

	let courses = $derived(data.courses);
	let createOpen = $state(false);
	let optimisticCourses = $state<SerializedCourse[] | null>(null);

	const displayedCourses = $derived(optimisticCourses ?? courses);

	const createErrors = $derived(form?.mode === 'create' ? (form.errors ?? {}) : {});
	const createValues = $derived(form?.mode === 'create' ? (form.values ?? null) : null);

	function handleCourseCreated(data: Record<string, unknown>) {
		const course = data.course as SerializedCourse;
		const current = optimisticCourses ?? courses;
		optimisticCourses = [course, ...current];
	}

	$effect(() => {
		if (form?.mode === 'create' && form.errors) {
			createOpen = true;
		}
	});

	$effect(() => {
		data.courses;
		optimisticCourses = null;
	});
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Cursos</h2>
			<p class="text-muted-foreground text-sm">
				Administra los cursos disponibles y su periodo de vigencia.
			</p>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<PlusIcon data-icon="inline-start" />
			Nuevo curso
		</Button>
	</div>

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Nombre</Table.Head>
					<Table.Head>Descripción</Table.Head>
					<Table.Head>Horario</Table.Head>
					<Table.Head>Días</Table.Head>
					<Table.Head>Inicio</Table.Head>
					<Table.Head>Término</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if displayedCourses.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="text-muted-foreground h-24 text-center">
							No hay cursos registrados.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each displayedCourses as course (course.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{course.name}</Table.Cell>
							<Table.Cell class="max-w-xs truncate">{course.description}</Table.Cell>
							<Table.Cell>{course.schedule}</Table.Cell>
							<Table.Cell>{formatCourseDays(course.days)}</Table.Cell>
							<Table.Cell>{formatCourseDate(course.startDate)}</Table.Cell>
							<Table.Cell>{formatCourseDate(course.endDate)}</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<CourseDialog
	bind:open={createOpen}
	errors={createErrors}
	values={createValues}
	onSuccess={handleCourseCreated}
/>
