<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
		FieldSeparator,
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	const id = $props.id();

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		goto('/dashboard');
	}
</script>

<div class={cn("flex flex-col gap-6", className)} {...restProps}>
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
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input id="email-{id}" type="email" placeholder="m@example.com" required />
					</Field>
					<Field>
						<div class="flex items-center">
							<FieldLabel for="password-{id}">Password</FieldLabel>
							<a href="##" class="ms-auto text-sm underline-offset-2 hover:underline">
								¿Olvidaste tu contraseña?
							</a>
						</div>
						<Input id="password-{id}" type="password" required />
					</Field>
					<Field>
						<Button type="submit">Iniciar sesión</Button>
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
