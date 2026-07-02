<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		toProgramFormValues,
		type ProgramFormValues,
		type SerializedProgram
	} from '$lib/programs.js';
	import { createDialogSubmitHandler } from '$lib/form-enhance.js';
	import { enhance } from '$app/forms';

	type Mode = 'create' | 'edit';

	let {
		open = $bindable(false),
		mode,
		program = null,
		errors = {},
		values = null,
		onClosed,
		onSuccess
	}: {
		open?: boolean;
		mode: Mode;
		program?: SerializedProgram | null;
		errors?: Record<string, string>;
		values?: ProgramFormValues | null;
		onClosed?: () => void;
		onSuccess?: (data: Record<string, unknown>) => void;
	} = $props();

	const formId = $props.id();
	const action = $derived(mode === 'create' ? '?/create' : '?/update');
	const title = $derived(mode === 'create' ? 'Nuevo programa' : 'Editar programa');
	const description = $derived(
		mode === 'create'
			? 'Agrega un programa al catálogo para usarlo al crear clases.'
			: 'Actualiza el nombre y la descripción del programa. Las clases que lo usan reflejarán los cambios.'
	);

	let name = $state('');
	let descriptionValue = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			const defaults = program ? toProgramFormValues(program) : null;
			name = values?.name ?? defaults?.name ?? '';
			descriptionValue = values?.description ?? defaults?.description ?? '';
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
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		{#key `${mode}-${program?.id ?? 'new'}`}
			<form
				id="program-form-{formId}"
				method="POST"
				{action}
				use:enhance={createDialogSubmitHandler({
					setSubmitting: (value) => (submitting = value),
					setOpen: (value) => (open = value),
					onSuccess,
					onClosed
				})}
			>
				{#if mode === 'edit' && program}
					<input type="hidden" name="id" value={program.id} />
				{/if}

				<FieldGroup>
					<Field data-invalid={errors.name ? true : undefined}>
						<FieldLabel for="name-{formId}">Nombre</FieldLabel>
						<Input
							id="name-{formId}"
							name="name"
							bind:value={name}
							placeholder="Ej. Ballet clásico"
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
							bind:value={descriptionValue}
							required
							aria-invalid={errors.description ? true : undefined}
						/>
						{#if errors.description}
							<FieldError>{errors.description}</FieldError>
						{/if}
					</Field>
				</FieldGroup>
			</form>
		{/key}

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="program-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : mode === 'create' ? 'Crear programa' : 'Guardar cambios'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
