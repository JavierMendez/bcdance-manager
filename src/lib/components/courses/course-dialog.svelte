<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldError,
		FieldSet,
		FieldLegend
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { WEEKDAYS, type CourseFormValues, type SerializedCourse } from '$lib/courses.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';

	let {
		open = $bindable(false),
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		errors?: Record<string, string>;
		values?: CourseFormValues | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();

	let name = $state('');
	let description = $state('');
	let schedule = $state('');
	let selectedDays = $state<string[]>([]);
	let startDate = $state('');
	let endDate = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			name = values?.name ?? '';
			description = values?.description ?? '';
			schedule = values?.schedule ?? '';
			selectedDays = values?.days ?? [];
			startDate = values?.startDate ?? '';
			endDate = values?.endDate ?? '';
		}
	});

	function toggleDay(day: string, checked: boolean) {
		if (checked) {
			selectedDays = [...selectedDays, day];
			return;
		}

		selectedDays = selectedDays.filter((entry) => entry !== day);
	}

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			submitting = false;
			onClosed?.();
		}
	}
</script>

<Dialog.Root open={open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Nuevo curso</Dialog.Title>
			<Dialog.Description>
				Define el nombre, horario, días de clase y periodo de vigencia del curso.
			</Dialog.Description>
		</Dialog.Header>

		<form
			id="course-form-{formId}"
			method="POST"
			action="?/create"
			use:enhance={createDialogSubmitHandler({
				setSubmitting: (value) => (submitting = value),
				setOpen: (value) => (open = value),
				onSuccess,
				onClosed
			})}
			>
				<FieldGroup>
					<Field data-invalid={errors.name ? true : undefined}>
						<FieldLabel for="name-{formId}">Nombre</FieldLabel>
						<Input
							id="name-{formId}"
							name="name"
							bind:value={name}
							required
							aria-invalid={errors.name ? true : undefined}
						/>
						{#if errors.name}
							<FieldError>{errors.name}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.description ? true : undefined}>
						<FieldLabel for="description-{formId}">Descripción</FieldLabel>
						<Textarea
							id="description-{formId}"
							name="description"
							bind:value={description}
							required
							aria-invalid={errors.description ? true : undefined}
						/>
						{#if errors.description}
							<FieldError>{errors.description}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.schedule ? true : undefined}>
						<FieldLabel for="schedule-{formId}">Horario</FieldLabel>
						<Input
							id="schedule-{formId}"
							name="schedule"
							bind:value={schedule}
							placeholder="Ej. 18:00 - 19:30"
							required
							aria-invalid={errors.schedule ? true : undefined}
						/>
						{#if errors.schedule}
							<FieldError>{errors.schedule}</FieldError>
						{/if}
					</Field>

					<FieldSet data-invalid={errors.days ? true : undefined}>
						<FieldLegend>Días</FieldLegend>
						<FieldDescription>Selecciona los días en que el curso está vigente.</FieldDescription>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each WEEKDAYS as day (day)}
								<Field orientation="horizontal">
									<Checkbox
										id="day-{formId}-{day}"
										checked={selectedDays.includes(day)}
										onCheckedChange={(checked) => toggleDay(day, checked === true)}
									/>
									<FieldLabel for="day-{formId}-{day}">{day}</FieldLabel>
								</Field>
							{/each}
						</div>
						{#each selectedDays as day (day)}
							<input type="hidden" name="days" value={day} />
						{/each}
						{#if errors.days}
							<FieldError>{errors.days}</FieldError>
						{/if}
					</FieldSet>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={errors.startDate ? true : undefined}>
							<FieldLabel for="startDate-{formId}">Fecha de inicio</FieldLabel>
							<Input
								id="startDate-{formId}"
								name="startDate"
								type="date"
								bind:value={startDate}
								required
								aria-invalid={errors.startDate ? true : undefined}
							/>
							{#if errors.startDate}
								<FieldError>{errors.startDate}</FieldError>
							{/if}
						</Field>

						<Field data-invalid={errors.endDate ? true : undefined}>
							<FieldLabel for="endDate-{formId}">Fecha de término</FieldLabel>
							<Input
								id="endDate-{formId}"
								name="endDate"
								type="date"
								bind:value={endDate}
								required
								aria-invalid={errors.endDate ? true : undefined}
							/>
							{#if errors.endDate}
								<FieldError>{errors.endDate}</FieldError>
							{/if}
						</Field>
					</div>
				</FieldGroup>
			</form>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="course-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : 'Crear curso'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
