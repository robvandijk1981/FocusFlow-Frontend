/**
 * FocusFlow Data Hook
 * 
 * Custom React hook that replaces tRPC with REST API calls
 * Manages data fetching, mutations, and localStorage metadata sync
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/apiClient';
import {
  backendProjectsToTracks,
  backendTaskToFrontend,
  trackToCreateRequest,
  trackToUpdateRequest,
  goalToCreateRequest,
  goalToUpdateRequest,
  taskToCreateRequest,
  taskToUpdateRequest,
  extractTrackMetadata,
  extractGoalMetadata,
  extractTaskMetadata,
  convertPriorityToUrgency,
  sortByOrderIndex,
} from '../adapters/typeAdapters';
import {
  loadMetadata,
  saveTrackMetadataFromTrack,
  saveGoalMetadataFromGoal,
  saveTaskMetadataFromTask,
  deleteTrackMetadata,
  deleteGoalMetadata,
  deleteTaskMetadata,
  getSessionMetadata,
  updateSessionMetadata,
} from '../services/localStorage';
import type { Track, Goal, Task, TaskWithRelations } from '../types/frontend';
import type { BackendTask } from '../types/backend';

interface UseFocusFlowReturn {
  // Data
  tracks: Track[];
  todayTasks: TaskWithRelations[];
  session: ReturnType<typeof getSessionMetadata>;
  
  // Loading states
  isLoading: boolean;
  isRefetching: boolean;
  
  // Mutations
  createTrack: (data: Partial<Track>) => Promise<Track>;
  updateTrack: (id: string, data: Partial<Track>) => Promise<Track>;
  deleteTrack: (id: string) => Promise<void>;
  
  createGoal: (data: Partial<Goal>) => Promise<Goal>;
  updateGoal: (id: string, data: Partial<Goal>) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  
  createTask: (data: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  
  updateSession: (data: Partial<ReturnType<typeof getSessionMetadata>>) => void;
  
  // Refetch
  refetch: () => Promise<void>;
}

export function useFocusFlow(): UseFocusFlowReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskWithRelations[]>([]);
  const [session, setSession] = useState(getSessionMetadata());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  // ==================== FETCH DATA ====================

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      else setIsRefetching(true);

      // Load metadata from localStorage
      const metadata = loadMetadata();

      // Fetch projects with goals and tasks from backend
      const backendProjects = await api.projects.listWithGoalsAndTasks();

      // Convert to frontend tracks with metadata
      const frontendTracks = backendProjectsToTracks(
        backendProjects,
        metadata.tracks,
        metadata.goals,
        metadata.tasks
      );

      // Sort by orderIndex
      const sortedTracks = sortByOrderIndex(frontendTracks).map(track => ({
        ...track,
        goals: sortByOrderIndex(track.goals).map(goal => ({
          ...goal,
          tasks: sortByOrderIndex(goal.tasks),
        })),
      }));

      setTracks(sortedTracks);

      // Fetch today's tasks
      const backendTodayTasks = await api.tasks.listToday();
      
      // Convert to frontend tasks with relations
      const todayTasksWithRelations: TaskWithRelations[] = [];
      
      for (const backendTask of backendTodayTasks) {
        const task = backendTaskToFrontend(backendTask, metadata.tasks[backendTask.id]);
        
        // Find the goal and track for this task
        let trackId = '';
        let trackName = '';
        let goalName = '';
        
        for (const track of sortedTracks) {
          for (const goal of track.goals) {
            if (goal.id === task.goalId) {
              trackId = track.id;
              trackName = track.name;
              goalName = goal.name;
              break;
            }
          }
          if (trackId) break;
        }
        
        todayTasksWithRelations.push({
          ...task,
          trackId,
          trackName,
          goalName,
        });
      }
      
      setTodayTasks(todayTasksWithRelations);
      
      // Load session from localStorage
      setSession(getSessionMetadata());
    } catch (error) {
      console.error('Failed to fetch data:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==================== TRACK MUTATIONS ====================

  const createTrack = useCallback(async (data: Partial<Track>): Promise<Track> => {
    const request = trackToCreateRequest(data);
    const backendProject = await api.projects.create(request);
    
    const newTrack: Track = {
      id: backendProject.id,
      userId: backendProject.userId ?? 0,
      name: backendProject.name,
      color: data.color ?? 'teal',
      notes: data.notes ?? null,
      context: data.context ?? null,
      orderIndex: data.orderIndex ?? 0,
      goals: [],
      createdAt: backendProject.createdAt,
      updatedAt: backendProject.updatedAt,
    };
    
    // Save metadata to localStorage
    saveTrackMetadataFromTrack(newTrack);
    
    // Update local state
    setTracks(prev => [...prev, newTrack]);
    
    return newTrack;
  }, []);

  const updateTrack = useCallback(async (id: string, data: Partial<Track>): Promise<Track> => {
    // Update backend (only name)
    if (data.name !== undefined) {
      const request = trackToUpdateRequest(data);
      await api.projects.update(id, request);
    }
    
    // Update metadata in localStorage (color, notes, context, orderIndex)
    const track = tracks.find(t => t.id === id);
    if (track) {
      const updatedTrack = { ...track, ...data };
      saveTrackMetadataFromTrack(updatedTrack);
      
      // Update local state
      setTracks(prev => prev.map(t => t.id === id ? updatedTrack : t));
      
      return updatedTrack;
    }
    
    throw new Error('Track not found');
  }, [tracks]);

  const deleteTrack = useCallback(async (id: string): Promise<void> => {
    await api.projects.delete(id);
    deleteTrackMetadata(id);
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  // ==================== GOAL MUTATIONS ====================

  const createGoal = useCallback(async (data: Partial<Goal>): Promise<Goal> => {
    const request = goalToCreateRequest(data);
    const backendGoal = await api.goals.create(request);
    
    const newGoal: Goal = {
      id: backendGoal.id,
      trackId: backendGoal.projectId,
      name: backendGoal.name,
      description: data.description ?? null,
      isCompleted: backendGoal.completed,
      orderIndex: data.orderIndex ?? 0,
      tasks: [],
      createdAt: backendGoal.createdAt,
      updatedAt: backendGoal.updatedAt,
      completedAt: backendGoal.completedAt,
    };
    
    // Save metadata to localStorage
    saveGoalMetadataFromGoal(newGoal);
    
    // Update local state
    setTracks(prev => prev.map(t => 
      t.id === data.trackId 
        ? { ...t, goals: [...t.goals, newGoal] }
        : t
    ));
    
    return newGoal;
  }, []);

  const updateGoal = useCallback(async (id: string, data: Partial<Goal>): Promise<Goal> => {
    // Update backend (name, completed)
    const request = goalToUpdateRequest(data);
    const backendGoal = await api.goals.update(id, request);
    
    // Find the goal in tracks
    let updatedGoal: Goal | undefined;
    
    setTracks(prev => prev.map(track => {
      const goalIndex = track.goals.findIndex(g => g.id === id);
      if (goalIndex !== -1) {
        const goal = track.goals[goalIndex];
        updatedGoal = {
          ...goal,
          name: backendGoal.name,
          isCompleted: backendGoal.completed,
          ...data,
        };
        
        // Save metadata to localStorage
        saveGoalMetadataFromGoal(updatedGoal);
        
        const newGoals = [...track.goals];
        newGoals[goalIndex] = updatedGoal;
        
        return { ...track, goals: newGoals };
      }
      return track;
    }));
    
    if (!updatedGoal) {
      throw new Error('Goal not found');
    }
    
    return updatedGoal;
  }, []);

  const deleteGoal = useCallback(async (id: string): Promise<void> => {
    await api.goals.delete(id);
    deleteGoalMetadata(id);
    setTracks(prev => prev.map(t => ({
      ...t,
      goals: t.goals.filter(g => g.id !== id),
    })));
  }, []);

  // ==================== TASK MUTATIONS ====================

  const createTask = useCallback(async (data: Partial<Task>): Promise<Task> => {
    const request = taskToCreateRequest(data);
    const backendTask = await api.tasks.create(request);
    
    const metadata = loadMetadata();
    const newTask = backendTaskToFrontend(backendTask, metadata.tasks[backendTask.id]);
    
    // Override with provided data
    const finalTask: Task = {
      ...newTask,
      description: data.description ?? null,
      orderIndex: data.orderIndex ?? 0,
    };
    
    // Save metadata to localStorage
    saveTaskMetadataFromTask(finalTask);
    
    // Update local state
    setTracks(prev => prev.map(track => ({
      ...track,
      goals: track.goals.map(goal => 
        goal.id === data.goalId
          ? { ...goal, tasks: [...goal.tasks, finalTask] }
          : goal
      ),
    })));
    
    return finalTask;
  }, []);

  const updateTask = useCallback(async (id: string, data: Partial<Task>): Promise<Task> => {
    // Update backend (name, urgency, completed, todaysFocus)
    const request = taskToUpdateRequest(data);
    const backendTask = await api.tasks.update(id, request);
    
    const metadata = loadMetadata();
    let updatedTask: Task | undefined;
    
    // Update local state
    setTracks(prev => prev.map(track => ({
      ...track,
      goals: track.goals.map(goal => ({
        ...goal,
        tasks: goal.tasks.map(task => {
          if (task.id === id) {
            updatedTask = {
              ...task,
              text: backendTask.name,
              priority: data.priority ?? task.priority,
              isCompleted: backendTask.completed,
              isToday: backendTask.todaysFocus,
              ...data,
            };
            
            // Save metadata to localStorage
            saveTaskMetadataFromTask(updatedTask);
            
            return updatedTask;
          }
          return task;
        }),
      })),
    })));
    
    // Also update today tasks if needed
    setTodayTasks(prev => prev.map(task => {
      if (task.id === id && updatedTask) {
        return { ...task, ...updatedTask };
      }
      return task;
    }));
    
    if (!updatedTask) {
      throw new Error('Task not found');
    }
    
    return updatedTask;
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    await api.tasks.delete(id);
    deleteTaskMetadata(id);
    
    setTracks(prev => prev.map(track => ({
      ...track,
      goals: track.goals.map(goal => ({
        ...goal,
        tasks: goal.tasks.filter(t => t.id !== id),
      })),
    })));
    
    setTodayTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // ==================== SESSION ====================

  const updateSession = useCallback((data: Partial<ReturnType<typeof getSessionMetadata>>) => {
    updateSessionMetadata(data);
    setSession(getSessionMetadata());
  }, []);

  // ==================== REFETCH ====================

  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  return {
    tracks,
    todayTasks,
    session,
    isLoading,
    isRefetching,
    createTrack,
    updateTrack,
    deleteTrack,
    createGoal,
    updateGoal,
    deleteGoal,
    createTask,
    updateTask,
    deleteTask,
    updateSession,
    refetch,
  };
}
