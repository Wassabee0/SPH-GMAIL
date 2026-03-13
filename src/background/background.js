/**
 * SPH Gmail - Background script.
 * Handles extension-level events and messaging.
 */

// Open options page on install
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browser.runtime.openOptionsPage();
  }
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openOptions':
      browser.runtime.openOptionsPage();
      break;

    case 'getSettings':
      browser.storage.local.get('sph_settings').then(data => {
        sendResponse(data.sph_settings || {});
      });
      return true; // async

    case 'saveSettings':
      browser.storage.local.set({ sph_settings: message.settings }).then(() => {
        sendResponse({ ok: true });
      });
      return true;

    case 'testProvider':
      testProvider(message.settings).then(result => {
        sendResponse(result);
      });
      return true;
  }
});

/**
 * Test an AI provider connection from the background script context.
 */
async function testProvider(settings) {
  try {
    // Dynamically build the request based on provider
    const { provider, apiKey, model, baseUrl } = settings;
    let url, headers, body;

    switch (provider) {
      case 'openai': {
        url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        body = JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 5 });
        break;
      }
      case 'anthropic': {
        url = `${baseUrl || 'https://api.anthropic.com/v1'}/messages`;
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        body = JSON.stringify({ model: model || 'claude-sonnet-4-6', max_tokens: 5, messages: [{ role: 'user', content: 'Reply with OK' }] });
        break;
      }
      case 'gemini': {
        url = `${baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }], generationConfig: { maxOutputTokens: 5 } });
        break;
      }
      case 'ollama': {
        url = `${baseUrl || 'http://localhost:11434'}/api/chat`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ model: model || 'llama3', messages: [{ role: 'user', content: 'Reply with OK' }], stream: false });
        break;
      }
      default:
        return { ok: false, error: `Unknown provider: ${provider}` };
    }

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: `HTTP ${res.status}: ${err.error?.message || res.statusText}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
