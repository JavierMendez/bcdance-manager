<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import PhoneInput from '$lib/components/phone-input.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toStudentFormValues, type SerializedStudent } from '$lib/students.js';
	import { extractPhoneDigits } from '$lib/phone.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';

	type Mode = 'create' | 'edit';

	let {
		open = $bindable(false),
		mode,
		student = null,
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		mode: Mode;
		student?: SerializedStudent | null;
		errors?: Record<string, string>;
		values?: { fullName: string; phone: string | null; enrolledAt: string } | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();
	const action = $derived(mode === 'create' ? '?/create' : '?/update');
	const title = $derived(mode === 'create' ? 'Nuevo alumno' : 'Editar alumno');
	const description = $derived(
		mode === 'create'
			? 'Completa los datos para registrar un nuevo alumno.'
			: 'Actualiza los datos del alumno.'
	);

	let fullName = $state('');
	let phone = $state('');
	let enrolledAt = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			const defaults = toStudentFormValues(student);
			fullName = values?.fullName ?? defaults.fullName;
			phone = extractPhoneDigits(values?.phone ?? defaults.phone);
			enrolledAt = values?.enrolledAt ?? defaults.enrolledAt;
		}
	});

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		if (!isOpen) {
			submitting = false;
			onClosed?.();
		}
	}
</script>

<Dialog.Root open={open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		{#key `${mode}-${student?.id ?? 'new'}`}
			<form
				id="student-form-{formId}"
				method="POST"
				{action}
				use:enhance={createDialogSubmitHandler({
					setSubmitting: (value) => (submitting = value),
					setOpen: (value) => (open = value),
					onSuccess,
					onClosed
				})}
			>
				{#if mode === 'edit' && student}
					<input type="hidden" name="id" value={student.id} />
				{/if}

				<FieldGroup>
					<Field data-invalid={errors.fullName ? true : undefined}>
						<FieldLabel for="fullName-{formId}">Nombre completo</FieldLabel>
						<Input
							id="fullName-{formId}"
							name="fullName"
							bind:value={fullName}
							required
							aria-invalid={errors.fullName ? true : undefined}
						/>
						{#if errors.fullName}
							<FieldError>{errors.fullName}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.phone ? true : undefined}>
						<FieldLabel for="phone-{formId}">Teléfono</FieldLabel>
						<PhoneInput
							id="phone-{formId}"
							name="phone"
							bind:value={phone}
							aria-invalid={errors.phone ? true : undefined}
						/>
						{#if errors.phone}
							<FieldError>{errors.phone}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.enrolledAt ? true : undefined}>
						<FieldLabel for="enrolledAt-{formId}">Fecha de inscripción</FieldLabel>
						<Input
							id="enrolledAt-{formId}"
							name="enrolledAt"
							type="date"
							bind:value={enrolledAt}
							required
							aria-invalid={errors.enrolledAt ? true : undefined}
						/>
						{#if errors.enrolledAt}
							<FieldError>{errors.enrolledAt}</FieldError>
						{:else if mode === 'create'}
							<FieldDescription>Por defecto se usa la fecha de hoy.</FieldDescription>
						{/if}
					</Field>
				</FieldGroup>
			</form>
		{/key}

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="student-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : mode === 'create' ? 'Crear alumno' : 'Guardar cambios'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
