// Settings Window Script
// Handles all settings UI logic

// State
let currentVoskModelSize = 'large';
let voskModelStatus = {
  installed: {},
  localAvailable: {},
  isDevelopment: false
};
let speakerModelInstalled = false;
let configuredProviders = {}; // Track which providers have API keys

// DOM Elements
const closeBtn = document.getElementById('close-settings');
const saveBtn = document.getElementById('save-settings');

// API Key elements
const apiKeyInputs = {
  gemini: document.getElementById('gemini-api-key'),
  openai: document.getElementById('openai-api-key'),
  anthropic: document.getElementById('anthropic-api-key'),
  openrouter: document.getElementById('openrouter-api-key')
};

// AI Settings elements
const defaultProviderSelect = document.getElementById('default-provider');
const geminiModelSelect = document.getElementById('gemini-model');
const openaiVisionModelSelect = document.getElementById('openai-vision-model');
const openaiTextModelSelect = document.getElementById('openai-text-model');
const anthropicVisionModelSelect = document.getElementById('anthropic-vision-model');
const anthropicTextModelSelect = document.getElementById('anthropic-text-model');
const openrouterVisionModelSelect = document.getElementById('openrouter-vision-model');
const openrouterTextModelSelect = document.getElementById('openrouter-text-model');

// Vosk elements
const voskStatus = document.getElementById('vosk-status');
const voskProgress = document.getElementById('vosk-progress');
const voskProgressFill = document.getElementById('vosk-progress-fill');
const voskProgressText = document.getElementById('vosk-progress-text');
const voskDownloadBtn = document.getElementById('vosk-download-btn');
const voskDownloadText = document.getElementById('vosk-download-text');
const voskDeleteBtn = document.getElementById('vosk-delete-btn');
const voskDevNotice = document.getElementById('vosk-dev-notice');
const voskModelRadios = document.querySelectorAll('input[name="vosk-model-size"]');

// Speaker model elements
const speakerStatus = document.getElementById('speaker-status');
const speakerProgress = document.getElementById('speaker-progress');
const speakerProgressFill = document.getElementById('speaker-progress-fill');
const speakerProgressText = document.getElementById('speaker-progress-text');
const speakerDownloadBtn = document.getElementById('speaker-download-btn');
const speakerDownloadText = document.getElementById('speaker-download-text');
const speakerDeleteBtn = document.getElementById('speaker-delete-btn');

// Voice settings
const voiceLanguageSelect = document.getElementById('voice-language');
const voiceAutostartCheckbox = document.getElementById('voice-autostart');

// Correction settings
const correctionEnabledCheckbox = document.getElementById('correction-enabled');
const correctionFrequencySelect = document.getElementById('correction-frequency');
const correctionAccentSelect = document.getElementById('correction-accent');

// Screenshot settings
const maxScreenshotsSlider = document.getElementById('max-screenshots');
const maxScreenshotsValue = document.getElementById('max-screenshots-value');
const captureDelaySlider = document.getElementById('capture-delay');
const captureDelayValue = document.getElementById('capture-delay-value');

// Initialize
async function init() {
  console.log('Initializing settings window...');
  
  setupEventListeners();
  setupIpcListeners();
  await loadAllSettings();
}

// Event Listeners
function setupEventListeners() {
  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettings);
  }
  
  // Save button
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAndClose);
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
  
  // Vosk model size selection
  voskModelRadios.forEach(radio => {
    radio.addEventListener('change', handleVoskModelSizeChange);
  });
  
  // Vosk buttons
  if (voskDownloadBtn) {
    voskDownloadBtn.addEventListener('click', downloadVoskModel);
  }
  if (voskDeleteBtn) {
    voskDeleteBtn.addEventListener('click', deleteVoskModel);
  }
  
  // Speaker model buttons
  if (speakerDownloadBtn) {
    speakerDownloadBtn.addEventListener('click', downloadSpeakerModel);
  }
  if (speakerDeleteBtn) {
    speakerDeleteBtn.addEventListener('click', deleteSpeakerModel);
  }
  
  // Range sliders
  if (maxScreenshotsSlider) {
    maxScreenshotsSlider.addEventListener('input', () => {
      if (maxScreenshotsValue) {
        maxScreenshotsValue.textContent = maxScreenshotsSlider.value;
      }
    });
  }
  if (captureDelaySlider) {
    captureDelaySlider.addEventListener('input', () => {
      if (captureDelayValue) {
        captureDelayValue.textContent = `${captureDelaySlider.value}ms`;
      }
    });
  }
  
  // Refresh models buttons
  document.querySelectorAll('.refresh-models-btn').forEach(btn => {
    btn.addEventListener('click', () => refreshModelsForProvider(btn.dataset.provider));
  });
}

