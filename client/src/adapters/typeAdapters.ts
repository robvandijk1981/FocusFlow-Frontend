/**
 * Type Adapters
 * 
 * Convert between frontend types (with metadata) and backend types (simpler schema)
 */

import type {
  BackendProject,
  BackendGoal,
  BackendTask,
  BackendProjectWithGoalsAndTasks,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types/backend';

import type {
  Track,
  Goal,
  Task,
  TrackMetadata,
  GoalMetadata,
  TaskMetadata,
} from '../types/frontend';

// ==================== PRIORITY/URGENCY MAPPING ====================

export const priorityToUrgency = {
  'low': 'LAAG',
  'medium': 'MIDDEN',
  'high': 'HOOG',
  null: null,
} as const;

export const urgencyToPriority = {
  'LAAG': 'low',
  'MIDDEN': 'medium',
  'HOOG': 'high',
  null: null,
} as const;

type Priority = 'low' | 'medium' | 'high' | null;
type Urgency = 'LAAG' | 'MIDDEN' | 'HOOG' | null;

export function convertPriorityToUrgency(priority: Priority): Urgency {
  return priorityToUrgency[priority as keyof typeof priorityToUrgency] as Urgency;
}

export function convertUrgencyToPriority(urgency: Urgency): Priority {
  return urgencyToPriority[urgency as keyof typeof urgencyToPriority] as Priority;
}

// ==================== TASK ADAPTERS ====================

/**
 * Convert frontend Task to backend CreateTaskRequest
 */
export function taskToCreateRequest(task: Partial<Task>): CreateTaskRequest {
  return {
    id: task.id!,
    goalId: task.goalId!,
    name: task.text!,
    urgency: task.priority ? convertPriorityToUrgency(task.priority) : null,
    todaysFocus: task.isToday ?? false,
  };
}

/**
 * Convert frontend Task to backend UpdateTaskRequest
 */
export function taskToUpdateRequest(task: Partial<Task>): UpdateTaskRequest {
  const request: UpdateTaskRequest = {};
  
  if (task.text !== undefined) request.name = task.text;
  if (task.priority !== undefined) request.urgency = convertPriorityToUrgency(task.priority);
  if (task.isCompleted !== undefined) request.completed = task.isCompleted;
  if (task.isToday !== undefined) request.todaysFocus = task.isToday;
  
  return request;
}

/**
 * Convert backend Task to frontend Task (with metadata)
 */
export function backendTaskToFrontend(
  backendTask: BackendTask,
  metadata?: TaskMetadata
): Task {
  return {
    id: backendTask.id,
    goalId: backendTask.goalId,
    text: backendTask.name,
    description: metadata?.description ?? null,
    priority: convertUrgencyToPriority(backendTask.urgency),
    isCompleted: backendTask.completed,
    isToday: backendTask.todaysFocus,
    orderIndex: metadata?.orderIndex ?? 0,
    createdAt: backendTask.createdAt,
    updatedAt: backendTask.updatedAt,
    completedAt: backendTask.completedAt,
  };
}

/**
 * Extract task metadata for localStorage
 */
export function extractTaskMetadata(task: Task): TaskMetadata {
  return {
    description: task.description,
    orderIndex: task.orderIndex,
  };
}

// ==================== GOAL ADAPTERS ====================

/**
 * Convert frontend Goal to backend CreateGoalRequest
 */
export function goalToCreateRequest(goal: Partial<Goal>): CreateGoalRequest {
  return {
    id: goal.id!,
    projectId: goal.trackId!,
    name: goal.name!,
  };
}

/**
 * Convert frontend Goal to backend UpdateGoalRequest
 */
export function goalToUpdateRequest(goal: Partial<Goal>): UpdateGoalRequest {
  const request: UpdateGoalRequest = {};
  
  if (goal.name !== undefined) request.name = goal.name;
  if (goal.isCompleted !== undefined) request.completed = goal.isCompleted;
  
  return request;
}

/**
 * Convert backend Goal to frontend Goal (with metadata)
 */
export function backendGoalToFrontend(
  backendGoal: BackendGoal,
  metadata?: GoalMetadata,
  tasks: Task[] = []
): Goal {
  return {
    id: backendGoal.id,
    trackId: backendGoal.projectId,
    name: backendGoal.name,
    description: metadata?.description ?? null,
    isCompleted: backendGoal.completed,
    orderIndex: metadata?.orderIndex ?? 0,
    tasks,
    createdAt: backendGoal.createdAt,
    updatedAt: backendGoal.updatedAt,
    completedAt: backendGoal.completedAt,
  };
}

/**
 * Extract goal metadata for localStorage
 */
export function extractGoalMetadata(goal: Goal): GoalMetadata {
  return {
    description: goal.description,
    orderIndex: goal.orderIndex,
  };
}

// ==================== TRACK/PROJECT ADAPTERS ====================

/**
 * Convert frontend Track to backend CreateProjectRequest
 */
export function trackToCreateRequest(track: Partial<Track>): CreateProjectRequest {
  return {
    id: track.id!,
    name: track.name!,
  };
}

/**
 * Convert frontend Track to backend UpdateProjectRequest
 */
export function trackToUpdateRequest(track: Partial<Track>): UpdateProjectRequest {
  const request: UpdateProjectRequest = {};
  
  if (track.name !== undefined) request.name = track.name;
  
  return request;
}

/**
 * Convert backend Project to frontend Track (with metadata)
 */
export function backendProjectToTrack(
  backendProject: BackendProject,
  metadata?: TrackMetadata,
  goals: Goal[] = []
): Track {
  return {
    id: backendProject.id,
    userId: backendProject.userId ?? 0,
    name: backendProject.name,
    color: metadata?.color ?? 'teal',
    notes: metadata?.notes ?? null,
    context: metadata?.context ?? null,
    orderIndex: metadata?.orderIndex ?? 0,
    goals,
    createdAt: backendProject.createdAt,
    updatedAt: backendProject.updatedAt,
  };
}

/**
 * Extract track metadata for localStorage
 */
export function extractTrackMetadata(track: Track): TrackMetadata {
  return {
    color: track.color,
    notes: track.notes,
    context: track.context,
    orderIndex: track.orderIndex,
  };
}

// ==================== NESTED DATA ADAPTERS ====================

/**
 * Convert backend ProjectWithGoalsAndTasks to frontend Track
 */
export function backendProjectWithDataToTrack(
  backendProject: BackendProjectWithGoalsAndTasks,
  trackMetadata?: TrackMetadata,
  goalsMetadata?: Record<string, GoalMetadata>,
  tasksMetadata?: Record<string, TaskMetadata>
): Track {
  // Convert tasks first
  const goalMap = new Map<string, Goal>();
  
  for (const backendGoal of backendProject.goals) {
    const tasks = backendGoal.tasks.map(backendTask =>
      backendTaskToFrontend(
        backendTask,
        tasksMetadata?.[backendTask.id]
      )
    );
    
    const goal = backendGoalToFrontend(
      backendGoal,
      goalsMetadata?.[backendGoal.id],
      tasks
    );
    
    goalMap.set(goal.id, goal);
  }
  
  const goals = Array.from(goalMap.values());
  
  return backendProjectToTrack(
    backendProject,
    trackMetadata,
    goals
  );
}

// ==================== BATCH OPERATIONS ====================

/**
 * Convert multiple backend projects to frontend tracks
 */
export function backendProjectsToTracks(
  backendProjects: BackendProjectWithGoalsAndTasks[],
  tracksMetadata?: Record<string, TrackMetadata>,
  goalsMetadata?: Record<string, GoalMetadata>,
  tasksMetadata?: Record<string, TaskMetadata>
): Track[] {
  return backendProjects.map(project =>
    backendProjectWithDataToTrack(
      project,
      tracksMetadata?.[project.id],
      goalsMetadata,
      tasksMetadata
    )
  );
}

/**
 * Sort items by orderIndex (for client-side ordering)
 */
export function sortByOrderIndex<T extends { orderIndex: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}
