// ============================================================================
// SETTINGS STORE - Secure Configuration Management
// ============================================================================
// Uses electron-store for persistent settings storage
// Uses Electron's safeStorage API for encrypting sensitive data (API keys)
// ============================================================================

const Store = require('electron-store');
const { safeStorage, app } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Schema for settings validation
const schema = {
  // API Keys (stored encrypted)
  apiKeys: {
    type: 'object',
    default: {},
    properties: {
      gemini: { type: 'string', default: '' },
      openai: { type: 'string', default: '' },
      anthropic: { type: 'string', default: '' },
      openrouter: { type: 'string', default: '' }
    }
  },
  
  // AI Provider Settings
  ai: {
    type: 'object',
    default: {},
    properties: {
      defaultProvider: { type: 'string', default: 'gemini' },
      enableFallback: { type: 'boolean', default: true },
      maxHistoryLength: { type: 'number', default: 20 },
      models: {
        type: 'object',
        default: {},
        properties: {
          gemini: {
            type: 'object',
            default: {},
            properties: {
              model: { type: 'string', default: 'gemini-2.5-flash-lite' }
            }
          },
          openai: {
            type: 'object',
            default: {},
            properties: {
              visionModel: { type: 'string', default: 'gpt-4o' },
              textModel: { type: 'string', default: 'gpt-4o-mini' }
            }
          },
          anthropic: {
            type: 'object',
            default: {},
            properties: {
              visionModel: { type: 'string', default: 'claude-sonnet-4-20250514' },
              textModel: { type: 'string', default: 'claude-3-haiku-20240307' }
            }
          },
          openrouter: {
            type: 'object',
            default: {},
            properties: {
              visionModel: { type: 'string', default: 'anthropic/claude-3.5-sonnet' },
              textModel: { type: 'string', default: 'anthropic/claude-3-haiku' }
            }
          }
        }
      }
    }
  },
  
  // UI Settings
  ui: {
    type: 'object',
    default: {},
    properties: {
      theme: { type: 'string', enum: ['light', 'dark', 'system'], default: 'dark' },
      opacity: { type: 'number', minimum: 0.1, maximum: 1, default: 1 },
      alwaysOnTop: { type: 'boolean', default: true },
      startMinimized: { type: 'boolean', default: false },
      showIconLabels: { type: 'boolean', default: false }
    }
  },

  // Phase 6: Panel State Persistence
  panelState: {
    type: 'object',
    default: {},
    properties: {
      controlBar: {
        type: 'object',
        default: {},
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          docked: { type: 'string', default: 'floating' }
        }
      },
      transcript: {
        type: 'object',
        default: {},
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          locked: { type: 'boolean', default: false }
        }
      },
      summary: {
        type: 'object',
        default: {},
        properties: {
          collapsed: { type: 'boolean', default: false }
        }
      }
    }
  },
  
  // Voice Settings
  voice: {
    type: 'object',
    default: {},
    properties: {
      enabled: { type: 'boolean', default: true },
      language: { type: 'string', default: 'en-US' },
      autoStart: { type: 'boolean', default: false },
      voskModelSize: { type: 'string', enum: ['small', 'medium', 'large'], default: 'large' }
    }
  },
  
  // Screenshot Settings
  screenshot: {
    type: 'object',
    default: {},
    properties: {
      maxCount: { type: 'number', default: 3 },
      captureDelay: { type: 'number', default: 300 }
    }
  },

  // Capture Region/Window Settings (Phase 5)
  capture: {
    type: 'object',
    default: {},
    properties: {
      mode: { type: 'string', enum: ['fullScreen', 'region', 'window'], default: 'fullScreen' },
      region: {
        type: 'object',
        default: {},
        properties: {
          x: { type: 'number', default: 0 },
          y: { type: 'number', default: 0 },
          width: { type: 'number', default: 0 },
          height: { type: 'number', default: 0 }
        }
      },
      window: {
        type: 'object',
        default: {},
        properties: {
          title: { type: 'string', default: '' },
          processName: { type: 'string', default: '' },
          followWindow: { type: 'boolean', default: true }
        }
      },
      monitorIndex: { type: 'number', default: 0 }
    }
  },
  
  // First run flag
  hasCompletedSetup: {
    type: 'boolean',
    default: false
  }
};

/**
 * Get or generate the encryption key for electron-store.
 * Priority:
 *   1. Read existing key from key file, decrypt with safeStorage
 *   2. Generate a new random key, encrypt with safeStorage, save to file
 *   3. Fallback: derive from machine-specific info (hostname + username + platform)
 *
 * @returns {string} Encryption key for electron-store
 */
