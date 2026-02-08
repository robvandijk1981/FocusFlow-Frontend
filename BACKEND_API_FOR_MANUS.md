# FocusFlow REST API Backend - Complete Reference

## Base URL
```
http://localhost:3001/api (development)
https://your-backend.manus.space/api (production)
```

## Complete API Endpoints

### Health Check
```
GET /api/health
Response: { "status": "ok", "timestamp": "2026-02-07T..." }
```

### Projects (called "Tracks" in frontend)

**Get all projects**
```
GET /api/projects
Response: {
  "success": true,
  "data": [
    {
      "id": "cmlcnp74j00051e1isc6k5anl",
      "name": "ModellenWerk",
      "createdAt": "2026-02-07T18:37:20.083Z",
      "updatedAt": "2026-02-07T18:37:20.083Z",
      "deletedAt": null,
      "goals": [...]  // Optionally includes nested goals with tasks
    }
  ]
}
```

**Get single project**
```
GET /api/projects/:id
```

**Create project**
```
POST /api/projects
Body: { "name": "Project Name" }
Response: { "success": true, "data": {...} }
```

**Update project**
```
PUT /api/projects/:id
Body: { "name": "Updated Name" }
```

**Delete project** (soft delete)
```
DELETE /api/projects/:id
```

### Goals

**Get all goals** (optionally filter by project)
```
GET /api/goals
GET /api/goals?projectId=<id>
Response: {
  "success": true,
  "data": [
    {
      "id": "cmlcnpeg300071e1iz5xuky52",
      "projectId": "cmlcnp74j00051e1isc6k5anl",
      "name": "Nieuwe opdrachten binnenhalen",
      "createdAt": "2026-02-07T18:37:29.626Z",
      "updatedAt": "2026-02-07T18:37:29.626Z",
      "deletedAt": null,
      "completedCount": 0,  // Computed field
      "totalCount": 1,      // Computed field
      "tasks": [...]         // Optionally includes tasks
    }
  ]
}
```

**Get single goal**
```
GET /api/goals/:id
```

**Create goal**
```
POST /api/goals
Body: { 
  "name": "Goal Name",
  "projectId": "project-id-here"
}
```

**Update goal**
```
PUT /api/goals/:id
Body: { "name": "Updated Name" }
```

**Delete goal** (soft delete)
```
DELETE /api/goals/:id
```

### Tasks

**Get all tasks** (with optional filters)
```
GET /api/tasks
GET /api/tasks?goalId=<id>
GET /api/tasks?urgency=HOOG
GET /api/tasks?todaysFocus=true
GET /api/tasks?completed=false

Response: {
  "success": true,
  "data": [
    {
      "id": "task-id",
      "goalId": "goal-id",
      "name": "Task name",
      "completed": false,
      "urgency": "HOOG",  // LAAG | MIDDEN | HOOG
      "todaysFocus": false,
      "createdAt": "2026-02-07T...",
      "updatedAt": "2026-02-07T...",
      "completedAt": null,
      "deletedAt": null,
      "goal": {...},      // Includes goal with project
      "project": {...}    // Denormalized for convenience
    }
  ]
}
```

**Get today's focus tasks**
```
GET /api/tasks/today
Returns all tasks where todaysFocus = true
```

**Get single task**
```
GET /api/tasks/:id
```

**Create task**
```
POST /api/tasks
Body: {
  "name": "Task name",
  "goalId": "goal-id-here",
  "urgency": "HOOG",      // Optional: LAAG | MIDDEN | HOOG
  "todaysFocus": false    // Optional: boolean
}
```

**Update task**
```
PUT /api/tasks/:id
Body: {
  "name": "Updated name",           // Optional
  "completed": true,                // Optional
  "urgency": "MIDDEN",             // Optional
  "todaysFocus": true              // Optional
}
```

**Delete task** (soft delete)
```
DELETE /api/tasks/:id
```

### Sync
```
POST /api/sync
Body: { ... } // For offline-first sync strategy
```

## Data Model Mapping

### Frontend → Backend Type Mappings

| Frontend | Backend | Notes |
|----------|---------|-------|
| `Track` | `Project` | Renamed in backend |
| `task.text` | `task.name` | Field renamed |
| `task.priority` | `task.urgency` | Field renamed |
| `low/medium/high` | `LAAG/MIDDEN/HOOG` | Different enum values |
| `task.isCompleted` | `task.completed` | Field renamed |
| `task.isToday` | `task.todaysFocus` | Field renamed |
| `task.orderIndex` | ❌ Not in backend | Frontend-only for drag & drop |
| `task.description` | ❌ Not in backend | Frontend-only field |
| `goal.description` | ❌ Not in backend | Frontend-only field |
| `track.notes` | ❌ Not in backend | Frontend-only field |
| `track.context` | ❌ Not in backend | Frontend-only field |
| `track.color` | ❌ Not in backend | Frontend-only field |

