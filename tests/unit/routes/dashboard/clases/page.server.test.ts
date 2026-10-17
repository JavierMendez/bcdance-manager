import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load, actions } from '../../../../../src/routes/dashboard/clases/+page.server';
import { load as loadDetail, actions as detailActions } from '../../../../../src/routes/dashboard/clases/[groupId]/+page.server';
import { actionEvent, mockDatabase, queryRows } from '../../../../helpers/database';
import { classGroup, entitlement, groupRow, programs, now } from '../../../../helpers/classes';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('$lib/server/db/index.js', () => ({ getDb }));
const valid = { programId: '1', programSelection: '1', schedule: ' 18:00 - 19:00 ', days: ['Lunes', 'Viernes'], startDate: '', endDate: '', isActive: 'true' };
function create(fields = valid) {
	return actions.createClass({ request: actionEvent(fields).request } as Parameters<typeof actions.createClass>[0]);
}
function update(fields = valid, id = '10') {
	return detailActions.updateClass(actionEvent(fields, id) as Parameters<typeof detailActions.updateClass>[0]);
}
function detail(id = '10') {
	return loadDetail({ params: { groupId: id } } as Parameters<typeof loadDetail>[0]);
}
beforeEach(() => { getDb.mockReset(); vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('carga del listado y detalle de clases', () => {
	it('devuelve listados y contadores vacíos', async () => {
		getDb.mockReturnValue(mockDatabase([], [], [], [], []).db);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({ groups: [], activeClassCount: 0, enrolledStudentCount: 0, fullPassStudentCount: 0, programs: [] });
	});
	it('ordena activas primero, agrupa inscripciones y calcula los contadores de sesión', async () => {
		getDb.mockReturnValue(mockDatabase(
			[{ ...groupRow, id: 11, isActive: false, programName: 'Bachata' }, groupRow],
			[entitlement], [], programs, [{ groupId: 10, studentId: 1, entitlementType: 'full_pass' }]
		).db);
		const result = await load({} as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ activeClassCount: 1, enrolledStudentCount: 1, fullPassStudentCount: 0 });
		expect(result?.groups.map((g: { id: number }) => g.id)).toEqual([10, 11]);
		expect(result?.groups[0]).toMatchObject({ enrolledCount: 1, fullPassCount: 1 });
	});
	it('carga el detalle con alumnos e ingresos propios', async () => {
		const payment = { groupId: 10, paymentId: 3, studentName: null, planName: 'Suelta', totalAmount: 100, paymentMethod: 'Efectivo', classesGranted: 1, paidAt: now };
		getDb.mockReturnValue(mockDatabase([groupRow], [entitlement], [payment, { ...payment, paymentId: 4, groupId: 99 }], programs).db);
		const result = await detail();
		expect(result).toMatchObject({ classGroup: { id: 10, enrolledCount: 1, dropInCount: 1 }, programs });
		expect(result?.classGroup.dropInPayments).toHaveLength(1);
	});
	it.each(['', '0', 'texto'])('rechaza detalle con identificador %j sin consultar DB', async (id) => {
		await expect(detail(id)).rejects.toMatchObject({ status: 404 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('devuelve 404 cuando no existe la clase', async () => {
		getDb.mockReturnValue(mockDatabase([], [], [], []).db);
		await expect(detail()).rejects.toMatchObject({ status: 404 });
	});
});

describe('crear y actualizar clases', () => {
	it.each([false, true])('crea una clase con programa nuevo=%s dentro de la transacción', async (newProgram) => {
		const db = mockDatabase(...(newProgram ? [programs] : [programs, programs]));
		getDb.mockReturnValue(db.db);
		if (newProgram) db.insertValues.mockReturnValueOnce(queryRows(programs));
		db.insertValues.mockReturnValueOnce(queryRows([groupRow]));
		await expect(create({ ...valid, programSelection: newProgram ? '__new__' : '1', ...newProgram && { newProgramName: ' Salsa ', newProgramDescription: ' Programa de salsa ' } })).resolves.toEqual({ success: true, mode: 'createClass', classGroup });
		expect(db.db.transaction).toHaveBeenCalledOnce();
		expect(db.insertValues).toHaveBeenCalledWith(expect.objectContaining({ programId: 1, schedule: classGroup.schedule, days: ['Lunes', 'Viernes'], startDate: null, endDate: null, isActive: true }));
	});
	it.each(['horario', 'días', 'programa', 'fechas'])('rechaza creación con %s inválidos antes de acceder a DB', async (reason) => {
		const fields = { ...valid, ...(reason === 'horario' ? { schedule: ' ' } : reason === 'días' ? { days: [] } : reason === 'programa' ? { programId: '', programSelection: '' } : { startDate: '2026-10-31', endDate: '2026-10-01' }) };
		await expect(create(fields)).resolves.toMatchObject({ status: 400, data: { mode: 'createClass' } });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('rechaza un programa seleccionado que ya no existe', async () => {
		const db = mockDatabase([]); getDb.mockReturnValue(db.db);
		await expect(create()).resolves.toMatchObject({ status: 400, data: { errors: { programId: 'El programa seleccionado no existe.' } } });
		expect(db.db.transaction).not.toHaveBeenCalled();
	});
	it('rechaza un programa nuevo sin nombre ni descripción', async () => {
		await expect(create({ ...valid, programSelection: '__new__' })).resolves.toMatchObject({ status: 400 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('actualiza días y estado y vuelve a cargar el detalle', async () => {
		const db = mockDatabase(programs, [{ ...groupRow, isActive: false }], [], [], programs);
		db.set.mockReturnValue(queryRows([{ ...groupRow, isActive: false }]));
		getDb.mockReturnValue(db.db);
		await expect(update({ ...valid, isActive: 'false' })).resolves.toMatchObject({ success: true, mode: 'updateClass', classGroup: { id: 10, active: false } });
		expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, days: ['Lunes', 'Viernes'], startDate: null }));
	});
	it.each(['', '0', 'texto'])('rechaza actualizar identificador inválido %j', async (id) => {
		await expect(update(valid, id)).resolves.toMatchObject({ status: 400 });
		expect(getDb).not.toHaveBeenCalled();
	});
	it('conserva todos los días en los valores al fallar validación', async () => {
		await expect(update({ ...valid, schedule: '' })).resolves.toMatchObject({ status: 400, data: { values: { days: ['Lunes', 'Viernes'] } } });
	});
	it('devuelve 404 si la clase desaparece al actualizar', async () => {
		const db = mockDatabase(programs); getDb.mockReturnValue(db.db);
		await expect(update()).resolves.toMatchObject({ status: 404 });
	});
	it('propaga un fallo de transacción de creación', async () => {
		const db = mockDatabase(programs); getDb.mockReturnValue(db.db);
		const error = new Error('Transacción fallida');
		db.db.transaction.mockRejectedValueOnce(error);
		await expect(create()).rejects.toBe(error);
	});
});
