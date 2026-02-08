---
name: UI/UX Overhaul Phase 6
overview: "Add Phase 6 to the README with a complete UI/UX overhaul plan: separate floating control panel, clean transcript window without footer, auto-scrolling, optional icon labels, and inline header controls."
todos:
  - id: phase6-readme
    content: Add Phase 6 checklist to README.md with all wireframes and tasks
    status: completed
  - id: phase6-review
    content: Review plan with user and confirm wireframe design choices
    status: completed
isProject: false
---

# Phase 6: UI/UX Overhaul - Modular Panel System

## Goal

Transform EchoAssist from a monolithic window into a modular, multi-panel system with:

- A **floating, draggable control panel** for all action buttons
- A **clean transcript/summary window** with no footer and auto-scrolling
- **Optional icon labels** to improve discoverability
- **Inline header controls** combining all indicators and settings in one row

---

## Current Layout vs. Proposed Layout

### Current Layout (Monolithic)

```
┌─────────────────────────────────────────────────────────┐
│ [Traffic Lights]    [DEV] [Theme] [Opacity ===] 100%    │  <- Drag Handle
├─────────────────────────────────────────────────────────┤
│ ● 00:00 [3]  [Mic][SS][AI][💡][📝][📊][🗑️][👁️][⚙️]     │  <- Toolbar
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌─────────────────────────┐ │
│ │     TRANSCRIPT          │ │       SUMMARY           │ │
│ │                         │ │                         │ │
│ │  Click microphone to    │ │  Summary will appear    │ │
│ │  start recording        │ │  here after recording   │ │
│ │                         │ │  begins                 │ │
│ │                         │ │                         │ │
│ └─────────────────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ [Provider] Voice Ready              AI working...       │  <- Status Bar
└─────────────────────────────────────────────────────────┘
```

### Proposed Layout (Modular)

**Panel A: Floating Control Bar (Draggable)**

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ≡ │ ● 00:00 [3] │ [DEV] [Theme] [Opacity ===] │ [🎤][📸][🤖][💡][📝][📊][🗑️][👁️][⚙️] │ [×] │
│   │             │                              │  Mic SS  AI Sug Note Ins Clr Hid Set │Close│
└───────────────────────────────────────────────────────────────────────────────────────┘
Drag   Status       Header Controls (inline)       Action Buttons (optional labels)     Exit
```

**Panel B: Chrome-less Transcript + Summary Window**

```
┌─────────────────────────────┬─────────────────────────┐
│ 📄 Transcript    [⚡][📋]   │ 📊 Summary    [↻] [◀]   │  <- Draggable headers (no title bar!)
├─────────────────────────────┼─────────────────────────┤
│                             │                         │
│  12:34:56 Hello, this       │ ## Key Points           │
│           is the            │ - Discussed timeline    │
│           transcript.       │ - Action items assigned │
│                             │                         │
│  12:35:02 Auto-scroll       │ ## Decisions            │
│           keeps you at      │ - Launch date confirmed │
│           the bottom...     │                         │
│                          ▼  │                         │
└─────────────────────────────┴─────────────────────────┘
         ↑
    NO title bar, NO traffic lights, NO footer
    Pure content with glass-morphism background
```

---

## Detailed Wireframes

### Wireframe 1: Floating Control Bar (Compact Mode - Icons Only)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ≡ │ ● 00:00 [3] │ [DEV] [🌙] [═══●═══] 85% │ [🎤] [📸] [🤖] [💡] [📝] [📊] [🗑️] [👁️] [⚙️] │ [×] │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
 ↑     ↑              ↑           ↑            ↑                                              ↑
 │     │              │           │            │                                              └─ Close app
 │     │              │           │            └─ Action buttons (icon only)
 │     │              │           └─ Opacity slider inline
 │     │              └─ Dev mode + Theme toggle inline
 │     └─ Status (recording dot, timer, screenshot count)
 └─ Drag handle (grip icon)
```

### Wireframe 2: Floating Control Bar (Expanded Mode - Icons + Labels)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ≡ │ ● 00:00 [3] │ [DEV] [🌙] [═══●═══] 85% │ [🎤] [📸] [🤖] [💡] [📝] [📊] [🗑️] [👁️] [⚙️] [Aa] │ [×]    │
│   │             │                           │  Mic   SS   AI  Sugg Note  Ins  Clr  Hide Set Labels│ Close │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                       ↑
                                                                                    Close app button ──┘
```

### Wireframe 3: Chrome-less Transcript + Summary Window

No title bar, no traffic lights, no window controls - just pure content panels.
The window is frameless and draggable via the panel headers.

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
         ↑                                              ↑
         └── Draggable via header ──────────────────────┘

Features:
- Frameless window (no title bar, no traffic lights)
- Glass-morphism background
- Draggable by clicking panel headers
- Resizable from edges/corners
- No minimize/maximize - just the content
```

