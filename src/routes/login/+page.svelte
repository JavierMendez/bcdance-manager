<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
</script>

<div class="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6 md:p-10">
	<div
		class="absolute inset-0 bg-black bg-cover bg-center bg-no-repeat"
		style="background-image: url('/images/login-background.jpg')"
		aria-hidden="true"
	></div>
	<div class="absolute inset-0 bg-black/25" aria-hidden="true"></div>
	<div class="absolute end-4 top-4 z-20">
		<ThemeToggle />
	</div>
	<div class="relative z-10 w-full max-w-sm md:max-w-3xl">
		<LoginForm />
	</div>
</div>
