// ============================================================================
// PROMPTS MODULE - Provider-Specific Prompt Templates
// ============================================================================
// Centralized prompt management with provider-optimized variations.
// Each provider (Gemini, OpenAI, Anthropic) has tailored prompts that
// leverage their specific strengths and formatting preferences.
// ============================================================================

const geminiPrompts = require('./gemini-prompts');
const openaiPrompts = require('./openai-prompts');
const anthropicPrompts = require('./anthropic-prompts');

// Provider name constants
const PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OPENROUTER: 'openrouter'
};

/**
 * Get prompts for a specific provider.
 * @param {string} provider - Provider name (gemini, openai, anthropic, openrouter)
 * @returns {object} - Provider-specific prompts object
 */
function getProviderPrompts(provider) {
  switch (provider?.toLowerCase()) {
    case PROVIDERS.OPENAI:
    case PROVIDERS.OPENROUTER:
      // OpenRouter uses OpenAI-compatible format
      return openaiPrompts;
    case PROVIDERS.ANTHROPIC:
      return anthropicPrompts;
    case PROVIDERS.GEMINI:
    default:
      return geminiPrompts;
  }
}

// ============================================================================
// UNIFIED PROMPT INTERFACE
// ============================================================================
// These functions automatically select the right prompt based on provider.

const PROMPTS = {
  /**
   * Screenshot analysis prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @param {string} additionalContext - Additional context
   * @returns {string|object} - Formatted prompt
   */
  SCREENSHOT_ANALYSIS: (provider, contextString, additionalContext) => {
    const prompts = getProviderPrompts(provider);
    return prompts.SCREENSHOT_ANALYSIS(contextString, additionalContext);
  },

  /**
   * Response suggestion prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @param {string} context - Current situation
   * @returns {string|object} - Formatted prompt
   */
  SUGGEST_RESPONSE: (provider, contextString, context) => {
    const prompts = getProviderPrompts(provider);
    return prompts.SUGGEST_RESPONSE(contextString, context);
  },

  /**
   * Meeting notes generation prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @returns {string|object} - Formatted prompt
   */
  MEETING_NOTES: (provider, contextString) => {
    const prompts = getProviderPrompts(provider);
    return prompts.MEETING_NOTES(contextString);
  },

  /**
   * Follow-up email generation prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @returns {string|object} - Formatted prompt
   */
  FOLLOW_UP_EMAIL: (provider, contextString) => {
    const prompts = getProviderPrompts(provider);
    return prompts.FOLLOW_UP_EMAIL(contextString);
  },

  /**
   * Question answering prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @param {string} question - The question to answer
   * @returns {string|object} - Formatted prompt
   */
  ANSWER_QUESTION: (provider, contextString, question) => {
    const prompts = getProviderPrompts(provider);
    return prompts.ANSWER_QUESTION(contextString, question);
  },

  /**
   * Conversation insights prompt.
   * @param {string} provider - Provider name
   * @param {string} contextString - Conversation context
   * @returns {string|object} - Formatted prompt
   */
  INSIGHTS: (provider, contextString) => {
    const prompts = getProviderPrompts(provider);
    return prompts.INSIGHTS(contextString);
  }
};

module.exports = {
  PROMPTS,
  PROVIDERS,
  getProviderPrompts,
  geminiPrompts,
  openaiPrompts,
  anthropicPrompts
};
