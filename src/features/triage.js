/**
 * Triage & Priority Inbox
 * Analyzes emails and assigns priority labels: Important, FYI, Notification, or Low Priority.
 * Re-orders the inbox view so high-priority emails appear first.
 */
const Triage = {
  PRIORITY_LEVELS: {
    IMPORTANT: { label: 'Important', color: '#d93025', icon: '!', score: 4 },
    ACTION_REQUIRED: { label: 'Action Required', color: '#e37400', icon: '\u25B6', score: 3 },
    FYI: { label: 'FYI', color: '#1a73e8', icon: 'i', score: 2 },
    NOTIFICATION: { label: 'Notification', color: '#5f6368', icon: '\u266A', score: 1 },
    LOW: { label: 'Low Priority', color: '#9aa0a6', icon: '\u2193', score: 0 }
  },

  _cache: new Map(),

  /**
   * Classify a single email's priority.
   * @param {AIProvider} provider
   * @param {{from: string, subject: string, snippet: string}} email
   * @returns {Promise<{level: string, reason: string}>}
   */
  async classify(provider, email) {
    const cacheKey = `${email.from}|${email.subject}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const prompt = `You are an email triage assistant. Classify the priority of this email.

From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet}

Respond with EXACTLY one JSON object (no markdown, no code fences):
{"level": "IMPORTANT|ACTION_REQUIRED|FYI|NOTIFICATION|LOW", "reason": "one sentence why"}

Rules:
- IMPORTANT: emails from real people that need a reply or decision
- ACTION_REQUIRED: tasks, deadlines, requests with a clear action
- FYI: informational emails worth reading but no action needed
- NOTIFICATION: automated alerts, receipts, shipping updates
- LOW: newsletters, promotions, mass mailings`;

    try {
      const raw = await provider.chat([
        { role: 'system', content: 'You are an email triage assistant. Output only valid JSON.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, max_tokens: 100 });

      const result = JSON.parse(raw);
      if (!this.PRIORITY_LEVELS[result.level]) result.level = 'FYI';
      this._cache.set(cacheKey, result);
      return result;
    } catch (e) {
      console.error('[SPH] Triage classify error:', e);
      return { level: 'FYI', reason: 'Could not classify' };
    }
  },

  /**
   * Classify a batch of emails for inbox triage.
   * @param {AIProvider} provider
   * @param {Array} emails - Array of {from, subject, snippet, rowEl}
   * @returns {Promise<Array>}
   */
  async triageBatch(provider, emails) {
    if (emails.length === 0) return [];

    // For efficiency, classify up to 10 in a single prompt
    if (emails.length <= 10) {
      return this._triageBatchSingle(provider, emails);
    }

    // Larger batches: chunk into groups of 10
    const results = [];
    for (let i = 0; i < emails.length; i += 10) {
      const chunk = emails.slice(i, i + 10);
      const chunkResults = await this._triageBatchSingle(provider, chunk);
      results.push(...chunkResults);
    }
    return results;
  },

  async _triageBatchSingle(provider, emails) {
    const emailList = emails.map((e, i) =>
      `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet}`
    ).join('\n');

    const prompt = `Classify each email's priority level. Respond with ONLY a JSON array (no markdown):

${emailList}

For each email, output: {"index": <number>, "level": "IMPORTANT|ACTION_REQUIRED|FYI|NOTIFICATION|LOW", "reason": "brief reason"}

Return an array of these objects.`;

    try {
      const raw = await provider.chat([
        { role: 'system', content: 'You are an email triage assistant. Output only valid JSON arrays.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, max_tokens: 512 });

      const results = JSON.parse(raw);
      return results.map((r, i) => ({
        email: emails[r.index ? r.index - 1 : i],
        level: this.PRIORITY_LEVELS[r.level] ? r.level : 'FYI',
        reason: r.reason || ''
      }));
    } catch (e) {
      console.error('[SPH] Batch triage error:', e);
      return emails.map(email => ({ email, level: 'FYI', reason: 'Classification unavailable' }));
    }
  },

  /**
   * Add a priority badge to an email row element.
   * @param {HTMLElement} rowEl
   * @param {string} level
   * @param {string} reason
   */
  addBadge(rowEl, level, reason) {
    if (rowEl.querySelector('.sph-priority-badge')) return;

    const info = this.PRIORITY_LEVELS[level];
    const badge = document.createElement('span');
    badge.className = 'sph-priority-badge';
    badge.title = reason;
    badge.style.cssText = `
      background: ${info.color}; color: white; font-size: 10px; font-weight: 600;
      padding: 1px 6px; border-radius: 3px; margin-right: 6px; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 3px; vertical-align: middle;
    `;
    badge.textContent = `${info.icon} ${info.label}`;

    // Insert before the subject/snippet area
    const subjectCell = rowEl.querySelector('.bog, .bqe, [role="link"]');
    if (subjectCell) {
      subjectCell.insertBefore(badge, subjectCell.firstChild);
    }
  },

  clearCache() {
    this._cache.clear();
  }
};
