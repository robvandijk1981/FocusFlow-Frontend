import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tracks - Life domains/areas (e.g., Freelance Consultant, Family Man, Musician)
 */
export const tracks = mysqlTable("tracks", {
  id: varchar("id", { length: 50 }).primaryKey(), // UUID from frontend
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("teal").notNull(), // Color key for styling
  notes: text("notes"), // Free-form notes for AI processing
  context: text("context"), // Background context to help AI
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;

/**
 * Goals - Objectives within a Track
 */
export const goals = mysqlTable("goals", {
  id: varchar("id", { length: 50 }).primaryKey(), // UUID from frontend
  trackId: varchar("trackId", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

/**
 * Tasks - Individual action items within a Goal
 */
export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 50 }).primaryKey(), // UUID from frontend
  goalId: varchar("goalId", { length: 50 }).notNull(),
  text: varchar("text", { length: 500 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]), // Nullable = no priority
  isCompleted: boolean("isCompleted").default(false).notNull(),
  isToday: boolean("isToday").default(false).notNull(), // For "Today's Focus"
  orderIndex: int("orderIndex").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * User Sessions - Daily focus state and preferences
 */
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dailyIntention: text("dailyIntention"),
  energyLevel: mysqlEnum("energyLevel", ["Low", "Normal", "High"]).default("Normal"),
  completionStreak: int("completionStreak").default(0).notNull(),
  trackSwitchCount: int("trackSwitchCount").default(0).notNull(),
  currentTrackId: varchar("currentTrackId", { length: 50 }),
  focusMode: boolean("focusMode").default(true).notNull(),
  sessionStartTime: timestamp("sessionStartTime").defaultNow(),
  lastActivity: timestamp("lastActivity").defaultNow().onUpdateNow(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * Track Documents - Uploaded files for Track context
 */
export const trackDocuments = mysqlTable("track_documents", {
  id: varchar("id", { length: 50 }).primaryKey(),
  trackId: varchar("trackId", { length: 50 }).notNull(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 255 }).notNull(), // MIME type e.g. application/vnd.openxmlformats-officedocument.wordprocessingml.document
  fileUrl: text("fileUrl").notNull(), // S3 URL
  extractedText: text("extractedText"), // AI-extracted text content, nullable
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrackDocument = typeof trackDocuments.$inferSelect;
export type InsertTrackDocument = typeof trackDocuments.$inferInsert;

/**
 * Dumps - Brain dump entries for AI processing
 */
export const dumps = mysqlTable("dumps", {
  id: varchar("id", { length: 50 }).primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(), // Raw dump text
  extractedContext: text("extractedContext"), // AI-extracted context info
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Dump = typeof dumps.$inferSelect;
export type InsertDump = typeof dumps.$inferInsert;
