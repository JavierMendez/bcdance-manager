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
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { WEEKDAYS, type ClassScheduleFormValues } from '$lib/courses.js';
	import type { SerializedProgram } from '$lib/programs.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';

	const NEW_PROGRAM_VALUE = '__new__';

	let {
		open = $bindable(false),
		programs,
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		programs: SerializedProgram[];
		errors?: Record<string, string>;
		values?: Record<string, string | string[]> | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();

	let step = $state(1);
	let programSelection = $state('');
	let newProgramName = $state('');
	let newProgramDescription = $state('');
	let schedule = $state('');
	let selectedDays = $state<string[]>([]);
	let startDate = $state('');
	let endDate = $state('');
	let isActive = $state(true);
	let submitting = $state(false);

	const isNewProgram = $derived(programSelection === NEW_PROGRAM_VALUE);
	const selectedProgram = $derived(
		programs.find((program) => String(program.id) === programSelection) ?? null
	);

	$effect(() => {
		if (open) {
			programSelection = String(values?.programId ?? values?.programSelection ?? '');
			newProgramName = String(values?.newProgramName ?? '');
			newProgramDescription = String(values?.newProgramDescription ?? '');
			schedule = String(values?.schedule ?? '');
			selectedDays = Array.isArray(values?.days)
				? values.days.map(String)
				: values?.days
					? [String(values.days)]
					: [];
			startDate = String(values?.startDate ?? '');
			endDate = String(values?.endDate ?? '');
			isActive = String(values?.isActive ?? 'true') !== 'false';
			step = values ? 2 : 1;
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
			step = 1;
			onClosed?.();
		}
	}

	function goToStep2() {
		if (!programSelection) {
			return;
		}

		if (isNewProgram && (!newProgramName.trim() || !newProgramDescription.trim())) {
			return;
		}

		step = 2;
	}
</script>

<Dialog.Root open={open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Nueva clase</Dialog.Title>
			<Dialog.Description>
				{#if step === 1}
					Paso 1 de 2 — Selecciona o crea el programa de referencia.
				{:else}
					Paso 2 de 2 — Define horario y estado de la clase.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		{#if step === 1}
			<FieldGroup>
				<Field data-invalid={errors.programId ? true : undefined}>
					<FieldLabel for="programSelection-{formId}">Programa</FieldLabel>
					<select
						id="programSelection-{formId}"
						class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
						bind:value={programSelection}
					>
						<option value="">Selecciona un programa</option>
						{#each programs as program (program.id)}
							<option value={String(program.id)}>{program.name}</option>
						{/each}
						<option value={NEW_PROGRAM_VALUE}>+ Crear programa nuevo</option>
					</select>
					{#if errors.programId}
						<FieldError>{errors.programId}</FieldError>
					{/if}
				</Field>

				{#if isNewProgram}
					<Field data-invalid={errors.newProgramName ? true : undefined}>
						<FieldLabel for="newProgramName-{formId}">Nombre del programa</FieldLabel>
						<Input
							id="newProgramName-{formId}"
							bind:value={newProgramName}
							placeholder="Ej. Bachata Nivel 1"
						/>
						{#if errors.newProgramName}
							<FieldError>{errors.newProgramName}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.newProgramDescription ? true : undefined}>
						<FieldLabel for="newProgramDescription-{formId}">Descripción</FieldLabel>
						<Textarea
							id="newProgramDescription-{formId}"
							bind:value={newProgramDescription}
							placeholder="Breve descripción del programa"
						/>
						{#if errors.newProgramDescription}
							<FieldError>{errors.newProgramDescription}</FieldError>
						{/if}
					</Field>
				{:else if selectedProgram}
					<p class="text-muted-foreground text-sm">{selectedProgram.description}</p>
				{/if}
			</FieldGroup>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)}>
					Cancelar
				</Button>
				<Button
					type="button"
					disabled={!programSelection || (isNewProgram && (!newProgramName.trim() || !newProgramDescription.trim()))}
					onclick={goToStep2}
				>
					Siguiente
				</Button>
			</Dialog.Footer>
		{:else}
			<form
				id="class-form-{formId}"
				method="POST"
				action="?/createClass"
				use:enhance={createDialogSubmitHandler({
					setSubmitting: (value) => (submitting = value),
					setOpen: (value) => (open = value),
					onSuccess,
					onClosed
				})}
			>
				<input type="hidden" name="programId" value={isNewProgram ? '' : programSelection} />
				<input type="hidden" name="programSelection" value={programSelection} />
				{#if isNewProgram}
					<input type="hidden" name="newProgramName" value={newProgramName} />
					<input type="hidden" name="newProgramDescription" value={newProgramDescription} />
				{/if}

				<FieldGroup>
					{#if selectedProgram && !isNewProgram}
						<p class="text-sm font-medium">{selectedProgram.name}</p>
					{/if}

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

					<Field orientation="horizontal">
						<Switch
							id="isActive-{formId}"
							checked={isActive}
							onCheckedChange={(checked) => (isActive = checked === true)}
						/>
						<div class="flex flex-col gap-1">
							<FieldLabel for="isActive-{formId}">Clase activa</FieldLabel>
							<FieldDescription>Las clases inactivas no aparecen en pagos ni en el dashboard de hoy.</FieldDescription>
						</div>
						<input type="hidden" name="isActive" value={String(isActive)} />
					</Field>

					<div class="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={errors.startDate ? true : undefined}>
							<FieldLabel for="startDate-{formId}">Fecha de inicio (opcional)</FieldLabel>
							<Input id="startDate-{formId}" name="startDate" type="date" bind:value={startDate} />
							{#if errors.startDate}
								<FieldError>{errors.startDate}</FieldError>
							{/if}
						</Field>

						<Field data-invalid={errors.endDate ? true : undefined}>
							<FieldLabel for="endDate-{formId}">Fecha de término (opcional)</FieldLabel>
							<Input id="endDate-{formId}" name="endDate" type="date" bind:value={endDate} />
							{#if errors.endDate}
								<FieldError>{errors.endDate}</FieldError>
							{/if}
						</Field>
					</div>
				</FieldGroup>
			</form>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (step = 1)} disabled={submitting}>
					Atrás
				</Button>
				<Button type="submit" form="class-form-{formId}" disabled={submitting}>
					{submitting ? 'Guardando...' : 'Crear clase'}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
