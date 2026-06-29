import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { payments, students } from '$lib/server/db/schema/index.js';
import {
	PURCHASE_TYPE_LABELS,
	type PaymentMethod,
	type PurchaseType,
	type SerializedPayment
} from '$lib/payments.js';
import type { PageServerLoad } from './$types.js';

function serializePayment(
	payment: typeof payments.$inferSelect,
	studentName: string,
	summary: string
): SerializedPayment {
	return {
		id: payment.id,
		studentId: payment.studentId,
		studentName,
		purchaseType: payment.purchaseType as PurchaseType,
		totalAmount: payment.totalAmount,
		paymentMethod: payment.paymentMethod as PaymentMethod,
		notes: payment.notes,
		paidAt: payment.paidAt.toISOString(),
		summary
	};
}

export const load: PageServerLoad = async () => {
	const db = getDb();

	const rows = await db
		.select({
			payment: payments,
			studentName: students.fullName
		})
		.from(payments)
		.innerJoin(students, eq(payments.studentId, students.id))
		.orderBy(desc(payments.paidAt));

	return {
		payments: rows.map((row) =>
			serializePayment(
				row.payment,
				row.studentName,
				PURCHASE_TYPE_LABELS[row.payment.purchaseType as PurchaseType]
			)
		)
	};
};
