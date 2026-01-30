// ============================================================================
// AI SERVICE BASE CLASS - Shared Interface for All Providers
// ============================================================================
// Abstract base class defining the common interface all AI providers must implement.
// Handles rate limiting, conversation history, and token tracking.
// ============================================================================

/**
 * Abstract base class for AI service providers.
 * All providers (Gemini, OpenAI, Anthropic) must extend this class.
 */
class AIServiceBase {
  constructor(providerName, config = {}) {
    if (new.target === AIServiceBase) {
      throw new Error('AIServiceBase is abstract and cannot be instantiated directly');
    }

    this.providerName = providerName;

    // Rate limiting configuration (can be overridden by subclasses)
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = config.minRequestInterval ?? 1000; // 1 second default
    this.maxRetries = config.maxRetries ?? 3;
    this.isProcessing = false;

    // Token tracking
    this.dailyTokenCount = 0;
    this.maxDailyTokens = config.maxDailyTokens ?? 1000000; // 1M default
    this.lastResetTime = Date.now();

    // Conversation context management
    this.conversationHistory = [];
    this.maxHistoryLength = config.maxHistoryLength ?? 20;
  }

  // ========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ========================================================================

  /**
   * Analyze a screenshot image with optional context.
   * @param {string} imageBase64 - Base64 encoded image data
   * @param {string} additionalContext - Optional additional context
   * @returns {Promise<string>} - Analysis result text
   */
  async analyzeScreenshot(imageBase64, additionalContext = '') {
    throw new Error('analyzeScreenshot must be implemented by subclass');
  }

  /**
   * Generate text from a prompt.
   * @param {string} prompt - The prompt to generate from
   * @param {object} options - Optional generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    throw new Error('generateText must be implemented by subclass');
  }

  /**
   * Generate multimodal content (text + images).
   * @param {Array} parts - Array of content parts (text and image data)
   * @param {object} options - Optional generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateMultimodal(parts, options = {}) {
    throw new Error('generateMultimodal must be implemented by subclass');
  }

  // ========================================================================
  // SHARED UTILITY METHODS
  // ========================================================================

  /**
   * Suggest responses based on current context.
   * @param {string} context - Current situation description
   * @returns {Promise<string>} - Suggested responses
   */
  async suggestResponse(context) {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.SUGGEST_RESPONSE(this.providerName, contextString, context);
    const result = await this.generateText(prompt);
    return result;
  }

  /**
   * Generate meeting notes from conversation history.
   * @returns {Promise<string>} - Formatted meeting notes
   */
  async generateMeetingNotes() {
    if (this.conversationHistory.length === 0) {
      return 'No conversation history to summarize.';
    }

    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.MEETING_NOTES(this.providerName, contextString);
    const result = await this.generateText(prompt);
    return result;
  }

  /**
   * Generate a professional follow-up email.
   * @returns {Promise<string>} - Follow-up email content
   */
  async generateFollowUpEmail() {
    if (this.conversationHistory.length === 0) {
      return 'No conversation history to create email from.';
    }

    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.FOLLOW_UP_EMAIL(this.providerName, contextString);
    const result = await this.generateText(prompt);
    return result;
  }

  /**
   * Answer a specific question with context.
   * @param {string} question - The question to answer
   * @returns {Promise<string>} - Answer to the question
   */
  async answerQuestion(question) {
    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.ANSWER_QUESTION(this.providerName, contextString, question);

    const result = await this.generateText(prompt);
    this.addToHistory('user', question);
    this.addToHistory('assistant', result);
    return result;
  }

  /**
   * Get conversation insights and analysis.
   * @returns {Promise<string>} - Insights and analysis
   */
  async getConversationInsights() {
    if (this.conversationHistory.length === 0) {
      return 'Not enough conversation data for insights.';
    }

    const { PROMPTS } = require('./prompts');
    const contextString = this.getContextString();
    const prompt = PROMPTS.INSIGHTS(this.providerName, contextString);
    const result = await this.generateText(prompt);
    return result;
  }

  // ========================================================================
  // TOKEN & RATE LIMIT MANAGEMENT
  // ========================================================================

  /**
   * Check and reset daily token limit if needed.
   */
  checkAndResetDailyLimit() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now - this.lastResetTime >= dayInMs) {
      console.log(`[${this.providerName}] Resetting daily token count`);
      this.dailyTokenCount = 0;
      this.lastResetTime = now;
    }
  }

  /**
   * Estimate token count for text.
   * @param {string} text - Text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Wait for rate limit before making request.
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[${this.providerName}] Rate limit: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Check if we're within daily token limits.
   * @param {number} estimatedTokens - Estimated tokens for this request
   * @returns {boolean} - Whether request is within limits
   */
  isWithinTokenLimits(estimatedTokens) {
    this.checkAndResetDailyLimit();
    return (this.dailyTokenCount + estimatedTokens) <= this.maxDailyTokens;
  }

  /**
   * Update token count after request.
   * @param {number} tokens - Tokens used
   */
  updateTokenCount(tokens) {
    this.dailyTokenCount += tokens;
  }

  // ========================================================================
  // CONVERSATION HISTORY MANAGEMENT
  // ========================================================================

  /**
   * Add entry to conversation history.
   * @param {string} role - Role (user, assistant, system)
   * @param {string} content - Message content
   */
  addToHistory(role, content) {
    this.conversationHistory.push({ role, content, timestamp: Date.now() });

    // Keep only recent history to avoid token overflow
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history as formatted string.
   * @returns {string} - Formatted conversation history
   */
  getContextString() {
    return this.conversationHistory
      .map(entry => `${entry.role}: ${entry.content}`)
      .join('\n\n');
  }

  /**
   * Get conversation history as array.
   * @returns {Array} - Conversation history array
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  // ========================================================================
  // RETRY LOGIC
  // ========================================================================

  /**
   * Execute request with retry logic.
   * @param {Function} requestFn - Async function to execute
   * @param {number} retryCount - Current retry count
   * @returns {Promise<*>} - Result of the request
   */
  async executeWithRetry(requestFn, retryCount = 0) {
    try {
      await this.waitForRateLimit();
      return await requestFn();
    } catch (error) {
      console.error(`[${this.providerName}] Request error (attempt ${retryCount + 1}):`, error.message);

      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const backoffTime = Math.pow(2, retryCount) * 2000;
        console.log(`[${this.providerName}] Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return await this.executeWithRetry(requestFn, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable.
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether error is retryable
   */
  isRetryableError(error) {
    const retryablePatterns = [
      '429', // Rate limit
      '500', // Server error
      '502', // Bad gateway
      '503', // Service unavailable
      '504', // Gateway timeout
      'RATE_LIMIT',
      'ECONNRESET',
      'ETIMEDOUT',
      'network',
      'timeout'
    ];

    return retryablePatterns.some(pattern => 
      error.message?.toLowerCase().includes(pattern.toLowerCase()) ||
      error.code?.includes(pattern)
    );
  }

  // ========================================================================
  // PROVIDER INFO
  // ========================================================================

  /**
   * Get provider information.
   * @returns {object} - Provider info object
   */
  getProviderInfo() {
    return {
      name: this.providerName,
      dailyTokensUsed: this.dailyTokenCount,
      dailyTokenLimit: this.maxDailyTokens,
      historyLength: this.conversationHistory.length
    };
  }
}

module.exports = AIServiceBase;
