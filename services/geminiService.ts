import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UploadedFile, ExpertiseLevel, Persona, AnalysisOptions } from "../types";

// Ensure API key is available
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const processVoiceCommand = async (audioBlob: Blob): Promise<{ type: 'text' | 'command' | 'NO_SPEECH', content: string }> => {
    try {
        if (!API_KEY) throw new Error("API Key is not configured.");

        const base64Audio = await blobToBase64(audioBlob);

        const prompt = `
            You are the "Brain" of a coding voice assistant named "BugLens Agent".
            
            **CRITICAL ANALYSIS TASK:**
            Analyze the audio. Determine if it contains distinct human speech or just background noise/silence.
            
            **SCENARIO 1: SILENCE / NOISE / UNINTELLIGIBLE**
            - If the audio is silence, static, keyboard clicking, breathing, or background chatter NOT directed at you.
            - OUTPUT: { "type": "NO_SPEECH", "content": "" }
            
            **SCENARIO 2: COMMANDS**
            - "Agent Start" / "Start Agent" / "Wake up" / "BugLens Start"
              -> { "type": "command", "content": "AGENT_START" }

            - "Agent Stop" / "Stop Agent" / "Agent Sleep" / "Pause Agent"
              -> { "type": "command", "content": "AGENT_SLEEP" }  (Go to Standby)
            
            - "Agent Close" / "Agent Exit" / "Shut down" / "Turn off"
              -> { "type": "command", "content": "AGENT_CLOSE" }  (Turn off completely)

            - "Agent write code...", "Agent type...", "Agent type code..."
              -> { "type": "text", "content": "[Code to write]" } (Strip the trigger phrase)
            
            - "Agent clear code editor" -> { "type": "command", "content": "CLEAR_EDITOR" }
            - "Agent run deep debug", "Agent analyze" -> { "type": "command", "content": "RUN_DEBUG" }
            - "Agent run code", "Run the code" -> { "type": "command", "content": "RUN_CODE" } (Simulate Execution)
            - "Agent fix code" -> { "type": "command", "content": "FIX_CODE" }
            - "Agent change code to Python" -> { "type": "command", "content": "CHANGE_CODE:PYTHON" }
            
            **SCENARIO 3: RAW DICTATION (No "Agent" prefix)**
            - If clear speech is detected but NO "Agent" trigger:
            - Interpret as raw text to be inserted into the editor.
            - OUTPUT: { "type": "text", "content": "[Transcribed Text]" }

            **Output Format:**
            Return strictly a JSON object. No markdown.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "{}";
        try {
            const parsed = JSON.parse(text);
            if (!parsed.type) return { type: 'NO_SPEECH', content: "" };
            return parsed;
        } catch (e) {
            console.warn("Failed to parse Gemini voice JSON", text);
            return { type: 'NO_SPEECH', content: "" }; 
        }
    } catch (error: any) {
        console.error("Gemini Voice Error", error);
        return { type: 'NO_SPEECH', content: "" };
    }
};

export const quickEditCode = async (code: string, instruction: string): Promise<string> => {
    try {
        if (!API_KEY) throw new Error("API Key is not configured.");
        
        const prompt = `
            Act as a code editor engine.
            
            **Input Code:**
            ${code}
            
            **Instruction:**
            ${instruction}
            
            **Task:**
            Apply the instruction to the code.
            - If "Fix Code": Fix syntax errors, bugs, or logical issues.
            - If "Translate to X": Rewrite the code in language X.
            
            **Output:**
            Return ONLY the new code. No markdown formatting (\`\`\`), no conversation.
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        return response.text || code;
    } catch (e) {
        console.error("Quick Edit Error", e);
        return code;
    }
};

export const runCodeSimulation = async (input: string, contextType: 'code' | 'command' = 'code', language?: string): Promise<string> => {
    try {
        if (!API_KEY) throw new Error("API Key is not configured.");

        const langInstruction = language 
            ? `\n**Runtime Environment:** Simulate execution for ${language}.` 
            : '';

        const prompt = `
            Act as a high-fidelity Linux Terminal Emulator with Python, Node.js, C++, Go, Rust, Java, and standard utilities installed.
            
            **Input Type:** ${contextType === 'code' ? 'Source Code Execution' : 'Shell Command'}
            ${langInstruction}
            
            **Input:**
            ${input}

            **Instructions:**
            1. **If Input is Source Code**: Simulate executing it (e.g., \`python3 script.py\`, \`node index.js\`, \`go run main.go\`). Output ONLY the stdout/stderr.
               - Assume all standard libraries are installed.
               - If the code uses popular 3rd party libs (pandas, numpy, react, etc.), ASSUME they are installed and working.
            
            2. **If Input is a Shell Command** (e.g., \`pip install\`, \`npm install\`, \`ls\`, \`git status\`):
               - Simulate the realistic output of that command.
               - For \`pip install X\`: Show "Collecting X...", "Downloading...", "Installing collected packages...", "Successfully installed X-1.0.0".
               - For \`npm install\`: Show "added 5 packages, and audited 12 packages in 2s".
               - For \`ls\`: List fictional but realistic project files (src, package.json, main.py).
            
            3. **General Rules**:
               - DO NOT output Markdown (no \`\`\` code blocks).
               - DO NOT provide conversational text ("Here is the output").
               - Output RAW text exactly as it would appear in a terminal window.
               - If an error occurs (syntax error), show the specific compiler/interpreter error message.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return response.text || "";
    } catch (error: any) {
        return `bash: system_error: ${error.message || "Unknown error"}`;
    }
};

export const analyzeDebugContext = async (
  files: UploadedFile[],
  expertiseLevel: ExpertiseLevel,
  persona: Persona,
  options: AnalysisOptions
): Promise<string> => {
  try {
    if (!API_KEY) throw new Error("API Key is not configured.");

    const parts: any[] = [];

    // Persona Logic
    let personaInstruction = "";
    switch (persona) {
        case 'Pirate': personaInstruction = "Speak like a seasoned pirate captain debugging a ship's code. Use nautical terms. Refer to bugs as 'leaks' or 'scurvy'. Address the user as 'Matey'."; break;
        case 'Shakespeare': personaInstruction = "Speak in Shakespearean English, dramatic and poetic. Refer to errors as tragedies. Address the user as 'Thou'."; break;
        case '10x Engineer': personaInstruction = "Be extremely concise, technical, slightly arrogant but correct. Use slang like 'LGTM', 'nit', 'O(n!)'. Address the user as 'Junior'."; break;
        case 'Constructive Coach': personaInstruction = "Be very encouraging, use analogies, and focus on growth mindset. Address the user as 'Champ'."; break;
        case 'Cyberpunk': personaInstruction = "Use futuristic slang, talk about 'the grid', 'netrunners', 'daemons', and 'glitches'. Address the user as 'Runner'."; break;
        default: personaInstruction = "You are a world-class Senior Software Engineer and Debugging Expert. Speak directly to the user."; break;
    }

    // Construct the text prompt
    let promptText = `
      ${personaInstruction}
      
      Perform a "Deep Debug" on the provided multimodal context (code, logs, screenshots, audio, video).
      Interpret all inputs together as a single debugging session.
      
      **Target Audience Expertise Level:** ${expertiseLevel}
      (Adjust your tone, terminology, and depth of explanation specifically for a ${expertiseLevel} developer).
      
      **IMPORTANT**: Speak directly to "You" (the user). Do not use third-person references like "The User".

      **Analysis Requirements (Follow Strictly):**
      
      1. **Context & Intent**: Briefly explain what your code is trying to do based on the files.
      2. **Root Cause Analysis**: precise explanation of the error.
      3. **Exact Fix**: Corrected code with diffs.
      4. **Complexity Analysis**: Provide Time & Space Big O complexity. 
         *IMPORTANT*: Use code ticks for Big O (e.g., \`O(N)\`). **DO NOT** use LaTeX formatting (no $ symbols).
      5. **Improved Version**: Refactored for best practices (Readability, Performance).
    `;

    if (options.securityCheck) {
        promptText += `\n6. **Security Audit**: Highlight any security vulnerabilities (XSS, Injection, etc.) and how you can harden the code.`;
    }

    // Map 'predictBugs' option to the "Error Time Machine" feature
    if (options.predictBugs) {
        promptText += `\n7. **Error Time Machine**: Simulate a scenario 3 months from now if this bug is NOT fixed. Describe the catastrophic failure or technical debt accumulation in a dramatic way. 
        Header: ## Error Time Machine`;
    }

    // Always include Alternatives for "Mind-Blowing" depth
    promptText += `\n8. **Alternative Scenarios**: Briefly list 2 alternative approaches (e.g. Quick Fix vs Architecture Change) with trade-offs. 
    Header: ## Alternative Scenarios`;

    if (options.generateTests) {
        promptText += `\n9. **Auto-Generated Tests**: Provide a code block with Unit Tests covering the fix.`;
    }

    if (options.visualizeDiagram) {
        promptText += `\n10. **Visual Explanation**: Generate a Mermaid.js diagram code block (using \`\`\`mermaid) to visualize the flow, state changes, or dependency map of the issue. Use the 'graph TD' or 'sequenceDiagram' type.`;
    }

    // Gamification - Always on for the "Wow" factor
    promptText += `\n11. **Gamification**: Based on the nastiness or silliness of the bug, award a creative "Achievement Badge". 
    Format strictly as: 
    ## Achievement Unlocked
    **Badge Name**: [Creative Name]
    **Description**: [Fun reason why you earned it]`;

    promptText += `\n\nFormat the output in clean, readable Markdown. Use clear headings.`;

    if (files.length > 0) {
      promptText += `\n\nI have attached ${files.length} file(s) for context. If audio/video is present, transcribe relevant technical details to find the bug.`;
    }

    parts.push({ text: promptText });

    // Process files
    for (const uploadedFile of files) {
      if (['image', 'audio', 'video'].includes(uploadedFile.type)) {
        const base64Data = uploadedFile.base64 || await readFileAsBase64(uploadedFile.file);
        parts.push({
          inlineData: {
            mimeType: uploadedFile.file.type,
            data: base64Data
          }
        });
      } else {
        // Text/Log files
        const textContent = uploadedFile.content || await uploadedFile.file.text();
        parts.push({
          text: `\n--- START FILE: ${uploadedFile.file.name} ---\n${textContent}\n--- END FILE ---\n`
        });
      }
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ]
    });

    return response.text || "No response generated.";

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // robust error message extraction
    let errorMessage = "Failed to analyze debug context.";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || (error as any).statusText || JSON.stringify(error);
    }
    
    throw new Error(errorMessage);
  }
};