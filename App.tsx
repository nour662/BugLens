import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { UploadedFile, ExpertiseLevel, DebugState, Persona, AnalysisOptions } from './types';
import FileUpload from './components/FileUpload';
import AnalysisResult from './components/AnalysisResult';
import { analyzeDebugContext, runCodeSimulation, quickEditCode } from './services/geminiService';
import * as monaco from 'monaco-editor';
import { 
  Bug, Layers, Cpu, AlertCircle, Zap, User, Wand2, Sparkles, Terminal, 
  PenTool, FileCode, Menu, X, Play, Trash2, ChevronDown, Check,
  Briefcase, Heart, TrendingUp, Bot, Skull, Feather, Mic
} from './components/Icons';

// Language Configuration
const LANGUAGES = {
  python: { name: 'Python', ext: 'py', cmd: 'python3', monaco: 'python' },
  javascript: { name: 'JavaScript', ext: 'js', cmd: 'node', monaco: 'javascript' },
  typescript: { name: 'TypeScript', ext: 'ts', cmd: 'ts-node', monaco: 'typescript' },
  cpp: { name: 'C++', ext: 'cpp', cmd: 'g++ main.cpp && ./a.out', monaco: 'cpp' },
  java: { name: 'Java', ext: 'java', cmd: 'javac Main.java && java Main', monaco: 'java' },
  go: { name: 'Go', ext: 'go', cmd: 'go run main.go', monaco: 'go' },
  rust: { name: 'Rust', ext: 'rs', cmd: 'cargo run', monaco: 'rust' },
  php: { name: 'PHP', ext: 'php', cmd: 'php', monaco: 'php' },
  ruby: { name: 'Ruby', ext: 'rb', cmd: 'ruby', monaco: 'ruby' }
};

type LanguageKey = keyof typeof LANGUAGES;

const PERSONAS: { id: Persona, label: string, icon: any, desc: string }[] = [
    { id: 'Standard', label: 'Pro', icon: Briefcase, desc: 'Professional & Direct' },
    { id: 'Constructive Coach', label: 'Coach', icon: Heart, desc: 'Encouraging & Helpful' },
    { id: '10x Engineer', label: '10x Dev', icon: TrendingUp, desc: 'Terse & Technical' },
    { id: 'Cyberpunk', label: 'Runner', icon: Bot, desc: 'Futuristic Slang' },
    { id: 'Pirate', label: 'Pirate', icon: Skull, desc: 'Nautical Nonsense' },
    { id: 'Shakespeare', label: 'Bard', icon: Feather, desc: 'Poetic Tragedy' },
];

// --- Monaco Editor Setup ---

const loadMonacoEnv = () => {
    if ((window as any).monacoEnvConfigured) return;
    (window as any).monacoEnvConfigured = true;

    const baseUrl = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/esm/vs';

    (window as any).MonacoEnvironment = {
        getWorker: function (workerId: string, label: string) {
            let workerUrl = '';
            switch (label) {
                case 'json': workerUrl = `${baseUrl}/language/json/json.worker.js`; break;
                case 'css':
                case 'scss':
                case 'less': workerUrl = `${baseUrl}/language/css/css.worker.js`; break;
                case 'html':
                case 'handlebars':
                case 'razor': workerUrl = `${baseUrl}/language/html/html.worker.js`; break;
                case 'typescript':
                case 'javascript': workerUrl = `${baseUrl}/language/typescript/ts.worker.js`; break;
                default: workerUrl = `${baseUrl}/editor/editor.worker.js`; break;
            }

            const blobContent = "import '" + workerUrl + "';";
            const blob = new Blob([blobContent], { type: 'application/javascript' });
            return new Worker(URL.createObjectURL(blob), { type: 'module' });
        }
    };
};

interface CodeEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  language: string;
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

const MonacoCodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language, onMount }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    loadMonacoEnv();

    if (editorRef.current && !monacoEditorRef.current) {
        monaco.editor.defineTheme('buglens-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: '', background: '0b1120' }, 
                { token: 'comment', foreground: '64748b' }, 
                { token: 'keyword', foreground: '818cf8' }, 
                { token: 'string', foreground: 'fcd34d' }, 
                { token: 'number', foreground: '6ee7b7' }, 
            ],
            colors: {
                'editor.background': '#0b1120',
                'editor.foreground': '#e2e8f0',
                'editor.lineHighlightBackground': '#1e293b',
                'editorLineNumber.foreground': '#475569',
                'editorIndentGuide.background': '#1e293b',
            }
        });

        monacoEditorRef.current = monaco.editor.create(editorRef.current, {
            value: value,
            language: language,
            theme: 'buglens-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"JetBrains Mono", monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'all',
            formatOnPaste: true,
            formatOnType: true,
        });

        monacoEditorRef.current.onDidChangeModelContent(() => {
            onChange(monacoEditorRef.current?.getValue() || '');
        });

        if (onMount) {
            onMount(monacoEditorRef.current);
        }
    }

    return () => {
        if (monacoEditorRef.current) {
            monacoEditorRef.current.dispose();
            monacoEditorRef.current = null;
        }
    };
  }, []);

  useEffect(() => {
    if (monacoEditorRef.current) {
        const currentValue = monacoEditorRef.current.getValue();
        if (value !== currentValue) {
            monacoEditorRef.current.setValue(value);
        }
    }
  }, [value]);

  useEffect(() => {
    if (monacoEditorRef.current) {
        monaco.editor.setModelLanguage(monacoEditorRef.current.getModel()!, language);
    }
  }, [language]);

  return <div ref={editorRef} className="w-full h-full" />;
};


