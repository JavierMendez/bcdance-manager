import { describe, expect, it } from 'vitest';
import { parseAttendanceEntries, validateClassAttendanceSession, validateEntitlementForAttendanceSave,
	buildAttendanceMembers, buildEligibleFullPassStudents, getTodaySessionDate,
	isEntitlementVigenteForSession, toFullPassAttendanceMember } from '$lib/attendance';
import { entitlement, fullPassStudent, now } from '../../helpers/classes';

const session = '2026-10-16';
describe('validación de asistencia', () => {
	it('lee asistencias y faltas y normaliza identificadores numéricos', () => {
		expect(parseAttendanceEntries('[{"studentId":"1","entitlementId":"20","status":"attended"}]')).toEqual({ entries: [{ studentId: 1, entitlementId: 20, status: 'attended' }], errors: [] });
	});
	it.each(['', '{', 'null', '{}', '[null]', '[1]', '[{}]', '[{"studentId":1,"entitlementId":20,"status":"otro"}]'])('rechaza entradas mal formadas: %s', (raw) => {
		const result = parseAttendanceEntries(raw);
		expect(result.entries).toEqual([]);
		expect(result.errors).toHaveLength(1);
	});
	it('conserva entradas válidas y reporta las inválidas del mismo lote', () => {
		expect(parseAttendanceEntries('[null,{"studentId":1,"entitlementId":20,"status":"absent"}]')).toEqual({ entries: [{ studentId: 1, entitlementId: 20, status: 'absent' }], errors: ['Entrada de asistencia inválida.'] });
	});
	it.each(['2026-10-01', '2026-10-31'])('acepta el límite de fecha %s', (date) => {
		expect(validateClassAttendanceSession(date, { isActive: true, startDate: '2026-10-01', endDate: '2026-10-31' })).toBeNull();
	});
	it.each(['2026-09-30', '2026-11-01'])('rechaza fechas fuera de rango: %s', (date) => {
		expect(validateClassAttendanceSession(date, { isActive: true, startDate: '2026-10-01', endDate: '2026-10-31' })).toContain('periodo de la clase');
	});
	it('rechaza clases desactivadas aunque la fecha esté en rango', () => {
		expect(validateClassAttendanceSession(session, { isActive: false, startDate: null, endDate: null })).toContain('desactivada');
	});
	it.each(['attended', 'absent'] as const)('rechaza un registro nuevo %s con pago vencido', (status) => {
		expect(validateEntitlementForAttendanceSave({ ...entitlement, endsAt: new Date('2026-10-01T12:00:00Z') }, session, status, null, now)).toContain('no está vigente');
	});
	it('permite corregir asistencia a falta y conservar un registro con saldo agotado', () => {
		const fullPass = { ...entitlement, entitlementType: 'full_pass', hoursRemaining: 0 };
		expect(validateEntitlementForAttendanceSave(fullPass, session, 'absent', 'attended', now)).toBeNull();
		expect(validateEntitlementForAttendanceSave(fullPass, session, 'attended', 'attended', now)).toBeNull();
	});
	it('considera la vigencia histórica de una mensualidad y el día de México', () => {
		expect(isEntitlementVigenteForSession(entitlement, session, new Date('2026-12-01'))).toBe(true);
		expect(isEntitlementVigenteForSession(entitlement, '2026-09-30', now)).toBe(false);
		expect(getTodaySessionDate(new Date('2026-10-17T01:00:00Z'))).toBe('2026-10-16');
	});
});

describe('selección de alumnos para asistencia', () => {
	it('muestra mensuales vigentes y full pass solo si ya tienen asistencia', () => {
		const full = { ...entitlement, id: 21, entitlementType: 'full_pass', hoursRemaining: 2, student: { ...entitlement.student, id: 2 } };
		expect(buildAttendanceMembers(10, [entitlement, full], new Map(), session, now).map((m) => m.studentId)).toEqual([1]);
		expect(buildAttendanceMembers(10, [full], new Map([[2, 'attended']]), session, now)[0]).toMatchObject({ studentId: 2, currentStatus: 'attended', canRegisterAttendance: true });
	});
	it('preserva el registro histórico de un pase agotado y lo marca como no vigente', () => {
		const full = { ...entitlement, entitlementType: 'full_pass', hoursRemaining: 0 };
		expect(buildAttendanceMembers(10, [full], new Map([[1, 'attended']]), session, now)[0]).toMatchObject({ currentStatus: 'attended', canRegisterAttendance: false });
	});
	it('excluye alumnos inactivos y derechos de otras clases', () => {
		expect(buildAttendanceMembers(10, [{ ...entitlement, student: { ...entitlement.student, active: false } }, { ...entitlement, groupId: 99 }], new Map(), session, now)).toEqual([]);
	});
	it('elige el full pass con mayor saldo sin duplicar alumnos', () => {
		const full = { ...entitlement, entitlementType: 'full_pass', hoursRemaining: 2 };
		const result = buildEligibleFullPassStudents(10, [full, { ...full, id: 22, hoursRemaining: 5 }], new Set(), session, now);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ entitlementId: 22, hoursRemaining: 5 });
	});
	it.each(['excluido', 'mensual', 'agotado', 'inactivo'])('no ofrece un alumno full pass %s', (reason) => {
		const full = { ...entitlement, entitlementType: 'full_pass', hoursRemaining: reason === 'agotado' ? 0 : 2, student: { ...entitlement.student, active: reason !== 'inactivo' } };
		const rows = reason === 'mensual' ? [full, entitlement] : [full];
		expect(buildEligibleFullPassStudents(10, rows, new Set(reason === 'excluido' ? [1] : []), session, now)).toEqual([]);
	});
	it('transforma el full pass elegido conservando vigencia, saldo y estado', () => {
		expect(toFullPassAttendanceMember(fullPassStudent, 'absent')).toMatchObject({ studentId: 2, entitlementId: 21, hoursRemaining: 2, currentStatus: 'absent', canRegisterAttendance: true });
	});
});
