// Renderer with Vosk Live Transcription - Real-time & Accurate!
// Uses Vosk model vosk-model-en-us-0.22 for offline, accurate transcription
// Supports multiple AI providers: Gemini, OpenAI, Anthropic

let screenshotsCount = 0;
let isAnalyzing = false;
let stealthModeActive = false;
let stealthHideTimeout = null;
let isRecording = false;
let chatMessagesArray = [];
let currentPartialText = '';
let lastPartialMessageDiv = null;

// Initialization state
let isAppInitialized = false;

// AI Provider state
let currentProvider = 'gemini';
let availableProviders = [];

// Theme and appearance state
let currentTheme = 'light';
let currentOpacity = 1.0;

// Vosk model state
let voskModelInstalled = false;
let voskPrewarmStatus = 'idle'; // 'idle', 'loading', 'ready', 'not_installed', 'error'
let voskIsPrewarmed = false;

// Dev mode and content protection state
let isDevMode = false;
let contentProtectionEnabled = true;

// Transcript state
let transcriptLines = []; // Array of {text, timestamp, speakerChanged}
let currentLiveText = '';

// Summary state
let lastSummary = '';
let lastSummaryTime = null;
let transcriptBuffer = []; // Buffer for summarization
let summarizeTimer = null;
let isSummarizing = false;
let summaryPanelCollapsed = false;
const SUMMARIZE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Transcript correction state
let correctionBuffer = [];           // Utterances pending correction
let correctionTimer = null;          // Auto-correction timer
let isCorrecting = false;            // Prevent concurrent corrections
let correctionEnabled = true;        // User preference (loaded from settings)
let correctionAccentHint = 'general'; // Accent hint for better corrections
const CORRECTION_INTERVAL = 30000;   // 30 seconds
const CORRECTION_BATCH_SIZE = 5;     // Trigger after 5 utterances

// DOM elements
const statusText = document.getElementById('status-text');
const screenshotCount = document.getElementById('screenshot-count');
const resultsPanel = document.getElementById('results-panel');
const resultText = document.getElementById('result-text');
const loadingOverlay = document.getElementById('loading-overlay');
const emergencyOverlay = document.getElementById('emergency-overlay');
const chatContainer = document.getElementById('chat-container');
const chatMessagesElement = document.getElementById('chat-messages');
const voiceToggle = document.getElementById('voice-toggle');
const providerSelect = document.getElementById('provider-select');

// Transcript panel elements
const transcriptContainer = document.getElementById('transcript-container');
const transcriptContent = document.getElementById('transcript-content');
console.log('Transcript elements found:', { 
    transcriptContainer: !!transcriptContainer, 
    transcriptContent: !!transcriptContent 
});

// Summary panel elements
const summaryPanel = document.getElementById('summary-panel');
const summaryContent = document.getElementById('summary-content');
const summaryLoading = document.getElementById('summary-loading');
const summaryTimestamp = document.getElementById('summary-timestamp');
const refreshSummaryBtn = document.getElementById('refresh-summary');
const toggleSummaryBtn = document.getElementById('toggle-summary');

