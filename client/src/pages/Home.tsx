import { useState, useEffect, useRef } from 'react';
import { useFocusFlow } from '@/hooks/useFocusFlow';
import type { Track, Goal, Task, TaskWithRelations } from '@/types/frontend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, Settings, Loader2, Sparkles, CheckCircle, X, 
  ChevronDown, ChevronLeft, ChevronRight, Trash2, Edit2,
  Target, Calendar, Brain, Eye, EyeOff, Star, Mic, MicOff,
  FileText, Upload, MessageSquare, Zap, BookOpen, GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

// Track colors
const trackColors: Record<string, string> = {
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
};

const trackColorsBorder: Record<string, string> = {
  teal: 'border-teal-500',
  blue: 'border-blue-500',
  purple: 'border-purple-500',
  pink: 'border-pink-500',
  orange: 'border-orange-500',
  green: 'border-green-500',
  red: 'border-red-500',
  yellow: 'border-yellow-500',
};

const trackColorsLight: Record<string, string> = {
  teal: 'bg-teal-50 hover:bg-teal-100',
  blue: 'bg-blue-50 hover:bg-blue-100',
  purple: 'bg-purple-50 hover:bg-purple-100',
  pink: 'bg-pink-50 hover:bg-pink-100',
  orange: 'bg-orange-50 hover:bg-orange-100',
  green: 'bg-green-50 hover:bg-green-100',
  red: 'bg-red-50 hover:bg-red-100',
  yellow: 'bg-yellow-50 hover:bg-yellow-100',
};

const trackColorsIcon: Record<string, string> = {
  teal: 'text-teal-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  orange: 'text-orange-500',
  green: 'text-green-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
};

// Priority order for sorting
const priorityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Sort tasks by priority (high -> medium -> low -> null)
function sortByPriority<T extends { priority: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const aOrder = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
    const bOrder = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
    return aOrder - bOrder;
  });
}

// Sortable Task Item for Today's Focus drag and drop
interface SortableTaskItemProps {
  task: Task & { trackId: string; trackName: string; goalName: string };
  onToggle: () => void;
}

function SortableTaskItem({ task, onToggle }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg bg-white border ${
        task.isCompleted ? 'opacity-50' : ''
      } ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Checkbox
        checked={task.isCompleted}
        onCheckedChange={onToggle}
      />
      <div className="flex-1">
        <span className={task.isCompleted ? 'line-through' : ''}>
          {task.text}
        </span>
        <div className="text-xs text-stone-500">
          {task.trackName} → {task.goalName}
        </div>
      </div>
      {task.priority && (
        <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}>
          {task.priority === 'high' ? 'Hoog' : task.priority === 'medium' ? 'Midden' : 'Laag'}
        </Badge>
      )}
    </div>
  );
}

// DumpSuggestion type (kept for AI features)
interface DumpSuggestion {
  newTasks: Array<{
    text: string;
    priority: string;
    trackId: string;
    trackName: string;
    goalId: string;
    goalName: string;
    selected?: boolean;
  }>;
  taskUpdates: Array<{
    taskId: string;
    action: string;
    newPriority?: string;
    selected?: boolean;
  }>;
  newGoals: Array<{
    name: string;
    description: string;
    trackId: string;
    trackName: string;
    selected?: boolean;
  }>;
  contextUpdates: Array<{
    trackId: string;
    trackName: string;
    contextToAdd: string;
    selected?: boolean;
  }>;
  summary: string;
}

