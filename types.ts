export type ExpertiseLevel = 'Beginner' | 'Intermediate' | 'Senior';

export type Persona = 'Standard' | 'Pirate' | 'Shakespeare' | '10x Engineer' | 'Constructive Coach' | 'Cyberpunk';

export interface UploadedFile {
  id: string;
  file: File;
  type: 'image' | 'text' | 'audio' | 'video';
  previewUrl?: string; 
  content?: string; 
  base64?: string; 
}

export interface AnalysisResponse {
  markdown: string;
}

export interface AnalysisOptions {
  generateTests: boolean;
  visualizeDiagram: boolean;
  securityCheck: boolean;
  predictBugs: boolean;
}

export interface DebugState {
  files: UploadedFile[];
  expertiseLevel: ExpertiseLevel;
  persona: Persona;
  options: AnalysisOptions;
  isAnalyzing: boolean;
  result: AnalysisResponse | null;
  error: string | null;
}