/**
 * Smart Reply Suggestions
 * Generates contextual reply options for emails, similar to Superhuman's instant reply chips.
 */
const SmartReply = {
  /**
   * Generate reply suggestions for an email.
   * @param {AIProvider} provider
   * @param {{from: string, subject: string, body: string}} email
   * @param {object} [opts]
   * @param {number} [opts.count=3] - Number of suggestions
   * @param {string} [opts.userName] - User's name for personalization
   * @returns {Promise<Array<{label: string, body: string, tone: string}>>}
   */
  async suggest(provider, email, opts = {}) {
    const count = opts.count || 3;
    const nameCtx = opts.userName ? `\nYour name: ${opts.userName}` : '';

    const raw = await provider.chat([
      {
        role: 'system',
        content: `You generate smart email reply suggestions. Output ONLY a JSON array of objects:
[{"label": "short 2-4 word label for chip", "body": "full reply text", "tone": "professional|friendly|brief"}]
Generate exactly ${count} distinct replies with different tones/approaches.`
      },
      {
        role: 'user',
        content: `Generate reply suggestions for this email:${nameCtx}

From: ${email.from}
Subject: ${email.subject}

${email.body}`
      }
    ], { temperature: 0.8, max_tokens: 768 });

    try {
      const suggestions = JSON.parse(raw);
      return suggestions.slice(0, count);
    } catch (e) {
      console.error('[SPH] Smart reply parse error:', e);
      return [];
    }
  },

  /**
   * Expand a short reply idea into a full email.
   * @param {AIProvider} provider
   * @param {string} shortReply - Brief reply idea (e.g., "yes, sounds good")
   * @param {{from: string, subject: string, body: string}} originalEmail
   * @returns {Promise<string>}
   */
  async expand(provider, shortReply, originalEmail) {
    const raw = await provider.chat([
      {
        role: 'system',
        content: 'You expand short reply ideas into full, well-written email replies. Output ONLY the reply text.'
      },
      {
        role: 'user',
        content: `Expand this short reply into a full email response:

Short reply: "${shortReply}"

Original email from ${originalEmail.from}:
Subject: ${originalEmail.subject}
${originalEmail.body}`
      }
    ], { temperature: 0.6, max_tokens: 512 });

    return raw;
  },

  /**
   * Render reply suggestion chips below an email.
   * @param {HTMLElement} container - Where to insert the chips
   * @param {Array} suggestions
   * @param {Function} onSelect - Called with the selected suggestion
   */
  renderChips(container, suggestions, onSelect) {
    const existing = container.querySelector('.sph-reply-chips');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'sph-reply-chips';

    const header = document.createElement('span');
    header.className = 'sph-reply-chips-label';
    header.textContent = '\u26A1 Smart Replies';
    wrapper.appendChild(header);

    suggestions.forEach(suggestion => {
      const chip = document.createElement('button');
      chip.className = 'sph-reply-chip';
      chip.textContent = suggestion.label;
      chip.title = suggestion.body.substring(0, 100) + '...';
      chip.dataset.tone = suggestion.tone;
      chip.addEventListener('click', () => onSelect(suggestion));
      wrapper.appendChild(chip);
    });

    // "Write my own..." chip
    const customChip = document.createElement('button');
    customChip.className = 'sph-reply-chip sph-reply-chip-custom';
    customChip.textContent = '+ Custom reply...';
    customChip.addEventListener('click', async () => {
      const idea = window.prompt('Type a short reply idea and AI will expand it:');
      if (idea) {
        onSelect({ label: 'Custom', body: idea, tone: 'custom', needsExpansion: true });
      }
    });
    wrapper.appendChild(customChip);

    container.appendChild(wrapper);
  }
};
