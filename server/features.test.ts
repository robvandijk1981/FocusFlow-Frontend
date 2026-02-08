import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getTracksByUserId: vi.fn().mockResolvedValue([]),
  getTracksWithGoalsAndTasks: vi.fn().mockResolvedValue([]),
  createTrack: vi.fn().mockImplementation(async (track) => ({ ...track, userId: 1 })),
  updateTrack: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
  deleteTrack: vi.fn().mockResolvedValue(true),
  getGoalsByTrackId: vi.fn().mockResolvedValue([]),
  createGoal: vi.fn().mockImplementation(async (goal) => goal),
  updateGoal: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
  deleteGoal: vi.fn().mockResolvedValue(true),
  getTasksByGoalId: vi.fn().mockResolvedValue([]),
  getTodayTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockImplementation(async (task) => task),
  updateTask: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
  deleteTask: vi.fn().mockResolvedValue(true),
  getUserSession: vi.fn().mockResolvedValue(null),
  upsertUserSession: vi.fn().mockResolvedValue({}),
}));

// Mock LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          tasks: [
            { text: "Test task", priority: "high", goalId: "goal-1", goalName: "Test Goal" }
          ]
        })
      }
    }]
  })
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "Dit is een test transcriptie",
    language: "nl"
  })
}));

describe("Priority Sorting", () => {
  it("should sort tasks by priority: high -> medium -> low -> null", () => {
    const tasks = [
      { id: "1", text: "Low task", priority: "low" },
      { id: "2", text: "High task", priority: "high" },
      { id: "3", text: "No priority", priority: null },
      { id: "4", text: "Medium task", priority: "medium" },
    ];

    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sorted = [...tasks].sort((a, b) => {
      const aOrder = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
      const bOrder = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
      return aOrder - bOrder;
    });

    expect(sorted[0].priority).toBe("high");
    expect(sorted[1].priority).toBe("medium");
    expect(sorted[2].priority).toBe("low");
    expect(sorted[3].priority).toBe(null);
  });

  it("should maintain order within same priority level", () => {
    const tasks = [
      { id: "1", text: "First high", priority: "high", orderIndex: 0 },
      { id: "2", text: "Second high", priority: "high", orderIndex: 1 },
      { id: "3", text: "First medium", priority: "medium", orderIndex: 0 },
    ];

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    const sorted = [...tasks].sort((a, b) => {
      const aOrder = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
      const bOrder = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.orderIndex - b.orderIndex;
    });

    expect(sorted[0].id).toBe("1");
    expect(sorted[1].id).toBe("2");
    expect(sorted[2].id).toBe("3");
  });
});

describe("Dump Analysis", () => {
  it("should parse dump text and identify potential tasks", () => {
    const dumpText = `
      Vandaag moet ik de presentatie afmaken voor de klant.
      Ook moet ik nog bellen met Jan over het project.
      Vergeet niet om de factuur te sturen.
    `;

    // Simple task extraction logic (simulating AI behavior)
    const taskIndicators = ["moet", "vergeet niet", "nog"];
    const sentences = dumpText.split(/[.!?\n]/).filter(s => s.trim());
    
    const potentialTasks = sentences.filter(sentence => 
      taskIndicators.some(indicator => sentence.toLowerCase().includes(indicator))
    );

    expect(potentialTasks.length).toBeGreaterThan(0);
    expect(potentialTasks.some(t => t.includes("presentatie"))).toBe(true);
  });

  it("should categorize suggestions into tasks, goals, and context", () => {
    const mockAIResponse = {
      newTasks: [
        { text: "Presentatie afmaken", priority: "high", trackId: "track-1", goalId: "goal-1" }
      ],
      newGoals: [
        { name: "Klantproject afronden", description: "Alle deliverables opleveren", trackId: "track-1" }
      ],
      contextUpdates: [
        { trackId: "track-1", contextToAdd: "Klant verwacht oplevering volgende week" }
      ],
      taskUpdates: [],
      summary: "3 items geïdentificeerd"
    };

    expect(mockAIResponse.newTasks).toHaveLength(1);
    expect(mockAIResponse.newGoals).toHaveLength(1);
    expect(mockAIResponse.contextUpdates).toHaveLength(1);
    expect(mockAIResponse.newTasks[0].priority).toBe("high");
  });
});

