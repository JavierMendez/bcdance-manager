import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { APP_TIMEZONE } from '$lib/locale.js';
import {
	DROP_IN_GUEST_LABEL,
	formatStudentName,
	parsePaymentListFilters,
	parsePaymentListPage,
	resolvePaymentListDateRange,
	PAYMENT_LIST_PAGE_SIZE,
	PURCHASE_TYPE_LABELS,
	type PaymentMethod,
	type PurchaseType,
	type SerializedPayment
} from '$lib/payments.js';
import { getDb } from '$lib/server/db/index.js';
import { payments, students } from '$lib/server/db/schema/index.js';
import type { PageServerLoad } from './$types.js';

function serializePayment(
	payment: typeof payments.$inferSelect,
	studentName: string | null,
	summary: string
): SerializedPayment {
	return {
		id: payment.id,
		studentId: payment.studentId,
		studentName: formatStudentName(studentName),
		purchaseType: payment.purchaseType as PurchaseType,
		subtotalAmount: payment.subtotalAmount,
		discountPercent: payment.discountPercent,
		totalAmount: payment.totalAmount,
		paymentMethod: payment.paymentMethod as PaymentMethod,
		notes: payment.notes,
		paidAt: payment.paidAt.toISOString(),
		summary
	};
}

function escapeIlikePattern(value: string) {
	return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function paidOnOrAfter(from: string) {
	return sql`(${payments.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date >= ${from}::date`;
}

function paidOnOrBefore(to: string) {
	return sql`(${payments.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date <= ${to}::date`;
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const filters = parsePaymentListFilters(url.searchParams);
	const requestedPage = parsePaymentListPage(url.searchParams);
	const conditions: SQL[] = [];

	if (filters.type) {
		conditions.push(eq(payments.purchaseType, filters.type));
	}

	if (filters.method) {
		conditions.push(eq(payments.paymentMethod, filters.method));
	}

	const dateRange = resolvePaymentListDateRange(filters);

	if (dateRange.from) {
		conditions.push(paidOnOrAfter(dateRange.from));
	}

	if (dateRange.to) {
		conditions.push(paidOnOrBefore(dateRange.to));
	}

	if (filters.q) {
		const pattern = `%${escapeIlikePattern(filters.q)}%`;
		const nameMatch = sql`${students.fullName} ILIKE ${pattern} ESCAPE '\\'`;
		const matchesGuestLabel = DROP_IN_GUEST_LABEL.toLowerCase().includes(filters.q.toLowerCase());

		conditions.push(matchesGuestLabel ? or(nameMatch, isNull(payments.studentId))! : nameMatch);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const countQuery = db
		.select({ total: sql<number>`count(${payments.id})::int` })
		.from(payments)
		.leftJoin(students, eq(payments.studentId, students.id));

	const [{ total }] = await (where ? countQuery.where(where) : countQuery);

	const totalPages = Math.max(1, Math.ceil(total / PAYMENT_LIST_PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const offset = (page - 1) * PAYMENT_LIST_PAGE_SIZE;

	const listQuery = db
		.select({
			payment: payments,
			studentName: students.fullName
		})
		.from(payments)
		.leftJoin(students, eq(payments.studentId, students.id));

	const filteredList = where ? listQuery.where(where) : listQuery;
	const rows = await filteredList
		.orderBy(desc(payments.paidAt))
		.limit(PAYMENT_LIST_PAGE_SIZE)
		.offset(offset);

	return {
		payments: rows.map((row) =>
			serializePayment(
				row.payment,
				row.studentName,
				PURCHASE_TYPE_LABELS[row.payment.purchaseType as PurchaseType]
			)
		),
		filters,
		pagination: {
			page,
			pageSize: PAYMENT_LIST_PAGE_SIZE,
			total,
			totalPages
		}
	};
};
