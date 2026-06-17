"use client";

import React, { useState, useMemo } from 'react';
import { 
  Home, 
  Inbox as InboxIcon, 
  CheckSquare, 
  Folder, 
  FileText, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  Check, 
  X, 
  ArrowRight, 
  AlertCircle, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown,
  Layout, 
  Cloud, 
  ArrowUpRight,
  Sparkles,
  Filter,
  CalendarClock,
  Clock,
  Circle,
  HelpCircle
} from 'lucide-react';

const INITIAL_TASKS = [
  {
    id: 'task-1',
    title: 'Review PlanGlade homepage layout',
    project: 'PlanGlade Public MVP',
    priority: 'High',
    status: 'In progress',
    due: 'Today',
    dueRaw: '2026-06-17',
    desc: 'Review the new Home UI direction and make sure it stays simple, calm, and product-first.',
    subtasks: [
      { id: 'sub-1', title: 'Check spacing', completed: true },
      { id: 'sub-2', title: 'Check sidebar clarity', completed: false },
      { id: 'sub-3', title: 'Check mobile-safe layout', completed: false }
    ],
    linkedNote: 'Landing page positioning ideas'
  },
  {
    id: 'task-2',
    title: 'Convert inbox notes into tasks',
    project: 'PlanGlade Public MVP',
    priority: 'Medium',
    status: 'Todo',
    due: 'Today',
    dueRaw: '2026-06-17',
    desc: 'Go through captured manual notes and synthesize them into actionable sprint deliverables.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-3',
    title: 'Draft Nakhla pricing section',
    project: 'Nakhla Digital Website',
    priority: 'Medium',
    status: 'Todo',
    due: 'Today',
    dueRaw: '2026-06-17',
    desc: 'Outline multi-tier engagement models for Nakhla localization and website launch clients.',
    subtasks: [],
    linkedNote: 'Nakhla client offer structure'
  },
  {
    id: 'task-4',
    title: 'Check backup status on home server',
    project: 'Home Server Cleanup',
    priority: 'Low',
    status: 'Todo',
    due: 'Today',
    dueRaw: '2026-06-17',
    desc: 'Verify backup sync cronjobs are reporting healthy exits and secondary mirror is operational.',
    subtasks: [],
    linkedNote: 'Home server service map'
  },
  {
    id: 'task-5',
    title: 'Finalize self-hosting README',
    project: 'PlanGlade Public MVP',
    priority: 'High',
    status: 'Todo',
    due: 'Jun 14',
    dueRaw: '2026-06-14',
    desc: 'Ensure Docker compose guides, volume configurations, and environment variable descriptions are bulletproof.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-6',
    title: 'Polish task drawer interactions',
    project: 'PlanGlade Public MVP',
    priority: 'High',
    status: 'Blocked',
    due: 'Jun 18',
    dueRaw: '2026-06-18',
    desc: 'Fix CSS transitions and micro-interactions on panel dismiss gestures.',
    subtasks: [],
    linkedNote: 'UI feedback notes'
  },
  {
    id: 'task-7',
    title: 'Clean old landing copy',
    project: 'PlanGlade Public MVP',
    priority: 'Medium',
    status: 'Todo',
    due: 'Jun 13',
    dueRaw: '2026-06-13',
    desc: 'Get rid of marketing jargon and fake enterprise buzzwords. Re-write for core visual minimalism.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-8',
    title: 'Review UI implementation',
    project: 'PlanGlade Public MVP',
    priority: 'High',
    status: 'Todo',
    due: 'Jun 17',
    dueRaw: '2026-06-17',
    desc: 'Sanity check the rendered elements against pure design tokens.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-9',
    title: 'Write public README',
    project: 'PlanGlade Public MVP',
    priority: 'Medium',
    status: 'Todo',
    due: 'Jun 18',
    dueRaw: '2026-06-18',
    desc: 'Prepare markdown detailing PlanGlades core mission and self-hosting capabilities.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-10',
    title: 'Prepare demo screenshots',
    project: 'PlanGlade Public MVP',
    priority: 'Low',
    status: 'Todo',
    due: 'Jun 20',
    dueRaw: '2026-06-20',
    desc: 'Take clean, high-resolution screens showcasing light mode surfaces and the capture stream.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-11',
    title: 'Public MVP checkpoint',
    project: 'PlanGlade Public MVP',
    priority: 'High',
    status: 'Todo',
    due: 'Jun 30',
    dueRaw: '2026-06-30',
    desc: 'First public release milestone checklist validation.',
    subtasks: [],
    linkedNote: ''
  },
  {
    id: 'task-12',
    title: 'Document current Docker services',
    project: 'Home Server Cleanup',
    priority: 'Medium',
    status: 'Todo',
    due: 'No date',
    dueRaw: '',
    desc: 'Log and catalog running containers, active ports, and automated state backups.',
    subtasks: [],
    linkedNote: 'Home server service map'
  }
];

const INITIAL_INBOX = [
  {
    id: 'inbox-1',
    title: 'Add empty states for new users',
    source: 'Manual capture',
    created: '10 min ago'
  },
  {
    id: 'inbox-2',
    title: 'Maybe add note-to-task extraction shortcut',
    source: 'Note',
    created: '42 min ago'
  },
  {
    id: 'inbox-3',
    title: 'Calendar should show no-date tasks on the side',
    source: 'Manual',
    created: 'Yesterday'
  },
  {
    id: 'inbox-4',
    title: 'Research simple public roadmap styles',
    source: 'Manual',
    created: 'Yesterday'
  },
  {
    id: 'inbox-5',
    title: 'Check if Docker compose needs healthcheck',
    source: 'Manual',
    created: '2 days ago'
  }
];