## Important Differences

### Features NOT in Backend
The backend has a simpler schema than the frontend. These features need to be handled **client-side only**:

1. **Drag & Drop Ordering** (`orderIndex`)
   - Store order in frontend state or localStorage
   - Backend doesn't persist order

2. **Descriptions** (task/goal)
   - Store in frontend state or localStorage
   - Not persisted to backend

3. **Track Colors**
   - Frontend visual feature only
   - Store in localStorage

4. **Notes & Context** (track level)
   - Frontend feature only
   - Store in localStorage

5. **AI Features** (dump, sparring)
   - Frontend feature, doesn't interact with backend

### Migration Strategy

**Hybrid Approach:**
- **Persist to backend**: Projects, Goals, Tasks (name, urgency, completed, todaysFocus)
- **Keep in localStorage**: orderIndex, descriptions, notes, context, colors
- **Merge on load**: Combine backend data + localStorage metadata

## Example Request/Response Flow

### Create a complete task workflow

1. **Create Project**
```bash
POST /api/projects
{ "name": "ModellenWerk" }
→ Returns: { "id": "proj-123", ... }
```

2. **Create Goal**
```bash
POST /api/goals
{ "name": "Nieuwe opdrachten", "projectId": "proj-123" }
→ Returns: { "id": "goal-456", ... }
```

3. **Create Task**
```bash
POST /api/tasks
{ 
  "name": "LinkedIn post schrijven",
  "goalId": "goal-456",
  "urgency": "HOOG",
  "todaysFocus": true
}
→ Returns: { "id": "task-789", ... }
```

4. **Update Task**
```bash
PUT /api/tasks/task-789
{ "completed": true }
→ Returns: { ...task with completed: true, completedAt: timestamp }
```

5. **Get Today's Focus**
```bash
GET /api/tasks/today
→ Returns all tasks with todaysFocus = true
```

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 404: Not Found
- 500: Server Error

## CORS Configuration

Backend accepts requests from:
- `http://localhost:3000` (development)
- `https://focusflow-today.manus.space` (production)

## Database Schema (Prisma)

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  goals     Goal[]
}

model Goal {
  id        String   @id @default(cuid())
  projectId String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  project   Project  @relation(...)
  tasks     Task[]
}

model Task {
  id          String   @id @default(cuid())
  goalId      String
  name        String
  completed   Boolean  @default(false)
  urgency     String   @default("MIDDEN") // LAAG, MIDDEN, HOOG
  todaysFocus Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
  deletedAt   DateTime?
  goal        Goal     @relation(...)
}
```

## Backend Code Location

- **Root**: `/Users/robvandijk/.openclaw/workspace/focusflow-backend/`
- **Source**: `src/`
- **Controllers**: `src/controllers/`
- **Routes**: `src/routes/`
- **Prisma Schema**: `prisma/schema.prisma`
- **Integration Files**: `frontend-integration/`

## Frontend Code Location

- **Root**: `/Users/robvandijk/.openclaw/workspace/focusflow-frontend/`
- **Main App**: `client/src/App.tsx`
- **Home Page**: `client/src/pages/Home.tsx`
- **API Client** (already added): `client/src/services/apiClient.ts`
- **React Hook** (already added): `client/src/hooks/useFocusFlow.ts`

## Key Integration Points

The frontend currently uses tRPC (`trpc.`) calls throughout `Home.tsx`:
- `trpc.tracks.getAll.useQuery()`
- `trpc.tracks.create.useMutation()`
- `trpc.goals.create.useMutation()`
- `trpc.tasks.update.useMutation()`
- etc.

These need to be replaced with REST API calls using the `apiClient.ts` or `useFocusFlow.ts` hook.

## Migration Priorities

1. **Critical paths**: Task CRUD, Today's Focus, completion toggle
2. **Important**: Project/Goal creation, editing
3. **Enhanced**: Drag & drop (client-side state)
4. **Future**: AI features, bulk operations

## Testing the Backend

Backend is running on `http://localhost:3001`

Test health:
```bash
curl http://localhost:3001/api/health
```

Test projects:
```bash
curl http://localhost:3001/api/projects
```
