import { describe, expect, it } from 'vitest';
import { validatePaymentPlanInput, toPaymentPlanFormValues, formatPlanType,
	formatClassesIncluded, formatHoursIncluded, BILLING_PERIODS, type PaymentPlanFormValues } from '$lib/payment-plans';
import { planValues, planCases } from '../../helpers/payment-plans';
import { monthlyPlan, fullPassPlan } from '../../helpers/classes';

describe('validación de planes de pago', () => {
	it.each(planCases)('acepta el plan $type y normaliza los campos aplicables', ({ plan, values }) => {
		const result = validatePaymentPlanInput(values);
		expect(result.errors).toEqual({});
		expect(result.parsed).toEqual({ name: plan.name, description: plan.description, planType: plan.planType, price: plan.price, billingPeriod: plan.billingPeriod, classesIncluded: plan.classesIncluded, hoursIncluded: plan.hoursIncluded });
	});
	it('recorta campos de texto y conserva Unicode y saltos de línea', () => {
		const result = validatePaymentPlanInput({ ...planValues, name: '  Árabe 🩰  ', description: '  Nivel 1\nBásico  ', price: ' 500 ', classesIncluded: ' 4 ' });
		expect(result.errors).toEqual({});
		expect(result.parsed).toMatchObject({ name: 'Árabe 🩰', description: 'Nivel 1\nBásico', price: 500, classesIncluded: 4 });
	});
	it.each(['', '  '])('rechaza nombre vacío %j', (name) => {
		expect(validatePaymentPlanInput({ ...planValues, name }).errors.name).toBe('El nombre es obligatorio.');
	});
	it.each(['', '\t\n'])('rechaza descripción vacía %j', (description) => {
		expect(validatePaymentPlanInput({ ...planValues, description }).errors.description).toBe('La descripción es obligatoria.');
	});
	it.each(['', ' ', '0', '-1', 'NaN', 'Infinity'])('rechaza precio %j', (price) => {
		expect(validatePaymentPlanInput({ ...planValues, price }).errors.price).toBeDefined();
	});
	it.each(['1', '1000000'])('acepta precio entero %s', (price) => {
		expect(validatePaymentPlanInput({ ...planValues, price }).parsed.price).toBe(Number(price));
	});
	it.each(BILLING_PERIODS)('acepta periodicidad reconocida %s', (billingPeriod) => {
		expect(validatePaymentPlanInput({ ...planValues, billingPeriod }).errors).toEqual({});
	});
	it('rechaza tipo y periodicidad desconocidos y devuelve errores simultáneos', () => {
		// Simula valores no confiables recibidos desde un formulario HTTP.
		const invalid = { ...planValues, name: '', description: '', price: '', planType: 'otro', billingPeriod: 'Semanal' } as unknown as PaymentPlanFormValues;
		expect(Object.keys(validatePaymentPlanInput(invalid).errors)).toEqual(['name', 'description', 'price', 'billingPeriod', 'planType']);
	});
	it.each(['monthly', 'drop_in'] as const)('rechaza cantidades inválidas para %s', (planType) => {
		for (const classesIncluded of ['0', '-1', '1.5', 'texto', 'Infinity']) {
			expect(validatePaymentPlanInput({ ...planValues, planType, classesIncluded }).errors.classesIncluded).toBeDefined();
		}
	});
	it('permite mensual sin clases, y asigna una clase suelta por defecto', () => {
		expect(validatePaymentPlanInput(planValues).parsed.classesIncluded).toBeNull();
		expect(validatePaymentPlanInput({ ...planValues, planType: 'drop_in', billingPeriod: 'Mensual' }).parsed).toMatchObject({ billingPeriod: 'Por clase', classesIncluded: 1, hoursIncluded: null });
	});
	it.each(['', '0', '-1', '1.5', 'texto', 'Infinity'])('rechaza horas full pass %j', (hoursIncluded) => {
		expect(validatePaymentPlanInput({ ...planValues, planType: 'full_pass', hoursIncluded }).errors.hoursIncluded).toBeDefined();
	});
	it('ignora las cantidades del tipo anterior al cambiar de modalidad', () => {
		expect(validatePaymentPlanInput({ ...planValues, hoursIncluded: '99' }).parsed.hoursIncluded).toBeNull();
		expect(validatePaymentPlanInput({ ...planValues, planType: 'full_pass', classesIncluded: '99', hoursIncluded: '24' }).parsed).toMatchObject({ classesIncluded: null, hoursIncluded: 24 });
	});
	it('permite múltiples créditos por clase y fuerza la periodicidad', () => {
		const result = validatePaymentPlanInput({ ...planValues, planType: 'drop_in', classesIncluded: '5', billingPeriod: 'Inválida' as 'Mensual' });
		expect(result.errors).toEqual({});
		expect(result.parsed).toMatchObject({ billingPeriod: 'Por clase', classesIncluded: 5 });
	});
});

describe('valores y etiquetas de planes', () => {
	it('convierte números a texto y usa 12 horas al editar un plan sin horas', () => {
		expect(toPaymentPlanFormValues(monthlyPlan)).toEqual({ ...planValues, hoursIncluded: '12' });
		expect(toPaymentPlanFormValues({ ...fullPassPlan, hoursIncluded: 24 }).hoursIncluded).toBe('24');
	});
	it.each([['monthly', 'Plan mensual'], ['full_pass', 'Full pass'], ['drop_in', 'Por clase']] as const)('traduce %s', (type, label) => {
		expect(formatPlanType(type)).toBe(label);
	});
	it('representa cantidades ausentes y distingue clases de horas', () => {
		expect(formatClassesIncluded(null)).toBe('—');
		expect(formatHoursIncluded(null)).toBe('—');
		expect(formatClassesIncluded(4)).toBe('4 clases');
		expect(formatHoursIncluded(12)).toBe('12 horas');
	});
});
