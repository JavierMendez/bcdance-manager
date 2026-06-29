<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
</script>

<div class="flex flex-1 flex-col gap-4">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Configuraciones</h2>
		<p class="text-muted-foreground text-sm">Administra los parámetros generales de la aplicación.</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<BookOpenIcon />
					Cursos
				</Card.Title>
				<Card.Description>
					Crea y administra los cursos con su horario, días y vigencia.
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/dashboard/configuraciones/cursos">Gestionar cursos</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<CreditCardIcon />
					Planes de pago
				</Card.Title>
				<Card.Description>
					Define el catálogo de planes con precio, periodicidad y clases incluidas.
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/dashboard/configuraciones/planes-de-pago">Gestionar planes</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
