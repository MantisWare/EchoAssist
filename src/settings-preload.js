// Settings Window Preload Script
// Exposes IPC methods for settings-specific functionality

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  setApiKey: (provider, apiKey) => ipcRenderer.invoke('set-api-key', { provider, apiKey }),
  clearApiKey: (provider) => ipcRenderer.invoke('clear-api-key', provider),
  
  // AI Settings
  getAISettings: () => ipcRenderer.invoke('get-ai-settings'),
  setAISettings: (settings) => ipcRenderer.invoke('set-ai-settings', settings),
  fetchAvailableModels: (provider) => ipcRenderer.invoke('fetch-available-models', provider),
  
  // Voice Settings
  getVoiceSettings: () => ipcRenderer.invoke('get-voice-settings'),
  setVoiceSettings: (settings) => ipcRenderer.invoke('set-voice-settings', settings),
  
  // Screenshot Settings
  getScreenshotSettings: () => ipcRenderer.invoke('get-screenshot-settings'),
  setScreenshotSettings: (settings) => ipcRenderer.invoke('set-screenshot-settings', settings),
  
  // Correction Settings
  getCorrectionSettings: () => ipcRenderer.invoke('get-correction-settings'),
  setCorrectionSettings: (settings) => ipcRenderer.invoke('set-correction-settings', settings),
  
  // Setup Status
  hasCompletedSetup: () => ipcRenderer.invoke('has-completed-setup'),
  completeSetup: () => ipcRenderer.invoke('complete-setup'),
  
  // Vosk Model Management
  getVoskModelStatus: () => ipcRenderer.invoke('get-vosk-model-status'),
  downloadVoskModel: (modelSize) => ipcRenderer.invoke('download-vosk-model', modelSize),
  deleteVoskModel: (modelSize) => ipcRenderer.invoke('delete-vosk-model', modelSize),
  setVoskModelSize: (modelSize) => ipcRenderer.invoke('set-vosk-model-size', modelSize),
  
  // Speaker Model Management
  getSpeakerModelStatus: () => ipcRenderer.invoke('get-speaker-model-status'),
  downloadSpeakerModel: () => ipcRenderer.invoke('download-speaker-model'),
  deleteSpeakerModel: () => ipcRenderer.invoke('delete-speaker-model'),
  
  // Event listeners for progress updates
  onVoskDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('vosk-download-progress', listener);
    return () => ipcRenderer.removeListener('vosk-download-progress', listener);
  },
  
  onVoskModelInstalled: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('vosk-model-installed', listener);
    return () => ipcRenderer.removeListener('vosk-model-installed', listener);
  },
  
  onSpeakerModelProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('speaker-model-progress', listener);
    return () => ipcRenderer.removeListener('speaker-model-progress', listener);
  },
  
  onSpeakerModelInstalled: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('speaker-model-installed', listener);
    return () => ipcRenderer.removeListener('speaker-model-installed', listener);
  },
  
  onSettingsChanged: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('settings-changed', listener);
    return () => ipcRenderer.removeListener('settings-changed', listener);
  },
  
  // Window control
  closeSettings: () => ipcRenderer.invoke('close-settings-window')
});
