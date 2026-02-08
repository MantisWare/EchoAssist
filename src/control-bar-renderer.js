// ============================================================================
// CONTROL BAR RENDERER - Phase 6: Modular Panel System
// ============================================================================
// Handles all control bar UI logic: button clicks, status updates,
// theme toggle, opacity slider, dev mode pill, labels, close button.
// ============================================================================

(() => {
  'use strict';

  // ========================================================================
  // STATE
  // ========================================================================

  let isRecording = false;
  let screenshotsCount = 0;
  let captureMode = 'fullScreen';
  let showLabels = false;
  let timerInterval = null;
  let timerSeconds = 0;
  let currentTheme = 'light';

  // ========================================================================
  // DOM REFERENCES
  // ========================================================================

  const statusDot = document.getElementById('status-dot');
  const timerDisplay = document.getElementById('timer-display');
  const screenshotCountEl = document.getElementById('screenshot-count');
  const devModePill = document.getElementById('dev-mode-pill');
  const devPillText = document.getElementById('dev-pill-text');
  const themeToggle = document.getElementById('theme-toggle');
  const transparencySlider = document.getElementById('transparency-slider');
  const transparencyValue = document.getElementById('transparency-value');
  const captureModeBadge = document.getElementById('capture-mode-badge');
  const labelsToggle = document.getElementById('labels-toggle');
  const closeBtn = document.getElementById('close-btn');

  // Action buttons
  const voiceToggle = document.getElementById('voice-toggle');
  const screenshotBtn = document.getElementById('screenshot-btn');
  const regionBtn = document.getElementById('region-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const suggestBtn = document.getElementById('suggest-btn');
  const notesBtn = document.getElementById('notes-btn');
  const insightsBtn = document.getElementById('insights-btn');
  const clearBtn = document.getElementById('clear-btn');
  const hideBtn = document.getElementById('hide-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  async function initialize() {
    console.log('[ControlBar] Initializing...');

    setupEventListeners();
    await loadInitialState();

    console.log('[ControlBar] Ready');
  }

  async function loadInitialState() {
    if (window.electronAPI === undefined) return;

    // Load dev mode status
    try {
      const devStatus = await window.electronAPI.getDevModeStatus();
      if (devStatus.success && devStatus.isDevelopment) {
        if (devModePill !== null) devModePill.classList.remove('hidden');
        updateDevPill(devStatus.contentProtectionEnabled);
      }
    } catch (err) {
      console.error('[ControlBar] Failed to load dev mode status:', err);
    }

    // Load UI settings (theme, opacity)
    try {
      const uiSettings = await window.electronAPI.getUISettings();
      if (uiSettings !== undefined && uiSettings !== null) {
        applyTheme(uiSettings.theme ?? 'dark');
        const opacity = uiSettings.opacity ?? 1;
        if (transparencySlider !== null) {
          transparencySlider.value = Math.round(opacity * 100);
        }
        if (transparencyValue !== null) {
          transparencyValue.textContent = Math.round(opacity * 100) + '%';
        }
        showLabels = uiSettings.showIconLabels === true;
        updateLabelsVisibility();
      }
    } catch (err) {
      console.error('[ControlBar] Failed to load UI settings:', err);
    }

    // Load screenshot count
    try {
      const count = await window.electronAPI.getScreenshotsCount();
      screenshotsCount = count ?? 0;
      updateScreenshotCount();
    } catch (err) {
      console.error('[ControlBar] Failed to load screenshot count:', err);
    }

    // Load capture config
    try {
      const result = await window.electronAPI.getCaptureConfig();
      if (result.success) {
        updateCaptureModeBadge(result.config);
      }
    } catch (err) {
      console.error('[ControlBar] Failed to load capture config:', err);
    }
  }

  // ========================================================================
  // EVENT LISTENERS
  // ========================================================================

  function setupEventListeners() {
    // Voice toggle
    if (voiceToggle !== null) {
      voiceToggle.addEventListener('click', async () => {
        if (isRecording) {
          await window.electronAPI.stopVoiceRecognition();
        } else {
          await window.electronAPI.startVoiceRecognition();
        }
      });
    }

    // Screenshot
    if (screenshotBtn !== null) {
      screenshotBtn.addEventListener('click', () => {
        window.electronAPI.takeStealthScreenshot();
      });
    }

    // Region - use native context menu via IPC
    if (regionBtn !== null) {
      regionBtn.addEventListener('click', () => {
        window.electronAPI.showRegionMenu();
      });
    }

    // Analyze
    if (analyzeBtn !== null) {
      analyzeBtn.addEventListener('click', () => {
        window.electronAPI.analyzeStealth();
      });
    }

    // Suggest
    if (suggestBtn !== null) {
      suggestBtn.addEventListener('click', () => {
        window.electronAPI.suggestResponse('');
      });
    }

    // Notes
    if (notesBtn !== null) {
      notesBtn.addEventListener('click', () => {
        window.electronAPI.generateMeetingNotes();
      });
    }

    // Insights
    if (insightsBtn !== null) {
      insightsBtn.addEventListener('click', () => {
        window.electronAPI.getConversationInsights();
      });
    }

    // Clear
    if (clearBtn !== null) {
      clearBtn.addEventListener('click', () => {
        window.electronAPI.clearStealth();
        screenshotsCount = 0;
        updateScreenshotCount();
      });
    }

    // Hide (emergency)
    if (hideBtn !== null) {
      hideBtn.addEventListener('click', () => {
        window.electronAPI.emergencyHide();
      });
    }

    // Settings - opens separate settings window
    if (settingsBtn !== null) {
      settingsBtn.addEventListener('click', () => {
        window.electronAPI.openSettings();
      });
    }

    // Theme toggle
    if (themeToggle !== null) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Opacity slider
    if (transparencySlider !== null) {
      transparencySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (transparencyValue !== null) {
          transparencyValue.textContent = value + '%';
        }
        window.electronAPI.setWindowOpacity(value / 100);
      });
    }

    // Dev mode pill
    if (devModePill !== null) {
      devModePill.addEventListener('click', async () => {
        const result = await window.electronAPI.toggleContentProtection();
        if (result.success) {
          updateDevPill(result.contentProtectionEnabled);
        }
      });
    }

    // Labels toggle
    if (labelsToggle !== null) {
      labelsToggle.addEventListener('click', () => {
        showLabels = !showLabels;
        updateLabelsVisibility();
        window.electronAPI.setUISettings({ showIconLabels: showLabels });
      });
    }

    // Close button
    if (closeBtn !== null) {
      closeBtn.addEventListener('click', () => {
        window.electronAPI.closeApp();
      });
    }

    // ======================================================================
    // IPC EVENT LISTENERS
    // ======================================================================

    // Screenshot count update
    if (window.electronAPI.onScreenshotTakenStealth) {
      window.electronAPI.onScreenshotTakenStealth((count) => {
        screenshotsCount = count;
        updateScreenshotCount();
      });
    }

    // Voice status updates
    if (window.electronAPI.onVoskStatus) {
      window.electronAPI.onVoskStatus((data) => {
        if (data.status === 'listening') {
          setRecordingState(true);
        } else if (data.status === 'stopped' || data.status === 'error') {
          setRecordingState(false);
        }
      });
    }

    if (window.electronAPI.onVoskStopped) {
      window.electronAPI.onVoskStopped(() => {
        setRecordingState(false);
      });
    }

    // Capture config changes
    if (window.electronAPI.onCaptureConfigChanged) {
      window.electronAPI.onCaptureConfigChanged((config) => {
        updateCaptureModeBadge(config);
      });
    }

    // Stealth mode changes
    if (window.electronAPI.onSetStealthMode) {
      window.electronAPI.onSetStealthMode((enabled) => {
        updateDevPill(enabled);
      });
    }

    // Settings changes (theme, opacity)
    if (window.electronAPI.onSettingsChanged) {
      window.electronAPI.onSettingsChanged((data) => {
        if (data.type === 'ui' && data.settings !== undefined) {
          if (data.settings.theme !== undefined) {
            applyTheme(data.settings.theme);
          }
          if (data.settings.opacity !== undefined) {
            const val = Math.round(data.settings.opacity * 100);
            if (transparencySlider !== null) transparencySlider.value = val;
            if (transparencyValue !== null) transparencyValue.textContent = val + '%';
          }
        }
      });
    }

    // Theme change broadcast from main process
    ipcOnThemeChanged((theme) => {
      applyTheme(theme);
    });

    // Emergency clear
    if (window.electronAPI.onEmergencyClear) {
      window.electronAPI.onEmergencyClear(() => {
        screenshotsCount = 0;
        updateScreenshotCount();
        setRecordingState(false);
      });
    }
  }

  // ========================================================================
  // UI UPDATE FUNCTIONS
  // ========================================================================

  function updateScreenshotCount() {
    if (screenshotCountEl !== null) {
      screenshotCountEl.textContent = String(screenshotsCount);
    }
  }

  function setRecordingState(recording) {
    isRecording = recording;

    if (statusDot !== null) {
      statusDot.classList.toggle('recording', recording);
    }

    if (voiceToggle !== null) {
      voiceToggle.classList.toggle('active', recording);
    }

    if (recording) {
      startTimer();
    } else {
      stopTimer();
    }
  }

  function startTimer() {
    if (timerInterval !== null) return;
    timerSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timerSeconds += 1;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (timerDisplay === null) return;
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    timerDisplay.textContent =
      String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function updateDevPill(contentProtectionEnabled) {
    if (devModePill === null || devPillText === null) return;

    if (contentProtectionEnabled) {
      // Stealth mode - content protection ON (green)
      devPillText.textContent = 'STEALTH';
      devModePill.classList.remove('dev-visible');
      devModePill.classList.add('dev-stealth');
    } else {
      // Dev mode - content protection OFF (orange/yellow)
      devPillText.textContent = 'DEV';
      devModePill.classList.remove('dev-stealth');
      devModePill.classList.add('dev-visible');
    }
  }

  function updateCaptureModeBadge(config) {
    if (captureModeBadge === null) return;

    const mode = config.mode ?? 'fullScreen';
    captureMode = mode;

    if (mode === 'fullScreen') {
      captureModeBadge.style.display = 'none';
      captureModeBadge.className = 'capture-mode-badge';
    } else if (mode === 'region') {
      const region = config.region ?? {};
      captureModeBadge.textContent = `${region.width ?? 0}x${region.height ?? 0}`;
      captureModeBadge.className = 'capture-mode-badge badge-region';
      captureModeBadge.style.display = '';
    } else if (mode === 'window') {
      const windowConfig = config.window ?? {};
      const title = windowConfig.title ?? 'Window';
      captureModeBadge.textContent = title.length > 12 ? title.substring(0, 11) + '\u2026' : title;
      captureModeBadge.className = 'capture-mode-badge badge-window';
      captureModeBadge.style.display = '';
    }
  }

  function updateLabelsVisibility() {
    const labels = document.querySelectorAll('.action-label');
    for (const label of labels) {
      label.style.display = showLabels ? '' : 'none';
    }

    if (labelsToggle !== null) {
      labelsToggle.classList.toggle('active', showLabels);
    }
  }

  // ========================================================================
  // THEME
  // ========================================================================

  function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    window.electronAPI.setUISettings({ theme: newTheme });
    // Broadcast theme change to other windows via main process
    window.electronAPI.broadcastThemeChange(newTheme);
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon !== null && moonIcon !== null) {
      if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
  }

  // Helper for theme change IPC listener
  function ipcOnThemeChanged(callback) {
    if (window.electronAPI !== undefined && window.electronAPI.onThemeChanged !== undefined) {
      window.electronAPI.onThemeChanged(callback);
    }
  }

  // ========================================================================
  // BOOT
  // ========================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
