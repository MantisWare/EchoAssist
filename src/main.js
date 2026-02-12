const { app, BrowserWindow, globalShortcut, ipcMain, screen, Menu } = require('electron');
const { spawn } = require('child_process');

const fs = require('fs');
const os = require('os');
const path = require('path');
const screenshot = require('screenshot-desktop');

// Settings Store - Secure configuration management
const settingsStore = require('./settings-store');

// Region Selection Service - Phase 5
const regionService = require('./region-selection-service');

// Helper function to check if running in dev mode
function isDevelopment() {
  return !app.isPackaged;
}

// Helper function to get the correct path based on environment
function getAppPath() {
  return isDevelopment() ? __dirname : path.join(process.resourcesPath, 'app.asar');
}

// Load .env for migration purposes (legacy support)
const isDev = !app.isPackaged;
let envPath;

if (isDev) {
  envPath = path.join(__dirname, '..', '.env');
} else {
  envPath = path.join(process.resourcesPath, '.env');
}

require('dotenv').config({ path: envPath });

// Migrate from .env to settings store if needed
if (!settingsStore.hasCompletedSetup()) {
  console.log('First run or migration needed - checking for .env settings...');
  settingsStore.migrateFromEnv(process.env);
}

// Log configured providers from settings store
const configuredProviders = settingsStore.getConfiguredProviders();
console.log('=== API Key Configuration (from Settings Store) ===');
console.log('GEMINI:', configuredProviders.gemini ? '✅ Configured' : '❌ Not configured');
console.log('OPENAI:', configuredProviders.openai ? '✅ Configured' : '❌ Not configured');
console.log('ANTHROPIC:', configuredProviders.anthropic ? '✅ Configured' : '❌ Not configured');
console.log('OPENROUTER:', configuredProviders.openrouter ? '✅ Configured' : '❌ Not configured');
console.log('DEFAULT_PROVIDER:', settingsStore.getAISettings().defaultProvider);

// Import AI Service Manager (replaces direct GeminiService usage)
const AIServiceManager = require('./ai-service-manager');

(async () => {

let mainWindow;        // Transcript/summary window
let controlBarWindow = null;  // Floating control bar window (Phase 6)
let settingsWindow = null;
let regionOverlayWindow = null;
let screenshots = [];
let chatContext = [];
const MAX_SCREENSHOTS = 3;

// Vosk live transcription process
let voskProcess = null;
let isVoskRunning = false;
let isVoskPrewarmed = false;
let voskPrewarmStatus = 'idle'; // 'idle', 'loading', 'ready', 'error'
let voskStdoutBuffer = ''; // Buffer for incomplete JSON lines from stdout

/**
 * Process buffered stdout data from the Vosk Python process.
 * Handles incomplete JSON lines split across multiple `data` chunks.
 * @param {string} rawData - Raw data chunk from stdout
 * @param {function} onParsedLine - Callback for each successfully parsed JSON object
 */
function processVoskStdout(rawData, onParsedLine) {
  voskStdoutBuffer += rawData;
  const lines = voskStdoutBuffer.split('\n');

  // Keep the last element — it may be an incomplete line
  voskStdoutBuffer = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    try {
      const result = JSON.parse(trimmed);
      onParsedLine(result);
    } catch (_parseError) {
      console.error('Failed to parse Vosk output:', trimmed);
    }
  }
}

// Speaker model configuration
const VOSK_SPEAKER_MODEL = {
  name: 'vosk-model-spk-0.4',
  url: 'https://alphacephei.com/vosk/models/vosk-model-spk-0.4.zip',
  size: 13000000, // ~13MB
  sizeDesc: '~13 MB'
};

// Initialize AI Service Manager with all available providers
let aiService = null;

// Function to initialize or reinitialize AI services
function initializeAIServices() {
  const apiKeys = settingsStore.getAllApiKeys();
  const aiSettings = settingsStore.getAISettings();
  
  const hasAnyApiKey = apiKeys.gemini || apiKeys.openai || apiKeys.anthropic || apiKeys.openrouter;
  
  if (!hasAnyApiKey) {
    console.warn('No API keys configured. Please add at least one API key in Settings.');
    console.warn('Open Settings to configure your AI providers.');
    return null;
  }
  
  console.log('Initializing AI Service Manager with multi-provider support...');
  
  // Get model configuration from settings
  const modelSettings = aiSettings.models ?? {};
  
  const service = new AIServiceManager({
    geminiApiKey: apiKeys.gemini,
    openaiApiKey: apiKeys.openai,
    anthropicApiKey: apiKeys.anthropic,
    openrouterApiKey: apiKeys.openrouter,
    defaultProvider: aiSettings.defaultProvider ?? 'gemini',
    enableFallback: aiSettings.enableFallback !== false,
    // Pass model configuration to manager
    modelConfig: {
      gemini: modelSettings.gemini ?? {},
      openai: modelSettings.openai ?? {},
      anthropic: modelSettings.anthropic ?? {},
      openrouter: modelSettings.openrouter ?? {}
    }
  });
  
  const availableProviders = service.getAvailableProviders();
  const activeProvider = service.getActiveProvider();
  
  console.log('AI Service Manager initialized successfully');
  console.log('Available providers:', availableProviders.join(', '));
  console.log('Active provider:', activeProvider);
  
  return service;
}

try {
  aiService = initializeAIServices();
} catch (error) {
  console.error('Failed to initialize AI Service Manager:', error);
}

function createStealthWindow() {
  console.log('Creating stealth window...');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Load saved panel state for transcript window
  const savedPanelState = settingsStore.getPanelState();
  const savedTranscript = savedPanelState.transcript ?? {};

  // Short and wide window dimensions (resizable), use saved if available
  const windowWidth = savedTranscript.width ?? 900;
  const windowHeight = savedTranscript.height ?? 400;
  const x = savedTranscript.x ?? Math.floor((width - windowWidth) / 2);
  const y = savedTranscript.y ?? 100; // Lower default to leave room for control bar above

  console.log(`Window position: ${x}, ${y}, size: ${windowWidth}x${windowHeight}`);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 600,
    minHeight: 250,
    maxWidth: width,
    maxHeight: height,
    x: x,
    y: y,
    webPreferences: {
      nodeIntegration: false,          // Disable for security
      contextIsolation: true,          // Enable for security
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      offscreen: false,
      webSecurity: false,              // CHANGED: Disable for microphone access
      allowRunningInsecureContent: true, // CHANGED: Allow for media access
      experimentalFeatures: false,
      enableRemoteModule: false,
      sandbox: false                   // Keep disabled for dynamic imports
    },
    frame: false,                      // Completely frameless - no title bar, no traffic lights
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,                   // Enable resizing from edges/corners
    minimizable: false,                // No minimize (use close button on control bar)
    maximizable: false,                // No maximize
    closable: true,
    focusable: true,
    show: false,
    opacity: 1.0,
    type: 'toolbar',
    acceptFirstMouse: false,
    disableAutoHideCursor: true,
    enableLargerThanScreen: false,
    hasShadow: true,                   // Enable shadow for depth
    thickFrame: false,
    // Phase 6: Removed titleBarStyle: 'hidden' — it overrides frame:false on macOS
    // and re-enables traffic lights. frame:false alone is truly frameless.
    // Phase 6: Removed vibrancy — conflicts with transparent on some macOS versions
    backgroundColor: '#00000000'
  });

  console.log('BrowserWindow created');
  
  const htmlPath = path.join(__dirname, 'renderer.html');
  console.log('Loading HTML from:', htmlPath);
  mainWindow.loadFile(htmlPath);
  
  // ADDED: Set up microphone permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    if (permission === 'microphone' || permission === 'media') {
      console.log('Granting microphone permission');
      callback(true);
    } else {
      console.log('Denying permission:', permission);
      callback(false);
    }
  });

  // ADDED: Set permissions policy for media access
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('Permission check:', permission, requestingOrigin);
    if (permission === 'microphone' || permission === 'media') {
      return true;
    }
    return false;
  });

  // ADDED: Override permissions for media devices
  mainWindow.webContents.session.protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = decodeURI(request.url.replace('file:///', ''));
    callback(pathname);
  });
  
  // Apply stealth settings
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { 
      visibleOnFullScreen: true,
      skipTransformProcessType: true 
    });
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
    app.dock.hide();
    mainWindow.setHiddenInMissionControl(true);
  } else if (process.platform === 'win32') {
    console.log('Applying Windows stealth settings');
    mainWindow.setSkipTaskbar(true);
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    mainWindow.setAppDetails({
      appId: 'SystemProcess',
      appIconPath: '',
      relaunchCommand: '',
      relaunchDisplayName: ''
    });
  }
  
  // Content protection state - start disabled in dev mode, enabled in production
  // This can be toggled at runtime via the DEV pill
  global.contentProtectionEnabled = !isDevelopment();
  mainWindow.setContentProtection(global.contentProtectionEnabled);
  
  if (isDevelopment()) {
    console.log('Content protection DISABLED for development mode (can be toggled)');
  } else {
    console.log('Content protection enabled for stealth');
  }
  
  mainWindow.setIgnoreMouseEvents(false);
  
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('HTML finished loading');
    
    mainWindow.webContents.executeJavaScript(`
      console.log('Content check...');
      console.log('Document title:', document.title);
      console.log('Body exists:', !!document.body);
      console.log('App element exists:', !!document.getElementById('app'));
      console.log('Glass container exists:', !!document.querySelector('.glass-container'));
      
      document.body.style.background = 'transparent';
      
      if (document.body) {
        document.body.style.visibility = 'visible';
        document.body.style.display = 'block';
        console.log('Body made visible');
      }
      
      const app = document.getElementById('app');
      if (app) {
        app.style.visibility = 'visible';
        app.style.display = 'block';
        console.log('App container made visible');
      }
      
      'Content visibility check complete';
    `).then((result) => {
      console.log('JavaScript result:', result);
      mainWindow.show();
      mainWindow.focus();
      console.log('Window shown with transparent background');
      // Phase 6: Restore saved lock state for transcript window
      const savedPanelState = settingsStore.getPanelState();
      const isLocked = savedPanelState.transcript?.locked ?? false;
      if (isLocked) {
        mainWindow.setMovable(false);
        mainWindow.setResizable(false);
      }
      // Phase 6: Create the floating control bar as a separate window
      createControlBarWindow();
    }).catch((error) => {
      console.log('JavaScript execution failed:', error);
      mainWindow.show();
      createControlBarWindow();
    });
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
  
  // Handle console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Renderer console.${level}: ${message}`);
  });
  
  // Phase 6: Save transcript window position/size when moved or resized
  mainWindow.on('moved', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      settingsStore.setPanelState({
        transcript: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      });
    }
  });
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      settingsStore.setPanelState({
        transcript: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      });
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// ============================================================================
// SEND TO ALL WINDOWS HELPER (Phase 6)
// ============================================================================

