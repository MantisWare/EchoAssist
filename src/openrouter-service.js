// ============================================================================
// OPENROUTER AI SERVICE - Multi-Model Gateway Implementation
// ============================================================================
// OpenRouter provides access to 100+ AI models through a single API.
// Uses OpenAI-compatible API format for easy integration.
// Models available: Claude, GPT-4, Llama, Mistral, Gemini, and more.
// ============================================================================

const AIServiceBase = require('./ai-service-base');
const OpenAI = require('openai');

// Popular models available on OpenRouter
const OPENROUTER_MODELS = {
  // Vision-capable models (for screenshot analysis)
  VISION: {
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'gpt-4o': 'openai/gpt-4o',
    'gemini-pro-vision': 'google/gemini-pro-1.5',
    'llama-3.2-vision': 'meta-llama/llama-3.2-90b-vision-instruct'
  },
  // Fast text models (for quick responses)
  TEXT: {
    'claude-3-haiku': 'anthropic/claude-3-haiku',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gemini-flash': 'google/gemini-flash-1.5',
    'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
    'mistral-large': 'mistralai/mistral-large'
  }
};

class OpenRouterService extends AIServiceBase {
  constructor(apiKey, options = {}) {
    super('openrouter', {
      minRequestInterval: 200,  // OpenRouter has generous rate limits
      maxRetries: 3,
      maxDailyTokens: 50000000, // Depends on your credits
      maxHistoryLength: 20
    });

    if (!apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    // OpenRouter uses OpenAI-compatible API with different base URL
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': options.siteUrl ?? 'https://github.com/echo-assist',
        'X-Title': options.appName ?? 'EchoAssist AI Assistant'
      }
    });

    // Default models (can be customized)
    this.visionModel = options.visionModel ?? OPENROUTER_MODELS.VISION['claude-3.5-sonnet'];
    this.textModel = options.textModel ?? OPENROUTER_MODELS.TEXT['claude-3-haiku'];

    console.log(`[OpenRouter] Service initialized with models:`);
    console.log(`  Vision: ${this.visionModel}`);
    console.log(`  Text: ${this.textModel}`);
  }

  // ========================================================================
  // CORE API METHODS
  // ========================================================================

  /**
   * Analyze screenshot with vision model.
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Additional context
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    // OpenRouter uses OpenAI-compatible format, so we use openai prompts
    const promptConfig = PROMPTS.SCREENSHOT_ANALYSIS('openai', contextString, additionalContext);

    const result = await this.executeWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'system',
            content: promptConfig.system
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptConfig.user },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.7
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.total_tokens);
      }

      return response.choices[0]?.message?.content ?? '';
    });

    this.addToHistory('assistant', `Screenshot analysis: ${result}`);
    return result;
  }

  /**
   * Generate text using fast text model.
   * @param {string|object} prompt - Text prompt or prompt config object
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    const messages = this._buildMessages(prompt);

    return await this.executeWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: options.useVisionModel ? this.visionModel : this.textModel,
        messages,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.total_tokens);
      }

      return response.choices[0]?.message?.content ?? '';
    });
  }

  /**
   * Generate multimodal content (text + images).
   * @param {Array} parts - Array of content parts
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateMultimodal(parts, options = {}) {
    const messages = this._buildMultimodalMessages(parts);

    return await this.executeWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.total_tokens);
      }

      return response.choices[0]?.message?.content ?? '';
    });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Build messages array from prompt input.
   * @param {string|object} prompt - Prompt string or config object
   * @returns {Array} - Messages array for API
   */
  _buildMessages(prompt) {
    // If prompt is already a config object with system/user
    if (typeof prompt === 'object' && prompt.system !== undefined) {
      const messages = [];

      if (prompt.system) {
        messages.push({ role: 'system', content: prompt.system });
      }

      if (prompt.user) {
        messages.push({ role: 'user', content: prompt.user });
      } else if (prompt.human) {
        // Handle Anthropic-style prompts
        messages.push({ role: 'user', content: prompt.human });
      }

      return messages;
    }

    // Simple string prompt
    return [
      {
        role: 'system',
        content: 'You are Invisibrain, a helpful AI assistant specializing in programming and problem-solving.'
      },
      {
        role: 'user',
        content: String(prompt)
      }
    ];
  }

  /**
   * Build multimodal messages from parts array.
   * @param {Array} parts - Content parts (text and images)
   * @returns {Array} - Messages array for API
   */
  _buildMultimodalMessages(parts) {
    const content = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        content.push({ type: 'text', text: part });
      } else if (part.text !== undefined) {
        content.push({ type: 'text', text: part.text });
      } else if (part.inlineData !== undefined) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            detail: 'high'
          }
        });
      }
    }

    return [
      {
        role: 'system',
        content: 'You are Invisibrain, an expert AI assistant for analyzing screenshots and solving programming problems.'
      },
      {
        role: 'user',
        content
      }
    ];
  }

  // ========================================================================
  // MODEL CONFIGURATION
  // ========================================================================

  /**
   * Set the vision model to use.
   * @param {string} modelId - OpenRouter model ID
   */
  setVisionModel(modelId) {
    this.visionModel = modelId;
    console.log(`[OpenRouter] Vision model set to: ${modelId}`);
  }

  /**
   * Set the text model to use.
   * @param {string} modelId - OpenRouter model ID
   */
  setTextModel(modelId) {
    this.textModel = modelId;
    console.log(`[OpenRouter] Text model set to: ${modelId}`);
  }

  /**
   * Get available model presets.
   * @returns {object} - Available models
   */
  static getAvailableModels() {
    return OPENROUTER_MODELS;
  }

  // ========================================================================
  // PROVIDER INFO
  // ========================================================================

  getProviderInfo() {
    return {
      ...super.getProviderInfo(),
      visionModel: this.visionModel,
      textModel: this.textModel,
      displayName: 'OpenRouter',
      icon: 'Router'
    };
  }
}

module.exports = OpenRouterService;
module.exports.OPENROUTER_MODELS = OPENROUTER_MODELS;
