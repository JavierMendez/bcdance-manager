<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		extractPhoneDigits,
		formatPhoneInput,
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
	const prefixLength = 4;

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
			selectionStart <= prefixLength &&
			selectionEnd <= prefixLength
		) {
			event.preventDefault();
		}
	}

	function handleFocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		queueMicrotask(() => {
			const end = formatPhoneInput(value).length || prefixLength;
			input.setSelectionRange(end, end);
		});
	}
</script>

<input type="hidden" {name} {value} {required} />
<Input
	bind:ref
	type="tel"
	inputmode="numeric"
	autocomplete="tel-national"
	class={cn(className)}
	{id}
	{placeholder}
	{disabled}
	aria-invalid={ariaInvalid}
	value={displayValue}
	oninput={handleInput}
	onkeydown={handleKeydown}
	onfocus={handleFocus}
/>
