import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, actions } from '../../../../../src/routes/dashboard/clases/asistencia/+page.server';
import { actionEvent, mockDatabase } from '../../../../helpers/database';
import { entitlement, groupRow, dropInPlan, student, now } from '../../../../helpers/classes';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const base = { groupId: '10', sessionDate: '2026-10-16', entries: JSON.stringify([{ studentId: 1, entitlementId: 20, status: 'attended' }]) };
function save(fields = base) {
	return actions.save({ request: actionEvent(fields).request } as Parameters<typeof actions.save>[0]);
}
const quick = { groupId: '10', sessionDate: '2026-10-16', studentId: '', dropInPlanId: '3', paymentMethod: 'Efectivo', discountPercent: '0', notes: '' };
function register(fields = quick) {
	return actions.registerDropIn({ request: actionEvent(fields).request } as Parameters<typeof actions.registerDropIn>[0]);
}
function runLoad(search = '?groupId=10&date=2026-10-16') {
	return load({ url: new URL(`http://localhost/dashboard/clases/asistencia${search}`) } as Parameters<typeof load>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('carga de asistencia', () => {
	it.each(['', '?groupId=texto', '?groupId=-1'])('maneja selección inválida %j sin cargar derechos', async (search) => {
		const db = mockDatabase([groupRow]); getDb.mockReturnValue(db.db);
		await expect(runLoad(search)).resolves.toMatchObject({ course: null, attendanceEditable: false, members: [], sessionDate: '2026-10-16' });
		expect(db.select).toHaveBeenCalledTimes(1);
	});
	it('maneja clase inexistente y fecha mal formada usando el día actual', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], []).db);
		await expect(runLoad('?groupId=10&date=incorrecta')).resolves.toMatchObject({ course: null, sessionDate: '2026-10-16' });
	});
	it('integra alumnos, marcas y planes y excluye inscritos del registro rápido', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], [groupRow], [entitlement], [{ studentId: 1, status: 'attended' }], [student, { ...student, id: 2 }], [dropInPlan], []).db);
		const result = await runLoad();
		expect(result).toMatchObject({ course: { id: 10 }, attendanceEditable: true, members: [{ studentId: 1, currentStatus: 'attended' }], eligibleStudents: [{ id: 2 }], dropInPlans: [dropInPlan] });
	});
	it('permite consultar una clase inactiva con edición bloqueada', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], [{ ...groupRow, isActive: false }], [], [], [], [], []).db);
		await expect(runLoad()).resolves.toMatchObject({ attendanceEditable: false, attendanceValidationError: expect.stringContaining('desactivada') });
	});
});

