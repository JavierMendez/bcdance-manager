<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: PaginationPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
	<span class="hidden sm:block">Siguiente</span>
	<ChevronRightIcon data-icon="inline-end" />
{/snippet}

<PaginationPrimitive.NextButton
	bind:ref
	aria-label="Ir a la página siguiente"
	class={cn(
		buttonVariants({
			size: "default",
			variant: "ghost",
			class: "px-2.5 sm:pe-2.5"
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
</PaginationPrimitive.NextButton>