// IPC Listeners
function setupIpcListeners() {
  if (!window.electronAPI) return;
  
  // Vosk download progress
  window.electronAPI.onVoskDownloadProgress((data) => {
    updateVoskProgress(data);
  });
  
  window.electronAPI.onVoskModelInstalled((data) => {
    if (data.modelSize) {
      voskModelStatus.installed[data.modelSize] = data.installed;
    }
    updateVoskUI();
  });
  
  // Speaker model progress
  window.electronAPI.onSpeakerModelProgress((data) => {
    updateSpeakerProgress(data);
  });
  
  window.electronAPI.onSpeakerModelInstalled((data) => {
    speakerModelInstalled = data.installed;
    updateSpeakerUI();
  });
}

// Load all settings
async function loadAllSettings() {
  if (!window.electronAPI) return;
  
  try {
    // Load API key status
    const apiStatus = await window.electronAPI.getApiKeyStatus();
    if (apiStatus.success) {
      updateApiKeyStatus(apiStatus.configured);
    }
    
    // Load AI settings
    const aiSettings = await window.electronAPI.getAISettings();
    if (aiSettings.success && aiSettings.settings) {
      loadAISettings(aiSettings.settings);
    }
    
    // Load voice settings
    const voiceSettings = await window.electronAPI.getVoiceSettings();
    if (voiceSettings.success && voiceSettings.settings) {
      loadVoiceSettings(voiceSettings.settings);
    }
    
    // Load screenshot settings
    const screenshotSettings = await window.electronAPI.getScreenshotSettings();
    if (screenshotSettings.success && screenshotSettings.settings) {
      loadScreenshotSettings(screenshotSettings.settings);
    }
    
    // Load correction settings
    const correctionSettings = await window.electronAPI.getCorrectionSettings?.();
    if (correctionSettings?.success && correctionSettings?.settings) {
      loadCorrectionSettings(correctionSettings.settings);
    }
    
    // Load Vosk model status
    await loadVoskModelStatus();
    
    // Load speaker model status
    await loadSpeakerModelStatus();
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Update API key status indicators
function updateApiKeyStatus(configured) {
  const providers = ['gemini', 'openai', 'anthropic', 'openrouter'];
  configuredProviders = configured ?? {};
  
  let hasAnyProvider = false;
  
  providers.forEach(provider => {
    const statusEl = document.getElementById(`${provider}-status`);
    const modelGroup = document.querySelector(`.provider-model-group[data-provider="${provider}"]`);
    const isConfigured = configured && configured[provider];
    
    if (statusEl) {
      if (isConfigured) {
        statusEl.textContent = 'Configured';
        statusEl.className = 'api-status configured';
      } else {
        statusEl.textContent = 'Not configured';
        statusEl.className = 'api-status';
      }
    }
    
    // Show/hide model group based on API key status
    if (modelGroup) {
      if (isConfigured) {
        modelGroup.classList.remove('hidden');
        hasAnyProvider = true;
      } else {
        modelGroup.classList.add('hidden');
      }
    }
  });
  
  // Show "no providers" message if none configured
  const noProvidersMsg = document.getElementById('no-providers-message');
  if (noProvidersMsg) {
    noProvidersMsg.classList.toggle('hidden', hasAnyProvider);
  }
}

// Load AI settings
function loadAISettings(settings) {
  if (defaultProviderSelect) {
    defaultProviderSelect.value = settings.defaultProvider ?? 'gemini';
  }
  
  if (settings.models) {
    // Gemini
    if (geminiModelSelect && settings.models.gemini) {
      geminiModelSelect.value = settings.models.gemini.model ?? 'gemini-2.5-flash-lite';
    }
    
    // OpenAI
    if (openaiVisionModelSelect && settings.models.openai) {
      openaiVisionModelSelect.value = settings.models.openai.visionModel ?? 'gpt-4o';
    }
    if (openaiTextModelSelect && settings.models.openai) {
      openaiTextModelSelect.value = settings.models.openai.textModel ?? 'gpt-4o-mini';
    }
    
    // Anthropic
    if (anthropicVisionModelSelect && settings.models.anthropic) {
      anthropicVisionModelSelect.value = settings.models.anthropic.visionModel ?? 'claude-sonnet-4-20250514';
    }
    if (anthropicTextModelSelect && settings.models.anthropic) {
      anthropicTextModelSelect.value = settings.models.anthropic.textModel ?? 'claude-3-haiku-20240307';
    }
    
    // OpenRouter
    if (openrouterVisionModelSelect && settings.models.openrouter) {
      openrouterVisionModelSelect.value = settings.models.openrouter.visionModel ?? 'anthropic/claude-3.5-sonnet';
    }
    if (openrouterTextModelSelect && settings.models.openrouter) {
      openrouterTextModelSelect.value = settings.models.openrouter.textModel ?? 'anthropic/claude-3-haiku';
    }
  }
}

// Load voice settings
function loadVoiceSettings(settings) {
  if (voiceLanguageSelect) {
    voiceLanguageSelect.value = settings.language ?? 'en-US';
  }
  if (voiceAutostartCheckbox) {
    voiceAutostartCheckbox.checked = settings.autoStart === true;
  }
  
  // Set current vosk model size
  currentVoskModelSize = settings.voskModelSize ?? 'large';
  
  // Update radio buttons
  voskModelRadios.forEach(radio => {
    radio.checked = radio.value === currentVoskModelSize;
  });
}

// Load screenshot settings
function loadScreenshotSettings(settings) {
  if (maxScreenshotsSlider) {
    maxScreenshotsSlider.value = settings.maxCount ?? 3;
    if (maxScreenshotsValue) {
      maxScreenshotsValue.textContent = maxScreenshotsSlider.value;
    }
  }
  if (captureDelaySlider) {
    captureDelaySlider.value = settings.captureDelay ?? 300;
    if (captureDelayValue) {
      captureDelayValue.textContent = `${captureDelaySlider.value}ms`;
    }
  }
}

// Load correction settings
function loadCorrectionSettings(settings) {
  if (correctionEnabledCheckbox) {
    correctionEnabledCheckbox.checked = settings.enabled !== false;
  }
  if (correctionFrequencySelect) {
    correctionFrequencySelect.value = settings.frequency ?? '30000';
  }
  if (correctionAccentSelect) {
    correctionAccentSelect.value = settings.accentHint ?? 'general';
  }
}

// Load Vosk model status
async function loadVoskModelStatus() {
  if (!window.electronAPI) return;
  
  try {
    const result = await window.electronAPI.getVoskModelStatus();
    
    if (result.success) {
      voskModelStatus.isDevelopment = result.isDevelopment === true;
      currentVoskModelSize = result.modelSize ?? 'large';
      
      // Process all models status
      if (result.allModels) {
        result.allModels.forEach(model => {
          voskModelStatus.installed[model.size] = model.installed;
          voskModelStatus.localAvailable[model.size] = model.localAvailable;
        });
      }
      
      updateVoskUI();
    }
  } catch (error) {
    console.error('Failed to load Vosk status:', error);
  }
}

// Update Vosk UI
function updateVoskUI() {
  // Update status indicators for each size
  ['small', 'medium', 'large'].forEach(size => {
    const statusEl = document.getElementById(`vosk-${size}-status`);
    if (statusEl) {
      const isInstalled = voskModelStatus.installed[size];
      const isLocalAvailable = voskModelStatus.localAvailable[size];
      
      statusEl.classList.remove('installed', 'available');
      
      if (isInstalled) {
        statusEl.textContent = '✓ Ready';
        statusEl.classList.add('installed');
      } else if (isLocalAvailable) {
        statusEl.textContent = '📦 Available';
        statusEl.classList.add('available');
      } else {
        statusEl.textContent = '↓ Download';
      }
    }
  });
  
  // Update main status
  const isSelectedInstalled = voskModelStatus.installed[currentVoskModelSize];
  const isSelectedLocalAvailable = voskModelStatus.localAvailable[currentVoskModelSize];
  
  if (voskStatus) {
    if (isSelectedInstalled) {
      voskStatus.textContent = '✓ Installed';
      voskStatus.className = 'api-status configured';
    } else if (isSelectedLocalAvailable) {
      voskStatus.textContent = '📦 Available locally';
      voskStatus.className = 'api-status';
    } else {
      voskStatus.textContent = 'Not installed';
      voskStatus.className = 'api-status';
    }
  }
  
  // Update buttons
  if (voskDownloadBtn && voskDeleteBtn) {
    if (isSelectedInstalled) {
      voskDownloadBtn.classList.add('hidden');
      voskDeleteBtn.classList.remove('hidden');
    } else {
      voskDownloadBtn.classList.remove('hidden');
      voskDeleteBtn.classList.add('hidden');
      
      const actionText = isSelectedLocalAvailable ? 'Extract' : 'Download';
      const sizeDesc = { small: '~50 MB', medium: '~500 MB', large: '~1.8 GB' };
      
      if (voskDownloadText) {
        voskDownloadText.textContent = `${actionText} ${currentVoskModelSize} (${sizeDesc[currentVoskModelSize]})`;
      }
    }
  }
  
  // Show dev notice
  if (voskDevNotice) {
    const hasLocalModels = Object.values(voskModelStatus.localAvailable).some(v => v);
    voskDevNotice.classList.toggle('hidden', !(voskModelStatus.isDevelopment && hasLocalModels));
  }
}

// Handle Vosk model size change
async function handleVoskModelSizeChange(event) {
  const newSize = event.target.value;
  if (newSize === currentVoskModelSize) return;
  
  currentVoskModelSize = newSize;
  
  // Save preference
  if (window.electronAPI) {
    await window.electronAPI.setVoskModelSize(newSize);
  }
  
  updateVoskUI();
}

// Update Vosk download progress
function updateVoskProgress(data) {
  const { status, progress, message } = data;
  
  if (status === 'downloading' || status === 'extracting') {
    if (voskProgress) voskProgress.classList.remove('hidden');
    if (voskProgressFill) voskProgressFill.style.width = `${progress}%`;
    if (voskProgressText) voskProgressText.textContent = message ?? `${progress}%`;
    
    if (voskDownloadBtn) {
      voskDownloadBtn.disabled = true;
      voskDownloadBtn.classList.add('downloading');
    }
  } else if (status === 'complete') {
    if (voskProgress) voskProgress.classList.add('hidden');
    if (voskDownloadBtn) {
      voskDownloadBtn.disabled = false;
      voskDownloadBtn.classList.remove('downloading');
    }
    
    voskModelStatus.installed[currentVoskModelSize] = true;
    updateVoskUI();
  } else if (status === 'error') {
    if (voskProgress) voskProgress.classList.add('hidden');
    if (voskDownloadBtn) {
      voskDownloadBtn.disabled = false;
      voskDownloadBtn.classList.remove('downloading');
    }
    alert(`Download failed: ${message}`);
  }
}

// Download Vosk model
async function downloadVoskModel() {
  if (!window.electronAPI) return;
  
  try {
    if (voskProgress) voskProgress.classList.remove('hidden');
    if (voskProgressFill) voskProgressFill.style.width = '0%';
    if (voskProgressText) voskProgressText.textContent = 'Starting...';
    
    if (voskDownloadBtn) {
      voskDownloadBtn.disabled = true;
      voskDownloadBtn.classList.add('downloading');
    }
    
    await window.electronAPI.downloadVoskModel(currentVoskModelSize);
  } catch (error) {
    console.error('Download failed:', error);
    alert(`Download failed: ${error.message}`);
    
    if (voskDownloadBtn) {
      voskDownloadBtn.disabled = false;
      voskDownloadBtn.classList.remove('downloading');
    }
  }
}

// Delete Vosk model
async function deleteVoskModel() {
  if (!window.electronAPI) return;
  
  if (!confirm(`Delete the ${currentVoskModelSize} Vosk model? You'll need to download it again to use voice recognition.`)) {
    return;
  }
  
  try {
    await window.electronAPI.deleteVoskModel(currentVoskModelSize);
    voskModelStatus.installed[currentVoskModelSize] = false;
    updateVoskUI();
  } catch (error) {
    console.error('Delete failed:', error);
    alert(`Delete failed: ${error.message}`);
  }
}

// Load speaker model status
async function loadSpeakerModelStatus() {
  if (!window.electronAPI || !window.electronAPI.getSpeakerModelStatus) {
    // API not available yet
    if (speakerStatus) {
      speakerStatus.textContent = 'Not installed';
      speakerStatus.className = 'api-status';
    }
    return;
  }
  
  try {
    const result = await window.electronAPI.getSpeakerModelStatus();
    
    if (result.success) {
      speakerModelInstalled = result.installed;
      updateSpeakerUI();
    }
  } catch (error) {
    console.error('Failed to load speaker model status:', error);
  }
}

// Update speaker model UI
function updateSpeakerUI() {
  if (speakerStatus) {
    if (speakerModelInstalled) {
      speakerStatus.textContent = '✓ Installed';
      speakerStatus.className = 'api-status configured';
    } else {
      speakerStatus.textContent = 'Not installed';
      speakerStatus.className = 'api-status';
    }
  }
  
  if (speakerDownloadBtn && speakerDeleteBtn) {
    if (speakerModelInstalled) {
      speakerDownloadBtn.classList.add('hidden');
      speakerDeleteBtn.classList.remove('hidden');
    } else {
      speakerDownloadBtn.classList.remove('hidden');
      speakerDeleteBtn.classList.add('hidden');
    }
  }
}

// Update speaker progress
function updateSpeakerProgress(data) {
  const { status, progress, message } = data;
  
  if (status === 'downloading' || status === 'extracting') {
    if (speakerProgress) speakerProgress.classList.remove('hidden');
    if (speakerProgressFill) speakerProgressFill.style.width = `${progress}%`;
    if (speakerProgressText) speakerProgressText.textContent = message ?? `${progress}%`;
    
    if (speakerDownloadBtn) {
      speakerDownloadBtn.disabled = true;
      speakerDownloadBtn.classList.add('downloading');
    }
  } else if (status === 'complete') {
    if (speakerProgress) speakerProgress.classList.add('hidden');
    if (speakerDownloadBtn) {
      speakerDownloadBtn.disabled = false;
      speakerDownloadBtn.classList.remove('downloading');
    }
    
    speakerModelInstalled = true;
    updateSpeakerUI();
  } else if (status === 'error') {
    if (speakerProgress) speakerProgress.classList.add('hidden');
    if (speakerDownloadBtn) {
      speakerDownloadBtn.disabled = false;
      speakerDownloadBtn.classList.remove('downloading');
    }
    alert(`Download failed: ${message}`);
  }
}

// Download speaker model
async function downloadSpeakerModel() {
  if (!window.electronAPI || !window.electronAPI.downloadSpeakerModel) {
    alert('Speaker model download not yet implemented');
    return;
  }
  
  try {
    if (speakerProgress) speakerProgress.classList.remove('hidden');
    if (speakerProgressFill) speakerProgressFill.style.width = '0%';
    if (speakerProgressText) speakerProgressText.textContent = 'Starting...';
    
    if (speakerDownloadBtn) {
      speakerDownloadBtn.disabled = true;
      speakerDownloadBtn.classList.add('downloading');
    }
    
    await window.electronAPI.downloadSpeakerModel();
  } catch (error) {
    console.error('Download failed:', error);
    alert(`Download failed: ${error.message}`);
    
    if (speakerDownloadBtn) {
      speakerDownloadBtn.disabled = false;
      speakerDownloadBtn.classList.remove('downloading');
    }
  }
}

// Delete speaker model
async function deleteSpeakerModel() {
  if (!window.electronAPI || !window.electronAPI.deleteSpeakerModel) {
    alert('Speaker model deletion not yet implemented');
    return;
  }
  
  if (!confirm('Delete the speaker detection model?')) {
    return;
  }
  
  try {
    await window.electronAPI.deleteSpeakerModel();
    speakerModelInstalled = false;
    updateSpeakerUI();
  } catch (error) {
    console.error('Delete failed:', error);
    alert(`Delete failed: ${error.message}`);
  }
}

// Save API key
async function saveApiKey(provider) {
  if (!window.electronAPI) return;
  
  const input = apiKeyInputs[provider];
  if (!input) return;
  
  const apiKey = input.value.trim();
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  try {
    const result = await window.electronAPI.setApiKey(provider, apiKey);
    
    if (result.success) {
      input.value = '';
      
      const statusEl = document.getElementById(`${provider}-status`);
      if (statusEl) {
        statusEl.textContent = 'Configured';
        statusEl.className = 'api-status configured';
      }
      
      // Update configured providers and show model group
      configuredProviders[provider] = true;
      const modelGroup = document.querySelector(`.provider-model-group[data-provider="${provider}"]`);
      if (modelGroup) {
        modelGroup.classList.remove('hidden');
      }
      
      // Hide "no providers" message
      const noProvidersMsg = document.getElementById('no-providers-message');
      if (noProvidersMsg) {
        noProvidersMsg.classList.add('hidden');
      }
      
      alert(`${provider} API key saved!`);
    } else {
      alert(`Failed to save: ${result.error}`);
    }
  } catch (error) {
    console.error('Save failed:', error);
    alert(`Failed to save: ${error.message}`);
  }
}

// Clear API key
async function clearApiKey(provider) {
  if (!window.electronAPI) return;
  
  if (!confirm(`Remove the ${provider} API key?`)) {
    return;
  }
  
  try {
    const result = await window.electronAPI.clearApiKey(provider);
    
    if (result.success) {
      const statusEl = document.getElementById(`${provider}-status`);
      if (statusEl) {
        statusEl.textContent = 'Not configured';
        statusEl.className = 'api-status';
      }
      
      const input = apiKeyInputs[provider];
      if (input) input.value = '';
      
      // Update configured providers and hide model group
      configuredProviders[provider] = false;
      const modelGroup = document.querySelector(`.provider-model-group[data-provider="${provider}"]`);
      if (modelGroup) {
        modelGroup.classList.add('hidden');
      }
      
      // Check if any providers remain
      const hasAnyProvider = Object.values(configuredProviders).some(v => v);
      const noProvidersMsg = document.getElementById('no-providers-message');
      if (noProvidersMsg) {
        noProvidersMsg.classList.toggle('hidden', hasAnyProvider);
      }
    }
  } catch (error) {
    console.error('Clear failed:', error);
    alert(`Failed to clear: ${error.message}`);
  }
}

// ============================================================================
// MODEL FETCHING
// ============================================================================

// Known models with vision capabilities (fallback lists)
const VISION_MODELS = {
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-pro-vision'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision-preview'],
  anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022', 'claude-sonnet-4-20250514', 'claude-3-haiku-20240307'],
  openrouter: [] // OpenRouter provides this info in the API response
};

// Refresh models for a specific provider
async function refreshModelsForProvider(provider) {
  if (!window.electronAPI || !window.electronAPI.fetchAvailableModels) {
    console.warn('Model fetching not available');
    return;
  }
  
  const btn = document.querySelector(`.refresh-models-btn[data-provider="${provider}"]`);
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }
  
  try {
    console.log(`Fetching models for ${provider}...`);
    const result = await window.electronAPI.fetchAvailableModels(provider);
    
    if (result.success && result.models) {
      populateModelSelects(provider, result.models);
      console.log(`Loaded ${result.models.length} models for ${provider}`);
    } else {
      console.warn(`Failed to fetch models for ${provider}:`, result.error);
      // Keep default options on failure
    }
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }
}

