<script lang="ts">
	import AppSidebar, { getBreadcrumb } from '$lib/components/app-sidebar.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/state';

	let { children } = $props();

	const breadcrumb = $derived(getBreadcrumb(page.url.pathname));
	const showSection = $derived(breadcrumb.section !== breadcrumb.page);
</script>

<Sidebar.Provider style="--sidebar-width: 19rem;">
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					<Breadcrumb.Item class="hidden md:block">
						<Breadcrumb.Link href="/dashboard">BC Dance Manager</Breadcrumb.Link>
					</Breadcrumb.Item>
					{#if showSection}
						<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item class="hidden md:block">
						<Breadcrumb.Link href={breadcrumb.section === 'Pagos' ? '/dashboard/pagos' : '/dashboard/configuraciones'}>
							{breadcrumb.section}
						</Breadcrumb.Link>
					</Breadcrumb.Item>
					{/if}
					<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item>
						<Breadcrumb.Page>{breadcrumb.page}</Breadcrumb.Page>
					</Breadcrumb.Item>
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
