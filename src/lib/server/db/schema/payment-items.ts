import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { groups } from './groups.js';
import { paymentPlans } from './payment-plans.js';
import { payments } from './payments.js';

export const paymentItems = pgTable('payment_items', {
	id: serial('id').primaryKey(),
	paymentId: integer('payment_id')
		.references(() => payments.id)
		.notNull(),
	itemType: text('item_type').notNull(),
	paymentPlanId: integer('payment_plan_id')
		.references(() => paymentPlans.id)
		.notNull(),
	groupId: integer('group_id').references(() => groups.id),
	amount: integer('amount').notNull(),
	hoursGranted: integer('hours_granted'),
	classesGranted: integer('classes_granted')
});

export type PaymentItem = typeof paymentItems.$inferSelect;
export type NewPaymentItem = typeof paymentItems.$inferInsert;