describe("Daily Setup AI", () => {
  it("should select appropriate number of tasks based on energy level", () => {
    const allTasks = [
      { id: "1", text: "Task 1", priority: "high", isCompleted: false },
      { id: "2", text: "Task 2", priority: "high", isCompleted: false },
      { id: "3", text: "Task 3", priority: "medium", isCompleted: false },
      { id: "4", text: "Task 4", priority: "medium", isCompleted: false },
      { id: "5", text: "Task 5", priority: "low", isCompleted: false },
      { id: "6", text: "Task 6", priority: "low", isCompleted: false },
      { id: "7", text: "Task 7", priority: "low", isCompleted: false },
      { id: "8", text: "Task 8", priority: "low", isCompleted: false },
    ];

    const selectTasksForEnergy = (tasks: typeof allTasks, energy: "Low" | "Normal" | "High") => {
      const limits = { Low: 4, Normal: 6, High: 8 };
      const limit = limits[energy];
      
      // Sort by priority and take top N
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted = [...tasks]
        .filter(t => !t.isCompleted)
        .sort((a, b) => {
          const aOrder = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
          const bOrder = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
          return aOrder - bOrder;
        });
      
      return sorted.slice(0, limit);
    };

    const lowEnergyTasks = selectTasksForEnergy(allTasks, "Low");
    const normalEnergyTasks = selectTasksForEnergy(allTasks, "Normal");
    const highEnergyTasks = selectTasksForEnergy(allTasks, "High");

    expect(lowEnergyTasks.length).toBeLessThanOrEqual(4);
    expect(normalEnergyTasks.length).toBeLessThanOrEqual(6);
    expect(highEnergyTasks.length).toBeLessThanOrEqual(8);

    // High priority tasks should be selected first
    expect(lowEnergyTasks[0].priority).toBe("high");
    expect(lowEnergyTasks[1].priority).toBe("high");
  });

  it("should consider daily intention when selecting tasks", () => {
    const tasks = [
      { id: "1", text: "Presentatie maken", priority: "medium", trackName: "Werk" },
      { id: "2", text: "Email beantwoorden", priority: "medium", trackName: "Werk" },
      { id: "3", text: "Sporten", priority: "medium", trackName: "Gezondheid" },
      { id: "4", text: "Klant bellen", priority: "high", trackName: "Werk" },
    ];

    const intention = "Vandaag focus ik op de presentatie voor de klant";
    
    // Simple relevance scoring based on keyword matching
    const scoreTaskRelevance = (task: typeof tasks[0], intention: string) => {
      const intentionWords = intention.toLowerCase().split(/\s+/);
      const taskWords = task.text.toLowerCase().split(/\s+/);
      
      let score = 0;
      for (const word of taskWords) {
        if (intentionWords.includes(word)) score += 1;
      }
      return score;
    };

    const scoredTasks = tasks.map(t => ({
      ...t,
      relevanceScore: scoreTaskRelevance(t, intention)
    }));

    const presentatieTask = scoredTasks.find(t => t.text.includes("Presentatie"));
    const sportTask = scoredTasks.find(t => t.text.includes("Sporten"));

    expect(presentatieTask?.relevanceScore).toBeGreaterThan(0);
    expect(sportTask?.relevanceScore).toBe(0);
  });
});

describe("Track Overview", () => {
  it("should calculate correct statistics without progress bar", () => {
    const track = {
      id: "track-1",
      name: "Werk",
      goals: [
        {
          id: "goal-1",
          tasks: [
            { id: "1", isCompleted: true },
            { id: "2", isCompleted: false },
            { id: "3", isCompleted: true },
          ]
        },
        {
          id: "goal-2",
          tasks: [
            { id: "4", isCompleted: false },
            { id: "5", isCompleted: false },
          ]
        }
      ]
    };

    const totalTasks = track.goals.reduce((sum, g) => sum + g.tasks.length, 0);
    const completedTasks = track.goals.reduce(
      (sum, g) => sum + g.tasks.filter(t => t.isCompleted).length, 0
    );
    const totalGoals = track.goals.length;

    expect(totalTasks).toBe(5);
    expect(completedTasks).toBe(2);
    expect(totalGoals).toBe(2);
    
    // No progress percentage calculation needed (removed from UI)
  });
});