const INITIAL_NOTES = [
  {
    id: 'note-1',
    title: 'Landing page positioning ideas',
    project: 'PlanGlade Public MVP',
    updated: '18 min ago',
    content: `Keep the message product-first: capture fast, organize later, and keep work visible across tasks, projects, notes, and calendar.

Avoid SaaS bloat language. No "unleash productivity." The tone is calm, honest, and a little plain.

Hero candidates:
- Capture first, organize later.
- One calm place for tasks, projects, notes, and your calendar.
- Solo-first. Open-source. Self-hostable.

Checklist:
[ ] Turn hero copy into final version
[ ] Add honest roadmap section
[ ] Check screenshot consistency`
  },
  {
    id: 'note-2',
    title: 'Nakhla client offer structure',
    project: 'Nakhla Digital Website',
    updated: 'Yesterday',
    content: `Build out client pricing with predictable metrics:
- Base development sprint (2 weeks)
- Localization and right-to-left layout alignment support
- Self-host handoff training & continuous deployment hooks`
  },
  {
    id: 'note-3',
    title: 'Home server service map',
    project: 'Home Server Cleanup',
    updated: 'Jun 15',
    content: `Local services currently deployed:
- DNS-based blocker
- File synchronization node
- Media indexing pipeline
- Nightly snapshot backup script`
  },
  {
    id: 'note-4',
    title: 'Arabic lesson 12 vocabulary',
    project: 'Arabic Study Notes',
    updated: 'Jun 13',
    content: `Core verbal stems and noun phrases used in daily transactions and active projects. Need to integrate interactive cards later.`
  }
];

const PROJECTS = [
  {
    id: 'p-1',
    name: 'PlanGlade Public MVP',
    status: 'Active',
    progress: 62,
    openTasks: 14,
    blocked: 1,
    overdue: 2,
    notes: 6,
    docs: 3,
    due: 'Jun 30',
    nextTask: 'Polish task drawer interactions',
    desc: 'Prepare the first honest public version of PlanGlade with capture, tasks, projects, notes/docs, calendar, self-hosting, and clear public positioning.'
  },
  {
    id: 'p-2',
    name: 'Nakhla Digital Website',
    status: 'Active',
    progress: 38,
    openTasks: 7,
    blocked: 0,
    overdue: 0,
    notes: 2,
    docs: 1,
    due: 'Jul 08',
    nextTask: 'Write homepage service copy',
    desc: 'Design and deploy the modern localized digital presence for Nakhla Creative Agency.'
  },
  {
    id: 'p-3',
    name: 'Arabic Study Notes',
    status: 'Active',
    progress: 18,
    openTasks: 3,
    blocked: 0,
    overdue: 0,
    notes: 4,
    docs: 0,
    due: 'Jul 20',
    nextTask: 'Review lesson 12 vocabulary',
    desc: 'Systematic grammar, reading comprehension, and localized script drills.'
  },
  {
    id: 'p-4',
    name: 'Home Server Cleanup',
    status: 'Paused',
    progress: 24,
    openTasks: 5,
    blocked: 0,
    overdue: 0,
    notes: 1,
    docs: 0,
    due: 'No date',
    nextTask: 'Document current Docker services',
    desc: 'Refactor host operating systems, clean redundant image packages, and automate backup cycles.'
  }
];

const PROJECT_DOCS = [
  { id: 'doc-1', projectId: 'p-1', title: 'Self-hosting guide draft', category: 'Self-hosting' },
  { id: 'doc-2', projectId: 'p-1', title: 'Project scope rules', category: 'Product Strategy' },
  { id: 'doc-3', projectId: 'p-1', title: 'Public MVP checklist', category: 'Milestone' }
];

