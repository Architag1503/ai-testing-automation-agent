import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer("credits").default(1000).notNull()
});

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  repoId: integer("repo_id").notNull(),
  name: text("name").notNull(),
  full_name: text("full_name").notNull(),
  private: integer("private").notNull(),
  html_url: text("html_url").notNull(),
  description: text("description"),
  owner: text("owner").notNull(),
  language: text("language"),
  defaultBranch: text("default_branch"),
})

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
