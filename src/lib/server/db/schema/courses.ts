import { date, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const courses = pgTable('courses', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull(),
	schedule: text('schedule').notNull(),
	days: text('days').array().notNull(),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