/**
 * Send an IPC event to all active windows (transcript + control bar).
 * Each renderer ignores events it doesn't care about, so this is safe.
 */
function sendToAllWindows(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.webContents.send(channel, ...args);
  }
}

// ============================================================================
// CONTROL BAR WINDOW (Phase 6)
// ============================================================================

function createControlBarWindow() {
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.focus();
    return;
  }

  // Load saved panel state, fall back to position above transcript window
  const savedState = settingsStore.getPanelState();
  const windowBounds = mainWindow.getBounds();
  const controlBarWidth = savedState.controlBar?.width ?? windowBounds.width;
  const controlBarHeight = 56;
  const controlBarX = savedState.controlBar?.x ?? windowBounds.x;
  const controlBarY = savedState.controlBar?.y ?? Math.max(0, windowBounds.y - controlBarHeight - 8);

  controlBarWindow = new BrowserWindow({
    width: controlBarWidth,
    height: controlBarHeight,
    x: controlBarX,
    y: controlBarY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    focusable: true,
    show: false,
    type: 'toolbar',
    hasShadow: true,
    thickFrame: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      sandbox: false
    }
  });

  controlBarWindow.loadFile(path.join(__dirname, 'control-bar.html'));

  // Apply same stealth settings as main window
  if (process.platform === 'darwin') {
    controlBarWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    });
    controlBarWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
    controlBarWindow.setHiddenInMissionControl(true);
  } else if (process.platform === 'win32') {
    controlBarWindow.setSkipTaskbar(true);
    controlBarWindow.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // Content protection mirrors main window
  controlBarWindow.setContentProtection(global.contentProtectionEnabled ?? false);

  controlBarWindow.webContents.on('did-finish-load', () => {
    controlBarWindow.show();
    console.log('[Phase 6] Control bar window shown');
  });

  // Save position when the control bar is moved
  controlBarWindow.on('moved', () => {
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      const bounds = controlBarWindow.getBounds();
      settingsStore.setPanelState({
        controlBar: { x: bounds.x, y: bounds.y, width: bounds.width }
      });
    }
  });

  controlBarWindow.on('closed', () => {
    controlBarWindow = null;
  });
}

// ============================================================================
// SETTINGS WINDOW
// ============================================================================

function createSettingsWindow() {
  // If window already exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  
  console.log('Creating settings window...');
  
  settingsWindow = new BrowserWindow({
    width: 650,
    height: 750,
    minWidth: 500,
    minHeight: 500,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    title: 'Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'settings-preload.js')
    },
    // Standard window frame for settings
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,
    backgroundColor: '#ffffff'
  });
  
  const settingsPath = path.join(__dirname, 'settings.html');
  settingsWindow.loadFile(settingsPath);
  
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  
  // Open dev tools in development
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.webContents.openDevTools();
  }
}

function registerStealthShortcuts() {
  globalShortcut.register('CommandOrControl+Alt+Shift+H', () => {
    toggleStealthMode();
  });

  globalShortcut.register('CommandOrControl+Alt+Shift+S', async () => {
    await takeStealthScreenshot();
  });

  globalShortcut.register('CommandOrControl+Alt+Shift+A', async () => {
    if (screenshots.length > 0) {
      await analyzeForMeeting();
    }
  });

  globalShortcut.register('CommandOrControl+Alt+Shift+X', () => {
    emergencyHide();
  });

  globalShortcut.register('CommandOrControl+Alt+Shift+V', () => {
    sendToAllWindows('toggle-voice-recognition');
  });

  // Phase 5: Region selection shortcut
  globalShortcut.register('CommandOrControl+Alt+Shift+R', () => {
    openRegionOverlay();
  });

  globalShortcut.register('CommandOrControl+Alt+Shift+Left', () => {
    moveToPosition('left');
  });
  
  globalShortcut.register('CommandOrControl+Alt+Shift+Right', () => {
    moveToPosition('right');
  });
  
  globalShortcut.register('CommandOrControl+Alt+Shift+Up', () => {
    moveToPosition('top');
  });
  
  globalShortcut.register('CommandOrControl+Alt+Shift+Down', () => {
    moveToPosition('bottom');
  });
}

let isVisible = true;
let autoHideTimer = null;

function toggleStealthMode() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  if (isVisible) {
    mainWindow.setOpacity(0.6);
    sendToAllWindows('set-stealth-mode', true);
    isVisible = false;
  } else {
    mainWindow.setOpacity(1.0);
    sendToAllWindows('set-stealth-mode', false);
    isVisible = true;
  }
}

function emergencyHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  // Phase 6: Hide both windows
  mainWindow.setOpacity(0.01);
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.setOpacity(0.01);
  }
  sendToAllWindows('emergency-clear');
  
  autoHideTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1.0);
      isVisible = true;
    }
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      controlBarWindow.setOpacity(1.0);
    }
    autoHideTimer = null;
  }, 2000);
}

function moveToPosition(position) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowBounds = mainWindow.getBounds();
  
  let x, y;
  
  switch (position) {
    case 'left':
      x = 20;
      y = windowBounds.y;
      break;
    case 'right':
      x = width - windowBounds.width - 20;
      y = windowBounds.y;
      break;
    case 'top':
      x = Math.floor((width - windowBounds.width) / 2);
      y = 40;
      break;
    case 'bottom':
      x = Math.floor((width - windowBounds.width) / 2);
      y = height - windowBounds.height - 40;
      break;
    default:
      return;
  }
  
  mainWindow.setPosition(x, y);
}

// ============================================================================
// REGION OVERLAY WINDOW - Phase 5
// ============================================================================

function openRegionOverlay() {
  // If overlay already exists, focus it
  if (regionOverlayWindow && !regionOverlayWindow.isDestroyed()) {
    regionOverlayWindow.focus();
    return;
  }

  // Spawn overlay on the same display as the main window
  const windowBounds = mainWindow.getBounds();
  const currentDisplay = screen.getDisplayMatching(windowBounds);

  regionOverlayWindow = new BrowserWindow({
    x: currentDisplay.bounds.x,
    y: currentDisplay.bounds.y,
    width: currentDisplay.bounds.width,
    height: currentDisplay.bounds.height,
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'region-overlay-preload.js')
    }
  });

  // Content protection OFF - user must see the overlay
  regionOverlayWindow.setContentProtection(false);

  const overlayPath = path.join(__dirname, 'region-overlay.html');
  regionOverlayWindow.loadFile(overlayPath);

  regionOverlayWindow.once('ready-to-show', () => {
    regionOverlayWindow.show();
    regionOverlayWindow.focus();
  });

  regionOverlayWindow.on('closed', () => {
    regionOverlayWindow = null;
  });
}

function destroyRegionOverlay() {
  if (regionOverlayWindow && !regionOverlayWindow.isDestroyed()) {
    regionOverlayWindow.close();
    regionOverlayWindow = null;
  }
}

