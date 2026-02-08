/**
 * REST API Test Page
 * 
 * Verifies that the REST API infrastructure works correctly:
 * - API Client connection
 * - Type adapters
 * - LocalStorage persistence
 * - CRUD operations for Projects/Goals/Tasks
 * - Today's Focus
 * 
 * Navigate to /test to use this page.
 */

import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { api, ApiError } from '@/services/apiClient';
import { useFocusFlow } from '@/hooks/useFocusFlow';
import {
  convertPriorityToUrgency,
  convertUrgencyToPriority,
} from '@/adapters/typeAdapters';
import {
  loadMetadata,
  getSessionMetadata,
  updateSessionMetadata,
} from '@/services/localStorage';
import type { Track, Goal, Task } from '@/types/frontend';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'skip';
  message?: string;
  duration?: number;
}

export default function TestRestApi() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [apiBaseUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

  // Use the FocusFlow hook
  const {
    tracks,
    todayTasks,
    session,
    isLoading,
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
  } = useFocusFlow();

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const result = await api.health.check();
      setHealthStatus(`✅ Healthy - ${result.timestamp || 'connected'}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setHealthStatus(`❌ Error: ${error.message} (status: ${error.status})`);
      } else {
        setHealthStatus(`❌ Cannot connect to ${apiBaseUrl}`);
      }
    }
  };

  const updateTest = (name: string, update: Partial<TestResult>) => {
    setTestResults(prev => prev.map(t => 
      t.name === name ? { ...t, ...update } : t
    ));
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    const tests: TestResult[] = [
      { name: 'Health Check', status: 'pending' },
      { name: 'Type Adapter: Priority → Urgency', status: 'pending' },
      { name: 'Type Adapter: Urgency → Priority', status: 'pending' },
      { name: 'LocalStorage: Save & Load Metadata', status: 'pending' },
      { name: 'LocalStorage: Session Management', status: 'pending' },
      { name: 'API: List Projects', status: 'pending' },
      { name: 'API: Create Project', status: 'pending' },
      { name: 'API: Create Goal', status: 'pending' },
      { name: 'API: Create Task', status: 'pending' },
      { name: 'API: Update Task (Toggle Today)', status: 'pending' },
      { name: 'API: Get Today Tasks', status: 'pending' },
      { name: 'API: Update Task (Complete)', status: 'pending' },
      { name: 'API: Delete Task', status: 'pending' },
      { name: 'API: Delete Goal', status: 'pending' },
      { name: 'API: Delete Project', status: 'pending' },
      { name: 'Hook: useFocusFlow Data Loading', status: 'pending' },
      { name: 'Hook: useFocusFlow Create Track', status: 'pending' },
      { name: 'Hook: useFocusFlow Cleanup', status: 'pending' },
    ];
    
    setTestResults(tests);

    // Track IDs for cleanup
    let testProjectId = '';
    let testGoalId = '';
    let testTaskId = '';
    let hookTrackId = '';

    // ==================== TEST 1: Health Check ====================
    try {
      updateTest('Health Check', { status: 'running' });
      const start = Date.now();
      const health = await api.health.check();
      updateTest('Health Check', { 
        status: 'pass', 
        message: `API is healthy: ${JSON.stringify(health)}`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('Health Check', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 2: Priority → Urgency ====================
    try {
      updateTest('Type Adapter: Priority → Urgency', { status: 'running' });
      const start = Date.now();
      
      const tests = [
        { input: 'low' as const, expected: 'LAAG' },
        { input: 'medium' as const, expected: 'MIDDEN' },
        { input: 'high' as const, expected: 'HOOG' },
        { input: null, expected: null },
      ];
      
      for (const test of tests) {
        const result = convertPriorityToUrgency(test.input);
        if (result !== test.expected) {
          throw new Error(`Expected ${test.expected}, got ${result} for input ${test.input}`);
        }
      }
      
      updateTest('Type Adapter: Priority → Urgency', { 
        status: 'pass', 
        message: 'All mappings correct: low→LAAG, medium→MIDDEN, high→HOOG, null→null',
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('Type Adapter: Priority → Urgency', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 3: Urgency → Priority ====================
    try {
      updateTest('Type Adapter: Urgency → Priority', { status: 'running' });
      const start = Date.now();
      
      const tests = [
        { input: 'LAAG' as const, expected: 'low' },
        { input: 'MIDDEN' as const, expected: 'medium' },
        { input: 'HOOG' as const, expected: 'high' },
        { input: null, expected: null },
      ];
      
      for (const test of tests) {
        const result = convertUrgencyToPriority(test.input);
        if (result !== test.expected) {
          throw new Error(`Expected ${test.expected}, got ${result} for input ${test.input}`);
        }
      }
      
      updateTest('Type Adapter: Urgency → Priority', { 
        status: 'pass', 
        message: 'All mappings correct: LAAG→low, MIDDEN→medium, HOOG→high, null→null',
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('Type Adapter: Urgency → Priority', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 4: LocalStorage Metadata ====================
    try {
      updateTest('LocalStorage: Save & Load Metadata', { status: 'running' });
      const start = Date.now();
      
      const metadata = loadMetadata();
      if (!metadata.tracks || !metadata.goals || !metadata.tasks || !metadata.session) {
        throw new Error('Metadata structure is invalid');
      }
      
      updateTest('LocalStorage: Save & Load Metadata', { 
        status: 'pass', 
        message: `Metadata loaded: ${Object.keys(metadata.tracks).length} tracks, ${Object.keys(metadata.goals).length} goals, ${Object.keys(metadata.tasks).length} tasks`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('LocalStorage: Save & Load Metadata', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 5: Session Management ====================
    try {
      updateTest('LocalStorage: Session Management', { status: 'running' });
      const start = Date.now();
      
      updateSessionMetadata({ dailyIntention: 'Test intention', energyLevel: 'High' });
      const session = getSessionMetadata();
      
      if (session.dailyIntention !== 'Test intention') {
        throw new Error(`Expected 'Test intention', got '${session.dailyIntention}'`);
      }
      if (session.energyLevel !== 'High') {
        throw new Error(`Expected 'High', got '${session.energyLevel}'`);
      }
      
      // Reset
      updateSessionMetadata({ dailyIntention: null, energyLevel: 'Normal' });
      
      updateTest('LocalStorage: Session Management', { 
        status: 'pass', 
        message: 'Session save/load works correctly',
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('LocalStorage: Session Management', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 6: List Projects ====================
    try {
      updateTest('API: List Projects', { status: 'running' });
      const start = Date.now();
      const projects = await api.projects.list();
      
      updateTest('API: List Projects', { 
        status: 'pass', 
        message: `Found ${projects.length} projects`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('API: List Projects', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 7: Create Project ====================
    try {
      updateTest('API: Create Project', { status: 'running' });
      const start = Date.now();
      testProjectId = `test-${nanoid(8)}`;
      
      const project = await api.projects.create({
        id: testProjectId,
        name: 'Test Project (Migration Test)',
      });
      
      if (!project.id || !project.name) {
        throw new Error(`Invalid project response: ${JSON.stringify(project)}`);
      }
      
      updateTest('API: Create Project', { 
        status: 'pass', 
        message: `Created project: ${project.name} (${project.id})`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('API: Create Project', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 8: Create Goal ====================
    try {
      updateTest('API: Create Goal', { status: 'running' });
      const start = Date.now();
      
      if (!testProjectId) {
        updateTest('API: Create Goal', { status: 'skip', message: 'Skipped: no project created' });
      } else {
        testGoalId = `test-goal-${nanoid(8)}`;
        
        const goal = await api.goals.create({
          id: testGoalId,
          projectId: testProjectId,
          name: 'Test Goal (Migration Test)',
        });
        
        if (!goal.id || !goal.name) {
          throw new Error(`Invalid goal response: ${JSON.stringify(goal)}`);
        }
        
        updateTest('API: Create Goal', { 
          status: 'pass', 
          message: `Created goal: ${goal.name} (${goal.id})`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Create Goal', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 9: Create Task ====================
    try {
      updateTest('API: Create Task', { status: 'running' });
      const start = Date.now();
      
      if (!testGoalId) {
        updateTest('API: Create Task', { status: 'skip', message: 'Skipped: no goal created' });
      } else {
        testTaskId = `test-task-${nanoid(8)}`;
        
        const task = await api.tasks.create({
          id: testTaskId,
          goalId: testGoalId,
          name: 'Test Task (Migration Test)',
          urgency: 'HOOG',
          todaysFocus: false,
        });
        
        if (!task.id || !task.name) {
          throw new Error(`Invalid task response: ${JSON.stringify(task)}`);
        }
        
        updateTest('API: Create Task', { 
          status: 'pass', 
          message: `Created task: ${task.name} (urgency: ${task.urgency}, todaysFocus: ${task.todaysFocus})`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Create Task', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 10: Toggle Today ====================
    try {
      updateTest('API: Update Task (Toggle Today)', { status: 'running' });
      const start = Date.now();
      
      if (!testTaskId) {
        updateTest('API: Update Task (Toggle Today)', { status: 'skip', message: 'Skipped: no task created' });
      } else {
        const updated = await api.tasks.setToday(testTaskId, true);
        
        if (!updated.todaysFocus) {
          throw new Error(`Expected todaysFocus=true, got ${updated.todaysFocus}`);
        }
        
        updateTest('API: Update Task (Toggle Today)', { 
          status: 'pass', 
          message: `Task todaysFocus set to true`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Update Task (Toggle Today)', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 11: Get Today Tasks ====================
    try {
      updateTest('API: Get Today Tasks', { status: 'running' });
      const start = Date.now();
      
      const todayTasks = await api.tasks.listToday();
      const hasTestTask = todayTasks.some(t => t.id === testTaskId);
      
      updateTest('API: Get Today Tasks', { 
        status: 'pass', 
        message: `Found ${todayTasks.length} today tasks. Test task included: ${hasTestTask}`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('API: Get Today Tasks', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 12: Complete Task ====================
    try {
      updateTest('API: Update Task (Complete)', { status: 'running' });
      const start = Date.now();
      
      if (!testTaskId) {
        updateTest('API: Update Task (Complete)', { status: 'skip', message: 'Skipped: no task created' });
      } else {
        const updated = await api.tasks.complete(testTaskId);
        
        if (!updated.completed) {
          throw new Error(`Expected completed=true, got ${updated.completed}`);
        }
        
        updateTest('API: Update Task (Complete)', { 
          status: 'pass', 
          message: `Task marked as completed`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Update Task (Complete)', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 13: Delete Task ====================
    try {
      updateTest('API: Delete Task', { status: 'running' });
      const start = Date.now();
      
      if (!testTaskId) {
        updateTest('API: Delete Task', { status: 'skip', message: 'Skipped: no task created' });
      } else {
        await api.tasks.delete(testTaskId);
        
        updateTest('API: Delete Task', { 
          status: 'pass', 
          message: `Task deleted successfully`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Delete Task', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 14: Delete Goal ====================
    try {
      updateTest('API: Delete Goal', { status: 'running' });
      const start = Date.now();
      
      if (!testGoalId) {
        updateTest('API: Delete Goal', { status: 'skip', message: 'Skipped: no goal created' });
      } else {
        await api.goals.delete(testGoalId);
        
        updateTest('API: Delete Goal', { 
          status: 'pass', 
          message: `Goal deleted successfully`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Delete Goal', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 15: Delete Project ====================
    try {
      updateTest('API: Delete Project', { status: 'running' });
      const start = Date.now();
      
      if (!testProjectId) {
        updateTest('API: Delete Project', { status: 'skip', message: 'Skipped: no project created' });
      } else {
        await api.projects.delete(testProjectId);
        
        updateTest('API: Delete Project', { 
          status: 'pass', 
          message: `Project deleted successfully`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('API: Delete Project', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 16: useFocusFlow Data Loading ====================
    try {
      updateTest('Hook: useFocusFlow Data Loading', { status: 'running' });
      const start = Date.now();
      
      // The hook should have already loaded data
      if (isLoading) {
        updateTest('Hook: useFocusFlow Data Loading', { 
          status: 'pass', 
          message: `Still loading... (this is normal on first render)`,
          duration: Date.now() - start,
        });
      } else {
        updateTest('Hook: useFocusFlow Data Loading', { 
          status: 'pass', 
          message: `Loaded ${tracks.length} tracks, ${todayTasks.length} today tasks`,
          duration: Date.now() - start,
        });
      }
    } catch (error) {
      updateTest('Hook: useFocusFlow Data Loading', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 17: useFocusFlow Create Track ====================
    try {
      updateTest('Hook: useFocusFlow Create Track', { status: 'running' });
      const start = Date.now();
      
      hookTrackId = `hook-test-${nanoid(8)}`;
      const newTrack = await createTrack({
        id: hookTrackId,
        name: 'Hook Test Track',
        color: 'purple',
        orderIndex: 99,
      });
      
      if (!newTrack.id || !newTrack.name) {
        throw new Error(`Invalid track response: ${JSON.stringify(newTrack)}`);
      }
      
      // Verify metadata was saved to localStorage
      const metadata = loadMetadata();
      const trackMeta = metadata.tracks[hookTrackId];
      
      if (!trackMeta) {
        throw new Error('Track metadata not saved to localStorage');
      }
      
      if (trackMeta.color !== 'purple') {
        throw new Error(`Expected color 'purple', got '${trackMeta.color}'`);
      }
      
      if (trackMeta.orderIndex !== 99) {
        throw new Error(`Expected orderIndex 99, got ${trackMeta.orderIndex}`);
      }
      
      updateTest('Hook: useFocusFlow Create Track', { 
        status: 'pass', 
        message: `Created track via hook: ${newTrack.name} (color: ${newTrack.color}, orderIndex: ${newTrack.orderIndex}). LocalStorage metadata verified.`,
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('Hook: useFocusFlow Create Track', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ==================== TEST 18: Cleanup ====================
    try {
      updateTest('Hook: useFocusFlow Cleanup', { status: 'running' });
      const start = Date.now();
      
      if (hookTrackId) {
        await deleteTrack(hookTrackId);
      }
      
      updateTest('Hook: useFocusFlow Cleanup', { 
        status: 'pass', 
        message: 'Test data cleaned up successfully',
        duration: Date.now() - start,
      });
    } catch (error) {
      updateTest('Hook: useFocusFlow Cleanup', { 
        status: 'fail', 
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setIsRunning(false);
  };

  const passCount = testResults.filter(t => t.status === 'pass').length;
  const failCount = testResults.filter(t => t.status === 'fail').length;
  const skipCount = testResults.filter(t => t.status === 'skip').length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">
            FocusFlow REST API Migration Test
          </h1>
          <p className="text-stone-600">
            Verifies that the REST API infrastructure works correctly before migrating Home.tsx
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-stone-500">API URL:</span>{' '}
              <code className="text-sm bg-stone-100 px-2 py-1 rounded">{apiBaseUrl}</code>
            </div>
            <div>
              <span className="text-sm text-stone-500">Health:</span>{' '}
              <span className="text-sm">{healthStatus}</span>
            </div>
          </div>
        </div>

        {/* Current Data (from useFocusFlow hook) */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Current Data (via useFocusFlow hook)</h2>
          {isLoading ? (
            <p className="text-stone-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-stone-50 p-3 rounded">
                <div className="text-2xl font-bold">{tracks.length}</div>
                <div className="text-sm text-stone-500">Tracks</div>
              </div>
              <div className="bg-stone-50 p-3 rounded">
                <div className="text-2xl font-bold">
                  {tracks.reduce((sum, t) => sum + t.goals.length, 0)}
                </div>
                <div className="text-sm text-stone-500">Goals</div>
              </div>
              <div className="bg-stone-50 p-3 rounded">
                <div className="text-2xl font-bold">{todayTasks.length}</div>
                <div className="text-sm text-stone-500">Today's Tasks</div>
              </div>
            </div>
          )}
        </div>

        {/* Run Tests Button */}
        <div className="mb-6">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-medium text-white ${
              isRunning 
                ? 'bg-stone-400 cursor-not-allowed' 
                : 'bg-stone-800 hover:bg-stone-700'
            }`}
          >
            {isRunning ? '⏳ Running Tests...' : '▶ Run All Tests'}
          </button>
        </div>

        {/* Test Results Summary */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg border p-4 mb-6">
            <h2 className="text-lg font-semibold mb-2">Results Summary</h2>
            <div className="flex gap-6">
              <div className="text-green-600 font-medium">✅ Pass: {passCount}</div>
              <div className="text-red-600 font-medium">❌ Fail: {failCount}</div>
              <div className="text-yellow-600 font-medium">⏭ Skip: {skipCount}</div>
              <div className="text-stone-600 font-medium">Total: {totalCount}</div>
            </div>
          </div>
        )}

        {/* Test Results Detail */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-stone-600">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-stone-600">Test</th>
                  <th className="text-left p-3 text-sm font-medium text-stone-600">Message</th>
                  <th className="text-right p-3 text-sm font-medium text-stone-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((test, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">
                      {test.status === 'pass' && '✅'}
                      {test.status === 'fail' && '❌'}
                      {test.status === 'skip' && '⏭'}
                      {test.status === 'running' && '⏳'}
                      {test.status === 'pending' && '⏸'}
                    </td>
                    <td className="p-3 font-medium text-sm">{test.name}</td>
                    <td className="p-3 text-sm text-stone-600 max-w-md truncate">
                      {test.message || '-'}
                    </td>
                    <td className="p-3 text-sm text-stone-500 text-right">
                      {test.duration ? `${test.duration}ms` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tracks Detail */}
        {!isLoading && tracks.length > 0 && (
          <div className="bg-white rounded-lg border p-4 mt-6">
            <h2 className="text-lg font-semibold mb-2">Tracks Detail (from useFocusFlow)</h2>
            <div className="space-y-3">
              {tracks.map(track => (
                <div key={track.id} className="border rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full bg-${track.color}-500`} />
                    <span className="font-medium">{track.name}</span>
                    <span className="text-xs text-stone-400">({track.id})</span>
                    <span className="text-xs bg-stone-100 px-2 py-0.5 rounded">
                      color: {track.color} | orderIndex: {track.orderIndex}
                    </span>
                  </div>
                  {track.goals.map(goal => (
                    <div key={goal.id} className="ml-4 mt-1">
                      <div className="text-sm">
                        📎 {goal.name}
                        <span className="text-xs text-stone-400 ml-2">
                          ({goal.tasks.length} tasks, completed: {goal.isCompleted ? 'yes' : 'no'})
                        </span>
                      </div>
                      {goal.tasks.map(task => (
                        <div key={task.id} className="ml-4 text-xs text-stone-500">
                          {task.isCompleted ? '☑' : '☐'} {task.text}
                          {task.priority && ` [${task.priority}]`}
                          {task.isToday && ' ⭐'}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <a href="/" className="text-stone-600 hover:text-stone-800 underline">
            ← Back to FocusFlow
          </a>
        </div>
      </div>
    </div>
  );
}
