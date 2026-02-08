# FocusFlow - Track-Goal-Task Manager Rebuild

## Phase 1: Database Schema

- [x] Update schema with Tracks, Goals, Tasks tables
- [x] Add UserSessions table for daily focus state
- [x] Run database migration

## Phase 2: Backend API (tRPC)

- [x] Tracks router (list, create, update, delete, reorder, bulkSync)
- [x] Goals router (list, create, update, complete, delete)
- [x] Tasks router (list, create, update, setPriority, setToday, complete, delete)
- [x] Session router (get, update daily intention/energy)
- [x] AI router (extract tasks from notes)

## Phase 3: Frontend - Core Components

- [x] Header with Daily Setup and AI Settings buttons
- [x] Today's Focus card
- [x] Focus Mode toggle and pagination
- [x] Track detail card (context, notes, goals)
- [x] Goal component (collapsible, with tasks)
- [x] Task component (priority dropdown, Today button, Delete)
- [x] Track Overview table

## Phase 4: Frontend - Modals

- [x] Daily Setup modal (intention, energy level)
- [x] AI Settings modal

## Phase 5: Features

- [x] AI task extraction from track notes
- [x] Goal collapse/expand
- [x] Task completion
- [x] Focus Mode navigation between tracks
- [x] Drag-and-drop for Today's Focus

## Preserved from Original

- [x] User authentication (Manus OAuth)
- [ ] OpenClaw API integration (to be re-added later)

## Bug Fixes

- [x] Fix session.get query returning undefined

## New Features (Feedback Round 2)

### Prioriteit-sortering
- [x] Automatische sortering taken: hoog → midden → laag
- [x] Sortering toepassen bij Goals én Today's Focus

### AI Taakextractie
- [x] Fix "Notities Extraheer taken" functionaliteit
- [x] Automatisch toewijzen aan track en doel
- [x] "Accepteer alle" optie met checkboxes

### Speech-to-Text
- [x] Integreer externe API (Whisper) voor spraakherkenning
- [x] Ondersteuning voor Nederlands en Engels
- [x] Toevoegen aan notities invoer

### Document Upload bij Tracks
- [ ] Upload ondersteuning voor PDF, Word, PPT, Excel (nog te implementeren)
- [ ] AI leest documenten voor context (nog te implementeren)
- [ ] Opslaan document-referenties bij Track (nog te implementeren)

### Dump Functionaliteit
- [x] Dump knop bovenaan de pagina
- [x] Tekst invoer én speech-to-text
- [x] Aparte "Analyseer" knop
- [x] AI extraheert: doelen, taken, én contextinformatie
- [x] Overzicht met checkboxes voor bevestiging
- [x] Context wordt toegewezen aan Tracks

### Daily Setup → Today's Focus
- [x] AI selecteert taken op basis van intentie en energieniveau
- [x] 3-5 taken bij lage energie, 5-8 bij hoge energie
- [x] Handmatig toevoegen blijft mogelijk

### UI Aanpassingen
- [x] Verwijder voortgangsbalk uit Track overzicht

## Bug Fixes (Speech-to-Text)

- [x] Fix speech-to-text transcriptie die blijft hangen op "wordt verwerkt"
- [x] Voeg speech-to-text optie toe bij track notities

## Context Functionaliteit

- [x] Voeg context-knop toe aan TrackCard (BookOpen icoon)
- [x] Context-weergave panel bij klikken op context-knop
- [x] Automatische context-extractie uit notities bij opslaan
- [ ] Context wordt aangevuld door: voltooide taken, voltooide doelen, documenten (deels geïmplementeerd)
- [x] Verwijder brain-icoon (dubbele functie met Extraheer taken)

## Bug Fixes (Context & Today's Focus)

- [x] Context wordt nu aangevuld bij voltooien taken (datum + taaknaam + doelnaam)
- [x] Context wordt aangevuld bij opslaan notities (AI extractie)
- [x] Voltooide taken verdwijnen uit Today's Focus (blijven zichtbaar bij doelen)
- [x] Document upload knop toegevoegd aan Context sectie (PDF, Word, PPT, Excel)

## AI Bevraag Module & Verbeteringen

### AI Bevraag (Sparring Tool)
- [x] Verwijder track overzicht onderaan de pagina
- [x] AI Chat interface per Track voor context queries (paars chat-icoon)
- [x] Chat kan context én geüploade documenten doorzoeken
- [x] Werkt als sparring tool voor inhoudelijke vragen

### Document Management
- [x] Documenten zichtbaar in een lijst bij de Track
- [x] Mogelijkheid om documenten te bekijken (link naar bestand)
- [x] Mogelijkheid om documenten te verwijderen

### Context Bewerken
- [x] Handmatig context bewerken (Bewerken knop)
- [x] Context verwijderen/wissen (Wissen knop)

### Context bij Voltooide Doelen
- [x] Automatisch context toevoegen wanneer een doel wordt afgerond

### Drag-and-Drop
- [x] Taken in Today's Focus kunnen herschikken door te slepen (met grip handle)

## Performance

- [x] Pagina laadt te langzaam - N+1 queries opgelost met batch queries (3 queries ipv tientallen)

## Bug Fixes (Auth)

- [x] Unauthenticated missing header error na login (was Manus login probleem)

## Bug Fixes (Document Upload)

- [x] Document upload werkt niet (Drizzle default waarde fix - empty string ipv null)
- [x] Document upload blijft mislukken - root cause: fileType varchar(50) te kort voor lange MIME types, opgelost met varchar(255)

## Bug Fixes (AI Sparring)

- [x] AI Sparring kan documenten niet lezen - opgelost met server-side PDF (pdf-parse) en Word (mammoth) parsing

## Doelselectie bij Taakextractie

- [x] Extraheer taken: dropdown per taak om doel te kiezen (AI-suggestie als standaard)
- [x] Dump Analyseer: dropdown per taak om doel te kiezen (AI-suggestie als standaard)

## UI Verbeteringen

- [x] Doelbalken dezelfde kleur als de track kleur (lichte variant van track kleur)
