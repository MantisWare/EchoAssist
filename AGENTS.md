# Agent Instructions for EchoAssist

This document guides AI agents working on the EchoAssist codebase.

## Project Overview
**Name:** stealth-meeting-assistant
**Description:** Electron-based invisible AI assistant for meetings, disguised as Google Chrome.
**Tech Stack:** 
- **Core:** Node.js, Electron (CommonJS)
- **AI:** Google Gemini 1.5 Flash (via API)
- **Audio:** Python subprocesses (`vosk` for keyword spotting, `openai-whisper` for transcription)
- **Build:** `electron-builder`

## 1. Build, Run, and Test Commands

### Prerequisites
- Node.js & npm installed.
- Python 3 installed (for `transcribe.py` and `vosk_live.py`).
- `.env` file in root with `GEMINI_API_KEY`.

### Commands
- **Install Dependencies:**
  ```bash
  npm install
  npm run postinstall  # Installs native dependencies
  ```

- **Development (Run Source):**
  ```bash
  npm start
  # OR
  npm run dev  # Enables logging
  ```

- **Build for Production (Portable Windows):**
  ```bash
  npm run build -- --win portable
  ```

- **Build for Production (Installer):**
  ```bash
  npm run build -- --win nsis
  ```

### Testing
- **Automated Tests:** There are currently **NO** automated unit or integration tests configured in `package.json`.
- **Manual Testing:**
  - Launch the app using `npm start`.
  - Verify stealth mode triggers (Ctrl+Alt+Shift+H).
  - Verify screenshot analysis (Ctrl+Alt+Shift+A).
  - Check console output for errors.

## 2. Code Style & Conventions

### JavaScript (Electron/Node)
- **Format:** CommonJS (`require`).
- **Indentation:** 2 spaces.
- **Semicolons:** Always use semicolons.
- **Quotes:** Prefer single quotes (`'`) for strings.
- **Naming:** 
  - `camelCase` for variables and functions.
  - `PascalCase` for classes.
  - `UPPER_CASE` for constants.
- **Async/Await:** Prefer `async/await` over raw Promises/callbacks.
- **Error Handling:** Use `try...catch` blocks, especially for IPC handlers and external API calls. Log errors clearly.
- **IPC Safety:** validate inputs in `ipcMain.handle`.

### Python (Scripts)
- **Format:** PEP 8 standards.
- **Indentation:** 4 spaces.
- **Naming:** `snake_case` for variables and functions.
- **Output:** Scripts typically output JSON to `stdout` for the Electron main process to parse.
- **Imports:** Imports may be placed inside functions if they are heavy and conditional (e.g., `import whisper`).

### Project Structure
- `src/`: Main Electron source code (`main.js`, `renderer.js`, etc.).
- `assets/`: Icons and static assets.
- `dist/`: Build artifacts (not committed).
- Root scripts (`transcribe.py`, `vosk_live.py`): Helper scripts bundled with the app.

## 3. Important Rules for Agents
1.  **Preserve Stealth:** Do not alter the "disguise" features (e.g., window title "Google Chrome (2)", transparent background) unless explicitly instructed.
2.  **Safety:** Never commit `.env` files. Ensure `GEMINI_API_KEY` is loaded securely.
3.  **Dependencies:** Do not add new native dependencies without verifying cross-platform compatibility (Windows/Mac) and `electron-builder` support.
4.  **No Breaking Changes:** The app relies on specific global shortcuts (e.g., `CommandOrControl+Alt+Shift+...`). Do not change these defaults without user approval.
5.  **Comments:** Explain *why* complex IPC logic or stealth hacks are used.
