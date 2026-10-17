import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Dashboard from '../../../../src/routes/dashboard/+page.svelte';
import type { PageData } from '../../../../src/routes/dashboard/$types';

// El layout aporta user y role; esta página solo consume las cinco propiedades del loader.
function dataWith(overrides: Partial<PageData> = {}): PageData {
	return { todayClasses: [], expiringPayments: [], expiringPaymentsTotal: 0,
		expiringFullPassPayments: [], expiringFullPassPaymentsTotal: 0, ...overrides } as PageData;
}
const monthlyStudent = { id: 21, fullName: 'Ana Pérez', phone: '5512345678', paymentStatus: 'por_vencer' as const, planName: 'Mensual salsa', daysRemaining: 1 };
const fullPassStudent = { id: 35, fullName: 'Luis López', phone: null, paymentStatus: 'por_vencer' as const, planName: 'Full pass 12 h', hoursRemaining: 1 };

describe('componentes de la página /dashboard', () => {
	it('muestra los tres estados vacíos y oculta acciones sin registros', async () => {
		const screen = await render(Dashboard, { data: dataWith() });
		await expect.element(screen.getByRole('heading', { name: 'Inicio' })).toBeVisible();
		for (const text of ['No hay pagos próximos a vencer.', 'No hay full pass próximos a agotarse.', 'No hay clases programadas para hoy.']) {
			await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
		}
		await expect.element(screen.getByRole('link', { name: 'Ver todos', exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('link', { name: 'Pasar lista' })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('link', { name: 'Registrar pago', exact: true })).not.toBeInTheDocument();
	});

	it.each([
		['Registrar pago', '/dashboard/pagos/registrar'],
		['Gestionar alumnos', '/dashboard/alumnos'],
		['Planes de pago', '/dashboard/configuraciones/planes-de-pago'],
		['Ver clases', '/dashboard/clases']
	])('ofrece el acceso rápido %s incluso sin datos', async (name, href) => {
		const screen = await render(Dashboard, { data: dataWith() });
		await expect.element(screen.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
	});

	it('presenta el plan, contacto, estado y enlace de pago de cada alumno', async () => {
		const screen = await render(Dashboard, { data: dataWith({ expiringPayments: [monthlyStudent], expiringPaymentsTotal: 1, expiringFullPassPayments: [fullPassStudent], expiringFullPassPaymentsTotal: 1 }) });
		for (const text of ['Ana Pérez', 'Luis López', 'Mensual salsa · Vence en 1 día', 'Full pass 12 h · Queda 1 hora']) {
			await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
		}
		await expect.element(screen.getByText('+52 55 12 34 56 78', { exact: true })).toBeVisible();
		expect(screen.getByText('Por vencer', { exact: true }).elements()).toHaveLength(2);
		const links = screen.getByRole('link', { name: 'Registrar pago', exact: true }).elements();
		expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dashboard/pagos/registrar?studentId=21', '/dashboard/pagos/registrar?studentId=35']);
		await expect.element(screen.getByRole('link', { name: 'Ver todos' })).not.toBeInTheDocument();
		await expect.element(screen.getByText('No hay pagos próximos a vencer.')).not.toBeInTheDocument();
		await expect.element(screen.getByText('No hay full pass próximos a agotarse.')).not.toBeInTheDocument();
	});

	it.each(['monthly', 'full-pass', 'both'] as const)('muestra Ver todos solo cuando existen más registros (%s)', async (section) => {
		const screen = await render(Dashboard, { data: dataWith({ expiringPayments: [monthlyStudent], expiringPaymentsTotal: section === 'full-pass' ? 1 : 6, expiringFullPassPayments: [fullPassStudent], expiringFullPassPaymentsTotal: section === 'monthly' ? 1 : 8 }) });
		const links = screen.getByRole('link', { name: 'Ver todos', exact: true }).elements();
		expect(links).toHaveLength(section === 'both' ? 2 : 1);
		for (const link of links) expect(link.getAttribute('href')).toBe('/dashboard/alumnos');
	});

	it.each([0, 1, 2])('muestra horario y pluralización con %s alumnos, y enlaza a la asistencia del grupo', async (enrolledCount) => {
		const screen = await render(Dashboard, { data: dataWith({ todayClasses: [{ id: 42, name: 'Bachata', schedule: '18:00', enrolledCount }] }) });
		await expect.element(screen.getByText('Bachata', { exact: true })).toBeVisible();
		await expect.element(screen.getByText(`18:00 · ${enrolledCount} alumno${enrolledCount === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Pasar lista', exact: true })).toHaveAttribute('href', '/dashboard/clases/asistencia?groupId=42');
		await expect.element(screen.getByText('No hay clases programadas para hoy.')).not.toBeInTheDocument();
	});

	it('maneja teléfonos ausentes y escapa el contenido de los alumnos', async () => {
		const name = '<img src=x onerror=alert(1)>';
		const screen = await render(Dashboard, { data: dataWith({ expiringPayments: [{ ...monthlyStudent, fullName: name, phone: null, daysRemaining: 0 }], expiringPaymentsTotal: 1, expiringFullPassPayments: [{ ...fullPassStudent, hoursRemaining: 0 }], expiringFullPassPaymentsTotal: 1 }) });
		await expect.element(screen.getByText(name, { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Mensual salsa · Vence hoy', { exact: true })).toBeVisible();
		await expect.element(screen.getByText('Full pass 12 h · Sin horas restantes', { exact: true })).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
		expect(screen.container.textContent).not.toMatch(/null|undefined/);
	});
});