async function takeStealthScreenshot() {
  try {
    console.log('Taking stealth screenshot...');
    
    // Save current opacity to restore later
    const currentOpacity = mainWindow.getOpacity();
    const controlBarOpacity = controlBarWindow && !controlBarWindow.isDestroyed()
      ? controlBarWindow.getOpacity() : currentOpacity;
    
    // Get the display where the window is currently located
    const windowBounds = mainWindow.getBounds();
    const currentDisplay = screen.getDisplayMatching(windowBounds);
    console.log(`Window is on display: ${currentDisplay.id} (${currentDisplay.bounds.width}x${currentDisplay.bounds.height})`);
    
    // Set opacity to almost zero so BOTH windows are invisible in the screenshot
    mainWindow.setOpacity(0.01);
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      controlBarWindow.setOpacity(0.01);
    }
    
    // Wait for opacity change to render
    await new Promise(resolve => setTimeout(resolve, 200));

    // Use app data directory for screenshots in production
    const screenshotsDir = isDevelopment()
      ? path.join(__dirname, '..', '.stealth_screenshots')
      : path.join(app.getPath('userData'), '.stealth_screenshots');

    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotsDir, `stealth-${Date.now()}.png`);
    
    // Get list of available screens from screenshot-desktop
    const displays = await screenshot.listDisplays();
    console.log('Available displays:', displays.map(d => `${d.id}: ${d.name}`));
    
    // Find the matching display ID for screenshot-desktop
    // screenshot-desktop uses different IDs than Electron, so we match by position/size
    let targetDisplayId = null;
    
    for (const display of displays) {
      // Match display by checking if bounds are similar
      // Note: screenshot-desktop may use different ID format, so we find by index
      if (displays.length === 1) {
        // Single display - use it
        targetDisplayId = display.id;
        break;
      }
      
      // For multiple displays, try to match by screen index
      // Electron's display.id corresponds to the screen index in most cases
      const electronDisplays = screen.getAllDisplays();
      const displayIndex = electronDisplays.findIndex(d => d.id === currentDisplay.id);
      
      if (displayIndex !== -1 && displayIndex < displays.length) {
        targetDisplayId = displays[displayIndex].id;
        break;
      }
    }
    
    // If we couldn't find a match, try using the display directly
    if (targetDisplayId === null && displays.length > 0) {
      // Default to first display or try to match by bounds
      for (let i = 0; i < displays.length; i++) {
        const electronDisplay = screen.getAllDisplays()[i];
        if (electronDisplay && electronDisplay.id === currentDisplay.id) {
          targetDisplayId = displays[i].id;
          break;
        }
      }
      
      // Still no match - use the display index directly
      if (targetDisplayId === null) {
        const electronDisplays = screen.getAllDisplays();
        const displayIndex = electronDisplays.findIndex(d => d.id === currentDisplay.id);
        if (displayIndex >= 0 && displayIndex < displays.length) {
          targetDisplayId = displays[displayIndex].id;
        } else {
          targetDisplayId = displays[0].id; // Fallback to first display
        }
      }
    }
    
    console.log(`Capturing screenshot from display: ${targetDisplayId}`);
    
    // Capture screenshot from the specific display
    await screenshot({ filename: screenshotPath, screen: targetDisplayId });

    // Phase 5: Post-capture cropping based on capture mode
    const captureConfig = regionService.loadCaptureConfig();
    const captureMode = captureConfig.mode ?? 'fullScreen';

    if (captureMode === 'region') {
      const scaleFactor = currentDisplay.scaleFactor ?? 1;
      regionService.cropScreenshot(screenshotPath, captureConfig.region, scaleFactor);
      console.log(`Screenshot cropped to region: ${captureConfig.region.width}x${captureConfig.region.height}`);
    } else if (captureMode === 'window') {
      const windowBoundsLive = regionService.resolveWindowBounds(captureConfig);
      if (windowBoundsLive !== null) {
        const scaleFactor = currentDisplay.scaleFactor ?? 1;

        // Clamp window bounds to the captured display (handles multi-monitor spanning)
        const clampedBounds = regionService.clampBoundsToDisplay(
          windowBoundsLive, currentDisplay.bounds
        );

        // Skip if clamped region is too small (window mostly on another display)
        if (clampedBounds.width < 10 || clampedBounds.height < 10) {
          console.warn('Window not visible on captured display — using full screen');
          sendToAllWindows('capture-window-not-found', captureConfig.window.title ?? '');
        } else {
          // Adjust bounds relative to captured display origin
          const relBounds = {
            x: clampedBounds.x - currentDisplay.bounds.x,
            y: clampedBounds.y - currentDisplay.bounds.y,
            width: clampedBounds.width,
            height: clampedBounds.height
          };
          regionService.cropScreenshot(screenshotPath, relBounds, scaleFactor);
          console.log(`Screenshot cropped to window: ${captureConfig.window.title}`);
        }
      } else {
        // Window not found -- notify renderer, capture full screen as fallback
        console.warn(`Target window not found: ${captureConfig.window.title}`);
        sendToAllWindows('capture-window-not-found', captureConfig.window.title ?? '');
      }
    }
    
    screenshots.push(screenshotPath);
    if (screenshots.length > MAX_SCREENSHOTS) {
      const oldPath = screenshots.shift();
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // Restore the original opacity on both windows
    mainWindow.setOpacity(currentOpacity);
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      controlBarWindow.setOpacity(controlBarOpacity);
    }
    
    console.log(`Screenshot saved: ${screenshotPath} (mode: ${captureMode})`);
    console.log(`Total screenshots: ${screenshots.length}`);
    
    sendToAllWindows('screenshot-taken-stealth', screenshots.length);
    
    return screenshotPath;
  } catch (error) {
    // Restore opacity on error (use saved value if available, otherwise default to 1.0)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1.0);
    }
    if (controlBarWindow && !controlBarWindow.isDestroyed()) {
      controlBarWindow.setOpacity(1.0);
    }
    console.error('Stealth screenshot error:', error);
    throw error;
  }
}

async function analyzeForMeetingWithContext(context = '') {
  console.log('Starting context-aware analysis...');
  console.log('Context length:', context.length);
  console.log('AI Service initialized:', !!aiService);
  console.log('Active provider:', aiService?.getActiveProvider() ?? 'none');
  console.log('Screenshots count:', screenshots.length);

  if (!aiService) {
    console.error('No AI service available');
    sendToAllWindows('analysis-result', {
      error: 'No API key configured. Please add at least one API key to your .env file.'
    });
    return;
  }

  if (!aiService.model) {
    console.error('AI model not initialized');
    sendToAllWindows('analysis-result', {
      error: 'AI model not initialized. Please check your API key.'
    });
    return;
  }

  if (screenshots.length === 0) {
    console.error('No screenshots to analyze');
    sendToAllWindows('analysis-result', {
      error: 'No screenshots to analyze. Take a screenshot first.'
    });
    return;
  }

  try {
    console.log('Sending analysis start signal...');
    sendToAllWindows('analysis-start');
    
    console.log('Processing screenshots...');
    const imageParts = await Promise.all(
      screenshots.map(async (screenshotPath) => {
        console.log(`Processing screenshot: ${screenshotPath}`);
        
        if (!fs.existsSync(screenshotPath)) {
          console.error(`Screenshot file not found: ${screenshotPath}`);
          throw new Error(`Screenshot file not found: ${screenshotPath}`);
        }
        
        const imageData = fs.readFileSync(screenshotPath);
        console.log(`Image data size: ${imageData.length} bytes`);
        
        return {
          inlineData: {
            data: imageData.toString('base64'),
            mimeType: 'image/png'
          }
        };
      })
    );

    console.log(`Prepared ${imageParts.length} image parts for analysis`);

    const contextPrompt = context ? `
    
CONVERSATION CONTEXT:
${context}

Based on the conversation context above and the screenshots provided, please:
1. Answer any questions that were asked in the conversation
2. Provide relevant insights about what's shown in the screenshots
3. If there are specific questions in the context, focus on answering those
4. Be concise but comprehensive

FORMAT YOUR RESPONSE AS:
    ` : '';

    const prompt = `You are an expert AI assistant for technical meetings and interviews. Analyze the provided screenshots and conversation context.

${contextPrompt}

**CODE SOLUTION:**
\`\`\`[language]
[Your complete, working code solution here - if applicable]
\`\`\`

**ANALYSIS:**
[Clear explanation of what you see in the screenshots and answers to any questions from the conversation]

**KEY INSIGHTS:**
• [Important insight 1]
• [Important insight 2]
• [Important insight 3]

Rules:
1. If there are questions in the conversation context, answer them directly
2. Provide code solutions if the screenshots show coding problems
3. Be concise but complete
4. Focus on actionable insights
5. If it's a meeting/presentation, summarize key points
6. Include time/space complexity for coding solutions

Analyze the screenshots and conversation context:`;

    const activeProvider = aiService.getActiveProvider();
    console.log(`Sending request to ${activeProvider} with rate limiting...`);
    const text = await aiService.generateMultimodal([prompt, ...imageParts]);
    console.log(`Received response from ${activeProvider}`);
    
    console.log('Generated text length:', text.length);
    console.log('Generated text preview:', text.substring(0, 200) + '...');

    chatContext.push({
      type: 'analysis',
      content: text,
      timestamp: new Date().toISOString(),
      screenshotCount: screenshots.length,
      provider: activeProvider
    });

    sendToAllWindows('analysis-result', { text, provider: activeProvider });
    console.log('Analysis result sent to renderer');
    
  } catch (error) {
    console.error('Analysis error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Analysis failed';
    
    if (error.message.includes('API_KEY') || error.message.includes('api_key')) {
      errorMessage = 'Invalid API key. Please check your API key configuration.';
    } else if (error.message.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('model')) {
      errorMessage = 'AI model error. Please try a different provider.';
    } else {
      errorMessage = `Analysis failed: ${error.message}`;
    }
    
    sendToAllWindows('analysis-result', {
      error: errorMessage
    });
  }
}

async function analyzeForMeeting() {
  await analyzeForMeetingWithContext();
}

// ============================================================================
// IPC HANDLERS - Core Functionality
// ============================================================================

ipcMain.handle('get-screenshots-count', () => {
  console.log('IPC: get-screenshots-count called, returning:', screenshots.length);
  return screenshots.length;
});

ipcMain.handle('get-dev-mode-status', () => {
  console.log('IPC: get-dev-mode-status called');
  return {
    success: true,
    isDevelopment: isDevelopment(),
    contentProtectionEnabled: global.contentProtectionEnabled ?? !isDevelopment()
  };
});

ipcMain.handle('toggle-content-protection', () => {
  console.log('IPC: toggle-content-protection called');
  
  // Toggle the content protection state
  global.contentProtectionEnabled = !global.contentProtectionEnabled;
  
  // Phase 6: Apply content protection to both windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setContentProtection(global.contentProtectionEnabled);
  }
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.setContentProtection(global.contentProtectionEnabled);
  }
  
  const status = global.contentProtectionEnabled ? 'ENABLED (stealth)' : 'DISABLED (debug)';
  console.log(`Content protection toggled: ${status}`);
  
  return {
    success: true,
    contentProtectionEnabled: global.contentProtectionEnabled
  };
});