function getOrCreateEncryptionKey() {
  const KEY_FILE_NAME = '.echoassist-store-key';
  const os = require('os');

  // Determine key file path
  let keyFilePath;
  try {
    keyFilePath = path.join(app.getPath('userData'), KEY_FILE_NAME);
  } catch {
    keyFilePath = path.join(os.homedir(), KEY_FILE_NAME);
  }

  // Try to read existing key
  if (fs.existsSync(keyFilePath)) {
    try {
      const stored = fs.readFileSync(keyFilePath, 'utf8').trim();

      if (stored.startsWith('derived:')) {
        // Machine-derived fallback key (not encrypted)
        return stored;
      }

      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(stored, 'base64');
        return safeStorage.decryptString(buffer);
      }

      // safeStorage was available when key was saved, but not now — regenerate
      console.warn('[SettingsStore] safeStorage unavailable, cannot decrypt stored key. Regenerating.');
    } catch (err) {
      console.warn('[SettingsStore] Failed to read encryption key file:', err.message);
    }
  }

  // Generate new key
  if (safeStorage.isEncryptionAvailable()) {
    const rawKey = crypto.randomBytes(32).toString('hex');
    try {
      const encrypted = safeStorage.encryptString(rawKey);
      fs.writeFileSync(keyFilePath, encrypted.toString('base64'), { mode: 0o600 });
      console.log('[SettingsStore] Generated and saved new encryption key (safeStorage)');
      return rawKey;
    } catch (err) {
      console.warn('[SettingsStore] Failed to save encryption key:', err.message);
      return rawKey; // Use in-memory only this session
    }
  }

  // Fallback: derive from machine identity
  console.warn('[SettingsStore] safeStorage unavailable. Deriving encryption key from machine identity.');
  const machineId = `${os.hostname()}:${os.userInfo().username}:${process.platform}:${os.homedir()}`;
  const derivedKey = 'derived:' + crypto.createHash('sha256').update(machineId).digest('hex');

  try {
    fs.writeFileSync(keyFilePath, derivedKey, { mode: 0o600 });
  } catch (err) {
    console.warn('[SettingsStore] Failed to save derived key:', err.message);
  }

  return derivedKey;
}

class SettingsStore {
  constructor() {
    let encryptionKey;
    try {
      encryptionKey = getOrCreateEncryptionKey();
    } catch (err) {
      console.error('[SettingsStore] Failed to get encryption key, using fallback:', err.message);
      encryptionKey = 'echoassist-fallback-' + require('os').hostname();
    }

    this.store = new Store({
      name: 'echoassist-settings',
      schema,
      encryptionKey,
      clearInvalidConfig: true
    });

    this._encryptionKeySource = safeStorage.isEncryptionAvailable() ? 'safeStorage' : 'derived';
    console.log(`[SettingsStore] Initialized at: ${this.store.path} (key source: ${this._encryptionKeySource})`);
  }

  // ========================================================================
  // API KEY MANAGEMENT (Encrypted)
  // ========================================================================

  /**
   * Check if safeStorage encryption is available
   * @returns {boolean}
   */
  isEncryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Get encryption status details for diagnostics/UI display
   * @returns {{ available: boolean, source: string }}
   */
  getEncryptionStatus() {
    return {
      available: safeStorage.isEncryptionAvailable(),
      source: this._encryptionKeySource ?? 'unknown'
    };
  }

  /**
   * Encrypt a string using safeStorage
   * @param {string} value - Value to encrypt
   * @returns {string} - Base64 encoded encrypted string
   */
  _encryptValue(value) {
    if (!value) return '';

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      return encrypted.toString('base64');
    }

