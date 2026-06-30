import { date, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { groups } from './groups.js';
import { studentEntitlements } from './student-entitlements.js';
import { students } from './students.js';

export const classAttendance = pgTable(
	'class_attendance',
	{
		id: serial('id').primaryKey(),
		studentId: integer('student_id')
			.references(() => students.id)
			.notNull(),
		groupId: integer('group_id')
			.references(() => groups.id)
			.notNull(),
		entitlementId: integer('entitlement_id')
			.references(() => studentEntitlements.id)
			.notNull(),
		entitlementType: text('entitlement_type').notNull(),
		sessionDate: date('session_date').notNull(),
		status: text('status').notNull(),
		hoursDeducted: integer('hours_deducted').notNull().default(0),
		classesDeducted: integer('classes_deducted').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		unique('class_attendance_student_group_date_entitlement').on(
			table.studentId,
			table.groupId,
			table.sessionDate,
			table.entitlementId
		)
	]
);

export type ClassAttendance = typeof classAttendance.$inferSelect;
export type NewClassAttendance = typeof classAttendance.$inferInsert;
