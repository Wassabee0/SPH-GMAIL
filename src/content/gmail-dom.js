/**
 * Gmail DOM helpers.
 * Provides utilities for reading and manipulating the Gmail web interface.
 */
const GmailDOM = {
  /**
   * Wait for Gmail to fully load.
   * @returns {Promise<void>}
   */
  async waitForLoad() {
    return new Promise(resolve => {
      const check = () => {
        if (document.querySelector('[role="main"]') || document.querySelector('.AO')) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  },

  /**
   * Get visible inbox email rows.
   * @returns {Array<{rowEl: HTMLElement, from: string, subject: string, snippet: string}>}
   */
  getInboxRows() {
    const rows = document.querySelectorAll('tr.zA');
    return Array.from(rows).map(row => {
      const fromEl = row.querySelector('.yX.xY .yW span[email], .yX.xY .bA4 span[email], .yX.xY span.bA4, .yX.xY .yW');
      const subjectEl = row.querySelector('.bog .bqe, .bog, .xT .y6 span');
      const snippetEl = row.querySelector('.y2');

      return {
        rowEl: row,
        from: fromEl?.getAttribute('email') || fromEl?.textContent?.trim() || 'Unknown',
        subject: subjectEl?.textContent?.trim() || '(no subject)',
        snippet: snippetEl?.textContent?.trim() || ''
      };
    });
  },

  /**
   * Detect if we're viewing a single email/thread.
   * @returns {boolean}
   */
  isThreadView() {
    return !!document.querySelector('.ade, .nH .if, h2.hP');
  },

  /**
   * Get the currently open email thread data.
   * @returns {{subject: string, messages: Array<{from: string, date: string, body: string, element: HTMLElement}>}}
   */
  getThreadData() {
    const subject = document.querySelector('h2.hP')?.textContent?.trim() || '';

    const messageEls = document.querySelectorAll('.gs .ii.gt .a3s.aiL, .gs .ii.gt');
    const senderEls = document.querySelectorAll('.gE.iv.gt span[email], .gD');
    const dateEls = document.querySelectorAll('.gH .g3, .gH .gK span');

    const messages = [];
    messageEls.forEach((el, i) => {
      messages.push({
        from: senderEls[i]?.getAttribute('email') || senderEls[i]?.textContent?.trim() || 'Unknown',
        date: dateEls[i]?.getAttribute('title') || dateEls[i]?.textContent?.trim() || '',
        body: el.innerText?.trim() || '',
        element: el
      });
    });

    return { subject, messages };
  },

  /**
   * Get the last/most-recent message in a thread.
   * @returns {{from: string, subject: string, body: string, element: HTMLElement} | null}
   */
  getLastMessage() {
    const thread = this.getThreadData();
    if (!thread.messages.length) return null;
    const last = thread.messages[thread.messages.length - 1];
    return { ...last, subject: thread.subject };
  },

  /**
   * Observe Gmail for compose windows opening.
   * @param {Function} callback - Called with compose element when one opens
   * @returns {MutationObserver}
   */
  observeCompose(callback) {
    const observer = new MutationObserver(() => {
      const composeWindows = document.querySelectorAll('.M9, .dw .nH');
      composeWindows.forEach(el => {
        if (!el.dataset.sphCompose) {
          el.dataset.sphCompose = 'true';
          callback(el);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  },

  /**
   * Observe for navigation changes in Gmail (inbox → thread, etc.).
   * @param {Function} callback - Called on view change
   * @returns {MutationObserver}
   */
  observeNavigation(callback) {
    let lastHash = location.hash;

    const check = () => {
      if (location.hash !== lastHash) {
        lastHash = location.hash;
        setTimeout(() => callback(lastHash), 300);
      }
    };

    window.addEventListener('hashchange', check);

    // Also watch for DOM changes that signal navigation
    const observer = new MutationObserver(() => {
      check();
    });

    const main = document.querySelector('[role="main"]');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });
    }

    return observer;
  },

  /**
   * Open the reply box for the current thread.
   */
  openReply() {
    const replyBtn = document.querySelector('[data-tooltip="Reply"], .amn .ams');
    if (replyBtn) replyBtn.click();
  },

  /**
   * Set text in the reply compose box.
   * @param {string} text
   */
  setReplyText(text) {
    const replyBody = document.querySelector('.Am.Al.editable, [role="textbox"][g_editable="true"]');
    if (replyBody) {
      replyBody.innerHTML = text.replace(/\n/g, '<br>');
      replyBody.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
};