ipcMain.handle('toggle-stealth', () => {
  console.log('IPC: toggle-stealth called');
  return toggleStealthMode();
});

ipcMain.handle('emergency-hide', () => {
  console.log('IPC: emergency-hide called');
  return emergencyHide();
});

ipcMain.handle('take-stealth-screenshot', async () => {
  console.log('IPC: take-stealth-screenshot called');
  return await takeStealthScreenshot();
});

ipcMain.handle('analyze-stealth', async () => {
  console.log('IPC: analyze-stealth called');
  return await analyzeForMeeting();
});

ipcMain.handle('analyze-stealth-with-context', async (event, context) => {
  console.log('IPC: analyze-stealth-with-context called with context length:', context.length);
  return await analyzeForMeetingWithContext(context);
});

ipcMain.handle('clear-stealth', () => {
  console.log('IPC: clear-stealth called');
  screenshots.forEach(screenshotPath => {
    if (fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
      console.log(`Deleted screenshot: ${screenshotPath}`);
    }
  });
  screenshots = [];
  chatContext = [];
  console.log('All screenshots and context cleared');
  return { success: true };
});

ipcMain.handle('close-app', () => {
  console.log('IPC: close-app called');
  app.quit();
  return { success: true };
});

// ============================================================================
// IPC HANDLERS - Phase 6: Region Menu, Theme Broadcast
// ============================================================================

ipcMain.handle('show-region-menu', () => {
  console.log('IPC: show-region-menu called');
  const template = [
    {
      label: 'Draw Region',
      click: () => openRegionOverlay()
    },
    {
      label: 'Pick Window',
      click: () => {
        // Open window picker modal in the transcript window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('open-window-picker');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Full Screen',
      click: () => {
        regionService.resetToFullScreen();
        const config = regionService.loadCaptureConfig();
        sendToAllWindows('capture-config-changed', config);
      }
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: controlBarWindow });
  return { success: true };
});

ipcMain.handle('broadcast-theme-change', (_, theme) => {
  console.log('IPC: broadcast-theme-change called with:', theme);
  sendToAllWindows('theme-changed', theme);
  return { success: true };
});

ipcMain.handle('get-panel-state', () => {
  return { success: true, state: settingsStore.getPanelState() };
});

ipcMain.handle('save-panel-state', (_, state) => {
  settingsStore.setPanelState(state);
  return { success: true };
});

// ============================================================================
// IPC HANDLERS - Region/Window Capture Selection (Phase 5)
// ============================================================================

ipcMain.handle('select-capture-region', () => {
  console.log('IPC: select-capture-region called');
  openRegionOverlay();
  return { success: true };
});

ipcMain.handle('confirm-capture-region', (_, bounds) => {
  console.log('IPC: confirm-capture-region called with:', bounds);
  
  // Validate bounds
  if (bounds === undefined || bounds === null ||
      typeof bounds.x !== 'number' || typeof bounds.y !== 'number' ||
      typeof bounds.width !== 'number' || typeof bounds.height !== 'number' ||
      bounds.width <= 0 || bounds.height <= 0) {
    console.error('Invalid region bounds:', bounds);
    destroyRegionOverlay();
    return { success: false, error: 'Invalid region bounds' };
  }

  // Save config
  regionService.saveCaptureConfig({
    mode: 'region',
    region: {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    }
  });

  destroyRegionOverlay();

  // Notify renderer of config change
  const config = regionService.loadCaptureConfig();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToAllWindows('capture-config-changed', config);
  }

  return { success: true, config };
});

ipcMain.handle('cancel-capture-region', () => {
  console.log('IPC: cancel-capture-region called');
  destroyRegionOverlay();
  return { success: true };
});

ipcMain.handle('get-open-windows', () => {
  console.log('IPC: get-open-windows called');
  try {
    // Pass the Electron executable path so the service can filter out
    // EchoAssist's own window(s). getNativeWindowHandle() returns a Buffer
    // which doesn't compare correctly with node-window-manager's numeric IDs.
    const selfExecPath = process.execPath;
    const windows = regionService.getOpenWindows(selfExecPath);
    return { success: true, windows };
  } catch (error) {
    console.error('Error getting open windows:', error.message);
    return { success: false, windows: [], error: error.message };
  }
});

ipcMain.handle('select-capture-window', (_, windowInfo) => {
  console.log('IPC: select-capture-window called with:', windowInfo);

  if (windowInfo === undefined || windowInfo === null) {
    return { success: false, error: 'No window info provided' };
  }

  regionService.saveCaptureConfig({
    mode: 'window',
    window: {
      title: windowInfo.title ?? '',
      processName: windowInfo.processName ?? '',
      followWindow: true
    }
  });

  const config = regionService.loadCaptureConfig();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToAllWindows('capture-config-changed', config);
  }

  return { success: true, config };
});

ipcMain.handle('reset-capture-mode', () => {
  console.log('IPC: reset-capture-mode called');
  regionService.resetToFullScreen();

  const config = regionService.loadCaptureConfig();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToAllWindows('capture-config-changed', config);
  }

  return { success: true, config };
});

ipcMain.handle('get-capture-config', () => {
  console.log('IPC: get-capture-config called');
  return {
    success: true,
    config: regionService.loadCaptureConfig()
  };
});

// ============================================================================
// IPC HANDLERS - Window Appearance
// ============================================================================

ipcMain.handle('set-window-opacity', (event, opacity) => {
  console.log('IPC: set-window-opacity called with:', opacity);
  // Clamp opacity between 0.3 and 1.0 for usability
  const clampedOpacity = Math.max(0.3, Math.min(1.0, opacity));
  // Phase 6: Apply opacity to both windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(clampedOpacity);
  }
  if (controlBarWindow && !controlBarWindow.isDestroyed()) {
    controlBarWindow.setOpacity(clampedOpacity);
  }
  return { success: true, opacity: clampedOpacity };
});

ipcMain.handle('get-window-opacity', () => {
  console.log('IPC: get-window-opacity called');
  if (mainWindow && !mainWindow.isDestroyed()) {
    return { success: true, opacity: mainWindow.getOpacity() };
  }
  return { success: false, error: 'Window not available' };
});

// ============================================================================
// IPC HANDLERS - Window Lock (Move/Resize Toggle)
// ============================================================================

ipcMain.handle('set-window-locked', (event, locked) => {
  console.log('IPC: set-window-locked called with:', locked);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMovable(!locked);
    mainWindow.setResizable(!locked);
    // Save lock state to settings
    settingsStore.setPanelState({
      transcript: {
        ...settingsStore.getPanelState().transcript,
        locked: locked
      }
    });
    return { success: true, locked };
  }
  return { success: false, error: 'Window not available' };
});

ipcMain.handle('get-window-locked', () => {
  console.log('IPC: get-window-locked called');
  const panelState = settingsStore.getPanelState();
  const locked = panelState.transcript?.locked ?? false;
  return { success: true, locked };
});

// ============================================================================
// IPC HANDLERS - AI Provider Management
// ============================================================================

ipcMain.handle('get-available-providers', () => {
  console.log('IPC: get-available-providers called');
  if (!aiService) {
    return { success: false, providers: [] };
  }
  return {
    success: true,
    providers: aiService.getProvidersInfo()
  };
});

ipcMain.handle('get-active-provider', () => {
  console.log('IPC: get-active-provider called');
  if (!aiService) {
    return { success: false, provider: null };
  }
  return {
    success: true,
    provider: aiService.getActiveProvider()
  };
});

ipcMain.handle('set-active-provider', async (event, provider) => {
  console.log('IPC: set-active-provider called with:', provider);
  if (!aiService) {
    return { success: false, error: 'AI service not initialized' };
  }
  
  const success = aiService.setActiveProvider(provider);
  if (success) {
    // Notify renderer of provider change
    sendToAllWindows('provider-changed', {
      provider: aiService.getActiveProvider(),
      info: aiService.getProvidersInfo().find(p => p.isActive)
    });
  }
  
  return {
    success,
    provider: aiService.getActiveProvider(),
    error: success ? undefined : `Provider '${provider}' not available`
  };
});

// ============================================================================
// IPC HANDLERS - Settings Management
// ============================================================================

ipcMain.handle('get-all-settings', () => {
  console.log('IPC: get-all-settings called');
  return {
    success: true,
    settings: settingsStore.getAllSettings()
  };
});

ipcMain.handle('get-api-key-status', () => {
  console.log('IPC: get-api-key-status called');
  return {
    success: true,
    configured: settingsStore.getConfiguredProviders(),
    encryptionAvailable: settingsStore.isEncryptionAvailable()
  };
});

