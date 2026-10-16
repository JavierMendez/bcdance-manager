import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LoginForm from '$lib/components/login-form.svelte';

type AuthError = { code?: string; message?: string };
type SignInResult = { error: AuthError | null };

const { signIn, goto } = vi.hoisted(() => ({
	signIn: vi.fn<(credentials: {
		email: string;
		password: string;
		callbackURL: string;
	}) => Promise<SignInResult>>(),
	goto: vi.fn<(url: string) => Promise<void>>()
}));

vi.mock('$lib/auth-client.js', () => ({
	authClient: { signIn: { email: signIn } }
}));

vi.mock('$app/navigation', () => ({ goto }));

async function renderLogin() {
	const screen = await render(LoginForm);
	return {
		screen,
		email: screen.getByLabelText('Email', { exact: true }),
		password: screen.getByLabelText('Password', { exact: true }),
		submit: screen.getByRole('button', { name: 'Iniciar sesión', exact: true })
	};
}

async function fillCredentials(form: Awaited<ReturnType<typeof renderLogin>>) {
	await form.email.fill('alumno@example.com');
	await form.password.fill('contraseña-segura');
}

beforeEach(() => {
	signIn.mockReset();
	goto.mockReset();
	signIn.mockResolvedValue({ error: null });
	goto.mockResolvedValue();
});

describe('formulario de login', () => {
	it('muestra los campos requeridos y oculta la contraseña', async () => {
		const form = await renderLogin();
		await expect.element(form.email).toHaveAttribute('type', 'email');
		await expect.element(form.email).toBeRequired();
		await expect.element(form.password).toHaveAttribute('type', 'password');
		await expect.element(form.password).toBeRequired();
		await expect.element(form.submit).toBeEnabled();
		await expect.element(form.screen.getByRole('alert')).not.toBeInTheDocument();
		expect(signIn).not.toHaveBeenCalled();
	});

	it.each([
		{ nombre: 'campos vacíos', email: '', password: '' },
		{ nombre: 'email vacío', email: '', password: 'contraseña-segura' },
		{ nombre: 'contraseña vacía', email: 'alumno@example.com', password: '' },
		{ nombre: 'email inválido', email: 'email-invalido', password: 'contraseña-segura' }
	])('impide enviar con $nombre', async ({ email, password }) => {
		const form = await renderLogin();
		await form.email.fill(email);
		await form.password.fill(password);
		await form.submit.click();
		expect(signIn).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
		await expect.element(form.submit).toBeEnabled();
	});

	it('envía las credenciales y navega al dashboard cuando la autenticación funciona', async () => {
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();
		await expect.poll(() => goto.mock.calls).toEqual([['/dashboard']]);
		expect(signIn).toHaveBeenCalledExactlyOnceWith({
			email: 'alumno@example.com',
			password: 'contraseña-segura',
			callbackURL: '/dashboard'
		});
	});

	it('bloquea los controles durante el envío y los habilita al terminar', async () => {
		let resolveSignIn!: (result: SignInResult) => void;
		signIn.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveSignIn = resolve;
			})
		);
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();

		await expect.element(form.email).toBeDisabled();
		await expect.element(form.password).toBeDisabled();
		const pending = form.screen.getByRole('button', { name: 'Iniciando sesión...' });
		await expect.element(pending).toBeDisabled();
		expect(signIn).toHaveBeenCalledTimes(1);
		expect(goto).not.toHaveBeenCalled();

		resolveSignIn({ error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
		await expect.element(form.email).toBeEnabled();
		await expect.element(form.password).toBeEnabled();
		await expect.element(form.submit).toBeEnabled();
	});

	it.each([
		['INVALID_EMAIL_OR_PASSWORD', 'Email o contraseña incorrectos.'],
		['USER_BANNED', 'Tu cuenta ha sido suspendida. Contacta al administrador.'],
		['EMAIL_PASSWORD_SIGN_UP_DISABLED', 'El registro no está disponible.'],
		['INVALID_EMAIL', 'El email no es válido.'],
		['INVALID_PASSWORD', 'La contraseña no es válida.']
	])('muestra el mensaje en español para %s', async (code, message) => {
		signIn.mockResolvedValueOnce({ error: { code, message: 'Mensaje del proveedor' } });
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();
		await expect.element(form.screen.getByRole('alert')).toHaveTextContent(message);
		await expect.element(form.submit).toBeEnabled();
		expect(goto).not.toHaveBeenCalled();
	});

	it('muestra el mensaje del proveedor cuando el código es desconocido', async () => {
		signIn.mockResolvedValueOnce({
			error: { code: 'UNKNOWN_ERROR', message: 'Servicio temporalmente no disponible.' }
		});
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();
		await expect.element(form.screen.getByRole('alert')).toHaveTextContent(
			'Servicio temporalmente no disponible.'
		);
		expect(goto).not.toHaveBeenCalled();
	});

	it('muestra un mensaje genérico cuando el error no contiene mensaje ni código', async () => {
		signIn.mockResolvedValueOnce({ error: {} });
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();
		await expect.element(form.screen.getByRole('alert')).toHaveTextContent(
			'No se pudo iniciar sesión. Inténtalo de nuevo.'
		);
		expect(goto).not.toHaveBeenCalled();
	});

	it('limpia el error anterior al reintentar y permite iniciar sesión', async () => {
		let resolveRetry!: (result: SignInResult) => void;
		signIn
			.mockResolvedValueOnce({ error: { code: 'INVALID_EMAIL_OR_PASSWORD' } })
			.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveRetry = resolve;
				})
			);
		const form = await renderLogin();
		await fillCredentials(form);
		await form.submit.click();
		await expect.element(form.screen.getByRole('alert')).toBeVisible();

		await form.password.fill('contraseña-corregida');
		await form.submit.click();
		await expect.element(form.screen.getByRole('alert')).not.toBeInTheDocument();
		expect(signIn).toHaveBeenNthCalledWith(2, {
			email: 'alumno@example.com',
			password: 'contraseña-corregida',
			callbackURL: '/dashboard'
		});

		resolveRetry({ error: null });
		await expect.poll(() => goto.mock.calls).toEqual([['/dashboard']]);
	});
});