const screenshotBtn = document.getElementById('screenshot-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const clearBtn = document.getElementById('clear-btn');
const hideBtn = document.getElementById('hide-btn');
const copyBtn = document.getElementById('copy-btn');
const polishBtn = document.getElementById('polish-btn');
const closeResultsBtn = document.getElementById('close-results');

// Lock button (window move/resize toggle)
const lockBtn = document.getElementById('lock-btn');
const lockIconUnlocked = document.getElementById('lock-icon-unlocked');
const lockIconLocked = document.getElementById('lock-icon-locked');
let isWindowLocked = false;

// EchoAssist action buttons
const suggestBtn = document.getElementById('suggest-btn');
const notesBtn = document.getElementById('notes-btn');
const insightsBtn = document.getElementById('insights-btn');

// Theme and appearance controls
const themeToggle = document.getElementById('theme-toggle');
const transparencySlider = document.getElementById('transparency-slider');
const transparencyValue = document.getElementById('transparency-value');

// Settings modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const saveAllSettings = document.getElementById('save-all-settings');
const resetSettings = document.getElementById('reset-settings');
const defaultProviderSelect = document.getElementById('default-provider');
const enableFallbackCheckbox = document.getElementById('enable-fallback');
const historyLengthSlider = document.getElementById('history-length');
const historyLengthValue = document.getElementById('history-length-value');
const voiceLanguageSelect = document.getElementById('voice-language');
const voiceAutostartCheckbox = document.getElementById('voice-autostart');
const maxScreenshotsSlider = document.getElementById('max-screenshots');
const maxScreenshotsValue = document.getElementById('max-screenshots-value');
const captureDelaySlider = document.getElementById('capture-delay');
const captureDelayValue = document.getElementById('capture-delay-value');

// Vosk model elements
const voskStatus = document.getElementById('vosk-status');
const voskProgressContainer = document.getElementById('vosk-progress-container');
const voskProgressFill = document.getElementById('vosk-progress-fill');
const voskProgressText = document.getElementById('vosk-progress-text');
const downloadVoskBtn = document.getElementById('download-vosk-btn');
const downloadVoskBtnText = document.getElementById('download-vosk-btn-text');
const deleteVoskBtn = document.getElementById('delete-vosk-btn');
const voskDevNotice = document.getElementById('vosk-dev-notice');

// Vosk model size radio buttons
const voskModelRadios = document.querySelectorAll('input[name="vosk-model-size"]');

// AI Model selection elements
const geminiModelSelect = document.getElementById('gemini-model');
const openaiVisionModelSelect = document.getElementById('openai-vision-model');
const openaiTextModelSelect = document.getElementById('openai-text-model');
const anthropicVisionModelSelect = document.getElementById('anthropic-vision-model');
const anthropicTextModelSelect = document.getElementById('anthropic-text-model');
const openrouterVisionModelSelect = document.getElementById('openrouter-vision-model');
const openrouterTextModelSelect = document.getElementById('openrouter-text-model');

// Vosk model state
let currentVoskModelSize = 'large';
let voskModelStatus = {
  installed: {},
  localAvailable: {},
  isDevelopment: false
};

// Status bar elements (legacy - being replaced by status toast)
const statusBarProvider = document.getElementById('status-bar-provider');
const statusBarVoice = document.getElementById('status-bar-voice');
const statusBarProgress = document.getElementById('status-bar-progress');

// Phase 6: New control bar elements
const controlBar = document.getElementById('control-bar');
const closeBtn = document.getElementById('close-btn');
const labelsToggle = document.getElementById('labels-toggle');
const autoScrollIndicator = document.getElementById('auto-scroll-indicator');
const statusToast = document.getElementById('status-toast');
const statusToastIcon = document.getElementById('status-toast-icon');
const statusToastText = document.getElementById('status-toast-text');
// Phase 6: Drag header removed; transcript-header handles dragging now

// Phase 6: UI state
let showIconLabels = false;
let autoScrollEnabled = true;
const miniProgressFill = document.getElementById('mini-progress-fill');
const miniProgressText = document.getElementById('mini-progress-text');
const statusBarMessage = document.getElementById('status-bar-message');
const aiActivityIndicator = document.getElementById('ai-activity-indicator');
const aiActivityText = aiActivityIndicator?.querySelector('.ai-activity-text');

// Timer
let startTime = Date.now();
let timerInterval;

// Initialize
async function init() {
    console.log('Initializing renderer with Vosk Live Transcription...');

    if (typeof window.electronAPI !== 'undefined') {
        console.log('electronAPI is available');
    } else {
        console.error('electronAPI not available');
        showFeedback('electronAPI not available', 'error');
    }

    setupEventListeners();
    setupIpcListeners();
    await initializeProviders();
    await initializeAppearance();
    await checkDevModeStatus();
    await checkVoskModelStatus();
    initializeSummaryPanel();
    await initializeCorrectionSettings();
    await loadUIPreferences();
    await initCaptureConfig();
    initializeAutoScrollIndicator();
    updateUI();
    updateStatusBarProvider();
    updateStatusBarVoice();
    startTimer();
    stealthModeActive = false;

    // Mark initialization complete - "Switched to" messages will now show
    isAppInitialized = true;

    document.body.style.visibility = 'visible';
    document.body.style.display = '';
    const app = document.getElementById('app');
    if (app) {
        app.style.visibility = 'visible';
        app.style.display = ''; // Clear inline override — CSS flex layout applies
    }

    console.log('Renderer initialized - Ready for live transcription!');
    
    if (voskModelInstalled) {
        if (voskIsPrewarmed) {
            showFeedback('Ready - click microphone for voice or take screenshots', 'success');
        } else {
            showFeedback('Loading speech model...', 'info');
        }
    } else {
        showFeedback('Vosk model required - click Settings to download', 'info');
    }
}

// ============================================================================
// SUMMARY PANEL INITIALIZATION
// ============================================================================

function initializeSummaryPanel() {
    // Load collapsed state from localStorage
    const savedState = localStorage.getItem('summary-panel-collapsed');
    summaryPanelCollapsed = savedState === 'true';
    
    if (summaryPanelCollapsed && summaryPanel) {
        summaryPanel.classList.add('collapsed');
        if (toggleSummaryBtn) toggleSummaryBtn.textContent = '▶';
    }
}

// ============================================================================
// CORRECTION SETTINGS INITIALIZATION
// ============================================================================

async function initializeCorrectionSettings() {
    if (!window.electronAPI || !window.electronAPI.getCorrectionSettings) {
        console.warn('Correction settings API not available');
        return;
    }
    
    try {
        const result = await window.electronAPI.getCorrectionSettings();
        if (result.success && result.settings) {
            applyCorrectionSettings(result.settings);
        }
    } catch (error) {
        console.error('Failed to load correction settings:', error);
    }
}

function applyCorrectionSettings(settings) {
    // Apply enabled state
    correctionEnabled = settings.enabled !== false;
    
    // Apply accent hint
    correctionAccentHint = settings.accentHint ?? 'general';
    
    // Apply frequency (recreate timer if recording)
    const frequency = settings.frequency ?? '30000';
    if (frequency === 'manual') {
        // Manual only - stop the timer
        stopCorrectionTimer();
    } else {
        // Update the interval constant (can't change const, so we recreate timer)
        // Note: The timer uses CORRECTION_INTERVAL constant, but we can restart it
        // For now, we just restart the timer if recording
        if (isRecording && correctionEnabled) {
            stopCorrectionTimer();
            startCorrectionTimer();
        }
    }
    
    console.log('Correction settings applied:', {
        enabled: correctionEnabled,
        accentHint: correctionAccentHint,
        frequency
    });
}

function toggleSummaryPanel() {
    if (!summaryPanel) return;
    
    summaryPanelCollapsed = !summaryPanelCollapsed;
    summaryPanel.classList.toggle('collapsed', summaryPanelCollapsed);
    
    if (toggleSummaryBtn) {
        toggleSummaryBtn.textContent = summaryPanelCollapsed ? '▶' : '◀';
    }
    
    // Save state
    localStorage.setItem('summary-panel-collapsed', summaryPanelCollapsed.toString());
}

// ============================================================================
// THEME AND APPEARANCE MANAGEMENT
// ============================================================================

async function initializeAppearance() {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('app-theme') ?? 'dark';
    setTheme(savedTheme);

    // Load saved opacity preference
    const savedOpacity = localStorage.getItem('app-opacity');
    if (savedOpacity !== null) {
        const opacity = parseFloat(savedOpacity);
        currentOpacity = opacity;
        if (transparencySlider) {
            transparencySlider.value = Math.round(opacity * 100);
        }
        if (transparencyValue) {
            transparencyValue.textContent = `${Math.round(opacity * 100)}%`;
        }
        // Apply saved opacity
        if (window.electronAPI && window.electronAPI.setWindowOpacity) {
            await window.electronAPI.setWindowOpacity(opacity);
        }
    }

    // Get current window opacity from main process
    if (window.electronAPI && window.electronAPI.getWindowOpacity) {
        try {
            const result = await window.electronAPI.getWindowOpacity();
            if (result.success) {
                currentOpacity = result.opacity;
                if (transparencySlider) {
                    transparencySlider.value = Math.round(result.opacity * 100);
                }
                if (transparencyValue) {
                    transparencyValue.textContent = `${Math.round(result.opacity * 100)}%`;
                }
            }
        } catch (error) {
            console.error('Failed to get window opacity:', error);
        }
    }
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);

    // Update theme toggle button icons
    if (themeToggle) {
        const sunIcon = themeToggle.querySelector('.sun-icon');
        const moonIcon = themeToggle.querySelector('.moon-icon');
        if (theme === 'dark') {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    console.log(`Theme set to: ${theme}`);
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showFeedback(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode`, 'info');
}

// ============================================================================
// DEV MODE & CONTENT PROTECTION
// ============================================================================

async function checkDevModeStatus() {
    if (!window.electronAPI || !window.electronAPI.getDevModeStatus) {
        console.warn('Dev mode status API not available');
        return;
    }
    
    try {
        const result = await window.electronAPI.getDevModeStatus();
        console.log('Dev mode status:', result);
        
        if (result.success) {
            isDevMode = result.isDevelopment === true;
            contentProtectionEnabled = result.contentProtectionEnabled !== false;
            updateDevModePill();
            
            if (isDevMode) {
                console.log('Running in DEVELOPMENT mode - content protection toggle available');
            }
        }
    } catch (error) {
        console.error('Failed to check dev mode status:', error);
    }
}

function updateDevModePill() {
    const devModePill = document.getElementById('dev-mode-pill');
    const devPillText = document.getElementById('dev-pill-text');
    if (!devModePill) return;
    
    // Only show the pill in dev mode
    if (isDevMode) {
        devModePill.classList.remove('hidden');
        
        // Update pill appearance based on content protection state
        if (contentProtectionEnabled) {
            // Stealth mode - content protection ON
            devModePill.classList.remove('dev-visible');
            devModePill.classList.add('dev-stealth');
            if (devPillText) devPillText.textContent = 'STEALTH';
            devModePill.title = 'Content protection ON (hidden from screenshots). Click to switch to debug mode.';
        } else {
            // Debug mode - content protection OFF
            devModePill.classList.remove('dev-stealth');
            devModePill.classList.add('dev-visible');
            if (devPillText) devPillText.textContent = 'DEV';
            devModePill.title = 'Content protection OFF (visible in screenshots). Click to switch to stealth mode.';
        }
    } else {
        devModePill.classList.add('hidden');
    }
}

// ============================================================================
// WINDOW LOCK (Move/Resize Toggle)
// ============================================================================

async function loadWindowLockState() {
    if (!window.electronAPI || !window.electronAPI.getWindowLocked) return;
    try {
        const result = await window.electronAPI.getWindowLocked();
        if (result.success) {
            isWindowLocked = result.locked;
            applyWindowLockUI(isWindowLocked);
        }
    } catch (err) {
        console.error('Failed to load window lock state:', err);
    }
}

async function toggleWindowLock() {
    if (!window.electronAPI || !window.electronAPI.setWindowLocked) {
        showFeedback('Lock not available', 'error');
        return;
    }

    const newLocked = !isWindowLocked;
    try {
        const result = await window.electronAPI.setWindowLocked(newLocked);
        if (result.success) {
            isWindowLocked = result.locked;
            applyWindowLockUI(isWindowLocked);
            showFeedback(isWindowLocked ? 'Window locked' : 'Window unlocked', 'success');
        }
    } catch (err) {
        console.error('Failed to toggle window lock:', err);
        showFeedback('Lock toggle failed', 'error');
    }
}

function applyWindowLockUI(locked) {
    const header = document.querySelector('.transcript-header');
    if (header !== null) {
        if (locked) {
            header.style.webkitAppRegion = 'no-drag';
            header.classList.add('locked');
        } else {
            header.style.webkitAppRegion = 'drag';
            header.classList.remove('locked');
        }
    }

    if (lockIconUnlocked !== null && lockIconLocked !== null) {
        if (locked) {
            lockIconUnlocked.classList.add('hidden');
            lockIconLocked.classList.remove('hidden');
        } else {
            lockIconUnlocked.classList.remove('hidden');
            lockIconLocked.classList.add('hidden');
        }
    }

    if (lockBtn !== null) {
        lockBtn.title = locked ? 'Unlock window position and size' : 'Lock window position and size';
        lockBtn.classList.toggle('active', locked);
    }
}

async function toggleContentProtection() {
    if (!window.electronAPI || !window.electronAPI.toggleContentProtection) {
        showFeedback('Toggle not available', 'error');
        return;
    }
    
    try {
        const result = await window.electronAPI.toggleContentProtection();
        
        if (result.success) {
            contentProtectionEnabled = result.contentProtectionEnabled;
            updateDevModePill();
            
            if (contentProtectionEnabled) {
                showFeedback('Stealth mode: Hidden from screenshots', 'success');
            } else {
                showFeedback('Debug mode: Visible in screenshots', 'info');
            }
        }
    } catch (error) {
        console.error('Failed to toggle content protection:', error);
        showFeedback('Toggle failed', 'error');
    }
}

async function setOpacity(opacity) {
    // Clamp opacity between 0.3 and 1.0
    const clampedOpacity = Math.max(0.3, Math.min(1.0, opacity));
    currentOpacity = clampedOpacity;

    // Update UI
    if (transparencyValue) {
        transparencyValue.textContent = `${Math.round(clampedOpacity * 100)}%`;
    }

    // Save preference
    localStorage.setItem('app-opacity', clampedOpacity.toString());

    // Apply to window
    if (window.electronAPI && window.electronAPI.setWindowOpacity) {
        try {
            await window.electronAPI.setWindowOpacity(clampedOpacity);
        } catch (error) {
            console.error('Failed to set window opacity:', error);
        }
    }
}

function handleOpacityChange(event) {
    const value = parseInt(event.target.value, 10);
    const opacity = value / 100;
    setOpacity(opacity);
}

// ============================================================================
// AI PROVIDER MANAGEMENT
// ============================================================================

async function initializeProviders() {
    if (!window.electronAPI || !window.electronAPI.getAvailableProviders) {
        console.warn('Provider management not available');
        return;
    }

    try {
        // Get active provider FIRST so we know what's actually selected
        const activeResult = await window.electronAPI.getActiveProvider();
        if (activeResult.success && activeResult.provider) {
            currentProvider = activeResult.provider;
            console.log('Active provider:', currentProvider);
        }

        // Get available providers
        const result = await window.electronAPI.getAvailableProviders();
        
        if (result.success && result.providers) {
            availableProviders = result.providers;
            console.log('Available providers:', availableProviders.map(p => p.name));
            
            // Update dropdown with available providers (after currentProvider is set)
            updateProviderDropdown();
        }

        // Update the dropdown selection to match current provider
        updateProviderSelection();

    } catch (error) {
        console.error('Failed to initialize providers:', error);
    }
}

function updateProviderDropdown() {
    if (!providerSelect) return;

    // Get all available provider names
    const availableNames = availableProviders.map(p => p.name);

    // Update each option's disabled state
    Array.from(providerSelect.options).forEach(option => {
        const isAvailable = availableNames.includes(option.value);
        option.disabled = !isAvailable;
        
        // Update option text to show availability
        const providerInfo = availableProviders.find(p => p.name === option.value);
        if (providerInfo) {
            option.text = `${providerInfo.icon ?? ''} ${providerInfo.displayName ?? option.value}`.trim();
        }
    });

    // Ensure dropdown reflects currentProvider (already set from main process)
    // Don't trigger changeProvider here - just sync the UI
    if (currentProvider && availableNames.includes(currentProvider)) {
        providerSelect.value = currentProvider;
    } else if (availableNames.length > 0) {
        // Current provider not available, use first available but don't show "switched" message
        currentProvider = availableNames[0];
        providerSelect.value = currentProvider;
    }
}

function updateProviderSelection() {
    if (!providerSelect) return;

    providerSelect.value = currentProvider;
    providerSelect.setAttribute('data-provider', currentProvider);

    // Update chat title to show current provider
    const chatTitle = document.querySelector('.chat-title');
    if (chatTitle) {
        const providerInfo = availableProviders.find(p => p.name === currentProvider);
        const icon = providerInfo?.icon ?? 'AI';
        const displayName = providerInfo?.displayName ?? currentProvider;
        chatTitle.textContent = `${icon} ${displayName}`;
    }
}

async function changeProvider(provider) {
    if (provider === currentProvider) return;

    try {
        console.log(`Switching provider from ${currentProvider} to ${provider}...`);
        showFeedback(`Switching to ${provider}...`, 'info');

        const result = await window.electronAPI.setActiveProvider(provider);

        if (result.success) {
            currentProvider = result.provider;
            updateProviderSelection();
            
            const providerInfo = availableProviders.find(p => p.name === currentProvider);
            const displayName = providerInfo?.displayName ?? currentProvider;
            showFeedback(`Now using ${displayName}`, 'success');
            addChatMessage('system', `Switched to ${displayName}`);
        } else {
            showFeedback(`Failed to switch: ${result.error ?? 'Unknown error'}`, 'error');
            // Revert selection
            updateProviderSelection();
        }

    } catch (error) {
        console.error('Failed to change provider:', error);
        showFeedback(`Error: ${error.message}`, 'error');
        updateProviderSelection();
    }
}

function handleProviderChange(event) {
    const newProvider = event.target.value;
    changeProvider(newProvider);
}

// Start Vosk voice recognition
async function startVoiceRecording() {
    if (isRecording) {
        console.log('Already recording');
        return;
    }

    try {
        console.log('Starting Vosk live transcription...');

        // Call main process to start Vosk Python process
        const result = await window.electronAPI.startVoiceRecognition();

        if (result && result.needsModel) {
            // Model not installed - update state and show message
            voskModelInstalled = false;
            updateVoiceButtonState();
            addChatMessage('system', 'Vosk model required. Open Settings to download it.');
            showFeedback('Vosk model required - open Settings', 'error');
            return;
        }

        if (result && result.error) {
            throw new Error(result.error);
        }

        isRecording = true;
        console.log('Voice recording started, isRecording set to:', isRecording);
        updateVoiceUI();
        updateStatusBarVoice();
        
        // Start the summarization timer
        startSummarizeTimer();
        
        // Start the correction timer
        startCorrectionTimer();

        addChatMessage('system', 'Live transcription started - speak now!');
        showFeedback('Listening with Vosk...', 'success');

    } catch (error) {
        console.error('Failed to start Vosk:', error);
        showFeedback(`Failed to start: ${error.message}`, 'error');
        isRecording = false;
        updateVoiceUI();
        updateStatusBarVoice();
    }
}

// Stop Vosk voice recognition
async function stopVoiceRecording() {
    if (!isRecording) return;

    try {
        console.log('Pausing Vosk transcription (model stays loaded)...');

        await window.electronAPI.stopVoiceRecognition();

        isRecording = false;
        updateVoiceUI();
        updateStatusBarVoice();

        // Clear any live text display
        currentLiveText = '';
        renderTranscript();
        
        // Stop the summarization timer
        stopSummarizeTimer();
        
        // Stop the correction timer and flush any remaining corrections
        stopCorrectionTimer();
        if (correctionBuffer.length > 0 && correctionEnabled) {
            // Auto-correct remaining buffer when stopping
            correctTranscript(false);
        }
        
        // If we have buffered content, offer to summarize
        if (transcriptBuffer.length > 0) {
            // Auto-summarize remaining buffer when stopping
            summarizeTranscript();
        }

        addChatMessage('system', 'Paused - Click mic to resume');
        showFeedback('Paused (model ready)', 'info');

    } catch (error) {
        console.error('Failed to pause Vosk:', error);
        showFeedback('Pause failed', 'error');
    }
}

// Toggle voice recognition
async function toggleVoiceRecognition() {
    // Check if Vosk model is installed
    if (!voskModelInstalled) {
        showFeedback('Vosk model required - open Settings to download', 'error');
        addChatMessage('system', 'Voice recognition requires the Vosk model. Click the Settings button to download it (~1.8 GB, one-time).');
        return;
    }
    
    if (isRecording) {
        await stopVoiceRecording();
        voiceToggle.classList.remove('active');
    } else {
        await startVoiceRecording();
        if (isRecording) {
            voiceToggle.classList.add('active');
        }
    }
}

// Update voice UI
function updateVoiceUI() {
    if (!voiceToggle) return;

    if (isRecording) {
        voiceToggle.classList.add('active', 'listening');
        voiceToggle.style.background = 'rgba(34, 197, 94, 0.3)'; // Green highlight
    } else {
        voiceToggle.classList.remove('active', 'listening');
        voiceToggle.style.background = ''; // Clear highlight
    }
    
    // Update status-dot in control bar
    const statusDot = document.querySelector('.control-bar-status .status-dot');
    if (statusDot) {
        if (isRecording) {
            statusDot.classList.add('recording');
            statusDot.classList.remove('ready');
        } else if (voskModelInstalled && voskIsPrewarmed) {
            statusDot.classList.remove('recording');
            statusDot.classList.add('ready');
        } else {
            statusDot.classList.remove('recording', 'ready');
        }
    }
}

// Handle Vosk partial results (real-time display)
function handleVoskPartial(data) {
    // Only process if we're actively recording
    if (!isRecording) return;
    if (!data.text || data.text.trim().length === 0) return;

    currentLiveText = data.text.trim();
    console.log('Partial:', currentLiveText);

    // Update the transcript display with live text
    renderTranscript();
}

// Handle Vosk final results
function handleVoskFinal(data) {
    console.log('handleVoskFinal called:', { isRecording, data });
    
    // Only process if we're actively recording
    if (!isRecording) {
        console.warn('handleVoskFinal: Not recording, ignoring event');
        return;
    }
    if (!data.text || data.text.trim().length === 0) {
        console.log('handleVoskFinal: Empty text, ignoring');
        return;
    }

    const finalText = data.text.trim();
    const speakerChanged = data.speaker_changed === true;
    console.log('Final:', finalText, speakerChanged ? '(new speaker)' : '');

    // Clear live text
    currentLiveText = '';

    // Add to transcript lines
    const timestamp = new Date();
    const lineIndex = transcriptLines.length;
    transcriptLines.push({
        text: finalText,
        timestamp: timestamp,
        speakerChanged: speakerChanged
    });
    
    // Add to buffer for summarization
    transcriptBuffer.push(finalText);
    
    // Add to correction buffer for AI post-processing
    if (correctionEnabled) {
        correctionBuffer.push({
            index: lineIndex,
            text: finalText,
            timestamp: timestamp
        });
        
        // Auto-correct if batch size reached
        if (correctionBuffer.length >= CORRECTION_BATCH_SIZE && !isCorrecting) {
            correctTranscript(false);
        }
    }
    
    // Also add to chat messages array for context
    chatMessagesArray.push({
        type: 'voice',
        content: finalText,
        timestamp: timestamp
    });

    // Render the updated transcript
    renderTranscript();
    
    showFeedback('Voice captured', 'success');
}

// ============================================================================
// TRANSCRIPT RENDERING
// ============================================================================

function renderTranscript() {
    console.log('renderTranscript called:', { 
        hasTranscriptContent: !!transcriptContent, 
        transcriptLinesCount: transcriptLines.length,
        currentLiveText: currentLiveText 
    });
    
    if (!transcriptContent) {
        console.error('renderTranscript: transcriptContent element not found!');
        return;
    }
    
    // Check if empty
    if (transcriptLines.length === 0 && !currentLiveText) {
        transcriptContent.innerHTML = `
            <div class="transcript-empty">
                <span class="transcript-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/><path d="M8 23h8"/></svg></span>
                <span>Click the microphone to start recording</span>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Render finalized transcript lines
    transcriptLines.forEach((line, index) => {
        const timeStr = line.timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Add speaker break if this is a new speaker (and not the first line)
        if (line.speakerChanged && index > 0) {
            html += '<div class="transcript-speaker-break"></div>';
        }
        
        const correctedClass = line.corrected ? ' corrected' : '';
        html += `
            <div class="transcript-line${correctedClass}">
                <span class="transcript-line-text">${escapeHtml(line.text)}</span>
                <span class="transcript-line-time">${timeStr}</span>
            </div>
        `;
        
        // Clear the corrected flag after rendering (one-time animation)
        if (line.corrected) {
            setTimeout(() => { line.corrected = false; }, 2000);
        }
    });
    
    // Add live text at the bottom
    if (currentLiveText) {
        const nowStr = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        html += `
            <div class="transcript-line">
                <span class="transcript-line-text transcript-live">${escapeHtml(currentLiveText)}</span>
                <span class="transcript-line-time">${nowStr}</span>
            </div>
        `;
    }
    
    transcriptContent.innerHTML = html;
    
    // Auto-scroll to bottom (respects user preference)
    autoScrollTranscript();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFullTranscript() {
    return transcriptLines.map(line => line.text).join(' ');
}

// ============================================================================
// AUTO-SUMMARIZATION
// ============================================================================

function startSummarizeTimer() {
    if (summarizeTimer) {
        clearInterval(summarizeTimer);
    }
    
    summarizeTimer = setInterval(async () => {
        if (transcriptBuffer.length > 0 && !isSummarizing) {
            await summarizeTranscript();
        }
    }, SUMMARIZE_INTERVAL);
    
    console.log('Summarize timer started (5 min interval)');
}

function stopSummarizeTimer() {
    if (summarizeTimer) {
        clearInterval(summarizeTimer);
        summarizeTimer = null;
    }
}

async function summarizeTranscript() {
    if (isSummarizing) return;
    if (transcriptBuffer.length === 0 && transcriptLines.length === 0) {
        showFeedback('No transcript to summarize', 'info');
        return;
    }
    
    isSummarizing = true;
    showSummaryLoading(true);
    showAIActivity('Summarizing...');
    
    // Spin the refresh button
    if (refreshSummaryBtn) {
        refreshSummaryBtn.classList.add('spinning');
    }
    
    try {
        // Use either buffer or full transcript
        const textToSummarize = transcriptBuffer.length > 0 
            ? transcriptBuffer.join(' ')
            : getFullTranscript();
        
        const prompt = buildSummarizePrompt(textToSummarize, lastSummary);
        
        console.log('Summarizing transcript...');
        
        // Use the AI service to summarize
        const result = await window.electronAPI.analyzeWithAI(prompt, null);
        
        if (result && result.text) {
            lastSummary = result.text;
            lastSummaryTime = new Date();
            
            renderSummary(result.text);
            updateSummaryTimestamp(lastSummaryTime);
            
            // Clear buffer after successful summarization
            transcriptBuffer = [];
            
            showFeedback('Summary updated', 'success');
        } else if (result && result.error) {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Summarization failed:', error);
        showSummaryError(`Failed to generate summary: ${error.message}`);
        showFeedback('Summary failed', 'error');
    } finally {
        isSummarizing = false;
        showSummaryLoading(false);
        hideAIActivity();
        
        if (refreshSummaryBtn) {
            refreshSummaryBtn.classList.remove('spinning');
        }
    }
}

function buildSummarizePrompt(transcript, previousSummary) {
    let prompt = `You are summarizing a meeting transcript. `;
    
    if (previousSummary) {
        prompt += `
Previous summary:
${previousSummary}

New transcript content:
${transcript}

Please provide an UPDATED summary that incorporates both the previous summary and new content.`;
    } else {
        prompt += `
Transcript:
${transcript}

Please provide a summary.`;
    }
    
    prompt += `

Format your response in markdown with these sections:
## Key Points
- Main discussion topics and important statements

## Decisions Made
- Any decisions or agreements reached (if any)

## Action Items
- Tasks or follow-ups mentioned (with names if specified)

Keep it concise and actionable. Focus on the most important information.`;
    
    return prompt;
}

function renderSummary(markdown) {
    if (!summaryContent) return;
    
    // Simple markdown to HTML conversion (or use marked library)
    let html = markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        // Wrap consecutive li in ul
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    // Clean up extra br tags
    html = html.replace(/<br><br>/g, '<br>');
    html = html.replace(/<ul><br>/g, '<ul>');
    html = html.replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<\/li><br>/g, '</li>');
    
    summaryContent.innerHTML = html;
}

function updateSummaryTimestamp(date) {
    if (!summaryTimestamp) return;
    
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    summaryTimestamp.textContent = `Last updated: ${timeStr}`;
}

function showSummaryLoading(show) {
    if (!summaryLoading || !summaryContent) return;
    
    if (show) {
        summaryLoading.classList.remove('hidden');
        summaryContent.style.display = 'none';
    } else {
        summaryLoading.classList.add('hidden');
        summaryContent.style.display = '';
    }
}

function showSummaryError(message) {
    if (!summaryContent) return;
    
    summaryContent.innerHTML = `<div class="summary-error">${escapeHtml(message)}</div>`;
}

// ============================================================================
// TRANSCRIPT CORRECTION (AI Post-Processing)
// ============================================================================

function startCorrectionTimer() {
    if (correctionTimer) {
        clearInterval(correctionTimer);
    }
    
    if (!correctionEnabled) return;
    
    correctionTimer = setInterval(async () => {
        if (correctionBuffer.length > 0 && !isCorrecting) {
            await correctTranscript(false);
        }
    }, CORRECTION_INTERVAL);
    
    console.log('Correction timer started (30s interval)');
}

function stopCorrectionTimer() {
    if (correctionTimer) {
        clearInterval(correctionTimer);
        correctionTimer = null;
    }
}

function buildCorrectionPrompt(utterances) {
    // Get context from previous transcript lines (last 3 corrected lines)
    const contextLines = transcriptLines
        .slice(Math.max(0, transcriptLines.length - utterances.length - 3), transcriptLines.length - utterances.length)
        .map(line => line.text)
        .join(' ');
    
    const accentHints = {
        general: '',
        british: 'The speaker has a British accent. ',
        australian: 'The speaker has an Australian accent. ',
        indian: 'The speaker has an Indian accent. ',
        scottish: 'The speaker has a Scottish accent. ',
        irish: 'The speaker has an Irish accent. ',
        southern_us: 'The speaker has a Southern US accent. ',
        african: 'The speaker has an African accent. '
    };
    
    const accentNote = accentHints[correctionAccentHint] ?? '';
    
    const utteranceList = utterances
        .map((u, i) => `${i + 1}. "${u.text}"`)
        .join('\n');
    
    return `You are a transcript correction assistant. ${accentNote}Fix likely misheard words in speech-to-text output based on context and common phonetic errors.

Rules:
1. Only correct words that are likely mishearings (phonetically similar substitutions)
2. Fix common issues: numbers as words (tree→three), similar sounds (sink→think, Baris→Paris)
3. Correct obvious typos and grammar from speech recognition
4. Preserve the original meaning and speaker intent
5. Do NOT change correctly transcribed words
6. Do NOT add punctuation or formatting

${contextLines ? `Previous context for reference:\n"${contextLines}"\n` : ''}
Utterances to correct:
${utteranceList}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "corrections": [
    {"utteranceIndex": 0, "original": "wrong word", "corrected": "right word"},
    {"utteranceIndex": 1, "original": "another", "corrected": "fixed"}
  ]
}

If no corrections are needed, return: {"corrections": []}`;
}

async function correctTranscript(isManual = false) {
    if (isCorrecting) return;
    if (correctionBuffer.length === 0 && !isManual) return;
    
    // For manual correction, use all recent uncorrected lines
    const utterancesToCorrect = isManual && correctionBuffer.length === 0
        ? transcriptLines.slice(-10).map((line, i) => ({
            index: transcriptLines.length - 10 + i,
            text: line.text,
            timestamp: line.timestamp
          })).filter(u => u.index >= 0)
        : [...correctionBuffer];
    
    if (utterancesToCorrect.length === 0) {
        if (isManual) showFeedback('No transcript to polish', 'info');
        return;
    }
    
    isCorrecting = true;
    
    // Update UI
    if (polishBtn) {
        polishBtn.classList.add('correcting');
    }
    
    showAIActivity('Polishing...');
    
    if (isManual) {
        showFeedback('Polishing transcript...', 'info');
    }
    
    try {
        const prompt = buildCorrectionPrompt(utterancesToCorrect);
        
        console.log('Sending correction request to AI...');
        const result = await window.electronAPI.analyzeWithAI(prompt, null);
        
        if (result && result.text) {
            // Parse the JSON response
            let corrections = [];
            try {
                // Try to extract JSON from the response
                const jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    corrections = parsed.corrections ?? [];
                }
            } catch (parseError) {
                console.error('Failed to parse correction response:', parseError);
                console.log('Raw response:', result.text);
            }
            
            // Apply corrections
            let correctionCount = 0;
            corrections.forEach(correction => {
                const utterance = utterancesToCorrect[correction.utteranceIndex];
                if (utterance && utterance.index >= 0 && utterance.index < transcriptLines.length) {
                    const line = transcriptLines[utterance.index];
                    const originalText = line.text;
                    
                    // Replace the word in the transcript line
                    const newText = originalText.replace(
                        new RegExp(`\\b${escapeRegExp(correction.original)}\\b`, 'gi'),
                        correction.corrected
                    );
                    
                    if (newText !== originalText) {
                        line.text = newText;
                        line.corrected = true;
                        correctionCount++;
                        console.log(`Corrected: "${correction.original}" → "${correction.corrected}"`);
                    }
                }
            });
            
            // Clear the correction buffer
            correctionBuffer = [];
            
            // Re-render transcript
            renderTranscript();
            
            // Show feedback
            if (correctionCount > 0) {
                showFeedback(`Corrected ${correctionCount} word${correctionCount > 1 ? 's' : ''}`, 'success');
            } else if (isManual) {
                showFeedback('No corrections needed', 'info');
            }
            
        } else if (result && result.error) {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Transcript correction failed:', error);
        if (isManual) {
            showFeedback('Correction failed: ' + error.message, 'error');
        }
    } finally {
        isCorrecting = false;
        hideAIActivity();
        
        if (polishBtn) {
            polishBtn.classList.remove('correcting');
        }
    }
}

// Helper to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Screenshot functions
async function takeStealthScreenshot() {
    try {
        showFeedback('Taking screenshot...', 'info');
        await window.electronAPI.takeStealthScreenshot();
    } catch (error) {
        console.error('Screenshot error:', error);
        showFeedback('Screenshot failed', 'error');
    }
}

async function analyzeScreenshots() {
    if (screenshotsCount === 0) {
        showFeedback('No screenshots to analyze', 'error');
        return;
    }

    try {
        setAnalyzing(true);
        showLoadingOverlay();
        showAIActivity('Analyzing...');

        const context = chatMessagesArray
            .map(msg => `${msg.type}: ${msg.content}`)
            .join('\n\n');

        await window.electronAPI.analyzeStealthWithContext(context);
    } catch (error) {
        console.error('Analysis error:', error);
        showFeedback('Analysis failed', 'error');
        setAnalyzing(false);
        hideLoadingOverlay();
        hideAIActivity();
    }
}

async function clearStealthData() {
    try {
        await window.electronAPI.clearStealth();
        screenshotsCount = 0;
        chatMessagesArray = [];
        if (chatMessagesElement) {
            chatMessagesElement.innerHTML = '';
        }
        
        // Clear transcript data
        transcriptLines = [];
        transcriptBuffer = [];
        correctionBuffer = [];
        currentLiveText = '';
        lastSummary = '';
        lastSummaryTime = null;
        
        // Reset transcript display
        renderTranscript();
        
        // Reset summary display
        if (summaryContent) {
            summaryContent.innerHTML = `
                <div class="summary-empty">
                    <span class="summary-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/></svg></span>
                    <span>Summary will appear here after recording begins</span>
                    <span style="font-size: 10px; margin-top: 4px;">Auto-updates every 5 minutes</span>
                </div>
            `;
        }
        if (summaryTimestamp) {
            summaryTimestamp.textContent = 'Last updated: --';
        }
        
        updateUI();
        showFeedback('Cleared', 'success');
    } catch (error) {
        console.error('Clear error:', error);
        showFeedback('Clear failed', 'error');
    }
}

async function emergencyHide() {
    try {
        await window.electronAPI.emergencyHide();
        showEmergencyOverlay();
    } catch (error) {
        console.error('Emergency hide error:', error);
    }
}

async function closeApplication() {
    try {
        console.log('Closing application...');
        await window.electronAPI.closeApp();
    } catch (error) {
        console.error('Close application error:', error);
    }
}

// ECHOASSIST FEATURES

async function getResponseSuggestions() {
    if (!window.electronAPI || !window.electronAPI.suggestResponse) {
        showFeedback('Feature not available', 'error');
        return;
    }

    try {
        showFeedback('Generating suggestions...', 'info');
        showAIActivity('Suggesting...');

        const recentMessages = chatMessagesArray
            .slice(-5)
            .map(m => `${m.type}: ${m.content}`)
            .join('\n');

        const context = recentMessages || 'Current meeting conversation';

        const result = await window.electronAPI.suggestResponse(context);

        hideAIActivity();

        if (result.success && result.suggestions) {
            addChatMessage('ai-response', `**What should I say?**\n\n${result.suggestions}`);
            showFeedback('Suggestions generated', 'success');
        } else {
            throw new Error(result.error || 'Failed to generate suggestions');
        }
    } catch (error) {
        console.error('Error getting suggestions:', error);
        hideAIActivity();
        showFeedback('Failed to generate suggestions', 'error');
        addChatMessage('system', `Error: ${error.message}`);
    }
}

async function generateMeetingNotes() {
    if (!window.electronAPI || !window.electronAPI.generateMeetingNotes) {
        showFeedback('Feature not available', 'error');
        return;
    }

    try {
        showFeedback('Generating meeting notes...', 'info');
        setAnalyzing(true);
        showAIActivity('Generating notes...');

        const result = await window.electronAPI.generateMeetingNotes();

        setAnalyzing(false);
        hideAIActivity();

        if (result.success && result.notes) {
            addChatMessage('ai-response', `**Meeting Notes**\n\n${result.notes}`);
            showFeedback('Meeting notes generated', 'success');
        } else {
            throw new Error(result.error || 'Failed to generate notes');
        }
    } catch (error) {
        console.error('Error generating notes:', error);
        setAnalyzing(false);
        hideAIActivity();
        showFeedback('Failed to generate notes', 'error');
        addChatMessage('system', `Error: ${error.message}`);
    }
}

async function getConversationInsights() {
    if (!window.electronAPI || !window.electronAPI.getConversationInsights) {
        showFeedback('Feature not available', 'error');
        return;
    }

    try {
        showFeedback('Analyzing conversation...', 'info');
        setAnalyzing(true);
        showAIActivity('Getting insights...');

        const result = await window.electronAPI.getConversationInsights();

        setAnalyzing(false);
        hideAIActivity();

        if (result.success && result.insights) {
            addChatMessage('ai-response', `**Conversation Insights**\n\n${result.insights}`);
            showFeedback('Insights generated', 'success');
        } else {
            throw new Error(result.error || 'Failed to get insights');
        }
    } catch (error) {
        console.error('Error getting insights:', error);
        setAnalyzing(false);
        hideAIActivity();
        showFeedback('Failed to get insights', 'error');
        addChatMessage('system', `Error: ${error.message}`);
    }
}

// UI Helper functions
function setAnalyzing(analyzing) {
    isAnalyzing = analyzing;
    updateUI();
}

function updateUI() {
    if (screenshotCount) {
        screenshotCount.textContent = screenshotsCount;
    }

    if (analyzeBtn) {
        // Enable Ask AI button if we have screenshots OR conversation history
        const hasContent = screenshotsCount > 0 || chatMessagesArray.length > 0;
        analyzeBtn.disabled = isAnalyzing || !hasContent;
    }
}

function showFeedback(message, type = 'info') {
    console.log(`Feedback (${type}):`, message);

    // Try new status toast first (Phase 6)
    if (statusToast && statusToastText) {
        statusToastText.textContent = message;
        statusToast.className = `status-toast ${type}`;
        
        // Clear previous timeout if any
        if (statusToast._hideTimeout) {
            clearTimeout(statusToast._hideTimeout);
        }
        
        // Auto-hide after 3 seconds
        statusToast._hideTimeout = setTimeout(() => {
            statusToast.classList.add('hidden');
        }, 3000);
        return;
    }

    // Fallback to legacy status text
    if (statusText) {
        statusText.textContent = message;
        statusText.className = `status-text ${type} show`;
        statusText.style.display = 'block';

        setTimeout(() => {
            statusText.classList.remove('show');
            setTimeout(() => {
                statusText.style.display = 'none';
            }, 300);
        }, 3000);
    }
}

// ============================================================================
// PHASE 6: CONTROL BAR FUNCTIONS
// ============================================================================

// Note: closeApplication() is defined above in the emergency/close section

/**
 * Toggle visibility of icon labels in the control bar
 */
function toggleIconLabels() {
    showIconLabels = !showIconLabels;
    
    const appContainer = document.getElementById('app');
    if (appContainer) {
        if (showIconLabels) {
            appContainer.classList.add('show-labels');
        } else {
            appContainer.classList.remove('show-labels');
        }
    }
    
    // Update toggle button state
    if (labelsToggle) {
        if (showIconLabels) {
            labelsToggle.classList.add('active');
        } else {
            labelsToggle.classList.remove('active');
        }
    }
    
    // Save preference
    saveUIPreferences();
    
    console.log('Icon labels:', showIconLabels ? 'visible' : 'hidden');
}

/**
 * Toggle auto-scroll behavior for transcript
 */
function toggleAutoScroll() {
    autoScrollEnabled = !autoScrollEnabled;
    
    // Update indicator
    if (autoScrollIndicator) {
        const textEl = autoScrollIndicator.querySelector('.auto-scroll-text');
        if (textEl) {
            textEl.textContent = `Auto-scroll: ${autoScrollEnabled ? 'ON' : 'OFF'}`;
        }
        
        if (autoScrollEnabled) {
            autoScrollIndicator.classList.add('active');
        } else {
            autoScrollIndicator.classList.remove('active');
        }
    }
    
    // If enabling, scroll to bottom immediately
    if (autoScrollEnabled && transcriptContent) {
        transcriptContent.scrollTop = transcriptContent.scrollHeight;
    }
    
    // Save preference
    saveUIPreferences();
    
    console.log('Auto-scroll:', autoScrollEnabled ? 'enabled' : 'disabled');
}

/**
 * Save UI preferences (labels visibility, auto-scroll)
 */
async function saveUIPreferences() {
    if (!window.electronAPI || !window.electronAPI.setUISettings) return;
    
    try {
        // Use existing UI settings API to store preferences
        await window.electronAPI.setUISettings({
            showIconLabels,
            autoScrollEnabled
        });
    } catch (error) {
        console.log('UI preferences saved locally only:', error.message);
    }
}

/**
 * Load UI preferences
 */
async function loadUIPreferences() {
    if (!window.electronAPI || !window.electronAPI.getUISettings) return;
    
    try {
        const result = await window.electronAPI.getUISettings();
        const settings = result.settings ?? result;
        
        if (settings) {
            // Apply labels preference
            if (settings.showIconLabels !== undefined) {
                showIconLabels = settings.showIconLabels;
                const appContainer = document.getElementById('app');
                if (appContainer && showIconLabels) {
                    appContainer.classList.add('show-labels');
                }
                if (labelsToggle && showIconLabels) {
                    labelsToggle.classList.add('active');
                }
            }
            
            // Apply auto-scroll preference
            if (settings.autoScrollEnabled !== undefined) {
                autoScrollEnabled = settings.autoScrollEnabled;
                if (autoScrollIndicator) {
                    const textEl = autoScrollIndicator.querySelector('.auto-scroll-text');
                    if (textEl) {
                        textEl.textContent = `Auto-scroll: ${autoScrollEnabled ? 'ON' : 'OFF'}`;
                    }
                    if (autoScrollEnabled) {
                        autoScrollIndicator.classList.add('active');
                    }
                }
            }
        }
    } catch (error) {
        console.log('Could not load UI preferences:', error.message);
    }
}

/**
 * Auto-scroll transcript to bottom if enabled
 */
function autoScrollTranscript() {
    if (autoScrollEnabled && transcriptContent) {
        requestAnimationFrame(() => {
            transcriptContent.scrollTop = transcriptContent.scrollHeight;
        });
    }
}

/**
 * Initialize auto-scroll indicator on startup
 */
function initializeAutoScrollIndicator() {
    if (autoScrollIndicator) {
        const textEl = autoScrollIndicator.querySelector('.auto-scroll-text');
        if (textEl) {
            textEl.textContent = `Auto-scroll: ${autoScrollEnabled ? 'ON' : 'OFF'}`;
        }
        if (autoScrollEnabled) {
            autoScrollIndicator.classList.add('active');
        }
    }
}

// ============================================================================
// AI ACTIVITY INDICATOR
// ============================================================================

let aiActivityCount = 0; // Track concurrent AI operations

function showAIActivity(text = 'AI working...') {
    aiActivityCount++;
    
    if (aiActivityIndicator) {
        aiActivityIndicator.classList.remove('hidden');
        if (aiActivityText) {
            aiActivityText.textContent = text;
        }
    }
    
    console.log(`AI Activity: "${text}" (active: ${aiActivityCount})`);
}

function hideAIActivity() {
    aiActivityCount = Math.max(0, aiActivityCount - 1);
    
    // Only hide if no more active operations
    if (aiActivityCount === 0 && aiActivityIndicator) {
        aiActivityIndicator.classList.add('hidden');
    }
    
    console.log(`AI Activity hidden (remaining: ${aiActivityCount})`);
}

function updateAIActivityText(text) {
    if (aiActivityText && aiActivityCount > 0) {
        aiActivityText.textContent = text;
    }
}

function showLoadingOverlay(message = 'Analyzing screen...') {
    if (loadingOverlay) {
        // Update the loading text if custom message provided
        const loadingTextElement = loadingOverlay.querySelector('.loading-text');
        if (loadingTextElement) {
            loadingTextElement.innerHTML = message;
        }
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        // Reset to default text
        const loadingTextElement = loadingOverlay.querySelector('.loading-text');
        if (loadingTextElement) {
            loadingTextElement.innerHTML = 'Analyzing screen...';
        }
    }
}

function showEmergencyOverlay() {
    if (emergencyOverlay) {
        emergencyOverlay.classList.remove('hidden');
        setTimeout(() => {
            emergencyOverlay.classList.add('hidden');
        }, 2000);
    }
}

function hideResults() {
    if (resultsPanel) {
        resultsPanel.classList.add('hidden');
    }
}

async function copyToClipboard() {
    // If we have transcript lines, copy the full transcript
    if (transcriptLines.length > 0) {
        try {
            const transcriptText = transcriptLines
                .map(line => {
                    const timeStr = line.timestamp.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `[${timeStr}] ${line.text}`;
                })
                .join('\n');
            
            await navigator.clipboard.writeText(transcriptText);
            showFeedback('Transcript copied', 'success');
            return;
        } catch (error) {
            console.error('Copy error:', error);
            showFeedback('Copy failed', 'error');
            return;
        }
    }
    
    // Fallback: copy last AI response
    const lastAiMessage = chatMessagesArray
        .slice()
        .reverse()
        .find(msg => msg.type === 'ai-response');

    if (!lastAiMessage) {
        showFeedback('No content to copy', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(lastAiMessage.content);
        showFeedback('Copied to clipboard', 'success');
    } catch (error) {
        console.error('Copy error:', error);
        showFeedback('Copy failed', 'error');
    }
}

// Chat message management
function formatResponse(text) {
    let formatted = text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    return formatted;
}

function addChatMessage(type, content) {
    if (!chatMessagesElement) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;

    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    let messageContent = '';

    switch (type) {
        case 'voice':
            messageContent = `<div class="message-header"><span class="message-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></span><span class="message-time">${timestamp}</span></div><div class="message-content">${content}</div>`;
            break;

        case 'screenshot':
            messageContent = `<div class="message-header"><span class="message-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg></span><span class="message-time">${timestamp}</span></div><div class="message-content">${content}</div>`;
            break;

        case 'ai-response':
            messageContent = `<div class="message-header"><span class="message-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></span><span class="message-time">${timestamp}</span></div><div class="message-content ai-response">${formatResponse(content)}</div>`;
            break;

        case 'system':
            messageContent = `<div class="message-header"><span class="message-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span><span class="message-time">${timestamp}</span></div><div class="message-content system-message">${content}</div>`;
            break;
    }

    messageDiv.innerHTML = messageContent;
    chatMessagesElement.appendChild(messageDiv);

    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;

    chatMessagesArray.push({
        type,
        content,
        timestamp: new Date()
    });

    // Update UI to enable/disable buttons based on content
    updateUI();
}

// Timer
function startTimer() {
    const timerElement = document.querySelector('.timer');
    if (!timerElement) return;

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// Event listeners
function setupEventListeners() {
    if (screenshotBtn) screenshotBtn.addEventListener('click', takeStealthScreenshot);
    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeScreenshots);
    if (clearBtn) clearBtn.addEventListener('click', clearStealthData);
    if (hideBtn) hideBtn.addEventListener('click', emergencyHide);
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);
    if (closeResultsBtn) closeResultsBtn.addEventListener('click', hideResults);
    if (voiceToggle) voiceToggle.addEventListener('click', toggleVoiceRecognition);

    // New feature buttons
    if (suggestBtn) suggestBtn.addEventListener('click', getResponseSuggestions);
    if (notesBtn) notesBtn.addEventListener('click', generateMeetingNotes);
    if (insightsBtn) insightsBtn.addEventListener('click', getConversationInsights);

    // AI Provider selector
    if (providerSelect) providerSelect.addEventListener('change', handleProviderChange);

    // Theme and appearance controls
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (transparencySlider) transparencySlider.addEventListener('input', handleOpacityChange);
    
    // Dev mode / content protection toggle
    const devModePill = document.getElementById('dev-mode-pill');
    if (devModePill) devModePill.addEventListener('click', toggleContentProtection);

    // Settings modal
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
    if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
    if (saveAllSettings) saveAllSettings.addEventListener('click', saveAndCloseSettings);
    if (resetSettings) resetSettings.addEventListener('click', resetAllSettings);
    
    // Settings range inputs - update displayed values
    if (historyLengthSlider) {
        historyLengthSlider.addEventListener('input', () => {
            if (historyLengthValue) historyLengthValue.textContent = historyLengthSlider.value;
        });
    }
    if (maxScreenshotsSlider) {
        maxScreenshotsSlider.addEventListener('input', () => {
            if (maxScreenshotsValue) maxScreenshotsValue.textContent = maxScreenshotsSlider.value;
        });
    }
    if (captureDelaySlider) {
        captureDelaySlider.addEventListener('input', () => {
            if (captureDelayValue) captureDelayValue.textContent = `${captureDelaySlider.value}ms`;
        });
    }
    
    // API key visibility toggles
    document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });
    });
    
    // API key save buttons
    document.querySelectorAll('.save-api-key-btn').forEach(btn => {
        btn.addEventListener('click', () => saveApiKey(btn.dataset.provider));
    });
    
    // API key clear buttons
    document.querySelectorAll('.clear-api-key-btn').forEach(btn => {
        btn.addEventListener('click', () => clearApiKey(btn.dataset.provider));
    });
    
    // Close settings on backdrop click
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }
    
    // Vosk model management
    if (downloadVoskBtn) {
        downloadVoskBtn.addEventListener('click', downloadVoskModel);
    }
    if (deleteVoskBtn) {
        deleteVoskBtn.addEventListener('click', deleteVoskModel);
    }
    
    // Vosk model size selection
    voskModelRadios.forEach(radio => {
        radio.addEventListener('change', handleVoskModelSizeChange);
    });
    
    // Summary panel controls
    if (toggleSummaryBtn) {
        toggleSummaryBtn.addEventListener('click', toggleSummaryPanel);
    }
    if (refreshSummaryBtn) {
        refreshSummaryBtn.addEventListener('click', () => {
            if (!isSummarizing) {
                summarizeTranscript();
            }
        });
    }
    
    // Polish button for transcript correction
    if (polishBtn) {
        polishBtn.addEventListener('click', () => {
            if (!isCorrecting) {
                correctTranscript(true); // Manual correction
            }
        });
    }

    // Window lock button
    if (lockBtn !== null) {
        lockBtn.addEventListener('click', toggleWindowLock);
        // Load saved lock state
        loadWindowLockState();
    }

    // Phase 5: Region selection
    const regionBtn = document.getElementById('region-btn');
    if (regionBtn) regionBtn.addEventListener('click', toggleRegionContextMenu);

    const regionDraw = document.getElementById('region-draw');
    if (regionDraw) regionDraw.addEventListener('click', () => {
      hideRegionContextMenu();
      if (window.electronAPI) window.electronAPI.selectCaptureRegion();
    });

    const regionWindow = document.getElementById('region-window');
    if (regionWindow) regionWindow.addEventListener('click', () => {
      hideRegionContextMenu();
      openWindowPicker();
    });

    const regionFullscreen = document.getElementById('region-fullscreen');
    if (regionFullscreen) regionFullscreen.addEventListener('click', () => {
      hideRegionContextMenu();
      resetCaptureMode();
    });

    const closeWindowPicker = document.getElementById('close-window-picker');
    if (closeWindowPicker) closeWindowPicker.addEventListener('click', closeWindowPickerModal);

    const windowSearchInput = document.getElementById('window-search-input');
    if (windowSearchInput) windowSearchInput.addEventListener('input', filterWindowList);

    // Window picker backdrop click to close
    const windowPickerModal = document.getElementById('window-picker-modal');
    if (windowPickerModal) {
      windowPickerModal.addEventListener('click', (e) => {
        if (e.target === windowPickerModal) closeWindowPickerModal();
      });
    }

    // Close region context menu on click outside
    document.addEventListener('click', (e) => {
      const contextMenu = document.getElementById('region-context-menu');
      const regionBtnEl = document.getElementById('region-btn');
      if (contextMenu && !contextMenu.classList.contains('hidden') &&
          !contextMenu.contains(e.target) && e.target !== regionBtnEl &&
          !regionBtnEl.contains(e.target)) {
        hideRegionContextMenu();
      }
    });

    // Phase 6: Close button (application exit)
    if (closeBtn) {
        closeBtn.addEventListener('click', closeApplication);
    }

    // Phase 6: Labels toggle
    if (labelsToggle) {
        labelsToggle.addEventListener('click', toggleIconLabels);
    }

    // Phase 6: Auto-scroll toggle
    if (autoScrollIndicator) {
        autoScrollIndicator.addEventListener('click', toggleAutoScroll);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.shiftKey) {
            switch (e.key.toLowerCase()) {
                case 'h':
                    e.preventDefault();
                    if (window.electronAPI) window.electronAPI.toggleStealth();
                    break;
                case 's':
                    e.preventDefault();
                    takeStealthScreenshot();
                    break;
                case 'a':
                    e.preventDefault();
                    analyzeScreenshots();
                    break;
                case 'x':
                    e.preventDefault();
                    emergencyHide();
                    break;
                case 'v':
                    e.preventDefault();
                    toggleVoiceRecognition();
                    break;
            }
        }
    });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
}

