import { eq, and, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tracks, goals, tasks, userSessions, trackDocuments, dumps, Track, Goal, Task, UserSession, TrackDocument, Dump, InsertTrack, InsertGoal, InsertTask, InsertTrackDocument, InsertDump } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ TRACK FUNCTIONS ============

export async function getTracksByUserId(userId: number): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(tracks).where(eq(tracks.userId, userId)).orderBy(asc(tracks.orderIndex));
}

export async function getTrackById(trackId: string, userId: number): Promise<Track | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createTrack(track: InsertTrack): Promise<Track> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(tracks).values(track);
  const result = await db.select().from(tracks).where(eq(tracks.id, track.id)).limit(1);
  return result[0];
}

export async function updateTrack(trackId: string, userId: number, data: Partial<InsertTrack>): Promise<Track | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(tracks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
  
  return getTrackById(trackId, userId);
}

export async function deleteTrack(trackId: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Delete all goals and tasks for this track in batch
  const trackGoals = await db.select({ id: goals.id }).from(goals).where(eq(goals.trackId, trackId));
  const goalIds = trackGoals.map(g => g.id);
  if (goalIds.length > 0) {
    await db.delete(tasks).where(inArray(tasks.goalId, goalIds));
  }
  await db.delete(goals).where(eq(goals.trackId, trackId));
  await db.delete(trackDocuments).where(eq(trackDocuments.trackId, trackId));
  await db.delete(tracks).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
  return true;
}

// ============ GOAL FUNCTIONS ============

export async function getGoalsByTrackId(trackId: string): Promise<Goal[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(goals).where(eq(goals.trackId, trackId)).orderBy(asc(goals.orderIndex));
}

export async function getGoalById(goalId: string): Promise<Goal | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  return result[0];
}

export async function createGoal(goal: InsertGoal): Promise<Goal> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(goals).values(goal);
  const result = await db.select().from(goals).where(eq(goals.id, goal.id)).limit(1);
  return result[0];
}

export async function updateGoal(goalId: string, data: Partial<InsertGoal>): Promise<Goal | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(goals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(goals.id, goalId));
  
  return getGoalById(goalId);
}

export async function completeGoal(goalId: string): Promise<{ goal: Goal | undefined; trackId: string | null; trackName: string | null }> {
  const db = await getDb();
  if (!db) return { goal: undefined, trackId: null, trackName: null };
  
  // Get goal info before completing
  const goalInfo = await getGoalById(goalId);
  let trackInfo: { id: string; name: string } | null = null;
  
  if (goalInfo) {
    const trackResult = await db.select().from(tracks).where(eq(tracks.id, goalInfo.trackId)).limit(1);
    if (trackResult.length > 0) {
      trackInfo = { id: trackResult[0].id, name: trackResult[0].name };
    }
  }
  
  await db.update(goals)
    .set({ isCompleted: true, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(goals.id, goalId));
  
  const completedGoal = await getGoalById(goalId);
  
  return {
    goal: completedGoal,
    trackId: trackInfo?.id || null,
    trackName: trackInfo?.name || null
  };
}

export async function deleteGoal(goalId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Delete all tasks for this goal first
  await db.delete(tasks).where(eq(tasks.goalId, goalId));
  await db.delete(goals).where(eq(goals.id, goalId));
  return true;
}

// ============ TASK FUNCTIONS ============

export async function getTasksByGoalId(goalId: string): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(tasks).where(eq(tasks.goalId, goalId)).orderBy(asc(tasks.orderIndex));
}

