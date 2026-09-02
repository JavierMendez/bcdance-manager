<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { type EligibleFullPassStudent } from '$lib/attendance.js';
	import { formatFullPassCoverage } from '$lib/groups.js';
	import { formatPhone } from '$lib/phone.js';
	import { cn } from '$lib/utils.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';

	let {
		students,
		excludedStudentIds = new Set<number>(),
		disabled = false,
		onSelect
	}: {
		students: EligibleFullPassStudent[];
		excludedStudentIds?: Set<number>;
		disabled?: boolean;
		onSelect: (student: EligibleFullPassStudent) => void;
	} = $props();

	let open = $state(false);
	let search = $state('');

	const availableStudents = $derived(
		students.filter((student) => !excludedStudentIds.has(student.studentId))
	);

	const filteredStudents = $derived.by(() => {
		const query = search.trim().toLowerCase();

		if (!query) {
			return availableStudents;
		}

		const queryDigits = query.replace(/\D/g, '');

		return availableStudents.filter((student) => {
			const phone = formatPhone(student.phone).toLowerCase();
			const digits = student.phone?.replace(/\D/g, '') ?? '';

			return (
				student.fullName.toLowerCase().includes(query) ||
				phone.includes(query) ||
				(queryDigits.length > 0 && digits.includes(queryDigits))
			);
		});
	});

	function handleSelect(student: EligibleFullPassStudent) {
		onSelect(student);
		open = false;
		search = '';
	}
</script>

<PopoverPrimitive.Root bind:open>
	<PopoverPrimitive.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				type="button"
				variant="outline"
				disabled={disabled || availableStudents.length === 0}
			>
				<UserPlusIcon data-icon="inline-start" />
				Agregar full pass
				<ChevronsUpDownIcon data-icon="inline-end" class="opacity-50" />
			</Button>
		{/snippet}
	</PopoverPrimitive.Trigger>
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			class="bg-popover text-popover-foreground z-50 flex w-80 flex-col gap-2 rounded-lg border p-2 shadow-md outline-hidden"
			sideOffset={6}
			align="end"
		>
			<Input
				placeholder="Buscar por nombre o teléfono..."
				bind:value={search}
				aria-label="Buscar alumno full pass"
			/>
			<div class="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
				{#if filteredStudents.length === 0}
					<p class="text-muted-foreground px-2 py-4 text-center text-sm">
						{#if availableStudents.length === 0}
							No hay alumnos full pass disponibles.
						{:else}
							No se encontraron alumnos.
						{/if}
					</p>
				{:else}
					{#each filteredStudents as student (student.studentId)}
						<button
							type="button"
							class={cn(
								'hover:bg-accent hover:text-accent-foreground flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm transition-colors'
							)}
							onclick={() => handleSelect(student)}
						>
							<span class="font-medium">{student.fullName}</span>
							<span class="text-muted-foreground text-xs">
								{formatFullPassCoverage(student.hoursRemaining)}
								{#if student.phone}
									· {formatPhone(student.phone)}
								{/if}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</PopoverPrimitive.Content>
	</PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
