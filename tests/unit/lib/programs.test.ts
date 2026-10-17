import { describe, expect, it } from 'vitest';
import { toProgramFormValues, validateProgramInput } from '$lib/programs';

describe('validación de programas', () => {
	it('recorta nombre y descripción sin perder espacios internos ni saltos de línea', () => {
		expect(validateProgramInput({ name: '  Ballet clásico  ', description: '  Nivel 1\nTrabajo en barra  ' })).toEqual({
			errors: {}, values: { name: 'Ballet clásico', description: 'Nivel 1\nTrabajo en barra' }
		});
	});
	it.each(['', ' ', '\t\n'])('rechaza nombre vacío %j', (name) => {
		expect(validateProgramInput({ name, description: 'Nivel inicial' })).toEqual({ errors: { name: 'El nombre es obligatorio.' }, values: { name: '', description: 'Nivel inicial' } });
	});
	it.each(['', ' ', '\t\n'])('rechaza descripción vacía %j', (description) => {
		expect(validateProgramInput({ name: 'Salsa', description }).errors).toEqual({ description: 'La descripción es obligatoria.' });
	});
	it('devuelve ambos errores a la vez y conserva los valores normalizados', () => {
		expect(validateProgramInput({ name: ' ', description: '\n' })).toEqual({ errors: { name: 'El nombre es obligatorio.', description: 'La descripción es obligatoria.' }, values: { name: '', description: '' } });
	});
	it.each(['Árabe — iniciación 🩰', 'A', 'Programa '.repeat(100)])('acepta nombres no vacíos, Unicode y largos: %s', (name) => {
		expect(validateProgramInput({ name, description: 'Descripción válida' }).errors).toEqual({});
	});
	it('prepara valores de edición sin incluir metadatos ni mutar el programa', () => {
		const program = { id: 1, name: 'Salsa', description: 'Nivel inicial', classCount: 3 };
		const values = toProgramFormValues(program);
		expect(values).toEqual({ name: 'Salsa', description: 'Nivel inicial' });
		values.name = 'Bachata';
		expect(program.name).toBe('Salsa');
		expect(program.classCount).toBe(3);
	});
});
