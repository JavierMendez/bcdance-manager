import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const additionalIncomes = pgTable('additional_incomes', {
	id: serial('id').primaryKey(),
	amount: integer('amount').notNull(),
	description: text('description').notNull(),
	paymentMethod: text('payment_method').notNull(),
	paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export type AdditionalIncome = typeof additionalIncomes.$inferSelect;
export type NewAdditionalIncome = typeof additionalIncomes.$inferInsert;
