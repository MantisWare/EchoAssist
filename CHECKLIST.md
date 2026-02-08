# EchoAssist Development Checklist

This file tracks all planned features and development phases for EchoAssist.

---

## Phase 5: Screen Region Selection

**Status:** Implemented  
**Goal:** Allow users to select a specific screen region or window (e.g., Microsoft Teams, Zoom, Google Meet) to focus screen captures on, instead of capturing the entire screen.

### Why This Feature?
- **Focused Analysis:** Capture only the meeting window for more relevant AI analysis
- **Privacy:** Avoid accidentally capturing sensitive information from other windows
- **Performance:** Smaller image sizes = faster AI processing and lower token usage
- **Accuracy:** AI gets cleaner context without desktop clutter

### Tasks

#### 5.1 Region Selection UI
- [x] Create a semi-transparent overlay that covers the entire screen
- [x] Allow click-and-drag to draw a selection rectangle
- [x] Display pixel coordinates and dimensions while selecting
- [x] Add "Confirm" and "Cancel" buttons for the selection
- [x] Show visual preview of selected region (marching ants animation + corner resize handles)

#### 5.2 Window Detection & Picker
- [x] Enumerate all open windows on the system (via node-window-manager)
- [x] Create a dropdown/list UI showing available windows with icons
- [x] Support filtering by window title (e.g., "Teams", "Zoom", "Meet")
- [x] Auto-detect common meeting apps and highlight them (green dot indicator)
- [x] Handle multi-monitor setups correctly (overlay spawns on main window display)

#### 5.3 Region Persistence
- [x] Store selected region coordinates in app settings (electron-store capture schema)
- [x] Persist window selection by window title/process name
- [x] Re-detect window position on each capture (resolveWindowBounds called fresh)
- [x] Handle edge cases: window minimized, closed, or moved off-screen (fallback to full screen with notification)
- [x] Add option to "lock to window" that follows it if moved (followWindow flag)

#### 5.4 Screenshot Service Updates
- [x] Modify `screenshot-desktop` capture to use region bounds (post-capture crop via nativeImage)
- [x] Implement fallback to full screen if region is invalid
- [x] Add cropping logic for region-based captures (region-selection-service.js cropScreenshot)
- [x] Optimize image encoding for smaller regions (nativeImage.toPNG writes only cropped area)
- [x] Handle DPI/scaling differences across monitors (scaleFactor multiplication)

#### 5.5 UI Controls & Settings
- [x] Add "Select Region" button to main UI (crop icon between SS and AI buttons)
- [x] Add keyboard shortcut for region selection (`Ctrl+Alt+Shift+R`)
- [x] Show current capture mode indicator (badge on screenshot button: dimensions or window name)
- [x] Add region selection via context menu (Draw Region / Pick Window / Full Screen)
- [x] Provide "Reset to Full Screen" quick action (in context menu and window picker)

#### 5.6 Visual Feedback
- [x] Brief flash or highlight when screenshot is taken (mode-specific border flash: blue/green/white)
- [x] Indicate if window is no longer available (toast notification + chat system message)
- [x] Mode-specific feedback in chat messages ("Screenshot captured (Region/Window/Full Screen)")

#### 5.7 Platform Considerations
- [x] Cross-platform window enumeration via node-window-manager (Windows/Mac/Linux)
- [x] macOS Accessibility permission detection (returns guidance notification if empty list)
- [x] Multi-monitor: overlay spawns on same display, bounds clamped to captured display
- [x] Handle Retina/HiDPI displays correctly (scaleFactor applied in crop helper)
- [x] Handle windows spanning monitors (clampBoundsToDisplay utility)

> **Auto-updated by Cursor:** Phase 5 fully implemented on 2026-02-07. Created region-selection-service.js, region overlay window (HTML/JS/preload), IPC handlers, preload bridge methods, UI controls (region button, context menu, window picker modal, capture mode badge), screenshot pipeline modifications with post-capture cropping, visual feedback (mode-specific flash, toast notifications), and platform edge case handling.

### Technical Details

#### Data Model
```javascript
// Region selection configuration
{
  captureMode: 'fullScreen' | 'region' | 'window',
  region: {
    x: number,      // Top-left X coordinate
    y: number,      // Top-left Y coordinate
    width: number,  // Region width in pixels
    height: number  // Region height in pixels
  },
  window: {
    title: string,      // Window title to match
    processName: string, // Process name fallback
    bounds: { x, y, width, height } // Last known position
  },
  followWindow: boolean, // Re-detect window position each capture
  monitorIndex: number   // Which monitor (for multi-display)
}
```

#### Dependencies to Evaluate
| Package | Purpose | Platform |
|---------|---------|----------|
| `node-window-manager` | Window enumeration | Windows/Mac/Linux |
| `active-win` | Get active window info | Cross-platform |
| `screenshot-desktop` | Already used, supports regions | Cross-platform |
| `electron.desktopCapturer` | Built-in screen/window capture | Electron native |