describe('guardar asistencia', () => {
	it.each([
		{ ...base, groupId: '' }, { ...base, entries: 'no-json' },
		{ ...base, entries: '[]' }, { ...base, entries: '[null]' }
	])('rechaza datos inválidos antes de consultar DB (%j)', async (fields) => {
		await expect(save(fields)).resolves.toMatchObject({ status: 400 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve 404 al guardar en una clase inexistente', async () => {
		getDb.mockReturnValue(mockDatabase([]).db);
		await expect(save()).resolves.toMatchObject({ status: 404 });
	});
	it.each([
		{ ...groupRow, isActive: false }, { ...groupRow, startDate: '2026-10-17' }, { ...groupRow, endDate: '2026-10-15' }
	])('rechaza clases inactivas o fechas fuera de rango sin abrir transacción', async (group) => {
		const db = mockDatabase([group]); getDb.mockReturnValue(db.db);
		await expect(save()).resolves.toMatchObject({ status: 400 });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('registra una mensualidad sin descontar saldo y redirige a la sesión', async () => {
		const db = mockDatabase([groupRow], [entitlement], []); getDb.mockReturnValue(db.db);
		await expect(save()).rejects.toMatchObject({ status: 303, location: '/dashboard/clases/asistencia?groupId=10&date=2026-10-16&saved=1' });
		expect(db.set).not.toHaveBeenCalled();
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'attended', entitlementType: 'monthly_plan', hoursDeducted: 0, classesDeducted: 0 }));
	});
	it.each(['monthly_plan', 'drop_in'])('rechaza una vigencia %s perteneciente a otra clase', async (entitlementType) => {
		const db = mockDatabase([groupRow], [{ ...entitlement, groupId: 99, entitlementType }]); getDb.mockReturnValue(db.db);
		await expect(save()).resolves.toMatchObject({ status: 400, data: { message: expect.stringContaining('no corresponde') } });
		expect(db.insertValues).not.toHaveBeenCalled();
	});
	it('rechaza vigencias no encontradas o ajenas al alumno', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], []).db);
		await expect(save()).resolves.toMatchObject({ status: 400, data: { message: 'Vigencia no válida para el alumno 1.' } });
	});
	it.each(['full_pass', 'drop_in'])('descuenta una unidad de %s al asistir', async (entitlementType) => {
		const db = mockDatabase([groupRow], [{ ...entitlement, entitlementType, hoursRemaining: 1, classesRemaining: 1 }], []); getDb.mockReturnValue(db.db);
		await expect(save()).rejects.toMatchObject({ status: 303 });
		expect(db.set).toHaveBeenCalledExactlyOnceWith(entitlementType === 'full_pass' ? { hoursRemaining: 0 } : { classesRemaining: 0 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ hoursDeducted: entitlementType === 'full_pass' ? 1 : 0, classesDeducted: entitlementType === 'drop_in' ? 1 : 0 }));
	});
	it.each(['full_pass', 'drop_in'])('no vuelve a descontar %s al guardar la misma asistencia', async (entitlementType) => {
		const existing = { id: 30, status: 'attended', hoursDeducted: entitlementType === 'full_pass' ? 1 : 0, classesDeducted: entitlementType === 'drop_in' ? 1 : 0 };
		const db = mockDatabase([groupRow], [{ ...entitlement, entitlementType, hoursRemaining: 0, classesRemaining: 0 }], [existing]); getDb.mockReturnValue(db.db);
		await expect(save()).rejects.toMatchObject({ status: 303 });
		expect(db.set).toHaveBeenCalledTimes(1);
		expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'attended' }));
		expect(db.set.mock.calls[0][0]).not.toHaveProperty('hoursRemaining');
		expect(db.set.mock.calls[0][0]).not.toHaveProperty('classesRemaining');
	});
	it.each(['full_pass', 'drop_in'])('restituye el saldo de %s al corregir asistencia a falta', async (entitlementType) => {
		const existing = { id: 30, status: 'attended', hoursDeducted: entitlementType === 'full_pass' ? 1 : 0, classesDeducted: entitlementType === 'drop_in' ? 1 : 0 };
		const db = mockDatabase([groupRow], [{ ...entitlement, entitlementType, hoursRemaining: 0, classesRemaining: 0 }], [existing]); getDb.mockReturnValue(db.db);
		await expect(save({ ...base, entries: JSON.stringify([{ studentId: 1, entitlementId: 20, status: 'absent' }]) })).rejects.toMatchObject({ status: 303 });
		expect(db.set).toHaveBeenCalledWith(entitlementType === 'full_pass' ? { hoursRemaining: 1 } : { classesRemaining: 1 });
		expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'absent', hoursDeducted: 0, classesDeducted: 0 }));
	});
	it('rechaza full pass con horas fraccionarias insuficientes sin escribir', async () => {
		const db = mockDatabase([groupRow], [{ ...entitlement, entitlementType: 'full_pass', hoursRemaining: 0.5 }], []); getDb.mockReturnValue(db.db);
		await expect(save()).resolves.toMatchObject({ status: 400, data: { message: expect.stringContaining('horas suficientes') } });
		expect(db.set).not.toHaveBeenCalled();
		expect(db.insertValues).not.toHaveBeenCalled();
	});
	it('convierte un fallo de transacción en una respuesta de error', async () => {
		const db = mockDatabase([groupRow]); getDb.mockReturnValue(db.db);
		db.db.transaction.mockRejectedValueOnce(new Error('Fallo al guardar'));
		await expect(save()).resolves.toMatchObject({ status: 400, data: { message: 'Fallo al guardar' } });
	});
});

describe('registro rápido de pago por clase', () => {
	it.each([false, true])('registra con alumno=%s y aplica descuento dentro de la transacción', async (withStudent) => {
		const db = mockDatabase([groupRow], [student], [dropInPlan], [], []); getDb.mockReturnValue(db.db);
		await expect(register({ ...quick, studentId: withStudent ? '1' : '', discountPercent: '100' })).rejects.toMatchObject({ status: 303, location: `/dashboard/clases/asistencia?groupId=10&date=2026-10-16&saved=1&dropIn=1${withStudent ? '&attended=1' : ''}` });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ studentId: withStudent ? 1 : null, totalAmount: 0, discountPercent: 100 }));
		expect(db.insertValues).toHaveBeenCalledTimes(withStudent ? 4 : 2);
		if (withStudent) expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'attended', classesDeducted: 1 }));
	});
	it.each(['-1', '101', '1.5', 'texto'])('rechaza descuento inválido %s sin escribir', async (discountPercent) => {
		const db = mockDatabase([groupRow], [], [dropInPlan], [], []); getDb.mockReturnValue(db.db);
		await expect(register({ ...quick, discountPercent })).resolves.toMatchObject({ status: 400, data: { errors: { discountPercent: expect.any(String) } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('rechaza alumnos que ya tienen asistencia en la sesión', async () => {
		const db = mockDatabase([groupRow], [student], [dropInPlan], [], [{ studentId: 1, status: 'attended' }]); getDb.mockReturnValue(db.db);
		await expect(register({ ...quick, studentId: '1' })).resolves.toMatchObject({ status: 400, data: { errors: { studentId: expect.any(String) } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('rechaza planes sin créditos suficientes para registrar al alumno', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], [student], [{ ...dropInPlan, classesIncluded: 0 }], [], []).db);
		await expect(register({ ...quick, studentId: '1' })).resolves.toMatchObject({ status: 400, data: { errors: { dropInPlanId: expect.stringContaining('clases suficientes') } } });
	});
	it('rechaza identificador inválido antes de acceder a la base de datos', async () => {
		await expect(register({ ...quick, groupId: '0' })).resolves.toMatchObject({ status: 400 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve errores de la transacción sin redirigir', async () => {
		const db = mockDatabase([groupRow], [], [dropInPlan], [], []); getDb.mockReturnValue(db.db);
		db.db.transaction.mockRejectedValueOnce(new Error('Pago no guardado'));
		await expect(register()).resolves.toMatchObject({ status: 400, data: { message: 'Pago no guardado', mode: 'registerDropIn' } });
	});
});
