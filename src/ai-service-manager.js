// ============================================================================
// AI SERVICE MANAGER - Factory/Orchestrator for Multiple Providers
// ============================================================================
// Manages multiple AI providers (Gemini, OpenAI, Anthropic, OpenRouter)
// Handles provider switching, fallback, and unified API
// ============================================================================

const GeminiService = require('./gemini-service');

// Lazy load other services to avoid errors if dependencies not installed
let OpenAIService = null;
let AnthropicService = null;
let OpenRouterService = null;

const PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OPENROUTER: 'openrouter'
};

class AIServiceManager {
  constructor(config = {}) {
    this.services = new Map();
    this.activeProvider = null;
    this.defaultProvider = config.defaultProvider ?? PROVIDERS.GEMINI;
    this.enableFallback = config.enableFallback ?? true;
    
    // Initialize services based on available API keys
    this._initializeServices(config);
    
    console.log('[AIServiceManager] Initialized with providers:', this.getAvailableProviders());
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  _initializeServices(config) {
    // Get model configuration
    const modelConfig = config.modelConfig ?? {};
    
    // Initialize Gemini (always available as it's the core dependency)
    if (config.geminiApiKey) {
      try {
        const geminiModelConfig = modelConfig.gemini ?? {};
        const gemini = new GeminiService(config.geminiApiKey, {
          model: geminiModelConfig.model ?? 'gemini-2.5-flash-lite'
        });
        this.services.set(PROVIDERS.GEMINI, gemini);
        console.log('[AIServiceManager] Gemini service initialized');
      } catch (error) {
        console.error('[AIServiceManager] Failed to initialize Gemini:', error.message);
      }
    }

    // Initialize OpenAI (optional)
    if (config.openaiApiKey) {
      try {
        // Lazy load OpenAI service
        if (OpenAIService === null) {
          OpenAIService = require('./openai-service');
        }
        const openaiModelConfig = modelConfig.openai ?? {};
        const openai = new OpenAIService(config.openaiApiKey, {
          visionModel: openaiModelConfig.visionModel ?? 'gpt-4o',
          textModel: openaiModelConfig.textModel ?? 'gpt-4o-mini'
        });
        this.services.set(PROVIDERS.OPENAI, openai);
        console.log('[AIServiceManager] OpenAI service initialized');
      } catch (error) {
        console.error('[AIServiceManager] Failed to initialize OpenAI:', error.message);
        // Check if it's a missing dependency error
        if (error.code === 'MODULE_NOT_FOUND') {
          console.warn('[AIServiceManager] OpenAI SDK not installed. Run: npm install openai');
        }
      }
    }

    // Initialize Anthropic (optional)
    if (config.anthropicApiKey) {
      try {
        // Lazy load Anthropic service
        if (AnthropicService === null) {
          AnthropicService = require('./anthropic-service');
        }
        const anthropicModelConfig = modelConfig.anthropic ?? {};
        const anthropic = new AnthropicService(config.anthropicApiKey, {
          visionModel: anthropicModelConfig.visionModel ?? 'claude-sonnet-4-20250514',
          textModel: anthropicModelConfig.textModel ?? 'claude-3-haiku-20240307'
        });
        this.services.set(PROVIDERS.ANTHROPIC, anthropic);
        console.log('[AIServiceManager] Anthropic service initialized');
      } catch (error) {
        console.error('[AIServiceManager] Failed to initialize Anthropic:', error.message);
        // Check if it's a missing dependency error
        if (error.code === 'MODULE_NOT_FOUND') {
          console.warn('[AIServiceManager] Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
        }
      }
    }

    // Initialize OpenRouter (optional) - uses OpenAI SDK, so no extra deps
    if (config.openrouterApiKey) {
      try {
        // Lazy load OpenRouter service
        if (OpenRouterService === null) {
          OpenRouterService = require('./openrouter-service');
        }
        const openrouterModelConfig = modelConfig.openrouter ?? {};
        const openrouter = new OpenRouterService(config.openrouterApiKey, {
          siteUrl: config.openrouterSiteUrl,
          appName: config.openrouterAppName,
          visionModel: openrouterModelConfig.visionModel ?? 'anthropic/claude-3.5-sonnet',
          textModel: openrouterModelConfig.textModel ?? 'anthropic/claude-3-haiku'
        });
        this.services.set(PROVIDERS.OPENROUTER, openrouter);
        console.log('[AIServiceManager] OpenRouter service initialized');
      } catch (error) {
        console.error('[AIServiceManager] Failed to initialize OpenRouter:', error.message);
        // OpenRouter uses OpenAI SDK, so check for that
        if (error.code === 'MODULE_NOT_FOUND') {
          console.warn('[AIServiceManager] OpenAI SDK not installed (required for OpenRouter). Run: npm install openai');
        }
      }
    }

    // Set active provider
    this._setInitialProvider();
  }

  _setInitialProvider() {
    // Try default provider first
    if (this.services.has(this.defaultProvider)) {
      this.activeProvider = this.defaultProvider;
      return;
    }

    // Fallback to first available provider
    const available = this.getAvailableProviders();
    if (available.length > 0) {
      this.activeProvider = available[0];
      console.log(`[AIServiceManager] Default provider not available, using: ${this.activeProvider}`);
    } else {
      console.error('[AIServiceManager] No AI providers available!');
    }
  }

  // ========================================================================
  // PROVIDER MANAGEMENT
  // ========================================================================

  /**
   * Get list of available providers.
   * @returns {Array<string>} - List of provider names
   */
  getAvailableProviders() {
    return Array.from(this.services.keys());
  }

  /**
   * Get detailed info about all available providers.
   * @returns {Array<object>} - Provider info objects
   */
  getProvidersInfo() {
    const info = [];
    for (const [name, service] of this.services) {
      info.push({
        ...service.getProviderInfo(),
        isActive: name === this.activeProvider
      });
    }
    return info;
  }

  /**
   * Get currently active provider name.
   * @returns {string|null} - Active provider name
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Get active service instance.
   * @returns {AIServiceBase|null} - Active service
   */
  getActiveService() {
    if (this.activeProvider === null) {
      return null;
    }
    return this.services.get(this.activeProvider) ?? null;
  }

  /**
   * Set active provider.
   * @param {string} provider - Provider name to activate
   * @returns {boolean} - Success status
   */
  setActiveProvider(provider) {
    const normalizedProvider = provider?.toLowerCase();
    
    if (!this.services.has(normalizedProvider)) {
      console.error(`[AIServiceManager] Provider not available: ${provider}`);
      return false;
    }

    this.activeProvider = normalizedProvider;
    console.log(`[AIServiceManager] Active provider set to: ${this.activeProvider}`);
    return true;
  }

  /**
   * Check if a specific provider is available.
   * @param {string} provider - Provider name
   * @returns {boolean} - Whether provider is available
   */
  isProviderAvailable(provider) {
    return this.services.has(provider?.toLowerCase());
  }

  // ========================================================================
  // UNIFIED API - Delegates to Active Provider
  // ========================================================================

  /**
   * Analyze screenshot using active provider.
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Additional context
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    const service = this._getServiceWithFallback();
    return await service.analyzeScreenshot(imageBase64, additionalContext);
  }

  /**
   * Generate text using active provider.
   * @param {string} prompt - Text prompt
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    const service = this._getServiceWithFallback();
    return await service.generateText(prompt, options);
  }

  /**
   * Generate multimodal content using active provider.
   * @param {Array} parts - Content parts
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateMultimodal(parts, options = {}) {
    const service = this._getServiceWithFallback();
    return await service.generateMultimodal(parts, options);
  }

  /**
   * Suggest responses using active provider.
   * @param {string} context - Current context
   * @returns {Promise<string>} - Suggestions
   */
  async suggestResponse(context) {
    const service = this._getServiceWithFallback();
    return await service.suggestResponse(context);
  }

  /**
   * Generate meeting notes using active provider.
   * @returns {Promise<string>} - Meeting notes
   */
  async generateMeetingNotes() {
    const service = this._getServiceWithFallback();
    return await service.generateMeetingNotes();
  }

  /**
   * Generate follow-up email using active provider.
   * @returns {Promise<string>} - Email content
   */
  async generateFollowUpEmail() {
    const service = this._getServiceWithFallback();
    return await service.generateFollowUpEmail();
  }

  /**
   * Answer question using active provider.
   * @param {string} question - Question to answer
   * @returns {Promise<string>} - Answer
   */
  async answerQuestion(question) {
    const service = this._getServiceWithFallback();
    return await service.answerQuestion(question);
  }

  /**
   * Get conversation insights using active provider.
   * @returns {Promise<string>} - Insights
   */
  async getConversationInsights() {
    const service = this._getServiceWithFallback();
    return await service.getConversationInsights();
  }

  // ========================================================================
  // CONVERSATION HISTORY MANAGEMENT
  // ========================================================================

  /**
   * Add to conversation history of active provider.
   * @param {string} role - Role (user, assistant)
   * @param {string} content - Content
   */
  addToHistory(role, content) {
    const service = this.getActiveService();
    if (service !== null) {
      service.addToHistory(role, content);
    }
  }

  /**
   * Clear conversation history of active provider.
   */
  clearHistory() {
    const service = this.getActiveService();
    if (service !== null) {
      service.clearHistory();
    }
  }

  /**
   * Get conversation history from active provider.
   * @returns {Array} - Conversation history
   */
  getHistory() {
    const service = this.getActiveService();
    return service?.getHistory() ?? [];
  }

  /**
   * Get conversation history as string from active provider.
   * @returns {string} - Formatted history
   */
  getContextString() {
    const service = this.getActiveService();
    return service?.getContextString() ?? '';
  }

  /**
   * Alias for getHistory to maintain compatibility.
   * @returns {Array} - Conversation history
   */
  get conversationHistory() {
    return this.getHistory();
  }

  // ========================================================================
  // FALLBACK HANDLING
  // ========================================================================

  /**
   * Get active service or fallback to another provider.
   * @returns {AIServiceBase} - Service instance
   * @throws {Error} - If no providers available
   */
  _getServiceWithFallback() {
    const activeService = this.getActiveService();
    
    if (activeService !== null) {
      return activeService;
    }

    if (this.enableFallback) {
      // Try to find any available service
      for (const service of this.services.values()) {
        console.warn(`[AIServiceManager] Falling back to: ${service.providerName}`);
        return service;
      }
    }

    throw new Error('No AI providers available. Please configure at least one API key.');
  }

  /**
   * Execute with automatic fallback on failure.
   * @param {Function} operation - Operation to execute
   * @returns {Promise<*>} - Operation result
   */
  async executeWithFallback(operation) {
    const providers = this.getAvailableProviders();
    let lastError = null;

    // Start with active provider
    const orderedProviders = [
      this.activeProvider,
      ...providers.filter(p => p !== this.activeProvider)
    ].filter(p => p !== null);

    for (const provider of orderedProviders) {
      try {
        const service = this.services.get(provider);
        if (service === undefined) continue;
        
        return await operation(service);
      } catch (error) {
        console.error(`[AIServiceManager] Provider ${provider} failed:`, error.message);
        lastError = error;
        
        if (!this.enableFallback) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error('All providers failed');
  }

  // ========================================================================
  // MODEL COMPATIBILITY CHECK
  // ========================================================================

  /**
   * Check if model/service is properly initialized.
   * @returns {boolean} - Whether service is ready
   */
  get model() {
    // Compatibility with old code that checks geminiService.model
    const service = this.getActiveService();
    return service !== null;
  }
}

// Export singleton factory
module.exports = AIServiceManager;
module.exports.PROVIDERS = PROVIDERS;
