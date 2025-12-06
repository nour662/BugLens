import React, { useEffect, useRef, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Terminal, Trophy, Copy, Check, Play, FileCode, PenTool, ArrowLeftRight, X, History, GitBranch } from './Icons';
import mermaid from 'mermaid';
import { runCodeSimulation } from '../services/geminiService';

interface AnalysisResultProps {
  markdown: string;
  onApplyCode?: (code: string) => void;
}

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
        try {
            mermaid.initialize({ 
                startOnLoad: true, 
                theme: 'base', 
                securityLevel: 'loose',
                fontFamily: 'JetBrains Mono',
                themeVariables: {
                    primaryColor: '#6366f1', // Indigo 500
                    primaryTextColor: '#e2e8f0',
                    primaryBorderColor: '#4f46e5',
                    lineColor: '#818cf8',
                    secondaryColor: '#1e293b',
                    tertiaryColor: '#0f172a',
                    mainBkg: '#1e293b',
                    nodeBorder: '#6366f1',
                    textColor: '#e2e8f0',
                }
            });
            mermaid.run({ nodes: [ref.current] });
        } catch (e) {
            console.error("Mermaid error", e);
        }
    }
  }, [code]);

  return (
    <div className="my-8 p-4 sm:p-6 bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden flex justify-center shadow-inner relative group w-full overflow-x-auto">
      <div className="absolute top-2 right-2 text-xs text-slate-500 opacity-50 font-mono hidden sm:block">Mermaid Diagram</div>
      <div ref={ref} className="mermaid text-sm w-full flex justify-center min-w-[300px]">
        {code}
      </div>
    </div>
  );
};

