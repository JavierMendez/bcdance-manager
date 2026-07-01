<script lang="ts" module>
	import type { Component } from 'svelte';
	import HomeIcon from '@lucide/svelte/icons/house';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WalletIcon from '@lucide/svelte/icons/wallet';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import UserCogIcon from '@lucide/svelte/icons/user-cog';
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import type { AppRole } from '$lib/auth/roles.js';
	import { USER_NAV_URLS } from '$lib/auth/roles.js';

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

	const baseNavItems = [
		{ title: 'Inicio', url: '/dashboard', icon: HomeIcon },
		{ title: 'Alumnos', url: '/dashboard/alumnos', icon: UsersIcon },
		{ title: 'Clases', url: '/dashboard/clases', icon: LayersIcon },
		{ title: 'Pagos', url: '/dashboard/pagos', icon: WalletIcon },
		{ title: 'Flujo de efectivo', url: '/dashboard/flujo-de-efectivo', icon: ArrowLeftRightIcon },
		{
			title: 'Configuraciones',
			url: '/dashboard/configuraciones',
			icon: SettingsIcon,
			items: [
				{ title: 'Programas', url: '/dashboard/configuraciones/programas', icon: BookOpenIcon },
				{
					title: 'Planes de pago',
					url: '/dashboard/configuraciones/planes-de-pago',
					icon: CreditCardIcon
				},
				{
					title: 'Usuarios',
					url: '/dashboard/configuraciones/usuarios',
					icon: UserCogIcon
				}
			]
		}
	] satisfies readonly NavItem[];

	export const navItems = baseNavItems;

	export function getNavItemsForRole(role: AppRole): readonly NavItem[] {
		if (role === 'admin') {
			return baseNavItems;
		}

		return baseNavItems.filter((item) => USER_NAV_URLS.has(item.url));
	}

	export function getBreadcrumb(pathname: string) {
		if (pathname === '/dashboard/clases/asistencia' || pathname === '/dashboard/grupos/asistencia') {
			return { section: 'Clases', page: 'Registrar asistencia' };
		}

		if (pathname.startsWith('/dashboard/clases/') && pathname.endsWith('/inscribir')) {
			return { section: 'Clases', page: 'Inscribir alumno' };
		}

		if (pathname.startsWith('/dashboard/clases/') && pathname !== '/dashboard/clases/asistencia') {
			return { section: 'Clases', page: 'Detalle de clase' };
		}

		if (pathname === '/dashboard/pagos/registrar') {
			return { section: 'Pagos', page: 'Registrar pago' };
		}

		if (pathname === '/dashboard/flujo-de-efectivo') {
			return { section: 'Flujo de efectivo', page: 'Flujo de efectivo' };
		}

		if (pathname === '/dashboard/configuraciones/usuarios') {
			return { section: 'Configuraciones', page: 'Usuarios' };
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
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { page } from '$app/state';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		role,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & { role: AppRole } = $props();

	const visibleNavItems = $derived(getNavItemsForRole(role));

	let openSections = $state<Record<string, boolean>>({});
	let signingOut = $state(false);

	function isSectionOpen(item: NavItem) {
		return openSections[item.url] ?? false;
	}

	async function handleSignOut() {
		signingOut = true;
		await authClient.signOut();
		signingOut = false;
		await goto('/login');
	}

	$effect(() => {
		const pathname = page.url.pathname;

		for (const item of visibleNavItems) {
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
							<img
								src="/images/bc-dance-studio-logo.jpg"
								alt="BC Dance Studio"
								class="size-8 shrink-0 rounded-lg object-cover"
							/>
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
				{#each visibleNavItems as item (item.url)}
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
						<button type="button" onclick={handleSignOut} disabled={signingOut} {...props}>
							<LogOutIcon />
							<span>{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
