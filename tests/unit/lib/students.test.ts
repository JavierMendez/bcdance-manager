import { afterEach, describe, expect, it, vi } from 'vitest';
import { toStudentFormValues, validateStudentInput } from '$lib/students';

const valid = { fullName: '  Ana Pérez  ', phone: '+52 55 12 34 56 78', enrolledAt: '2026-10-16' };
afterEach(() => vi.useRealTimers());

describe('validación de alumnos', () => {
	it('normaliza el nombre, teléfono y fecha de inscripción', () => {
		expect(validateStudentInput(valid)).toEqual({
			errors: {}, values: { fullName: 'Ana Pérez', phone: '5512345678', enrolledAt: '2026-10-16' },
			parsed: { fullName: 'Ana Pérez', phone: '5512345678', enrolledAt: new Date('2026-10-16T12:00:00Z') }
		});
	});

	it.each(['', '   '])('permite teléfono opcional (%j)', (phone) => {
		const result = validateStudentInput({ ...valid, phone });
		expect(result.errors).toEqual({});
		expect(result.parsed?.phone).toBeNull();
	});

	it.each(['', '   ', '\t\n'])('rechaza el nombre vacío (%j)', (fullName) => {
		const result = validateStudentInput({ ...valid, fullName });
		expect(result.errors.fullName).toBe('El nombre completo es obligatorio.');
		expect(result.parsed).toBeNull();
	});

	it.each(['5', '551234567', '+52 55 12'])('rechaza teléfonos incompletos (%s)', (phone) => {
		expect(validateStudentInput({ ...valid, phone }).errors.phone).toBe('El teléfono debe tener 10 dígitos.');
	});

	it.each(['', '   '])('rechaza la fecha vacía (%j)', (enrolledAt) => {
		expect(validateStudentInput({ ...valid, enrolledAt }).parsed).toBeNull();
		expect(validateStudentInput({ ...valid, enrolledAt }).errors.enrolledAt).toBe('La fecha de inscripción es obligatoria.');
	});

	it('devuelve todos los errores en un solo intento', () => {
		expect(Object.keys(validateStudentInput({ fullName: '', phone: '55', enrolledAt: '' }).errors)).toEqual(['fullName', 'phone', 'enrolledAt']);
	});

	it('usa el día de México cuando se omite la fecha', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-17T01:00:00Z'));
		expect(validateStudentInput({ fullName: 'Ana', phone: '' }).values.enrolledAt).toBe('2026-10-16');
		expect(toStudentFormValues(null)).toEqual({ fullName: '', phone: '', enrolledAt: '2026-10-16' });
	});

	it('conserva caracteres Unicode y nombres largos', () => {
		const fullName = `María José O’Neill ${'Á'.repeat(200)}`;
		expect(validateStudentInput({ ...valid, fullName }).parsed?.fullName).toBe(fullName);
	});

	it('prepara la edición con teléfono nulo y fecha en la zona de México', () => {
		expect(toStudentFormValues({ fullName: 'Ana', phone: null, enrolledAt: '2026-10-17T01:00:00Z' })).toEqual({ fullName: 'Ana', phone: '', enrolledAt: '2026-10-16' });
	});
});