export async function getTodayTasks(userId: number): Promise<Array<Task & { trackId: string; trackName: string; goalName: string }>> {
  const db = await getDb();
  if (!db) return [];
  
  // Fetch all tracks for user in one query
  const userTracks = await db.select().from(tracks).where(eq(tracks.userId, userId));
  if (userTracks.length === 0) return [];
  
  const trackIds = userTracks.map(t => t.id);
  const trackMap = new Map(userTracks.map(t => [t.id, t]));
  
  // Fetch all goals for all tracks in one query
  const allGoals = await db.select().from(goals).where(inArray(goals.trackId, trackIds));
  if (allGoals.length === 0) return [];
  
  const goalIds = allGoals.map(g => g.id);
  const goalMap = new Map(allGoals.map(g => [g.id, g]));
  
  // Fetch all today tasks in one query
  const todayTaskRows = await db.select().from(tasks)
    .where(and(inArray(tasks.goalId, goalIds), eq(tasks.isToday, true)));
  
  // Map tasks with track and goal info
  return todayTaskRows.map(task => {
    const goal = goalMap.get(task.goalId)!;
    const track = trackMap.get(goal.trackId)!;
    return {
      ...task,
      trackId: track.id,
      trackName: track.name,
      goalName: goal.name,
    };
  });
}

export async function getTaskById(taskId: string): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result[0];
}

export async function getTaskWithGoalAndTrack(taskId: string): Promise<{ task: Task; goal: Goal; track: Track } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const task = await getTaskById(taskId);
  if (!task) return undefined;
  
  const goal = await getGoalById(task.goalId);
  if (!goal) return undefined;
  
  const trackResult = await db.select().from(tracks).where(eq(tracks.id, goal.trackId)).limit(1);
  if (trackResult.length === 0) return undefined;
  
  return { task, goal, track: trackResult[0] };
}

export async function createTask(task: InsertTask): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(tasks).values(task);
  const result = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
  return result[0];
}

export async function updateTask(taskId: string, data: Partial<InsertTask>): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  
  return getTaskById(taskId);
}

export async function setTaskPriority(taskId: string, priority: 'low' | 'medium' | 'high' | null): Promise<Task | undefined> {
  return updateTask(taskId, { priority });
}

export async function setTaskToday(taskId: string, isToday: boolean): Promise<Task | undefined> {
  return updateTask(taskId, { isToday });
}

export async function completeTask(taskId: string): Promise<{ task: Task | undefined; trackId: string | null; trackName: string | null; goalName: string | null }> {
  const db = await getDb();
  if (!db) return { task: undefined, trackId: null, trackName: null, goalName: null };
  
  // Get task info before completing
  const taskInfo = await getTaskWithGoalAndTrack(taskId);
  
  await db.update(tasks)
    .set({ isCompleted: true, completedAt: new Date(), isToday: false, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  
  const completedTask = await getTaskById(taskId);
  
  return {
    task: completedTask,
    trackId: taskInfo?.track.id || null,
    trackName: taskInfo?.track.name || null,
    goalName: taskInfo?.goal.name || null
  };
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return true;
}

// ============ USER SESSION FUNCTIONS ============

export async function getUserSession(userId: number): Promise<UserSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userSessions).where(eq(userSessions.userId, userId)).limit(1);
  return result[0];
}

export async function upsertUserSession(userId: number, data: Partial<Omit<UserSession, 'id' | 'userId'>>): Promise<UserSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserSession(userId);
  
  if (existing) {
    await db.update(userSessions)
      .set({ ...data, lastActivity: new Date() })
      .where(eq(userSessions.userId, userId));
  } else {
    await db.insert(userSessions).values({ userId, ...data });
  }
  
  const result = await getUserSession(userId);
  return result!;
}

// ============ BULK SYNC FUNCTION ============

export async function bulkSyncTracks(userId: number, tracksData: Array<{
  id: string;
  name: string;
  color: string;
  notes?: string;
  context?: string;
  orderIndex?: number;
  goals: Array<{
    id: string;
    name: string;
    description?: string;
    isCompleted?: boolean;
    orderIndex?: number;
    tasks: Array<{
      id: string;
      text: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | null;
      isCompleted?: boolean;
      isToday?: boolean;
      orderIndex?: number;
    }>;
  }>;
}>): Promise<Track[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete existing tracks for this user
  const existingTracks = await getTracksByUserId(userId);
  for (const track of existingTracks) {
    await deleteTrack(track.id, userId);
  }
  
  // Create new tracks with goals and tasks
  for (const trackData of tracksData) {
    await db.insert(tracks).values({
      id: trackData.id,
      userId,
      name: trackData.name,
      color: trackData.color,
      notes: trackData.notes || null,
      context: trackData.context || null,
      orderIndex: trackData.orderIndex || 0,
    });
    
    for (const goalData of trackData.goals) {
      await db.insert(goals).values({
        id: goalData.id,
        trackId: trackData.id,
        name: goalData.name,
        description: goalData.description || null,
        isCompleted: goalData.isCompleted || false,
        orderIndex: goalData.orderIndex || 0,
      });
      
      for (const taskData of goalData.tasks) {
        await db.insert(tasks).values({
          id: taskData.id,
          goalId: goalData.id,
          text: taskData.text,
          description: taskData.description || null,
          priority: taskData.priority || null,
          isCompleted: taskData.isCompleted || false,
          isToday: taskData.isToday || false,
          orderIndex: taskData.orderIndex || 0,
        });
      }
    }
  }
  
  return getTracksByUserId(userId);
}

