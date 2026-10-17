import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, actions } from '../../../../../src/routes/dashboard/pagos/registrar/+page.server';
import { mockDatabase, actionEvent } from '../../../../helpers/database';
import { wizardProps, wizardValues } from '../../../../helpers/payments';
import { student, groupRow, monthlyPlan, fullPassPlan, dropInPlan, now } from '../../../../helpers/classes';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const plans = wizardProps.plans;
const runLoad = () => load({} as Parameters<typeof load>[0]);
function register(fields: Record<string, string> = { ...wizardValues }) {
	return actions.register({ request: actionEvent(fields).request } as Parameters<typeof actions.register>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('catálogos de registro de pagos', () => {
	it('carga alumnos, clases con horario, planes y métodos de pago', async () => {
		getDb.mockReturnValue(mockDatabase([student], [groupRow], plans).db);
		await expect(runLoad()).resolves.toEqual({ ...wizardProps, courses: [{ id: 10, name: 'Salsa — 18:00 - 19:00' }] });
	});
	it('permite catálogos vacíos', async () => {
		getDb.mockReturnValue(mockDatabase([], [], []).db);
		await expect(runLoad()).resolves.toMatchObject({ students: [], courses: [], plans: [] });
	});
});

describe('registro de pagos con el helper real', () => {
	it.each(['monthly_only', 'full_pass_only', 'combined', 'drop_in_only'] as const)('registra %s con alumno y redirige al historial', async (purchaseType) => {
		const db = mockDatabase(plans, [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, purchaseType, fullPassPlanId: '2', dropInPlanId: '3', notes: '  renovación  ' })).rejects.toMatchObject({ status: 303, location: '/dashboard/pagos' });
		expect(db.db.transaction).toHaveBeenCalledOnce();
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ studentId: 1, purchaseType, notes: 'renovación', totalAmount: { monthly_only: 500, full_pass_only: 700, combined: 1200, drop_in_only: 100 }[purchaseType] }));
		expect(db.select).toHaveBeenCalledTimes(3);
	});
	it('registra clase suelta sin alumno creando solo pago y partida', async () => {
		const db = mockDatabase(plans, [groupRow]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, studentId: '', purchaseType: 'drop_in_only', dropInPlanId: '3' })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledTimes(2);
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ studentId: null, totalAmount: 100, notes: null }));
	});
	it.each(['monthly_only', 'full_pass_only', 'combined'] as const)('rechaza %s sin alumno', async (purchaseType) => {
		const db = mockDatabase(plans, [groupRow]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, purchaseType, studentId: '', fullPassPlanId: '2' })).resolves.toMatchObject({ status: 400, data: { errors: { studentId: expect.any(String) } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it.each([
		{ monthlyPlanId: '2' }, { monthlyPlanId: '99' }, { courseId: '99' },
		{ paymentMethod: 'Bitcoin' }, { purchaseType: 'otro' }, { discountPercent: '101' }, { paidAt: '' }
	])('rechaza campos inválidos %j sin escribir', async (invalid) => {
		const db = mockDatabase(plans, [groupRow]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, ...invalid })).resolves.toMatchObject({ status: 400 });
		expect(db.insertValues).not.toHaveBeenCalled();
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('rechaza al alumno que ya no existe', async () => {
		const db = mockDatabase(plans, [groupRow], []); getDb.mockReturnValue(db.db);
		await expect(register()).resolves.toMatchObject({ status: 400, data: { errors: { studentId: 'El alumno no existe.' } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it.each([0, 100])('acepta el descuento límite %s sin modificar el precio de la partida', async (discount) => {
		const db = mockDatabase(plans, [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, discountPercent: String(discount) })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ subtotalAmount: 500, discountPercent: discount, totalAmount: discount === 100 ? 0 : 500 }));
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'monthly_plan', amount: 500 }));
	});
	it('crea vigencia mensual con inicio en la fecha del pago', async () => {
		const db = mockDatabase(plans, [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, paidAt: '2026-09-16T18:00:00Z' })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ entitlementType: 'monthly_plan', groupId: 10, startsAt: new Date('2026-09-16T18:00:00Z'), endsAt: now }));
	});
	it('calcula el importe desde el catálogo e ignora montos enviados por el cliente', async () => {
		const db = mockDatabase(plans, [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, subtotalAmount: '1', totalAmount: '1', amount: '1' })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ subtotalAmount: 500, totalAmount: 500 }));
	});
	it.each([null, 24])('asigna las horas del full pass con hoursIncluded=%s', async (hoursIncluded) => {
		const db = mockDatabase([monthlyPlan, { ...fullPassPlan, hoursIncluded }, dropInPlan], [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, purchaseType: 'full_pass_only', fullPassPlanId: '2' })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ entitlementType: 'full_pass', hoursRemaining: hoursIncluded ?? 12 }));
	});
	it.each([null, 5])('asigna créditos por clase con classesIncluded=%s', async (classesIncluded) => {
		const db = mockDatabase([monthlyPlan, fullPassPlan, { ...dropInPlan, classesIncluded }], [groupRow], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...wizardValues, purchaseType: 'drop_in_only', dropInPlanId: '3' })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ entitlementType: 'drop_in', classesRemaining: classesIncluded ?? 1, groupId: 10 }));
	});
	it('propaga errores de transacción sin redirigir como éxito', async () => {
		const db = mockDatabase(plans, [groupRow], [student]); getDb.mockReturnValue(db.db);
		const error = new Error('No se pudo persistir el pago');
		db.db.transaction.mockRejectedValueOnce(error);
		await expect(register()).rejects.toBe(error);
	});
});
