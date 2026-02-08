# FocusFlow tRPC → REST API Migration Checklist

## Pre-Migration

- [x] Analyze frontend codebase (tRPC schema, types, API surface)
- [x] Analyze backend REST API (endpoints, types, response format)
- [x] Map schema differences (Track↔Project, text↔name, priority↔urgency)
- [x] Identify missing backend fields (orderIndex, descriptions, notes, context, colors)
- [x] Plan hybrid persistence strategy (backend + localStorage)
- [x] Back up original Home.tsx

## Infrastructure Layer

- [x] Create `client/src/types/backend.ts` — Backend REST API types
- [x] Create `client/src/types/frontend.ts` — Frontend types with full metadata
- [x] Create `client/src/adapters/typeAdapters.ts` — Conversion functions
- [x] Create `client/src/services/apiClient.ts` — REST API client (all 17 endpoints)
- [x] Create `client/src/services/localStorage.ts` — Metadata persistence manager
- [x] Create `client/src/hooks/useFocusFlow.ts` — React hook replacing tRPC

## Frontend Migration

- [x] Update `client/src/main.tsx` — Remove tRPC provider, keep QueryClient
- [x] Update `client/src/App.tsx` — Clean routing, add test page
- [x] Migrate `client/src/pages/Home.tsx` — Replace all tRPC calls
  - [x] Replace tRPC imports with useFocusFlow hook
  - [x] Replace data loading (tracks, today tasks, session)
  - [x] Replace handleAddTrack → createTrack
  - [x] Replace handleDeleteTrack → deleteTrack
  - [x] Replace handleAddGoal → createGoal
  - [x] Replace handleDeleteGoal → deleteGoal
  - [x] Replace handleAddTask → createTask
  - [x] Replace handleToggleTask → updateTask
  - [x] Replace handleToggleToday → updateTask
  - [x] Replace handleSetPriority → updateTask
  - [x] Replace handleDeleteTask → deleteTask
  - [x] Replace session updates → updateSession (localStorage)
  - [x] Migrate TrackCard component (notes, context, documents → localStorage)
  - [x] Disable AI features gracefully (chat, transcription, extraction)

## Build Verification

- [x] TypeScript compilation passes (`tsc --noEmit` → exit code 0)
- [x] Vite production build succeeds (1735 modules, 4.33s)
- [x] No runtime import errors
- [x] Bundle size acceptable (550 kB JS, 125 kB CSS)

## Testing

- [x] Build verification complete
- [x] Test report created
- [ ] Manual integration test with backend on localhost:3001
- [ ] Verify CRUD operations end-to-end
- [ ] Verify Today's Focus drag-and-drop
- [ ] Verify localStorage persistence across refresh
- [ ] Verify offline error handling

## Documentation

- [x] Migration analysis document
- [x] Test report
- [x] Deployment guide
- [x] Migration checklist (this document)

## Post-Migration (Future)

- [ ] Re-enable AI features via REST API endpoints
- [ ] Add backend endpoints for missing fields (orderIndex, descriptions, notes, context, colors)
- [ ] Remove tRPC dependencies from package.json
- [ ] Remove unused tRPC files (lib/trpc.ts, _core/hooks/useAuth.ts)
- [ ] Add proper error boundary for API failures
- [ ] Implement optimistic updates for better UX
- [ ] Add data migration script (localStorage → backend when fields are added)