// Populate model select dropdowns
function populateModelSelects(provider, models) {
  if (provider === 'gemini') {
    // Gemini has single model select (all models support vision)
    const select = geminiModelSelect;
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '';
      
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name ?? model.id;
        select.appendChild(option);
      });
      
      // Restore previous selection if still available
      if (models.some(m => m.id === currentValue)) {
        select.value = currentValue;
      }
    }
  } else {
    // Other providers have vision and text model selects
    const visionSelect = document.getElementById(`${provider}-vision-model`);
    const textSelect = document.getElementById(`${provider}-text-model`);
    
    // Filter models by vision capability
    const visionModels = models.filter(m => isVisionModel(provider, m));
    const allModels = models;
    
    if (visionSelect) {
      const currentVision = visionSelect.value;
      visionSelect.innerHTML = '';
      
      visionModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name ?? model.id;
        visionSelect.appendChild(option);
      });
      
      if (visionModels.some(m => m.id === currentVision)) {
        visionSelect.value = currentVision;
      }
    }
    
    if (textSelect) {
      const currentText = textSelect.value;
      textSelect.innerHTML = '';
      
      allModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name ?? model.id;
        textSelect.appendChild(option);
      });
      
      if (allModels.some(m => m.id === currentText)) {
        textSelect.value = currentText;
      }
    }
  }
}