export default function Home() {
  // ==================== REST API HOOK (replaces tRPC) ====================
  const {
    tracks: fetchedTracks,
    todayTasks: fetchedTodayTasks,
    session,
    isLoading: dataLoading,
    createTrack: apiCreateTrack,
    updateTrack: apiUpdateTrack,
    deleteTrack: apiDeleteTrack,
    createGoal: apiCreateGoal,
    updateGoal: apiUpdateGoal,
    deleteGoal: apiDeleteGoal,
    createTask: apiCreateTask,
    updateTask: apiUpdateTask,
    deleteTask: apiDeleteTask,
    updateSession,
    refetch,
  } = useFocusFlow();
  
  // Data state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [todayTasks, setTodayTasks] = useState<Array<Task & { trackId: string; trackName: string; goalName: string }>>([]);
  
  // UI state
  const [focusMode, setFocusMode] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());
  const [showDailySetup, setShowDailySetup] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showDumpDialog, setShowDumpDialog] = useState(false);
  const [showDumpResults, setShowDumpResults] = useState(false);
  const [showExtractResults, setShowExtractResults] = useState(false);
  
  // Session state
  const [dailyIntention, setDailyIntention] = useState('');
  const [energyLevel, setEnergyLevel] = useState<'Low' | 'Normal' | 'High'>('Normal');
  
  // Form state
  const [newTaskText, setNewTaskText] = useState('');
  const [newGoalText, setNewGoalText] = useState('');
  const [showNewTrackDialog, setShowNewTrackDialog] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackColor, setNewTrackColor] = useState('teal');
  
  // Dump state
  const [dumpText, setDumpText] = useState('');
  const [dumpSuggestions, setDumpSuggestions] = useState<DumpSuggestion | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Extract tasks state
  const [extractSuggestions, setExtractSuggestions] = useState<Array<{
    text: string;
    priority: string;
    trackId: string;
    trackName: string;
    goalId: string;
    goalName: string;
    selected: boolean;
  }>>([]);
  const [currentExtractTrackId, setCurrentExtractTrackId] = useState<string | null>(null);
  
  // Speech recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ==================== SYNC DATA FROM REST API ====================
  
  useEffect(() => {
    setTracks(fetchedTracks);
  }, [fetchedTracks]);

  useEffect(() => {
    const sorted = sortByPriority(fetchedTodayTasks as Array<Task & { trackId: string; trackName: string; goalName: string }>);
    setTodayTasks(sorted);
  }, [fetchedTodayTasks]);

  useEffect(() => {
    setDailyIntention(session.dailyIntention || '');
    setEnergyLevel(session.energyLevel);
    setFocusMode(session.focusMode);
    if (session.currentTrackId) {
      const idx = tracks.findIndex(t => t.id === session.currentTrackId);
      if (idx !== -1) setCurrentTrackIndex(idx);
    }
  }, [session, tracks]);

  // Helper functions
  const currentTrack = tracks[currentTrackIndex];

  const toggleGoalCollapse = (goalId: string) => {
    setCollapsedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  // ==================== SPEECH RECORDING (kept for future AI integration) ====================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        // AI transcription disabled during migration
        toast.info('Spraakherkenning is tijdelijk uitgeschakeld tijdens migratie');
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Opname gestart...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Kon microfoon niet starten. Controleer je browser-instellingen.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info('Opname gestopt');
    }
  };

  // ==================== AI FEATURES (temporarily disabled) ====================

  const handleAnalyzeDump = async () => {
    if (!dumpText.trim()) {
      toast.error('Voer eerst tekst in om te analyseren');
      return;
    }
    toast.info('AI analyse is tijdelijk uitgeschakeld tijdens REST API migratie. Je kunt handmatig taken toevoegen.');
    setShowDumpDialog(false);
  };

  const handleApplyDumpSuggestions = async () => {
    if (!dumpSuggestions) return;

    try {
      // Create new goals first
      for (const goal of dumpSuggestions.newGoals.filter(g => g.selected)) {
        if (goal.trackId !== 'new') {
          await apiCreateGoal({
            id: nanoid(),
            trackId: goal.trackId,
            name: goal.name,
            description: goal.description,
          });
        }
      }

      // Create new tasks
      for (const task of dumpSuggestions.newTasks.filter(t => t.selected)) {
        if (task.trackId !== 'new' && task.goalId !== 'new') {
          await apiCreateTask({
            id: nanoid(),
            goalId: task.goalId,
            text: task.text,
            priority: task.priority as 'low' | 'medium' | 'high' | null,
          });
        }
      }

      // Apply task updates
      for (const update of dumpSuggestions.taskUpdates.filter(u => u.selected)) {
        if (update.action === 'complete') {
          await apiUpdateTask(update.taskId, { isCompleted: true });
        } else if (update.action === 'updatePriority' && update.newPriority) {
          await apiUpdateTask(update.taskId, { 
            priority: update.newPriority as 'low' | 'medium' | 'high' 
          });
        } else if (update.action === 'addToToday') {
          await apiUpdateTask(update.taskId, { isToday: true });
        }
      }

      // Apply context updates
      for (const contextUpdate of dumpSuggestions.contextUpdates.filter(c => c.selected)) {
        const track = tracks.find(t => t.id === contextUpdate.trackId);
        if (track) {
          const newContext = track.context 
            ? `${track.context}\n\n${contextUpdate.contextToAdd}`
            : contextUpdate.contextToAdd;
          await apiUpdateTrack(track.id, { context: newContext });
        }
      }

      toast.success('Suggesties toegepast!');
      setShowDumpResults(false);
      setDumpText('');
      setDumpSuggestions(null);
      
      // Refresh data
      await refetch();
    } catch (error) {
      console.error('Failed to apply suggestions:', error);
      toast.error('Kon suggesties niet toepassen');
    }
  };

  // ==================== DAILY SETUP ====================

  const handleStartDaily = async () => {
    try {
      updateSession({
        dailyIntention: dailyIntention || null,
        energyLevel,
        sessionStartTime: new Date().toISOString(),
      });

      setShowDailySetup(false);
      toast.success('Daily setup voltooid! Voeg taken toe aan Today\'s Focus via het ster-icoon.');
    } catch (error) {
      console.error('Daily setup failed:', error);
      toast.error('Daily setup mislukt');
    }
  };

  // ==================== TRACK CRUD ====================

  const handleCreateTrack = async () => {
    if (!newTrackName.trim()) return;
    try {
      await apiCreateTrack({
        id: nanoid(),
        name: newTrackName.trim(),
        color: newTrackColor,
        orderIndex: tracks.length,
      });
      setNewTrackName('');
      setNewTrackColor('teal');
      setShowNewTrackDialog(false);
      toast.success('Track aangemaakt');
    } catch (error) {
      console.error('Failed to create track:', error);
      toast.error('Kon track niet aanmaken');
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm('Weet je zeker dat je deze Track wilt verwijderen?')) return;
    try {
      await apiDeleteTrack(trackId);
      if (currentTrackIndex >= tracks.length - 1) {
        setCurrentTrackIndex(Math.max(0, tracks.length - 2));
      }
      toast.success('Track verwijderd');
    } catch (error) {
      console.error('Failed to delete track:', error);
      toast.error('Kon track niet verwijderen');
    }
  };

  // ==================== GOAL CRUD ====================

  const handleAddGoal = async (trackId: string) => {
    if (!newGoalText.trim()) return;
    try {
      await apiCreateGoal({
        id: nanoid(),
        trackId,
        name: newGoalText.trim(),
        orderIndex: tracks.find(t => t.id === trackId)?.goals.length || 0,
      });
      setNewGoalText('');
      toast.success('Doel toegevoegd');
    } catch (error) {
      console.error('Failed to create goal:', error);
      toast.error('Kon doel niet toevoegen');
    }
  };

  const handleDeleteGoal = async (goalId: string, trackId: string) => {
    try {
      await apiDeleteGoal(goalId);
      toast.success('Doel verwijderd');
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Kon doel niet verwijderen');
    }
  };

  // ==================== TASK CRUD ====================

  const handleAddTask = async (goalId: string, trackId: string) => {
    if (!newTaskText.trim()) return;
    try {
      const goal = tracks.find(t => t.id === trackId)?.goals.find(g => g.id === goalId);
      await apiCreateTask({
        id: nanoid(),
        goalId,
        text: newTaskText.trim(),
        orderIndex: goal?.tasks.length || 0,
      });
      setNewTaskText('');
      toast.success('Taak toegevoegd');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Kon taak niet toevoegen');
    }
  };

  const handleToggleTask = async (taskId: string, goalId: string, trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    const goal = track?.goals.find(g => g.id === goalId);
    const task = goal?.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await apiUpdateTask(taskId, { isCompleted: !task.isCompleted });
      
      // Optimistic update for today tasks
      setTodayTasks(prev => prev.map(tk => 
        tk.id === taskId ? { ...tk, isCompleted: !tk.isCompleted } : tk
      ));
    } catch (error) {
      console.error('Failed to toggle task:', error);
      toast.error('Kon taak niet bijwerken');
    }
  };

  const handleToggleToday = async (taskId: string, goalId: string, trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    const goal = track?.goals.find(g => g.id === goalId);
    const task = goal?.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await apiUpdateTask(taskId, { isToday: !task.isToday });
      
      // Refresh to update today tasks list
      await refetch();
    } catch (error) {
      console.error('Failed to toggle today:', error);
      toast.error('Kon Today\'s Focus niet bijwerken');
    }
  };

  // Handle drag end for Today's Focus reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setTodayTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSetPriority = async (taskId: string, goalId: string, trackId: string, priority: 'low' | 'medium' | 'high' | null) => {
    try {
      await apiUpdateTask(taskId, { priority });
    } catch (error) {
      console.error('Failed to set priority:', error);
      toast.error('Kon prioriteit niet instellen');
    }
  };

  const handleDeleteTask = async (taskId: string, goalId: string, trackId: string) => {
    try {
      await apiDeleteTask(taskId);
      toast.success('Taak verwijderd');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Kon taak niet verwijderen');
    }
  };

  // Extract tasks from notes (AI feature - temporarily simplified)
  const handleExtractTasks = async (trackId: string, notes: string) => {
    if (!notes.trim()) {
      toast.error('Voeg eerst notities toe');
      return;
    }
    toast.info('AI taak-extractie is tijdelijk uitgeschakeld tijdens REST API migratie. Voeg taken handmatig toe.');
  };

  // Apply extracted tasks
  const handleApplyExtractedTasks = async () => {
    const selectedTasks = extractSuggestions.filter(s => s.selected);
    
    try {
      for (const task of selectedTasks) {
        if (task.goalId && task.goalId !== 'new') {
          await apiCreateTask({
            id: nanoid(),
            goalId: task.goalId,
            text: task.text,
            priority: task.priority as 'low' | 'medium' | 'high' | null,
          });
        }
      }

      toast.success(`${selectedTasks.length} taken toegevoegd`);
      setShowExtractResults(false);
      setExtractSuggestions([]);
      await refetch();
    } catch (error) {
      console.error('Failed to apply extracted tasks:', error);
      toast.error('Kon taken niet toevoegen');
    }
  };

  // Navigation
  const goToPrevTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prev => prev - 1);
    }
  };

  const goToNextTrack = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
    }
  };

  // Loading state
  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <Loader2 className="w-8 h-8 animate-spin text-stone-500" />
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800">FocusFlow</h1>
          <div className="flex items-center gap-2">
            {/* Dump Button - Prominent */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowDumpDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Dump
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDailySetup(true)}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Daily Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFocusMode(!focusMode)}
              title={focusMode ? 'Toon alle Tracks' : 'Focus Mode'}
            >
              {focusMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Today's Focus Section */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
              Today's Focus
              {dailyIntention && (
                <span className="text-sm font-normal text-stone-500 ml-2">
                  — {dailyIntention}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.filter(t => !t.isCompleted).length === 0 ? (
              <p className="text-stone-500 text-sm">
                {todayTasks.some(t => t.isCompleted) 
                  ? 'Alle taken voor vandaag zijn voltooid! Goed gedaan!' 
                  : 'Voeg taken toe aan Today\'s Focus door op het ster-icoon te klikken bij een taak, of gebruik Daily Setup'}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={todayTasks.filter(t => !t.isCompleted).map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {todayTasks.filter(t => !t.isCompleted).map(task => (
                      <SortableTaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => {
                          const track = tracks.find(t => t.id === task.trackId);
                          const goal = track?.goals.find(g => g.tasks.some(tk => tk.id === task.id));
                          if (goal) {
                            handleToggleTask(task.id, goal.id, task.trackId);
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>

        {/* Track Navigation (Focus Mode) */}
        {focusMode && tracks.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevTrack}
              disabled={currentTrackIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Vorige
            </Button>
            <div className="flex items-center gap-2">
              {tracks.map((track, idx) => (
                <button
                  key={track.id}
                  onClick={() => setCurrentTrackIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentTrackIndex
                      ? `${trackColors[track.color] || 'bg-teal-500'} ring-2 ring-offset-2 ring-stone-300`
                      : 'bg-stone-300 hover:bg-stone-400'
                  }`}
                  title={track.name}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextTrack}
              disabled={currentTrackIndex === tracks.length - 1}
            >
              Volgende
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Tracks View */}
        {focusMode ? (
          currentTrack ? (
            <TrackCard
              track={currentTrack}
              collapsedGoals={collapsedGoals}
              toggleGoalCollapse={toggleGoalCollapse}
              newGoalText={newGoalText}
              setNewGoalText={setNewGoalText}
              newTaskText={newTaskText}
              setNewTaskText={setNewTaskText}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onToggleToday={handleToggleToday}
              onSetPriority={handleSetPriority}
              onDeleteTask={handleDeleteTask}
              onDeleteTrack={handleDeleteTrack}
              onExtractTasks={handleExtractTasks}
            />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-stone-500 mb-4">Je hebt nog geen Tracks. Maak je eerste Track aan om te beginnen.</p>
              <Button onClick={() => setShowNewTrackDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe Track
              </Button>
            </Card>
          )
        ) : (
          tracks.length > 0 ? (
            <Tabs defaultValue={tracks[0]?.id} className="w-full">
              <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-white p-1 border">
                {tracks.map(track => (
                  <TabsTrigger
                    key={track.id}
                    value={track.id}
                    className="data-[state=active]:bg-stone-800 data-[state=active]:text-white"
                  >
                    <div className={`w-2 h-2 rounded-full ${trackColors[track.color] || 'bg-teal-500'} mr-2`} />
                    {track.name}
                  </TabsTrigger>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewTrackDialog(true)}
                  className="ml-auto"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TabsList>
              {tracks.map(track => (
                <TabsContent key={track.id} value={track.id} className="mt-4">
                  <TrackCard
                    track={track}
                    collapsedGoals={collapsedGoals}
                    toggleGoalCollapse={toggleGoalCollapse}
                    newGoalText={newGoalText}
                    setNewGoalText={setNewGoalText}
                    newTaskText={newTaskText}
                    setNewTaskText={setNewTaskText}
                    onAddGoal={handleAddGoal}
                    onDeleteGoal={handleDeleteGoal}
                    onAddTask={handleAddTask}
                    onToggleTask={handleToggleTask}
                    onToggleToday={handleToggleToday}
                    onSetPriority={handleSetPriority}
                    onDeleteTask={handleDeleteTask}
                    onDeleteTrack={handleDeleteTrack}
                    onExtractTasks={handleExtractTasks}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-stone-500 mb-4">Je hebt nog geen Tracks. Maak je eerste Track aan om te beginnen.</p>
              <Button onClick={() => setShowNewTrackDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe Track
              </Button>
            </Card>
          )
        )}

        {/* Add Track Button (Focus Mode) */}
        {focusMode && tracks.length > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShowNewTrackDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nieuwe Track
            </Button>
          </div>
        )}


      </main>

      {/* Dump Dialog */}
      <Dialog open={showDumpDialog} onOpenChange={setShowDumpDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Gedachten Dump
            </DialogTitle>
            <DialogDescription>
              Typ of spreek je gedachten in. De AI analyseert ze en stelt doelen, taken en context-updates voor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Textarea
                value={dumpText}
                onChange={(e) => setDumpText(e.target.value)}
                placeholder="Typ hier je gedachten, ideeën, to-do's, of wat er maar in je opkomt..."
                className="min-h-[200px] pr-12"
              />
              <Button
                variant="ghost"
                size="sm"
                className={`absolute bottom-2 right-2 ${isRecording ? 'text-red-500' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Opname bezig... Klik op de microfoon om te stoppen.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDumpDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleAnalyzeDump} disabled={isAnalyzing || !dumpText.trim()}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyseren...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Analyseer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dump Results Dialog */}
      <Dialog open={showDumpResults} onOpenChange={setShowDumpResults}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI Suggesties</DialogTitle>
            <DialogDescription>
              {dumpSuggestions?.summary}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-6 pr-4">
              {/* New Tasks */}
              {dumpSuggestions?.newTasks && dumpSuggestions.newTasks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Nieuwe Taken ({dumpSuggestions.newTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {dumpSuggestions.newTasks.map((task, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-stone-50 rounded">
                        <Checkbox
                          checked={task.selected}
                          onCheckedChange={(checked) => {
                            setDumpSuggestions(prev => prev ? {
                              ...prev,
                              newTasks: prev.newTasks.map((t, i) => 
                                i === idx ? { ...t, selected: !!checked } : t
                              )
                            } : null);
                          }}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="font-medium">{task.text}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select
                              value={task.goalId}
                              onValueChange={(newGoalId) => {
                                const newGoal = tracks.flatMap(t => t.goals).find(g => g.id === newGoalId);
                                const newTrack = tracks.find(t => t.goals.some(g => g.id === newGoalId));
                                setDumpSuggestions(prev => prev ? {
                                  ...prev,
                                  newTasks: prev.newTasks.map((t, i) => 
                                    i === idx ? { 
                                      ...t, 
                                      goalId: newGoalId, 
                                      goalName: newGoal?.name || t.goalName,
                                      trackId: newTrack?.id || t.trackId,
                                      trackName: newTrack?.name || t.trackName,
                                    } : t
                                  )
                                } : null);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-auto min-w-[200px]">
                                <SelectValue placeholder="Kies doel">{task.trackName} → {task.goalName}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {tracks.map(track => (
                                  track.goals.filter(g => !g.isCompleted).map(goal => (
                                    <SelectItem key={goal.id} value={goal.id}>
                                      {track.name} → {goal.name}
                                    </SelectItem>
                                  ))
                                ))}
                              </SelectContent>
                            </Select>
                            {task.priority && (
                              <Badge variant="outline">{task.priority}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Goals */}
              {dumpSuggestions?.newGoals && dumpSuggestions.newGoals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    Nieuwe Doelen ({dumpSuggestions.newGoals.length})
                  </h4>
                  <div className="space-y-2">
                    {dumpSuggestions.newGoals.map((goal, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-stone-50 rounded">
                        <Checkbox
                          checked={goal.selected}
                          onCheckedChange={(checked) => {
                            setDumpSuggestions(prev => prev ? {
                              ...prev,
                              newGoals: prev.newGoals.map((g, i) => 
                                i === idx ? { ...g, selected: !!checked } : g
                              )
                            } : null);
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{goal.name}</div>
                          <div className="text-xs text-stone-500">
                            {goal.trackName} • {goal.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Updates */}
              {dumpSuggestions?.contextUpdates && dumpSuggestions.contextUpdates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500" />
                    Context Updates ({dumpSuggestions.contextUpdates.length})
                  </h4>
                  <div className="space-y-2">
                    {dumpSuggestions.contextUpdates.map((ctx, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-stone-50 rounded">
                        <Checkbox
                          checked={ctx.selected}
                          onCheckedChange={(checked) => {
                            setDumpSuggestions(prev => prev ? {
                              ...prev,
                              contextUpdates: prev.contextUpdates.map((c, i) => 
                                i === idx ? { ...c, selected: !!checked } : c
                              )
                            } : null);
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{ctx.trackName}</div>
                          <div className="text-xs text-stone-600">{ctx.contextToAdd}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Updates */}
              {dumpSuggestions?.taskUpdates && dumpSuggestions.taskUpdates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Taak Updates ({dumpSuggestions.taskUpdates.length})
                  </h4>
                  <div className="space-y-2">
                    {dumpSuggestions.taskUpdates.map((update, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-stone-50 rounded">
                        <Checkbox
                          checked={update.selected}
                          onCheckedChange={(checked) => {
                            setDumpSuggestions(prev => prev ? {
                              ...prev,
                              taskUpdates: prev.taskUpdates.map((u, i) => 
                                i === idx ? { ...u, selected: !!checked } : u
                              )
                            } : null);
                          }}
                        />
                        <div className="flex-1">
                          <div className="text-sm">
                            {update.action === 'complete' && 'Markeer als voltooid'}
                            {update.action === 'updatePriority' && `Wijzig prioriteit naar ${update.newPriority}`}
                            {update.action === 'addToToday' && 'Voeg toe aan Today\'s Focus'}
                          </div>
                          <div className="text-xs text-stone-500">Task ID: {update.taskId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDumpResults(false)}>
              Annuleren
            </Button>
            <Button onClick={handleApplyDumpSuggestions}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Toepassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Tasks Results Dialog */}
      <Dialog open={showExtractResults} onOpenChange={setShowExtractResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Geëxtraheerde Taken</DialogTitle>
            <DialogDescription>
              Selecteer de taken die je wilt toevoegen
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2 pr-4">
              {extractSuggestions.map((task, idx) => {
                const taskTrack = tracks.find(t => t.id === task.trackId);
                return (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-stone-50 rounded">
                    <Checkbox
                      checked={task.selected}
                      onCheckedChange={(checked) => {
                        setExtractSuggestions(prev => prev.map((t, i) => 
                          i === idx ? { ...t, selected: !!checked } : t
                        ));
                      }}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{task.text}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={task.goalId}
                          onValueChange={(newGoalId) => {
                            const newGoal = tracks.flatMap(t => t.goals).find(g => g.id === newGoalId);
                            const newTrack = tracks.find(t => t.goals.some(g => g.id === newGoalId));
                            setExtractSuggestions(prev => prev.map((t, i) => 
                              i === idx ? { 
                                ...t, 
                                goalId: newGoalId, 
                                goalName: newGoal?.name || t.goalName,
                                trackId: newTrack?.id || t.trackId,
                                trackName: newTrack?.name || t.trackName,
                              } : t
                            ));
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-auto min-w-[200px]">
                            <SelectValue placeholder="Kies doel">{task.trackName} → {task.goalName}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {tracks.map(track => (
                              track.goals.filter(g => !g.isCompleted).map(goal => (
                                <SelectItem key={goal.id} value={goal.id}>
                                  {track.name} → {goal.name}
                                </SelectItem>
                              ))
                            ))}
                          </SelectContent>
                        </Select>
                        {task.priority && (
                          <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                            {task.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExtractSuggestions(prev => prev.map(t => ({ ...t, selected: true })));
              }}
            >
              Selecteer Alle
            </Button>
            <Button variant="outline" onClick={() => setShowExtractResults(false)}>
              Annuleren
            </Button>
            <Button onClick={handleApplyExtractedTasks}>
              <Plus className="w-4 h-4 mr-2" />
              Toevoegen ({extractSuggestions.filter(t => t.selected).length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Setup Dialog */}
      <Dialog open={showDailySetup} onOpenChange={setShowDailySetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Setup</DialogTitle>
            <DialogDescription>
              Stel je dagelijkse intentie en energieniveau in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Wat is je focus vandaag?</label>
              <Textarea
                value={dailyIntention}
                onChange={(e) => setDailyIntention(e.target.value)}
                placeholder="Bijv. 'Vandaag wil ik de presentatie afmaken en 2 klantgesprekken voeren'"
                className="min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Energieniveau</label>
              <Select value={energyLevel} onValueChange={(v) => setEnergyLevel(v as 'Low' | 'Normal' | 'High')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Laag (3-4 taken)</SelectItem>
                  <SelectItem value="Normal">Normaal (5-6 taken)</SelectItem>
                  <SelectItem value="High">Hoog (7-8 taken)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDailySetup(false)}>
              Overslaan
            </Button>
            <Button onClick={handleStartDaily}>
              <Zap className="w-4 h-4 mr-2" />
              Start Dag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Track Dialog */}
      <Dialog open={showNewTrackDialog} onOpenChange={setShowNewTrackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Naam</label>
              <Input
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                placeholder="Bijv. Freelance Consultant, Gezin, Muziek..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Kleur</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(trackColors).map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTrackColor(color)}
                    className={`w-8 h-8 rounded-full ${trackColors[color]} ${
                      newTrackColor === color ? 'ring-2 ring-offset-2 ring-stone-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTrackDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreateTrack} disabled={!newTrackName.trim()}>
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Settings Dialog */}
      <Dialog open={showAISettings} onOpenChange={setShowAISettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Instellingen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              FocusFlow gebruikt AI om je te helpen met:
            </p>
            <ul className="text-sm space-y-2 text-stone-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Taken extraheren uit notities
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Gedachten-dumps analyseren
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Today's Focus suggereren
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Spraak naar tekst transcriberen
              </li>
            </ul>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-700">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">AI features worden gemigreerd naar REST API</span>
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                Basis CRUD werkt via REST API. AI features worden in een volgende update toegevoegd.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAISettings(false)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Track Card Component
interface TrackCardProps {
  track: Track;
  collapsedGoals: Set<string>;
  toggleGoalCollapse: (goalId: string) => void;
  newGoalText: string;
  setNewGoalText: (text: string) => void;
  newTaskText: string;
  setNewTaskText: (text: string) => void;
  onAddGoal: (trackId: string) => void;
  onDeleteGoal: (goalId: string, trackId: string) => void;
  onAddTask: (goalId: string, trackId: string) => void;
  onToggleTask: (taskId: string, goalId: string, trackId: string) => void;
  onToggleToday: (taskId: string, goalId: string, trackId: string) => void;
  onSetPriority: (taskId: string, goalId: string, trackId: string, priority: 'low' | 'medium' | 'high' | null) => void;
  onDeleteTask: (taskId: string, goalId: string, trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onExtractTasks: (trackId: string, notes: string) => void;
}

function TrackCard({
  track,
  collapsedGoals,
  toggleGoalCollapse,
  newGoalText,
  setNewGoalText,
  newTaskText,
  setNewTaskText,
  onAddGoal,
  onDeleteGoal,
  onAddTask,
  onToggleTask,
  onToggleToday,
  onSetPriority,
  onDeleteTask,
  onDeleteTrack,
  onExtractTasks,
}: TrackCardProps) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [notes, setNotes] = useState(track.notes || '');
  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isEditingContext, setIsEditingContext] = useState(false);
  const [editedContext, setEditedContext] = useState(track.context || '');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const notesMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const notesAudioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // ==================== MIGRATED: Document handling (localStorage-based) ====================
  const [documents, setDocuments] = useState<Array<{ id: string; fileName: string; fileUrl: string; fileType: string }>>([]);

  // Load documents from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`focusflow_docs_${track.id}`);
    if (stored) {
      try { setDocuments(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [track.id]);

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Alleen PDF, Word, PowerPoint en Excel bestanden zijn toegestaan');
      return;
    }

    setIsUploadingDoc(true);
    try {
      // Store document reference in localStorage (file upload to S3 disabled during migration)
      const newDoc = {
        id: `doc-${Date.now()}`,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        fileType: file.type,
      };
      const updatedDocs = [...documents, newDoc];
      setDocuments(updatedDocs);
      localStorage.setItem(`focusflow_docs_${track.id}`, JSON.stringify(updatedDocs));
      toast.success('Document opgeslagen (lokaal)');
    } catch (error) {
      console.error('Document upload failed:', error);
      toast.error('Document uploaden mislukt');
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ==================== MIGRATED: AI Chat (temporarily disabled) ====================
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const question = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: question }]);
    setIsChatLoading(true);
    
    try {
      // AI chat temporarily disabled during REST API migration
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'AI Sparring is tijdelijk uitgeschakeld tijdens de REST API migratie. Deze functie wordt binnenkort weer beschikbaar.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ==================== MIGRATED: Context save (localStorage) ====================
  const handleSaveContext = async () => {
    try {
      // Save context to localStorage metadata
      const metadataKey = `focusflow_track_${track.id}`;
      const stored = localStorage.getItem(metadataKey);
      const metadata = stored ? JSON.parse(stored) : {};
      metadata.context = editedContext || null;
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      // Also update the track object in parent state
      track.context = editedContext || null;
      setIsEditingContext(false);
      toast.success('Context opgeslagen');
    } catch (error) {
      console.error('Failed to save context:', error);
      toast.error('Opslaan mislukt');
    }
  };

  // Handle delete document
  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!confirm(`Weet je zeker dat je "${fileName}" wilt verwijderen?`)) return;
    
    try {
      const updatedDocs = documents.filter(d => d.id !== docId);
      setDocuments(updatedDocs);
      localStorage.setItem(`focusflow_docs_${track.id}`, JSON.stringify(updatedDocs));
      toast.success('Document verwijderd');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Verwijderen mislukt');
    }
  };

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ==================== MIGRATED: Notes recording (temporarily simplified) ====================
  const startNotesRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      notesMediaRecorderRef.current = mediaRecorder;
      notesAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          notesAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(notesAudioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        // AI transcription disabled during migration
        toast.info('Spraakherkenning is tijdelijk uitgeschakeld tijdens migratie');
      };

      mediaRecorder.start();
      setIsRecordingNotes(true);
      toast.info('Opname gestart...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Kon microfoon niet starten.');
    }
  };

  const stopNotesRecording = () => {
    if (notesMediaRecorderRef.current && isRecordingNotes) {
      notesMediaRecorderRef.current.stop();
      setIsRecordingNotes(false);
      toast.info('Opname gestopt');
    }
  };

  // ==================== MIGRATED: Save notes (localStorage) ====================
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      // Save notes to localStorage metadata
      const metadataKey = `focusflow_track_${track.id}`;
      const stored = localStorage.getItem(metadataKey);
      const metadata = stored ? JSON.parse(stored) : {};
      metadata.notes = notes || null;
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      // Update track object
      track.notes = notes || null;
      toast.success('Notities opgeslagen');
    } catch (error) {
      console.error('Failed to save notes:', error);
      toast.error('Opslaan mislukt');
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <Card className={`border-l-4 ${trackColorsBorder[track.color] || 'border-teal-500'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${trackColors[track.color] || 'bg-teal-500'}`} />
            {track.name}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} title="AI Sparring" className={showChat ? 'bg-purple-100' : ''}>
              <MessageSquare className="w-4 h-4 text-purple-600" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowContext(!showContext)} title="Context bekijken">
              <BookOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNotes(!showNotes)} title="Notities">
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDeleteTrack(track.id)} title="Verwijderen">
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Chat Section */}
        {showChat && (
          <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-700 font-medium">
                <MessageSquare className="w-4 h-4" />
                AI Sparring
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setChatHistory([])}
                className="text-xs text-purple-600"
              >
                Nieuw gesprek
              </Button>
            </div>
            
            {/* Chat Messages */}
            <div className="bg-white rounded border max-h-64 overflow-y-auto p-3 space-y-3">
              {chatHistory.length === 0 ? (
                <p className="text-sm text-stone-500 italic text-center">
                  Stel een vraag over deze track, de context of documenten...
                </p>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-2 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-purple-100 text-purple-900' : 'bg-stone-100 text-stone-800'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="text-sm">
                  <div className="inline-block p-2 rounded-lg bg-stone-100">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Stel een vraag..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                disabled={isChatLoading}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatLoading}
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Context Section */}
        {showContext && (
          <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <BookOpen className="w-4 h-4" />
                Context
              </div>
              <div className="flex gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDocumentUpload}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingDoc}
                  className="text-xs"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {isUploadingDoc ? 'Uploaden...' : 'Document'}
                </Button>
                {!isEditingContext && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditedContext(track.context || '');
                      setIsEditingContext(true);
                    }}
                    className="text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Bewerken
                  </Button>
                )}
              </div>
            </div>
            
            {/* Documents List */}
            {documents.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-blue-600">Documenten:</div>
                <div className="space-y-1">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                          {doc.fileName}
                        </a>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Context Content */}
            {isEditingContext ? (
              <div className="space-y-2">
                <Textarea
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  placeholder="Context voor deze track..."
                  className="min-h-[150px] bg-white text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingContext(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditedContext('');
                    }}
                    className="text-red-600"
                  >
                    Wissen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveContext}
                  >
                    Opslaan
                  </Button>
                </div>
              </div>
            ) : track.context ? (
              <div className="text-sm text-stone-700 whitespace-pre-wrap bg-white p-3 rounded border max-h-64 overflow-y-auto">
                {track.context}
              </div>
            ) : (
              <p className="text-sm text-stone-500 italic">
                Nog geen context. Context wordt automatisch toegevoegd uit notities, voltooide taken/doelen, documenten en Gedachten Dump.
              </p>
            )}
          </div>
        )}

        {/* Notes Section */}
        {showNotes && (
          <div className="space-y-2 p-3 bg-stone-50 rounded-lg">
            <div className="relative">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notities voor deze track... Typ hier je gedachten en laat de AI taken extraheren."
                className="min-h-[100px] bg-white pr-12"
              />
              <Button
                variant="ghost"
                size="sm"
                className={`absolute bottom-2 right-2 ${isRecordingNotes ? 'text-red-500' : ''}`}
                onClick={isRecordingNotes ? stopNotesRecording : startNotesRecording}
                title={isRecordingNotes ? 'Stop opname' : 'Start spraakopname'}
              >
                {isRecordingNotes ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
            {isRecordingNotes && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Opname bezig... Klik op de microfoon om te stoppen.
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveNotes} disabled={isSavingNotes}>
                {isSavingNotes ? 'Opslaan...' : 'Opslaan'}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onExtractTasks(track.id, notes)}
                disabled={!notes.trim()}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Extraheer taken
              </Button>
            </div>
          </div>
        )}

        {/* Goals - sorted by priority within each goal's tasks */}
        <div className="space-y-3">
          {track.goals.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-4">
              Nog geen doelen. Voeg je eerste doel toe hieronder.
            </p>
          ) : (
            track.goals.map(goal => (
              <div key={goal.id} className="border rounded-lg overflow-hidden bg-white">
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${trackColorsLight[track.color] || 'bg-teal-50 hover:bg-teal-100'}`}
                  onClick={() => toggleGoalCollapse(goal.id)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`w-4 h-4 ${trackColorsIcon[track.color] || 'text-teal-500'} transition-transform ${
                      collapsedGoals.has(goal.id) ? '-rotate-90' : ''
                    }`} />
                    <Target className={`w-4 h-4 ${trackColorsIcon[track.color] || 'text-teal-500'}`} />
                    <span className="font-medium">{goal.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {goal.tasks.filter(t => t.isCompleted).length}/{goal.tasks.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGoal(goal.id, track.id);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {!collapsedGoals.has(goal.id) && (
                  <div className="p-3 space-y-2">
                    {/* Tasks - sorted by priority */}
                    {goal.tasks.length === 0 ? (
                      <p className="text-stone-400 text-sm text-center py-2">Geen taken</p>
                    ) : (
                      sortByPriority(goal.tasks).map(task => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2 p-2 rounded border ${
                            task.isCompleted ? 'bg-stone-50 opacity-60' : 'bg-white'
                          } ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}
                        >
                          <Checkbox
                            checked={task.isCompleted}
                            onCheckedChange={() => onToggleTask(task.id, goal.id, track.id)}
                          />
                          <span className={`flex-1 ${task.isCompleted ? 'line-through text-stone-400' : ''}`}>
                            {task.text}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleToday(task.id, goal.id, track.id)}
                            className={task.isToday ? 'text-orange-500' : 'text-stone-400'}
                            title={task.isToday ? 'Verwijder uit Today\'s Focus' : 'Voeg toe aan Today\'s Focus'}
                          >
                            <Star className={`w-4 h-4 ${task.isToday ? 'fill-orange-500' : ''}`} />
                          </Button>
                          <Select
                            value={task.priority || 'none'}
                            onValueChange={(v) => onSetPriority(
                              task.id,
                              goal.id,
                              track.id,
                              v === 'none' ? null : v as 'low' | 'medium' | 'high'
                            )}
                          >
                            <SelectTrigger className="w-24 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              <SelectItem value="high">Hoog</SelectItem>
                              <SelectItem value="medium">Midden</SelectItem>
                              <SelectItem value="low">Laag</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteTask(task.id, goal.id, track.id)}
                            className="text-stone-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                    
                    {/* Add Task */}
                    {activeGoalId === goal.id ? (
                      <div className="flex gap-2 pt-2">
                        <Input
                          value={newTaskText}
                          onChange={(e) => setNewTaskText(e.target.value)}
                          placeholder="Nieuwe taak..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTaskText.trim()) {
                              onAddTask(goal.id, track.id);
                              setActiveGoalId(null);
                            }
                            if (e.key === 'Escape') {
                              setActiveGoalId(null);
                              setNewTaskText('');
                            }
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => {
                          if (newTaskText.trim()) {
                            onAddTask(goal.id, track.id);
                            setActiveGoalId(null);
                          }
                        }}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setActiveGoalId(null);
                          setNewTaskText('');
                        }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-stone-500 hover:text-stone-700"
                        onClick={() => setActiveGoalId(goal.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Taak toevoegen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Goal */}
        <div className="flex gap-2 pt-2">
          <Input
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            placeholder="Nieuw doel toevoegen..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGoalText.trim()) {
                onAddGoal(track.id);
              }
            }}
          />
          <Button onClick={() => onAddGoal(track.id)} disabled={!newGoalText.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
