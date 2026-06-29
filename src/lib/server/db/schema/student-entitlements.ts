import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { courses } from './courses.js';
import { paymentPlans } from './payment-plans.js';
import { payments } from './payments.js';
import { students } from './students.js';

export const studentEntitlements = pgTable('student_entitlements', {
	id: serial('id').primaryKey(),
	studentId: integer('student_id')
		.references(() => students.id)
		.notNull(),
	paymentId: integer('payment_id')
		.references(() => payments.id)
		.notNull(),
	entitlementType: text('entitlement_type').notNull(),
	paymentPlanId: integer('payment_plan_id')
		.references(() => paymentPlans.id)
		.notNull(),
	courseId: integer('course_id').references(() => courses.id),
	hoursRemaining: integer('hours_remaining'),
	startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
	endsAt: timestamp('ends_at', { withTimezone: true }),
	active: boolean('active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export type StudentEntitlement = typeof studentEntitlements.$inferSelect;
export type NewStudentEntitlement = typeof studentEntitlements.$inferInsert;
