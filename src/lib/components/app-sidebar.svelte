<script lang="ts" module>
	import type { Component } from 'svelte';
	import HomeIcon from '@lucide/svelte/icons/house';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import Music2Icon from '@lucide/svelte/icons/music-2';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	export type NavSubItem = {
		title: string;
		url: string;
		icon: Component;
	};

	export type NavItem = {
		title: string;
		url: string;
		icon: Component;
		items?: readonly NavSubItem[];
	};

	export const navItems = [
		{ title: 'Inicio', url: '/dashboard', icon: HomeIcon },
		{ title: 'Alumnos', url: '/dashboard/alumnos', icon: UsersIcon },
		{ title: 'Grupos', url: '/dashboard/grupos', icon: LayersIcon },
		{ title: 'Pagos', url: '/dashboard/pagos', icon: WalletIcon },
		{
			title: 'Configuraciones',
			url: '/dashboard/configuraciones',
			icon: SettingsIcon,
			items: [
				{ title: 'Cursos', url: '/dashboard/configuraciones/cursos', icon: BookOpenIcon },
				{
					title: 'Planes de pago',
					url: '/dashboard/configuraciones/planes-de-pago',
					icon: CreditCardIcon
				}
			]
		}
	] satisfies readonly NavItem[];

	export function getBreadcrumb(pathname: string) {
		if (pathname === '/dashboard/pagos/registrar') {
			return { section: 'Pagos', page: 'Registrar pago' };
		}

		for (const item of navItems) {
			if (item.url === pathname) {
				return { section: item.title, page: item.title };
			}

			const subItem = item.items?.find((entry) => entry.url === pathname);
			if (subItem) {
				return { section: item.title, page: subItem.title };
			}
		}

		return { section: 'Inicio', page: 'Inicio' };
	}

	export function isNavItemActive(item: NavItem, pathname: string) {
		if (pathname === item.url) {
			return true;
		}

		return item.items?.some((subItem) => subItem.url === pathname) ?? false;
	}
</script>

<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { page } from '$app/state';
	import type { ComponentProps } from 'svelte';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	let openSections = $state<Record<string, boolean>>({});

	function isSectionOpen(item: NavItem) {
		return openSections[item.url] ?? false;
	}

	$effect(() => {
		const pathname = page.url.pathname;

		for (const item of navItems) {
			if (item.items?.length && isNavItemActive(item, pathname) && !isSectionOpen(item)) {
				openSections = { ...openSections, [item.url]: true };
			}
		}
	});
</script>

<Sidebar.Root bind:ref variant="floating" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/dashboard" {...props}>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<Music2Icon />
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-medium">BC Dance Manager</span>
								<span class="text-muted-foreground text-xs">Panel de control</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Menú</Sidebar.GroupLabel>
			<Sidebar.Menu class="gap-2">
				{#each navItems as item (item.url)}
					{#if item.items?.length}
						<Collapsible.Root
							bind:open={() => isSectionOpen(item), (open) => {
								openSections = { ...openSections, [item.url]: open };
							}}
							class="group/collapsible"
						>
							<Sidebar.MenuItem>
								<Collapsible.Trigger>
									{#snippet child({ props })}
										<Sidebar.MenuButton
											{...props}
											isActive={isNavItemActive(item, page.url.pathname)}
										>
											<item.icon />
											<span>{item.title}</span>
											<ChevronDownIcon
												class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
											/>
										</Sidebar.MenuButton>
									{/snippet}
								</Collapsible.Trigger>
								<Collapsible.Content>
									<Sidebar.MenuSub class="ms-0 border-s-0 px-1.5">
										{#each item.items as subItem (subItem.url)}
											<Sidebar.MenuSubItem>
												<Sidebar.MenuSubButton
													isActive={page.url.pathname === subItem.url}
												>
													{#snippet child({ props })}
														<a href={subItem.url} {...props}>
															<subItem.icon />
															<span>{subItem.title}</span>
														</a>
													{/snippet}
												</Sidebar.MenuSubButton>
											</Sidebar.MenuSubItem>
										{/each}
									</Sidebar.MenuSub>
								</Collapsible.Content>
							</Sidebar.MenuItem>
						</Collapsible.Root>
					{:else}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isNavItemActive(item, page.url.pathname)}>
								{#snippet child({ props })}
									<a href={item.url} class="font-medium" {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/if}
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<a href="/login-04" {...props}>
							<LogOutIcon />
							<span>Cerrar sesión</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
