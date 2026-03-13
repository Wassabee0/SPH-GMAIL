/**
 * Base AI provider interface.
 * All providers implement chat() which accepts messages and returns a string response.
 */
class AIProvider {
  constructor(config) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.baseUrl = config.baseUrl || '';
  }

  /**
   * Send a chat completion request.
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} opts - Optional overrides (temperature, max_tokens, etc.)
   * @returns {Promise<string>} The assistant's reply text.
   */
  async chat(messages, opts = {}) {
    throw new Error('chat() must be implemented by subclass');
  }

  /** Verify the provider configuration works. */
  async testConnection() {
    try {
      const reply = await this.chat(
        [{ role: 'user', content: 'Reply with OK' }],
        { max_tokens: 5 }
      );
      return { ok: true, reply };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
