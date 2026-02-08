/**
 * Frontend Type Definitions
 * 
 * These types include all the metadata that exists in the frontend
 * but may not be persisted to the backend
 */

// ==================== FRONTEND TYPES ====================

export interface Task {
  id: string;
  goalId: string;
  text: string; // Backend: 'name'
  description: string | null; // Not in backend
  priority: 'low' | 'medium' | 'high' | null; // Backend: 'urgency' with different values
  isCompleted: boolean; // Backend: 'completed'
  isToday: boolean; // Backend: 'todaysFocus'
  orderIndex: number; // Not in backend
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface Goal {
  id: string;
  trackId: string; // Backend: 'projectId'
  name: string;
  description: string | null; // Not in backend
  isCompleted: boolean; // Backend: 'completed'
  orderIndex: number; // Not in backend
  tasks: Task[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface Track {
  id: string;
  userId: number;
  name: string;
  color: string; // Not in backend
  notes: string | null; // Not in backend
  context: string | null; // Not in backend
  orderIndex: number; // Not in backend
  goals: Goal[];
  createdAt?: string;
  updatedAt?: string;
}

// ==================== EXTENDED TYPES WITH RELATIONS ====================

export interface TaskWithRelations extends Task {
  trackId: string;
  trackName: string;
  goalName: string;
}

export interface TodayTask extends TaskWithRelations {
  // Already has all needed fields from TaskWithRelations
}

// ==================== LOCAL METADATA TYPES ====================

export interface TrackMetadata {
  color: string;
  notes: string | null;
  context: string | null;
  orderIndex: number;
}

export interface GoalMetadata {
  description: string | null;
  orderIndex: number;
}

export interface TaskMetadata {
  description: string | null;
  orderIndex: number;
}

export interface SessionMetadata {
  dailyIntention: string | null;
  energyLevel: 'Low' | 'Normal' | 'High';
  currentTrackId: string | null;
  focusMode: boolean;
  sessionStartTime: string | null;
  trackSwitchCount: number;
  lastActivity: string | null;
  completionStreak: number;
}

export interface LocalMetadata {
  tracks: Record<string, TrackMetadata>;
  goals: Record<string, GoalMetadata>;
  tasks: Record<string, TaskMetadata>;
  session: SessionMetadata;
  lastSync: string; // ISO timestamp
  version: number; // For migration compatibility
}

// ==================== AI FEATURE TYPES ====================

export interface DumpSuggestion {
  newTasks: Array<{
    text: string;
    priority: string;
    trackId: string;
    trackName: string;
    goalId: string;
    goalName: string;
    selected?: boolean;
  }>;
  taskUpdates: Array<{
    taskId: string;
    action: string;
    newPriority?: string;
    selected?: boolean;
  }>;
  newGoals: Array<{
    name: string;
    description: string;
    trackId: string;
    trackName: string;
    selected?: boolean;
  }>;
  contextUpdates: Array<{
    trackId: string;
    trackName: string;
    contextToAdd: string;
    selected?: boolean;
  }>;
  summary: string;
}

export interface ExtractTaskSuggestion {
  text: string;
  priority: string;
  trackId: string;
  trackName: string;
  goalId: string;
  goalName: string;
  selected: boolean;
}

export interface GoalSuggestion {
  name: string;
  description: string;
}

export interface TodaysFocusSuggestion {
  selectedTaskIds: string[];
  reasoning: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  success: boolean;
  error?: string;
}

export interface ContextExtractionResult {
  extractedContext: string;
  hasNewContext: boolean;
}

export interface DocumentAnalysisResult {
  extractedContext: string;
  hasContent: boolean;
}

// ==================== DOCUMENT TYPES ====================

export interface TrackDocument {
  id: string;
  trackId: string;
  userId: number;
  filename: string;
  fileType: string;
  fileUrl: string;
  extractedText: string | null;
  createdAt: string;
}

// ==================== DUMP TYPES ====================

export interface Dump {
  id: string;
  userId: number;
  content: string;
  extractedContext: string | null;
  processedAt: string | null;
  createdAt: string;
}

// ==================== USER SESSION TYPES ====================

export interface UserSession {
  id: number;
  userId: number;
  dailyIntention: string | null;
  energyLevel: 'Low' | 'Normal' | 'High';
  completionStreak: number;
  trackSwitchCount: number;
  currentTrackId: string | null;
  focusMode: boolean;
  sessionStartTime: string | null;
  lastActivity: string | null;
}
