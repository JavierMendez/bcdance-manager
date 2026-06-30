<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	const id = $props.id();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	const AUTH_ERROR_MESSAGES: Record<string, string> = {
		INVALID_EMAIL_OR_PASSWORD: 'Email o contraseña incorrectos.',
		USER_BANNED: 'Tu cuenta ha sido suspendida. Contacta al administrador.',
		EMAIL_PASSWORD_SIGN_UP_DISABLED: 'El registro no está disponible.',
		INVALID_EMAIL: 'El email no es válido.',
		INVALID_PASSWORD: 'La contraseña no es válida.'
	};

	function getErrorMessage(error: { message?: string; code?: string } | null) {
		if (!error) return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
		if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
			return AUTH_ERROR_MESSAGES[error.code];
		}
		return error.message ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.';
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		errorMessage = '';

		const { error } = await authClient.signIn.email({
			email,
			password,
			callbackURL: '/dashboard'
		});

		submitting = false;

		if (error) {
			errorMessage = getErrorMessage(error);
			return;
		}

		await goto('/dashboard');
	}
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps}>
	<Card.Root class="overflow-hidden p-0">
		<Card.Content class="grid p-0 md:grid-cols-2">
			<form class="p-6 md:p-8" onsubmit={handleSubmit}>
				<FieldGroup>
					<div class="flex flex-col items-center gap-3 text-center">
						<div class="w-full overflow-hidden rounded-xl md:hidden">
							<img
								src="/images/bc-dance-studio-logo.jpg"
								alt="BC Dance Studio"
								class="aspect-square size-full object-cover"
							/>
						</div>
						<h1 class="text-2xl font-bold">Bienvenido</h1>
						<p class="text-muted-foreground text-balance">
							Inicia sesión en BC Dance Manager
						</p>
					</div>
					{#if errorMessage}
						<FieldError>{errorMessage}</FieldError>
					{/if}
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input
							id="email-{id}"
							type="email"
							placeholder="m@example.com"
							bind:value={email}
							required
							disabled={submitting}
						/>
					</Field>
					<Field>
						<div class="flex items-center">
							<FieldLabel for="password-{id}">Password</FieldLabel>
						</div>
						<Input
							id="password-{id}"
							type="password"
							bind:value={password}
							required
							disabled={submitting}
						/>
					</Field>
					<Field>
						<Button type="submit" disabled={submitting}>
							{submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
						</Button>
					</Field>
				</FieldGroup>
			</form>
			<div class="relative hidden min-h-full md:block">
				<img
					src="/images/bc-dance-studio-logo.jpg"
					alt="BC Dance Studio"
					class="absolute inset-0 size-full object-cover"
				/>
			</div>
		</Card.Content>
	</Card.Root>
	<FieldDescription class="px-6 text-center">
		BC Dance Manager v 0.0.1
	</FieldDescription>
</div>
