<script lang="ts">
	import {
		extractPhoneDigits,
		formatPhoneInput,
		PHONE_INPUT_PREFIX_LENGTH,
		PHONE_PLACEHOLDER
	} from '$lib/phone.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		ref?: HTMLInputElement | null;
		value?: string;
		name?: string;
		id?: string;
		class?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' | null;
	};

	let {
		ref = $bindable(null),
		value = $bindable(''),
		name,
		id,
		class: className,
		placeholder = PHONE_PLACEHOLDER,
		required = false,
		disabled = false,
		'aria-invalid': ariaInvalid
	}: Props = $props();

	const displayValue = $derived(formatPhoneInput(value));

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const digits = extractPhoneDigits(input.value);
		value = digits;
		queueMicrotask(() => {
			const end = formatPhoneInput(digits).length;
			input.setSelectionRange(end, end);
		});
	}

	function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const selectionStart = input.selectionStart ?? 0;
		const selectionEnd = input.selectionEnd ?? 0;

		if (
			(event.key === 'Backspace' || event.key === 'Delete') &&
			selectionStart <= PHONE_INPUT_PREFIX_LENGTH &&
			selectionEnd <= PHONE_INPUT_PREFIX_LENGTH
		) {
			event.preventDefault();
		}
	}

	function handleFocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		queueMicrotask(() => {
			const end = formatPhoneInput(value).length;
			input.setSelectionRange(end, end);
		});
	}
</script>

<input type="hidden" {name} {value} {required} />
<input
	bind:this={ref}
	type="tel"
	inputmode="numeric"
	autocomplete="tel-national"
	class={cn(
		'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{id}
	{placeholder}
	{disabled}
	aria-invalid={ariaInvalid}
	value={displayValue}
	oninput={handleInput}
	onkeydown={handleKeydown}
	onfocus={handleFocus}
/>
