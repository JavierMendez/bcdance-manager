<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
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
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { WEEKDAYS, type ClassScheduleFormValues } from '$lib/courses.js';
	import type { ClassGroup } from '$lib/groups.js';
	import type { SerializedProgram } from '$lib/programs.js';
	import { createActionSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';

	type ClassSettingsValues = ClassScheduleFormValues & {
		programId: string;
	};

	let {
		classGroup,
		programs,
		errors = {},
		values = null,
		onSuccess
	}: {
		classGroup: ClassGroup;
		programs: SerializedProgram[];
		errors?: Record<string, string>;
		values?: ClassSettingsValues | null;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();

	let programId = $state('');
	let schedule = $state('');
	let selectedDays = $state<string[]>([]);
	let startDate = $state('');
	let endDate = $state('');
	let submitting = $state(false);

	const selectedProgram = $derived(
		programs.find((program) => String(program.id) === programId) ?? null
	);

	$effect(() => {
		programId = values?.programId ?? String(classGroup.programId);
		schedule = values?.schedule ?? classGroup.schedule;
		selectedDays = values?.days ?? [...classGroup.days];
		startDate = values?.startDate ?? classGroup.startDate;
		endDate = values?.endDate ?? classGroup.endDate;
	});

	function toggleDay(day: string, checked: boolean) {
		if (checked) {
			selectedDays = [...selectedDays, day];
			return;
		}

		selectedDays = selectedDays.filter((entry) => entry !== day);
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Configuraciones</Card.Title>
		<Card.Description>
			Actualiza el programa de referencia, horario y vigencia de la clase.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			id="class-settings-form-{formId}"
			method="POST"
			action="?/updateClass"
			use:enhance={createActionSubmitHandler({
				setSubmitting: (value) => (submitting = value),
				onSuccess,
				invalidateAll: true
			})}
		>
			<FieldGroup>
				<Field data-invalid={errors.programId ? true : undefined}>
					<FieldLabel for="programId-{formId}">Programa</FieldLabel>
					<select
						id="programId-{formId}"
						name="programId"
						class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
						bind:value={programId}
						required
					>
						<option value="">Selecciona un programa</option>
						{#each programs as program (program.id)}
							<option value={String(program.id)}>{program.name}</option>
						{/each}
					</select>
					{#if selectedProgram}
						<FieldDescription>{selectedProgram.description}</FieldDescription>
					{/if}
					{#if errors.programId}
						<FieldError>{errors.programId}</FieldError>
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
					/>
					{#if errors.schedule}
						<FieldError>{errors.schedule}</FieldError>
					{/if}
				</Field>

				<FieldSet data-invalid={errors.days ? true : undefined}>
					<FieldLegend>Días</FieldLegend>
					<FieldDescription>Selecciona los días en que se imparte la clase.</FieldDescription>
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
						/>
						{#if errors.endDate}
							<FieldError>{errors.endDate}</FieldError>
						{/if}
					</Field>
				</div>
			</FieldGroup>
		</form>
	</Card.Content>
	<Card.Footer>
		<Button type="submit" form="class-settings-form-{formId}" disabled={submitting}>
			{submitting ? 'Guardando...' : 'Guardar cambios'}
		</Button>
	</Card.Footer>
</Card.Root>
