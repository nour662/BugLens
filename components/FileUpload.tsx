import React, { useCallback, useState, useRef, useEffect } from 'react';
import { UploadedFile } from '../types';
import { Upload, FileCode, ImageIcon, X, Video, Mic, StopCircle, Sparkles, Radio, Mic2 } from './Icons';
import { processVoiceCommand } from '../services/geminiService';

interface FileUploadProps {
  files: UploadedFile[];
  onFilesAdded: (files: File[]) => void;
  onFileRemove: (id: string) => void;
  onVoiceCommand?: (command: string) => void;
  onSmartDictation?: (result: { type: 'text' | 'command' | 'NO_SPEECH', content: string }) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ files, onFilesAdded, onFileRemove, onVoiceCommand, onSmartDictation }) => {
  // Modes: 'standby' (Listening for Start), 'active' (Processing Commands), 'voice-note' (Manual), or null (Idle)
  const [mode, setMode] = useState<'standby' | 'active' | 'voice-note' | null>(null);
  const modeRef = useRef<'standby' | 'active' | 'voice-note' | null>(null); // Sync ref
  
  const [micVolume, setMicVolume] = useState(0); 
  const [statusText, setStatusText] = useState(''); 
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Audio Context for Visualizer & VAD
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // VAD (Voice Activity Detection) Refs
  const isSpeakingRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const SILENCE_THRESHOLD = 1500; // ms of silence to trigger stop
  const VOLUME_THRESHOLD = 20; 
  
  // Loop Control
  const shouldLoopRef = useRef(false);

  const setModeSafe = (newMode: 'standby' | 'active' | 'voice-note' | null) => {
      setMode(newMode);
      modeRef.current = newMode;
  };

  const addDebugLog = (msg: string) => {
      setDebugLog(prev => [`[${new Date().toLocaleTimeString().split(' ')[0]}] ${msg}`, ...prev].slice(0, 8));
  };

  const playSound = (type: 'beep' | 'success' | 'start') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        if (type === 'start') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'beep') {
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else {
            // Success
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.linearRampToValueAtTime(659.25, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch(e){}
  };

  // --- Helper: Robust Stream Acquisition ---
  const getAudioStream = async (): Promise<MediaStream> => {
      if (streamRef.current && streamRef.current.active) {
          return streamRef.current;
      }
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request Timed Out")), 10000)
      );
      try {
          const stream = await Promise.race([streamPromise, timeoutPromise]) as MediaStream;
          streamRef.current = stream;
          return stream;
      } catch (e) {
          throw e;
      }
  };

  // --- Visualizer & VAD Setup ---
  const setupVisualizer = (stream: MediaStream) => {
      if (visualizerFrameRef.current) cancelAnimationFrame(visualizerFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      isSpeakingRef.current = false;
      silenceStartRef.current = null;

      const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const avg = sum / bufferLength;
          const vol = (avg / 128) * 100;
          setMicVolume(v => v * 0.8 + vol * 0.2); 

          // VAD Logic - Active for both Standby and Active modes
          if ((modeRef.current === 'standby' || modeRef.current === 'active') && shouldLoopRef.current) {
              if (vol > VOLUME_THRESHOLD) {
                  if (!isSpeakingRef.current) {
                      isSpeakingRef.current = true;
                      setStatusText(modeRef.current === 'active' ? 'Hearing Command...' : 'Hearing Voice...');
                  }
                  silenceStartRef.current = null;
              } else if (isSpeakingRef.current) {
                  if (silenceStartRef.current === null) {
                      silenceStartRef.current = Date.now();
                  } else if (Date.now() - silenceStartRef.current > SILENCE_THRESHOLD) {
                      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                          addDebugLog("Processing Audio...");
                          mediaRecorderRef.current.stop();
                      }
                      return; 
                  }
              }
          }
          visualizerFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
  };

  // --- Core Processing Loop ---

  const stopEverything = () => {
      shouldLoopRef.current = false;
      setModeSafe(null);
      
      if (visualizerFrameRef.current) cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
      }
      
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
      
      setMicVolume(0);
      setStatusText('');
  };

  const startAudioSession = async (sessionMode: 'standby' | 'active' | 'voice-note') => {
      try {
          setModeSafe(sessionMode);
          if (sessionMode !== 'voice-note') shouldLoopRef.current = true;
          
          if (sessionMode === 'voice-note') {
               setStatusText('Recording Note...');
               playSound('start');
          } else if (sessionMode === 'active') {
               setStatusText('Agent Active');
               playSound('start'); // Distinct active sound
          } else {
               setStatusText('Standby (Say Start)');
          }

          let stream: MediaStream;
          try {
             stream = await getAudioStream();
          } catch (e) {
             addDebugLog("Stream Failed");
             setModeSafe(null);
             return;
          }

          setupVisualizer(stream);

          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          chunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = async () => {
               const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
               
               if (sessionMode === 'voice-note') {
                   // Manual Mode
                   const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                   onFilesAdded([file]);
                   playSound('success');
                   setModeSafe(null);
                   stopEverything();
               } else {
                   // LOOP MODE (Standby or Active)
                   if (!shouldLoopRef.current) return;

                   try {
                       if (blob.size > 2000) { 
                           const result = await processVoiceCommand(blob);
                           
                           // GLOBAL COMMANDS (Work in both modes)
                           if (result.content === 'AGENT_CLOSE' || result.content === 'AGENT_EXIT') {
                               addDebugLog("Agent Closed.");
                               stopEverything();
                               if (onSmartDictation) onSmartDictation(result); 
                               return; 
                           }

                           // STANDBY LOGIC
                           if (modeRef.current === 'standby') {
                               if (result.content === 'AGENT_START') {
                                   addDebugLog("Agent Activated!");
                                   // Switch to Active Mode
                                   setTimeout(() => startAudioSession('active'), 500);
                                   return;
                               } else {
                                   addDebugLog(`Ignored: ${result.content}`);
                                   // Ignore command, just loop back
                               }
                           } 
                           // ACTIVE LOGIC
                           else if (modeRef.current === 'active') {
                               if (result.content === 'AGENT_SLEEP' || result.content === 'STOP_AGENT') {
                                   addDebugLog("Agent Standby...");
                                   playSound('beep');
                                   // Switch to Standby
                                   setTimeout(() => startAudioSession('standby'), 500);
                                   return;
                               }

                               if (result.type === 'NO_SPEECH') {
                                   addDebugLog("Silence...");
                               } else {
                                   addDebugLog(`Cmd: ${result.content}`);
                                   if (onSmartDictation) onSmartDictation(result);
                                   playSound('success');
                               }
                           }
                       }
                   } catch(e) {
                       addDebugLog("Error Processing");
                   }
                   
                   // Restart loop if still allowed
                   setTimeout(() => {
                       if (shouldLoopRef.current) { 
                           // Keep current mode
                           startAudioSession(modeRef.current as 'standby' | 'active');
                       }
                   }, 1000); 
               }
          };

          mediaRecorder.start();

      } catch (err) {
          console.error("Voice init error", err);
          stopEverything();
      }
  };

  useEffect(() => {
      return () => stopEverything();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(Array.from(e.dataTransfer.files));
    }
  }, [onFilesAdded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-4">
      {/* Voice Status Panel */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center justify-center gap-3 relative overflow-hidden transition-all">
         
         {/* Audio Visualizer Background */}
         {mode && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                 <div className="flex items-end gap-1 h-12">
                     {[...Array(12)].map((_, i) => (
                         <div 
                           key={i} 
                           className="w-1.5 bg-indigo-500 rounded-t transition-all duration-75"
                           style={{ 
                               height: `${Math.max(10, micVolume * (Math.random() + 0.5))}%`,
                               opacity: 0.3 + (micVolume / 150)
                           }} 
                         />
                     ))}
                 </div>
             </div>
         )}

         {/* Status Text */}
         <div className="text-xs font-mono text-indigo-300 relative z-10 h-4">
             {statusText || "Voice Assistant Offline"}
         </div>

         {/* Buttons */}
         <div className="flex items-center gap-4 relative z-10">
             <button
               onClick={() => {
                   if (mode === 'standby' || mode === 'active') stopEverything();
                   else startAudioSession('standby');
               }}
               className={`p-3 rounded-full border transition-all ${
                   (mode === 'standby' || mode === 'active') 
                   ? 'bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' 
                   : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400'
               }`}
               title="Toggle Agent"
             >
                 {(mode === 'standby' || mode === 'active') ? <StopCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
             </button>

             <button
               onClick={() => {
                   if (mode === 'voice-note') stopEverything();
                   else startAudioSession('voice-note');
               }}
               className={`p-3 rounded-full border transition-all ${
                   mode === 'voice-note'
                   ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                   : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400'
               }`}
               title="Record Voice Note"
             >
                 <Mic2 className="w-5 h-5" />
             </button>
         </div>

         {/* Mini Debug Log */}
         {debugLog.length > 0 && (
             <div className="w-full h-12 overflow-y-auto text-[9px] font-mono text-slate-500 bg-black/20 p-2 rounded border border-white/5 custom-scrollbar">
                 {debugLog.map((log, i) => <div key={i}>{log}</div>)}
             </div>
         )}
      </div>

      {/* Upload Zone */}
      <div 
        onDrop={onDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/50 rounded-xl p-6 transition-all group cursor-pointer"
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          id="file-upload-input"
          onChange={handleManualUpload}
        />
        <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Click to upload or drag files</p>
        </label>
      </div>

      {/* File List */}
      <div className="space-y-2">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 group">
            <div className="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center shrink-0 overflow-hidden">
                {file.type === 'image' && file.previewUrl ? (
                    <img src={file.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : file.type === 'video' ? (
                    <Video className="w-4 h-4 text-pink-400" />
                ) : file.type === 'audio' ? (
                    <Mic className="w-4 h-4 text-emerald-400" />
                ) : (
                    <FileCode className="w-4 h-4 text-blue-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 font-medium truncate">{file.file.name}</p>
                <p className="text-[10px] text-slate-500">{(file.file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button 
                onClick={() => onFileRemove(file.id)}
                className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileUpload;