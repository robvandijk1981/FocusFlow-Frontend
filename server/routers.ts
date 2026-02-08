import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import * as db from "./db";

// ==================== TRACKS ROUTER ====================
const tracksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getTracksByUserId(ctx.user.id);
  }),
  
  listWithGoalsAndTasks: protectedProcedure.query(async ({ ctx }) => {
    return db.getTracksWithGoalsAndTasks(ctx.user.id);
  }),
  
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return db.getTrackById(input.id, ctx.user.id);
  }),
  
  create: protectedProcedure.input(z.object({
    id: z.string(),
    name: z.string().min(1),
    color: z.string().default('teal'),
    notes: z.string().optional(),
    context: z.string().optional(),
    orderIndex: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    return db.createTrack({
      id: input.id,
      userId: ctx.user.id,
      name: input.name,
      color: input.color,
      notes: input.notes || null,
      context: input.context || null,
      orderIndex: input.orderIndex,
    });
  }),
  
  update: protectedProcedure.input(z.object({
    id: z.string(),
    name: z.string().optional(),
    color: z.string().optional(),
    notes: z.string().optional(),
    context: z.string().optional(),
    orderIndex: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return db.updateTrack(id, ctx.user.id, data);
  }),
  
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await db.deleteTrack(input.id, ctx.user.id);
    return { success: true };
  }),
  
  bulkSync: protectedProcedure.input(z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    notes: z.string().optional(),
    context: z.string().optional(),
    orderIndex: z.number().optional(),
    goals: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      isCompleted: z.boolean().optional(),
      orderIndex: z.number().optional(),
      tasks: z.array(z.object({
        id: z.string(),
        text: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
        isCompleted: z.boolean().optional(),
        isToday: z.boolean().optional(),
        orderIndex: z.number().optional(),
      })),
    })),
  }))).mutation(async ({ ctx, input }) => {
    return db.bulkSyncTracks(ctx.user.id, input);
  }),
});

// ==================== GOALS ROUTER ====================
const goalsRouter = router({
  listByTrack: protectedProcedure.input(z.object({ trackId: z.string() })).query(async ({ input }) => {
    return db.getGoalsByTrackId(input.trackId);
  }),
  
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return db.getGoalById(input.id);
  }),
  
  create: protectedProcedure.input(z.object({
    id: z.string(),
    trackId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    orderIndex: z.number().default(0),
  })).mutation(async ({ input }) => {
    return db.createGoal({
      id: input.id,
      trackId: input.trackId,
      name: input.name,
      description: input.description || null,
      orderIndex: input.orderIndex,
    });
  }),
  
  update: protectedProcedure.input(z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    isCompleted: z.boolean().optional(),
    orderIndex: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    return db.updateGoal(id, data);
  }),
  
  complete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const result = await db.completeGoal(input.id);
    
    // Add context to track about completed goal
    if (result.goal && result.trackId) {
      const today = new Date().toLocaleDateString('nl-NL');
      const contextEntry = `[${today}] Doel bereikt: "${result.goal.name}"`;
      
      // Get current track context and append
      const track = await db.getTrackById(result.trackId, ctx.user.id);
      if (track) {
        const newContext = track.context 
          ? `${track.context}\n${contextEntry}`
          : contextEntry;
        await db.updateTrack(result.trackId, ctx.user.id, { context: newContext });
      }
    }
    
    return result.goal;
  }),
  
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteGoal(input.id);
    return { success: true };
  }),
});

// ==================== TASKS ROUTER ====================
const tasksRouter = router({
  listByGoal: protectedProcedure.input(z.object({ goalId: z.string() })).query(async ({ input }) => {
    return db.getTasksByGoalId(input.goalId);
  }),
  
  listToday: protectedProcedure.query(async ({ ctx }) => {
    return db.getTodayTasks(ctx.user.id);
  }),
  
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return db.getTaskById(input.id);
  }),
  
  create: protectedProcedure.input(z.object({
    id: z.string(),
    goalId: z.string(),
    text: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
    isToday: z.boolean().default(false),
    orderIndex: z.number().default(0),
  })).mutation(async ({ input }) => {
    return db.createTask({
      id: input.id,
      goalId: input.goalId,
      text: input.text,
      description: input.description || null,
      priority: input.priority || null,
      isToday: input.isToday,
      orderIndex: input.orderIndex,
    });
  }),
  
  update: protectedProcedure.input(z.object({
    id: z.string(),
    text: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
    isCompleted: z.boolean().optional(),
    isToday: z.boolean().optional(),
    orderIndex: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    return db.updateTask(id, data);
  }),
  
  setPriority: protectedProcedure.input(z.object({
    id: z.string(),
    priority: z.enum(['low', 'medium', 'high']).nullable(),
  })).mutation(async ({ input }) => {
    return db.setTaskPriority(input.id, input.priority);
  }),
  
  setToday: protectedProcedure.input(z.object({
    id: z.string(),
    isToday: z.boolean(),
  })).mutation(async ({ input }) => {
    return db.setTaskToday(input.id, input.isToday);
  }),
  
  complete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const result = await db.completeTask(input.id);
    
    // Add context to track about completed task
    if (result.task && result.trackId) {
      const today = new Date().toLocaleDateString('nl-NL');
      const contextEntry = `[${today}] Taak voltooid: "${result.task.text}" (${result.goalName})`;
      
      // Get current track context and append
      const track = await db.getTrackById(result.trackId, ctx.user.id);
      if (track) {
        const newContext = track.context 
          ? `${track.context}\n${contextEntry}`
          : contextEntry;
        await db.updateTrack(result.trackId, ctx.user.id, { context: newContext });
      }
    }
    
    return result.task;
  }),
  
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteTask(input.id);
    return { success: true };
  }),
});

// ==================== SESSION ROUTER ====================
const sessionRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const session = await db.getUserSession(ctx.user.id);
    if (!session) {
      return {
        id: '',
        userId: ctx.user.id,
        dailyIntention: null,
        energyLevel: 'Normal',
        currentTrackId: null,
        focusMode: true,
        sessionStartTime: null,
        trackSwitchCount: 0,
        lastActivity: null,
      };
    }
    return session;
  }),
  
  update: protectedProcedure.input(z.object({
    dailyIntention: z.string().optional(),
    energyLevel: z.enum(['Low', 'Normal', 'High']).optional(),
    currentTrackId: z.string().nullable().optional(),
    focusMode: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    return db.upsertUserSession(ctx.user.id, input);
  }),
  
  startDaily: protectedProcedure.input(z.object({
    dailyIntention: z.string().optional(),
    energyLevel: z.enum(['Low', 'Normal', 'High']).optional(),
  })).mutation(async ({ ctx, input }) => {
    return db.upsertUserSession(ctx.user.id, {
      dailyIntention: input.dailyIntention || null,
      energyLevel: input.energyLevel || 'Normal',
      sessionStartTime: new Date(),
    });
  }),
  
  setFocusMode: protectedProcedure.input(z.object({
    focusMode: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    return db.upsertUserSession(ctx.user.id, { focusMode: input.focusMode });
  }),
  
  setCurrentTrack: protectedProcedure.input(z.object({
    trackId: z.string().nullable(),
  })).mutation(async ({ ctx, input }) => {
    const session = await db.getUserSession(ctx.user.id);
    const trackSwitchCount = (session?.trackSwitchCount || 0) + 1;
    return db.upsertUserSession(ctx.user.id, { 
      currentTrackId: input.trackId,
      trackSwitchCount,
    });
  }),
});

