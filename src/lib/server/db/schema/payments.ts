import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { students } from './students.js';

export const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta débito', 'Tarjeta crédito', 'Otro'] as const;
export const PURCHASE_TYPES = ['monthly_only', 'full_pass_only', 'combined'] as const;
export const ITEM_TYPES = ['monthly_plan', 'full_pass'] as const;
export const ENTITLEMENT_TYPES = ['monthly_plan', 'full_pass'] as const;

export const payments = pgTable('payments', {
	id: serial('id').primaryKey(),
	studentId: integer('student_id')
		.references(() => students.id)
		.notNull(),
	purchaseType: text('purchase_type').notNull(),
	totalAmount: integer('total_amount').notNull(),
	paymentMethod: text('payment_method').notNull(),
	notes: text('notes'),
	paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
