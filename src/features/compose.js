/**
 * AI Email Compose
 * Drafts full emails from short prompts, rewrites existing drafts,
 * and adjusts tone/length on demand.
 */
const Compose = {
  TONES: ['professional', 'friendly', 'casual', 'formal', 'concise', 'empathetic'],

  /**
   * Generate a full email from a short description.
   * @param {AIProvider} provider
   * @param {object} params
   * @param {string} params.prompt - What the email should say
   * @param {string} [params.to] - Recipient name/email
   * @param {string} [params.context] - Prior thread for context
   * @param {string} [params.tone] - Desired tone
   * @returns {Promise<{subject: string, body: string}>}
   */
  async draft(provider, { prompt, to, context, tone }) {
    const systemMsg = `You are an expert email writer. Write clear, well-structured emails.
Output ONLY valid JSON: {"subject": "...", "body": "..."}
The body should use plain text with line breaks. Do not include greetings/sign-offs unless the user's prompt implies them.`;

    let userMsg = `Write an email based on this description: ${prompt}`;
    if (to) userMsg += `\nRecipient: ${to}`;
    if (tone) userMsg += `\nTone: ${tone}`;
    if (context) userMsg += `\nThread context:\n${context}`;

    try {
      const raw = await provider.chat([
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg }
      ], { temperature: 0.7, max_tokens: 1024 });

      return JSON.parse(raw);
    } catch (e) {
      console.error('[SPH] Compose draft error:', e);
      throw new Error('Failed to generate email draft');
    }
  },

  /**
   * Rewrite/improve an existing email draft.
   * @param {AIProvider} provider
   * @param {string} original - The current draft text
   * @param {string} instruction - How to improve it (e.g., "make it shorter", "more formal")
   * @returns {Promise<string>} The rewritten email body
   */
  async rewrite(provider, original, instruction) {
    const raw = await provider.chat([
      {
        role: 'system',
        content: 'You are an expert email editor. Rewrite the email as instructed. Output ONLY the rewritten email text, nothing else.'
      },
      {
        role: 'user',
        content: `Instruction: ${instruction}\n\nOriginal email:\n${original}`
      }
    ], { temperature: 0.6, max_tokens: 1024 });

    return raw;
  },

  /**
   * Auto-complete the current sentence or paragraph while typing.
   * @param {AIProvider} provider
   * @param {string} partialText - What the user has typed so far
   * @param {string} [context] - Thread context
   * @returns {Promise<string>} Suggested completion text
   */
  async autocomplete(provider, partialText, context) {
    let prompt = `Continue writing this email naturally. Output ONLY the continuation text (do not repeat what's already written).\n\nEmail so far:\n${partialText}`;
    if (context) prompt += `\n\nThread context:\n${context}`;

    const raw = await provider.chat([
      { role: 'system', content: 'You complete email drafts. Output only the new text to append.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.5, max_tokens: 256 });

    return raw;
  },

  /**
   * Inject compose UI toolbar into a Gmail compose window.
   * @param {HTMLElement} composeEl - The Gmail compose container
   * @param {AIProvider} provider
   */
  injectToolbar(composeEl, provider) {
    if (composeEl.querySelector('.sph-compose-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'sph-compose-toolbar';

    // AI Draft button
    const draftBtn = document.createElement('button');
    draftBtn.className = 'sph-btn sph-btn-primary';
    draftBtn.innerHTML = '\u2728 AI Draft';
    draftBtn.title = 'Generate email from a prompt';
    draftBtn.addEventListener('click', () => this._showDraftDialog(composeEl, provider));

    // Rewrite button
    const rewriteBtn = document.createElement('button');
    rewriteBtn.className = 'sph-btn';
    rewriteBtn.innerHTML = '\u270F Rewrite';
    rewriteBtn.title = 'Rewrite/improve current draft';
    rewriteBtn.addEventListener('click', () => this._showRewriteDialog(composeEl, provider));

    // Tone selector
    const toneSelect = document.createElement('select');
    toneSelect.className = 'sph-tone-select';
    toneSelect.innerHTML = '<option value="">Adjust tone...</option>' +
      this.TONES.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
    toneSelect.addEventListener('change', async () => {
      if (!toneSelect.value) return;
      const body = this._getComposeBody(composeEl);
      if (!body) return;
      toneSelect.disabled = true;
      try {
        const rewritten = await this.rewrite(provider, body, `Change the tone to ${toneSelect.value}`);
        this._setComposeBody(composeEl, rewritten);
      } catch (e) {
        console.error('[SPH] Tone rewrite error:', e);
      }
      toneSelect.value = '';
      toneSelect.disabled = false;
    });

    // Autocomplete button
    const autoBtn = document.createElement('button');
    autoBtn.className = 'sph-btn';
    autoBtn.innerHTML = '\u21E5 Complete';
    autoBtn.title = 'Auto-complete current sentence (Tab)';
    autoBtn.addEventListener('click', async () => {
      const body = this._getComposeBody(composeEl);
      if (!body) return;
      autoBtn.disabled = true;
      try {
        const completion = await this.autocomplete(provider, body);
        this._setComposeBody(composeEl, body + completion);
      } catch (e) {
        console.error('[SPH] Autocomplete error:', e);
      }
      autoBtn.disabled = false;
    });

    toolbar.append(draftBtn, rewriteBtn, toneSelect, autoBtn);

    // Insert toolbar above the compose body
    const bodyEl = composeEl.querySelector('[role="textbox"][g_editable="true"], .Am.Al.editable');
    if (bodyEl) {
      bodyEl.parentElement.insertBefore(toolbar, bodyEl);
    }
  },

  _getComposeBody(composeEl) {
    const bodyEl = composeEl.querySelector('[role="textbox"][g_editable="true"], .Am.Al.editable');
    return bodyEl ? bodyEl.innerText.trim() : '';
  },

  _setComposeBody(composeEl, text) {
    const bodyEl = composeEl.querySelector('[role="textbox"][g_editable="true"], .Am.Al.editable');
    if (bodyEl) {
      bodyEl.innerHTML = text.replace(/\n/g, '<br>');
      bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },

  async _showDraftDialog(composeEl, provider) {
    const prompt = window.prompt('Describe the email you want to write:');
    if (!prompt) return;

    const toneChoice = window.prompt('Tone? (professional, friendly, casual, formal, concise, empathetic) — leave blank for default:');

    try {
      const { subject, body } = await this.draft(provider, {
        prompt,
        tone: toneChoice || 'professional'
      });

      // Set subject if empty
      const subjectEl = composeEl.querySelector('input[name="subjectbox"]');
      if (subjectEl && !subjectEl.value) {
        subjectEl.value = subject;
        subjectEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      this._setComposeBody(composeEl, body);
    } catch (e) {
      alert('Failed to generate draft: ' + e.message);
    }
  },

  async _showRewriteDialog(composeEl, provider) {
    const body = this._getComposeBody(composeEl);
    if (!body) {
      alert('Write something first, then use Rewrite to improve it.');
      return;
    }
    const instruction = window.prompt('How should I improve this email? (e.g., "make it shorter", "more formal", "add a call to action")');
    if (!instruction) return;

    try {
      const rewritten = await this.rewrite(provider, body, instruction);
      this._setComposeBody(composeEl, rewritten);
    } catch (e) {
      alert('Failed to rewrite: ' + e.message);
    }
  }
};
