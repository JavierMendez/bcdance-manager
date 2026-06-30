<script lang="ts">
	import PaymentWizard from '$lib/components/payments/payment-wizard.svelte';
	import type { PageData } from './$types.js';

	let { data, form }: { data: PageData; form: import('./$types.js').ActionData } = $props();
</script>

<div class="flex flex-1 flex-col gap-4">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Registrar pago</h2>
		<p class="text-muted-foreground text-sm">
			Sigue los pasos para registrar un pago de plan mensual, full pass, clase suelta o combinados.
		</p>
	</div>

	<PaymentWizard
		students={data.students}
		courses={data.courses}
		plans={data.plans}
		paymentMethods={data.paymentMethods}
		errors={form?.errors ?? {}}
		values={form?.values ?? null}
	/>
</div>