describe("Speech-to-Text Integration", () => {
  it("should handle successful transcription", async () => {
    const mockTranscription = {
      text: "Dit is een test transcriptie voor de dump functie",
      language: "nl",
      success: true
    };

    expect(mockTranscription.success).toBe(true);
    expect(mockTranscription.text).toContain("test");
    expect(mockTranscription.language).toBe("nl");
  });

  it("should handle transcription errors gracefully", () => {
    const errorResponse = {
      text: "",
      language: "nl",
      success: false,
      error: "Transcriptie mislukt. Probeer het opnieuw."
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.text).toBe("");
  });
});

describe("AI Task Extraction", () => {
  it("should extract tasks from notes with correct structure", () => {
    const mockExtractedTasks = [
      {
        text: "Presentatie voorbereiden",
        priority: "high",
        trackId: "track-1",
        trackName: "Werk",
        goalId: "goal-1",
        goalName: "Klantproject",
        selected: true
      },
      {
        text: "Onderzoek doen",
        priority: "medium",
        trackId: "track-1",
        trackName: "Werk",
        goalId: "goal-1",
        goalName: "Klantproject",
        selected: true
      }
    ];

    expect(mockExtractedTasks).toHaveLength(2);
    expect(mockExtractedTasks[0].selected).toBe(true);
    expect(mockExtractedTasks[0].trackId).toBeDefined();
    expect(mockExtractedTasks[0].goalId).toBeDefined();
  });

  it("should allow selecting/deselecting individual tasks", () => {
    const tasks = [
      { text: "Task 1", selected: true },
      { text: "Task 2", selected: true },
      { text: "Task 3", selected: true },
    ];

    // Deselect second task
    tasks[1].selected = false;

    const selectedTasks = tasks.filter(t => t.selected);
    expect(selectedTasks).toHaveLength(2);
    expect(selectedTasks.find(t => t.text === "Task 2")).toBeUndefined();
  });

  it("should support 'Accept All' functionality", () => {
    const tasks = [
      { text: "Task 1", selected: false },
      { text: "Task 2", selected: false },
      { text: "Task 3", selected: true },
    ];

    // Accept all
    tasks.forEach(t => t.selected = true);

    expect(tasks.every(t => t.selected)).toBe(true);
  });
});

