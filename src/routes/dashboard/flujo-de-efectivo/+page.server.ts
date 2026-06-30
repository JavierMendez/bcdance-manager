import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
	buildCashFlowSummary,
	resolveCashFlowPeriod,
	serializeCashFlowIncome,
	validateExpenseInput,
	type CashFlowExpenseRow,
	type ExpenseFormValues
} from '$lib/cash-flow.js';
import { APP_TIMEZONE } from '$lib/locale.js';
import { PAYMENT_METHODS } from '$lib/payments.js';
import { getDb } from '$lib/server/db/index.js';
import { expenses, payments, students } from '$lib/server/db/schema/index.js';
import type { Actions, PageServerLoad } from './$types.js';

function paidInPeriod(column: typeof payments.paidAt | typeof expenses.paidAt, from: string, to: string) {
	return and(
		sql`(${column} AT TIME ZONE ${APP_TIMEZONE})::date >= ${from}::date`,
		sql`(${column} AT TIME ZONE ${APP_TIMEZONE})::date <= ${to}::date`
	);
}

function parseExpenseForm(formData: FormData): ExpenseFormValues {
	return {
		amount: String(formData.get('amount') ?? ''),
		category: String(formData.get('category') ?? '') as ExpenseFormValues['category'],
		description: String(formData.get('description') ?? ''),
		paymentMethod: String(formData.get('paymentMethod') ?? '') as ExpenseFormValues['paymentMethod'],
		paidAt: String(formData.get('paidAt') ?? '')
	};
}

function getExpenseCalendarDate(paidAt: Date) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(paidAt);
}

function buildRedirectParams(
	currentUrl: URL,
	expenseDate?: string
) {
	const period = resolveCashFlowPeriod(currentUrl.searchParams);
	const params = new URLSearchParams({
		preset: period.preset,
		from: period.from,
		to: period.to
	});

	if (expenseDate && (expenseDate < period.from || expenseDate > period.to)) {
		params.set('preset', 'custom');
		params.set('from', expenseDate);
		params.set('to', expenseDate);
	}

	return params;
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const period = resolveCashFlowPeriod(url.searchParams);

	const [incomeRows, expenseRows] = await Promise.all([
		db
			.select({
				payment: payments,
				studentName: students.fullName
			})
			.from(payments)
			.leftJoin(students, eq(payments.studentId, students.id))
			.where(paidInPeriod(payments.paidAt, period.from, period.to))
			.orderBy(desc(payments.paidAt)),
		db
			.select()
			.from(expenses)
			.where(paidInPeriod(expenses.paidAt, period.from, period.to))
			.orderBy(desc(expenses.paidAt))
	]);

	const summary = buildCashFlowSummary(
		incomeRows.map((row) => serializeCashFlowIncome(row.payment, row.studentName)),
		expenseRows.map((row) => ({
			id: row.id,
			amount: row.amount,
			category: row.category as CashFlowExpenseRow['category'],
			description: row.description,
			paymentMethod: row.paymentMethod as CashFlowExpenseRow['paymentMethod'],
			paidAt: row.paidAt
		})),
		period
	);

	return {
		period,
		summary,
		paymentMethods: PAYMENT_METHODS
	};
};

export const actions: Actions = {
	createExpense: async ({ request, url }) => {
		const formData = await request.formData();
		const expenseData = parseExpenseForm(formData);
		const { errors, values, parsed } = validateExpenseInput(expenseData);

		if (!parsed) {
			return fail(400, {
				mode: 'createExpense' as const,
				errors,
				values
			});
		}

		const db = getDb();

		await db.insert(expenses).values({
			amount: parsed.amount,
			category: parsed.category,
			description: parsed.description,
			paymentMethod: parsed.paymentMethod,
			paidAt: parsed.paidAt
		});

		const params = buildRedirectParams(url, getExpenseCalendarDate(parsed.paidAt));
		params.set('saved', '1');
		redirect(303, `/dashboard/flujo-de-efectivo?${params.toString()}`);
	},

	deleteExpense: async ({ request, url }) => {
		const formData = await request.formData();
		const expenseId = Number(formData.get('expenseId'));

		if (!expenseId) {
			return fail(400, { message: 'No se pudo identificar el egreso.' });
		}

		const db = getDb();
		await db.delete(expenses).where(eq(expenses.id, expenseId));

		const params = buildRedirectParams(url);
		params.set('deleted', '1');
		redirect(303, `/dashboard/flujo-de-efectivo?${params.toString()}`);
	}
};
