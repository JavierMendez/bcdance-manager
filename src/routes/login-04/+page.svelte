<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
</script>

<div class="bg-muted relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
	<div class="absolute end-4 top-4">
		<ThemeToggle />
	</div>
	<div class="w-full max-w-sm md:max-w-3xl">
		<LoginForm />
	</div>
</div>
