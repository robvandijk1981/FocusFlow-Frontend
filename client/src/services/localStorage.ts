/**
 * LocalStorage Manager
 * 
 * Manages persistence of metadata that doesn't exist in the backend:
 * - Track colors, notes, context, orderIndex
 * - Goal descriptions, orderIndex
 * - Task descriptions, orderIndex
 * - Session state (daily intention, energy level, etc.)
 */

import type {
  LocalMetadata,
  TrackMetadata,
  GoalMetadata,
  TaskMetadata,
  SessionMetadata,
  Track,
  Goal,
  Task,
} from '../types/frontend';

const STORAGE_KEY = 'focusflow_metadata';
const STORAGE_VERSION = 1;

// ==================== DEFAULT VALUES ====================

const defaultSessionMetadata: SessionMetadata = {
  dailyIntention: null,
  energyLevel: 'Normal',
  currentTrackId: null,
  focusMode: true,
  sessionStartTime: null,
  trackSwitchCount: 0,
  lastActivity: null,
  completionStreak: 0,
};

const defaultMetadata: LocalMetadata = {
  tracks: {},
  goals: {},
  tasks: {},
  session: defaultSessionMetadata,
  lastSync: new Date().toISOString(),
  version: STORAGE_VERSION,
};

// ==================== CORE FUNCTIONS ====================

/**
 * Load all metadata from localStorage
 */
export function loadMetadata(): LocalMetadata {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...defaultMetadata };
    }
    
    const parsed = JSON.parse(stored) as LocalMetadata;
    
    // Handle version migration if needed
    if (parsed.version !== STORAGE_VERSION) {
      return migrateMetadata(parsed);
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to load metadata from localStorage:', error);
    return { ...defaultMetadata };
  }
}

/**
 * Save all metadata to localStorage
 */
export function saveMetadata(metadata: LocalMetadata): void {
  try {
    metadata.lastSync = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Failed to save metadata to localStorage:', error);
  }
}

/**
 * Clear all metadata from localStorage
 */
export function clearMetadata(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear metadata from localStorage:', error);
  }
}

/**
 * Migrate metadata from old version to new version
 */
function migrateMetadata(oldMetadata: any): LocalMetadata {
  // For now, just return default metadata
  // In the future, implement proper migration logic
  console.warn('Metadata version mismatch, resetting to defaults');
  return { ...defaultMetadata };
}

// ==================== TRACK METADATA ====================

export function getTrackMetadata(trackId: string): TrackMetadata | undefined {
  const metadata = loadMetadata();
  return metadata.tracks[trackId];
}

export function setTrackMetadata(trackId: string, trackMetadata: TrackMetadata): void {
  const metadata = loadMetadata();
  metadata.tracks[trackId] = trackMetadata;
  saveMetadata(metadata);
}

export function deleteTrackMetadata(trackId: string): void {
  const metadata = loadMetadata();
  delete metadata.tracks[trackId];
  saveMetadata(metadata);
}

export function updateTrackMetadata(trackId: string, updates: Partial<TrackMetadata>): void {
  const metadata = loadMetadata();
  const existing = metadata.tracks[trackId] || {
    color: 'teal',
    notes: null,
    context: null,
    orderIndex: 0,
  };
  metadata.tracks[trackId] = { ...existing, ...updates };
  saveMetadata(metadata);
}

/**
 * Save metadata from a Track object
 */
export function saveTrackMetadataFromTrack(track: Track): void {
  setTrackMetadata(track.id, {
    color: track.color,
    notes: track.notes,
    context: track.context,
    orderIndex: track.orderIndex,
  });
}

// ==================== GOAL METADATA ====================

export function getGoalMetadata(goalId: string): GoalMetadata | undefined {
  const metadata = loadMetadata();
  return metadata.goals[goalId];
}

export function setGoalMetadata(goalId: string, goalMetadata: GoalMetadata): void {
  const metadata = loadMetadata();
  metadata.goals[goalId] = goalMetadata;
  saveMetadata(metadata);
}

export function deleteGoalMetadata(goalId: string): void {
  const metadata = loadMetadata();
  delete metadata.goals[goalId];
  saveMetadata(metadata);
}

export function updateGoalMetadata(goalId: string, updates: Partial<GoalMetadata>): void {
  const metadata = loadMetadata();
  const existing = metadata.goals[goalId] || {
    description: null,
    orderIndex: 0,
  };
  metadata.goals[goalId] = { ...existing, ...updates };
  saveMetadata(metadata);
}

/**
 * Save metadata from a Goal object
 */
export function saveGoalMetadataFromGoal(goal: Goal): void {
  setGoalMetadata(goal.id, {
    description: goal.description,
    orderIndex: goal.orderIndex,
  });
}

// ==================== TASK METADATA ====================

export function getTaskMetadata(taskId: string): TaskMetadata | undefined {
  const metadata = loadMetadata();
  return metadata.tasks[taskId];
}

export function setTaskMetadata(taskId: string, taskMetadata: TaskMetadata): void {
  const metadata = loadMetadata();
  metadata.tasks[taskId] = taskMetadata;
  saveMetadata(metadata);
}