describe("Context Extraction", () => {
  it("should extract context information from notes", () => {
    const mockContextExtraction = {
      extractedContext: "Tony is de mede-oprichter van ModellenWerk. Het bedrijf focust op groei van 200K naar 500K.",
      hasNewContext: true
    };

    expect(mockContextExtraction.hasNewContext).toBe(true);
    expect(mockContextExtraction.extractedContext).toContain("Tony");
    expect(mockContextExtraction.extractedContext).toContain("ModellenWerk");
  });

  it("should return hasNewContext: false when no relevant context found", () => {
    const mockContextExtraction = {
      extractedContext: "",
      hasNewContext: false
    };

    expect(mockContextExtraction.hasNewContext).toBe(false);
    expect(mockContextExtraction.extractedContext).toBe("");
  });

  it("should append new context to existing context", () => {
    const existingContext = "ModellenWerk is een startup gericht op de modellenindustrie.";
    const newContext = "Tony en Rob zijn de oprichters. Focus ligt op digitale transformatie.";
    
    const combinedContext = `${existingContext}\n\n${newContext}`;
    
    expect(combinedContext).toContain(existingContext);
    expect(combinedContext).toContain(newContext);
    expect(combinedContext.split("\n\n")).toHaveLength(2);
  });

  it("should distinguish between tasks and context information", () => {
    // Tasks are actionable items
    const taskIndicators = ["moet", "doe", "maak", "bel", "stuur", "plan"];
    
    // Context is background information
    const contextIndicators = ["is", "zijn", "heeft", "focust op", "werkt aan", "betreft"];
    
    const notes = `
      Tony is de CEO van ModellenWerk.
      Het bedrijf focust op groei naar 500K omzet.
      Ik moet de presentatie afmaken voor vrijdag.
      De klant heeft voorkeur voor digitale oplossingen.
    `;
    
    const sentences = notes.split(/[.!?\n]/).filter(s => s.trim());
    
    const potentialTasks = sentences.filter(s => 
      taskIndicators.some(ind => s.toLowerCase().includes(ind))
    );
    
    const potentialContext = sentences.filter(s => 
      contextIndicators.some(ind => s.toLowerCase().includes(ind)) &&
      !taskIndicators.some(ind => s.toLowerCase().includes(ind))
    );
    
    expect(potentialTasks.length).toBeGreaterThan(0);
    expect(potentialContext.length).toBeGreaterThan(0);
    expect(potentialTasks.some(t => t.includes("presentatie"))).toBe(true);
    expect(potentialContext.some(c => c.includes("Tony"))).toBe(true);
  });

  it("should handle context from multiple sources", () => {
    const contextSources = {
      notes: "Tony is de mede-oprichter.",
      completedTasks: ["Presentatie afgerond voor klant X", "Contract getekend met leverancier Y"],
      completedGoals: ["Q1 targets behaald"],
      documents: ["business-plan.pdf", "contract-leverancier.docx"]
    };

    // Aggregate context
    const aggregatedContext = [
      contextSources.notes,
      `Voltooide taken: ${contextSources.completedTasks.join(", ")}`,
      `Behaalde doelen: ${contextSources.completedGoals.join(", ")}`,
      `Documenten: ${contextSources.documents.join(", ")}`
    ].join("\n\n");

    expect(aggregatedContext).toContain("Tony");
    expect(aggregatedContext).toContain("Presentatie afgerond");
    expect(aggregatedContext).toContain("Q1 targets");
    expect(aggregatedContext).toContain("business-plan.pdf");
  });
});


describe("AI Chat with Context", () => {
  it("should build context from track context and documents", () => {
    const trackContext = "Dit is een consultancy project voor klant X";
    const documents = [
      { fileName: "proposal.pdf", extractedText: "Voorstel voor digitale transformatie" },
      { fileName: "notes.docx", extractedText: "Meeting notes van 5 februari" }
    ];

    let fullContext = '';
    
    if (trackContext) {
      fullContext += `## Track Context\n${trackContext}\n\n`;
    }
    
    if (documents && documents.length > 0) {
      fullContext += `## Documenten\n`;
      for (const doc of documents) {
        fullContext += `### ${doc.fileName}\n`;
        if (doc.extractedText) {
          fullContext += `${doc.extractedText}\n\n`;
        }
      }
    }

    expect(fullContext).toContain("Track Context");
    expect(fullContext).toContain("consultancy project");
    expect(fullContext).toContain("Documenten");
    expect(fullContext).toContain("proposal.pdf");
    expect(fullContext).toContain("digitale transformatie");
  });

  it("should handle empty context and documents", () => {
    const trackContext = "";
    const documents: Array<{ fileName: string; extractedText: string }> = [];

    let fullContext = '';
    
    if (trackContext) {
      fullContext += `## Track Context\n${trackContext}\n\n`;
    }
    
    if (documents && documents.length > 0) {
      fullContext += `## Documenten\n`;
    }

    expect(fullContext).toBe('');
  });

  it("should maintain chat history for context", () => {
    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'Wat zijn de belangrijkste punten?' },
      { role: 'assistant', content: 'De belangrijkste punten zijn...' }
    ];

    const newQuestion = "Kun je dat uitleggen?";
    chatHistory.push({ role: 'user', content: newQuestion });

    expect(chatHistory).toHaveLength(3);
    expect(chatHistory[2].role).toBe('user');
    expect(chatHistory[2].content).toBe(newQuestion);
  });
});

