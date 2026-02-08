/**
 * REST API Client
 * 
 * Handles all HTTP requests to the FocusFlow backend REST API
 * Base URL: http://localhost:3001/api (development)
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
  ApiResponse,
  ApiErrorResponse,
} from '../types/backend';

// ==================== CONFIGURATION ====================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ==================== ERROR HANDLING ====================

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle API response and throw error if not successful
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    let errorDetails;
    
    try {
      const errorData = await response.json() as ApiErrorResponse;
      errorMessage = errorData.error || errorMessage;
      errorDetails = errorData.details;
    } catch {
      // If JSON parsing fails, use default error message
    }
    
    throw new ApiError(errorMessage, response.status, errorDetails);
  }
  
  const data = await response.json() as ApiResponse<T>;
  
  if (!data.success) {
    throw new ApiError(data.error || 'Unknown API error');
  }
  
  return data.data;
}

/**
 * Make a fetch request with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for authentication
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network error or other fetch error
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred'
    );
  }
}

// ==================== PROJECTS API ====================

export const projectsApi = {
  /**
   * Get all projects
   */
  async list(): Promise<BackendProject[]> {
    return fetchApi<BackendProject[]>('/projects');
  },
  
  /**
   * Get all projects with nested goals and tasks
   */
  async listWithGoalsAndTasks(): Promise<BackendProjectWithGoalsAndTasks[]> {
    return fetchApi<BackendProjectWithGoalsAndTasks[]>('/projects?include=goals,tasks');
  },
  
  /**
   * Get a single project by ID
   */
  async get(id: string): Promise<BackendProject> {
    return fetchApi<BackendProject>(`/projects/${id}`);
  },
  
  /**
   * Create a new project
   */
  async create(data: CreateProjectRequest): Promise<BackendProject> {
    return fetchApi<BackendProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Update an existing project
   */
  async update(id: string, data: UpdateProjectRequest): Promise<BackendProject> {
    return fetchApi<BackendProject>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    return fetchApi<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== GOALS API ====================

export const goalsApi = {
  /**
   * Get all goals for a project
   */
  async listByProject(projectId: string): Promise<BackendGoal[]> {
    return fetchApi<BackendGoal[]>(`/goals?projectId=${projectId}`);
  },
  
  /**
   * Get a single goal by ID
   */
  async get(id: string): Promise<BackendGoal> {
    return fetchApi<BackendGoal>(`/goals/${id}`);
  },
  
  /**
   * Create a new goal
   */
  async create(data: CreateGoalRequest): Promise<BackendGoal> {
    return fetchApi<BackendGoal>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Update an existing goal
   */
  async update(id: string, data: UpdateGoalRequest): Promise<BackendGoal> {
    return fetchApi<BackendGoal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Mark a goal as completed
   */
  async complete(id: string): Promise<BackendGoal> {
    return fetchApi<BackendGoal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: true }),
    });
  },
  
  /**
   * Delete a goal
   */
  async delete(id: string): Promise<void> {
    return fetchApi<void>(`/goals/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== TASKS API ====================

export const tasksApi = {
  /**
   * Get all tasks for a goal
   */
  async listByGoal(goalId: string): Promise<BackendTask[]> {
    return fetchApi<BackendTask[]>(`/tasks?goalId=${goalId}`);
  },
  
  /**
   * Get today's focus tasks
   */
  async listToday(): Promise<BackendTask[]> {
    return fetchApi<BackendTask[]>('/tasks/today');
  },
  
  /**
   * Get a single task by ID
   */
  async get(id: string): Promise<BackendTask> {
    return fetchApi<BackendTask>(`/tasks/${id}`);
  },
  
  /**
   * Create a new task
   */
  async create(data: CreateTaskRequest): Promise<BackendTask> {
    return fetchApi<BackendTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Update an existing task
   */
  async update(id: string, data: UpdateTaskRequest): Promise<BackendTask> {
    return fetchApi<BackendTask>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Set task priority (urgency)
   */
  async setPriority(
    id: string,
    urgency: 'LAAG' | 'MIDDEN' | 'HOOG' | null
  ): Promise<BackendTask> {
    return fetchApi<BackendTask>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ urgency }),
    });
  },
  
  /**
   * Set task as today's focus
   */
  async setToday(id: string, todaysFocus: boolean): Promise<BackendTask> {
    return fetchApi<BackendTask>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ todaysFocus }),
    });
  },
  
  /**
   * Mark a task as completed
   */
  async complete(id: string): Promise<BackendTask> {
    return fetchApi<BackendTask>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: true }),
    });
  },
  
  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    return fetchApi<void>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== HEALTH CHECK ====================

export const healthApi = {
  /**
   * Check if the API is healthy
   */
  async check(): Promise<{ status: string; timestamp: string }> {
    return fetchApi<{ status: string; timestamp: string }>('/health');
  },
};

// ==================== BATCH OPERATIONS ====================

/**
 * Batch create multiple projects
 */
export async function batchCreateProjects(
  projects: CreateProjectRequest[]
): Promise<BackendProject[]> {
  const results = await Promise.all(
    projects.map(project => projectsApi.create(project))
  );
  return results;
}

/**
 * Batch create multiple goals
 */
export async function batchCreateGoals(
  goals: CreateGoalRequest[]
): Promise<BackendGoal[]> {
  const results = await Promise.all(
    goals.map(goal => goalsApi.create(goal))
  );
  return results;
}

/**
 * Batch create multiple tasks
 */
export async function batchCreateTasks(
  tasks: CreateTaskRequest[]
): Promise<BackendTask[]> {
  const results = await Promise.all(
    tasks.map(task => tasksApi.create(task))
  );
  return results;
}

// ==================== EXPORT ====================

export const api = {
  projects: projectsApi,
  goals: goalsApi,
  tasks: tasksApi,
  health: healthApi,
};

export default api;
