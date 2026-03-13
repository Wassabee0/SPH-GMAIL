class AnthropicProvider extends AIProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async chat(messages, opts = {}) {
    // Convert from OpenAI-style messages to Anthropic format
    let system = '';
    const filtered = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n' : '') + msg.content;
      } else {
        filtered.push({ role: msg.role, content: msg.content });
      }
    }

    const body = {
      model: this.model,
      max_tokens: opts.max_tokens ?? 1024,
      messages: filtered
    };
    if (system) body.system = system;

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.content.map(b => b.text).join('').trim();
  }
}