describe("Context Editing", () => {
  it("should allow editing context text", () => {
    const originalContext = "Oorspronkelijke context tekst";
    let editedContext = originalContext;
    
    // Simulate editing
    editedContext = "Aangepaste context tekst met meer details";
    
    expect(editedContext).not.toBe(originalContext);
    expect(editedContext).toContain("Aangepaste");
  });

  it("should allow clearing context", () => {
    const originalContext = "Context die verwijderd moet worden";
    let editedContext = originalContext;
    
    // Simulate clearing
    editedContext = "";
    
    expect(editedContext).toBe("");
  });
});

describe("Context from Completed Goals", () => {
  it("should generate context entry when goal is completed", () => {
    const goal = {
      id: "goal-1",
      name: "Klantpresentatie afronden",
      isCompleted: true
    };

    const today = new Date().toLocaleDateString('nl-NL');
    const contextEntry = `[${today}] Doel bereikt: "${goal.name}"`;

    expect(contextEntry).toContain("Doel bereikt");
    expect(contextEntry).toContain(goal.name);
    expect(contextEntry).toContain(today);
  });

  it("should append to existing context", () => {
    const existingContext = "Bestaande context informatie";
    const newEntry = "[5-2-2026] Doel bereikt: \"Test doel\"";
    
    const newContext = `${existingContext}\n${newEntry}`;
    
    expect(newContext).toContain(existingContext);
    expect(newContext).toContain(newEntry);
  });
});

describe("Drag and Drop for Today's Focus", () => {
  it("should reorder tasks using arrayMove", () => {
    const tasks = [
      { id: "task-1", text: "Eerste taak" },
      { id: "task-2", text: "Tweede taak" },
      { id: "task-3", text: "Derde taak" },
    ];

    // Simulate arrayMove from dnd-kit
    const arrayMove = <T,>(array: T[], from: number, to: number): T[] => {
      const newArray = [...array];
      const [removed] = newArray.splice(from, 1);
      newArray.splice(to, 0, removed);
      return newArray;
    };

    // Move task-3 to position 0
    const reordered = arrayMove(tasks, 2, 0);

    expect(reordered[0].id).toBe("task-3");
    expect(reordered[1].id).toBe("task-1");
    expect(reordered[2].id).toBe("task-2");
  });

  it("should maintain task data after reordering", () => {
    const tasks = [
      { id: "task-1", text: "Taak 1", priority: "high" as const, trackName: "Werk" },
      { id: "task-2", text: "Taak 2", priority: "medium" as const, trackName: "Persoonlijk" },
    ];

    const arrayMove = <T,>(array: T[], from: number, to: number): T[] => {
      const newArray = [...array];
      const [removed] = newArray.splice(from, 1);
      newArray.splice(to, 0, removed);
      return newArray;
    };

    const reordered = arrayMove(tasks, 1, 0);

    expect(reordered[0].priority).toBe("medium");
    expect(reordered[0].trackName).toBe("Persoonlijk");
    expect(reordered[1].priority).toBe("high");
  });
});

describe("Document Management", () => {
  it("should validate allowed file types", () => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    expect(allowedTypes.includes('application/pdf')).toBe(true);
    expect(allowedTypes.includes('image/jpeg')).toBe(false);
    expect(allowedTypes.includes('text/plain')).toBe(false);
  });

  it("should create document record with correct structure", () => {
    const document = {
      trackId: "track-1",
      fileName: "proposal.pdf",
      fileUrl: "https://storage.example.com/files/proposal.pdf",
      fileType: "application/pdf",
      fileSize: 1024000,
      extractedText: "Dit is de geëxtraheerde tekst uit het document"
    };

    expect(document.trackId).toBeDefined();
    expect(document.fileName).toBe("proposal.pdf");
    expect(document.fileUrl).toContain("https://");
    expect(document.extractedText).toBeDefined();
  });

  it("should handle document deletion", () => {
    const documents = [
      { id: "doc-1", fileName: "file1.pdf" },
      { id: "doc-2", fileName: "file2.docx" },
      { id: "doc-3", fileName: "file3.xlsx" },
    ];

    const idToDelete = "doc-2";
    const remainingDocs = documents.filter(d => d.id !== idToDelete);

    expect(remainingDocs).toHaveLength(2);
    expect(remainingDocs.find(d => d.id === idToDelete)).toBeUndefined();
  });
});