// Check if a model has vision capabilities
function isVisionModel(provider, model) {
  // If the model object has explicit vision capability info
  if (model.capabilities !== undefined) {
    return model.capabilities.vision === true;
  }
  if (model.supportsVision !== undefined) {
    return model.supportsVision === true;
  }
  if (model.vision !== undefined) {
    return model.vision === true;
  }
  
  // For OpenRouter, check the architecture field or modality
  if (provider === 'openrouter') {
    if (model.architecture?.modality === 'text+image->text') return true;
    if (model.modality?.includes('image')) return true;
  }
  
  // Fallback to known vision models list
  const knownVisionModels = VISION_MODELS[provider] ?? [];
  return knownVisionModels.some(v => model.id?.includes(v) || v.includes(model.id));
}

// Save all settings and close
async function saveAndClose() {
  if (!window.electronAPI) return;
  
  try {
    // Collect model settings
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
    
    // Save AI settings
    await window.electronAPI.setAISettings({
      defaultProvider: defaultProviderSelect?.value ?? 'gemini',
      models: modelSettings
    });
    
    // Save voice settings
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
    
    // Save correction settings
    if (window.electronAPI.setCorrectionSettings) {
      await window.electronAPI.setCorrectionSettings({
        enabled: correctionEnabledCheckbox?.checked !== false,
        frequency: correctionFrequencySelect?.value ?? '30000',
        accentHint: correctionAccentSelect?.value ?? 'general'
      });
    }
    
    // Mark setup as complete
    await window.electronAPI.completeSetup();
    
    // Close the window
    closeSettings();
    
  } catch (error) {
    console.error('Save failed:', error);
    alert('Failed to save settings');
  }
}

// Close settings window
function closeSettings() {
  if (window.electronAPI && window.electronAPI.closeSettings) {
    window.electronAPI.closeSettings();
  } else {
    window.close();
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