### Wireframe 4: Control Bar Position Options

```
Position: Top-left (default)        Position: Bottom-center
┌──────────────────────────────┐    
│ ┌─────────────────────────┐  │    ┌──────────────────────────────┐
│ │ ≡ ● 00:00 [DEV] [🎤]... │  │    │                              │
│ └─────────────────────────┘  │    │    Transcript Window         │
│                              │    │                              │
│    Transcript Window         │    │                              │
│                              │    │ ┌─────────────────────────┐  │
│                              │    │ │ ≡ ● 00:00 [DEV] [🎤]... │  │
└──────────────────────────────┘    └─└─────────────────────────┘──┘

Position: Floating (free drag)
┌──────────────────────────────┐
│                              │    ┌─────────────────────────┐
│    Transcript Window         │    │ ≡ ● 00:00 [DEV] [🎤]... │
│                              │    └─────────────────────────┘
│                              │         (Anywhere on screen)
└──────────────────────────────┘
```

### Wireframe 5: Icon Labels Toggle States

```
Labels OFF (Compact):
┌─────────────────────────────────────────────────────────────────┐
│ [🎤] [📸] [🤖] [💡] [📝] [📊] [🗑️] [👁️] [⚙️]  [Aa]  │  [×]  │
└─────────────────────────────────────────────────────────────────┘
                                                       Labels  Close

Labels ON (Expanded):
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🎤]  [📸]  [🤖]   [💡]    [📝]   [📊]    [🗑️]   [👁️]  [⚙️]  [Aa]      │  [×]            │
│  Mic   SS    AI   Suggest  Notes  Insights  Clear  Hide  Set  Labels   │  Close          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify


| File                                   | Changes                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| [src/renderer.html](src/renderer.html) | Restructure DOM for modular panels, add labels toggle button, close btn |
| [src/styles.css](src/styles.css)       | New styles for floating panel, label states, inline header, frameless   |
| [src/renderer.js](src/renderer.js)     | Panel drag logic, label toggle, auto-scroll, header drag for window     |
| [src/main.js](src/main.js)             | Frameless window config, remove traffic lights, close IPC handler       |
| [src/preload.js](src/preload.js)       | IPC handlers for panel state and app close                              |


---

## Implementation Tasks (Phase 6 Checklist)

### 6.1 Floating Control Panel

- Extract action buttons from main window into separate panel component
- Implement drag-to-reposition functionality for control bar
- Add grip/handle icon for intuitive dragging
- Store and restore panel position across sessions
- Add snap-to-edge behavior (optional magnetism)
- Support keyboard shortcut to toggle control bar visibility
- Add close button [×] to exit the entire application
- Style close button with red hover state for visibility

### 6.2 Inline Header Controls

- Move DEV mode pill, theme toggle, and opacity slider into single row
- Combine with action buttons in the floating panel
- Ensure all controls remain accessible without scrolling
- Maintain visual hierarchy (status | settings | actions)

### 6.3 Chrome-less Transcript Window

- Remove title bar completely (frameless window)
- Remove traffic lights / window controls (close/minimize/maximize)
- Remove status bar footer from transcript/summary panel
- Make window draggable via panel headers
- Keep window resizable from edges/corners
- Implement auto-scroll that follows new transcript entries
- Add "Auto-scroll: ON/OFF" indicator/toggle
- Keep transcript header minimal (title + copy/polish buttons only)
- Move AI provider selector to control panel or settings

### 6.4 Icon Labels System

- Add toggle button [Aa] to enable/disable icon labels
- Create label text for each action button
- Style labels to appear below icons when enabled
- Persist label preference in settings
- Adjust panel width dynamically when labels shown

### 6.5 Auto-Scroll Behavior

- Implement smart auto-scroll (scroll to bottom on new content)
- Pause auto-scroll when user manually scrolls up
- Resume auto-scroll when user scrolls to bottom
- Add visual indicator showing auto-scroll state
- Smooth scroll animation for new content

### 6.6 Panel State Management

- Save/restore control bar position
- Save/restore transcript window size and position
- Save/restore labels ON/OFF preference
- Save/restore summary panel collapsed state
- Handle multi-monitor scenarios

### 6.7 Visual Polish

- Consistent glass-morphism styling across both panels
- Smooth animations for panel transitions
- Hover states for all interactive elements
- Focus indicators for keyboard navigation
- Dark/light theme support for new components

---

## Data Model

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

---

## Acceptance Criteria

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

