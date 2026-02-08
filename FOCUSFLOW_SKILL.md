# FocusFlow Skill voor OpenClaw

Deze skill verbindt OpenClaw met FocusFlow, je persoonlijke focus- en productiviteitsapp. Hiermee kun je via iMessage, WhatsApp, Telegram of andere kanalen je taken beheren, doelen bijhouden en gedachten dumpen.

## Installatie

1. Kopieer dit bestand naar je OpenClaw workspace:
   ```bash
   mkdir -p ~/.openclaw/workspace/skills/focusflow
   cp FOCUSFLOW_SKILL.md ~/.openclaw/workspace/skills/focusflow/SKILL.md
   ```

2. Configureer de API credentials in je `~/.openclaw/openclaw.json`:
   ```json
   {
     "skills": {
       "focusflow": {
         "apiUrl": "https://jouw-focusflow-url.manus.space/api/openclaw",
         "apiKey": "jouw-api-key-hier"
       }
     }
   }
   ```

3. Herstart OpenClaw:
   ```bash
   openclaw gateway --restart
   ```

## Configuratie

| Variabele | Beschrijving |
|-----------|--------------|
| `apiUrl` | De URL van je FocusFlow installatie + `/api/openclaw` |
| `apiKey` | De API key die je hebt ingesteld in FocusFlow |

## Beschikbare Commando's

### Dagfocus bekijken
Vraag naar je taken voor vandaag:
- "Wat staat er op mijn Dagfocus?"
- "Toon mijn taken voor vandaag"
- "Wat moet ik vandaag doen?"

### Taak toevoegen
Voeg een nieuwe taak toe:
- "Voeg taak toe: [beschrijving]"
- "Nieuwe taak: [beschrijving]"
- "Herinner me aan [beschrijving]"

### Taak voltooien
Markeer een taak als voltooid:
- "Taak [nummer] is klaar"
- "Voltooi taak [nummer]"
- "Check [taaknaam] af"

### Gedachten dumpen
Dump je gedachten en laat AI taken extraheren:
- "Dump: [je gedachten hier]"
- "Ik moet nog... [gedachten]"

### Samenvatting
Krijg een overzicht van je voortgang:
- "Geef me een samenvatting"
- "Hoe sta ik ervoor?"
- "Status update"

### Doelen bekijken
Bekijk je actieve doelen:
- "Wat zijn mijn doelen?"
- "Toon mijn doelen"

## API Endpoints

De skill communiceert met de volgende FocusFlow API endpoints:

### GET /api/openclaw/health
Health check endpoint.

### GET /api/openclaw/summary
Retourneert een samenvatting van tracks, doelen en Dagfocus.

**Response:**
```json
{
  "summary": {
    "tracks": 4,
    "activeGoals": 12,
    "dagfocus": 3,
    "tasksToday": {
      "total": 8,
      "completed": 2,
      "pending": 6
    }
  },
  "dagfocusTasks": [...],
  "message": "Je hebt 3 taken in je Dagfocus..."
}
```

### GET /api/openclaw/tasks/dagfocus
Retourneert alle taken in je Dagfocus.

**Response:**
```json
{
  "dagfocus": [...],
  "count": 3,
  "message": "Je hebt 3 taken in je Dagfocus vandaag."
}
```

### POST /api/openclaw/tasks
Maak een nieuwe taak aan.

**Request:**
```json
{
  "title": "Taaknaam",
  "description": "Optionele beschrijving",
  "isHighPriority": false,
  "isInDagfocus": true
}
```

### POST /api/openclaw/tasks/:id/complete
Markeer een taak als voltooid.

### POST /api/openclaw/dump
Dump gedachten en laat AI taken extraheren.

**Request:**
```json
{
  "content": "Ik moet nog boodschappen doen en die email beantwoorden..."
}
```

**Response:**
```json
{
  "message": "2 taken geëxtraheerd uit je dump",
  "created": {
    "tasks": 2,
    "goals": 0
  },
  "extracted": {...}
}
```

### POST /api/openclaw/chat
Vrije chat met de FocusFlow AI-assistent.

**Request:**
```json
{
  "message": "Wat moet ik vandaag als eerste doen?"
}
```

### GET /api/openclaw/tracks
Retourneert alle Tracks (levensonderwerpen).

### GET /api/openclaw/goals
Retourneert alle doelen.

## Authenticatie

Alle requests moeten een `X-API-Key` header bevatten:

```bash
curl -H "X-API-Key: jouw-api-key" \
     https://jouw-focusflow-url.manus.space/api/openclaw/summary
```

## Voorbeeldgebruik via iMessage

**Jij:** "Wat staat er op mijn Dagfocus?"

**OpenClaw:** "Je hebt 3 taken in je Dagfocus vandaag:
1. ⚡ Review emails (hoge prioriteit)
2. Team meeting om 14:00
3. Rapport afmaken

2 van 8 taken vandaag voltooid. Goed bezig!"

---

**Jij:** "Dump: Ik moet nog die offerte voor GasUnie afmaken, en vergeet niet om Tony te bellen over de nieuwe feature. Oh en boodschappen doen."

**OpenClaw:** "Ik heb 3 taken uit je dump gehaald:
1. ⚡ Offerte GasUnie afmaken (ModellenWerk)
2. Tony bellen over nieuwe feature (ModellenWerk)
3. Boodschappen doen (Gezin)

Alle 3 toegevoegd aan je Dagfocus!"

---

**Jij:** "Taak 1 is klaar"

**OpenClaw:** "Taak voltooid! Goed bezig! 🎉
Je hebt nu 3 van 9 taken vandaag afgerond."

## Troubleshooting

### "Invalid or missing API key"
Controleer of je API key correct is geconfigureerd in zowel FocusFlow als OpenClaw.

### "User not found"
Je moet eerst inloggen op FocusFlow via de web-interface voordat de API werkt.

### Geen response
Controleer of je FocusFlow server draait en bereikbaar is via de geconfigureerde URL.

## Support

Voor vragen of problemen met deze skill, neem contact op via de FocusFlow applicatie of open een issue op GitHub.
