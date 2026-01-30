// ============================================================================
// ANTHROPIC AI SERVICE - Claude Implementation
// ============================================================================
// Uses Claude 3.5 Sonnet for vision/multimodal tasks (screenshot analysis)
// Uses Claude 3 Haiku for text-only tasks (faster, cheaper)
// ============================================================================

const AIServiceBase = require('./ai-service-base');
const Anthropic = require('@anthropic-ai/sdk');

class AnthropicService extends AIServiceBase {
  constructor(apiKey, options = {}) {
    super('anthropic', {
      minRequestInterval: 500,  // Anthropic has good rate limits
      maxRetries: 3,
      maxDailyTokens: 10000000, // 10M tokens (adjust based on tier)
      maxHistoryLength: 20
    });

    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({ apiKey });
    
    // Model configuration - can be customized via options
    this.visionModel = options.visionModel ?? 'claude-sonnet-4-20250514';  // Latest Sonnet for vision
    this.textModel = options.textModel ?? 'claude-3-haiku-20240307';      // Haiku for fast text tasks
    
    console.log(`[Anthropic] Service initialized with ${this.visionModel}/${this.textModel}`);
  }

  // ========================================================================
  // CORE API METHODS
  // ========================================================================

  /**
   * Analyze screenshot with Claude's vision capabilities.
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} additionalContext - Additional context
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const promptConfig = PROMPTS.SCREENSHOT_ANALYSIS(this.providerName, contextString, additionalContext);

    const result = await this.executeWithRetry(async () => {
      const response = await this.client.messages.create({
        model: this.visionModel,
        max_tokens: 4096,
        system: promptConfig.system,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: promptConfig.human
              }
            ]
          }
        ]
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.input_tokens + response.usage.output_tokens);
      }

      return this._extractTextFromResponse(response);
    });

    this.addToHistory('assistant', `Screenshot analysis: ${result}`);
    return result;
  }

  /**
   * Generate text using Claude Haiku (faster for text-only tasks).
   * @param {string|object} prompt - Text prompt or prompt config object
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    const { system, messages } = this._buildMessages(prompt);
    
    return await this.executeWithRetry(async () => {
      const response = await this.client.messages.create({
        model: options.useVisionModel ? this.visionModel : this.textModel,
        max_tokens: options.maxTokens ?? 2048,
        system,
        messages
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.input_tokens + response.usage.output_tokens);
      }

      return this._extractTextFromResponse(response);
    });
  }

  /**
   * Generate multimodal content (text + images).
   * @param {Array} parts - Array of content parts
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateMultimodal(parts, options = {}) {
    const content = this._buildMultimodalContent(parts);
    
    return await this.executeWithRetry(async () => {
      const response = await this.client.messages.create({
        model: this.visionModel,
        max_tokens: options.maxTokens ?? 4096,
        system: 'You are Invisibrain, an expert AI assistant for analyzing screenshots and solving programming problems.',
        messages: [
          {
            role: 'user',
            content
          }
        ]
      });

      // Track token usage
      if (response.usage) {
        this.updateTokenCount(response.usage.input_tokens + response.usage.output_tokens);
      }

      return this._extractTextFromResponse(response);
    });
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Extract text content from Anthropic response.
   * @param {object} response - API response
   * @returns {string} - Extracted text
   */
  _extractTextFromResponse(response) {
    if (response.content === undefined || response.content === null) {
      return '';
    }

    // Response content is an array of content blocks
    return response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }

  /**
   * Build messages from prompt input.
   * @param {string|object} prompt - Prompt string or config object
   * @returns {object} - Object with system and messages
   */
  _buildMessages(prompt) {
    // If prompt is already a config object with system/human
    if (typeof prompt === 'object' && (prompt.system !== undefined || prompt.human !== undefined)) {
      return {
        system: prompt.system ?? 'You are Invisibrain, a helpful AI assistant.',
        messages: [
          {
            role: 'user',
            content: prompt.human ?? prompt.user ?? ''
          }
        ]
      };
    }

    // Simple string prompt
    return {
      system: 'You are Invisibrain, a helpful AI assistant specializing in programming and problem-solving.',
      messages: [
        {
          role: 'user',
          content: String(prompt)
        }
      ]
    };
  }

  /**
   * Build multimodal content from parts array.
   * @param {Array} parts - Content parts (text and images)
   * @returns {Array} - Content array for API
   */
  _buildMultimodalContent(parts) {
    const content = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        content.push({ type: 'text', text: part });
      } else if (part.text !== undefined) {
        content.push({ type: 'text', text: part.text });
      } else if (part.inlineData !== undefined) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.inlineData.mimeType,
            data: part.inlineData.data
          }
        });
      }
    }

    return content;
  }

  // ========================================================================
  // PROVIDER INFO
  // ========================================================================

  getProviderInfo() {
    return {
      ...super.getProviderInfo(),
      visionModel: this.visionModel,
      textModel: this.textModel,
      displayName: 'Anthropic Claude',
      icon: 'Claude'
    };
  }
}

module.exports = AnthropicService;
