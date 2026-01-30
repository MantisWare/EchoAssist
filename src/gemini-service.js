// ============================================================================
// GEMINI AI SERVICE - Google Gemini Implementation
// ============================================================================
// Uses Gemini 2.5 Flash Lite for both vision and text tasks
// Rate limits: 15 RPM (free tier), configured for 10 RPM to be safe
// ============================================================================

const AIServiceBase = require('./ai-service-base');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService extends AIServiceBase {
  constructor(apiKey, options = {}) {
    super('gemini', {
      minRequestInterval: 6000,  // 6 seconds (10 RPM = 1 request per 6 seconds)
      maxRetries: 3,
      maxDailyTokens: 4000000,   // 4M tokens per day
      maxHistoryLength: 20
    });

    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = options.model ?? 'gemini-2.5-flash-lite';
    this._initializeModel();
    
    console.log(`[Gemini] Service initialized with ${this.modelName}`);
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  _initializeModel() {
    try {
      this.model = this.genAI.getGenerativeModel({
        model: this.modelName
      });
    } catch (error) {
      console.warn('[Gemini] Primary model failed, using fallback:', error);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite'
      });
    }
  }

  // ========================================================================
  // CORE API METHODS
  // ========================================================================

  /**
   * Analyze screenshot with Gemini's multimodal capabilities.
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Additional context
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.SCREENSHOT_ANALYSIS(this.providerName, contextString, additionalContext);

    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64
        }
      }
    ];

    const result = await this.generateMultimodal(parts);
    this.addToHistory('assistant', `Screenshot analysis: ${result}`);
    return result;
  }

  /**
   * Generate text using Gemini.
   * @param {string|object} prompt - Text prompt or prompt config
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    // Handle prompt config objects from other providers
    const textPrompt = this._extractTextPrompt(prompt);
    
    return new Promise((resolve, reject) => {
      const request = {
        type: 'text',
        data: textPrompt,
        resolve,
        reject
      };

      this.requestQueue.push(request);
      this._processQueue();
    });
  }

  /**
   * Generate multimodal content (text + images).
   * @param {Array} parts - Array of content parts
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateMultimodal(parts, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        type: 'multimodal',
        data: parts,
        resolve,
        reject
      };

      this.requestQueue.push(request);
      this._processQueue();
    });
  }

  // ========================================================================
  // REQUEST QUEUE PROCESSING (Gemini-specific due to rate limits)
  // ========================================================================

  async _processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();

      try {
        await this.waitForRateLimit();
        const result = await this._executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  async _executeRequest(request, retryCount = 0) {
    try {
      this.checkAndResetDailyLimit();

      // Check daily token limit
      const estimatedTokens = this.estimateTokens(JSON.stringify(request.data));
      if (!this.isWithinTokenLimits(estimatedTokens)) {
        throw new Error('Daily token limit reached');
      }

      // Execute request based on type
      let result;
      if (request.type === 'text') {
        result = await this.model.generateContent(request.data);
      } else if (request.type === 'multimodal') {
        result = await this.model.generateContent(request.data);
      }

      // Update token count
      this.updateTokenCount(estimatedTokens);

      return result.response.text();

    } catch (error) {
      console.error(`[Gemini] Request error (attempt ${retryCount + 1}):`, error.message);

      // Retry logic for rate limit or server errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const backoffTime = Math.pow(2, retryCount) * 2000;
        console.log(`[Gemini] Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return await this._executeRequest(request, retryCount + 1);
      }

      throw error;
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Extract text prompt from various prompt formats.
   * @param {string|object} prompt - Prompt input
   * @returns {string} - Text prompt
   */
  _extractTextPrompt(prompt) {
    if (typeof prompt === 'string') {
      return prompt;
    }

    // Handle OpenAI-style prompt config
    if (prompt.system !== undefined && prompt.user !== undefined) {
      return `${prompt.system}\n\n${prompt.user}`;
    }

    // Handle Anthropic-style prompt config
    if (prompt.system !== undefined && prompt.human !== undefined) {
      return `${prompt.system}\n\n${prompt.human}`;
    }

    // Fallback: stringify
    return JSON.stringify(prompt);
  }

  // ========================================================================
  // PROVIDER INFO
  // ========================================================================

  getProviderInfo() {
    return {
      ...super.getProviderInfo(),
      model: 'gemini-2.5-flash-lite',
      displayName: 'Google Gemini',
      icon: 'Gemini'
    };
  }
}

module.exports = GeminiService;
