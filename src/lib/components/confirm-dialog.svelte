<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Snippet } from 'svelte';

	type Props = {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void | boolean | Promise<void | boolean>;
		onOpenChange?: (open: boolean) => void;
		children?: Snippet<[{ props: Record<string, unknown> }]>;
	};

	let {
		open = $bindable(false),
		title,
		description = 'Esta acción no se puede deshacer.',
		confirmLabel = 'Eliminar',
		cancelLabel = 'Cancelar',
		onConfirm,
		onOpenChange,
		children
	}: Props = $props();

	let confirming = $state(false);

	async function handleConfirm() {
		confirming = true;
		try {
			const shouldClose = await onConfirm();
			if (shouldClose !== false) {
				open = false;
			}
		} finally {
			confirming = false;
		}
	}

	function handleOpenChange(next: boolean) {
		if (!next && confirming) return;
		open = next;
		onOpenChange?.(next);
	}
</script>

<AlertDialog.Root bind:open onOpenChange={handleOpenChange}>
	{#if children}
		<AlertDialog.Trigger>
			{#snippet child({ props })}
				{@render children({ props })}
			{/snippet}
		</AlertDialog.Trigger>
	{/if}
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={confirming}>{cancelLabel}</AlertDialog.Cancel>
			<Button variant="destructive" disabled={confirming} onclick={() => void handleConfirm()}>
				{confirming ? 'Eliminando...' : confirmLabel}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
