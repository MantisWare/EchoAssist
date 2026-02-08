const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

// Expose stealth API to renderer process with enhanced error handling
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Core stealth actions
    toggleStealth: () => {
      console.log('PreloadAPI: toggleStealth called');
      return ipcRenderer.invoke('toggle-stealth').catch(err => {
        console.error('PreloadAPI: toggleStealth error:', err);
        return { error: err.message };
      });
    },
    
    emergencyHide: () => {
      console.log('PreloadAPI: emergencyHide called');
      return ipcRenderer.invoke('emergency-hide').catch(err => {
        console.error('PreloadAPI: emergencyHide error:', err);
        return { error: err.message };
      });
    },
    
    takeStealthScreenshot: () => {
      console.log('PreloadAPI: takeStealthScreenshot called');
      return ipcRenderer.invoke('take-stealth-screenshot').catch(err => {
        console.error('PreloadAPI: takeStealthScreenshot error:', err);
        return { error: err.message };
      });
    },
    
    analyzeStealth: () => {
      console.log('PreloadAPI: analyzeStealth called');
      return ipcRenderer.invoke('analyze-stealth').catch(err => {
        console.error('PreloadAPI: analyzeStealth error:', err);
        return { error: err.message };
      });
    },
    
    analyzeStealthWithContext: (context) => {
      console.log('PreloadAPI: analyzeStealthWithContext called with context length:', context?.length || 0);
      return ipcRenderer.invoke('analyze-stealth-with-context', context).catch(err => {
        console.error('PreloadAPI: analyzeStealthWithContext error:', err);
        return { error: err.message };
      });
    },
    
    clearStealth: () => {
      console.log('PreloadAPI: clearStealth called');
      return ipcRenderer.invoke('clear-stealth').catch(err => {
        console.error('PreloadAPI: clearStealth error:', err);
        return { error: err.message };
      });
    },
    
    getScreenshotsCount: () => {
      console.log('PreloadAPI: getScreenshotsCount called');
      return ipcRenderer.invoke('get-screenshots-count').catch(err => {
        console.error('PreloadAPI: getScreenshotsCount error:', err);
        return 0;
      });
    },
    
    // Vosk Model Management
    getVoskModelStatus: () => {
      console.log('PreloadAPI: getVoskModelStatus called');
      return ipcRenderer.invoke('get-vosk-model-status').catch(err => {
        console.error('PreloadAPI: getVoskModelStatus error:', err);
        return { success: false, installed: false, error: err.message };
      });
    },

    downloadVoskModel: (modelSize = null) => {
      console.log('PreloadAPI: downloadVoskModel called with size:', modelSize);
      return ipcRenderer.invoke('download-vosk-model', modelSize).catch(err => {
        console.error('PreloadAPI: downloadVoskModel error:', err);
        return { success: false, error: err.message };
      });
    },

    deleteVoskModel: (modelSize = null) => {
      console.log('PreloadAPI: deleteVoskModel called with size:', modelSize);
      return ipcRenderer.invoke('delete-vosk-model', modelSize).catch(err => {
        console.error('PreloadAPI: deleteVoskModel error:', err);
        return { success: false, error: err.message };
      });
    },

    setVoskModelSize: (modelSize) => {
      console.log('PreloadAPI: setVoskModelSize called with:', modelSize);
      return ipcRenderer.invoke('set-vosk-model-size', modelSize).catch(err => {
        console.error('PreloadAPI: setVoskModelSize error:', err);
        return { success: false, error: err.message };
      });
    },

    // Vosk Prewarm functionality
    getVoskPrewarmStatus: () => {
      console.log('PreloadAPI: getVoskPrewarmStatus called');
      return ipcRenderer.invoke('get-vosk-prewarm-status').catch(err => {
        console.error('PreloadAPI: getVoskPrewarmStatus error:', err);
        return { success: false, status: 'error', error: err.message };
      });
    },

    prewarmVoskModel: () => {
      console.log('PreloadAPI: prewarmVoskModel called');
      return ipcRenderer.invoke('prewarm-vosk-model').catch(err => {
        console.error('PreloadAPI: prewarmVoskModel error:', err);
        return { success: false, error: err.message };
      });
    },

    onVoskPrewarmStatus: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskPrewarmStatus event received, status:', data.status);
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskPrewarmStatus callback error:', err);
        }
      };
      ipcRenderer.on('vosk-prewarm-status', handler);
      return () => {
        ipcRenderer.removeListener('vosk-prewarm-status', handler);
      };
    },

    onVoskDownloadProgress: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskDownloadProgress event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskDownloadProgress callback error:', err);
        }
      };
      ipcRenderer.on('vosk-download-progress', handler);
      return () => {
        ipcRenderer.removeListener('vosk-download-progress', handler);
      };
    },

    onVoskModelInstalled: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskModelInstalled event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskModelInstalled callback error:', err);
        }
      };
      ipcRenderer.on('vosk-model-installed', handler);
      return () => {
        ipcRenderer.removeListener('vosk-model-installed', handler);
      };
    },

    // Voice functionality
    startVoiceRecognition: () => {
      console.log('PreloadAPI: startVoiceRecognition called');
      return ipcRenderer.invoke('start-voice-recognition').catch(err => {
        console.error('PreloadAPI: startVoiceRecognition error:', err);
        return { error: err.message };
      });
    },
    stopVoiceRecognition: () => {
      console.log('PreloadAPI: stopVoiceRecognition called');
      return ipcRenderer.invoke('stop-voice-recognition').catch(err => {
        console.error('PreloadAPI: stopVoiceRecognition error:', err);
        return { error: err.message };
      });
    },

    convertAudio: (audioData) => {
      console.log('PreloadAPI: convertAudio called');
      return ipcRenderer.invoke('convert-audio', audioData).catch(err => {
        console.error('PreloadAPI: convertAudio error:', err);
        return null;
      });
    },

    // EchoAssist features

    // Transcribe audio using Gemini
    transcribeAudio: (base64Audio, mimeType) => {
      console.log('PreloadAPI: transcribeAudio called');
      return ipcRenderer.invoke('transcribe-audio', base64Audio, mimeType).catch(err => {
        console.error('PreloadAPI: transcribeAudio error:', err);
        return { success: false, error: err.message };
      });
    },

    addVoiceTranscript: (transcript) => {
      console.log('PreloadAPI: addVoiceTranscript called');
      return ipcRenderer.invoke('add-voice-transcript', transcript).catch(err => {
        console.error('PreloadAPI: addVoiceTranscript error:', err);
        return { error: err.message };
      });
    },

    suggestResponse: (context) => {
      console.log('PreloadAPI: suggestResponse called');
      return ipcRenderer.invoke('suggest-response', context).catch(err => {
        console.error('PreloadAPI: suggestResponse error:', err);
        return { error: err.message };
      });
    },

    generateMeetingNotes: () => {
      console.log('PreloadAPI: generateMeetingNotes called');
      return ipcRenderer.invoke('generate-meeting-notes').catch(err => {
        console.error('PreloadAPI: generateMeetingNotes error:', err);
        return { error: err.message };
      });
    },

    generateFollowUpEmail: () => {
      console.log('PreloadAPI: generateFollowUpEmail called');
      return ipcRenderer.invoke('generate-follow-up-email').catch(err => {
        console.error('PreloadAPI: generateFollowUpEmail error:', err);
        return { error: err.message };
      });
    },

    answerQuestion: (question) => {
      console.log('PreloadAPI: answerQuestion called');
      return ipcRenderer.invoke('answer-question', question).catch(err => {
        console.error('PreloadAPI: answerQuestion error:', err);
        return { error: err.message };
      });
    },

    getConversationInsights: () => {
      console.log('PreloadAPI: getConversationInsights called');
      return ipcRenderer.invoke('get-conversation-insights').catch(err => {
        console.error('PreloadAPI: getConversationInsights error:', err);
        return { error: err.message };
      });
    },

    clearConversationHistory: () => {
      console.log('PreloadAPI: clearConversationHistory called');
      return ipcRenderer.invoke('clear-conversation-history').catch(err => {
        console.error('PreloadAPI: clearConversationHistory error:', err);
        return { error: err.message };
      });
    },

    getConversationHistory: () => {
      console.log('PreloadAPI: getConversationHistory called');
      return ipcRenderer.invoke('get-conversation-history').catch(err => {
        console.error('PreloadAPI: getConversationHistory error:', err);
        return { error: err.message };
      });
    },

    // ========================================================================
    // Region/Window Capture Selection (Phase 5)
    // ========================================================================

    selectCaptureRegion: () => {
      console.log('PreloadAPI: selectCaptureRegion called');
      return ipcRenderer.invoke('select-capture-region').catch(err => {
        console.error('PreloadAPI: selectCaptureRegion error:', err);
        return { success: false, error: err.message };
      });
    },

    getOpenWindows: () => {
      console.log('PreloadAPI: getOpenWindows called');
      return ipcRenderer.invoke('get-open-windows').catch(err => {
        console.error('PreloadAPI: getOpenWindows error:', err);
        return { success: false, windows: [], error: err.message };
      });
    },

    selectCaptureWindow: (windowInfo) => {
      console.log('PreloadAPI: selectCaptureWindow called');
      return ipcRenderer.invoke('select-capture-window', windowInfo).catch(err => {
        console.error('PreloadAPI: selectCaptureWindow error:', err);
        return { success: false, error: err.message };
      });
    },

    resetCaptureMode: () => {
      console.log('PreloadAPI: resetCaptureMode called');
      return ipcRenderer.invoke('reset-capture-mode').catch(err => {
        console.error('PreloadAPI: resetCaptureMode error:', err);
        return { success: false, error: err.message };
      });
    },

    getCaptureConfig: () => {
      console.log('PreloadAPI: getCaptureConfig called');
      return ipcRenderer.invoke('get-capture-config').catch(err => {
        console.error('PreloadAPI: getCaptureConfig error:', err);
        return { success: false, error: err.message };
      });
    },

    onCaptureConfigChanged: (callback) => {
      const handler = (event, config) => {
        console.log('PreloadAPI: onCaptureConfigChanged event received');
        try {
          callback(config);
        } catch (err) {
          console.error('PreloadAPI: onCaptureConfigChanged callback error:', err);
        }
      };
      ipcRenderer.on('capture-config-changed', handler);
      return () => {
        ipcRenderer.removeListener('capture-config-changed', handler);
      };
    },

    onCaptureWindowNotFound: (callback) => {
      const handler = (event, title) => {
        console.log('PreloadAPI: onCaptureWindowNotFound event received');
        try {
          callback(title);
        } catch (err) {
          console.error('PreloadAPI: onCaptureWindowNotFound callback error:', err);
        }
      };
      ipcRenderer.on('capture-window-not-found', handler);
      return () => {
        ipcRenderer.removeListener('capture-window-not-found', handler);
      };
    },

    // ========================================================================
    // AI Provider Management
    // ========================================================================

    getAvailableProviders: () => {
      console.log('PreloadAPI: getAvailableProviders called');
      return ipcRenderer.invoke('get-available-providers').catch(err => {
        console.error('PreloadAPI: getAvailableProviders error:', err);
        return { success: false, providers: [], error: err.message };
      });
    },

    getActiveProvider: () => {
      console.log('PreloadAPI: getActiveProvider called');
      return ipcRenderer.invoke('get-active-provider').catch(err => {
        console.error('PreloadAPI: getActiveProvider error:', err);
        return { success: false, provider: null, error: err.message };
      });
    },

    setActiveProvider: (provider) => {
      console.log('PreloadAPI: setActiveProvider called with:', provider);
      return ipcRenderer.invoke('set-active-provider', provider).catch(err => {
        console.error('PreloadAPI: setActiveProvider error:', err);
        return { success: false, error: err.message };
      });
    },

    // Provider change event listener
    onProviderChanged: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onProviderChanged event received, provider:', data.provider);
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onProviderChanged callback error:', err);
        }
      };
      ipcRenderer.on('provider-changed', handler);
      return () => {
        console.log('PreloadAPI: removing onProviderChanged listener');
        ipcRenderer.removeListener('provider-changed', handler);
      };
    },

    // ========================================================================
    // Settings Management
    // ========================================================================

    getAllSettings: () => {
      console.log('PreloadAPI: getAllSettings called');
      return ipcRenderer.invoke('get-all-settings').catch(err => {
        console.error('PreloadAPI: getAllSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    getApiKeyStatus: () => {
      console.log('PreloadAPI: getApiKeyStatus called');
      return ipcRenderer.invoke('get-api-key-status').catch(err => {
        console.error('PreloadAPI: getApiKeyStatus error:', err);
        return { success: false, error: err.message };
      });
    },

    setApiKey: (provider, apiKey) => {
      console.log('PreloadAPI: setApiKey called for:', provider);
      return ipcRenderer.invoke('set-api-key', { provider, apiKey }).catch(err => {
        console.error('PreloadAPI: setApiKey error:', err);
        return { success: false, error: err.message };
      });
    },

    clearApiKey: (provider) => {
      console.log('PreloadAPI: clearApiKey called for:', provider);
      return ipcRenderer.invoke('clear-api-key', provider).catch(err => {
        console.error('PreloadAPI: clearApiKey error:', err);
        return { success: false, error: err.message };
      });
    },

    getAISettings: () => {
      console.log('PreloadAPI: getAISettings called');
      return ipcRenderer.invoke('get-ai-settings').catch(err => {
        console.error('PreloadAPI: getAISettings error:', err);
        return { success: false, error: err.message };
      });
    },

    setAISettings: (settings) => {
      console.log('PreloadAPI: setAISettings called');
      return ipcRenderer.invoke('set-ai-settings', settings).catch(err => {
        console.error('PreloadAPI: setAISettings error:', err);
        return { success: false, error: err.message };
      });
    },

    getUISettings: () => {
      console.log('PreloadAPI: getUISettings called');
      return ipcRenderer.invoke('get-ui-settings').catch(err => {
        console.error('PreloadAPI: getUISettings error:', err);
        return { success: false, error: err.message };
      });
    },

    setUISettings: (settings) => {
      console.log('PreloadAPI: setUISettings called');
      return ipcRenderer.invoke('set-ui-settings', settings).catch(err => {
        console.error('PreloadAPI: setUISettings error:', err);
        return { success: false, error: err.message };
      });
    },

    getVoiceSettings: () => {
      console.log('PreloadAPI: getVoiceSettings called');
      return ipcRenderer.invoke('get-voice-settings').catch(err => {
        console.error('PreloadAPI: getVoiceSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    setVoiceSettings: (settings) => {
      console.log('PreloadAPI: setVoiceSettings called');
      return ipcRenderer.invoke('set-voice-settings', settings).catch(err => {
        console.error('PreloadAPI: setVoiceSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    getScreenshotSettings: () => {
      console.log('PreloadAPI: getScreenshotSettings called');
      return ipcRenderer.invoke('get-screenshot-settings').catch(err => {
        console.error('PreloadAPI: getScreenshotSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    setScreenshotSettings: (settings) => {
      console.log('PreloadAPI: setScreenshotSettings called');
      return ipcRenderer.invoke('set-screenshot-settings', settings).catch(err => {
        console.error('PreloadAPI: setScreenshotSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    getCorrectionSettings: () => {
      console.log('PreloadAPI: getCorrectionSettings called');
      return ipcRenderer.invoke('get-correction-settings').catch(err => {
        console.error('PreloadAPI: getCorrectionSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    setCorrectionSettings: (settings) => {
      console.log('PreloadAPI: setCorrectionSettings called');
      return ipcRenderer.invoke('set-correction-settings', settings).catch(err => {
        console.error('PreloadAPI: setCorrectionSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    onCorrectionSettingsChanged: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onCorrectionSettingsChanged event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onCorrectionSettingsChanged callback error:', err);
        }
      };
      ipcRenderer.on('correction-settings-changed', handler);
      return () => {
        ipcRenderer.removeListener('correction-settings-changed', handler);
      };
    },

    completeSetup: () => {
      console.log('PreloadAPI: completeSetup called');
      return ipcRenderer.invoke('complete-setup').catch(err => {
        console.error('PreloadAPI: completeSetup error:', err);
        return { success: false, error: err.message };
      });
    },

    resetSettings: () => {
      console.log('PreloadAPI: resetSettings called');
      return ipcRenderer.invoke('reset-settings').catch(err => {
        console.error('PreloadAPI: resetSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    hasCompletedSetup: () => {
      console.log('PreloadAPI: hasCompletedSetup called');
      return ipcRenderer.invoke('has-completed-setup').catch(err => {
        console.error('PreloadAPI: hasCompletedSetup error:', err);
        return { success: false, completed: false, error: err.message };
      });
    },

    // Settings change event listeners
    onSettingsChanged: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onSettingsChanged event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onSettingsChanged callback error:', err);
        }
      };
      ipcRenderer.on('settings-changed', handler);
      return () => {
        ipcRenderer.removeListener('settings-changed', handler);
      };
    },

    onProvidersUpdated: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onProvidersUpdated event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onProvidersUpdated callback error:', err);
        }
      };
      ipcRenderer.on('providers-updated', handler);
      return () => {
        ipcRenderer.removeListener('providers-updated', handler);
      };
    },
    
    // Event listeners with cleanup functions and error handling
    onScreenshotTakenStealth: (callback) => {
      const handler = (event, count) => {
        console.log('PreloadAPI: onScreenshotTakenStealth event received, count:', count);
        try {
          callback(count);
        } catch (err) {
          console.error('PreloadAPI: onScreenshotTakenStealth callback error:', err);
        }
      };
      ipcRenderer.on('screenshot-taken-stealth', handler);
      return () => {
        console.log('PreloadAPI: removing onScreenshotTakenStealth listener');
        ipcRenderer.removeListener('screenshot-taken-stealth', handler);
      };
    },
    
    onAnalysisStart: (callback) => {
      const handler = () => {
        console.log('PreloadAPI: onAnalysisStart event received');
        try {
          callback();
        } catch (err) {
          console.error('PreloadAPI: onAnalysisStart callback error:', err);
        }
      };
      ipcRenderer.on('analysis-start', handler);
      return () => {
        console.log('PreloadAPI: removing onAnalysisStart listener');
        ipcRenderer.removeListener('analysis-start', handler);
      };
    },
    
    onAnalysisResult: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onAnalysisResult event received, data type:', typeof data);
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onAnalysisResult callback error:', err);
        }
      };
      ipcRenderer.on('analysis-result', handler);
      return () => {
        console.log('PreloadAPI: removing onAnalysisResult listener');
        ipcRenderer.removeListener('analysis-result', handler);
      };
    },
    
    onSetStealthMode: (callback) => {
      const handler = (event, enabled) => {
        console.log('PreloadAPI: onSetStealthMode event received, enabled:', enabled);
        try {
          callback(enabled);
        } catch (err) {
          console.error('PreloadAPI: onSetStealthMode callback error:', err);
        }
      };
      ipcRenderer.on('set-stealth-mode', handler);
      return () => {
        console.log('PreloadAPI: removing onSetStealthMode listener');
        ipcRenderer.removeListener('set-stealth-mode', handler);
      };
    },
    
    onEmergencyClear: (callback) => {
      const handler = () => {
        console.log('PreloadAPI: onEmergencyClear event received');
        try {
          callback();
        } catch (err) {
          console.error('PreloadAPI: onEmergencyClear callback error:', err);
        }
      };
      ipcRenderer.on('emergency-clear', handler);
      return () => {
        console.log('PreloadAPI: removing onEmergencyClear listener');
        ipcRenderer.removeListener('emergency-clear', handler);
      };
    },
    
    onError: (callback) => {
      const handler = (event, message) => {
        console.log('PreloadAPI: onError event received, message:', message);
        try {
          callback(message);
        } catch (err) {
          console.error('PreloadAPI: onError callback error:', err);
        }
      };
      ipcRenderer.on('error', handler);
      return () => {
        console.log('PreloadAPI: removing onError listener');
        ipcRenderer.removeListener('error', handler);
      };
    },
    
    // Voice recognition events
    onVoiceTranscript: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoiceTranscript event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoiceTranscript callback error:', err);
        }
      };
      ipcRenderer.on('voice-transcript', handler);
      return () => {
        console.log('PreloadAPI: removing onVoiceTranscript listener');
        ipcRenderer.removeListener('voice-transcript', handler);
      };
    },

    onVoiceError: (callback) => {
      const handler = (event, error) => {
        console.log('PreloadAPI: onVoiceError event received, error:', error);
        try {
          callback(error);
        } catch (err) {
          console.error('PreloadAPI: onVoiceError callback error:', err);
        }
      };
      ipcRenderer.on('voice-error', handler);
      return () => {
        console.log('PreloadAPI: removing onVoiceError listener');
        ipcRenderer.removeListener('voice-error', handler);
      };
    },

    // Vosk live transcription events
    onVoskStatus: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskStatus event received, status:', data.status);
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskStatus callback error:', err);
        }
      };
      ipcRenderer.on('vosk-status', handler);
      return () => {
        console.log('PreloadAPI: removing onVoskStatus listener');
        ipcRenderer.removeListener('vosk-status', handler);
      };
    },

    onVoskPartial: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskPartial event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskPartial callback error:', err);
        }
      };
      ipcRenderer.on('vosk-partial', handler);
      return () => {
        console.log('PreloadAPI: removing onVoskPartial listener');
        ipcRenderer.removeListener('vosk-partial', handler);
      };
    },

    onVoskFinal: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskFinal event received');
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskFinal callback error:', err);
        }
      };
      ipcRenderer.on('vosk-final', handler);
      return () => {
        console.log('PreloadAPI: removing onVoskFinal listener');
        ipcRenderer.removeListener('vosk-final', handler);
      };
    },

    onVoskError: (callback) => {
      const handler = (event, data) => {
        console.log('PreloadAPI: onVoskError event received, error:', data.error);
        try {
          callback(data);
        } catch (err) {
          console.error('PreloadAPI: onVoskError callback error:', err);
        }
      };
      ipcRenderer.on('vosk-error', handler);
      return () => {
        console.log('PreloadAPI: removing onVoskError listener');
        ipcRenderer.removeListener('vosk-error', handler);
      };
    },

    onVoskStopped: (callback) => {
      const handler = () => {
        console.log('PreloadAPI: onVoskStopped event received');
        try {
          callback();
        } catch (err) {
          console.error('PreloadAPI: onVoskStopped callback error:', err);
        }
      };
      ipcRenderer.on('vosk-stopped', handler);
      return () => {
        console.log('PreloadAPI: removing onVoskStopped listener');
        ipcRenderer.removeListener('vosk-stopped', handler);
      };
    },
    
    // Close application
    closeApp: () => {
      console.log('PreloadAPI: closeApp called');
      return ipcRenderer.invoke('close-app').catch(err => {
        console.error('PreloadAPI: closeApp error:', err);
        return { error: err.message };
      });
    },

    // Open settings window
    openSettings: () => {
      console.log('PreloadAPI: openSettings called');
      return ipcRenderer.invoke('open-settings').catch(err => {
        console.error('PreloadAPI: openSettings error:', err);
        return { success: false, error: err.message };
      });
    },

    // AI analysis (for summarization)
    analyzeWithAI: (prompt, imageData) => {
      console.log('PreloadAPI: analyzeWithAI called');
      return ipcRenderer.invoke('analyze-with-ai', prompt, imageData).catch(err => {
        console.error('PreloadAPI: analyzeWithAI error:', err);
        return { error: err.message };
      });
    },

    // ========================================================================
    // Window Appearance
    // ========================================================================

    setWindowOpacity: (opacity) => {
      console.log('PreloadAPI: setWindowOpacity called with:', opacity);
      return ipcRenderer.invoke('set-window-opacity', opacity).catch(err => {
        console.error('PreloadAPI: setWindowOpacity error:', err);
        return { success: false, error: err.message };
      });
    },

    getWindowOpacity: () => {
      console.log('PreloadAPI: getWindowOpacity called');
      return ipcRenderer.invoke('get-window-opacity').catch(err => {
        console.error('PreloadAPI: getWindowOpacity error:', err);
        return { success: false, error: err.message };
      });
    },

    // Utility functions for debugging
    log: (message) => {
      console.log('PreloadAPI log:', message);
    },

    // Check if electronAPI is working
    isAvailable: () => {
      console.log('PreloadAPI: isAvailable check');
      return true;
    },

    // Get development mode status
    getDevModeStatus: () => {
      console.log('PreloadAPI: getDevModeStatus called');
      return ipcRenderer.invoke('get-dev-mode-status').catch(err => {
        console.error('PreloadAPI: getDevModeStatus error:', err);
        return { success: false, isDevelopment: false, error: err.message };
      });
    },

    // Phase 6: Show region menu (native context menu)
    showRegionMenu: () => {
      console.log('PreloadAPI: showRegionMenu called');
      return ipcRenderer.invoke('show-region-menu').catch(err => {
        console.error('PreloadAPI: showRegionMenu error:', err);
        return { success: false, error: err.message };
      });
    },

    // Phase 6: Broadcast theme change to all windows
    broadcastThemeChange: (theme) => {
      console.log('PreloadAPI: broadcastThemeChange called with:', theme);
      return ipcRenderer.invoke('broadcast-theme-change', theme).catch(err => {
        console.error('PreloadAPI: broadcastThemeChange error:', err);
        return { success: false, error: err.message };
      });
    },

    // Phase 6: Listen for theme changes from other windows
    onThemeChanged: (callback) => {
      const handler = (event, theme) => {
        console.log('PreloadAPI: onThemeChanged event received:', theme);
        try {
          callback(theme);
        } catch (err) {
          console.error('PreloadAPI: onThemeChanged callback error:', err);
        }
      };
      ipcRenderer.on('theme-changed', handler);
      return () => {
        ipcRenderer.removeListener('theme-changed', handler);
      };
    },

    // Phase 6: Listen for window picker open request
    onOpenWindowPicker: (callback) => {
      const handler = () => {
        console.log('PreloadAPI: onOpenWindowPicker event received');
        try {
          callback();
        } catch (err) {
          console.error('PreloadAPI: onOpenWindowPicker callback error:', err);
        }
      };
      ipcRenderer.on('open-window-picker', handler);
      return () => {
        ipcRenderer.removeListener('open-window-picker', handler);
      };
    },

    // Toggle content protection (screenshot hiding)
    toggleContentProtection: () => {
      console.log('PreloadAPI: toggleContentProtection called');
      return ipcRenderer.invoke('toggle-content-protection').catch(err => {
        console.error('PreloadAPI: toggleContentProtection error:', err);
        return { success: false, error: err.message };
      });
    },

    // Window lock (move/resize toggle)
    setWindowLocked: (locked) => {
      console.log('PreloadAPI: setWindowLocked called with:', locked);
      return ipcRenderer.invoke('set-window-locked', locked).catch(err => {
        console.error('PreloadAPI: setWindowLocked error:', err);
        return { success: false, error: err.message };
      });
    },

    getWindowLocked: () => {
      console.log('PreloadAPI: getWindowLocked called');
      return ipcRenderer.invoke('get-window-locked').catch(err => {
        console.error('PreloadAPI: getWindowLocked error:', err);
        return { success: false, error: err.message };
      });
    }
  });

  console.log('PreloadAPI: electronAPI exposed successfully');

} catch (error) {
  console.error('PreloadAPI: Failed to expose electronAPI:', error);
}

// Global error handler for preload script
process.on('uncaughtException', (error) => {
  console.error('PreloadAPI: Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PreloadAPI: Unhandled rejection at:', promise, 'reason:', reason);
});

console.log('PreloadAPI: Preload script loaded successfully');