export function deleteTaskMetadata(taskId: string): void {
  const metadata = loadMetadata();
  delete metadata.tasks[taskId];
  saveMetadata(metadata);
}

export function updateTaskMetadata(taskId: string, updates: Partial<TaskMetadata>): void {
  const metadata = loadMetadata();
  const existing = metadata.tasks[taskId] || {
    description: null,
    orderIndex: 0,
  };
  metadata.tasks[taskId] = { ...existing, ...updates };
  saveMetadata(metadata);
}

/**
 * Save metadata from a Task object
 */
export function saveTaskMetadataFromTask(task: Task): void {
  setTaskMetadata(task.id, {
    description: task.description,
    orderIndex: task.orderIndex,
  });
}

// ==================== SESSION METADATA ====================

export function getSessionMetadata(): SessionMetadata {
  const metadata = loadMetadata();
  return metadata.session || defaultSessionMetadata;
}

export function setSessionMetadata(sessionMetadata: SessionMetadata): void {
  const metadata = loadMetadata();
  metadata.session = sessionMetadata;
  saveMetadata(metadata);
}

export function updateSessionMetadata(updates: Partial<SessionMetadata>): void {
  const metadata = loadMetadata();
  metadata.session = { ...metadata.session, ...updates };
  saveMetadata(metadata);
}

// ==================== BULK OPERATIONS ====================

/**
 * Get all metadata for multiple tracks
 */
export function getTracksMetadata(trackIds: string[]): Record<string, TrackMetadata> {
  const metadata = loadMetadata();
  const result: Record<string, TrackMetadata> = {};
  
  for (const trackId of trackIds) {
    if (metadata.tracks[trackId]) {
      result[trackId] = metadata.tracks[trackId];
    }
  }
  
  return result;
}

/**
 * Get all metadata for multiple goals
 */
export function getGoalsMetadata(goalIds: string[]): Record<string, GoalMetadata> {
  const metadata = loadMetadata();
  const result: Record<string, GoalMetadata> = {};
  
  for (const goalId of goalIds) {
    if (metadata.goals[goalId]) {
      result[goalId] = metadata.goals[goalId];
    }
  }
  
  return result;
}

/**
 * Get all metadata for multiple tasks
 */
export function getTasksMetadata(taskIds: string[]): Record<string, TaskMetadata> {
  const metadata = loadMetadata();
  const result: Record<string, TaskMetadata> = {};
  
  for (const taskId of taskIds) {
    if (metadata.tasks[taskId]) {
      result[taskId] = metadata.tasks[taskId];
    }
  }
  
  return result;
}

/**
 * Save metadata from multiple tracks
 */
export function saveTracksMetadata(tracks: Track[]): void {
  const metadata = loadMetadata();
  
  for (const track of tracks) {
    metadata.tracks[track.id] = {
      color: track.color,
      notes: track.notes,
      context: track.context,
      orderIndex: track.orderIndex,
    };
  }
  
  saveMetadata(metadata);
}

/**
 * Save metadata from multiple goals
 */
export function saveGoalsMetadata(goals: Goal[]): void {
  const metadata = loadMetadata();
  
  for (const goal of goals) {
    metadata.goals[goal.id] = {
      description: goal.description,
      orderIndex: goal.orderIndex,
    };
  }
  
  saveMetadata(metadata);
}

/**
 * Save metadata from multiple tasks
 */
export function saveTasksMetadata(tasks: Task[]): void {
  const metadata = loadMetadata();
  
  for (const task of tasks) {
    metadata.tasks[task.id] = {
      description: task.description,
      orderIndex: task.orderIndex,
    };
  }
  
  saveMetadata(metadata);
}

// ==================== EXPORT/IMPORT ====================

/**
 * Export all metadata as JSON string
 */
export function exportMetadata(): string {
  const metadata = loadMetadata();
  return JSON.stringify(metadata, null, 2);
}

/**
 * Import metadata from JSON string
 */
export function importMetadata(jsonString: string): boolean {
  try {
    const metadata = JSON.parse(jsonString) as LocalMetadata;
    saveMetadata(metadata);
    return true;
  } catch (error) {
    console.error('Failed to import metadata:', error);
    return false;
  }
}

// ==================== CLEANUP ====================

/**
 * Remove orphaned metadata (for deleted entities)
 */
export function cleanupOrphanedMetadata(
  validTrackIds: string[],
  validGoalIds: string[],
  validTaskIds: string[]
): void {
  const metadata = loadMetadata();
  
  // Clean up tracks
  const trackIds = Object.keys(metadata.tracks);
  for (const trackId of trackIds) {
    if (!validTrackIds.includes(trackId)) {
      delete metadata.tracks[trackId];
    }
  }
  
  // Clean up goals
  const goalIds = Object.keys(metadata.goals);
  for (const goalId of goalIds) {
    if (!validGoalIds.includes(goalId)) {
      delete metadata.goals[goalId];
    }
  }
  
  // Clean up tasks
  const taskIds = Object.keys(metadata.tasks);
  for (const taskId of taskIds) {
    if (!validTaskIds.includes(taskId)) {
      delete metadata.tasks[taskId];
    }
  }
  
  saveMetadata(metadata);
}
