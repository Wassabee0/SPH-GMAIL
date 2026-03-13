/**
 * Creates the correct AI provider based on saved settings.
 */
const ProviderFactory = {
  _providers: {
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    gemini: GeminiProvider,
    ollama: OllamaProvider
  },

  create(settings) {
    const Cls = this._providers[settings.provider];
    if (!Cls) throw new Error(`Unknown provider: ${settings.provider}`);
    return new Cls(settings);
  },

  /** Load settings from browser storage and create a provider. */
  async fromStorage() {
    const data = await browser.storage.local.get('sph_settings');
    const settings = data.sph_settings;
    if (!settings || !settings.provider) {
      throw new Error('SPH Gmail not configured. Open extension settings to choose an AI provider.');
    }
    return this.create(settings);
  }
};
