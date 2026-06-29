<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
	<div class="text-center">
		<h1 class="text-4xl font-bold tracking-tight">BC Dance Manager</h1>
		<p class="text-muted-foreground mt-2 text-lg">
			SvelteKit + shadcn-svelte listo para desarrollar.
		</p>
	</div>

	<div class="flex gap-3">
		<Button>Empezar</Button>
		<Button variant="outline">Documentación</Button>
	</div>
</main>
