<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldError
	} from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';

	type AppUser = {
		id: string;
		name: string;
		email: string;
		role?: string | null;
		banned?: boolean | null;
		createdAt: Date | string;
	};

	let users = $state<AppUser[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let createOpen = $state(false);
	let editOpen = $state(false);
	let editingUser = $state<AppUser | null>(null);
	let submitting = $state(false);
	let actionError = $state('');
	let deleteConfirmOpen = $state(false);
	let pendingDeleteUser = $state<AppUser | null>(null);

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let role = $state<'admin' | 'user'>('user');
	let editName = $state('');

	const formId = $props.id();

	async function loadUsers() {
		loading = true;
		errorMessage = '';

		const { data, error } = await authClient.admin.listUsers({
			query: {
				limit: 100,
				sortBy: 'createdAt',
				sortDirection: 'desc'
			}
		});

		loading = false;

		if (error) {
			errorMessage = error.message ?? 'No se pudieron cargar los usuarios.';
			return;
		}

		users = (data?.users ?? []) as AppUser[];
	}

	$effect(() => {
		void loadUsers();
	});

	function resetCreateForm() {
		name = '';
		email = '';
		password = '';
		role = 'user';
		actionError = '';
	}

	function handleCreateOpenChange(open: boolean) {
		createOpen = open;
		if (!open) {
			resetCreateForm();
		}
	}

	function openEditDialog(user: AppUser) {
		editingUser = user;
		editName = user.name;
		actionError = '';
		editOpen = true;
	}

	function handleEditOpenChange(open: boolean) {
		editOpen = open;
		if (!open) {
			editingUser = null;
			editName = '';
			actionError = '';
		}
	}

	async function handleEditUser(event: SubmitEvent) {
		event.preventDefault();
		if (!editingUser) return;

		submitting = true;
		actionError = '';

		const { error } = await authClient.admin.updateUser({
			userId: editingUser.id,
			data: { name: editName.trim() }
		});

		submitting = false;

		if (error) {
			actionError = error.message ?? 'No se pudo actualizar el nombre.';
			return;
		}

		editOpen = false;
		editingUser = null;
		editName = '';
		await loadUsers();
	}

	async function handleCreateUser(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		actionError = '';

		const { error } = await authClient.admin.createUser({
			name,
			email,
			password,
			role
		});

		submitting = false;

		if (error) {
			actionError = error.message ?? 'No se pudo crear el usuario.';
			return;
		}

		createOpen = false;
		resetCreateForm();
		await loadUsers();
	}

	async function handleSetRole(userId: string, nextRole: 'admin' | 'user') {
		actionError = '';
		const { error } = await authClient.admin.setRole({ userId, role: nextRole });

		if (error) {
			actionError = error.message ?? 'No se pudo cambiar el rol.';
			return;
		}

		await loadUsers();
	}

	async function handleBanToggle(user: AppUser) {
		actionError = '';
		const { error } = user.banned
			? await authClient.admin.unbanUser({ userId: user.id })
			: await authClient.admin.banUser({ userId: user.id, banReason: 'Suspendido por administrador' });

		if (error) {
			actionError = error.message ?? 'No se pudo actualizar el estado del usuario.';
			return;
		}

		await loadUsers();
	}

	function requestRemoveUser(user: AppUser) {
		pendingDeleteUser = user;
		deleteConfirmOpen = true;
	}

	async function confirmRemoveUser() {
		if (!pendingDeleteUser) return false;

		actionError = '';
		const { error } = await authClient.admin.removeUser({ userId: pendingDeleteUser.id });

		if (error) {
			actionError = error.message ?? 'No se pudo eliminar el usuario.';
			return false;
		}

		pendingDeleteUser = null;
		await loadUsers();
	}

	function handleDeleteOpenChange(open: boolean) {
		if (!open) {
			pendingDeleteUser = null;
		}
	}

	function formatRole(userRole?: string | null) {
		return userRole === 'admin' ? 'Administrador' : 'Usuario';
	}
</script>

<div class="flex flex-1 flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Usuarios</h2>
			<p class="text-muted-foreground text-sm">
				Administra las cuentas de acceso a la aplicación.
			</p>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<PlusIcon data-icon="inline-start" />
			Nuevo usuario
		</Button>
	</div>

	{#if actionError}
		<p class="text-destructive text-sm">{actionError}</p>
	{/if}

	<div class="rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Nombre</Table.Head>
					<Table.Head>Email</Table.Head>
					<Table.Head>Rol</Table.Head>
					<Table.Head>Estado</Table.Head>
					<Table.Head class="text-end">Acciones</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if loading}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground py-8 text-center">
							Cargando usuarios...
						</Table.Cell>
					</Table.Row>
				{:else if errorMessage}
					<Table.Row>
						<Table.Cell colspan={5} class="text-destructive py-8 text-center">
							{errorMessage}
						</Table.Cell>
					</Table.Row>
				{:else if users.length === 0}
					<Table.Row>
						<Table.Cell colspan={5} class="text-muted-foreground py-8 text-center">
							No hay usuarios registrados.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each users as user (user.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{user.name}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>
								<Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
									{formatRole(user.role)}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if user.banned}
									<Badge variant="destructive">Suspendido</Badge>
								{:else}
									<Badge variant="outline">Activo</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<div class="flex justify-end gap-2">
									<Button variant="outline" size="sm" onclick={() => openEditDialog(user)}>
										<PencilIcon data-icon="inline-start" />
										Editar
									</Button>
									{#if user.role === 'admin'}
										<Button
											variant="outline"
											size="sm"
											onclick={() => handleSetRole(user.id, 'user')}
										>
											Hacer usuario
										</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											onclick={() => handleSetRole(user.id, 'admin')}
										>
											<ShieldCheckIcon data-icon="inline-start" />
											Hacer admin
										</Button>
									{/if}
									<Button variant="outline" size="sm" onclick={() => handleBanToggle(user)}>
										<BanIcon data-icon="inline-start" />
										{user.banned ? 'Reactivar' : 'Suspender'}
									</Button>
									<Button variant="destructive" size="sm" onclick={() => requestRemoveUser(user)}>
										<Trash2Icon data-icon="inline-start" />
										Eliminar
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<Dialog.Root open={createOpen} onOpenChange={handleCreateOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Nuevo usuario</Dialog.Title>
			<Dialog.Description>
				Crea una cuenta con acceso a la aplicación. El registro público está deshabilitado.
			</Dialog.Description>
		</Dialog.Header>

		<form id="create-user-form-{formId}" onsubmit={handleCreateUser}>
			<FieldGroup>
				{#if actionError && createOpen}
					<FieldError>{actionError}</FieldError>
				{/if}
				<Field>
					<FieldLabel for="name-{formId}">Nombre</FieldLabel>
					<Input id="name-{formId}" bind:value={name} required disabled={submitting} />
				</Field>
				<Field>
					<FieldLabel for="email-{formId}">Email</FieldLabel>
					<Input
						id="email-{formId}"
						type="email"
						bind:value={email}
						required
						disabled={submitting}
					/>
				</Field>
				<Field>
					<FieldLabel for="password-{formId}">Contraseña</FieldLabel>
					<Input
						id="password-{formId}"
						type="password"
						bind:value={password}
						required
						minlength={8}
						disabled={submitting}
					/>
				</Field>
				<Field>
					<FieldLabel for="role-{formId}">Rol</FieldLabel>
					<select
						id="role-{formId}"
						bind:value={role}
						disabled={submitting}
						class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="user">Usuario</option>
						<option value="admin">Administrador</option>
					</select>
				</Field>
			</FieldGroup>
		</form>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => handleCreateOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="create-user-form-{formId}" disabled={submitting}>
				{submitting ? 'Creando...' : 'Crear usuario'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={editOpen} onOpenChange={handleEditOpenChange}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Editar usuario</Dialog.Title>
			<Dialog.Description>
				Actualiza el nombre de {editingUser?.email ?? 'este usuario'}.
			</Dialog.Description>
		</Dialog.Header>

		<form id="edit-user-form-{formId}" onsubmit={handleEditUser}>
			<FieldGroup>
				{#if actionError && editOpen}
					<FieldError>{actionError}</FieldError>
				{/if}
				<Field>
					<FieldLabel for="edit-name-{formId}">Nombre</FieldLabel>
					<Input
						id="edit-name-{formId}"
						bind:value={editName}
						required
						disabled={submitting}
					/>
				</Field>
			</FieldGroup>
		</form>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => handleEditOpenChange(false)} disabled={submitting}>
				Cancelar
			</Button>
			<Button type="submit" form="edit-user-form-{formId}" disabled={submitting}>
				{submitting ? 'Guardando...' : 'Guardar cambios'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<ConfirmDialog
	bind:open={deleteConfirmOpen}
	title={pendingDeleteUser ? `¿Eliminar al usuario ${pendingDeleteUser.name}?` : '¿Eliminar usuario?'}
	onConfirm={confirmRemoveUser}
	onOpenChange={handleDeleteOpenChange}
/>
