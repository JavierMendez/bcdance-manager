<script lang="ts">
	import PaymentWizard from '$lib/components/payments/payment-wizard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex flex-col gap-2">
		<Button variant="ghost" class="w-fit px-0" href="/dashboard/clases/{data.classGroup.id}">
			<ArrowLeftIcon data-icon="inline-start" />
			Volver a la clase
		</Button>
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Inscribir alumno</h2>
			<p class="text-muted-foreground text-sm">
				Registra un alumno nuevo o selecciona uno existente para inscribirlo en {data.classGroup.name}.
			</p>
		</div>
	</div>

	<PaymentWizard
		intent="enrollment"
		students={data.students}
		enrolledStudentIds={data.enrolledStudentIds}
		courses={data.courses}
		plans={data.plans}
		paymentMethods={data.paymentMethods}
		initialGroupId={String(data.classGroup.id)}
		errors={form?.errors ?? {}}
		values={form?.values ?? null}
	/>
</div>