### Acceptance Criteria
1. User can select a rectangular region of the screen for capture
2. User can select a specific window by name from a list
3. Selection persists across app restarts
4. Screenshots only capture the selected region/window
5. Clear UI indicator shows current capture mode
6. Easy way to reset to full-screen capture
7. Works correctly on Windows, macOS, and Linux
8. Handles multi-monitor and HiDPI displays

---

## Phase 6: UI/UX Overhaul - Modular Panel System

**Status:** In Progress (Two-Window Architecture Implemented)  
**Goal:** Transform EchoAssist from a monolithic window into a modular, multi-panel system with improved usability and a cleaner interface.

### Key Changes
- A **floating, draggable control panel** for all action buttons
- A **chrome-less transcript/summary window** (no title bar, no traffic lights)
- **Optional icon labels** to improve discoverability
- **Inline header controls** combining all indicators and settings in one row
- **Close button** on control bar to exit the application

### Wireframes

#### Control Bar (Compact - Icons Only)
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ≡ │ ● 00:00 [3] │ [DEV] [🌙] [═══●═══] 85% │ [🎤] [📸] [🤖] [💡] [📝] [📊] [🗑️] [👁️] [⚙️] │ [×] │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
 ↑     ↑              ↑           ↑            ↑                                              ↑
 │     │              │           │            └─ Action buttons                              └─ Close app
 │     │              │           └─ Opacity slider inline
 │     │              └─ Dev mode + Theme toggle inline
 │     └─ Status (recording dot, timer, screenshot count)
 └─ Drag handle (grip icon)
```

#### Control Bar (Expanded - Icons + Labels)
```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ≡ │ ● 00:00 [3] │ [DEV] [🌙] [═══●═══] 85% │ [🎤] [📸] [🤖] [💡] [📝] [📊] [🗑️] [👁️] [⚙️] [Aa] │ [×]    │
│   │             │                           │  Mic   SS   AI  Sugg Note  Ins  Clr  Hide Set Labels│ Close │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Chrome-less Transcript + Summary Window
```
┌────────────────────────────────────────┬────────────────────────────────────┐
│ 📄 Transcript        [Gemini ▼] [⚡][📋]│ 📊 Summary              [↻]  [◀]   │
├────────────────────────────────────────┼────────────────────────────────────┤
│                                        │                                    │
│ 12:34:56  Hello everyone, welcome to   │ ## Meeting Summary                 │
│           today's meeting. We're       │ Brief overview of discussion...    │
│           going to discuss the Q1      │                                    │
│           roadmap.                     │ ## Key Points                      │
│                                        │ - Timeline discussion              │
│ 12:35:02  Thanks John. Let me share    │ - Resource allocation              │
│           my screen...                 │ - Next steps defined               │
│                                        │                                    │
│ 12:35:15  ● typing...                  │ ## Action Items                    │
│                                        │ - [ ] Review proposal              │
│                                    ▼   │ - [ ] Schedule follow-up           │
│         [Auto-scroll: ON]              │                                    │
└────────────────────────────────────────┴────────────────────────────────────┘

Features:
- Frameless window (no title bar, no traffic lights)
- Glass-morphism background
- Draggable by clicking panel headers
- Resizable from edges/corners
- No minimize/maximize - just the content
```

### Tasks

#### 6.1 Floating Control Panel
- [x] Extract action buttons from main window into separate BrowserWindow (`control-bar.html`)
- [x] Implement drag-to-reposition functionality for control bar (`-webkit-app-region: drag`)
- [x] Add grip/handle icon for intuitive dragging
- [x] Store and restore panel position across sessions (via `settings-store.js` panelState)
- [ ] Add snap-to-edge behavior (optional magnetism)
- [ ] Support keyboard shortcut to toggle control bar visibility
- [x] Add close button [×] to exit the entire application
- [x] Style close button with red hover state for visibility

#### 6.2 Inline Header Controls
- [x] Move DEV mode pill, theme toggle, and opacity slider into single row
- [x] Combine with action buttons in the floating panel
- [x] Ensure all controls remain accessible without scrolling
- [x] Maintain visual hierarchy (status | settings | actions)

#### 6.3 Chrome-less Transcript Window
- [x] Remove title bar completely (frameless window, removed `titleBarStyle: 'hidden'`)
- [x] Remove traffic lights / window controls (`frame: false` only, no macOS override)
- [x] Remove status bar footer from transcript/summary panel
- [x] Make window draggable via panel headers (`-webkit-app-region: drag`)
- [x] Keep window resizable from edges/corners
- [x] Implement auto-scroll that follows new transcript entries
- [x] Add "Auto-scroll: ON/OFF" indicator/toggle
- [x] Keep transcript header minimal (title + copy/polish buttons only)
- [x] Move AI provider selector to transcript header (inline with title)
- [x] Move auto-scroll indicator to transcript header (inline)
- [x] Remove separate drag header panel — header itself is now draggable
- [x] Make transcript panel full height of window
- [x] Add scrollbar styling for summary panel
- [x] Fix dev/stealth pill colors (yellow for DEV, green for STEALTH)
- [x] Add lock/unlock button next to Transcript title
- [x] Lock disables window move and resize (`setMovable(false)`, `setResizable(false)`)
- [x] Unlock re-enables window move and resize
- [x] Lock state persisted in `panelState.transcript.locked`
- [x] Visual feedback: lock icon toggles, header border color changes when locked