    // Fallback: base64 encode only (NOT encrypted — trivially reversible)
    // Prefix with 'b64:' so _decryptValue can distinguish from safeStorage data
    console.warn('[SettingsStore] WARNING: safeStorage not available. API key stored with base64 encoding only (not secure).');
    return 'b64:' + Buffer.from(value).toString('base64');
  }

  /**
   * Decrypt a string using safeStorage
   * @param {string} encryptedBase64 - Base64 encoded encrypted string
   * @returns {string} - Decrypted value
   */
  _decryptValue(encryptedBase64) {
    if (!encryptedBase64) return '';

    try {
      // Check for base64-only fallback prefix
      if (encryptedBase64.startsWith('b64:')) {
        console.warn('[SettingsStore] Decrypting base64-only value (not securely encrypted)');
        return Buffer.from(encryptedBase64.slice(4), 'base64').toString('utf8');
      }

      const buffer = Buffer.from(encryptedBase64, 'base64');

      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buffer);
      }

      // Fallback: Decode as-is (legacy data without prefix)
      return buffer.toString('utf8');
    } catch (error) {
      console.error('[SettingsStore] Decryption error:', error.message);
      return '';
    }
  }

  /**
   * Set an API key (encrypted)
   * @param {string} provider - Provider name (gemini, openai, anthropic, openrouter)
   * @param {string} apiKey - The API key to store
   */
  setApiKey(provider, apiKey) {
    const encrypted = this._encryptValue(apiKey);
    this.store.set(`apiKeys.${provider}`, encrypted);
    console.log(`[SettingsStore] API key for ${provider} ${apiKey ? 'saved' : 'cleared'}`);
  }

  /**
   * Get an API key (decrypted)
   * @param {string} provider - Provider name
   * @returns {string} - Decrypted API key or empty string
   */
  getApiKey(provider) {
    const encrypted = this.store.get(`apiKeys.${provider}`, '');
    return this._decryptValue(encrypted);
  }

  /**
   * Get all API keys (decrypted)
   * @returns {object} - Object with all API keys
   */
  getAllApiKeys() {
    return {
      gemini: this.getApiKey('gemini'),
      openai: this.getApiKey('openai'),
      anthropic: this.getApiKey('anthropic'),
      openrouter: this.getApiKey('openrouter')
    };
  }

  /**
   * Check which providers have API keys configured
   * @returns {object} - Object with boolean flags for each provider
   */
  getConfiguredProviders() {
    const keys = this.getAllApiKeys();
    return {
      gemini: !!keys.gemini,
      openai: !!keys.openai,
      anthropic: !!keys.anthropic,
      openrouter: !!keys.openrouter
    };
  }

  /**
   * Clear an API key
   * @param {string} provider - Provider name
   */
  clearApiKey(provider) {
    this.store.set(`apiKeys.${provider}`, '');
    console.log(`[SettingsStore] API key for ${provider} cleared`);
  }

  // ========================================================================
  // GENERAL SETTINGS
  // ========================================================================

  /**
   * Get AI settings
   * @returns {object}
   */
  getAISettings() {
    return this.store.get('ai', {
      defaultProvider: 'gemini',
      enableFallback: true,
      maxHistoryLength: 20,
      models: {
        gemini: { model: 'gemini-2.5-flash-lite' },
        openai: { visionModel: 'gpt-4o', textModel: 'gpt-4o-mini' },
        anthropic: { visionModel: 'claude-sonnet-4-20250514', textModel: 'claude-3-haiku-20240307' },
        openrouter: { visionModel: 'anthropic/claude-3.5-sonnet', textModel: 'anthropic/claude-3-haiku' }
      }
    });
  }

  /**
   * Set AI settings
   * @param {object} settings
   */
  setAISettings(settings) {
    const current = this.getAISettings();
    this.store.set('ai', { ...current, ...settings });
    console.log('[SettingsStore] AI settings updated:', settings);
  }

  /**
   * Get UI settings
   * @returns {object}
   */
  getUISettings() {
    return this.store.get('ui', {
      theme: 'dark',
      opacity: 1,
      alwaysOnTop: true,
      startMinimized: false,
      // Phase 6: New UI preferences
      showIconLabels: false,
      autoScrollEnabled: true
    });
  }

  /**
   * Set UI settings
   * @param {object} settings
   */
  setUISettings(settings) {
    const current = this.getUISettings();
    this.store.set('ui', { ...current, ...settings });
    console.log('[SettingsStore] UI settings updated:', settings);
  }

  /**
   * Get voice settings
   * @returns {object}
   */
  getVoiceSettings() {
    return this.store.get('voice', {
      enabled: true,
      language: 'en-US',
      autoStart: false,
      voskModelSize: 'large'
    });
  }

  /**
   * Set voice settings
   * @param {object} settings
   */
  setVoiceSettings(settings) {
    const current = this.getVoiceSettings();
    this.store.set('voice', { ...current, ...settings });
    console.log('[SettingsStore] Voice settings updated:', settings);
  }

  /**
   * Get screenshot settings
   * @returns {object}
   */
  getScreenshotSettings() {
    return this.store.get('screenshot', {
      maxCount: 3,
      captureDelay: 300
    });
  }

  /**
   * Set screenshot settings
   * @param {object} settings
   */
  setScreenshotSettings(settings) {
    const current = this.getScreenshotSettings();
    this.store.set('screenshot', { ...current, ...settings });
    console.log('[SettingsStore] Screenshot settings updated:', settings);
  }

  // ========================================================================
  // CAPTURE REGION/WINDOW SETTINGS (Phase 5)
  // ========================================================================

  /**
   * Get capture config (region/window selection)
   * @returns {object}
   */
  getCaptureConfig() {
    return this.store.get('capture', {
      mode: 'fullScreen',
      region: { x: 0, y: 0, width: 0, height: 0 },
      window: { title: '', processName: '', followWindow: true },
      monitorIndex: 0
    });
  }

  /**
   * Set capture config
   * @param {object} config - Capture configuration
   */
  setCaptureConfig(config) {
    const current = this.getCaptureConfig();
    this.store.set('capture', { ...current, ...config });
    console.log('[SettingsStore] Capture config updated:', config);
  }

  /**
   * Reset capture mode to full screen
   */
  resetCaptureMode() {
    this.store.set('capture', {
      mode: 'fullScreen',
      region: { x: 0, y: 0, width: 0, height: 0 },
      window: { title: '', processName: '', followWindow: true },
      monitorIndex: 0
    });
    console.log('[SettingsStore] Capture mode reset to fullScreen');
  }

  // ========================================================================
  // CORRECTION SETTINGS
  // ========================================================================

  /**
   * Get transcript correction settings
   * @returns {object}
   */
  getCorrectionSettings() {
    return this.store.get('correction', {
      enabled: true,
      frequency: '30000',  // 30 seconds
      accentHint: 'general'
    });
  }

  /**
   * Set transcript correction settings
   * @param {object} settings
   */
  setCorrectionSettings(settings) {
    const current = this.getCorrectionSettings();
    this.store.set('correction', { ...current, ...settings });
    console.log('[SettingsStore] Correction settings updated:', settings);
  }

  // ========================================================================
  // SETUP & MIGRATION
  // ========================================================================

  /**
   * Check if initial setup has been completed
   * @returns {boolean}
   */
  hasCompletedSetup() {
    return this.store.get('hasCompletedSetup', false);
  }

  /**
   * Mark setup as completed
   */
  completeSetup() {
    this.store.set('hasCompletedSetup', true);
    console.log('[SettingsStore] Setup marked as completed');
  }

  // ========================================================================
  // PANEL STATE PERSISTENCE (Phase 6)
  // ========================================================================

  /**
   * Get saved panel positions/sizes
   * @returns {object}
   */
  getPanelState() {
    return this.store.get('panelState', {
      controlBar: {},
      transcript: {},
      summary: {}
    });
  }

  /**
   * Save panel positions/sizes
   * @param {object} state - Panel state to save
   */
  setPanelState(state) {
    const current = this.getPanelState();
    const merged = { ...current };
    if (state.controlBar !== undefined) {
      merged.controlBar = { ...current.controlBar, ...state.controlBar };
    }
    if (state.transcript !== undefined) {
      merged.transcript = { ...current.transcript, ...state.transcript };
    }
    if (state.summary !== undefined) {
      merged.summary = { ...current.summary, ...state.summary };
    }
    this.store.set('panelState', merged);
    console.log('[SettingsStore] Panel state updated');
  }

  /**
   * Get all settings (for export/backup)
   * Note: API keys are NOT included for security
   * @returns {object}
   */
  getAllSettings() {
    return {
      ai: this.getAISettings(),
      ui: this.getUISettings(),
      voice: this.getVoiceSettings(),
      screenshot: this.getScreenshotSettings(),
      capture: this.getCaptureConfig(),
      correction: this.getCorrectionSettings(),
      panelState: this.getPanelState(),
      hasCompletedSetup: this.hasCompletedSetup(),
      configuredProviders: this.getConfiguredProviders()
    };
  }

  /**
   * Reset all settings to defaults
   */
  resetToDefaults() {
    this.store.clear();
    console.log('[SettingsStore] All settings reset to defaults');
  }

  /**
   * Import API keys from environment variables (migration helper)
   * @param {object} env - process.env object
   */
  migrateFromEnv(env) {
    let migrated = false;
    
    if (env.GEMINI_API_KEY && !this.getApiKey('gemini')) {
      this.setApiKey('gemini', env.GEMINI_API_KEY);
      migrated = true;
    }
    
    if (env.OPENAI_API_KEY && !this.getApiKey('openai')) {
      this.setApiKey('openai', env.OPENAI_API_KEY);
      migrated = true;
    }
    
    if (env.ANTHROPIC_API_KEY && !this.getApiKey('anthropic')) {
      this.setApiKey('anthropic', env.ANTHROPIC_API_KEY);
      migrated = true;
    }
    
    if (env.OPENROUTER_API_KEY && !this.getApiKey('openrouter')) {
      this.setApiKey('openrouter', env.OPENROUTER_API_KEY);
      migrated = true;
    }
    
    if (env.DEFAULT_AI_PROVIDER) {
      this.setAISettings({ defaultProvider: env.DEFAULT_AI_PROVIDER });
      migrated = true;
    }
    
    if (migrated) {
      console.log('[SettingsStore] Migrated settings from environment variables');
    }
    
    return migrated;
  }
}

// Export singleton instance
module.exports = new SettingsStore();