const InteractiveCodeBlock: React.FC<{ language: string, children: React.ReactNode, onApply?: (code: string) => void }> = ({ language, children, onApply }) => {
    const [copied, setCopied] = useState(false);
    const [content, setContent] = useState(String(children).replace(/\n$/, ''));
    const [isSimulating, setIsSimulating] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState<string | null>(null);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSimulateRun = async () => {
        setIsSimulating(true);
        setTerminalOutput(null); // Clear previous output
        
        try {
            // Use the real Gemini simulation service instead of hardcoded strings
            const output = await runCodeSimulation(content, 'code');
            setTerminalOutput(output);
        } catch (e) {
             setTerminalOutput(`Error: ${e}`);
        } finally {
             setIsSimulating(false);
        }
    };

    return (
        <div className="relative group my-8 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-[#0b1120] w-full max-w-[calc(100vw-3rem)] md:max-w-full mx-auto">
            {/* Window Title Bar */}
            <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center justify-between px-3 py-2 bg-[#1e293b] border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    {language && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50">
                            <FileCode className="w-3 h-3 text-indigo-400" />
                            <span className="text-xs font-mono text-slate-300 lowercase">{language}</span>
                        </div>
                    )}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 font-mono border-l border-slate-700 pl-3">
                         <PenTool className="w-3 h-3" />
                         <span>Interactive Editor</span>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto overflow-x-auto">
                    {onApply && (
                        <button 
                            onClick={() => onApply(content)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-400 transition-colors border border-indigo-500/20"
                            title="Apply this fix to your main editor"
                        >
                            <ArrowLeftRight className="w-3 h-3" />
                            Apply Fix
                        </button>
                    )}
                    <button 
                        onClick={handleSimulateRun}
                        disabled={isSimulating}
                        className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700/50 text-xs font-medium text-emerald-400 transition-colors disabled:opacity-50"
                    >
                        <Play className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
                        {isSimulating ? 'Running...' : 'Test Run'}
                    </button>
                    <div className="hidden sm:block h-4 w-px bg-slate-700/50" />
                    <button 
                        onClick={handleCopy}
                        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors px-1"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
            
            {/* Editor Content */}
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-[#1e293b]/20 border-r border-white/5 flex flex-col items-center py-4 text-[10px] text-slate-600 font-mono select-none">
                    {content.split('\n').map((_, i) => <div key={i} className="leading-relaxed h-5">{i + 1}</div>)}
                </div>
                <div className="overflow-x-auto pl-8 w-full">
                    <pre className="!bg-transparent !p-4 !m-0 outline-none w-full min-w-max">
                        <code 
                            className={`language-${language} !bg-transparent !p-0 text-[13px] leading-relaxed font-mono text-slate-200 block outline-none`}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => setContent(e.currentTarget.innerText)}
                            style={{ whiteSpace: 'pre' }}
                        >
                            {content}
                        </code>
                    </pre>
                </div>
            </div>

            {/* Terminal Output */}
            {terminalOutput && (
                <div className="border-t border-slate-700/50 bg-[#0f172a] animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-3 py-1 bg-[#1e293b] text-[10px] text-slate-400 border-b border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3 h-3" />
                            <span>Terminal Output</span>
                        </div>
                        <button onClick={() => setTerminalOutput(null)} className="hover:text-white">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <pre className="p-3 text-[11px] font-mono text-emerald-400/90 leading-relaxed min-w-max whitespace-pre-wrap">
                            {terminalOutput}
                        </pre>
                    </div>
                </div>
            )}
            
            {/* Status Bar */}
            {!terminalOutput && (
                <div className="px-3 py-1 bg-[#1e293b] border-t border-slate-700/50 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>UTF-8</span>
                    <span>Ln {content.split('\n').length}, Col 1</span>
                </div>
            )}
        </div>
    );
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({ markdown, onApplyCode }) => {
  
  // Extract Achievement
  const { content, achievement } = useMemo(() => {
    // Regex updated to match non-emoji header
    const achievementRegex = /## Achievement Unlocked\s*\n\*\*Badge Name\*\*: (.*)\s*\n\*\*Description\*\*: (.*)/;
    const match = markdown.match(achievementRegex);
    
    let cleanMarkdown = markdown;
    let achievementData = null;

    if (match) {
        achievementData = { name: match[1], desc: match[2] };
        // Remove the achievement block from the main text to avoid duplication
        cleanMarkdown = markdown.replace(match[0], '');
    }

    return { content: cleanMarkdown, achievement: achievementData };
  }, [markdown]);

  return (
    <div className="w-full space-y-6 pb-20">
      
      {/* Gamification 3D Banner */}
      {achievement && (
        <div className="relative group overflow-hidden bg-gradient-to-r from-amber-900/40 via-yellow-900/20 to-amber-900/40 border border-amber-500/50 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 animate-in slide-in-from-top-4 duration-700 shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_-10px_rgba(245,158,11,0.5)] transition-shadow">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative transform transition-transform group-hover:scale-110 duration-300">
                <div className="absolute inset-0 bg-amber-400 blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-amber-300 to-yellow-600 p-4 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-amber-200/50 ring-4 ring-amber-500/20">
                    <Trophy className="w-10 h-10 text-white drop-shadow-md" />
                </div>
            </div>
            <div className="text-center sm:text-left space-y-1 relative z-10">
                <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                    <Sparkles className="w-3 h-3" /> Achievement Unlocked
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{achievement.name}</h3>
                <p className="text-amber-200/90 text-sm font-medium">{achievement.desc}</p>
            </div>
        </div>
      )}

      {/* Main Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-full">
        <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Deep Debug Analysis</h2>
        </div>
        
        <div className="p-4 sm:p-6 prose prose-invert prose-slate max-w-none prose-headings:scroll-mt-20 break-words overflow-hidden">
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const isMultiLine = !inline && match;

                if (language === 'mermaid') {
                    return <MermaidBlock code={String(children).replace(/\n$/, '')} />;
                }
                
                return isMultiLine ? (
                   <InteractiveCodeBlock language={language} onApply={onApplyCode}>{children}</InteractiveCodeBlock>
                ) : (
                  <code {...props} className={`${className} bg-slate-800/80 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-sm border border-slate-700/50 shadow-sm break-all`}>
                    {children}
                  </code>
                );
              },
              h1: ({children}) => <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 mb-8 pb-4 border-b border-slate-800 break-words">{children}</h1>,
              h2: ({children}) => {
                  const text = String(children);
                  let icon = <Terminal className="w-5 h-5 text-indigo-400 flex-shrink-0" />;
                  let colorClass = "text-slate-100";
                  
                  if (text.includes("Time Machine")) {
                      // Use History icon instead of emoji
                      icon = <History className="w-5 h-5 text-amber-400 flex-shrink-0" />;
                      colorClass = "text-amber-300";
                  } else if (text.includes("Alternative")) {
                       // Use GitBranch icon instead of emoji
                       icon = <GitBranch className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
                       colorClass = "text-emerald-300";
                  }
                  
                  return <h2 className={`text-xl font-bold ${colorClass} mt-12 mb-6 flex items-center gap-2 pb-2 border-b border-slate-800/50 break-words`}>{icon}{children}</h2>
              },
              h3: ({children}) => <h3 className="text-lg font-semibold text-indigo-200 mt-8 mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"/>{children}</h3>,
              ul: ({children}) => <ul className="list-none space-y-2 text-slate-300 my-4 ml-2">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-outside ml-6 space-y-2 text-slate-300 my-4">{children}</ol>,
              li: ({children}) => <li className="flex gap-2 items-start"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" /><span className="break-words min-w-0">{children}</span></li>,
              p: ({children}) => <p className="leading-relaxed text-slate-300 mb-4 break-words">{children}</p>,
              strong: ({children}) => <strong className="font-semibold text-white bg-white/5 px-1 rounded">{children}</strong>,
              blockquote: ({children}) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 italic text-slate-400 bg-slate-800/30 rounded-r my-6 shadow-sm">{children}</blockquote>,
              table: ({children}) => <div className="overflow-x-auto my-6 rounded-lg border border-slate-800 w-full"><table className="w-full text-left text-sm whitespace-nowrap sm:whitespace-normal">{children}</table></div>,
              thead: ({children}) => <thead className="bg-slate-800 text-slate-200">{children}</thead>,
              th: ({children}) => <th className="px-4 py-3 font-semibold">{children}</th>,
              td: ({children}) => <td className="px-4 py-3 border-t border-slate-800 text-slate-400">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;