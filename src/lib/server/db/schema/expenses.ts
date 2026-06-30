import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const expenses = pgTable('expenses', {
	id: serial('id').primaryKey(),
	amount: integer('amount').notNull(),
	category: text('category').notNull(),
	description: text('description').notNull(),
	paymentMethod: text('payment_method').notNull(),
	paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