const App: React.FC = () => {
  // --- State ---
  const [viewMode, setViewMode] = useState<'editor' | 'analysis'>('editor');
  const [manualCode, setManualCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageKey>('python');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showVoiceToast, setShowVoiceToast] = useState(false);
  const [voiceToastMsg, setVoiceToastMsg] = useState("Voice Command Recognized");
  const [isQuickEditing, setIsQuickEditing] = useState(false);
  
  // Feedback Animations
  const [highlightRun, setHighlightRun] = useState(false);
  const [highlightFormat, setHighlightFormat] = useState(false);
  
  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState<string>('Welcome to BugLens Shell v1.0.0\nType "help" for info.\n\n');
  const [terminalInput, setTerminalInput] = useState('');
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Analysis State
  const [state, setState] = useState<DebugState>({
    files: [],
    expertiseLevel: 'Intermediate',
    persona: 'Standard',
    options: {
      generateTests: false,
      visualizeDiagram: false,
      securityCheck: false,
      predictBugs: false, 
    },
    isAnalyzing: false,
    result: null,
    error: null,
  });

  // --- Effects ---

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const newFiles: UploadedFile[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            let type: UploadedFile['type'] = 'text';
            if (file.type.startsWith('image/')) type = 'image';
            if (file.type.startsWith('video/')) type = 'video';
            if (file.type.startsWith('audio/')) type = 'audio';

            newFiles.push({
              id: Math.random().toString(36).substr(2, 9),
              file: file,
              type: type,
              previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined,
            });
          }
        }
      }

      if (newFiles.length > 0) {
        setState(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalOutput, isTerminalOpen]);

  useEffect(() => {
    if (isTerminalOpen && terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  }, [isTerminalOpen]);

  // --- Handlers ---

  const handleFilesAdded = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => {
      let type: UploadedFile['type'] = 'text';
      if (file.type.startsWith('image/')) type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      if (file.type.startsWith('audio/')) type = 'audio';

      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        type,
        previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined,
      };
    });

    setState(prev => ({ ...prev, files: [...prev.files, ...newFiles], error: null }));
  }, []);

  const handleFileRemove = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== id)
    }));
  }, []);

  const toggleOption = (key: keyof AnalysisOptions) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, [key]: !prev.options[key] }
    }));
  };

  const handleApplyCode = (code: string) => {
    setManualCode(code);
    setViewMode('editor');
  };

  const triggerVoiceFeedback = (msg: string) => {
      setVoiceToastMsg(msg);
      setShowVoiceToast(true);
      setTimeout(() => setShowVoiceToast(false), 2000);
  };

  const handleQuickEdit = async (instruction: string) => {
      if (!manualCode.trim()) {
          triggerVoiceFeedback("Editor is empty!");
          return;
      }
      setIsQuickEditing(true);
      triggerVoiceFeedback("AI Applying Changes...");
      
      const newCode = await quickEditCode(manualCode, instruction);
      setManualCode(newCode);
      setIsQuickEditing(false);
      triggerVoiceFeedback("Changes Applied!");
  };

  // Legacy (Manual Voice Command) fallback
  const handleVoiceCommand = (command: string) => {
    triggerVoiceFeedback("Voice Command Recognized");
    if (command === 'run') {
      handleAnalyze();
    }
  };

  const handleSmartDictation = (result: { type: 'text' | 'command' | 'NO_SPEECH', content: string }) => {
     if (result.type === 'command') {
         const cmd = result.content.toUpperCase();
         
         if (cmd.includes("RUN") || cmd.includes("DEBUG") || cmd.includes("ANALYZE")) {
             triggerVoiceFeedback("Executing Run Command...");
             setHighlightRun(true);
             setTimeout(() => setHighlightRun(false), 1000);
             handleAnalyze();
             
         } else if (cmd.includes("CLEAR") && (cmd.includes("FILE") || cmd.includes("FILES"))) {
             setState(prev => ({ ...prev, files: [] }));
             triggerVoiceFeedback("Files Cleared");
             
         } else if (cmd.includes("CLEAR_EDITOR")) {
             setManualCode("");
             triggerVoiceFeedback("Editor Cleared");
             
         } else if (cmd.includes("FIX_CODE")) {
             handleQuickEdit("Fix this code.");
             
         } else if (cmd.includes("STOP_AGENT") || cmd.includes("AGENT_SLEEP")) {
             triggerVoiceFeedback("Agent Paused");
             
         } else if (cmd.includes("AGENT_CLOSE")) {
             triggerVoiceFeedback("Agent Closed");

         } else if (cmd.startsWith("CHANGE_CODE")) {
             // Extract language from CHANGE_CODE:PYTHON
             const targetLang = cmd.split(':')[1]?.toLowerCase()?.trim();
             if (targetLang) {
                 // Try to find matching key
                 const match = Object.keys(LANGUAGES).find(k => k === targetLang || LANGUAGES[k as LanguageKey].name.toLowerCase() === targetLang);
                 if (match) {
                     setSelectedLanguage(match as LanguageKey);
                     triggerVoiceFeedback(`Switched to ${LANGUAGES[match as LanguageKey].name}`);
                     handleQuickEdit(`Translate this code to ${LANGUAGES[match as LanguageKey].name}`);
                 } else {
                     triggerVoiceFeedback(`Language '${targetLang}' not found`);
                 }
             }
             
         } else {
             triggerVoiceFeedback(`Command: ${result.content}`);
         }
     } else if (result.type === 'text') {
         // Text Dictation - Guard against empty strings
         if (!result.content || !result.content.trim()) return;

         triggerVoiceFeedback("Inserting Code...");
         const text = result.content;
         if (editorInstanceRef.current) {
             const editor = editorInstanceRef.current;
             const position = editor.getPosition();
             editor.executeEdits("voice-dictation", [{
                 range: new monaco.Range(
                     position?.lineNumber || 1, 
                     position?.column || 1, 
                     position?.lineNumber || 1, 
                     position?.column || 1
                 ),
                 text: text,
                 forceMoveMarkers: true
             }]);
         } else {
             setManualCode(prev => prev + (prev ? '\n' : '') + text);
         }
     }
  };

  const handleFormatCode = () => {
      setHighlightFormat(true);
      setTimeout(() => setHighlightFormat(false), 500);
      if (editorInstanceRef.current) {
          editorInstanceRef.current.getAction('editor.action.formatDocument')?.run();
      }
  };

  // --- Terminal & Execution Logic ---

  const executeTerminalCommand = async (command: string, type: 'code' | 'command') => {
    setIsTerminalOpen(true);
    setIsExecutingCode(true);
    
    const langConfig = LANGUAGES[selectedLanguage];
    const userPrompt = type === 'code' 
      ? `user@buglens:~$ ${langConfig.cmd} script.${langConfig.ext}` 
      : `user@buglens:~$ ${command}`;

    setTerminalOutput(prev => prev + userPrompt + '\n');

    try {
      const input = type === 'code' ? manualCode : command;
      const result = await runCodeSimulation(input, type, LANGUAGES[selectedLanguage].name);
      setTerminalOutput(prev => prev + result + '\n\n');
    } catch (e) {
      setTerminalOutput(prev => prev + `bash: error: ${e}\n\n`);
    } finally {
      setIsExecutingCode(false);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = terminalInput.trim();
      if (!cmd) return;

      setCommandHistory(prev => [...prev, cmd]);
      setHistoryIndex(-1);
      setTerminalInput('');

      if (cmd === 'clear') {
        setTerminalOutput('');
      } else if (cmd === 'help') {
        setTerminalOutput(prev => prev + 'user@buglens:~$ help\nAvailable commands: run, clear, help, pip install <pkg>, npm install <pkg>\n\n');
      } else if (cmd === 'run') {
        executeTerminalCommand('', 'code');
      } else {
        executeTerminalCommand(cmd, 'command');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setTerminalInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
    }
  };

  const handleAnalyze = async () => {
    if (state.files.length === 0 && !manualCode.trim()) {
      setState(prev => ({ ...prev, error: "Please upload a file or paste code first." }));
      return;
    }

    setState(prev => ({ ...prev, isAnalyzing: true, error: null, result: null }));
    setViewMode('analysis');

    try {
      const filesToAnalyze = [...state.files];
      if (manualCode.trim()) {
        const langExt = LANGUAGES[selectedLanguage].ext;
        const codeFile = new File([manualCode], `main.${langExt}`, { type: 'text/plain' });
        filesToAnalyze.push({
          id: 'manual-code',
          file: codeFile,
          type: 'text',
          content: manualCode
        });
      }

      const markdown = await analyzeDebugContext(
        filesToAnalyze,
        state.expertiseLevel,
        state.persona,
        state.options
      );
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        result: { markdown }
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: err.message || "An unexpected error occurred."
      }));
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#0f172a] text-slate-200 overflow-hidden relative">
      
      {/* Voice Command Feedback Toast */}
      {showVoiceToast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-indigo-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 border border-indigo-400/50">
            <Mic className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-bold">{voiceToastMsg}</span>
        </div>
      )}

      {/* Loading Overlay for Quick Edit */}
      {isQuickEditing && (
         <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
             <div className="bg-slate-800 p-6 rounded-xl flex flex-col items-center gap-4 shadow-2xl">
                 <Wand2 className="w-10 h-10 text-indigo-400 animate-spin" />
                 <p className="text-indigo-200 font-semibold animate-pulse">AI Agent is modifying your code...</p>
             </div>
         </div>
      )}

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* --- Sidebar (Drawer on Mobile) --- */}
      <div className={`
        fixed md:relative z-30 w-[85vw] max-w-[320px] md:w-80 h-[100dvh]
        bg-[#1e293b] border-r border-slate-800 flex flex-col shadow-2xl md:shadow-none
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-[#1e293b]">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500/20 p-2 rounded-lg">
              <Bug className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-white">BugLens</h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden p-1 text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Config Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {/* Upload Section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              Context & Files
            </div>
            <FileUpload 
              files={state.files} 
              onFilesAdded={handleFilesAdded} 
              onFileRemove={handleFileRemove} 
              onVoiceCommand={handleVoiceCommand}
              onSmartDictation={handleSmartDictation}
            />
          </section>

          {/* Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              Expertise & Persona
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Your Skill Level</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-900/50 p-1 rounded-lg">
                  {(['Beginner', 'Intermediate', 'Senior'] as ExpertiseLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setState(prev => ({ ...prev, expertiseLevel: level }))}
                      className={`text-[10px] py-1.5 rounded-md transition-all font-medium ${
                        state.expertiseLevel === level 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-2">Your Persona</label>
                <div className="grid grid-cols-2 gap-2">
                    {PERSONAS.map((p) => {
                        const Icon = p.icon;
                        const isSelected = state.persona === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => setState(prev => ({ ...prev, persona: p.id }))}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 group ${
                                    isSelected 
                                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                                        : 'bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
                                }`}
                            >
                                <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className="text-xs font-medium">{p.label}</span>
                                <span className="text-[9px] opacity-60 scale-90">{p.desc}</span>
                            </button>
                        );
                    })}
                </div>
              </div>
            </div>
          </section>

          {/* Analysis Options */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              Power Tools
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'generateTests', label: 'Auto-Generate Tests', icon: Sparkles },
                { id: 'visualizeDiagram', label: 'Visualize Flow', icon: Wand2 },
                { id: 'predictBugs', label: 'Error Time Machine', icon: Sparkles }, // Re-labeled
                { id: 'securityCheck', label: 'Security Audit', icon: AlertCircle },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id as keyof AnalysisOptions)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    state.options[opt.id as keyof AnalysisOptions]
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-900/30 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </div>
                  <div className={`w-3 h-3 rounded-full border ${
                    state.options[opt.id as keyof AnalysisOptions] ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                  }`} />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#1e293b] border-t border-slate-800">
          <button
            onClick={handleAnalyze}
            disabled={state.isAnalyzing}
            className={`w-full flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group
            ${highlightRun 
                ? 'bg-emerald-500 scale-105 shadow-emerald-500/50 ring-2 ring-white' 
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/20'
            }`}
          >
            {state.isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Debugging...</span>
              </>
            ) : (
              <>
                <Zap className={`w-4 h-4 ${highlightRun ? 'animate-bounce' : 'group-hover:fill-current'}`} />
                <span>Deep Debug</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col h-[100dvh] relative min-w-0">
        
        {/* Mobile Header */}
        <div className="md:hidden h-14 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-400">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-slate-200">BugLens Editor</span>
          <button 
            onClick={handleAnalyze} 
            className="w-8 h-8 flex items-center justify-center bg-indigo-600 rounded-lg text-white shadow-lg"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Tabs */}
        <div className="h-12 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg">
             <button
               onClick={() => setViewMode('editor')}
               className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                 viewMode === 'editor' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
               }`}
             >
               <FileCode className="w-3.5 h-3.5" />
               Editor
             </button>
             <button
               onClick={() => setViewMode('analysis')}
               className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                 viewMode === 'analysis' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
               }`}
             >
               <Sparkles className="w-3.5 h-3.5" />
               Results
               {state.result && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
             </button>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'editor' && (
              <>
                {/* Language Selector */}
                <div className="relative" ref={langMenuRef}>
                    <button 
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-medium text-slate-300 transition-all min-w-[100px] justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                            {LANGUAGES[selectedLanguage].name}
                        </div>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                    
                    {isLangMenuOpen && (
                        <div className="absolute top-full right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                            {Object.entries(LANGUAGES).map(([key, lang]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSelectedLanguage(key as LanguageKey);
                                        setIsLangMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                                        selectedLanguage === key ? 'text-indigo-400 bg-slate-700/50' : 'text-slate-300'
                                    }`}
                                >
                                    <span>{lang.name}</span>
                                    {selectedLanguage === key && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button 
                    onClick={handleFormatCode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-all ${
                        highlightFormat 
                           ? 'bg-indigo-500 text-white border-indigo-500' 
                           : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    }`}
                    title="Prettify Code"
                >
                    <Wand2 className={`w-3.5 h-3.5 ${highlightFormat ? 'animate-spin' : ''}`} />
                </button>
                
                <button 
                    onClick={() => executeTerminalCommand('', 'code')}
                    disabled={isExecutingCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-medium transition-all"
                >
                    <Play className={`w-3.5 h-3.5 ${isExecutingCode ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Run Code</span>
                </button>
                <button 
                    onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                    className={`p-1.5 rounded-md transition-colors ${isTerminalOpen ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'}`}
                    title="Toggle Terminal"
                >
                    <Terminal className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          
          {/* EDITOR VIEW */}
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${viewMode === 'editor' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             <div className="flex-1 relative bg-[#0b1120] overflow-hidden">
                <MonacoCodeEditor 
                    value={manualCode}
                    onChange={setManualCode}
                    language={LANGUAGES[selectedLanguage].monaco}
                    onMount={(editor) => { editorInstanceRef.current = editor; }}
                />
             </div>

             {/* TERMINAL PANEL */}
             {isTerminalOpen && (
                 <div 
                    className="flex-shrink-0 border-t border-slate-700 bg-[#0f172a] flex flex-col transition-all duration-300 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]
                    h-[35%] md:h-1/3 min-h-[100px] md:min-h-[200px]" // Responsive height fix
                 >
                     <div className="flex items-center justify-between px-4 py-1.5 bg-[#1e293b] border-b border-slate-700 select-none">
                         <div className="flex items-center gap-2 text-xs text-slate-400">
                             <Terminal className="w-3.5 h-3.5" />
                             <span>Terminal</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <button onClick={() => setTerminalOutput('')} className="p-1 hover:text-white text-slate-500" title="Clear">
                                 <Trash2 className="w-3.5 h-3.5" />
                             </button>
                             <button onClick={() => setIsTerminalOpen(false)} className="p-1 hover:text-white text-slate-500">
                                 <X className="w-3.5 h-3.5" />
                             </button>
                         </div>
                     </div>
                     
                     <div 
                        ref={terminalRef}
                        className="flex-1 overflow-y-auto p-4 font-mono text-xs md:text-sm text-slate-300 space-y-1 custom-scrollbar"
                        onClick={() => terminalInputRef.current?.focus()}
                     >
                         <pre className="whitespace-pre-wrap leading-relaxed text-slate-400">{terminalOutput}</pre>
                         <div ref={terminalEndRef} />
                         
                         <div className="flex items-center gap-2 text-emerald-500 mt-2">
                             <span className="shrink-0">user@buglens:~$</span>
                             <input 
                                ref={terminalInputRef}
                                type="text" 
                                value={terminalInput}
                                onChange={(e) => setTerminalInput(e.target.value)}
                                onKeyDown={handleTerminalKeyDown}
                                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-600"
                                autoComplete="off"
                                spellCheck="false"
                             />
                         </div>
                     </div>
                 </div>
             )}
          </div>

          {/* ANALYSIS RESULTS VIEW */}
          <div className={`absolute inset-0 overflow-y-auto custom-scrollbar p-4 md:p-8 transition-opacity duration-300 ${viewMode === 'analysis' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
             {state.result ? (
               <div className="max-w-4xl mx-auto">
                 <AnalysisResult markdown={state.result.markdown} onApplyCode={handleApplyCode} />
               </div>
             ) : state.error ? (
               <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                 <div className="bg-red-500/10 p-4 rounded-full">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                 </div>
                 <div className="max-w-md">
                    <h3 className="text-lg font-semibold text-white">Analysis Failed</h3>
                    <p className="text-slate-400 mt-2">{state.error}</p>
                 </div>
                 <button onClick={handleAnalyze} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white">Try Again</button>
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                 <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                    <Sparkles className="w-16 h-16 text-slate-600 relative z-10" />
                 </div>
                 <p className="text-slate-400 max-w-sm">
                   Run an analysis to see deep debugging insights, diagrams, and fix suggestions here.
                 </p>
               </div>
             )}
          </div>
          
        </div>

        {/* Status Bar */}
        <div className="h-7 bg-[#0f172a] border-t border-slate-800 flex items-center justify-between px-3 text-[10px] text-slate-500 font-mono shrink-0 overflow-hidden">
            <div className="flex items-center gap-3 overflow-hidden">
                <span className="flex items-center gap-1 shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${isTerminalOpen ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    Terminal
                </span>
                <span className="hidden sm:inline truncate">{state.files.length} Files</span>
                <span className="hidden sm:inline truncate">{state.persona} Mode</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline">Ln {manualCode.split('\n').length}, Col 1</span>
                <span className="uppercase text-slate-400 font-semibold truncate max-w-[80px] text-right">{LANGUAGES[selectedLanguage].name}</span>
                <span className="hidden sm:inline">UTF-8</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;