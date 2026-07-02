<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { alerts } from '$lib/alerts.svelte.js';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import InfoIcon from '@lucide/svelte/icons/info';
	import XIcon from '@lucide/svelte/icons/x';
</script>

<div
	class="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
	aria-live="polite"
	aria-relevant="additions"
>
	{#each alerts.items as alert (alert.id)}
		<div class="pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
			<Alert.Root variant={alert.variant}>
				{#if alert.variant === 'destructive'}
					<CircleAlertIcon />
				{:else}
					<InfoIcon />
				{/if}

				{#if alert.title}
					<Alert.Title>{alert.title}</Alert.Title>
				{/if}
				<Alert.Description>{alert.description}</Alert.Description>

				<Alert.Action>
					<Button
						variant="ghost"
						size="icon-sm"
						class="size-7"
						aria-label="Cerrar notificación"
						onclick={() => alerts.dismiss(alert.id)}
					>
						<XIcon />
					</Button>
				</Alert.Action>
			</Alert.Root>
		</div>
	{/each}
</div>
