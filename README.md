# EchoAssist: AI Meeting Assistant

A powerful, **100% undetectable** AI meeting assistant. This Electron desktop app provides real-time AI assistance during meetings, interviews, and calls while remaining completely invisible to screen share and recordings.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F.svg)
![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-10a37f.svg)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude%203.5-cc7722.svg)
![OpenRouter](https://img.shields.io/badge/OpenRouter-100%2B%20Models-6366f1.svg)

## Features

### Core Capabilities

- **🎤 Real-time Speech Transcription** - Live, accurate offline transcription with Vosk (see words as you speak!)
- **✨ AI Transcript Correction** - Automatically fixes misheard words using AI context (great for accents!)
- **🤖 AI-Powered Assistance** - Context-aware responses using Google Gemini API
- **📸 Screenshot Analysis** - Analyze screen content for coding problems, presentations, or documents
- **💡 "What Should I Say?"** - Get intelligent response suggestions based on conversation context
- **📝 Meeting Notes Generation** - Automatic meeting summaries, action items, and key points
- **📊 Conversation Insights** - Real-time analysis of discussion topics and decisions
- **🔒 100% Private & Undetectable** - Invisible in screen shares, recordings, and participant lists

### Stealth Features

- **Transparent overlay window** with glass-morphism UI
- **Always-on-top** but never captured in screenshots or screen shares
- **Emergency hide button** (Ctrl+Alt+Shift+X)
- **Opacity control** for maximum invisibility
- **Frameless, taskbar-hidden** window
- **Smart positioning** (corners, edges, or center)
- **Dev Mode toggle** - In development mode, a clickable pill lets you switch between:
  - **DEV** (orange) - Content protection OFF, visible in screenshots for debugging
  - **STEALTH** (green) - Content protection ON, hidden from screenshots

### AI Features (Multi-Provider Support)

- **Multiple AI Providers:**
  - ✨ **Google Gemini** - Gemini 2.5 Flash Lite (default)
  - 🤖 **OpenAI GPT-4o** - GPT-4o for vision, GPT-4o-mini for text
  - 🧠 **Anthropic Claude** - Claude 3.5 Sonnet for vision, Claude 3 Haiku for text
  - 🌐 **OpenRouter** - Access 100+ models (GPT-4, Claude, Llama, Mistral, etc.) via unified API
- **Runtime Provider Switching** - Change AI providers on-the-fly via dropdown
- **Customizable Models** - Select specific models for each provider in Settings:
  - Vision models for screenshot analysis
  - Text models for quick responses
- **Provider-Optimized Prompts** - Each provider uses tailored prompts for best results
- **Intelligent rate limiting** (provider-specific limits)
- **Exponential backoff** for failed requests
- **Automatic fallback** - If one provider fails, optionally fall back to another
- **Conversation context tracking** (up to 20 messages)
- **Multiple AI modes:**
  - Screenshot analysis with vision AI
  - Question answering
  - Response suggestions
  - Meeting notes generation
  - Follow-up email drafting
  - Conversation insights

## Installation

### Prerequisites

- **Node.js** 16+ (Download from [nodejs.org](https://nodejs.org/))
- **Python 3.8+** (Download from [python.org](https://www.python.org/))
- **Python packages**: `vosk`, `sounddevice`, `requests` (see [SETUP-VOSK.md](SETUP-VOSK.md))
- **At least one AI API Key** (choose one or more):
  - **Google Gemini** (Free from [aistudio.google.com](https://aistudio.google.com/))
  - **OpenAI** (From [platform.openai.com](https://platform.openai.com/))
  - **Anthropic** (From [console.anthropic.com](https://console.anthropic.com/))
  - **OpenRouter** (From [openrouter.ai](https://openrouter.ai/) - access 100+ models with one key!)
- **Microphone** for voice transcription
- **Windows/Mac/Linux** supported

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/echo-assist.git
   cd echo-assist
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies for Vosk**
   ```bash
   pip install vosk sounddevice requests
   ```

   See [SETUP-VOSK.md](SETUP-VOSK.md) for detailed Vosk setup and troubleshooting.

4. **Configure your API keys**
   - Open `.env` file
   - Add at least one API key (you can use multiple):
     ```
     # Google Gemini (default provider)
     GEMINI_API_KEY=your_gemini_api_key_here

     # OpenAI GPT-4 (optional)
     OPENAI_API_KEY=your_openai_api_key_here

     # Anthropic Claude (optional)
     ANTHROPIC_API_KEY=your_anthropic_api_key_here

     # OpenRouter - access 100+ models with one key! (optional)
     OPENROUTER_API_KEY=your_openrouter_api_key_here

     # Default provider: gemini, openai, anthropic, or openrouter
     DEFAULT_AI_PROVIDER=gemini
     ```

5. **Run the application**
   ```bash
   npm start
   ```

6. **First run - Model setup**
   - Choose your Vosk model size in Settings:
     - **Small** (~50MB) - Fast but less accurate
     - **Medium** (~500MB) - Good balance (recommended)
     - **Large** (~1.8GB) - Most accurate
   - In development mode, models are extracted from local `models/` folder
   - In production, models are downloaded automatically on first use
   - See real-time transcription as you speak!

## Usage

### Getting Started

1. **Launch the app** - A transparent overlay window will appear
2. **Grant microphone permission** when prompted (first time only)
3. **Position the window** - Use arrow keys with Ctrl+Alt+Shift to move it
4. **Start voice recognition** - Click the microphone button or press Ctrl+Alt+Shift+V

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Shift+V` | Toggle voice recognition |
| `Ctrl+Alt+Shift+S` | Take screenshot |
| `Ctrl+Alt+Shift+A` | Analyze with AI |
| `Ctrl+Alt+Shift+X` | Emergency hide |
| `Ctrl+Alt+Shift+H` | Toggle stealth mode (opacity) |
| `Ctrl+Alt+Shift+Arrow Keys` | Move window position |

### Feature Buttons

#### 🎤 Voice Toggle
- **Click** to start/stop continuous voice transcription
- Transcribed text appears in the chat
- Automatically added to AI conversation context

#### 📸 Screenshot
- **Click** to capture screen (window will hide first)
- Up to 3 screenshots stored for analysis
- Counter shows number of captured screenshots

#### 🤖 Ask AI
- **Click** to analyze screenshots with conversation context
- Provides code solutions, explanations, and insights
- Respects Gemini API rate limits (10/minute)

#### 💡 What Should I Say?
- **Click** for intelligent response suggestions
- Based on recent conversation history
- Provides 2-3 professional response options

#### 📝 Meeting Notes
- **Click** to generate comprehensive meeting notes
- Includes summary, key points, and action items
- Formatted for easy copying

#### 📊 Insights
- **Click** for conversation analysis
- Shows main topics, decisions, and follow-up suggestions
- Great for understanding meeting flow

#### 🗑️ Clear
- **Click** to clear screenshots and chat history
- Starts fresh conversation context

#### ❌ Emergency Hide
- **Click** or press Ctrl+Alt+Shift+X
- Instantly hides the window
- Use when you need to disappear fast

### Best Practices

1. **Start voice recognition before the meeting** for continuous transcription
2. **Use screenshots sparingly** - only when you need visual analysis (API rate limits)
3. **Generate notes at the end** - more context = better summaries
4. **Position strategically** - bottom corner works well for most meetings
5. **Test emergency hide** before important meetings

## Technical Details

### Architecture

```
┌─────────────────────────────────────────┐
│           Main Process (Node.js)        │
│  - Window Management                    │
│  - Gemini API Service (Rate Limited)    │
│  - Screenshot Capture                   │
│  - IPC Handlers                         │
│  - Conversation History                 │
└─────────────────────────────────────────┘
                    │
                    │ IPC Communication
                    │
┌─────────────────────────────────────────┐
│        Renderer Process (Chromium)      │
│  - UI Rendering (Glass-morphism)        │
│  - Web Speech API (INSTANT!)            │
│  - Chat Interface                       │
│  - Button Controls                      │
└─────────────────────────────────────────┘
                    │
                    │ Native Browser API
                    │
┌─────────────────────────────────────────┐
│      Chrome's Built-in Speech Engine    │
│  - Real-time Speech Recognition         │
│  - No Model Loading Required            │
│  - Continuous + Interim Results         │
│  - Auto-reconnect on Errors             │
└─────────────────────────────────────────┘
```

### Technologies Used

- **Electron 28.0.0** - Cross-platform desktop framework
- **Google Gemini 1.5 Flash** - AI language model with vision AND audio transcription
- **MediaRecorder API** - Browser-native audio recording
- **screenshot-desktop** - Cross-platform screenshot library

### Speech Recognition Pipeline

1. **Record**: MediaRecorder captures 5-second audio chunks
2. **Convert**: Audio blob converted to base64 encoding
3. **Send**: Base64 audio sent to Gemini API via IPC
4. **Transcribe**: Gemini's built-in audio transcription processes it
5. **Receive**: Transcribed text returned in ~1-2 seconds
6. **Filter**: Simple noise filtering removes filler words
7. **Display**: Clean transcription added to chat and AI context

**Benefits:**
- ✅ **INSTANT** - No model loading like Whisper
- ✅ **Reliable** - No network errors like Web Speech API in Electron
- ✅ **Integrated** - Uses your existing Gemini API key
- ✅ **Accurate** - Google's enterprise-grade transcription
- ✅ **Simple** - No complex dependencies or workers
- ✅ **Offline-capable** - Works without special network config

### Gemini API Service

- **Model**: gemini-1.5-flash (supports vision + audio transcription)
- **Rate Limiting**: 10 requests/minute (6-second minimum interval)
- **Daily Limit**: 4M tokens (~1M words)
- **Retry Logic**: Exponential backoff (2s, 4s, 8s)
- **Queue System**: Automatic request queueing
- **Token Tracking**: Rough estimation (~4 chars = 1 token)

## Configuration

### Environment Variables (.env)

```bash
# AI Provider API Keys (at least one required)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Default AI provider (gemini, openai, anthropic, or openrouter)
DEFAULT_AI_PROVIDER=openai

# Optional: Screenshot settings
MAX_SCREENSHOTS=3
SCREENSHOT_DELAY=300

# Optional: Development settings
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=4096
```

### Window Settings (main.js)

```javascript
// Window size
const windowWidth = 400;
const windowHeight = 600;

// Opacity (0.0 - 1.0)
opacity: 1.0

// Always on top
alwaysOnTop: true
```

### Speech Recognition Configuration (renderer.js)

```javascript
// Web Speech API settings - INSTANT, no model loading!
recognition.continuous = true;      // Keep listening
recognition.interimResults = true;  // Get partial results
recognition.lang = 'en-US';        // Change language (en-US, en-GB, es-ES, fr-FR, etc.)
recognition.maxAlternatives = 1;    // Number of alternatives per result
```

## Building for Production

### Build standalone application

```bash
npm run build
```

This creates installers in the `dist` folder:
- **Windows**: NSIS installer (.exe)
- **Mac**: DMG file (.dmg)
- **Linux**: AppImage (.AppImage)

### Platform-specific builds

```bash
# Windows only
npm run build -- --win

# Mac only
npm run build -- --mac

# Linux only
npm run build -- --linux
```

## Troubleshooting

### Microphone not working

1. **Check browser permissions**: Electron uses Chromium's permission system
2. **System settings**: Ensure microphone is not blocked at OS level
3. **Other apps**: Close apps that might be using the microphone
4. **Restart app**: Sometimes permissions need a fresh start

### Speech recognition not working

1. **Browser support**: Web Speech API requires Chromium-based browser (built into Electron)
2. **Check console**: Open DevTools (Ctrl+Shift+I) for error messages
3. **Internet connection**: Web Speech API requires internet (uses Google's servers)
4. **Language**: Currently set to 'en-US' - change in renderer.js if needed

### Gemini API errors

1. **API key**: Verify your key is correct in `.env`
2. **Rate limits**: Wait 6 seconds between requests (automatic)
3. **Quota**: Check daily usage at [aistudio.google.com](https://aistudio.google.com/)
4. **Network**: Ensure internet connection is stable

### Window not appearing

1. **Check if running**: Look for process in Task Manager
2. **Position**: Try Ctrl+Alt+Shift+Arrow keys to move it
3. **Opacity**: Press Ctrl+Alt+Shift+H to toggle opacity
4. **Logs**: Run with `npm run dev` to see console output

## Privacy & Ethics

### Important Disclaimer

This tool is designed for **authorized use only**:
- ✅ Personal interview preparation
- ✅ Note-taking during meetings (with permission)
- ✅ Learning and educational purposes
- ✅ Accessibility assistance
- ❌ Deceptive use in exams or tests
- ❌ Unauthorized recording of conversations
- ❌ Violating company policies or ToS
- ❌ Impersonation or fraud

**You are responsible for complying with all applicable laws, regulations, and policies.**

### Data Privacy

- **Local Processing**: Speech recognition runs entirely on your device
- **No Data Storage**: Transcriptions are not saved to disk
- **API Calls**: Only conversation text and screenshots sent to Gemini API
- **No Telemetry**: This app does not collect or transmit usage data

### Gemini API Privacy

- Google's Gemini API processes your data according to their [privacy policy](https://policies.google.com/privacy)
- Your prompts and images are sent to Google's servers
- Consider this when sharing sensitive information

## Development

### Project Structure

```
echo-assist/
├── src/
│   ├── main.js              # Electron main process
│   ├── renderer.js          # UI and audio logic
│   ├── renderer.html        # HTML structure
│   ├── styles.css           # Glass-morphism styling
│   ├── preload.js           # Context bridge (security)
│   ├── whisper-worker.js    # Speech recognition worker
│   ├── ai-service-base.js   # Base class for AI providers
│   ├── ai-service-manager.js # Multi-provider orchestrator
│   ├── gemini-service.js    # Google Gemini provider
│   ├── openai-service.js    # OpenAI GPT-4 provider
│   ├── anthropic-service.js # Anthropic Claude provider
│   ├── openrouter-service.js # OpenRouter multi-model gateway
│   ├── prompts/             # Provider-optimized prompts
│   │   ├── index.js         # Prompt module entry
│   │   ├── gemini-prompts.js
│   │   ├── openai-prompts.js
│   │   └── anthropic-prompts.js
│   └── dist/
│       └── whisper-worker.bundle.js  # Bundled worker
├── .env                     # API keys and config
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

### Adding New Features

1. **Main Process (main.js)**:
   - Add IPC handler: `ipcMain.handle('your-feature', async (event, data) => { ... })`
   - Implement logic using `geminiService` or other APIs

2. **Preload (preload.js)**:
   - Expose to renderer: `yourFeature: () => ipcRenderer.invoke('your-feature')`

3. **Renderer (renderer.js)**:
   - Add UI button in HTML
   - Create async function
   - Call `window.electronAPI.yourFeature()`
   - Add event listener

4. **Styles (styles.css)**:
   - Add button styling
   - Follow glass-morphism theme

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- **Built with**: Electron, Google Gemini, OpenAI, Anthropic Claude
- **AI Model**: Google Gemini 1.5 Flash (text + vision + audio)
- **Framework**: Electron

---

## Development Roadmap

For detailed task checklists, wireframes, and technical specifications, see **[CHECKLIST.md](CHECKLIST.md)**.

### Planned Phases

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 5 | Screen Region Selection | Implemented | Select specific windows or regions for focused screen capture |
| 6 | UI/UX Overhaul | In Progress | Modular panel system with floating control bar and chrome-less transcript window |

### Phase 5: Screen Region Selection
Focus screen captures on specific windows (Teams, Zoom, Meet) or custom regions for better AI analysis, improved privacy, and faster processing.

**Implemented features:**
- Draw Region overlay (fullscreen transparent canvas with marching ants)
- Window Picker modal with search/filter and meeting app detection
- Capture mode badge on screenshot button (dimensions or window name)
- `Ctrl+Alt+Shift+R` shortcut for region selection
- Post-capture cropping via `nativeImage.crop()` with DPI/HiDPI support
- Persistent settings via `electron-store` (mode, region bounds, window title)
- Window re-detection on each capture (follows moved windows)
- Visual feedback: mode-specific border flash, window-not-found notifications
- Edge case handling: multi-monitor clamping, minimized windows, macOS permissions

### Phase 6: UI/UX Overhaul
Transform the interface into a modular system:
- **Floating Control Bar** - Separate BrowserWindow with all action buttons, fully draggable
- **Chrome-less Transcript Window** - No title bar, no traffic lights, no borders; full-height transcript with lock/unlock for position and size
- **Independent Panels** - Control bar and transcript can be moved independently
- **Inline Controls** - AI provider selector and auto-scroll indicator inline in transcript header
- **Optional Icon Labels** - Toggle text labels under icons for discoverability
- **Close Button** - Exit app from the control bar (no window controls needed)
- **Dev/Stealth Pill** - Yellow pill for DEV mode, green pill for STEALTH mode
- **Panel State Persistence** - Window positions saved/restored across sessions
- **Unified Stealth** - Both windows hide during screenshots and emergency hide

---

## Support

For issues, questions, or suggestions:
- **GitHub Issues**: [Create an issue](https://github.com/yourusername/echo-assist/issues)
- **Documentation**: See inline code comments
- **Community**: Join discussions in Issues tab

## Changelog

### Version 4.1.0 (OpenRouter Support) - CURRENT

**New Feature:**
- 🌐 **OpenRouter Integration** - Access 100+ AI models with a single API key
  - GPT-4, Claude, Llama, Mistral, Gemini, and more
  - Vision-capable models for screenshot analysis
  - Configurable model selection

**New Files:**
- `openrouter-service.js` - OpenRouter multi-model gateway implementation

---

### Version 4.0.0 (Multi-Provider AI Support)

**Major Changes:**
- 🔄 **Multi-Provider Support** - Choose between Gemini, OpenAI GPT-4o, and Anthropic Claude
- 🎛️ **Runtime Provider Switching** - Change AI providers on-the-fly via UI dropdown
- 🎯 **Provider-Optimized Prompts** - Each provider uses tailored prompts for best results
- 🔧 **Automatic Fallback** - If one provider fails, fall back to another
- 📦 **Modular Architecture** - Clean separation with base class and manager pattern

**New Files:**
- `ai-service-base.js` - Abstract base class for all providers
- `ai-service-manager.js` - Factory/orchestrator for multiple providers
- `openai-service.js` - OpenAI GPT-4o/GPT-4o-mini implementation
- `anthropic-service.js` - Claude 3.5 Sonnet/Haiku implementation
- `prompts/` - Provider-specific optimized prompts

**All Features:**
- ✅ Multi-provider AI support (Gemini, OpenAI, Anthropic, OpenRouter)
- ✅ Runtime provider switching via dropdown
- ✅ Provider-optimized prompts
- ✅ INSTANT voice transcription with Vosk
- ✅ Screenshot analysis with vision AI
- ✅ "What should I say?" suggestions
- ✅ Meeting notes generation
- ✅ Conversation insights
- ✅ Stealth mode with glass-morphism UI
- ✅ Rate-limited API services
- ✅ Emergency hide functionality
- ✅ Keyboard shortcuts
- ✅ Chat interface with message history

---

### Version 3.0.0 (Gemini Audio Transcription)

**Major Changes:**
- 🚀 **Gemini Audio Transcription** - Uses Gemini's built-in audio transcription
- ⚡ **No Loading Wait** - Instant startup, no model downloads
- 🔧 **Electron-Compatible** - No Web Speech API network errors
- 🎯 **Integrated** - Single API for vision, text, AND audio
- 💪 **Reliable** - Proven enterprise-grade transcription
- 📦 **Simple** - No complex dependencies

**All Features:**
- ✅ INSTANT voice transcription with Gemini Audio API
- ✅ Screenshot analysis with Gemini Vision API
- ✅ "What should I say?" suggestions
- ✅ Meeting notes generation
- ✅ Conversation insights
- ✅ Stealth mode with glass-morphism UI
- ✅ Rate-limited Gemini API service (10 RPM)
- ✅ Emergency hide functionality
- ✅ Keyboard shortcuts
- ✅ Chat interface with message history

**Known Issues:**
- Gemini rate limiting: 10 requests/minute (with 5s chunks = ~3 min continuous speech)
- Window positioning may need adjustment on multi-monitor setups

**Rate Limit Info:**
- Audio transcription counts toward 10 RPM limit
- With 5-second chunks, you get ~3 minutes of continuous speech per minute
- App automatically queues requests if limit hit

---

### Version 2.0.0 (Vosk Worker)

**Changes:**
- Replaced Whisper with Vosk
- Instant startup

**Issues:**
- ❌ Network errors in Electron (FIXED in v3.0.0 with Gemini Audio)

---

### Version 1.0.0 (Initial Release)

**Features:**
- ✅ Whisper-based transcription

**Issues:**
- ❌ 30-60 second model loading (FIXED in v2.0.0)

---

**Made with ❤️ for productive meetings**

*Disclaimer: Use responsibly and ethically. The developer is not responsible for misuse of this tool.*
