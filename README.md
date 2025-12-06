# BugLens

> A powerful AI-powered debugging assistant that analyzes code, screenshots, logs, and error messages to provide intelligent solutions tailored to your expertise level.

![BugLens Hero](./screenshots/hero.png)

## Overview

BugLens leverages Google's Gemini 2.5 Flash AI to transform debugging from a frustrating trial-and-error process into an intelligent, guided experience. Upload error screenshots, paste code snippets, or provide log files, and get instant root cause analysis, step-by-step fixes, and explanations matched to your skill level.

## Key Features

### Multi-Modal Analysis

- **Screenshot Analysis**: Upload error screenshots and get visual debugging
- **Code Upload**: Analyze code files directly
- **Log File Processing**: Parse and interpret complex log files
- **Voice Commands**: Control BugLens with voice commands for hands-free debugging

![Multi-Modal Upload](./screenshots/file-upload.png)

### Smart Analysis Options

![Analysis Options](./screenshots/analysis-options.png)

- **Root Cause Analysis**: Deep dive into the underlying causes of bugs
- **Test Generation**: Automatically generate unit tests for your code
- **Diagram Visualization**: Create Mermaid diagrams to visualize code flow and architecture
- **Security Check**: Identify potential security vulnerabilities
- **Bug Prediction**: Predict potential issues before they occur

### Integrated Code Editor

![Code Editor](./screenshots/code-editor.png)

**Features:**

- **Monaco Editor**: Industry-standard code editor with syntax highlighting
- **9 Languages Supported**: Python, JavaScript, TypeScript, C++, Java, Go, Rust, PHP, Ruby
- **Code Simulation**: Run code simulations directly in the browser
- **Quick Fix**: AI-powered instant code corrections
- **Real-time Editing**: Edit and iterate on code suggestions

### Persona System

Customize how BugLens communicates with you:

![Persona Selection](./screenshots/persona-selection.png)

- **Pro** : Professional & Direct
- **Coach** : Encouraging & Helpful
- **10x Dev** : Terse & Technical
- **Runner** : Futuristic Cyberpunk Slang
- **Pirate** : Nautical Nonsense
- **Bard** : Shakespearean Poetry

### Expertise Levels

Responses tailored to your skill level:

- **Beginner**: Detailed explanations with learning resources
- **Intermediate**: Balanced approach with best practices
- **Senior**: Concise, technical insights

![Expertise Level](./screenshots/expertise-level.png)

### Voice Agent

![Voice Agent](./screenshots/voice-agent.png)

Control BugLens hands-free with natural voice commands:

**Commands:**

- `"Agent Start"` - Activate voice control
- `"Agent write code..."` - Dictate code
- `"Agent run deep debug"` - Run analysis
- `"Agent run code"` - Execute code simulation
- `"Agent fix code"` - Quick fix
- `"Agent clear code editor"` - Clear editor
- `"Agent sleep"` - Standby mode
- `"Agent close"` - Deactivate

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/buglens.git
cd buglens
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure API Key**

Create a `.env` file in the root directory:

```env
API_KEY=your_gemini_api_key_here
```

4. **Start the development server**

```bash
npm run dev
```

5. **Open in browser**

```
http://localhost:5173
```

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **AI Model**: Google Gemini 2.5 Flash
- **Code Editor**: Monaco Editor
- **Markdown Rendering**: react-markdown
- **Diagrams**: Mermaid
- **Icons**: Lucide React
- **Styling**: Custom CSS with Tailwind-inspired utility classes

## Project Structure

```
BugLens/
├── App.tsx                 # Main application component
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── types.ts                # TypeScript type definitions
├── metadata.json           # Application metadata
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── components/
│   ├── AnalysisResult.tsx  # Results display component
│   ├── FileUpload.tsx      # File upload component
│   └── Icons.tsx           # Icon components
└── services/
    └── geminiService.ts    # Gemini AI integration
```

## Usage Examples

### Example 1: Screenshot Analysis

![Screenshot Analysis Example](./screenshots/example-screenshot.png)

1. Upload an error screenshot
2. Select your expertise level
3. Choose analysis options
4. Get instant debugging insights

### Example 2: Code Debugging

![Code Debugging Example](./screenshots/example-code.png)

1. Paste your problematic code
2. Add context files if needed
3. Select "Root Cause Analysis"
4. Receive detailed explanation and fixes

### Example 3: Voice-Controlled Debugging

![Voice Control Example](./screenshots/example-voice.png)

1. Activate voice agent
2. Say "Agent analyze this code"
3. Get verbal and visual feedback
4. Iterate with voice commands

## Configuration

### Analysis Options

Customize analysis behavior in `types.ts`:

```typescript
export interface AnalysisOptions {
  generateTests: boolean; // Generate unit tests
  visualizeDiagram: boolean; // Create Mermaid diagrams
  securityCheck: boolean; // Run security analysis
  predictBugs: boolean; // Predict potential bugs
}
```

### Supported Languages

Add or modify languages in `App.tsx`:

```typescript
const LANGUAGES = {
  python: { name: "Python", ext: "py", cmd: "python3", monaco: "python" },
  javascript: {
    name: "JavaScript",
    ext: "js",
    cmd: "node",
    monaco: "javascript",
  },
  // ... more languages
};
```

## Security & Privacy

- **Local Processing**: File processing happens in your browser
- **API Communication**: Only analysis requests are sent to Gemini
- **No Data Storage**: Files are not stored on external servers
- **API Key Security**: Store your API key in `.env` (never commit it)

## Use Cases

- **Bug Investigation**: Quickly diagnose runtime errors
- **Learning**: Understand code issues at your level
- **Code Review**: Get AI-powered code insights
- **Test Generation**: Automatically create test cases
- **Security Audit**: Identify vulnerabilities
- **Architecture Planning**: Visualize code structure

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

**Made by Nour Ali Ahmed**

![BugLens Footer](./screenshots/footer.png)

[⬆ Back to Top](#buglens)

</div>
