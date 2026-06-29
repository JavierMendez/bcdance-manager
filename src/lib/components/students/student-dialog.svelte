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
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatEnrollmentDate, type SerializedStudent } from '$lib/students.js';
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
		values?: { fullName: string; phone: string; email: string } | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();
	const action = $derived(mode === 'create' ? '?/create' : '?/update');
	const title = $derived(mode === 'create' ? 'Nuevo alumno' : 'Editar alumno');
	const description = $derived(
		mode === 'create'
			? 'Completa los datos para registrar un nuevo alumno.'
			: 'Actualiza los datos del alumno. La fecha de inscripción no se puede modificar.'
	);

	let fullName = $state('');
	let phone = $state('');
	let email = $state('');
	let submitting = $state(false);

	const enrolledAt = $derived(student?.enrolledAt ?? new Date().toISOString());

	$effect(() => {
		if (open) {
			fullName = values?.fullName ?? student?.fullName ?? '';
			phone = values?.phone ?? student?.phone ?? '';
			email = values?.email ?? student?.email ?? '';
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
						<Input
							id="phone-{formId}"
							name="phone"
							type="tel"
							bind:value={phone}
							required
							aria-invalid={errors.phone ? true : undefined}
						/>
						{#if errors.phone}
							<FieldError>{errors.phone}</FieldError>
						{/if}
					</Field>

					<Field data-invalid={errors.email ? true : undefined}>
						<FieldLabel for="email-{formId}">Correo electrónico</FieldLabel>
						<Input
							id="email-{formId}"
							name="email"
							type="email"
							bind:value={email}
							required
							aria-invalid={errors.email ? true : undefined}
						/>
						{#if errors.email}
							<FieldError>{errors.email}</FieldError>
						{/if}
					</Field>

					<Field>
						<FieldLabel for="enrolledAt-{formId}">Fecha de inscripción</FieldLabel>
						<Input
							id="enrolledAt-{formId}"
							value={formatEnrollmentDate(enrolledAt)}
							disabled
							readonly
						/>
						<FieldDescription>
							{mode === 'create'
								? 'Se registrará automáticamente con la fecha de hoy.'
								: 'Este campo no se puede modificar.'}
						</FieldDescription>
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