#### 6.4 Icon Labels System
- [x] Add toggle button [Aa] to enable/disable icon labels
- [x] Create label text for each action button
- [x] Style labels to appear below icons when enabled
- [x] Persist label preference in settings
- [x] Adjust panel width dynamically when labels shown

#### 6.5 Auto-Scroll Behavior
- [x] Implement smart auto-scroll (scroll to bottom on new content)
- [ ] Pause auto-scroll when user manually scrolls up
- [ ] Resume auto-scroll when user scrolls to bottom
- [x] Add visual indicator showing auto-scroll state
- [ ] Smooth scroll animation for new content

#### 6.6 Panel State Management
- [x] Save/restore control bar position (via `settings-store.js` panelState)
- [x] Save/restore transcript window size and position (via `settings-store.js` panelState)
- [x] Save/restore labels ON/OFF preference
- [ ] Save/restore summary panel collapsed state
- [ ] Handle multi-monitor scenarios

#### 6.7 Visual Polish
- [x] Consistent glass-morphism styling across both panels
- [x] Smooth animations for panel transitions
- [x] Hover states for all interactive elements
- [ ] Focus indicators for keyboard navigation
- [x] Dark/light theme support for new components

> **Auto-updated by Cursor:** Core implementation completed on 2026-02-07. Implemented floating control bar, chrome-less window, icon labels system, auto-scroll indicator, close button, and status toast. Some advanced features (position persistence, snap-to-edge, keyboard shortcuts for panel toggle) remain as follow-up items.
>
> **Auto-updated by Cursor:** Two-window architecture implemented on 2026-02-07. Split monolithic window into separate control bar BrowserWindow (`control-bar.html`, `control-bar-renderer.js`) and transcript window. Removed `titleBarStyle: 'hidden'` to fix macOS traffic lights. Added `sendToAllWindows()` IPC routing. Panel position persistence via `settings-store.js`. Native context menu for region selection. Both windows are fully frameless, independently draggable, and stealth-compatible.

### Technical Details

#### Files Modified/Created
| File | Changes |
|------|---------|
| `src/control-bar.html` | **NEW** - Separate HTML for the floating control bar window |
| `src/control-bar-renderer.js` | **NEW** - JS for control bar: buttons, theme, opacity, labels, status |
| `src/renderer.html` | Removed control bar section, removed region context menu |
| `src/renderer.js` | Added `onOpenWindowPicker` and `onThemeChanged` IPC listeners |
| `src/styles.css` | Updated padding for frameless transcript window |
| `src/main.js` | Two BrowserWindows, `sendToAllWindows()`, native region menu, panel persistence |
| `src/preload.js` | Added `showRegionMenu`, `broadcastThemeChange`, `onThemeChanged`, `onOpenWindowPicker` |
| `src/settings-store.js` | Added `panelState` schema, `showIconLabels` to UI settings |

#### Data Model
```javascript
// Panel configuration (stored in electron-store)
{
  controlPanel: {
    position: { x: number, y: number },
    showLabels: boolean,
    docked: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'floating'
  },
  transcriptWindow: {
    bounds: { x, y, width, height },
    autoScroll: boolean,
    summaryCollapsed: boolean
  },
  uiPreferences: {
    theme: 'light' | 'dark',
    opacity: number // 30-100
  }
}
```

### Acceptance Criteria
1. Control bar can be dragged freely and position persists
2. Transcript window is completely frameless (no title bar, no traffic lights)
3. Transcript window has no footer/status bar
4. Transcript window is draggable via panel headers
5. Auto-scroll follows new transcript content automatically
6. Labels can be toggled ON/OFF with [Aa] button
7. All header controls (DEV, theme, opacity) appear inline with action buttons
8. Close button on control bar exits the entire application
9. Both panels maintain glass-morphism styling
10. All functionality works in both light and dark themes
11. Panel states persist across app restarts

---

## Completed Phases

### Phase 1-4: Core Features (Completed)
- [x] Multi-provider AI support (Gemini, OpenAI, Anthropic, OpenRouter)
- [x] Runtime provider switching via dropdown
- [x] Provider-optimized prompts
- [x] INSTANT voice transcription with Vosk
- [x] Screenshot analysis with vision AI
- [x] "What should I say?" suggestions
- [x] Meeting notes generation
- [x] Conversation insights
- [x] Stealth mode with glass-morphism UI
- [x] Rate-limited API services
- [x] Emergency hide functionality
- [x] Keyboard shortcuts
- [x] Chat interface with message history

---

*Last updated: 2026-02-08*