// ==================== AI ROUTER ====================
const aiRouter = router({
  // Extract tasks from notes - returns suggestions with track/goal assignments
  extractTasks: protectedProcedure.input(z.object({
    notes: z.string(),
    trackId: z.string().optional(),
    goalId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    // Get existing tracks and goals for context
    const tracks = await db.getTracksWithGoalsAndTasks(ctx.user.id);
    const tracksContext = tracks.map(t => ({
      id: t.id,
      name: t.name,
      goals: t.goals.map(g => ({ id: g.id, name: g.name }))
    }));

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een taak-extractie assistent. Analyseer de notities en extraheer concrete, uitvoerbare taken.
Wijs elke taak toe aan de meest passende bestaande track en goal.

Beschikbare tracks en goals:
${JSON.stringify(tracksContext, null, 2)}

${input.trackId ? `Focus op track ID: ${input.trackId}` : ''}
${input.goalId ? `Focus op goal ID: ${input.goalId}` : ''}

Retourneer een JSON array met taken:
[
  {
    "text": "Taak beschrijving",
    "priority": "high" | "medium" | "low",
    "trackId": "track-id",
    "trackName": "Track naam",
    "goalId": "goal-id",
    "goalName": "Goal naam"
  }
]

Regels:
- Maak taken specifiek en uitvoerbaar
- Wijs prioriteit toe op basis van urgentie en belang
- Als geen passende track/goal bestaat, gebruik "new" als ID en stel een naam voor
- Retourneer alleen de JSON array, geen andere tekst.`
        },
        {
          role: "user",
          content: input.notes
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "[]";
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      return [];
    }
  }),

  // Analyze dump text - extract goals, tasks, and context updates
  analyzeDump: protectedProcedure.input(z.object({
    text: z.string(),
  })).mutation(async ({ ctx, input }) => {
    const tracks = await db.getTracksWithGoalsAndTasks(ctx.user.id);
    const tracksContext = tracks.map(t => ({
      id: t.id,
      name: t.name,
      context: t.context,
      goals: t.goals.map(g => ({ 
        id: g.id, 
        name: g.name,
        tasks: g.tasks.map(tk => ({ id: tk.id, text: tk.text, isCompleted: tk.isCompleted }))
      }))
    }));

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een intelligente assistent die gedachten-dumps analyseert en omzet naar gestructureerde acties.

Huidige tracks, goals en taken van de gebruiker:
${JSON.stringify(tracksContext, null, 2)}

Analyseer de dump en identificeer:
1. Nieuwe taken die toegevoegd moeten worden
2. Bestaande taken die bijgewerkt moeten worden (bijv. voltooien, prioriteit wijzigen)
3. Nieuwe doelen die aangemaakt moeten worden
4. Context-informatie die toegevoegd moet worden aan tracks

Retourneer een JSON object met de volgende structuur:
{
  "newTasks": [
    {
      "text": "Taak beschrijving",
      "priority": "high" | "medium" | "low",
      "trackId": "bestaand-track-id of 'new'",
      "trackName": "Track naam (voor nieuwe tracks)",
      "goalId": "bestaand-goal-id of 'new'",
      "goalName": "Goal naam (voor nieuwe goals)"
    }
  ],
  "taskUpdates": [
    {
      "taskId": "bestaand-task-id",
      "action": "complete" | "updatePriority" | "addToToday",
      "newPriority": "high" | "medium" | "low" (optioneel)
    }
  ],
  "newGoals": [
    {
      "name": "Goal naam",
      "description": "Beschrijving",
      "trackId": "bestaand-track-id of 'new'",
      "trackName": "Track naam (voor nieuwe tracks)"
    }
  ],
  "contextUpdates": [
    {
      "trackId": "track-id",
      "trackName": "Track naam",
      "contextToAdd": "Nieuwe context informatie om toe te voegen"
    }
  ],
  "summary": "Korte samenvatting van wat er uit de dump is gehaald"
}

Wees grondig maar ook praktisch - focus op concrete acties.`
        },
        {
          role: "user",
          content: input.text
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "{}";
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse dump analysis:", e);
      return {
        newTasks: [],
        taskUpdates: [],
        newGoals: [],
        contextUpdates: [],
        summary: "Kon de dump niet analyseren. Probeer het opnieuw."
      };
    }
  }),

  // Suggest Today's Focus based on Daily Setup
  suggestTodaysFocus: protectedProcedure.input(z.object({
    dailyIntention: z.string().optional(),
    energyLevel: z.enum(['Low', 'Normal', 'High']),
  })).mutation(async ({ ctx, input }) => {
    const tracks = await db.getTracksWithGoalsAndTasks(ctx.user.id);
    
    // Collect all incomplete tasks with their context
    const allTasks: Array<{
      id: string;
      text: string;
      priority: string | null;
      trackId: string;
      trackName: string;
      goalId: string;
      goalName: string;
    }> = [];
    
    for (const track of tracks) {
      for (const goal of track.goals) {
        for (const task of goal.tasks) {
          if (!task.isCompleted) {
            allTasks.push({
              id: task.id,
              text: task.text,
              priority: task.priority,
              trackId: track.id,
              trackName: track.name,
              goalId: goal.id,
              goalName: goal.name,
            });
          }
        }
      }
    }

    // Determine max tasks based on energy level
    const maxTasks = input.energyLevel === 'Low' ? 4 : input.energyLevel === 'High' ? 8 : 5;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een focus-assistent die helpt bij het selecteren van de belangrijkste taken voor vandaag.

Energieniveau: ${input.energyLevel}
${input.dailyIntention ? `Dagelijkse intentie: ${input.dailyIntention}` : ''}

Maximaal aantal taken voor vandaag: ${maxTasks}

Beschikbare taken:
${JSON.stringify(allTasks, null, 2)}

Selecteer de ${maxTasks} meest relevante taken voor vandaag, rekening houdend met:
1. De dagelijkse intentie (als gegeven)
2. Het energieniveau (bij lage energie: minder en makkelijkere taken)
3. Prioriteit van taken (high > medium > low)
4. Balans tussen verschillende tracks

Retourneer een JSON array met task IDs in volgorde van belangrijkheid:
{
  "selectedTaskIds": ["task-id-1", "task-id-2", ...],
  "reasoning": "Korte uitleg waarom deze taken zijn geselecteerd"
}

Retourneer alleen de JSON, geen andere tekst.`
        },
        {
          role: "user",
          content: `Selecteer de beste taken voor vandaag.${input.dailyIntention ? ` Mijn focus: ${input.dailyIntention}` : ''}`
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      // Fallback: return high priority tasks
      const highPriority = allTasks.filter(t => t.priority === 'high').slice(0, maxTasks);
      return {
        selectedTaskIds: highPriority.map(t => t.id),
        reasoning: "Automatisch geselecteerd op basis van hoge prioriteit."
      };
    }
  }),

  // Speech to text transcription
  transcribe: protectedProcedure.input(z.object({
    audioUrl: z.string(),
    language: z.string().optional(),
  })).mutation(async ({ input }) => {
    try {
      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language || 'nl',
        prompt: 'Transcribeer deze spraakopname. Dit kan gaan over taken, doelen, projecten of gedachten.',
      });
      // Check if result has text property (success) or error property (failure)
      if ('text' in result) {
        return {
          text: result.text,
          language: result.language || input.language || 'nl',
          success: true,
        };
      } else {
        return {
          text: '',
          language: input.language || 'nl',
          success: false,
          error: 'Transcriptie mislukt. Probeer het opnieuw.',
        };
      }
    } catch (error) {
      console.error("Transcription error:", error);
      return {
        text: '',
        language: input.language || 'nl',
        success: false,
        error: 'Transcriptie mislukt. Probeer het opnieuw.',
      };
    }
  }),

  // Extract context from notes when saving
  extractContext: protectedProcedure.input(z.object({
    notes: z.string(),
    trackId: z.string(),
    trackName: z.string(),
    existingContext: z.string().optional(),
  })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een context-extractie assistent. Analyseer de notities en extraheer relevante achtergrond-informatie die nuttig is om te bewaren als context voor deze track.

Track: ${input.trackName}
Bestaande context: ${input.existingContext || "Geen"}

Extraheer alleen informatie die:
- Achtergrond geeft over projecten, mensen, of situaties
- Strategische inzichten of beslissingen bevat
- Belangrijke feiten of cijfers bevat
- Relaties of afhankelijkheden beschrijft

NEGEER:
- Concrete taken (die worden apart geëxtraheerd)
- Tijdelijke of eenmalige zaken
- Triviale details

Retourneer een JSON object:
{
  "extractedContext": "De geëxtraheerde context-informatie als doorlopende tekst",
  "hasNewContext": true/false
}

Als er geen relevante context is, retourneer hasNewContext: false.
Retourneer alleen de JSON, geen andere tekst.`
        },
        {
          role: "user",
          content: input.notes
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      return { extractedContext: "", hasNewContext: false };
    }
  }),

  // Analyze document and extract context
  analyzeDocument: protectedProcedure.input(z.object({
    documentUrl: z.string(),
    fileName: z.string(),
    trackId: z.string(),
    trackName: z.string(),
  })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een document-analyse assistent. Analyseer het document en extraheer relevante achtergrond-informatie die nuttig is als context voor de track "${input.trackName}".

Extraheer alleen informatie die:
- Achtergrond geeft over projecten, mensen, of situaties
- Strategische inzichten of beslissingen bevat
- Belangrijke feiten of cijfers bevat
- Relaties of afhankelijkheden beschrijft
- Doelstellingen of KPI's bevat

Retourneer een JSON object:
{
  "extractedContext": "De geëxtraheerde context-informatie als doorlopende tekst (max 500 woorden)",
  "hasContent": true/false
}

Als er geen relevante context is, retourneer hasContent: false.
Retourneer alleen de JSON, geen andere tekst.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyseer dit document: ${input.fileName}` },
            { type: "file_url", file_url: { url: input.documentUrl, mime_type: "application/pdf" } }
          ]
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          extractedContext: parsed.extractedContext || "",
          hasContent: parsed.hasContent || false
        };
      }
      return { extractedContext: "", hasContent: false };
    } catch {
      return { extractedContext: "", hasContent: false };
    }
  }),

  // Suggest goals for a track
  suggestGoals: protectedProcedure.input(z.object({
    trackName: z.string(),
    trackContext: z.string().optional(),
    existingGoals: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een goal-suggestie assistent. Stel 3-5 betekenisvolle doelen voor voor de gegeven track/levensgebied.
Houd rekening met de track context en vermijd duplicatie van bestaande doelen.
Retourneer een JSON array met goal suggesties:
[
  { "name": "Goal naam", "description": "Korte beschrijving" }
]
Retourneer alleen de JSON array, geen andere tekst.`
        },
        {
          role: "user",
          content: `Track: ${input.trackName}
Context: ${input.trackContext || "Geen aanvullende context"}
Bestaande doelen: ${input.existingGoals?.join(", ") || "Geen"}`
        }
      ],
    });
    
    try {
      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content : "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      return [];
    }
  }),

  // AI Chat for track context queries (sparring tool)
  chatWithContext: protectedProcedure.input(z.object({
    trackId: z.string(),
    trackName: z.string(),
    context: z.string().optional(),
    question: z.string(),
    chatHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
  })).mutation(async ({ input }) => {
    // Fetch documents from database server-side
    const documents = await db.getDocumentsByTrackId(input.trackId);

    // Build text context - all text-based, no multimodal
    let textContext = '';
    if (input.context) {
      textContext += `## Track Context\n${input.context}\n\n`;
    }

    const docNames: string[] = [];

    if (documents.length > 0) {
      textContext += `## Documenten\n`;
      for (const doc of documents) {
        docNames.push(doc.filename);
        try {
          const resp = await fetch(doc.fileUrl);
          if (!resp.ok) {
            textContext += `### ${doc.filename} (bestand kon niet worden opgehaald)\n\n`;
            continue;
          }
          const buffer = Buffer.from(await resp.arrayBuffer());

          if (doc.fileType === 'application/pdf') {
            // Parse PDF server-side using pdf-parse v2
            const { PDFParse } = await import('pdf-parse');
            try {
              const parser = new PDFParse({ data: buffer });
              const pdfData = await parser.getText();
              const pdfText = pdfData?.text?.trim();
              if (pdfText && pdfText.length > 0) {
                textContext += `### ${doc.filename}\n${pdfText.substring(0, 50000)}\n\n`;
              } else {
                textContext += `### ${doc.filename} (PDF bevat geen leesbare tekst)\n\n`;
              }
            } catch {
              textContext += `### ${doc.filename} (PDF kon niet worden geparsed)\n\n`;
            }
          } else if (doc.fileType?.includes('wordprocessingml') || doc.filename.endsWith('.docx')) {
            // Parse Word documents server-side
            const mammoth = await import('mammoth');
            try {
              const result = await mammoth.extractRawText({ buffer });
              const docText = result.value?.trim();
              if (docText && docText.length > 0) {
                textContext += `### ${doc.filename}\n${docText.substring(0, 50000)}\n\n`;
              } else {
                textContext += `### ${doc.filename} (Word document bevat geen leesbare tekst)\n\n`;
              }
            } catch {
              textContext += `### ${doc.filename} (Word document kon niet worden geparsed)\n\n`;
            }
          } else {
            // Try plain text for other formats
            const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
            const printableRatio = text.split('').filter(c => c.charCodeAt(0) >= 32 || c === '\n' || c === '\r' || c === '\t').length / Math.max(text.length, 1);
            if (printableRatio > 0.8 && text.length > 0) {
              textContext += `### ${doc.filename}\n${text.substring(0, 50000)}\n\n`;
            } else {
              textContext += `### ${doc.filename} (binair bestand - inhoud niet leesbaar)\n\n`;
            }
          }
        } catch {
          textContext += `### ${doc.filename} (bestand kon niet worden gelezen)\n\n`;
        }
      }
    }

    // Build simple text-only system message
    const systemText = `Je bent een slimme sparring partner voor de track "${input.trackName}". Je helpt de gebruiker met vragen over deze track, de context, en de bijbehorende documenten.

Je hebt toegang tot de volgende informatie:

${textContext || 'Geen context of documenten beschikbaar.'}

${docNames.length > 0 ? `Beschikbare documenten: ${docNames.join(', ')}` : ''}

Beantwoord vragen op basis van deze informatie. Als je iets niet weet, zeg dat eerlijk. Wees behulpzaam, concreet en geef praktische inzichten waar mogelijk.

Als de gebruiker vraagt om taken of acties, geef suggesties maar maak duidelijk dat dit suggesties zijn die ze zelf kunnen toevoegen.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemText }
    ];

    // Add chat history
    if (input.chatHistory) {
      for (const msg of input.chatHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current question
    messages.push({ role: 'user', content: input.question });

    console.log('[AI Chat] Documents found:', docNames.length, docNames);
    console.log('[AI Chat] Text context length:', textContext.length);

    try {
      const response = await invokeLLM({ messages });
      
      let content = 'Sorry, ik kon geen antwoord genereren. Probeer het opnieuw.';
      if (response?.choices && response.choices.length > 0) {
        const msg = response.choices[0]?.message?.content;
        if (typeof msg === 'string' && msg.trim().length > 0) {
          content = msg;
        }
      }
      
      return { answer: content };
    } catch (error: any) {
      console.error('AI Chat LLM error:', error?.message || error);
      return { answer: 'Sorry, er ging iets mis bij het verwerken van je vraag. Probeer het opnieuw.' };
    }
  }),
});

// ==================== DOCUMENTS ROUTER ====================
const documentsRouter = router({
  listByTrack: protectedProcedure.input(z.object({ trackId: z.string() })).query(async ({ input }) => {
    return db.getDocumentsByTrackId(input.trackId);
  }),
  
  create: protectedProcedure.input(z.object({
    trackId: z.string(),
    fileName: z.string(),
    fileUrl: z.string(),
    fileType: z.string(),
  })).mutation(async ({ ctx, input }) => {
    return db.createTrackDocument({
      trackId: input.trackId,
      userId: ctx.user.id,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
    });
  }),
  
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await db.deleteTrackDocument(input.id);
    return { success: true };
  }),
});

// ==================== MAIN ROUTER ====================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  tracks: tracksRouter,
  goals: goalsRouter,
  tasks: tasksRouter,
  session: sessionRouter,
  ai: aiRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
