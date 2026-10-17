import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from '../../../../../src/routes/dashboard/alumnos/+page.server';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const now = new Date('2026-10-16T18:00:00Z');
const row = { id: 1, guid: 'student-1', fullName: 'Ana Pérez', phone: '5512345678' as string | null, enrolledAt: now, active: true, createdAt: now, updatedAt: now };
const entitlement = (studentId = 1, days = 2) => ({ studentId, active: true, entitlementType: 'monthly_plan', endsAt: new Date(now.getTime() + days * 86_400_000), hoursRemaining: null, classesRemaining: null });
const serialized = { id: 1, guid: row.guid, fullName: row.fullName, phone: row.phone, enrolledAt: now.toISOString(), active: true };

function databaseWith(rows = [row], entitlements = [entitlement()]) {
	const query = (values: unknown[]) => {
		const result = Object.assign(Promise.resolve(values), {
			where: vi.fn(() => result), orderBy: vi.fn(() => result)
		});
		return result;
	};
	const select = vi.fn()
		.mockReturnValueOnce({ from: () => query(rows) })
		.mockReturnValueOnce({ from: () => query(entitlements) });
	const returning = vi.fn().mockResolvedValue(rows);
	const values = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
	const db = { select, insert: vi.fn(() => ({ values })), update: vi.fn(() => ({ set })) };
	getDb.mockReturnValue(db);
	return { ...db, values, set, returning };
}

function runAction(name: keyof typeof actions, fields: Record<string, string> = {}) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	const request = new Request('http://localhost/dashboard/alumnos', { method: 'POST', body: formData });
	return actions[name]({ request } as Parameters<(typeof actions)[string]>[0]);
}
const valid = { id: '1', fullName: '  Ana Pérez  ', phone: '+52 55 12 34 56 78', enrolledAt: '2026-10-16' };

beforeEach(() => {
	getDb.mockReset();
	vi.useFakeTimers();
	vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe('carga de alumnos', () => {
	it('devuelve la lista vacía', async () => {
		databaseWith([], []);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({ students: [] });
	});

	it('serializa fechas y resuelve los pagos por alumno, incluyendo inactivos y alumnos sin plan', async () => {
		databaseWith([row, { ...row, id: 2, active: false, phone: null }, { ...row, id: 3 }], [entitlement(), entitlement(2, 20), entitlement(99)]);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({ students: [
			{ ...serialized, paymentStatus: 'por_vencer' },
			{ ...serialized, id: 2, active: false, phone: null, paymentStatus: 'vigente' },
			{ ...serialized, id: 3, paymentStatus: 'vencido' }
		] });
	});

	it('considera la renovación más reciente sin duplicar al alumno', async () => {
		databaseWith([row], [entitlement(1, -1), entitlement(1, 30)]);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toMatchObject({ students: [{ ...serialized, paymentStatus: 'vigente' }] });
	});
});

describe('acciones de alumnos', () => {
	it('crea un alumno con datos normalizados y estado de pago vencido', async () => {
		const db = databaseWith();
		await expect(runAction('create', valid)).resolves.toEqual({ success: true, mode: 'create', student: { ...serialized, paymentStatus: 'vencido' } });
		expect(db.values).toHaveBeenCalledExactlyOnceWith({ fullName: 'Ana Pérez', phone: '5512345678', enrolledAt: new Date('2026-10-16T12:00:00Z'), updatedAt: now });
	});

	it('crea sin teléfono guardando null', async () => {
		const db = databaseWith([{ ...row, phone: null }]);
		await runAction('create', { ...valid, phone: '' });
		expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
	});

	it.each(['create', 'update'] as const)('rechaza datos inválidos en %s sin consultar la base de datos', async (action) => {
		await expect(runAction(action, { id: '1', fullName: ' ', phone: '55', enrolledAt: '' })).resolves.toMatchObject({ status: 400, data: { mode: action === 'create' ? 'create' : 'edit', errors: { fullName: 'El nombre completo es obligatorio.', phone: 'El teléfono debe tener 10 dígitos.', enrolledAt: 'La fecha de inscripción es obligatoria.' } } });
		expect(getDb).not.toHaveBeenCalled();
	});

	it.each(['update', 'toggleActive'] as const)('rechaza identificadores vacíos, cero o texto en %s', async (action) => {
		for (const id of ['', '0', 'abc']) {
			await expect(runAction(action, { ...valid, id })).resolves.toMatchObject({ status: 400, data: { message: 'Alumno no válido.' } });
		}
		expect(getDb).not.toHaveBeenCalled();
	});

	it('actualiza los datos y recalcula el estado de pago', async () => {
		const db = databaseWith();
		// La edición solo hace una consulta select para los derechos.
		db.select.mockReset().mockReturnValue({ from: () => ({ where: () => Promise.resolve([entitlement()]) }) });
		await expect(runAction('update', valid)).resolves.toEqual({ success: true, mode: 'edit', student: { ...serialized, paymentStatus: 'por_vencer' } });
		expect(db.set).toHaveBeenCalledWith({ fullName: 'Ana Pérez', phone: '5512345678', enrolledAt: new Date('2026-10-16T12:00:00Z'), updatedAt: now });
	});

	it.each(['update', 'toggleActive'] as const)('devuelve 404 cuando el alumno no existe en %s', async (action) => {
		const db = databaseWith([]);
		await expect(runAction(action, valid)).resolves.toMatchObject({ status: 404, data: { message: 'Alumno no encontrado.' } });
		expect(db.select).not.toHaveBeenCalled();
	});

	it.each([true, false])('cambia el estado a %s conservando el estado de pago', async (active) => {
		const db = databaseWith([{ ...row, active }]);
		db.select.mockReset().mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) });
		await expect(runAction('toggleActive', { id: '1', active: String(active) })).resolves.toEqual({ success: true, student: { ...serialized, active, paymentStatus: 'vencido' } });
		expect(db.set).toHaveBeenCalledExactlyOnceWith({ active, updatedAt: now });
	});

	it.each(['create', 'update', 'toggleActive'] as const)('propaga fallos de escritura en %s', async (action) => {
		const db = databaseWith();
		const error = new Error('Escritura no disponible');
		db.returning.mockRejectedValueOnce(error);
		await expect(runAction(action, valid)).rejects.toBe(error);
	});
});
