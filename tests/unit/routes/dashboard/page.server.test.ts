import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from '../../../../src/routes/dashboard/+page.server';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));

const now = new Date('2026-10-17T01:00:00Z'); // Viernes en México; sábado en UTC.
const student = (id = 1) => ({ id, fullName: `Alumno ${id}`, phone: null, active: true });
const entitlement = (overrides = {}) => ({
	studentId: 1, entitlementType: 'monthly_plan', groupId: 1,
	startsAt: new Date('2026-10-01T18:00:00Z'), endsAt: new Date('2026-10-19T01:00:00Z'),
	hoursRemaining: null, classesRemaining: null, active: true, planName: 'Mensual', hoursIncluded: null,
	...overrides
});
const group = (overrides = {}) => ({
	id: 1, programId: 1, schedule: '18:00', days: ['Viernes'],
	startDate: null, endDate: null, isActive: true,
	programName: 'Salsa', programDescription: '', ...overrides
});

// Simula las consultas de Drizzle, manteniendo reales las transformaciones del dashboard.
function databaseWith(studentRows = [student()], entitlementRows = [entitlement()], groupRows = [group()]) {
	const select = vi.fn();
	for (const rows of [studentRows, entitlementRows, groupRows]) {
		const query = Object.assign(Promise.resolve(rows), {
			innerJoin: vi.fn(() => query), where: vi.fn(() => query)
		});
		select.mockReturnValueOnce({ from: vi.fn(() => query) });
	}
	getDb.mockReturnValue({ select });
	return select;
}
const runLoad = () => load({} as Parameters<typeof load>[0]);

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	getDb.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('carga de /dashboard', () => {
	it('devuelve listas y totales vacíos cuando no hay datos', async () => {
		databaseWith([], [], []);
		await expect(runLoad()).resolves.toEqual({ todayClasses: [], expiringPayments: [], expiringPaymentsTotal: 0, expiringFullPassPayments: [], expiringFullPassPaymentsTotal: 0 });
	});

	it('integra los planes de cada alumno con las tarjetas y las inscripciones', async () => {
		const select = databaseWith([student()], [entitlement(), entitlement({ entitlementType: 'full_pass', groupId: null, hoursRemaining: 2, hoursIncluded: 12, planName: 'Full pass' })]);
		await expect(runLoad()).resolves.toEqual({
			todayClasses: [{ id: 1, name: 'Salsa', schedule: '18:00', enrolledCount: 1 }],
			expiringPayments: [{ id: 1, fullName: 'Alumno 1', phone: null, paymentStatus: 'por_vencer', planName: 'Mensual', daysRemaining: 2 }],
			expiringPaymentsTotal: 1,
			expiringFullPassPayments: [{ id: 1, fullName: 'Alumno 1', phone: null, paymentStatus: 'por_vencer', planName: 'Full pass', hoursRemaining: 2 }],
			expiringFullPassPaymentsTotal: 1
		});
		expect(select).toHaveBeenCalledTimes(3);
	});

	it('usa el día de México, excluye clases inactivas y ordena por horario', async () => {
		databaseWith([], [], [
			group({ id: 1, schedule: '20:00' }), group({ id: 2, schedule: '09:00', programName: 'Bachata' }),
			group({ id: 3, isActive: false }), group({ id: 4, days: ['Sábado'] }), group({ id: 5, days: [] })
		]);
		await expect(runLoad()).resolves.toMatchObject({ todayClasses: [
			{ id: 2, name: 'Bachata', schedule: '09:00', enrolledCount: 0 },
			{ id: 1, name: 'Salsa', schedule: '20:00', enrolledCount: 0 }
		] });
	});

	it('cuenta una vez a cada inscrito y excluye planes mensuales vencidos', async () => {
		databaseWith([student(), student(2)], [entitlement(), entitlement(), entitlement({ studentId: 2, endsAt: now })]);
		await expect(runLoad()).resolves.toMatchObject({ todayClasses: [{ enrolledCount: 1 }], expiringPaymentsTotal: 1 });
	});

	it('limita las dos tarjetas a cinco alumnos sin recortar sus totales', async () => {
		const students = Array.from({ length: 7 }, (_, i) => student(i + 1));
		databaseWith(students, students.flatMap((s) => [
			entitlement({ studentId: s.id }),
			entitlement({ studentId: s.id, entitlementType: 'full_pass', hoursRemaining: 1, hoursIncluded: 12 })
		]), []);
		const result = await runLoad();
		expect(result).toMatchObject({ expiringPaymentsTotal: 7, expiringFullPassPaymentsTotal: 7 });
		expect(result?.expiringPayments).toHaveLength(5);
		expect(result?.expiringFullPassPayments).toHaveLength(5);
	});

	it('no incluye en las alertas derechos de alumnos ausentes de la consulta', async () => {
		databaseWith([], [entitlement()], []);
		await expect(runLoad()).resolves.toMatchObject({ expiringPayments: [], expiringFullPassPayments: [] });
	});

	it('propaga el fallo de la consulta en lugar de mostrar datos vacíos como éxito', async () => {
		const error = new Error('Base de datos no disponible');
		getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => Promise.reject(error), innerJoin: () => ({ where: () => Promise.resolve([]) }) }) }) });
		await expect(runLoad()).rejects.toBe(error);
	});
});
