/**
 * AI Email Summaries
 * Generates concise summaries of individual emails and full threads.
 */
const Summarize = {
  _cache: new Map(),

  /**
   * Summarize a single email.
   * @param {AIProvider} provider
   * @param {{from: string, subject: string, body: string}} email
   * @returns {Promise<{summary: string, keyPoints: string[], actionItems: string[]}>}
   */
  async summarizeEmail(provider, email) {
    const cacheKey = `email:${email.subject}:${email.from}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const raw = await provider.chat([
      {
        role: 'system',
        content: `You summarize emails concisely. Output ONLY valid JSON:
{"summary": "1-2 sentence summary", "keyPoints": ["point 1", "point 2"], "actionItems": ["action 1"]}`
      },
      {
        role: 'user',
        content: `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`
      }
    ], { temperature: 0.3, max_tokens: 300 });

    const result = JSON.parse(raw);
    this._cache.set(cacheKey, result);
    return result;
  },

  /**
   * Summarize a full email thread.
   * @param {AIProvider} provider
   * @param {Array<{from: string, date: string, body: string}>} messages
   * @param {string} subject
   * @returns {Promise<{summary: string, keyPoints: string[], actionItems: string[], timeline: string[]}>}
   */
  async summarizeThread(provider, messages, subject) {
    const cacheKey = `thread:${subject}:${messages.length}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const thread = messages.map((m, i) =>
      `--- Message ${i + 1} ---\nFrom: ${m.from}\nDate: ${m.date}\n\n${m.body}`
    ).join('\n\n');

    const raw = await provider.chat([
      {
        role: 'system',
        content: `You summarize email threads. Output ONLY valid JSON:
{"summary": "2-3 sentence summary of the entire conversation", "keyPoints": ["key point 1"], "actionItems": ["action 1"], "timeline": ["brief chronological event 1"]}`
      },
      {
        role: 'user',
        content: `Subject: ${subject}\n\n${thread}`
      }
    ], { temperature: 0.3, max_tokens: 512 });

    const result = JSON.parse(raw);
    this._cache.set(cacheKey, result);
    return result;
  },

  /**
   * Render a summary card into a container element.
   * @param {HTMLElement} container
   * @param {object} summaryData
   */
  renderSummaryCard(container, summaryData) {
    const existing = container.querySelector('.sph-summary-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'sph-summary-card';

    let html = `<div class="sph-summary-header">\u2728 AI Summary</div>`;
    html += `<p class="sph-summary-text">${this._escapeHtml(summaryData.summary)}</p>`;

    if (summaryData.keyPoints?.length) {
      html += `<div class="sph-summary-section"><strong>Key Points</strong><ul>`;
      summaryData.keyPoints.forEach(p => {
        html += `<li>${this._escapeHtml(p)}</li>`;
      });
      html += `</ul></div>`;
    }

    if (summaryData.actionItems?.length) {
      html += `<div class="sph-summary-section"><strong>Action Items</strong><ul class="sph-action-items">`;
      summaryData.actionItems.forEach(a => {
        html += `<li>${this._escapeHtml(a)}</li>`;
      });
      html += `</ul></div>`;
    }

    if (summaryData.timeline?.length) {
      html += `<div class="sph-summary-section"><strong>Timeline</strong><ol>`;
      summaryData.timeline.forEach(t => {
        html += `<li>${this._escapeHtml(t)}</li>`;
      });
      html += `</ol></div>`;
    }

    card.innerHTML = html;
    container.prepend(card);
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  clearCache() {
    this._cache.clear();
  }
};
