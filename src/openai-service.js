// ============================================================================
// OPENAI AI SERVICE - ChatGPT/GPT-4 Implementation
// ============================================================================
// Uses GPT-4o for vision/multimodal tasks (screenshot analysis)
// Uses GPT-4o-mini for text-only tasks (faster, cheaper)
// ============================================================================

const AIServiceBase = require('./ai-service-base');
const OpenAI = require('openai');

class OpenAIService extends AIServiceBase {
  constructor(apiKey, options = {}) {
    super('openai', {
      minRequestInterval: 500,  // OpenAI has generous rate limits
      maxRetries: 3,
      maxDailyTokens: 10000000, // 10M tokens (adjust based on tier)
      maxHistoryLength: 20
    });

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({ apiKey });
    
    // Model configuration - can be customized via options
    this.visionModel = options.visionModel ?? 'gpt-4o';        // For screenshot analysis
    this.textModel = options.textModel ?? 'gpt-4o-mini';     // For text-only tasks (faster/cheaper)
    
    console.log(`[OpenAI] Service initialized with ${this.visionModel}/${this.textModel}`);
  }

  // ========================================================================
  // CORE API METHODS
  // ========================================================================

  /**
   * Analyze screenshot with GPT-4o vision capabilities.
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Additional context
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const promptConfig = PROMPTS.SCREENSHOT_ANALYSIS(this.providerName, contextString, additionalContext);

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
   * Generate text using GPT-4o-mini (faster for text-only tasks).
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
  // PROVIDER INFO
  // ========================================================================

  getProviderInfo() {
    return {
      ...super.getProviderInfo(),
      visionModel: this.visionModel,
      textModel: this.textModel,
      displayName: 'OpenAI GPT-4o',
      icon: 'GPT'
    };
  }
}

module.exports = OpenAIService;