export default function App() {
  const [activePage, setActivePage] = useState('Home'); // Home, Inbox, Tasks, Projects, ProjectDetail, Notes, Calendar, Settings
  const [selectedProjectId, setSelectedProjectId] = useState('p-1'); // Default to PlanGlade MVP
  
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [inboxItems, setInboxItems] = useState(INITIAL_INBOX);
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [selectedNoteId, setSelectedNoteId] = useState('note-1');
  const [captureText, setCaptureText] = useState('');
  
  const [taskView, setTaskView] = useState('list'); // 'list' | 'board'
  const [selectedTaskId, setSelectedTaskId] = useState('task-1'); 
  const [taskFilter, setTaskFilter] = useState('All'); 
  const [calendarSelectedDay, setCalendarSelectedDay] = useState(17); 
  
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const handleQuickCapture = (e) => {
    e.preventDefault();
    if (!captureText.trim()) return;

    const newInboxItem = {
      id: `inbox-${Date.now()}`,
      title: captureText,
      source: 'Manual capture',
      created: 'Just now'
    };

    setInboxItems([newInboxItem, ...inboxItems]);
    addToast(`"${captureText.substring(0, 24)}..." added to Inbox.`);
    setCaptureText('');
    
    if (activePage !== 'Inbox' && activePage !== 'Home') {
      setActivePage('Inbox');
    }
  };

  const convertInboxToTask = (id) => {
    const item = inboxItems.find(i => i.id === id);
    if (!item) return;

    const newTask = {
      id: `task-${Date.now()}`,
      title: item.title,
      project: 'PlanGlade Public MVP', 
      priority: 'Medium',
      status: 'Todo',
      due: 'Today',
      dueRaw: '2026-06-17',
      desc: 'Quickly converted from inbox capture. Update context here.',
      subtasks: [],
      linkedNote: ''
    };

    setTasks([newTask, ...tasks]);
    setInboxItems(inboxItems.filter(i => i.id !== id));
    setSelectedTaskId(newTask.id);
    addToast(`Moved to active tasks!`);
  };

  const dismissInboxItem = (id) => {
    setInboxItems(inboxItems.filter(i => i.id !== id));
    addToast('Item removed.');
  };

  const handleToggleTaskStatus = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'Completed' ? 'Todo' : 'Completed';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
    addToast('Task state updated.');
  };

  const handleExtractChecklist = (noteId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const lines = note.content.split('\n');
    const checklistItems = lines.filter(line => line.trim().startsWith('[ ]'));
    
    if (checklistItems.length === 0) {
      addToast('No items matched "[ ]" formatting.');
      return;
    }

    const newInboxItems = checklistItems.map((item, idx) => ({
      id: `inbox-extract-${Date.now()}-${idx}`,
      title: item.replace('[ ]', '').trim(),
      source: 'Note extraction',
      created: 'Just now'
    }));

    setInboxItems([...newInboxItems, ...inboxItems]);
    addToast(`Extracted ${checklistItems.length} checklist points to Inbox!`);
  };

  const handleNoteContentChange = (id, newContent) => {
    setNotes(prev => prev.map(n => {
      if (n.id === id) {
        return { ...n, content: newContent, updated: 'Just now' };
      }
      return n;
    }));
  };

  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || tasks[0];
  }, [tasks, selectedTaskId]);

  const activeProject = useMemo(() => {
    return PROJECTS.find(p => p.id === selectedProjectId) || PROJECTS[0];
  }, [selectedProjectId]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-100 antialiased flex flex-col md:flex-row relative">
      
      {/* Toast Notification Pipeline */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className="bg-white text-zinc-900 text-xs px-3.5 py-3 rounded-lg shadow-md border border-zinc-200/80 flex items-center justify-between gap-3 animate-slide-up pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-900"></span>
              <span>{toast.message}</span>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-950 rounded transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar - Shadcn UI styling style (sharp dark lines, muted grey lists, flat layout labels) */}
      <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-zinc-200/80 flex flex-col shrink-0">
        
        {/* Workspace Brand Block */}
        <div className="p-5 flex items-center justify-between border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-5.5 h-5.5 rounded bg-zinc-900 flex items-center justify-center text-white text-[10px] font-bold tracking-tight">
              PG
            </div>
            <div>
              <h1 className="font-semibold text-xs tracking-tight text-zinc-900">PlanGlade</h1>
              <p className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">Workspace</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-600">
            <span className="w-1 h-1 rounded-full bg-zinc-950"></span>
            Khalil
          </div>
        </div>

        {/* Workspace Info Area */}
        <div className="px-5 py-2.5 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Active Workspace</span>
            <span className="text-xs font-medium text-zinc-700 truncate">Khalil Workspace</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200/60 shadow-sm">Free</span>
        </div>

        {/* Navigation Categories - Highly Structured for Easy Visual Navigation */}
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          
          {/* Primary View Segment */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Primary Views</span>
            
            <button 
              onClick={() => setActivePage('Home')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Home' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">⌘1</span>
            </button>

            <button 
              onClick={() => setActivePage('Inbox')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Inbox' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <InboxIcon className="w-3.5 h-3.5" />
                <span>Inbox</span>
              </div>
              {inboxItems.length > 0 && (
                <span className="bg-zinc-900 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {inboxItems.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActivePage('Tasks')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Tasks' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Tasks</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">⌘3</span>
            </button>
          </div>

          {/* Directory Collections Section */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Collections</span>
            
            <button 
              onClick={() => setActivePage('Projects')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Projects' || activePage === 'ProjectDetail' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5" />
                <span>Projects</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">{PROJECTS.length}</span>
            </button>

            <button 
              onClick={() => setActivePage('Notes')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Notes' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </div>
            </button>

            <button 
              onClick={() => setActivePage('Calendar')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Calendar' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </div>
            </button>
          </div>

          {/* Preferences Category */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Preferences</span>
            
            <button 
              onClick={() => setActivePage('Settings')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all text-left ${activePage === 'Settings' ? 'bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-2.5' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Settings</span>
              </div>
            </button>
          </div>

        </div>

        {/* Sidebar Footer area */}
        <div className="p-4 border-t border-zinc-100 hidden md:block text-[10px] text-zinc-400">
          <p className="font-light italic text-center text-zinc-500">"A calm clearing for work"</p>
          <div className="mt-2.5 text-[8.5px] font-semibold text-zinc-400 tracking-wider flex items-center justify-center gap-1.5">
            <Cloud className="w-3 h-3 text-zinc-400" /> PLANGLADE DESKTOP v1.2
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
        
        {/* Dynamic Navigation Trail Header + Command Bar (Shadcn styled with keyboard actions hints) */}
        <header className="border-b border-zinc-200/80 bg-white px-6 md:px-8 py-3.5 sticky top-0 z-30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Breadcrumbs Navigation Route Tracking */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <span className="text-zinc-400">Khalil Workspace</span>
            <ChevronRight className="w-3 h-3 text-zinc-300" />
            {activePage === 'ProjectDetail' ? (
              <>
                <span className="cursor-pointer hover:text-zinc-900" onClick={() => setActivePage('Projects')}>Projects</span>
                <ChevronRight className="w-3 h-3 text-zinc-300" />
                <span className="text-zinc-900 font-semibold">{activeProject.name}</span>
              </>
            ) : (
              <span className="text-zinc-900 font-semibold">{activePage}</span>
            )}
          </div>

          {/* Quick Command Launcher Box */}
          <form onSubmit={handleQuickCapture} className="flex items-center gap-3 bg-zinc-50 hover:bg-zinc-100/50 focus-within:bg-white focus-within:ring-1 focus-within:ring-zinc-950 transition border border-zinc-200/80 rounded-lg px-3.5 py-1.5 max-w-sm w-full">
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
            <input 
              type="text"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder="Capture a task, note, or idea... (⌘K)"
              className="bg-transparent text-xs placeholder:text-zinc-400 focus:outline-none text-zinc-800 w-full"
            />
            {captureText.trim() ? (
              <button 
                type="submit"
                className="text-[10px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors px-2 py-1 rounded"
              >
                Capture
              </button>
            ) : (
              <span className="text-[9px] text-zinc-400 font-mono select-none px-1 py-0.5 border border-zinc-200 bg-white rounded shadow-xs hidden sm:inline-block">⏎</span>
            )}
          </form>
        </header>

        {/* Scrollable Page Canvas wrapper */}
        <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto max-w-5xl mx-auto w-full space-y-10">
          
          {/* ==================== PAGE 1: HOME ==================== */}
          {activePage === 'Home' && (
            <div className="space-y-10 animate-fade-in">
              
              {/* Heading Layout */}
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Overview Dashboard</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Good afternoon, Khalil</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Here’s the calm path through today’s work.</p>
              </div>

              {/* Minimal Clean Grid Row Layout (No big heavy dashboard cards) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-2">
                
                {/* Left Section: Active task priorities (Today & Overdue lists) */}
                <div className="lg:col-span-8 space-y-10">
                  
                  {/* Today Focus Rows */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Today's Focus</h3>
                      <span className="text-[10.5px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-mono">
                        {tasks.filter(t => t.due === 'Today' && t.status !== 'Completed').length} active
                      </span>
                    </div>

                    <div className="divide-y divide-zinc-100">
                      {tasks.filter(t => t.due === 'Today').map((task) => (
                        <div key={task.id} className="group flex items-center justify-between py-3 hover:bg-white/60 px-2 rounded-md transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <button 
                              onClick={() => handleToggleTaskStatus(task.id)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${task.status === 'Completed' ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 hover:border-zinc-500 bg-white'}`}
                            >
                              {task.status === 'Completed' && <Check className="w-2.5 h-2.5" />}
                            </button>
                            <span 
                              onClick={() => { setSelectedTaskId(task.id); setActivePage('Tasks'); }}
                              className={`text-xs tracking-tight truncate cursor-pointer hover:text-zinc-950 transition-colors ${task.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-800 font-medium'}`}
                            >
                              {task.title}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[9.5px] text-zinc-400 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/40">{task.project}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${task.priority === 'High' ? 'text-zinc-950 bg-red-50 text-red-700 border border-red-100 px-1 rounded' : 'text-zinc-400'}`}>{task.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overdue Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Attention Required (Overdue)
                      </h3>
                      <span className="text-[10px] text-red-500 font-mono">2 issues pending</span>
                    </div>

                    <div className="divide-y divide-zinc-100 bg-red-50/10 rounded-md">
                      {tasks.filter(t => t.dueRaw && new Date(t.dueRaw) < new Date('2026-06-17') && t.status !== 'Completed').map((task) => (
                        <div key={task.id} className="flex items-center justify-between py-3 px-2 hover:bg-red-50/20 transition-all rounded-md">
                          <div className="flex items-center gap-3 min-w-0">
                            <button 
                              onClick={() => handleToggleTaskStatus(task.id)}
                              className="w-4 h-4 rounded-full border border-red-300 bg-white hover:border-red-500 transition-colors flex items-center justify-center shadow-sm"
                            >
                              <Check className="w-2.5 h-2.5 text-white" />
                            </button>
                            <span 
                              onClick={() => { setSelectedTaskId(task.id); setActivePage('Tasks'); }}
                              className="text-xs text-zinc-800 tracking-tight truncate cursor-pointer font-medium hover:underline"
                            >
                              {task.title}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] text-zinc-400 uppercase font-mono">{task.project}</span>
                            <span className="text-[10.5px] font-mono font-bold text-red-600 bg-red-100/55 px-1.5 py-0.5 rounded">{task.due}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recently Captured Stream */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Unprocessed Capture Log</h3>
                      <button onClick={() => setActivePage('Inbox')} className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-950 flex items-center gap-1 transition-all">
                        Open Inbox triage <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1 bg-zinc-50/50 p-2 rounded-lg border border-zinc-200/50">
                      {inboxItems.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded transition-colors">
                          <div className="flex items-center gap-2">
                            <Circle className="w-2 h-2 text-zinc-400 fill-zinc-300" />
                            <span className="text-xs text-zinc-600 truncate max-w-sm">{item.title}</span>
                          </div>
                          <button 
                            onClick={() => convertInboxToTask(item.id)}
                            className="text-[10.5px] font-semibold text-zinc-800 hover:text-zinc-950 transition-colors flex items-center gap-1"
                          >
                            Convert to task <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right Section: Core Project Milestones and Timeline overview */}
                <div className="lg:col-span-4 space-y-10">
                  
                  {/* Progress panel */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Active Trackers</h3>
                    <div className="space-y-4">
                      {PROJECTS.map((proj) => (
                        <div 
                          key={proj.id} 
                          className="cursor-pointer group hover:bg-zinc-50/80 p-2 rounded transition-colors"
                          onClick={() => { setSelectedProjectId(proj.id); setActivePage('ProjectDetail'); }}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-zinc-700 font-medium group-hover:text-zinc-950 group-hover:underline transition-all">{proj.name}</span>
                            <span className="text-zinc-500 font-mono text-[10.5px]">{proj.progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-200/70 h-1 rounded-full overflow-hidden">
                            <div className="bg-zinc-900 h-full transition-all duration-500" style={{ width: `${proj.progress}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calendar deadlines mapping */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Timeline Milestones</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start gap-3">
                        <span className="text-zinc-400 font-mono w-16 shrink-0">Today</span>
                        <span className="text-zinc-700 font-semibold">4 focused tasks queued</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-zinc-400 font-mono w-16 shrink-0">Jun 17</span>
                        <span className="text-zinc-600">Review UI implementation draft</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-zinc-400 font-mono w-16 shrink-0">Jun 18</span>
                        <span className="text-zinc-600 font-light">Draft public MVP README.md</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-zinc-400 font-mono w-16 shrink-0">Jun 30</span>
                        <span className="text-zinc-950 font-semibold">Public MVP launch checkpoint</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ==================== PAGE 2: INBOX ==================== */}
          {activePage === 'Inbox' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Fast Triage</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Inbox Buffer</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Capture first. Organize second.</p>
              </div>

              {/* Triage Container with Clean border indicators */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-200/80 font-medium">
                  <span>Queued ideas ({inboxItems.length})</span>
                  <span>Review triage actions</span>
                </div>

                {inboxItems.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-lg border border-zinc-200/60 p-6">
                    <p className="text-zinc-400 text-xs font-light">No items left to triage. Capture a quick idea above anytime.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200/60 border border-zinc-200/80 rounded-lg overflow-hidden bg-white">
                    {inboxItems.map((item) => (
                      <div key={item.id} className="group flex flex-col md:flex-row md:items-center justify-between py-3.5 px-4 hover:bg-zinc-50 transition-colors gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-2"></span>
                          <div>
                            <p className="text-xs text-zinc-800 tracking-tight font-semibold leading-snug">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-1.5 rounded">Via {item.source}</span>
                              <span className="text-[10px] text-zinc-300">•</span>
                              <span className="text-[10px] text-zinc-400">{item.created}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions aligned side-by-side */}
                        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                          <button 
                            onClick={() => convertInboxToTask(item.id)}
                            className="text-[10.5px] bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors py-1 px-2.5 rounded-md"
                          >
                            Convert to task
                          </button>
                          <button 
                            onClick={() => dismissInboxItem(item.id)}
                            className="text-[10.5px] text-zinc-400 hover:text-zinc-950 transition-colors px-1 py-1"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Triage Summary footer bar (shadcn widget block) */}
              <div className="p-4 bg-zinc-50/80 rounded-lg border border-zinc-200/60 flex flex-wrap items-center justify-between text-xs text-zinc-500 gap-4">
                <div className="flex items-center gap-4">
                  <span>Queued: <strong className="text-zinc-950">{inboxItems.length}</strong></span>
                  <span>From Capture: <strong className="text-zinc-950">{inboxItems.filter(i => i.source !== 'Note').length}</strong></span>
                  <span>Note Extractions: <strong className="text-zinc-950">{inboxItems.filter(i => i.source === 'Note').length}</strong></span>
                </div>
                <div className="text-zinc-400 italic text-[11px]">
                  *Converting appends tasks instantly onto PlanGlade MVP.
                </div>
              </div>

            </div>
          )}

          {/* ==================== PAGE 3: TASKS ==================== */}
          {activePage === 'Tasks' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Workspace Tasks</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Task Registry</h2>
                  <p className="text-zinc-500 text-xs font-light mt-0.5">Central register containing active scope timelines.</p>
                </div>

                {/* View Switcher Controls (Shadcn styled segmented controls) */}
                <div className="flex items-center bg-zinc-100 rounded-lg p-1 border border-zinc-200/80 self-start">
                  <button 
                    onClick={() => setTaskView('list')}
                    className={`px-3 py-1 rounded-md text-[10.5px] font-bold transition-all ${taskView === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    List register
                  </button>
                  <button 
                    onClick={() => setTaskView('board')}
                    className={`px-3 py-1 rounded-md text-[10.5px] font-bold transition-all ${taskView === 'board' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    State columns
                  </button>
                </div>
              </div>

              {/* Segmented Filters Tab layout */}
              <div className="flex items-center gap-1.5 border-b border-zinc-200/80 pb-3 overflow-x-auto scrollbar-none">
                {['All', 'Today', 'Upcoming', 'Overdue', 'Blocked', 'Completed'].map((filter) => {
                  let count = 0;
                  if (filter === 'All') count = tasks.length;
                  else if (filter === 'Today') count = tasks.filter(t => t.due === 'Today').length;
                  else if (filter === 'Upcoming') count = tasks.filter(t => t.due !== 'Today' && t.due !== 'No date' && t.status !== 'Completed').length;
                  else if (filter === 'Overdue') count = tasks.filter(t => t.dueRaw && new Date(t.dueRaw) < new Date('2026-06-17') && t.status !== 'Completed').length;
                  else if (filter === 'Blocked') count = tasks.filter(t => t.status === 'Blocked').length;
                  else if (filter === 'Completed') count = tasks.filter(t => t.status === 'Completed').length;

                  return (
                    <button 
                      key={filter}
                      onClick={() => setTaskFilter(filter)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${taskFilter === filter ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                    >
                      {filter} <span className="text-[10px] ml-1 font-mono opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* RENDER DENSE LIST VIEW WITH REFINED PANEL SPLIT */}
              {taskView === 'list' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Task Columns (left 7 cols) */}
                  <div className="lg:col-span-7 space-y-1.5 bg-white border border-zinc-200/80 rounded-lg p-2">
                    {tasks
                      .filter(t => {
                        if (taskFilter === 'All') return true;
                        if (taskFilter === 'Today') return t.due === 'Today';
                        if (taskFilter === 'Upcoming') return t.due !== 'Today' && t.due !== 'No date' && t.status !== 'Completed';
                        if (taskFilter === 'Overdue') return t.dueRaw && new Date(t.dueRaw) < new Date('2026-06-17') && t.status !== 'Completed';
                        if (taskFilter === 'Blocked') return t.status === 'Blocked';
                        if (taskFilter === 'Completed') return t.status === 'Completed';
                        return true;
                      })
                      .map((task) => (
                        <div 
                          key={task.id} 
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`flex items-center justify-between py-2.5 px-3 rounded-md transition-all cursor-pointer ${selectedTaskId === task.id ? 'bg-zinc-100/80 text-zinc-950 font-medium' : 'hover:bg-zinc-50'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task.id); }}
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${task.status === 'Completed' ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 hover:border-zinc-500 bg-white'}`}
                            >
                              {task.status === 'Completed' && <Check className="w-2.5 h-2.5" />}
                            </button>
                            <span className={`text-xs tracking-tight truncate ${task.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                              {task.title}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[9px] text-zinc-400 truncate max-w-[80px] font-mono">{task.project}</span>
                            <span className={`text-[9.5px] font-mono ${task.status === 'Blocked' ? 'text-amber-600 font-bold' : 'text-zinc-500'}`}>
                              {task.due}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Task Drawer Panel Concept (resembling shadcn sheet in right 5 cols) */}
                  <div className="lg:col-span-5 bg-white border border-zinc-200/80 rounded-lg p-5 space-y-6 shadow-xs sticky top-20">
                    <div>
                      <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider">{selectedTask.project || 'Unassigned'}</span>
                      <h3 className="text-base font-semibold text-zinc-900 mt-1">{selectedTask.title}</h3>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-3 py-3 border-y border-zinc-100">
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Status</p>
                          <span className="text-zinc-700 font-semibold mt-1 inline-block">{selectedTask.status}</span>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Priority</p>
                          <span className="text-zinc-700 font-semibold mt-1 inline-block">{selectedTask.priority}</span>
                        </div>
                        <div className="mt-1">
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Target Due</p>
                          <span className="text-zinc-700 font-semibold mt-1 inline-block font-mono">{selectedTask.due}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Scope Context Description</p>
                        <p className="text-zinc-600 leading-relaxed font-light bg-zinc-50/50 p-2.5 rounded-md border border-zinc-100">
                          {selectedTask.desc || 'No contextual description added yet.'}
                        </p>
                      </div>

                      {/* Display subtasks */}
                      {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Linked sub-scopes</p>
                          <div className="space-y-1.5 bg-zinc-50/30 p-2.5 rounded-md border border-zinc-100">
                            {selectedTask.subtasks.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${sub.completed ? 'bg-zinc-400' : 'bg-zinc-200'}`}></span>
                                <span className={`font-light text-xs text-zinc-600 ${sub.completed ? 'line-through text-zinc-400' : ''}`}>{sub.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linked file details */}
                      {selectedTask.linkedNote && (
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Linked Project Note</p>
                          <button 
                            onClick={() => {
                              const nt = notes.find(n => n.title === selectedTask.linkedNote);
                              if (nt) {
                                setSelectedNoteId(nt.id);
                                setActivePage('Notes');
                              }
                            }}
                            className="text-zinc-950 font-semibold flex items-center gap-1 hover:underline mt-1 hover:text-zinc-800"
                          >
                            {selectedTask.linkedNote} <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <button 
                        onClick={() => handleToggleTaskStatus(selectedTask.id)}
                        className="text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                      >
                        {selectedTask.status === 'Completed' ? 'Re-open task' : 'Mark complete'}
                      </button>
                      <button 
                        onClick={() => {
                          setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, due: 'Tomorrow', dueRaw: '2026-06-18' } : t));
                          addToast('Rescheduled target date to tomorrow.');
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-950 transition-colors"
                      >
                        Reschedule tomorrow
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                /* Dynamic Kanban column view states */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {['Todo', 'In progress', 'Blocked'].map((columnStatus) => {
                    const columnTasks = tasks.filter(t => t.status === columnStatus);
                    return (
                      <div key={columnStatus} className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                          <h4 className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${columnStatus === 'Blocked' ? 'bg-amber-500' : columnStatus === 'In progress' ? 'bg-zinc-900' : 'bg-zinc-300'}`}></span>
                            {columnStatus}
                          </h4>
                          <span className="text-xs text-zinc-400 font-mono font-bold bg-zinc-100 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                        </div>

                        <div className="space-y-2.5">
                          {columnTasks.map(t => (
                            <div 
                              key={t.id}
                              onClick={() => { setSelectedTaskId(t.id); setTaskView('list'); }}
                              className="bg-white p-3.5 rounded-lg border border-zinc-200/80 hover:border-zinc-950 hover:shadow-xs transition-all cursor-pointer space-y-2.5"
                            >
                              <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono block">{t.project}</span>
                              <p className="text-xs text-zinc-800 font-bold leading-relaxed">{t.title}</p>
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
                                <span className="font-medium">{t.priority} priority</span>
                                <span className="font-mono bg-zinc-50 px-1 rounded">{t.due}</span>
                              </div>
                            </div>
                          ))}
                          {columnTasks.length === 0 && (
                            <p className="text-xs text-zinc-400 italic py-8 text-center bg-zinc-50/50 rounded-lg border border-dashed border-zinc-200">Empty list.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ==================== PAGE 4: PROJECTS ==================== */}
          {activePage === 'Projects' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Workspace Folders</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Projects Workspace</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Separate work buffers to keep notes, deliverables, and checklists structured.</p>
              </div>

              {/* High-fidelity responsive directory lines listing */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-zinc-400 pb-2 border-b border-zinc-200/80 px-4 tracking-wider">
                  <span className="col-span-5">Project Label</span>
                  <span className="col-span-2 text-right">Progress Bar</span>
                  <span className="col-span-2 text-right">Pending Tasks</span>
                  <span className="col-span-3 text-right">Target Completion</span>
                </div>

                <div className="divide-y divide-zinc-200/60 border border-zinc-200/80 rounded-lg overflow-hidden bg-white">
                  {PROJECTS.map((proj) => (
                    <div 
                      key={proj.id}
                      onClick={() => { setSelectedProjectId(proj.id); setActivePage('ProjectDetail'); }}
                      className="grid grid-cols-12 items-center py-4 px-4 hover:bg-zinc-50 transition-colors cursor-pointer gap-2"
                    >
                      <div className="col-span-5 pr-4">
                        <h4 className="text-xs font-bold text-zinc-900 hover:underline">{proj.name}</h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-light">Next: {proj.nextTask}</p>
                      </div>

                      <div className="col-span-2 flex flex-col items-end gap-1.5">
                        <span className="text-xs text-zinc-800 font-mono font-bold">{proj.progress}%</span>
                        <div className="w-16 bg-zinc-200 h-1 rounded-full overflow-hidden">
                          <div className="bg-zinc-900 h-full" style={{ width: `${proj.progress}%` }}></div>
                        </div>
                      </div>

                      <div className="col-span-2 text-right text-xs text-zinc-600 font-medium">
                        {proj.openTasks} open
                      </div>

                      <div className="col-span-3 text-right text-xs text-zinc-500 font-mono">
                        {proj.due}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workspace summary data bar (not noisy dashboard cards) */}
              <div className="p-4.5 bg-zinc-50/80 rounded-lg border border-zinc-200/60 flex flex-wrap items-center justify-between gap-6 text-xs text-zinc-500">
                <div className="flex items-center gap-6">
                  <span>Trackers: <strong className="text-zinc-950">{PROJECTS.length}</strong></span>
                  <span>Deliverables: <strong className="text-zinc-950">29 open</strong></span>
                  <span>Blocked dependencies: <strong className="text-zinc-950">1 issue</strong></span>
                  <span>Overdue tasks: <strong className="text-zinc-950">2 issues</strong></span>
                </div>
                <button 
                  onClick={() => addToast('Creator flow details are strictly local. Create files directly in workspace.')} 
                  className="font-bold text-zinc-900 hover:underline flex items-center gap-1"
                >
                  Configure build archives <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* ==================== PAGE 5: PROJECT DETAIL ==================== */}
          {activePage === 'ProjectDetail' && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Back to Project collections */}
              <button 
                onClick={() => setActivePage('Projects')}
                className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors font-semibold"
              >
                ← Back to Projects Workspace
              </button>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{activeProject.status} Track</span>
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mt-1">{activeProject.name}</h2>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-zinc-500 font-medium">Target due: {activeProject.due}</span>
                    <span className="bg-zinc-900 text-white px-2.5 py-1 rounded-md font-bold shadow-xs">{activeProject.progress}% complete</span>
                  </div>
                </div>

                <p className="text-zinc-600 text-xs font-light leading-relaxed max-w-3xl">
                  {activeProject.desc}
                </p>
              </div>

              {/* Sub navigation bar inside detail page */}
              <div className="border-b border-zinc-200/80 flex items-center gap-6 text-xs text-zinc-500 font-semibold">
                <button className="border-b-2 border-zinc-950 pb-2 text-zinc-950">Overview Workspace</button>
                <button onClick={() => setActivePage('Tasks')} className="hover:text-zinc-950 pb-2">Active Tasks ({tasks.filter(t => t.project === activeProject.name).length})</button>
                <button onClick={() => setActivePage('Notes')} className="hover:text-zinc-950 pb-2">Linked Notes ({notes.filter(n => n.project === activeProject.name).length})</button>
                <span className="text-zinc-300 pb-2">|</span>
                <span className="text-zinc-300 pb-2 cursor-not-allowed italic font-normal" title="Timeline Gantt components coming in core release">Gantt Timeline (Later)</span>
              </div>

              {/* Detail information view layout grids */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-2">
                
                {/* Active warnings and checklists */}
                <div className="md:col-span-8 space-y-6">
                  
                  {activeProject.id === 'p-1' && (
                    <div className="bg-red-50/50 p-4 rounded-lg text-xs text-red-900 flex items-start gap-3 border border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-950">Attention Required</p>
                        <p className="font-light mt-1 text-red-800">You currently have 2 overdue tasks and 1 blocked milestone in this project. Address dependencies below.</p>
                      </div>
                    </div>
                  )}

                  {/* Tasks inside this project */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Critical Milestones</h3>
                    <div className="divide-y divide-zinc-100 border border-zinc-200/80 rounded-lg overflow-hidden bg-white">
                      {tasks.filter(t => t.project === activeProject.name).slice(0, 4).map(task => (
                        <div key={task.id} className="flex items-center justify-between py-3 px-4 hover:bg-zinc-50 transition-colors">
                          <span className="text-xs text-zinc-800 font-semibold">{task.title}</span>
                          <span className={`text-[10.5px] font-mono ${task.status === 'Blocked' ? 'text-amber-600 font-bold' : 'text-zinc-400 font-medium'}`}>{task.due}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project docs listing */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Linked Documentation</h3>
                    <div className="space-y-2">
                      {PROJECT_DOCS.filter(d => d.projectId === activeProject.id).map(doc => (
                        <div key={doc.id} className="flex items-center justify-between py-3 px-4 bg-white border border-zinc-200/80 rounded-lg hover:border-zinc-900 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200/40 font-bold">DOC</span>
                            <span className="text-xs text-zinc-800 font-semibold">{doc.title}</span>
                          </div>
                          <span className="text-[10px] bg-zinc-50 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200/40 font-mono">{doc.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right hand metadata sidebar panel */}
                <div className="md:col-span-4 space-y-6">
                  <div className="bg-white border border-zinc-200/80 rounded-lg p-4 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Workspace context</h3>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between border-b border-zinc-50 pb-1.5">
                        <span className="text-zinc-500">Deliverables</span>
                        <strong className="font-mono text-zinc-800">{activeProject.openTasks}</strong>
                      </div>
                      <div className="flex justify-between border-b border-zinc-50 pb-1.5">
                        <span className="text-zinc-500">Blocked milestone</span>
                        <strong className="font-mono text-zinc-800">{activeProject.blocked}</strong>
                      </div>
                      <div className="flex justify-between border-b border-zinc-50 pb-1.5">
                        <span className="text-zinc-500">Overdue issues</span>
                        <strong className="font-mono text-red-600 font-bold">{activeProject.overdue}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Linked project notes</span>
                        <strong className="font-mono text-zinc-800">{activeProject.notes}</strong>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== PAGE 6: NOTES ==================== */}
          {activePage === 'Notes' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Fast notes</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Project Notes</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Draft fast markdown notes that sit alongside active project scopes.</p>
              </div>

              {/* Split editor visual layout (No huge dashboard box layers) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Note list (4 cols) */}
                <div className="lg:col-span-4 space-y-2 bg-white border border-zinc-200/80 rounded-lg p-2.5">
                  <div className="pb-2 border-b border-zinc-100 mb-1 px-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note register</span>
                  </div>
                  {notes.map((note) => (
                    <div 
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`p-3 rounded-md cursor-pointer transition-all ${selectedNoteId === note.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'}`}
                    >
                      <h4 className="text-xs font-semibold truncate">{note.title}</h4>
                      <p className={`text-[10px] mt-1 truncate ${selectedNoteId === note.id ? 'text-zinc-400' : 'text-zinc-500'}`}>{note.project}</p>
                    </div>
                  ))}
                </div>

                {/* Markdown editor area (8 cols) */}
                {(() => {
                  const currentNote = notes.find(n => n.id === selectedNoteId) || notes[0];
                  return (
                    <div className="lg:col-span-8 space-y-4 bg-white border border-zinc-200/80 rounded-lg p-6">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider">{currentNote.project}</span>
                          <h3 className="text-sm font-semibold text-zinc-900 mt-0.5">{currentNote.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleExtractChecklist(currentNote.id)}
                            className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white transition-colors px-3 py-1.5 rounded-md flex items-center gap-1.5 font-semibold shadow-xs"
                          >
                            Extract checklist <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <textarea 
                        className="w-full min-h-[320px] bg-transparent resize-none border-none outline-none focus:ring-0 text-xs text-zinc-700 font-mono leading-relaxed"
                        value={currentNote.content}
                        onChange={(e) => handleNoteContentChange(currentNote.id, e.target.value)}
                        placeholder="Draft project details, codes, checklists..."
                      />

                      <div className="pt-3.5 text-[10.5px] text-zinc-400 flex items-center justify-between border-t border-zinc-100">
                        <span>Last updated: {currentNote.updated}</span>
                        <span>Use checkbox notation <strong className="font-mono bg-zinc-100 px-1 rounded border border-zinc-200/40 text-zinc-800">[ ]</strong> to make extractable checklist tasks.</span>
                      </div>
                    </div>
                  );
                })()}

              </div>

            </div>
          )}

          {/* ==================== PAGE 7: CALENDAR ==================== */}
          {activePage === 'Calendar' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Time management</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Task Timeline</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Your tasks rendered chronologically. No separate events system to manage.</p>
              </div>

              {/* Minimalist calendar visual layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* 7-column calendar matrix structure (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">June 2026</span>
                    <span className="text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-200/40 px-2 py-0.5 rounded font-mono">Continuous Sync Status: Active</span>
                  </div>

                  {/* Day mapping */}
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] uppercase font-bold text-zinc-400">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>

                  {/* Day blocks */}
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 30 }).map((_, idx) => {
                      const dayNumber = idx + 1;
                      let taskDateStr = `2026-06-${dayNumber < 10 ? '0' + dayNumber : dayNumber}`;
                      const dayTasks = tasks.filter(t => t.dueRaw === taskDateStr && t.status !== 'Completed');

                      return (
                        <div 
                          key={idx}
                          onClick={() => setCalendarSelectedDay(dayNumber)}
                          className={`min-h-[80px] p-2 bg-white rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${calendarSelectedDay === dayNumber ? 'border-zinc-950 ring-1 ring-zinc-950' : 'border-zinc-200/80 hover:border-zinc-400'}`}
                        >
                          <span className="text-[10.5px] font-mono font-bold text-zinc-400">{dayNumber}</span>
                          
                          <div className="space-y-1">
                            {dayTasks.slice(0, 2).map(task => (
                              <div key={task.id} className="text-[9px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded truncate font-medium border border-zinc-200/40">
                                {task.title}
                              </div>
                            ))}
                            {dayTasks.length > 2 && (
                              <span className="text-[8px] text-zinc-400 block font-bold text-right">+ {dayTasks.length - 2} more</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected day timeline tasks sidebar panel */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-zinc-200/80 rounded-lg p-4 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Agenda (June {calendarSelectedDay})</h3>
                    
                    {(() => {
                      let dateStr = `2026-06-${calendarSelectedDay < 10 ? '0' + calendarSelectedDay : calendarSelectedDay}`;
                      const dayTasks = tasks.filter(t => t.dueRaw === dateStr || (calendarSelectedDay === 17 && t.due === 'Today'));
                      
                      return (
                        <div className="space-y-3">
                          {dayTasks.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic">No tasks targeted for this date.</p>
                          ) : (
                            dayTasks.map(task => (
                              <div key={task.id} className="py-2 border-b border-zinc-50 last:border-b-0">
                                <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider font-mono">{task.project}</span>
                                <p className="text-xs text-zinc-800 font-bold mt-0.5">{task.title}</p>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Backlog task pool */}
                  <div className="bg-white border border-zinc-200/80 rounded-lg p-4 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Unscheduled Backlog</h3>
                    <div className="space-y-2 text-xs">
                      {tasks.filter(t => t.due === 'No date').map(task => (
                        <div key={task.id} className="p-2 bg-zinc-50 rounded-md border border-zinc-100 flex items-center justify-between gap-2">
                          <span className="truncate pr-2 text-zinc-700">{task.title}</span>
                          <button 
                            onClick={() => {
                              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due: 'Today', dueRaw: '2026-06-17' } : t));
                              addToast('Moved backlog task to Today focal point.');
                            }}
                            className="text-[10px] text-zinc-950 font-bold hover:underline shrink-0"
                          >
                            Schedule
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ==================== PAGE 8: SETTINGS ==================== */}
          {activePage === 'Settings' && (
            <div className="space-y-8 animate-fade-in max-w-2xl">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Preferences</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings Workspace</h2>
                <p className="text-zinc-500 text-xs font-light mt-0.5">Control self-hosted configuration properties.</p>
              </div>

              {/* Rows of settings inputs */}
              <div className="space-y-6">
                
                {/* Segment 1 */}
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Workspace Context</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <p className="text-xs text-zinc-500 font-medium">Workspace Name</p>
                      <input 
                        type="text" 
                        defaultValue="Khalil Workspace"
                        className="mt-1 w-full bg-white border border-zinc-200/80 rounded-md px-3 py-1.5 text-xs text-zinc-800 outline-none focus:ring-1 focus:ring-zinc-950"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 font-medium">Subscription Tier</p>
                      <p className="text-xs text-zinc-900 font-semibold mt-2.5">Self-hosted Open-Source Free</p>
                    </div>
                  </div>
                </div>

                {/* Segment 2 */}
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Appearance Aesthetics</h3>
                  <div className="flex gap-3">
                    <div className="px-4 py-2 bg-zinc-950 text-white rounded-md text-xs font-semibold cursor-default">
                      Calm Minimal Light (Default)
                    </div>
                    <div 
                      onClick={() => addToast('Appearance update is locked on light mode.')}
                      className="px-4 py-2 bg-white border border-zinc-200/80 text-zinc-500 rounded-md text-xs cursor-pointer hover:bg-zinc-50"
                    >
                      Sync with System
                    </div>
                  </div>
                </div>

                {/* Segment 3 */}
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Data Management</h3>
                  <p className="text-xs text-zinc-400 font-light leading-relaxed">
                    Export your tasks, projects, notes, and checklist documents as a single structured JSON file. You can load this elsewhere.
                  </p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const payload = JSON.stringify({ tasks, inboxItems, notes }, null, 2);
                        const blob = new Blob([payload], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'planglade-workspace-export.json';
                        link.click();
                        addToast('Workspace configuration export completed.');
                      }}
                      className="text-xs font-semibold bg-zinc-950 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                    >
                      Export Workspace JSON
                    </button>
                    <button 
                      disabled
                      className="text-xs text-zinc-300 cursor-not-allowed bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200/40"
                    >
                      Import data (Disabled in preview)
                    </button>
                  </div>
                </div>

                {/* Segment 4 */}
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Account Profile</h3>
                  <div className="text-xs text-zinc-600 space-y-1.5">
                    <p>User profile: <strong className="text-zinc-900">Khalil</strong></p>
                    <p>Contact link: <strong className="text-zinc-900">khalil@example.com</strong></p>
                  </div>
                  <div className="flex gap-4 pt-2.5">
                    <button onClick={() => addToast('Locked.')} className="text-xs text-zinc-700 hover:text-zinc-950 font-bold">Edit profile details</button>
                    <button onClick={() => addToast('Session persistent.')} className="text-xs text-zinc-400 hover:text-zinc-600">Sign out</button>
                  </div>
                </div>

                {/* Segment 5 */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Irreversible actions</h3>
                  <p className="text-xs text-zinc-400 italic">
                    Restructuring database values or deleting workspace databases is restricted inside this preview.
                  </p>
                </div>

              </div>

            </div>
          )}

        </div>

      </main>

    </div>
  );
}
