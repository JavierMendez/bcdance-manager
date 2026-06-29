import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const students = pgTable('students', {
	id: serial('id').primaryKey(),
	fullName: text('full_name').notNull(),
	phone: text('phone').notNull(),
	email: text('email').notNull().unique(),
	enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
	active: boolean('active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