// IPC listeners
function setupIpcListeners() {
    if (!window.electronAPI) {
        console.error('electronAPI not available');
        return;
    }

    window.electronAPI.onScreenshotTakenStealth((count) => {
        screenshotsCount = count;
        updateUI();

        // Phase 5: Show mode-specific feedback
        let modeLabel = 'Full Screen';
        let flashClass = 'flash-full';
        if (captureMode === 'region') {
          modeLabel = 'Region';
          flashClass = 'flash-region';
        } else if (captureMode === 'window') {
          modeLabel = 'Window';
          flashClass = 'flash-window';
        }
        addChatMessage('screenshot', `Screenshot captured (${modeLabel})`);
        showFeedback(`Screenshot captured (${modeLabel})`, 'success');

        // Trigger flash animation
        const glass = document.querySelector('.glass-container');
        if (glass !== null) {
          glass.classList.remove('flash-full', 'flash-region', 'flash-window');
          // Force reflow to restart animation
          void glass.offsetWidth;
          glass.classList.add(flashClass);
          setTimeout(() => glass.classList.remove(flashClass), 600);
        }
    });

    window.electronAPI.onAnalysisStart(() => {
        setAnalyzing(true);
        showLoadingOverlay();
        addChatMessage('system', 'Analyzing screenshots and context...');
    });

    window.electronAPI.onAnalysisResult((data) => {
        setAnalyzing(false);
        hideLoadingOverlay();
        hideAIActivity();

        if (data.error) {
            addChatMessage('system', `Error: ${data.error}`);
            showFeedback('Analysis failed', 'error');
        } else {
            addChatMessage('ai-response', data.text);
            showFeedback('Analysis complete', 'success');
        }
    });

    window.electronAPI.onSetStealthMode((enabled) => {
        stealthModeActive = enabled;
        showFeedback(enabled ? 'Stealth mode ON' : 'Stealth mode OFF', 'info');
    });

    window.electronAPI.onEmergencyClear(() => {
        showEmergencyOverlay();
    });

    window.electronAPI.onError((message) => {
        showFeedback(message, 'error');
    });

    // Phase 5: Capture config changed
    if (window.electronAPI.onCaptureConfigChanged) {
      window.electronAPI.onCaptureConfigChanged((config) => {
        updateCaptureModeBadge(config);
      });
    }

    // Phase 5: Window not found notification
    if (window.electronAPI.onCaptureWindowNotFound) {
      window.electronAPI.onCaptureWindowNotFound((title) => {
        const msg = title
          ? `Target window '${title}' not found — captured full screen instead`
          : 'Target window not found — captured full screen instead';
        showFeedback(msg, 'warning');
        addChatMessage('system', msg);
      });
    }

    // Phase 6: Listen for window picker open request from control bar
    if (window.electronAPI.onOpenWindowPicker) {
      window.electronAPI.onOpenWindowPicker(() => {
        openWindowPicker();
      });
    }

    // Phase 6: Listen for theme changes broadcast from control bar
    if (window.electronAPI.onThemeChanged) {
      window.electronAPI.onThemeChanged((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      });
    }

    // Vosk live transcription event listeners
    window.electronAPI.onVoskStatus((data) => {
        console.log('Vosk status:', data.status, '-', data.message);

        switch (data.status) {
            case 'downloading':
                showLoadingOverlay(`Downloading Vosk model...<br><small>${data.message}</small>`);
                showFeedback(`Downloading model... ${data.message}`, 'info');
                break;
            case 'extracting':
                showLoadingOverlay('Extracting model...<br><small>Almost ready!</small>');
                showFeedback('Extracting model...', 'info');
                break;
            case 'loading':
                // Only show loading overlay if user explicitly started recording
                // During prewarm, just update status bar silently
                if (isRecording) {
                    showLoadingOverlay('Loading Vosk AI model...<br><small>This may take 10-30 seconds</small>');
                }
                voskPrewarmStatus = 'loading';
                updateStatusBarVoice();
                break;
            case 'ready':
                hideLoadingOverlay();
                voskIsPrewarmed = true;
                voskPrewarmStatus = 'ready';
                updateVoiceButtonState();
                // Only show feedback if user was explicitly waiting
                if (isAppInitialized) {
                    showFeedback('Speech model ready - click mic to start', 'success');
                }
                // Ensure button is in "ready to record" state (not active)
                if (voiceToggle) {
                    voiceToggle.classList.remove('active', 'model-loading');
                    voiceToggle.style.background = '';
                }
                break;
            case 'listening':
                hideLoadingOverlay();
                voskIsPrewarmed = true;
                voskPrewarmStatus = 'ready';
                updateVoiceButtonState();
                // Only activate the mic button if the user explicitly started recording
                if (isRecording) {
                    showFeedback('Listening... Speak now!', 'success');
                    if (voiceToggle) {
                        voiceToggle.classList.add('active');
                        voiceToggle.classList.remove('model-loading');
                        voiceToggle.style.background = 'rgba(34, 197, 94, 0.3)';
                    }
                }
                // If not recording (prewarm), leave button in ready state
                break;
            case 'stopped':
                hideLoadingOverlay();
                // Only show feedback and update button if user was recording
                if (isRecording) {
                    showFeedback('Paused listening', 'info');
                }
                if (voiceToggle) {
                    voiceToggle.classList.remove('active');
                    voiceToggle.style.background = '';
                }
                break;
        }
    });

    window.electronAPI.onVoskPartial((data) => {
        console.log('onVoskPartial IPC received:', data);
        handleVoskPartial(data);
    });

    window.electronAPI.onVoskFinal((data) => {
        console.log('onVoskFinal IPC received:', data);
        handleVoskFinal(data);
    });

    window.electronAPI.onVoskError((data) => {
        console.error('Vosk error:', data.error);
        showFeedback(`Vosk error: ${data.error}`, 'error');
        addChatMessage('system', `Vosk error: ${data.error}`);

        // Stop recording on error
        if (isRecording) {
            isRecording = false;
            updateVoiceUI();
            updateStatusBarVoice();
            if (voiceToggle) {
                voiceToggle.classList.remove('active');
            }
        }
    });

    window.electronAPI.onVoskStopped(() => {
        console.log('Vosk stopped');
        if (isRecording) {
            isRecording = false;
            updateVoiceUI();
            updateStatusBarVoice();
            if (voiceToggle) {
                voiceToggle.classList.remove('active');
            }
        }
    });

    // Provider change event
    window.electronAPI.onProviderChanged((data) => {
        console.log('Provider changed to:', data.provider);
        currentProvider = data.provider;
        updateProviderSelection();
        updateStatusBarProvider();
        
        // Only show "Switched to" message after app is initialized (not during startup)
        if (isAppInitialized && data.info) {
            const displayName = data.info.displayName ?? data.provider;
            showFeedback(`Provider: ${displayName}`, 'info');
            setStatusBarMessage(`Switched to ${displayName}`, 3000);
        }
    });

    // Settings change events
    if (window.electronAPI.onSettingsChanged) {
        window.electronAPI.onSettingsChanged((data) => {
            console.log('Settings changed:', data);
            if (data.type === 'api-keys') {
                updateApiKeyStatusIndicators(data.configured);
            }
        });
    }

    if (window.electronAPI.onProvidersUpdated) {
        window.electronAPI.onProvidersUpdated((data) => {
            console.log('Providers updated:', data);
            availableProviders = data.providers || [];
            updateProviderDropdown();
            if (data.active) {
                currentProvider = data.active;
                updateProviderSelection();
            }
        });
    }

    // Correction settings change events
    if (window.electronAPI.onCorrectionSettingsChanged) {
        window.electronAPI.onCorrectionSettingsChanged((data) => {
            console.log('Correction settings changed:', data);
            applyCorrectionSettings(data);
        });
    }

    // Vosk download progress events
    if (window.electronAPI.onVoskDownloadProgress) {
        window.electronAPI.onVoskDownloadProgress((data) => {
            console.log('Vosk download progress:', data);
            updateVoskDownloadProgress(data);
        });
    }

    if (window.electronAPI.onVoskModelInstalled) {
        window.electronAPI.onVoskModelInstalled((data) => {
            console.log('Vosk model installed status:', data);
            voskModelInstalled = data.installed;
            updateVoiceButtonState();
            updateVoskSettingsUI();
        });
    }

    // Vosk prewarm status events
    if (window.electronAPI.onVoskPrewarmStatus) {
        window.electronAPI.onVoskPrewarmStatus((data) => {
            console.log('Vosk prewarm status:', data);
            handleVoskPrewarmStatus(data);
        });
    }
}

