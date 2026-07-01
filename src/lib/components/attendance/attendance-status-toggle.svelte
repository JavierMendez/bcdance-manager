<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from '$lib/attendance.js';
	import { cn } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';

	let {
		value,
		savedStatus = null,
		onValueChange
	}: {
		value: AttendanceStatus | '';
		savedStatus?: AttendanceStatus | null;
		onValueChange: (value: AttendanceStatus | '') => void;
	} = $props();

	const isDirty = $derived(Boolean(savedStatus && value && value !== savedStatus));
	const isRegistered = $derived(Boolean(savedStatus && value && value === savedStatus));
</script>

<div class="flex min-w-44 flex-col gap-1.5">
	<ToggleGroup.Root
		type="single"
		spacing={1}
		value={value || undefined}
		onValueChange={(next) => onValueChange((next as AttendanceStatus) ?? '')}
		class="bg-muted/60 border-border inline-flex w-full rounded-lg border p-1"
	>
		<ToggleGroup.Item
			value="attended"
			aria-label={ATTENDANCE_STATUS_LABELS.attended}
			class={cn(
				'min-w-0 flex-1 gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-medium shadow-none',
				'hover:bg-background/80 data-[state=off]:text-muted-foreground',
				'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm'
			)}
		>
			<CircleCheckIcon class="size-4 shrink-0" />
			{ATTENDANCE_STATUS_LABELS.attended}
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="absent"
			aria-label={ATTENDANCE_STATUS_LABELS.absent}
			class={cn(
				'min-w-0 flex-1 gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-medium shadow-none',
				'hover:bg-background/80 data-[state=off]:text-muted-foreground',
				'data-[state=on]:bg-destructive data-[state=on]:text-white data-[state=on]:shadow-sm'
			)}
		>
			<CircleXIcon class="size-4 shrink-0" />
			{ATTENDANCE_STATUS_LABELS.absent}
		</ToggleGroup.Item>
	</ToggleGroup.Root>

	{#if !value}
		<span class="text-muted-foreground text-xs">Selecciona asistencia o falta</span>
	{:else if isDirty}
		<span class="text-xs font-medium text-amber-600 dark:text-amber-400">Cambio sin guardar</span>
	{:else if isRegistered}
		<span class="text-muted-foreground flex items-center gap-1 text-xs">
			<CheckIcon class="size-3" />
			Registrado en esta sesión
		</span>
	{/if}
</div>
