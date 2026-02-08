# FocusFlow tRPC to REST API Migration Analysis

## Executive Summary

This document outlines the complete migration strategy for FocusFlow from tRPC to REST API, including schema differences, type mappings, and implementation approach.

---

## 1. Schema Comparison

### Frontend (tRPC + Drizzle) vs Backend (REST + Prisma)

| Concept | Frontend | Backend | Mapping Strategy |
|---------|----------|---------|------------------|
| **Entity Name** | Track | Project | Direct rename in adapters |
| **Task Text** | `text` | `name` | Map `text` ↔ `name` |
| **Priority** | `priority` (low/medium/high) | `urgency` (LAAG/MIDDEN/HOOG) | Translate enum values |
| **Today Flag** | `isToday` | `todaysFocus` | Direct rename |
| **Completion** | `isCompleted` | `completed` | Direct rename |
| **Order** | `orderIndex` | ❌ Missing | Store in localStorage |
| **Colors** | `color` | ❌ Missing | Store in localStorage |
| **Notes** | `notes` | ❌ Missing | Store in localStorage |
| **Context** | `context` | ❌ Missing | Store in localStorage |
| **Descriptions** | `description` | ❌ Missing | Store in localStorage |

### Key Differences

**Frontend has MORE features:**
- `orderIndex` for drag-and-drop ordering
- `color` for visual track identification
- `notes` for free-form track notes
- `context` for AI-enhanced background info
- `description` fields on goals and tasks
- Track documents and dumps

**Backend is SIMPLER:**
- Only core CRUD operations
- Basic task management
- No AI features
- No file uploads
- No session management

---

## 2. API Endpoint Mapping

### Tracks → Projects

| tRPC Endpoint | REST Endpoint | Method | Notes |
|---------------|---------------|--------|-------|
| `tracks.list` | `/api/projects` | GET | Returns all projects |
| `tracks.listWithGoalsAndTasks` | `/api/projects?include=goals,tasks` | GET | Nested data |
| `tracks.get` | `/api/projects/:id` | GET | Single project |
| `tracks.create` | `/api/projects` | POST | Create project |
| `tracks.update` | `/api/projects/:id` | PUT | Update project |
| `tracks.delete` | `/api/projects/:id` | DELETE | Delete project |
| `tracks.bulkSync` | ❌ Not available | - | Implement client-side batch |

### Goals

| tRPC Endpoint | REST Endpoint | Method | Notes |
|---------------|---------------|--------|-------|
| `goals.listByTrack` | `/api/goals?projectId=:id` | GET | Filter by project |
| `goals.get` | `/api/goals/:id` | GET | Single goal |
| `goals.create` | `/api/goals` | POST | Create goal |
| `goals.update` | `/api/goals/:id` | PUT | Update goal |
| `goals.complete` | `/api/goals/:id` | PUT | Set completed=true |
| `goals.delete` | `/api/goals/:id` | DELETE | Delete goal |

### Tasks

| tRPC Endpoint | REST Endpoint | Method | Notes |
|---------------|---------------|--------|-------|
| `tasks.listByGoal` | `/api/tasks?goalId=:id` | GET | Filter by goal |
| `tasks.listToday` | `/api/tasks/today` | GET | Today's focus tasks |
| `tasks.get` | `/api/tasks/:id` | GET | Single task |
| `tasks.create` | `/api/tasks` | POST | Create task |
| `tasks.update` | `/api/tasks/:id` | PUT | Update task |
| `tasks.setPriority` | `/api/tasks/:id` | PUT | Update urgency field |
| `tasks.setToday` | `/api/tasks/:id` | PUT | Update todaysFocus |
| `tasks.complete` | `/api/tasks/:id` | PUT | Set completed=true |
| `tasks.delete` | `/api/tasks/:id` | DELETE | Delete task |

### AI Features (Not Available in Backend)

| tRPC Endpoint | Strategy |
|---------------|----------|
| `ai.extractTasks` | Keep client-side or disable |
| `ai.analyzeDump` | Keep client-side or disable |
| `ai.suggestTodaysFocus` | Keep client-side or disable |
| `ai.transcribe` | Keep client-side or disable |
| `ai.extractContext` | Keep client-side or disable |
| `ai.analyzeDocument` | Keep client-side or disable |
| `ai.suggestGoals` | Keep client-side or disable |
| `ai.chatWithContext` | Keep client-side or disable |

### Session Management (Not Available in Backend)

| tRPC Endpoint | Strategy |
|---------------|----------|
| `session.get` | Store in localStorage |
| `session.update` | Store in localStorage |
| `session.startDaily` | Store in localStorage |
| `session.setFocusMode` | Store in localStorage |
| `session.setCurrentTrack` | Store in localStorage |

---

## 3. Type Adapter Design

### Priority/Urgency Mapping

```typescript
// Frontend → Backend
const priorityToUrgency = {
  'low': 'LAAG',
  'medium': 'MIDDEN',
  'high': 'HOOG',
  null: null
} as const;

// Backend → Frontend
const urgencyToPriority = {
  'LAAG': 'low',
  'MIDDEN': 'medium',
  'HOOG': 'high',
  null: null
} as const;
```