// ============================================================================
// STATUS BAR MANAGEMENT
// ============================================================================

function updateStatusBarProvider() {
    if (!statusBarProvider) return;
    
    const providerIcons = {
        gemini: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
        openai: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2 14.7c.6-1.8.3-3.8-.8-5.4a6.2 6.2 0 00-6.7-2.8A6.1 6.1 0 009.9 3a6.2 6.2 0 00-5.9 4.2A6.2 6.2 0 001.8 14c-.6 1.8-.3 3.8.8 5.4a6.2 6.2 0 006.7 2.8A6.1 6.1 0 0014.1 21a6.2 6.2 0 005.9-4.2c1.2-.3 2.2-1 2.2-2.1z"/></svg>',
        anthropic: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
        openrouter: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
    };
    
    const providerNames = {
        gemini: 'Gemini',
        openai: 'GPT-4o',
        anthropic: 'Claude',
        openrouter: 'OpenRouter'
    };
    
    const icon = providerIcons[currentProvider] ?? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
    const name = providerNames[currentProvider] ?? currentProvider;
    
    statusBarProvider.innerHTML = `
        <span class="status-icon">${icon}</span>
        <span class="status-label">${name}</span>
    `;
    statusBarProvider.setAttribute('data-provider', currentProvider);
}

function updateStatusBarVoice() {
    if (!statusBarVoice) return;
    
    statusBarVoice.classList.remove('not-ready', 'ready', 'listening', 'loading');
    
    const micIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v4M8 23h8"/></svg>';
    const recordIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>';
    const loadingIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="spin-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/><path d="M12 2v4c3.31 0 6 2.69 6 6h4c0-5.52-4.48-10-10-10z"/></svg>';
    
    if (!voskModelInstalled) {
        statusBarVoice.classList.add('not-ready');
        statusBarVoice.innerHTML = `
            <span class="status-icon">${micIcon}</span>
            <span class="status-label">Model Required</span>
        `;
    } else if (voskPrewarmStatus === 'loading') {
        statusBarVoice.classList.add('loading');
        statusBarVoice.innerHTML = `
            <span class="status-icon">${loadingIcon}</span>
            <span class="status-label">Loading Model...</span>
        `;
    } else if (isRecording) {
        statusBarVoice.classList.add('listening');
        statusBarVoice.innerHTML = `
            <span class="status-icon">${recordIcon}</span>
            <span class="status-label">Listening...</span>
        `;
    } else if (voskIsPrewarmed) {
        statusBarVoice.classList.add('ready');
        statusBarVoice.innerHTML = `
            <span class="status-icon">${micIcon}</span>
            <span class="status-label">Voice Ready</span>
        `;
    } else {
        statusBarVoice.classList.add('not-ready');
        statusBarVoice.innerHTML = `
            <span class="status-icon">${micIcon}</span>
            <span class="status-label">Initializing...</span>
        `;
    }
}

