import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, actions } from '../../../../../src/routes/dashboard/clases/[groupId]/inscribir/+page.server';
import { actionEvent, mockDatabase } from '../../../../helpers/database';
import { groupRow, student, entitlement, monthlyPlan, fullPassPlan, dropInPlan, now } from '../../../../helpers/classes';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const plans = [monthlyPlan, fullPassPlan, dropInPlan];
const valid = { studentMode: 'existing', studentId: '1', purchaseType: 'monthly_only', groupId: '10', monthlyPlanId: '1', fullPassPlanId: '2', dropInPlanId: '3', paymentMethod: 'Efectivo', paidAt: '2026-10-16T18:00:00Z', discountPercent: '0', notes: '' };
function register(fields = valid, groupId = '10') {
	return actions.register(actionEvent(fields, groupId) as Parameters<typeof actions.register>[0]);
}
const runLoad = (groupId = '10') => load({ params: { groupId } } as Parameters<typeof load>[0]);
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('carga de inscripción', () => {
	it('prepara la clase, planes, alumnos e identificadores ya inscritos', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], [student], [groupRow], plans, [{ id: 10 }], [entitlement]).db);
		await expect(runLoad()).resolves.toMatchObject({ classGroup: { id: 10, name: 'Salsa — 18:00 - 19:00' }, students: [student], enrolledStudentIds: [1], plans });
	});
	it('maneja planes y alumnos vacíos', async () => {
		getDb.mockReturnValue(mockDatabase([groupRow], [], [], [], [{ id: 10 }], []).db);
		await expect(runLoad()).resolves.toMatchObject({ students: [], plans: [], enrolledStudentIds: [] });
	});
	it.each(['', '0', 'texto'])('rechaza identificador inválido %j antes de consultar', async (id) => {
		await expect(runLoad(id)).rejects.toMatchObject({ status: 404 });
		await expect(register(valid, id)).rejects.toMatchObject({ status: 404 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve 404 cuando la clase no existe', async () => {
		getDb.mockReturnValue(mockDatabase([], [], [], [], [], []).db);
		await expect(runLoad()).rejects.toMatchObject({ status: 404 });
	});
});

describe('registro real de inscripción con transporte de DB simulado', () => {
	it.each(['monthly_only', 'full_pass_only', 'combined', 'drop_in_only'])('registra %s y redirige al detalle', async (purchaseType) => {
		const db = mockDatabase(plans, [groupRow], [{ id: 10 }], [], [student]); getDb.mockReturnValue(db.db);
		await expect(register({ ...valid, purchaseType })).rejects.toMatchObject({ status: 303, location: '/dashboard/clases/10' });
		expect(db.db.transaction).toHaveBeenCalledOnce();
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ studentId: 1, purchaseType, totalAmount: { monthly_only: 500, full_pass_only: 700, combined: 1200, drop_in_only: 100 }[purchaseType] }));
		if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
			expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ entitlementType: 'monthly_plan', groupId: 10, startsAt: now, endsAt: new Date('2026-11-16T18:00:00Z') }));
		}
		if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
			expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ entitlementType: 'full_pass', hoursRemaining: 12 }));
		}
	});
	it('rechaza una inscripción duplicada sin escribir pagos', async () => {
		const db = mockDatabase(plans, [groupRow], [{ id: 10 }], [entitlement]); getDb.mockReturnValue(db.db);
		await expect(register()).resolves.toMatchObject({ status: 400, data: { errors: { studentId: 'Este alumno ya está inscrito en esta clase.' } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('rechaza alumno inexistente', async () => {
		const db = mockDatabase(plans, [groupRow], [{ id: 10 }], [], []); getDb.mockReturnValue(db.db);
		await expect(register()).resolves.toMatchObject({ status: 400, data: { errors: { studentId: 'El alumno no existe.' } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it.each([
		{ studentId: '' }, { monthlyPlanId: '99' }, { paymentMethod: 'Inválido' }, { discountPercent: '101' }, { paidAt: '' }
	])('rechaza datos inválidos %j sin registrar el pago', async (invalid) => {
		const db = mockDatabase(plans, [groupRow], [{ id: 10 }], []); getDb.mockReturnValue(db.db);
		await expect(register({ ...valid, ...invalid })).resolves.toMatchObject({ status: 400 });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('crea un alumno nuevo con teléfono opcional y lo inscribe', async () => {
		const db = mockDatabase(plans, [groupRow], [{ id: 10 }], [], [{ ...student, id: 100 }]); getDb.mockReturnValue(db.db);
		await expect(register({ ...valid, studentMode: 'new', ...{ newFullName: ' María ', newPhone: '' } })).rejects.toMatchObject({ status: 303 });
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'María', phone: null }));
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ studentId: 100, purchaseType: 'monthly_only' }));
	});
	it('rechaza un alumno nuevo sin nombre y con teléfono incompleto', async () => {
		const db = mockDatabase(plans, [groupRow]); getDb.mockReturnValue(db.db);
		await expect(register({ ...valid, studentMode: 'new', ...{ newFullName: '', newPhone: '55' } })).resolves.toMatchObject({ status: 400, data: { errors: { newFullName: expect.any(String), newPhone: expect.any(String) } } });
		expect(db.insertValues).not.toHaveBeenCalled();
	});
});
