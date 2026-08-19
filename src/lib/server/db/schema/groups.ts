import { boolean, date, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { programs } from './programs.js';

export const groups = pgTable('groups', {
	id: serial('id').primaryKey(),
	programId: integer('program_id')
		.references(() => programs.id)
		.notNull(),
	schedule: text('schedule').notNull(),
	days: text('days').array().notNull(),
	startDate: date('start_date'),
	endDate: date('end_date'),
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