### Track ↔ Project Adapter

```typescript
interface FrontendTrack {
  id: string;
  userId: number;
  name: string;
  color: string;
  notes: string | null;
  context: string | null;
  orderIndex: number;
  goals: Goal[];
}

interface BackendProject {
  id: string;
  name: string;
  goals?: Goal[];
}

// Adapter functions needed:
- trackToProject(track: FrontendTrack): BackendProject
- projectToTrack(project: BackendProject, metadata: LocalMetadata): FrontendTrack
```

### Task Adapter

```typescript
interface FrontendTask {
  id: string;
  goalId: string;
  text: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  isCompleted: boolean;
  isToday: boolean;
  orderIndex: number;
}

interface BackendTask {
  id: string;
  goalId: string;
  name: string;
  urgency: 'LAAG' | 'MIDDEN' | 'HOOG' | null;
  completed: boolean;
  todaysFocus: boolean;
}

// Adapter functions needed:
- taskToBackend(task: FrontendTask): BackendTask
- backendToTask(task: BackendTask, metadata: LocalMetadata): FrontendTask
```

---

## 4. LocalStorage Strategy

### Metadata Storage Structure

```typescript
interface LocalMetadata {
  tracks: {
    [trackId: string]: {
      color: string;
      notes: string | null;
      context: string | null;
      orderIndex: number;
    };
  };
  goals: {
    [goalId: string]: {
      description: string | null;
      orderIndex: number;
    };
  };
  tasks: {
    [taskId: string]: {
      description: string | null;
      orderIndex: number;
    };
  };
  session: {
    dailyIntention: string | null;
    energyLevel: 'Low' | 'Normal' | 'High';
    currentTrackId: string | null;
    focusMode: boolean;
    sessionStartTime: string | null;
    trackSwitchCount: number;
    lastActivity: string | null;
  };
  lastSync: string; // ISO timestamp
}
```

### Sync Strategy

1. **On Load**: Fetch from backend + merge with localStorage metadata
2. **On Create**: POST to backend + save metadata to localStorage
3. **On Update**: PUT to backend + update metadata in localStorage
4. **On Delete**: DELETE from backend + remove from localStorage
5. **Offline Mode**: Queue operations in localStorage, sync when online

---

## 5. Migration Implementation Plan

### Phase 1: Create Infrastructure (Current Phase)
- ✅ Analyze schema differences
- ⏳ Create type adapters module
- ⏳ Create localStorage manager
- ⏳ Create API client wrapper

### Phase 2: Replace tRPC Calls
- Replace all `trpc.tracks.*` with REST API calls
- Replace all `trpc.goals.*` with REST API calls
- Replace all `trpc.tasks.*` with REST API calls
- Handle AI features (keep client-side or disable)
- Handle session management (move to localStorage)

### Phase 3: Testing
- Test CRUD operations for tracks/projects
- Test CRUD operations for goals
- Test CRUD operations for tasks
- Test Today's Focus functionality
- Test drag-and-drop with orderIndex
- Test offline mode with localStorage fallback

### Phase 4: Documentation
- Create deployment guide
- Document API configuration
- Create migration checklist

---

## 6. Risk Assessment

### High Risk
- **Data Loss**: Metadata not persisted to backend could be lost
  - *Mitigation*: Robust localStorage backup, export/import functionality
- **Sync Issues**: Backend and localStorage could get out of sync
  - *Mitigation*: Timestamp-based conflict resolution, sync validation

### Medium Risk
- **AI Features**: May not work without backend support
  - *Mitigation*: Keep client-side AI calls or gracefully disable
- **Performance**: Multiple REST calls vs single tRPC call
  - *Mitigation*: Batch operations where possible, optimize queries

### Low Risk
- **Type Mismatches**: Adapter bugs
  - *Mitigation*: Comprehensive unit tests for adapters
- **UI Breaks**: Component prop changes
  - *Mitigation*: Incremental migration, thorough testing

---

## 7. Rollback Plan

If migration fails:
1. Keep original tRPC code in separate branch
2. Feature flag to toggle between tRPC and REST
3. Data export functionality to preserve user data
4. Quick rollback to tRPC version

---

## 8. Success Criteria

- ✅ All CRUD operations work with REST API
- ✅ Today's Focus functionality preserved
- ✅ Drag-and-drop ordering works
- ✅ No data loss during migration
- ✅ Offline mode with localStorage works
- ✅ UI/UX unchanged from user perspective
- ✅ Backend deployed and accessible
- ✅ Frontend deployed and connected to backend

---

## Next Steps

1. Create type adapters module (`client/src/adapters/`)
2. Create localStorage manager (`client/src/services/localStorage.ts`)
3. Create API client wrapper (`client/src/services/apiClient.ts`)
4. Begin replacing tRPC calls in Home.tsx
5. Test each feature incrementally
6. Document deployment process
