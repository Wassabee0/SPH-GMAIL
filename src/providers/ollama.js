class OllamaProvider extends AIProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3';
  }

  async chat(messages, opts = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.7,
          num_predict: opts.max_tokens ?? 1024
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.message.content.trim();
  }
}