ipcMain.handle('set-api-key', async (event, { provider, apiKey }) => {
  console.log('IPC: set-api-key called for:', provider);
  try {
    settingsStore.setApiKey(provider, apiKey);
    
    // Reinitialize AI services with new key
    aiService = initializeAIServices();
    
    // Notify renderer of provider availability change
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('settings-changed', {
        type: 'api-keys',
        configured: settingsStore.getConfiguredProviders()
      });
      
      // Also send updated providers list
      if (aiService) {
        sendToAllWindows('providers-updated', {
          providers: aiService.getProvidersInfo(),
          active: aiService.getActiveProvider()
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to set API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-api-key', async (event, provider) => {
  console.log('IPC: clear-api-key called for:', provider);
  try {
    settingsStore.clearApiKey(provider);
    
    // Reinitialize AI services
    aiService = initializeAIServices();
    
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('settings-changed', {
        type: 'api-keys',
        configured: settingsStore.getConfiguredProviders()
      });
      
      if (aiService) {
        sendToAllWindows('providers-updated', {
          providers: aiService.getProvidersInfo(),
          active: aiService.getActiveProvider()
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to clear API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ai-settings', () => {
  console.log('IPC: get-ai-settings called');
  return {
    success: true,
    settings: settingsStore.getAISettings()
  };
});

ipcMain.handle('set-ai-settings', async (event, settings) => {
  console.log('IPC: set-ai-settings called with:', settings);
  try {
    settingsStore.setAISettings(settings);
    
    // If default provider changed, try to switch to it
    if (settings.defaultProvider && aiService) {
      aiService.setActiveProvider(settings.defaultProvider);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to set AI settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-available-models', async (event, provider) => {
  console.log('IPC: fetch-available-models called for:', provider);
  try {
    if (!aiService) {
      return { success: false, error: 'AI service not initialized' };
    }
    
    const service = aiService.getProvider(provider);
    if (!service) {
      return { success: false, error: `Provider ${provider} not available` };
    }
    
    // Check if the service has a method to fetch models
    if (typeof service.fetchAvailableModels === 'function') {
      const models = await service.fetchAvailableModels();
      return { success: true, models };
    }
    
    // Fallback: return known models with vision info
    const knownModels = getKnownModels(provider);
    return { success: true, models: knownModels };
    
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return { success: false, error: error.message };
  }
});

// Known models fallback
function getKnownModels(provider) {
  const models = {
    gemini: [
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Fast)', vision: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', vision: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', vision: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Best)', vision: true }
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', vision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', vision: true },
      { id: 'gpt-4', name: 'GPT-4', vision: false },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', vision: false }
    ],
    anthropic: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Latest)', vision: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', vision: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', vision: true },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', vision: true },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)', vision: true }
    ],
    openrouter: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', vision: true },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', vision: true },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', vision: true },
      { id: 'openai/gpt-4o', name: 'GPT-4o', vision: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', vision: true },
      { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', vision: true },
      { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', vision: true },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', vision: false },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', vision: false }
    ]
  };
  
  return models[provider] ?? [];
}

ipcMain.handle('get-ui-settings', () => {
  console.log('IPC: get-ui-settings called');
  return {
    success: true,
    settings: settingsStore.getUISettings()
  };
});

ipcMain.handle('set-ui-settings', async (event, settings) => {
  console.log('IPC: set-ui-settings called with:', settings);
  try {
    settingsStore.setUISettings(settings);
    
    // Apply UI settings immediately
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (settings.opacity !== undefined) {
        mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, settings.opacity)));
      }
      if (settings.alwaysOnTop !== undefined) {
        mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
      }
    }
    
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('settings-changed', {
        type: 'ui',
        settings: settingsStore.getUISettings()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to set UI settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-voice-settings', () => {
  console.log('IPC: get-voice-settings called');
  return {
    success: true,
    settings: settingsStore.getVoiceSettings()
  };
});

ipcMain.handle('set-voice-settings', async (event, settings) => {
  console.log('IPC: set-voice-settings called with:', settings);
  try {
    settingsStore.setVoiceSettings(settings);
    return { success: true };
  } catch (error) {
    console.error('Failed to set voice settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-screenshot-settings', () => {
  console.log('IPC: get-screenshot-settings called');
  return {
    success: true,
    settings: settingsStore.getScreenshotSettings()
  };
});

ipcMain.handle('set-screenshot-settings', async (event, settings) => {
  console.log('IPC: set-screenshot-settings called with:', settings);
  try {
    settingsStore.setScreenshotSettings(settings);
    return { success: true };
  } catch (error) {
    console.error('Failed to set screenshot settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-correction-settings', () => {
  console.log('IPC: get-correction-settings called');
  return {
    success: true,
    settings: settingsStore.getCorrectionSettings()
  };
});

ipcMain.handle('set-correction-settings', async (event, settings) => {
  console.log('IPC: set-correction-settings called with:', settings);
  try {
    settingsStore.setCorrectionSettings(settings);
    
    // Notify main window of settings change
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('correction-settings-changed', settings);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to set correction settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('complete-setup', () => {
  console.log('IPC: complete-setup called');
  settingsStore.completeSetup();
  return { success: true };
});

ipcMain.handle('reset-settings', () => {
  console.log('IPC: reset-settings called');
  try {
    settingsStore.resetToDefaults();
    aiService = initializeAIServices();
    return { success: true };
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('has-completed-setup', () => {
  return {
    success: true,
    completed: settingsStore.hasCompletedSetup()
  };
});

// ============================================================================
// IPC HANDLERS - Vosk Model Management
// ============================================================================

// Vosk model configurations - three sizes available
const VOSK_MODELS = {
  small: {
    name: 'vosk-model-small-en-us-0.15',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    size: 50000000, // ~50MB
    sizeDesc: '~50 MB',
    description: 'Fast but less accurate'
  },
  medium: {
    name: 'vosk-model-en-us-0.22-lgraph',
    url: 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip',
    size: 500000000, // ~500MB
    sizeDesc: '~500 MB',
    description: 'Good balance of speed and accuracy'
  },
  large: {
    name: 'vosk-model-en-us-0.22',
    url: 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip',
    size: 1800000000, // ~1.8GB
    sizeDesc: '~1.8 GB',
    description: 'Most accurate but slower'
  }
};

function getVoskModelDir() {
  return path.join(os.homedir(), '.vosk_models');
}

function getLocalModelsDir() {
  // Local models directory for development
  return isDevelopment()
    ? path.join(__dirname, '..', 'models')
    : path.join(process.resourcesPath, 'models');
}

function getVoskModelPath(modelSize = 'large') {
  const modelConfig = VOSK_MODELS[modelSize];
  if (!modelConfig) {
    console.error(`Invalid model size: ${modelSize}`);
    return null;
  }
  return path.join(getVoskModelDir(), modelConfig.name);
}

function isVoskModelInstalled(modelSize = 'large') {
  const modelPath = getVoskModelPath(modelSize);
  if (modelPath === null) return false;
  return fs.existsSync(modelPath) && fs.statSync(modelPath).isDirectory();
}

// ============================================================================
// VOSK PREWARM - Pre-start model on app launch
// ============================================================================

async function prewarmVoskModel() {
  // Get voice settings to determine model size
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = voiceSettings.voskModelSize ?? 'large';
  
  // Check if model is installed first
  if (!isVoskModelInstalled(modelSize)) {
    console.log(`Vosk ${modelSize} model not installed - skipping prewarm`);
    voskPrewarmStatus = 'not_installed';
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('vosk-prewarm-status', {
        status: 'not_installed',
        message: 'Model not installed',
        modelSize
      });
    }
    return { success: false, reason: 'model_not_installed' };
  }
  
  // Don't prewarm if already running
  if (voskProcess !== null) {
    console.log('Vosk already running - skipping prewarm');
    return { success: true, reason: 'already_running' };
  }
  
  console.log(`Pre-warming Vosk ${modelSize} model...`);
  voskPrewarmStatus = 'loading';
  
  // Notify renderer of prewarm start
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToAllWindows('vosk-prewarm-status', {
      status: 'loading',
      message: `Loading ${modelSize} speech model...`,
      modelSize
    });
  }
  
  try {
    const pythonScript = isDevelopment()
      ? path.join(__dirname, '..', 'vosk_live.py')
      : path.join(process.resourcesPath, 'vosk_live.py');
    
    console.log('Starting Vosk prewarm:', pythonScript);
    console.log(`Using ${modelSize} model, isDevelopment: ${isDevelopment()}`);
    
    // Build command arguments
    const args = [pythonScript, '--model-size', modelSize];
    
    // In development mode, pass the local models directory
    if (isDevelopment()) {
      args.push('--dev');
      args.push('--models-dir', getLocalModelsDir());
    }
    
    console.log('Vosk prewarm args:', args);
    
    voskProcess = spawn('python', args);
    isVoskRunning = true;
    voskStdoutBuffer = ''; // Reset buffer for new process
    
    // Handle stdout (JSON transcription results) with line buffering
    voskProcess.stdout.on('data', (data) => {
      processVoskStdout(data.toString(), (result) => {
        switch (result.type) {
          case 'status':
            console.log(`Vosk prewarm status: ${result.status} - ${result.message}`);
            
            // Track prewarm status
            if (result.status === 'ready' || result.status === 'listening') {
              isVoskPrewarmed = true;
              voskPrewarmStatus = 'ready';
            } else if (result.status === 'loading') {
              voskPrewarmStatus = 'loading';
            }
            
            // Forward status to renderer
            sendToAllWindows('vosk-status', result);
            sendToAllWindows('vosk-prewarm-status', {
              status: voskPrewarmStatus,
              message: result.message,
              modelSize
            });
            break;
            
          case 'partial':
            // Forward partial result — renderer decides whether to display based on isRecording
            sendToAllWindows('vosk-partial', { text: result.text });
            break;
            
          case 'final':
            // Forward final result — renderer decides whether to display based on isRecording
            console.log('Vosk transcription:', result.text, result.speaker_changed ? '(speaker changed)' : '');
            sendToAllWindows('vosk-final', { 
              text: result.text,
              speaker_changed: result.speaker_changed === true
            });
            
            // Add to AI service history
            if (aiService && result.text) {
              aiService.addToHistory('user', result.text);
            }
            break;
            
          case 'error':
            console.error('Vosk error:', result.error);
            voskPrewarmStatus = 'error';
            sendToAllWindows('vosk-error', { error: result.error });
            sendToAllWindows('vosk-prewarm-status', {
              status: 'error',
              message: result.error,
              modelSize
            });
            break;
        }
      });
    });
    
    voskProcess.stderr.on('data', (data) => {
      console.error('Vosk stderr:', data.toString());
    });
    
    voskProcess.on('close', (code) => {
      console.log('Vosk process exited with code:', code);
      isVoskRunning = false;
      isVoskPrewarmed = false;
      voskPrewarmStatus = 'idle';
      voskProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        sendToAllWindows('vosk-stopped');
        sendToAllWindows('vosk-prewarm-status', {
          status: 'idle',
          message: 'Speech model stopped',
          modelSize
        });
      }
    });
    
    voskProcess.on('error', (error) => {
      console.error('Failed to start Vosk:', error.message);
      isVoskRunning = false;
      isVoskPrewarmed = false;
      voskPrewarmStatus = 'error';
      voskProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        sendToAllWindows('vosk-prewarm-status', {
          status: 'error',
          message: 'Python or Vosk not installed',
          modelSize
        });
      }
    });
    
    return { success: true, modelSize };
    
  } catch (error) {
    console.error('Error pre-warming Vosk:', error.message);
    isVoskRunning = false;
    isVoskPrewarmed = false;
    voskPrewarmStatus = 'error';
    return { success: false, error: error.message };
  }
}

function isLocalModelAvailable(modelSize = 'large') {
  // Check if the local zip file exists (for development)
  const localModelsDir = getLocalModelsDir();
  const modelConfig = VOSK_MODELS[modelSize];
  if (!modelConfig) return false;
  
  const zipPath = path.join(localModelsDir, `${modelConfig.name}.zip`);
  return fs.existsSync(zipPath);
}

function getAvailableLocalModels() {
  // Returns which models are available locally (as zip files)
  const localModelsDir = getLocalModelsDir();
  const available = {};
  
  for (const [size, config] of Object.entries(VOSK_MODELS)) {
    const zipPath = path.join(localModelsDir, `${config.name}.zip`);
    available[size] = fs.existsSync(zipPath);
  }
  
  return available;
}

// Track download state
let voskDownloadProgress = 0;
let isDownloadingVoskModel = false;

ipcMain.handle('get-vosk-model-status', () => {
  console.log('IPC: get-vosk-model-status called');
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = voiceSettings.voskModelSize ?? 'large';
  const modelConfig = VOSK_MODELS[modelSize];
  const installed = isVoskModelInstalled(modelSize);
  const localAvailable = getAvailableLocalModels();
  
  return {
    success: true,
    installed,
    modelSize,
    modelName: modelConfig?.name ?? 'unknown',
    modelPath: getVoskModelPath(modelSize),
    modelSizeDesc: modelConfig?.sizeDesc ?? 'unknown',
    modelDescription: modelConfig?.description ?? '',
    isDownloading: isDownloadingVoskModel,
    downloadProgress: voskDownloadProgress,
    isDevelopment: isDevelopment(),
    localModelsAvailable: localAvailable,
    allModels: Object.entries(VOSK_MODELS).map(([size, config]) => ({
      size,
      name: config.name,
      sizeDesc: config.sizeDesc,
      description: config.description,
      installed: isVoskModelInstalled(size),
      localAvailable: localAvailable[size]
    }))
  };
});

ipcMain.handle('download-vosk-model', async (event, requestedModelSize = null) => {
  console.log('IPC: download-vosk-model called');
  
  // Get model size from settings or use requested size
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = requestedModelSize ?? voiceSettings.voskModelSize ?? 'large';
  const modelConfig = VOSK_MODELS[modelSize];
  
  if (!modelConfig) {
    return { success: false, error: `Invalid model size: ${modelSize}` };
  }
  
  if (isVoskModelInstalled(modelSize)) {
    return { success: true, message: 'Model already installed' };
  }
  
  if (isDownloadingVoskModel) {
    return { success: false, error: 'Download already in progress' };
  }
  
  // In development mode, try to extract from local zip first
  if (isDevelopment() && isLocalModelAvailable(modelSize)) {
    console.log(`Development mode: extracting local ${modelSize} model...`);
    return await extractLocalVoskModel(modelSize);
  }
  
  // Production mode or local zip not available: download from URL
  isDownloadingVoskModel = true;
  voskDownloadProgress = 0;
  
  try {
    const modelDir = getVoskModelDir();
    const zipPath = path.join(modelDir, `${modelConfig.name}.zip`);
    
    // Ensure model directory exists
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Notify start
    sendToAllWindows('vosk-download-progress', {
      status: 'downloading',
      progress: 0,
      message: `Starting download of ${modelSize} model (${modelConfig.sizeDesc})...`,
      modelSize
    });
    
    // Download using https module
    const https = require('https');
    const file = fs.createWriteStream(zipPath);
    
    return new Promise((resolve, reject) => {
      const request = https.get(modelConfig.url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          https.get(response.headers.location, handleResponse);
          return;
        }
        
        handleResponse(response);
        
        function handleResponse(res) {
          const totalSize = parseInt(res.headers['content-length'], 10) || modelConfig.size;
          let downloadedSize = 0;
          
          res.on('data', (chunk) => {
            downloadedSize += chunk.length;
            file.write(chunk);
            
            voskDownloadProgress = Math.round((downloadedSize / totalSize) * 100);
            
            // Send progress every 2%
            if (voskDownloadProgress % 2 === 0) {
              sendToAllWindows('vosk-download-progress', {
                status: 'downloading',
                progress: voskDownloadProgress,
                message: `Downloading ${modelSize}: ${voskDownloadProgress}% (${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB)`,
                modelSize
              });
            }
          });
          
          res.on('end', async () => {
            file.end();
            
            // Extract
            sendToAllWindows('vosk-download-progress', {
              status: 'extracting',
              progress: 100,
              message: `Extracting ${modelSize} model...`,
              modelSize
            });
            
            try {
              // Use spawn to extract with unzip (cross-platform alternative)
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(zipPath);
              zip.extractAllTo(modelDir, true);
              
              // Clean up zip file
              fs.unlinkSync(zipPath);
              
              isDownloadingVoskModel = false;
              voskDownloadProgress = 100;
              
              sendToAllWindows('vosk-download-progress', {
                status: 'complete',
                progress: 100,
                message: `${modelSize.charAt(0).toUpperCase() + modelSize.slice(1)} model installed successfully!`,
                modelSize
              });
              
              sendToAllWindows('vosk-model-installed', { installed: true, modelSize });
              
              resolve({ success: true, message: 'Model installed successfully', modelSize });
              
            } catch (extractError) {
              console.error('Extract error:', extractError);
              isDownloadingVoskModel = false;
              
              sendToAllWindows('vosk-download-progress', {
                status: 'error',
                progress: 0,
                message: `Extract failed: ${extractError.message}`,
                modelSize
              });
              
              reject({ success: false, error: extractError.message });
            }
          });
          
          res.on('error', (err) => {
            file.end();
            isDownloadingVoskModel = false;
            
            sendToAllWindows('vosk-download-progress', {
              status: 'error',
              progress: 0,
              message: `Download failed: ${err.message}`,
              modelSize
            });
            
            reject({ success: false, error: err.message });
          });
        }
      });
      
      request.on('error', (err) => {
        isDownloadingVoskModel = false;
        
        sendToAllWindows('vosk-download-progress', {
          status: 'error',
          progress: 0,
          message: `Download failed: ${err.message}`,
          modelSize
        });
        
        reject({ success: false, error: err.message });
      });
    });
    
  } catch (error) {
    console.error('Vosk download error:', error);
    isDownloadingVoskModel = false;
    return { success: false, error: error.message };
  }
});

// Helper function to extract local model (development mode)
async function extractLocalVoskModel(modelSize) {
  const modelConfig = VOSK_MODELS[modelSize];
  if (!modelConfig) {
    return { success: false, error: `Invalid model size: ${modelSize}` };
  }
  
  const localModelsDir = getLocalModelsDir();
  const modelDir = getVoskModelDir();
  const localZipPath = path.join(localModelsDir, `${modelConfig.name}.zip`);
  
  if (!fs.existsSync(localZipPath)) {
    return { success: false, error: `Local model zip not found: ${localZipPath}` };
  }
  
  isDownloadingVoskModel = true;
  voskDownloadProgress = 0;
  
  try {
    // Ensure model directory exists
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    sendToAllWindows('vosk-download-progress', {
      status: 'extracting',
      progress: 0,
      message: `Extracting local ${modelSize} model...`,
      modelSize
    });
    
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(localZipPath);
    
    // Get entry count for progress
    const entries = zip.getEntries();
    const totalEntries = entries.length;
    let extractedEntries = 0;
    
    // Extract to model directory
    zip.extractAllTo(modelDir, true);
    
    isDownloadingVoskModel = false;
    voskDownloadProgress = 100;
    
    sendToAllWindows('vosk-download-progress', {
      status: 'complete',
      progress: 100,
      message: `Local ${modelSize} model extracted successfully!`,
      modelSize
    });
    
    sendToAllWindows('vosk-model-installed', { installed: true, modelSize });
    
    return { success: true, message: `Local ${modelSize} model extracted successfully`, modelSize };
    
  } catch (error) {
    console.error('Local model extraction error:', error);
    isDownloadingVoskModel = false;
    
    sendToAllWindows('vosk-download-progress', {
      status: 'error',
      progress: 0,
      message: `Extraction failed: ${error.message}`,
      modelSize
    });
    
    return { success: false, error: error.message };
  }
}

ipcMain.handle('delete-vosk-model', async (event, requestedModelSize = null) => {
  console.log('IPC: delete-vosk-model called');
  
  // Get model size from settings or use requested size
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = requestedModelSize ?? voiceSettings.voskModelSize ?? 'large';
  const modelPath = getVoskModelPath(modelSize);
  
  if (modelPath === null) {
    return { success: false, error: `Invalid model size: ${modelSize}` };
  }
  
  if (!fs.existsSync(modelPath)) {
    return { success: true, message: 'Model not installed' };
  }
  
  try {
    // Recursively delete the model directory
    fs.rmSync(modelPath, { recursive: true, force: true });
    
    sendToAllWindows('vosk-model-installed', { installed: false, modelSize });
    
    return { success: true, message: `${modelSize} model deleted`, modelSize };
  } catch (error) {
    console.error('Failed to delete Vosk model:', error);
    return { success: false, error: error.message };
  }
});

// New handler to set the Vosk model size preference
ipcMain.handle('set-vosk-model-size', async (event, modelSize) => {
  console.log('IPC: set-vosk-model-size called with:', modelSize);
  
  if (!VOSK_MODELS[modelSize]) {
    return { success: false, error: `Invalid model size: ${modelSize}` };
  }
  
  try {
    settingsStore.setVoiceSettings({ voskModelSize: modelSize });
    return { 
      success: true, 
      modelSize,
      installed: isVoskModelInstalled(modelSize),
      localAvailable: isLocalModelAvailable(modelSize)
    };
  } catch (error) {
    console.error('Failed to set Vosk model size:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC HANDLERS - Settings Window
// ============================================================================

ipcMain.handle('open-settings', () => {
  console.log('IPC: open-settings called');
  createSettingsWindow();
  return { success: true };
});

ipcMain.handle('close-settings-window', () => {
  console.log('IPC: close-settings-window called');
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  return { success: true };
});

// ============================================================================
// IPC HANDLERS - Speaker Model Management
// ============================================================================

function getSpeakerModelPath() {
  return path.join(getVoskModelDir(), VOSK_SPEAKER_MODEL.name);
}

function isSpeakerModelInstalled() {
  const modelPath = getSpeakerModelPath();
  return fs.existsSync(modelPath) && fs.statSync(modelPath).isDirectory();
}

function isLocalSpeakerModelAvailable() {
  const localModelsDir = getLocalModelsDir();
  const zipPath = path.join(localModelsDir, `${VOSK_SPEAKER_MODEL.name}.zip`);
  return fs.existsSync(zipPath);
}

ipcMain.handle('get-speaker-model-status', () => {
  console.log('IPC: get-speaker-model-status called');
  
  return {
    success: true,
    installed: isSpeakerModelInstalled(),
    modelName: VOSK_SPEAKER_MODEL.name,
    modelPath: getSpeakerModelPath(),
    sizeDesc: VOSK_SPEAKER_MODEL.sizeDesc,
    localAvailable: isLocalSpeakerModelAvailable(),
    isDevelopment: isDevelopment()
  };
});

let isDownloadingSpeakerModel = false;

ipcMain.handle('download-speaker-model', async () => {
  console.log('IPC: download-speaker-model called');
  
  if (isSpeakerModelInstalled()) {
    return { success: true, message: 'Speaker model already installed' };
  }
  
  if (isDownloadingSpeakerModel) {
    return { success: false, error: 'Download already in progress' };
  }
  
  // In development mode, try to extract from local zip first
  if (isDevelopment() && isLocalSpeakerModelAvailable()) {
    console.log('Development mode: extracting local speaker model...');
    return await extractLocalSpeakerModel();
  }
  
  isDownloadingSpeakerModel = true;
  
  try {
    const modelDir = getVoskModelDir();
    const zipPath = path.join(modelDir, `${VOSK_SPEAKER_MODEL.name}.zip`);
    
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Send progress to both main window and settings window
    const sendProgress = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        sendToAllWindows('speaker-model-progress', data);
      }
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('speaker-model-progress', data);
      }
    };
    
    sendProgress({
      status: 'downloading',
      progress: 0,
      message: 'Starting download...'
    });
    
    const https = require('https');
    const file = fs.createWriteStream(zipPath);
    
    return new Promise((resolve, reject) => {
      const request = https.get(VOSK_SPEAKER_MODEL.url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          https.get(response.headers.location, handleResponse);
          return;
        }
        handleResponse(response);
        
        function handleResponse(res) {
          const totalSize = parseInt(res.headers['content-length'], 10) || VOSK_SPEAKER_MODEL.size;
          let downloadedSize = 0;
          
          res.on('data', (chunk) => {
            downloadedSize += chunk.length;
            file.write(chunk);
            
            const progress = Math.round((downloadedSize / totalSize) * 100);
            
            if (progress % 5 === 0) {
              sendProgress({
                status: 'downloading',
                progress,
                message: `Downloading: ${progress}%`
              });
            }
          });
          
          res.on('end', async () => {
            file.end();
            
            sendProgress({
              status: 'extracting',
              progress: 100,
              message: 'Extracting...'
            });
            
            try {
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(zipPath);
              zip.extractAllTo(modelDir, true);
              
              fs.unlinkSync(zipPath);
              
              isDownloadingSpeakerModel = false;
              
              sendProgress({
                status: 'complete',
                progress: 100,
                message: 'Speaker model installed!'
              });
              
              // Notify both windows
              const installedData = { installed: true };
              if (mainWindow && !mainWindow.isDestroyed()) {
                sendToAllWindows('speaker-model-installed', installedData);
              }
              if (settingsWindow && !settingsWindow.isDestroyed()) {
                settingsWindow.webContents.send('speaker-model-installed', installedData);
              }
              
              resolve({ success: true, message: 'Speaker model installed' });
              
            } catch (extractError) {
              console.error('Extract error:', extractError);
              isDownloadingSpeakerModel = false;
              
              sendProgress({
                status: 'error',
                progress: 0,
                message: `Extract failed: ${extractError.message}`
              });
              
              reject({ success: false, error: extractError.message });
            }
          });
          
          res.on('error', (err) => {
            file.end();
            isDownloadingSpeakerModel = false;
            
            sendProgress({
              status: 'error',
              progress: 0,
              message: `Download failed: ${err.message}`
            });
            
            reject({ success: false, error: err.message });
          });
        }
      });
      
      request.on('error', (err) => {
        isDownloadingSpeakerModel = false;
        
        sendProgress({
          status: 'error',
          progress: 0,
          message: `Download failed: ${err.message}`
        });
        
        reject({ success: false, error: err.message });
      });
    });
    
  } catch (error) {
    console.error('Speaker model download error:', error);
    isDownloadingSpeakerModel = false;
    return { success: false, error: error.message };
  }
});

async function extractLocalSpeakerModel() {
  const localModelsDir = getLocalModelsDir();
  const modelDir = getVoskModelDir();
  const localZipPath = path.join(localModelsDir, `${VOSK_SPEAKER_MODEL.name}.zip`);
  
  if (!fs.existsSync(localZipPath)) {
    return { success: false, error: 'Local speaker model zip not found' };
  }
  
  isDownloadingSpeakerModel = true;
  
  const sendProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('speaker-model-progress', data);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('speaker-model-progress', data);
    }
  };
  
  try {
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    sendProgress({
      status: 'extracting',
      progress: 0,
      message: 'Extracting local speaker model...'
    });
    
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(localZipPath);
    zip.extractAllTo(modelDir, true);
    
    isDownloadingSpeakerModel = false;
    
    sendProgress({
      status: 'complete',
      progress: 100,
      message: 'Speaker model extracted!'
    });
    
    const installedData = { installed: true };
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('speaker-model-installed', installedData);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('speaker-model-installed', installedData);
    }
    
    return { success: true, message: 'Local speaker model extracted' };
    
  } catch (error) {
    console.error('Local speaker model extraction error:', error);
    isDownloadingSpeakerModel = false;
    
    sendProgress({
      status: 'error',
      progress: 0,
      message: `Extraction failed: ${error.message}`
    });
    
    return { success: false, error: error.message };
  }
}

ipcMain.handle('delete-speaker-model', async () => {
  console.log('IPC: delete-speaker-model called');
  
  const modelPath = getSpeakerModelPath();
  
  if (!fs.existsSync(modelPath)) {
    return { success: true, message: 'Speaker model not installed' };
  }
  
  try {
    fs.rmSync(modelPath, { recursive: true, force: true });
    
    const installedData = { installed: false };
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendToAllWindows('speaker-model-installed', installedData);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('speaker-model-installed', installedData);
    }
    
    return { success: true, message: 'Speaker model deleted' };
  } catch (error) {
    console.error('Failed to delete speaker model:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC HANDLERS - Voice Recognition (Vosk)
// ============================================================================

ipcMain.handle('get-vosk-prewarm-status', () => {
  console.log('IPC: get-vosk-prewarm-status called');
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = voiceSettings.voskModelSize ?? 'large';
  
  return {
    success: true,
    status: voskPrewarmStatus,
    isPrewarmed: isVoskPrewarmed,
    isRunning: isVoskRunning,
    modelSize,
    installed: isVoskModelInstalled(modelSize)
  };
});

ipcMain.handle('prewarm-vosk-model', async () => {
  console.log('IPC: prewarm-vosk-model called');
  return await prewarmVoskModel();
});

ipcMain.handle('start-voice-recognition', () => {
  console.log('IPC: start-voice-recognition called');
  
  // Get voice settings to determine model size
  const voiceSettings = settingsStore.getVoiceSettings();
  const modelSize = voiceSettings.voskModelSize ?? 'large';
  
  // Check if model is installed first
  if (!isVoskModelInstalled(modelSize)) {
    console.log(`Vosk ${modelSize} model not installed`);
    return { 
      success: false, 
      error: `Vosk ${modelSize} model not installed. Please download it from Settings first.`,
      needsModel: true,
      modelSize
    };
  }

  // If Vosk is already prewarmed and running, just signal that recording started
  if (isVoskRunning && isVoskPrewarmed) {
    console.log('Vosk already prewarmed and running - recording started');
    sendToAllWindows('vosk-status', {
      status: 'listening',
      message: 'Listening...'
    });
    return { success: true, modelSize, prewarmed: true };
  }

  if (isVoskRunning) {
    console.log('Vosk already running');
    return { success: true, message: 'Already running' };
  }

  // If not prewarmed, start the Vosk process now (fallback)
  console.log('Vosk not prewarmed - starting fresh...');
  
  try {
    const pythonScript = isDevelopment()
      ? path.join(__dirname, '..', 'vosk_live.py')
      : path.join(process.resourcesPath, 'vosk_live.py');
    console.log('Starting Vosk live transcription:', pythonScript);
    console.log(`Using ${modelSize} model, isDevelopment: ${isDevelopment()}`);

    // Build command arguments
    const args = [pythonScript, '--model-size', modelSize];
    
    // In development mode, pass the local models directory
    if (isDevelopment()) {
      args.push('--dev');
      args.push('--models-dir', getLocalModelsDir());
    }
    
    console.log('Vosk command args:', args);

    voskProcess = spawn('python', args);
    isVoskRunning = true;
    voskStdoutBuffer = ''; // Reset buffer for new process

    // Handle stdout (JSON transcription results) with line buffering
    voskProcess.stdout.on('data', (data) => {
      processVoskStdout(data.toString(), (result) => {
        switch (result.type) {
          case 'status':
            console.log(`Vosk status: ${result.status} - ${result.message}`);
            
            if (result.status === 'ready' || result.status === 'listening') {
              isVoskPrewarmed = true;
              voskPrewarmStatus = 'ready';
            }
            
            sendToAllWindows('vosk-status', result);
            sendToAllWindows('vosk-prewarm-status', {
              status: voskPrewarmStatus,
              message: result.message,
              modelSize
            });
            break;

          case 'partial':
            sendToAllWindows('vosk-partial', { text: result.text });
            break;

          case 'final':
            console.log('Vosk transcription:', result.text, result.speaker_changed ? '(speaker changed)' : '');
            sendToAllWindows('vosk-final', { 
              text: result.text,
              speaker_changed: result.speaker_changed === true
            });

            // Add to AI service history
            if (aiService && result.text) {
              aiService.addToHistory('user', result.text);
            }
            break;

          case 'error':
            console.error('Vosk error:', result.error);
            voskPrewarmStatus = 'error';
            sendToAllWindows('vosk-error', { error: result.error });
            break;
        }
      });
    });

    voskProcess.stderr.on('data', (data) => {
      console.error('Vosk stderr:', data.toString());
    });

    voskProcess.on('close', (code) => {
      console.log('Vosk process exited with code:', code);
      isVoskRunning = false;
      isVoskPrewarmed = false;
      voskPrewarmStatus = 'idle';
      voskProcess = null;
      sendToAllWindows('vosk-stopped');
    });

    voskProcess.on('error', (error) => {
      console.error('Failed to start Vosk:', error.message);
      isVoskRunning = false;
      isVoskPrewarmed = false;
      voskPrewarmStatus = 'error';
      voskProcess = null;
      return { success: false, error: 'Python or Vosk not installed. See SETUP-VOSK.md' };
    });

    return { success: true, modelSize };

  } catch (error) {
    console.error('Error starting Vosk:', error.message);
    isVoskRunning = false;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-voice-recognition', () => {
  console.log('IPC: stop-voice-recognition called');

  if (!isVoskRunning || !voskProcess) {
    return { success: true, message: 'Not running' };
  }

  try {
    sendToAllWindows('vosk-status', {
      status: 'stopped',
      message: 'Paused listening'
    });
    return { success: true };
  } catch (error) {
    console.error('Error stopping Vosk:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC HANDLERS - Audio Transcription (Whisper)
// ============================================================================

ipcMain.handle('transcribe-audio', async (event, base64Audio, mimeType) => {
  console.log('IPC: transcribe-audio called, size:', base64Audio.length);

  const tmpDir = path.join(app.getPath('temp'), 'echoassist-audio');

  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const tempAudioPath = path.join(tmpDir, `audio_${Date.now()}.webm`);
    fs.writeFileSync(tempAudioPath, audioBuffer);

    console.log('Saved temp audio:', tempAudioPath, audioBuffer.length, 'bytes');

    return new Promise((resolve, reject) => {
      const pythonScript = isDevelopment()
        ? path.join(__dirname, '..', 'transcribe.py')
        : path.join(process.resourcesPath, 'transcribe.py');
      console.log('Running Python script:', pythonScript);

      const python = spawn('python', [pythonScript, tempAudioPath]);

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        try {
          fs.unlinkSync(tempAudioPath);
        } catch (e) {
          console.error('Failed to delete temp file:', e);
        }

        if (code !== 0) {
          console.error('Python exited with code:', code);
          console.error('Error:', errorOutput);
          resolve({ success: false, error: `Python error: ${errorOutput ?? 'Unknown error'}` });
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          console.log('Transcription:', result.text ?? result.error);

          if (result.success && result.text && aiService) {
            aiService.addToHistory('user', result.text.trim());
          }

          resolve({
            success: result.success,
            transcript: result.text ?? '',
            error: result.error
          });

        } catch (parseError) {
          console.error('Failed to parse output:', output);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      });

      python.on('error', (error) => {
        console.error('Failed to start Python:', error.message);

        try {
          fs.unlinkSync(tempAudioPath);
        } catch (e) {}

        resolve({
          success: false,
          error: 'Python not found. Install Python and run: pip install openai-whisper'
        });
      });
    });

  } catch (error) {
    console.error('Error in transcribe-audio:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC HANDLERS - AI Features (Suggestions, Notes, Insights)
// ============================================================================

ipcMain.handle('add-voice-transcript', async (event, transcript) => {
  console.log('IPC: add-voice-transcript called');
  if (aiService) {
    aiService.addToHistory('user', transcript);
  }
  return { success: true };
});

ipcMain.handle('suggest-response', async (event, context) => {
  console.log('IPC: suggest-response called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    const suggestions = await aiService.suggestResponse(context);
    return { success: true, suggestions, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-meeting-notes', async () => {
  console.log('IPC: generate-meeting-notes called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    const notes = await aiService.generateMeetingNotes();
    return { success: true, notes, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error generating meeting notes:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-follow-up-email', async () => {
  console.log('IPC: generate-follow-up-email called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    const email = await aiService.generateFollowUpEmail();
    return { success: true, email, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error generating email:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('answer-question', async (event, question) => {
  console.log('IPC: answer-question called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    const answer = await aiService.answerQuestion(question);
    return { success: true, answer, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error answering question:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-conversation-insights', async () => {
  console.log('IPC: get-conversation-insights called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    const insights = await aiService.getConversationInsights();
    return { success: true, insights, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error getting insights:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('analyze-with-ai', async (event, prompt, imageData) => {
  console.log('IPC: analyze-with-ai called');
  try {
    if (!aiService) {
      throw new Error('AI service not initialized');
    }
    
    let result;
    if (imageData) {
      // Multimodal analysis with image
      const imagePart = {
        inlineData: {
          data: imageData,
          mimeType: 'image/png'
        }
      };
      result = await aiService.generateMultimodal([prompt, imagePart]);
    } else {
      // Text-only analysis
      result = await aiService.generateText(prompt);
    }
    
    return { success: true, text: result, provider: aiService.getActiveProvider() };
  } catch (error) {
    console.error('Error in analyze-with-ai:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-conversation-history', async () => {
  console.log('IPC: clear-conversation-history called');
  try {
    if (aiService) {
      aiService.clearHistory();
    }
    chatContext = [];
    return { success: true };
  } catch (error) {
    console.error('Error clearing history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-conversation-history', async () => {
  console.log('IPC: get-conversation-history called');
  try {
    if (!aiService) {
      return { success: true, history: [] };
    }
    return { success: true, history: aiService.conversationHistory };
  } catch (error) {
    console.error('Error getting history:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// APP EVENT HANDLERS
// ============================================================================

app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createStealthWindow();
  registerStealthShortcuts();
  
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('allow-running-insecure-content');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('enable-media-stream');
  
  isVisible = true;
  
  console.log('Window setup complete - will show after content loads');
  
  // Pre-warm Vosk model after window is ready (if model is installed)
  // We delay slightly to ensure the renderer is ready to receive events
  setTimeout(async () => {
    console.log('Checking if Vosk model should be prewarmed...');
    const voiceSettings = settingsStore.getVoiceSettings();
    const modelSize = voiceSettings.voskModelSize ?? 'large';
    
    if (isVoskModelInstalled(modelSize)) {
      console.log('Vosk model is installed - starting prewarm...');
      await prewarmVoskModel();
    } else {
      console.log('Vosk model not installed - prewarm skipped');
    }
  }, 1500); // Delay to ensure renderer is ready
});

app.on('window-all-closed', () => {
  // Keep running in background for stealth operation
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createStealthWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  
  screenshots.forEach(screenshotPath => {
    if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
  });
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
  
  contents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
    }
  });
});

process.title = 'SystemIdleProcess';
})();