// ============================================================================
// VOSK PREWARM STATUS HANDLING
// ============================================================================

function handleVoskPrewarmStatus(data) {
    const { status, message, modelSize } = data;
    
    voskPrewarmStatus = status;
    
    switch (status) {
        case 'loading':
            voskIsPrewarmed = false;
            updateStatusBarVoice();
            updateVoiceButtonState();
            // Show a subtle loading indicator
            if (!isAppInitialized) {
                // During startup, don't show feedback - just update status bar
                console.log('Vosk prewarm: Loading model...');
            } else {
                showFeedback('Loading speech model...', 'info');
            }
            break;
            
        case 'ready':
            voskIsPrewarmed = true;
            voskModelInstalled = true;
            updateStatusBarVoice();
            updateVoiceButtonState();
            if (isAppInitialized) {
                showFeedback('Speech model ready!', 'success');
            }
            console.log('Vosk prewarm: Model ready for instant transcription');
            break;
            
        case 'not_installed':
            voskIsPrewarmed = false;
            voskModelInstalled = false;
            updateStatusBarVoice();
            updateVoiceButtonState();
            break;
            
        case 'error':
            voskIsPrewarmed = false;
            voskPrewarmStatus = 'error';
            updateStatusBarVoice();
            updateVoiceButtonState();
            if (isAppInitialized) {
                showFeedback(`Speech model error: ${message}`, 'error');
            }
            console.error('Vosk prewarm error:', message);
            break;
            
        case 'idle':
            voskIsPrewarmed = false;
            updateStatusBarVoice();
            updateVoiceButtonState();
            break;
    }
}

