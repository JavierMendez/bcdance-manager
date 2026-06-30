import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const PLAN_TYPES = ['monthly', 'full_pass', 'drop_in'] as const;

export const paymentPlans = pgTable('payment_plans', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull(),
	planType: text('plan_type').notNull().default('monthly'),
	price: integer('price').notNull(),
	billingPeriod: text('billing_period').notNull(),
	classesIncluded: integer('classes_included'),
	hoursIncluded: integer('hours_included'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type NewPaymentPlan = typeof paymentPlans.$inferInsert;
