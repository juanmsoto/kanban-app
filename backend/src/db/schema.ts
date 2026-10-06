import {
    integer,
    text,
    timestamp,
    doublePrecision,
    pgEnum,
    primaryKey,
    snakeCase
} from 'drizzle-orm/pg-core';

export const boardRole = pgEnum('board_role', ['owner', 'editor', 'viewer']);

export const users = snakeCase.table('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
});

export const boards = snakeCase.table('boards', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});

export const boardMembers = snakeCase.table('board_members', {
    boardId: integer().notNull().references(() => boards.id, { onDelete: 'cascade'}),
    userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: boardRole().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
    },
    (t) => [primaryKey({ columns: [t.boardId, t.userId] })]
);

export const columns = snakeCase.table('columns', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    boardId: integer()
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    position: doublePrecision().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const cards = snakeCase.table('cards', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    columnId: integer()
        .notNull()
        .references(() => columns.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    position: doublePrecision().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
});