// ============ GET FULL TRACK DATA ============

export async function getTracksWithGoalsAndTasks(userId: number): Promise<Array<Track & { goals: Array<Goal & { tasks: Task[] }> }>> {
  const db = await getDb();
  if (!db) return [];
  
  // Fetch all tracks in one query
  const userTracks = await db.select().from(tracks).where(eq(tracks.userId, userId)).orderBy(asc(tracks.orderIndex));
  if (userTracks.length === 0) return [];
  
  // Fetch all goals for all tracks in one query
  const trackIds = userTracks.map(t => t.id);
  const allGoals = await db.select().from(goals).where(inArray(goals.trackId, trackIds)).orderBy(asc(goals.orderIndex));
  
  // Fetch all tasks for all goals in one query
  const goalIds = allGoals.map(g => g.id);
  const allTasks = goalIds.length > 0 
    ? await db.select().from(tasks).where(inArray(tasks.goalId, goalIds)).orderBy(asc(tasks.orderIndex))
    : [];
  
  // Group tasks by goalId
  const tasksByGoalId = new Map<string, Task[]>();
  for (const task of allTasks) {
    const existing = tasksByGoalId.get(task.goalId) || [];
    existing.push(task);
    tasksByGoalId.set(task.goalId, existing);
  }
  
  // Group goals by trackId
  const goalsByTrackId = new Map<string, Array<Goal & { tasks: Task[] }>>();
  for (const goal of allGoals) {
    const existing = goalsByTrackId.get(goal.trackId) || [];
    existing.push({ ...goal, tasks: tasksByGoalId.get(goal.id) || [] });
    goalsByTrackId.set(goal.trackId, existing);
  }
  
  // Assemble result
  return userTracks.map(track => ({
    ...track,
    goals: goalsByTrackId.get(track.id) || [],
  }));
}

// ============ TRACK DOCUMENT FUNCTIONS ============

export async function getDocumentsByTrackId(trackId: string): Promise<TrackDocument[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(trackDocuments).where(eq(trackDocuments.trackId, trackId));
}

export async function createTrackDocument(doc: {
  trackId: string;
  userId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
}): Promise<TrackDocument> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await db.insert(trackDocuments).values({
    id,
    trackId: doc.trackId,
    userId: doc.userId,
    filename: doc.fileName,
    fileType: doc.fileType,
    fileUrl: doc.fileUrl,
    extractedText: '',
    createdAt: new Date(),
  });
  
  const result = await db.select().from(trackDocuments).where(eq(trackDocuments.id, id)).limit(1);
  return result[0];
}

export async function deleteTrackDocument(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(trackDocuments).where(eq(trackDocuments.id, id));
  return true;
}

// ============ DUMP FUNCTIONS ============

export async function getDumpsByUserId(userId: number): Promise<Dump[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(dumps).where(eq(dumps.userId, userId));
}

export async function createDump(dump: InsertDump): Promise<Dump> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(dumps).values(dump);
  const result = await db.select().from(dumps).where(eq(dumps.id, dump.id)).limit(1);
  return result[0];
}

export async function updateDump(id: string, data: Partial<InsertDump>): Promise<Dump | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.update(dumps).set(data).where(eq(dumps.id, id));
  const result = await db.select().from(dumps).where(eq(dumps.id, id)).limit(1);
  return result[0];
}