function updateStatusBarProgress(show, progress = 0, message = '') {
    if (!statusBarProgress) return;
    
    if (show) {
        statusBarProgress.classList.remove('hidden');
        if (miniProgressFill) miniProgressFill.style.width = `${progress}%`;
        if (miniProgressText) miniProgressText.textContent = message;
    } else {
        statusBarProgress.classList.add('hidden');
    }
}

function setStatusBarMessage(message, timeout = 3000) {
    if (!statusBarMessage) return;
    
    statusBarMessage.textContent = message;
    
    if (timeout > 0) {
        setTimeout(() => {
            statusBarMessage.textContent = '';
        }, timeout);
    }
}

// ============================================================================
// VOSK MODEL MANAGEMENT
// ============================================================================

async function checkVoskModelStatus() {
    if (!window.electronAPI || !window.electronAPI.getVoskModelStatus) {
        console.warn('Vosk model status API not available');
        return;
    }
    
    try {
        const result = await window.electronAPI.getVoskModelStatus();
        console.log('Vosk model status:', result);
        
        if (result.success) {
            // Store full model status
            voskModelStatus.isDevelopment = result.isDevelopment === true;
            currentVoskModelSize = result.modelSize ?? 'large';
            
            // Process all models status
            if (result.allModels) {
                result.allModels.forEach(model => {
                    voskModelStatus.installed[model.size] = model.installed;
                    voskModelStatus.localAvailable[model.size] = model.localAvailable;
                });
            }
            
            // Check if selected model is installed
            voskModelInstalled = result.installed;
            
            // Update UI
            updateVoskModelSelectorUI();
            updateVoiceButtonState();
        }
        
        // Also check prewarm status
        if (window.electronAPI.getVoskPrewarmStatus) {
            const prewarmResult = await window.electronAPI.getVoskPrewarmStatus();
            console.log('Vosk prewarm status:', prewarmResult);
            
            if (prewarmResult.success) {
                voskPrewarmStatus = prewarmResult.status;
                voskIsPrewarmed = prewarmResult.isPrewarmed === true;
                updateVoiceButtonState();
            }
        }
    } catch (error) {
        console.error('Failed to check Vosk model status:', error);
    }
}

function updateVoskModelSelectorUI() {
    // Update radio button selection
    voskModelRadios.forEach(radio => {
        if (radio.value === currentVoskModelSize) {
            radio.checked = true;
        }
    });
    
    // Update status indicators for each model
    const sizes = ['small', 'medium', 'large'];
    sizes.forEach(size => {
        const statusEl = document.getElementById(`vosk-${size}-status`);
        if (statusEl) {
            const isInstalled = voskModelStatus.installed[size];
            const isLocalAvailable = voskModelStatus.localAvailable[size];
            
            statusEl.classList.remove('installed', 'local-available', 'not-installed');
            
            if (isInstalled) {
                statusEl.textContent = '✓ Ready';
                statusEl.classList.add('installed');
            } else if (isLocalAvailable) {
                statusEl.textContent = '📦 Available';
                statusEl.classList.add('local-available');
            } else {
                statusEl.textContent = '↓ Download';
                statusEl.classList.add('not-installed');
            }
        }
    });
    
    // Update download button text based on whether local model is available
    if (downloadVoskBtnText) {
        const isSelectedInstalled = voskModelStatus.installed[currentVoskModelSize];
        const isSelectedLocalAvailable = voskModelStatus.localAvailable[currentVoskModelSize];
        
        if (isSelectedInstalled) {
            downloadVoskBtnText.textContent = 'Model Ready';
        } else if (isSelectedLocalAvailable) {
            downloadVoskBtnText.textContent = `Extract ${currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1)} Model`;
        } else {
            const sizeDesc = { small: '~50 MB', medium: '~500 MB', large: '~1.8 GB' };
            downloadVoskBtnText.textContent = `Download ${currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1)} (${sizeDesc[currentVoskModelSize]})`;
        }
    }
    
    // Show/hide dev notice
    if (voskDevNotice) {
        const hasLocalModels = Object.values(voskModelStatus.localAvailable).some(v => v);
        voskDevNotice.style.display = (voskModelStatus.isDevelopment && hasLocalModels) ? 'flex' : 'none';
    }
}

