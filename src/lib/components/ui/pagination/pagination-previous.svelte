<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: PaginationPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
	<ChevronLeftIcon data-icon="inline-start" />
	<span class="hidden sm:block">Anterior</span>
{/snippet}

<PaginationPrimitive.PrevButton
	bind:ref
	aria-label="Ir a la página anterior"
	class={cn(
		buttonVariants({
			size: "default",
			variant: "ghost",
			class: "px-2.5 sm:ps-2.5"
		}),
		className
	)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		{@render Fallback()}
	{/if}
</PaginationPrimitive.PrevButton>
