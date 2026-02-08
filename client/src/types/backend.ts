/**
 * Backend REST API Type Definitions
 * 
 * These types match the REST API backend schema (Prisma)
 * They differ from the frontend types which have additional metadata
 */

// ==================== BACKEND TYPES ====================

export interface BackendProject {
  id: string;
  name: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendGoal {
  id: string;
  projectId: string;
  name: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface BackendTask {
  id: string;
  goalId: string;
  name: string;
  urgency: 'LAAG' | 'MIDDEN' | 'HOOG' | null;
  completed: boolean;
  todaysFocus: boolean;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

// ==================== REQUEST TYPES ====================

export interface CreateProjectRequest {
  id: string;
  name: string;
}

export interface UpdateProjectRequest {
  name?: string;
}

export interface CreateGoalRequest {
  id: string;
  projectId: string;
  name: string;
}

export interface UpdateGoalRequest {
  name?: string;
  completed?: boolean;
}

export interface CreateTaskRequest {
  id: string;
  goalId: string;
  name: string;
  urgency?: 'LAAG' | 'MIDDEN' | 'HOOG' | null;
  todaysFocus?: boolean;
}

export interface UpdateTaskRequest {
  name?: string;
  urgency?: 'LAAG' | 'MIDDEN' | 'HOOG' | null;
  completed?: boolean;
  todaysFocus?: boolean;
}

// ==================== NESTED RESPONSE TYPES ====================

export interface BackendProjectWithGoals extends BackendProject {
  goals: BackendGoal[];
}

export interface BackendGoalWithTasks extends BackendGoal {
  tasks: BackendTask[];
}

export interface BackendProjectWithGoalsAndTasks extends BackendProject {
  goals: BackendGoalWithTasks[];
}

export interface BackendTaskWithRelations extends BackendTask {
  goal?: BackendGoal;
  project?: BackendProject;
}