function updateVoiceButtonState() {
    if (!voiceToggle) return;
    
    if (!voskModelInstalled) {
        // Model not installed
        voiceToggle.classList.add('model-required');
        voiceToggle.classList.remove('model-loading');
        voiceToggle.disabled = true;
        voiceToggle.title = 'Vosk model required - open Settings to download';
    } else if (voskPrewarmStatus === 'loading') {
        // Model is loading/prewarming
        voiceToggle.classList.remove('model-required');
        voiceToggle.classList.add('model-loading');
        voiceToggle.disabled = true;
        voiceToggle.title = 'Loading speech model...';
    } else if (voskIsPrewarmed || voskPrewarmStatus === 'ready') {
        // Model is ready
        voiceToggle.classList.remove('model-required', 'model-loading');
        voiceToggle.disabled = false;
        voiceToggle.title = 'Toggle Voice Recognition (Ctrl+Alt+Shift+V)';
    } else {
        // Model installed but not yet prewarmed (initializing)
        voiceToggle.classList.remove('model-required');
        voiceToggle.classList.add('model-loading');
        voiceToggle.disabled = true;
        voiceToggle.title = 'Initializing speech model...';
    }
    
    updateStatusBarVoice();
}

function updateVoskSettingsUI() {
    if (!voskStatus) return;
    
    // Check if currently selected model is installed
    const isSelectedInstalled = voskModelStatus.installed[currentVoskModelSize];
    const isSelectedLocalAvailable = voskModelStatus.localAvailable[currentVoskModelSize];
    
    if (isSelectedInstalled) {
        voskStatus.textContent = `✓ ${currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1)} Installed`;
        voskStatus.className = 'api-status configured';
        
        if (downloadVoskBtn) downloadVoskBtn.style.display = 'none';
        if (deleteVoskBtn) deleteVoskBtn.style.display = 'flex';
        if (voskProgressContainer) voskProgressContainer.style.display = 'none';
    } else {
        if (isSelectedLocalAvailable) {
            voskStatus.textContent = `📦 ${currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1)} Available`;
            voskStatus.className = 'api-status';
        } else {
            voskStatus.textContent = 'Not installed';
            voskStatus.className = 'api-status not-configured';
        }
        
        if (downloadVoskBtn) {
            downloadVoskBtn.style.display = 'flex';
            downloadVoskBtn.disabled = false;
            downloadVoskBtn.classList.remove('downloading');
            
            const sizeDesc = { small: '~50 MB', medium: '~500 MB', large: '~1.8 GB' };
            const actionText = isSelectedLocalAvailable ? 'Extract' : 'Download';
            
            downloadVoskBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <span id="download-vosk-btn-text">${actionText} ${currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1)} (${sizeDesc[currentVoskModelSize]})</span>
            `;
        }
        if (deleteVoskBtn) deleteVoskBtn.style.display = 'none';
    }
    
    // Also update the model selector UI
    updateVoskModelSelectorUI();
}

function updateVoskDownloadProgress(data) {
    const { status, progress, message } = data;
    
    // Update settings modal if open
    if (voskProgressContainer && voskProgressFill && voskProgressText) {
        if (status === 'downloading' || status === 'extracting') {
            voskProgressContainer.style.display = 'flex';
            voskProgressFill.style.width = `${progress}%`;
            voskProgressText.textContent = message || `${progress}%`;
            
            if (downloadVoskBtn) {
                downloadVoskBtn.disabled = true;
                downloadVoskBtn.classList.add('downloading');
                downloadVoskBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
                        <path d="M12 2v4c3.31 0 6 2.69 6 6h4c0-5.52-4.48-10-10-10z"/>
                    </svg>
                    ${status === 'extracting' ? 'Extracting...' : `${progress}%`}
                `;
            }
            
            if (voskStatus) {
                voskStatus.textContent = status === 'extracting' ? 'Extracting...' : `Downloading ${progress}%`;
                voskStatus.className = 'api-status';
            }
        }
    }
    
    // Always update status bar (visible even when settings closed)
    if (status === 'downloading' || status === 'extracting') {
        const statusMsg = status === 'extracting' 
            ? 'Extracting Vosk model...' 
            : `Downloading Vosk: ${progress}%`;
        updateStatusBarProgress(true, progress, statusMsg);
    } else if (status === 'complete') {
        voskModelInstalled = true;
        updateVoskSettingsUI();
        updateVoiceButtonState();
        updateStatusBarVoice();
        updateStatusBarProgress(false);
        setStatusBarMessage('Vosk model installed!', 5000);
        showFeedback('Vosk model installed! Voice recognition ready.', 'success');
    } else if (status === 'error') {
        updateStatusBarProgress(false);
        setStatusBarMessage(`Download failed`, 5000);
        
        if (voskProgressContainer) {
            voskProgressContainer.style.display = 'none';
        }
        
        if (downloadVoskBtn) {
            downloadVoskBtn.disabled = false;
            downloadVoskBtn.classList.remove('downloading');
            downloadVoskBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Retry Download
            `;
        }
        
        showFeedback(`Download failed: ${message}`, 'error');
    }
}

async function downloadVoskModel() {
    if (!window.electronAPI || !window.electronAPI.downloadVoskModel) {
        showFeedback('Download API not available', 'error');
        return;
    }
    
    const isLocalAvailable = voskModelStatus.localAvailable[currentVoskModelSize];
    const actionVerb = isLocalAvailable ? 'Extracting' : 'Downloading';
    
    console.log(`Starting Vosk ${currentVoskModelSize} model ${actionVerb.toLowerCase()}...`);
    
    // Show progress UI
    if (voskProgressContainer) voskProgressContainer.style.display = 'flex';
    if (voskProgressFill) voskProgressFill.style.width = '0%';
    if (voskProgressText) voskProgressText.textContent = 'Starting...';
    
    if (downloadVoskBtn) {
        downloadVoskBtn.disabled = true;
        downloadVoskBtn.classList.add('downloading');
    }
    
    try {
        // Pass the selected model size to the download function
        const result = await window.electronAPI.downloadVoskModel(currentVoskModelSize);
        console.log('Download result:', result);
        
        if (result.success) {
            voskModelInstalled = true;
            voskModelStatus.installed[currentVoskModelSize] = true;
            updateVoskSettingsUI();
            updateVoiceButtonState();
        }
    } catch (error) {
        console.error('Vosk download error:', error);
        showFeedback(`${actionVerb} failed: ${error.message ?? error}`, 'error');
        
        if (downloadVoskBtn) {
            downloadVoskBtn.disabled = false;
            downloadVoskBtn.classList.remove('downloading');
        }
    }
}

async function handleVoskModelSizeChange(event) {
    const newSize = event.target.value;
    if (newSize === currentVoskModelSize) return;
    
    console.log(`Changing Vosk model size from ${currentVoskModelSize} to ${newSize}`);
    currentVoskModelSize = newSize;
    
    // Save the preference
    if (window.electronAPI && window.electronAPI.setVoskModelSize) {
        try {
            const result = await window.electronAPI.setVoskModelSize(newSize);
            if (result.success) {
                // Update local state based on response
                voskModelInstalled = result.installed;
                updateVoskSettingsUI();
                updateVoiceButtonState();
                showFeedback(`Vosk model set to ${newSize}`, 'info');
            }
        } catch (error) {
            console.error('Failed to set Vosk model size:', error);
        }
    } else {
        // Just update UI
        voskModelInstalled = voskModelStatus.installed[newSize] ?? false;
        updateVoskSettingsUI();
        updateVoiceButtonState();
    }
}

async function deleteVoskModel() {
    if (!window.electronAPI || !window.electronAPI.deleteVoskModel) {
        showFeedback('Delete API not available', 'error');
        return;
    }
    
    const modelName = currentVoskModelSize.charAt(0).toUpperCase() + currentVoskModelSize.slice(1);
    if (!confirm(`Are you sure you want to delete the ${modelName} Vosk speech model? You will need to download it again to use voice recognition.`)) {
        return;
    }
    
    try {
        const result = await window.electronAPI.deleteVoskModel(currentVoskModelSize);
        
        if (result.success) {
            voskModelInstalled = false;
            voskModelStatus.installed[currentVoskModelSize] = false;
            updateVoskSettingsUI();
            updateVoiceButtonState();
            showFeedback(`${modelName} Vosk model deleted`, 'info');
        } else {
            showFeedback(`Failed to delete: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Failed to delete Vosk model:', error);
        showFeedback('Failed to delete model', 'error');
    }
}

// ============================================================================
// SETTINGS WINDOW FUNCTIONS
// ============================================================================

async function openSettingsModal() {
    // Open settings in a separate window instead of modal
    console.log('Opening settings window...');
    
    if (window.electronAPI && window.electronAPI.openSettings) {
        try {
            await window.electronAPI.openSettings();
        } catch (error) {
            console.error('Failed to open settings window:', error);
            showFeedback('Failed to open settings', 'error');
        }
    }
}

function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.classList.add('hidden');
}

async function loadSettingsIntoModal() {
    if (!window.electronAPI) return;
    
    try {
        // Load API key status
        const apiKeyStatus = await window.electronAPI.getApiKeyStatus();
        if (apiKeyStatus.success) {
            updateApiKeyStatusIndicators(apiKeyStatus.configured);
        }
        
        // Load Vosk model status
        await checkVoskModelStatus();
        updateVoskSettingsUI();
        
        // Load AI settings
        const aiSettings = await window.electronAPI.getAISettings();
        if (aiSettings.success && aiSettings.settings) {
            const settings = aiSettings.settings;
            
            if (defaultProviderSelect) {
                defaultProviderSelect.value = settings.defaultProvider ?? 'gemini';
            }
            if (enableFallbackCheckbox) {
                enableFallbackCheckbox.checked = settings.enableFallback !== false;
            }
            if (historyLengthSlider) {
                historyLengthSlider.value = settings.maxHistoryLength ?? 20;
                if (historyLengthValue) {
                    historyLengthValue.textContent = historyLengthSlider.value;
                }
            }
            
            // Load AI model preferences
            if (settings.models) {
                // Gemini
                if (geminiModelSelect && settings.models.gemini) {
                    geminiModelSelect.value = settings.models.gemini.model ?? 'gemini-2.5-flash-lite';
                }
                
                // OpenAI
                if (openaiVisionModelSelect && settings.models.openai?.visionModel) {
                    openaiVisionModelSelect.value = settings.models.openai.visionModel;
                }
                if (openaiTextModelSelect && settings.models.openai?.textModel) {
                    openaiTextModelSelect.value = settings.models.openai.textModel;
                }
                
                // Anthropic
                if (anthropicVisionModelSelect && settings.models.anthropic?.visionModel) {
                    anthropicVisionModelSelect.value = settings.models.anthropic.visionModel;
                }
                if (anthropicTextModelSelect && settings.models.anthropic?.textModel) {
                    anthropicTextModelSelect.value = settings.models.anthropic.textModel;
                }
                
                // OpenRouter
                if (openrouterVisionModelSelect && settings.models.openrouter?.visionModel) {
                    openrouterVisionModelSelect.value = settings.models.openrouter.visionModel;
                }
                if (openrouterTextModelSelect && settings.models.openrouter?.textModel) {
                    openrouterTextModelSelect.value = settings.models.openrouter.textModel;
                }
            }
        }
        
        // Load voice settings
        const voiceSettings = await window.electronAPI.getVoiceSettings();
        if (voiceSettings.success && voiceSettings.settings) {
            const settings = voiceSettings.settings;
            
            if (voiceLanguageSelect) {
                voiceLanguageSelect.value = settings.language || 'en-US';
            }
            if (voiceAutostartCheckbox) {
                voiceAutostartCheckbox.checked = settings.autoStart === true;
            }
        }
        
        // Load screenshot settings
        const screenshotSettings = await window.electronAPI.getScreenshotSettings();
        if (screenshotSettings.success && screenshotSettings.settings) {
            const settings = screenshotSettings.settings;
            
            if (maxScreenshotsSlider) {
                maxScreenshotsSlider.value = settings.maxCount || 3;
                if (maxScreenshotsValue) {
                    maxScreenshotsValue.textContent = maxScreenshotsSlider.value;
                }
            }
            if (captureDelaySlider) {
                captureDelaySlider.value = settings.captureDelay || 300;
                if (captureDelayValue) {
                    captureDelayValue.textContent = `${captureDelaySlider.value}ms`;
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to load settings:', error);
        showFeedback('Failed to load settings', 'error');
    }
}

function updateApiKeyStatusIndicators(configured) {
    const providers = ['gemini', 'openai', 'anthropic', 'openrouter'];
    
    providers.forEach(provider => {
        const statusEl = document.getElementById(`${provider}-status`);
        if (statusEl) {
            if (configured && configured[provider]) {
                statusEl.textContent = '✓ Configured';
                statusEl.className = 'api-status configured';
            } else {
                statusEl.textContent = 'Not configured';
                statusEl.className = 'api-status not-configured';
            }
        }
    });
}

async function saveApiKey(provider) {
    if (!window.electronAPI) return;
    
    const inputId = `${provider}-api-key`;
    const input = document.getElementById(inputId);
    
    if (!input) {
        console.error(`Input not found: ${inputId}`);
        return;
    }
    
    const apiKey = input.value.trim();
    
    if (!apiKey) {
        showFeedback('Please enter an API key', 'error');
        return;
    }
    
    try {
        const result = await window.electronAPI.setApiKey(provider, apiKey);
        
        if (result.success) {
            showFeedback(`${provider} API key saved!`, 'success');
            input.value = ''; // Clear input for security
            
            // Update status indicator
            const statusEl = document.getElementById(`${provider}-status`);
            if (statusEl) {
                statusEl.textContent = '✓ Configured';
                statusEl.className = 'api-status configured';
            }
            
            // Refresh provider dropdown
            await initializeProviders();
        } else {
            showFeedback(`Failed to save ${provider} key: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error(`Failed to save ${provider} API key:`, error);
        showFeedback(`Failed to save ${provider} key`, 'error');
    }
}

async function clearApiKey(provider) {
    if (!window.electronAPI) return;
    
    if (!confirm(`Are you sure you want to remove the ${provider} API key?`)) {
        return;
    }
    
    try {
        const result = await window.electronAPI.clearApiKey(provider);
        
        if (result.success) {
            showFeedback(`${provider} API key removed`, 'info');
            
            // Update status indicator
            const statusEl = document.getElementById(`${provider}-status`);
            if (statusEl) {
                statusEl.textContent = 'Not configured';
                statusEl.className = 'api-status not-configured';
            }
            
            // Clear input
            const input = document.getElementById(`${provider}-api-key`);
            if (input) input.value = '';
            
            // Refresh provider dropdown
            await initializeProviders();
        } else {
            showFeedback(`Failed to remove ${provider} key: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error(`Failed to clear ${provider} API key:`, error);
        showFeedback(`Failed to remove ${provider} key`, 'error');
    }
}

async function saveAndCloseSettings() {
    if (!window.electronAPI) return;
    
    try {
        // Collect AI model preferences
        const modelSettings = {
            gemini: {
                model: geminiModelSelect?.value ?? 'gemini-2.5-flash-lite'
            },
            openai: {
                visionModel: openaiVisionModelSelect?.value ?? 'gpt-4o',
                textModel: openaiTextModelSelect?.value ?? 'gpt-4o-mini'
            },
            anthropic: {
                visionModel: anthropicVisionModelSelect?.value ?? 'claude-sonnet-4-20250514',
                textModel: anthropicTextModelSelect?.value ?? 'claude-3-haiku-20240307'
            },
            openrouter: {
                visionModel: openrouterVisionModelSelect?.value ?? 'anthropic/claude-3.5-sonnet',
                textModel: openrouterTextModelSelect?.value ?? 'anthropic/claude-3-haiku'
            }
        };
        
        // Save AI settings (including model preferences)
        await window.electronAPI.setAISettings({
            defaultProvider: defaultProviderSelect?.value ?? 'gemini',
            enableFallback: enableFallbackCheckbox?.checked !== false,
            maxHistoryLength: parseInt(historyLengthSlider?.value ?? '20', 10),
            models: modelSettings
        });
        
        // Save voice settings (including Vosk model size)
        await window.electronAPI.setVoiceSettings({
            language: voiceLanguageSelect?.value ?? 'en-US',
            autoStart: voiceAutostartCheckbox?.checked === true,
            voskModelSize: currentVoskModelSize
        });
        
        // Save screenshot settings
        await window.electronAPI.setScreenshotSettings({
            maxCount: parseInt(maxScreenshotsSlider?.value ?? '3', 10),
            captureDelay: parseInt(captureDelaySlider?.value ?? '300', 10)
        });
        
        // Mark setup as completed
        await window.electronAPI.completeSetup();
        
        showFeedback('Settings saved!', 'success');
        closeSettingsModal();
        
        // Refresh providers
        await initializeProviders();
        
    } catch (error) {
        console.error('Failed to save settings:', error);
        showFeedback('Failed to save settings', 'error');
    }
}

async function resetAllSettings() {
    if (!window.electronAPI) return;
    
    if (!confirm('Are you sure you want to reset all settings to defaults? This will NOT remove your API keys.')) {
        return;
    }
    
    try {
        // Reset non-key settings by saving defaults
        await window.electronAPI.setAISettings({
            defaultProvider: 'gemini',
            enableFallback: true,
            maxHistoryLength: 20
        });
        
        await window.electronAPI.setVoiceSettings({
            language: 'en-US',
            autoStart: false
        });
        
        await window.electronAPI.setScreenshotSettings({
            maxCount: 3,
            captureDelay: 300
        });
        
        showFeedback('Settings reset to defaults', 'info');
        
        // Reload settings into modal
        await loadSettingsIntoModal();
        
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showFeedback('Failed to reset settings', 'error');
    }
}

// Check if first-run setup is needed
async function checkFirstRunSetup() {
    if (!window.electronAPI || !window.electronAPI.hasCompletedSetup) return;
    
    try {
        const result = await window.electronAPI.hasCompletedSetup();
        if (!result.completed) {
            // Check if any API keys are configured
            const apiKeyStatus = await window.electronAPI.getApiKeyStatus();
            const hasAnyKey = apiKeyStatus.configured && (
                apiKeyStatus.configured.gemini ||
                apiKeyStatus.configured.openai ||
                apiKeyStatus.configured.anthropic ||
                apiKeyStatus.configured.openrouter
            );
            
            if (!hasAnyKey) {
                // No API keys - show settings on first run
                setTimeout(() => {
                    openSettingsModal();
                    addChatMessage('system', 'Welcome! Please configure at least one AI provider API key to get started.');
                }, 500);
            }
        }
    } catch (error) {
        console.error('Failed to check setup status:', error);
    }
}

// ============================================================================
// PHASE 5: REGION / WINDOW CAPTURE SELECTION
// ============================================================================

// Capture mode state
let captureMode = 'fullScreen';

/**
 * Toggle the region context menu visibility.
 */
function toggleRegionContextMenu() {
  const menu = document.getElementById('region-context-menu');
  if (menu === null) return;

  if (menu.classList.contains('hidden')) {
    // Position near the region button
    const regionBtn = document.getElementById('region-btn');
    if (regionBtn !== null) {
      const rect = regionBtn.getBoundingClientRect();
      menu.style.left = `${rect.left}px`;
      menu.style.top = `${rect.bottom + 4}px`;
    }
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
}

function hideRegionContextMenu() {
  const menu = document.getElementById('region-context-menu');
  if (menu !== null) menu.classList.add('hidden');
}

/**
 * Open the window picker modal and populate with open windows.
 */
async function openWindowPicker() {
  const modal = document.getElementById('window-picker-modal');
  if (modal === null) return;

  modal.classList.remove('hidden');

  // Fetch open windows from main process
  if (window.electronAPI && window.electronAPI.getOpenWindows) {
    const result = await window.electronAPI.getOpenWindows();
    if (result.success) {
      populateWindowList(result.windows);
    } else {
      populateWindowList([]);
      if (result.error) {
        showFeedback('Could not list windows: ' + result.error, 'error');
      }
    }
  }
}

function closeWindowPickerModal() {
  const modal = document.getElementById('window-picker-modal');
  if (modal !== null) modal.classList.add('hidden');
}

/**
 * Populate the window picker list with available windows.
 * @param {Array} windows
 */
function populateWindowList(windows) {
  const list = document.getElementById('window-picker-list');
  if (list === null) return;

  // Keep the "Full Screen" option, remove the rest
  const fullScreenOption = list.querySelector('.fullscreen-option');
  list.innerHTML = '';
  if (fullScreenOption !== null) {
    list.appendChild(fullScreenOption);
    fullScreenOption.addEventListener('click', () => {
      resetCaptureMode();
      closeWindowPickerModal();
    });
  }

  for (const win of windows) {
    const item = document.createElement('div');
    item.className = 'window-picker-item';
    if (win.isMeetingApp) {
      item.classList.add('meeting-app');
    }
    item.dataset.title = win.title;
    item.dataset.processName = win.processName;

    item.innerHTML = `
      ${win.isMeetingApp ? '<span class="meeting-dot"></span>' : ''}
      <span class="window-title">${escapeHtml(win.title)}</span>
      <span class="window-process">${escapeHtml(win.processName)}</span>
    `;

    item.addEventListener('click', () => {
      selectCaptureWindow(win);
      closeWindowPickerModal();
    });

    list.appendChild(item);
  }
}

/**
 * Filter the window list based on search input.
 */
function filterWindowList() {
  const input = document.getElementById('window-search-input');
  const list = document.getElementById('window-picker-list');
  if (input === null || list === null) return;

  const query = input.value.toLowerCase();
  const items = list.querySelectorAll('.window-picker-item:not(.fullscreen-option)');

  for (const item of items) {
    const title = (item.dataset.title ?? '').toLowerCase();
    const process = (item.dataset.processName ?? '').toLowerCase();
    const matches = title.includes(query) || process.includes(query);
    item.style.display = matches ? '' : 'none';
  }
}

/**
 * Select a window for capture.
 * @param {{ title: string, processName: string }} windowInfo
 */
async function selectCaptureWindow(windowInfo) {
  if (window.electronAPI && window.electronAPI.selectCaptureWindow) {
    const result = await window.electronAPI.selectCaptureWindow({
      title: windowInfo.title,
      processName: windowInfo.processName
    });
    if (result.success) {
      showFeedback(`Capture: ${truncate(windowInfo.title, 30)}`, 'success');
    }
  }
}

/**
 * Reset capture mode to full screen.
 */
async function resetCaptureMode() {
  if (window.electronAPI && window.electronAPI.resetCaptureMode) {
    await window.electronAPI.resetCaptureMode();
    showFeedback('Capture: Full Screen', 'info');
  }
}

/**
 * Update the capture mode badge on the screenshot button.
 * @param {object} config - The capture configuration
 */
function updateCaptureModeBadge(config) {
  const badge = document.getElementById('capture-mode-badge');
  if (badge === null) return;

  const mode = config.mode ?? 'fullScreen';
  captureMode = mode;

  if (mode === 'fullScreen') {
    badge.style.display = 'none';
    badge.textContent = '';
    badge.className = 'capture-mode-badge';
  } else if (mode === 'region') {
    const region = config.region ?? {};
    badge.textContent = `${region.width ?? 0}x${region.height ?? 0}`;
    badge.className = 'capture-mode-badge badge-region';
    badge.style.display = '';
  } else if (mode === 'window') {
    const win = config.window ?? {};
    badge.textContent = truncate(win.title ?? win.processName ?? 'Window', 12);
    badge.className = 'capture-mode-badge badge-window';
    badge.style.display = '';
  }

  // Update the region button appearance
  const regionBtn = document.getElementById('region-btn');
  if (regionBtn !== null) {
    regionBtn.classList.toggle('active-region', mode === 'region');
    regionBtn.classList.toggle('active-window', mode === 'window');
  }
}

/**
 * Load initial capture config on app start.
 */
async function initCaptureConfig() {
  if (window.electronAPI && window.electronAPI.getCaptureConfig) {
    const result = await window.electronAPI.getCaptureConfig();
    if (result.success) {
      updateCaptureModeBadge(result.config);
    }
  }
}

/**
 * Truncate a string to maxLen characters, appending '...' if truncated.
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '\u2026';
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        checkFirstRunSetup();
    });
} else {
    init();
    checkFirstRunSetup();
}
