/**
 * SPH Gmail - Main content script entry point.
 * Orchestrates all AI features on the Gmail page.
 */
(function SPHGmail() {
  'use strict';

  // Immediate proof-of-life — this runs before anything async
  console.log('[SPH Gmail] Content script loaded on:', window.location.href);

  const LOG_PREFIX = '[SPH Gmail]';
  let provider = null;
  let settings = {};

  // ── Initialization ──────────────────────────────────────────────

  async function init() {
    console.log(`${LOG_PREFIX} Initializing...`);

    // Show a small toast so the user KNOWS the extension is alive
    showToast('SPH Gmail loaded — initializing...');

    try {
      const data = await browser.storage.local.get('sph_settings');
      settings = data.sph_settings || {};
      console.log(`${LOG_PREFIX} Settings loaded:`, settings.provider || 'none');
    } catch (e) {
      console.error(`${LOG_PREFIX} Could not read storage:`, e);
      settings = {};
    }

    if (!settings.provider) {
      console.log(`${LOG_PREFIX} No provider configured. Showing setup prompt.`);
      showSetupBanner();
      showToast('Configure your AI provider to get started');
      return;
    }

    try {
      provider = ProviderFactory.create(settings);
      console.log(`${LOG_PREFIX} Provider ready: ${settings.provider} (${settings.model || 'default'})`);
      showToast(`Connected to ${settings.provider}`);
    } catch (e) {
      console.error(`${LOG_PREFIX} Failed to create provider:`, e);
      showSetupBanner();
      return;
    }

    try {
      await GmailDOM.waitForLoad();
      console.log(`${LOG_PREFIX} Gmail DOM ready, attaching features.`);
    } catch (e) {
      console.error(`${LOG_PREFIX} Gmail DOM wait failed:`, e);
    }

    injectSidebar();
    attachFeatures();
    observeChanges();

    console.log(`${LOG_PREFIX} Fully initialized.`);
  }

  // ── Toast notification (visual proof extension is running) ──────

  function showToast(message, duration) {
    duration = duration || 3000;
    const existing = document.getElementById('sph-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'sph-toast';
    toast.textContent = '\u26A1 ' + message;
    toast.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#4f46e5', 'color:white', 'padding:10px 20px', 'border-radius:8px',
      'font-family:system-ui,sans-serif', 'font-size:13px', 'font-weight:500',
      'z-index:999999', 'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
      'transition:opacity 0.3s', 'opacity:1'
    ].join(';');

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ── Feature Attachment ──────────────────────────────────────────

  function attachFeatures() {
    const featureFlags = settings.features || {
      triage: true,
      compose: true,
      summarize: true,
      smartReply: true
    };

    if (featureFlags.triage) runTriage();
    if (featureFlags.summarize && GmailDOM.isThreadView()) runSummarize();
    if (featureFlags.smartReply && GmailDOM.isThreadView()) runSmartReply();
  }

  // ── Triage ──────────────────────────────────────────────────────

  async function runTriage() {
    const rows = GmailDOM.getInboxRows();
    if (rows.length === 0) {
      console.log(`${LOG_PREFIX} No inbox rows found to triage.`);
      return;
    }

    console.log(`${LOG_PREFIX} Triaging ${rows.length} emails...`);
    showToast(`Triaging ${rows.length} emails...`);

    try {
      const results = await Triage.triageBatch(provider, rows);
      results.forEach(({ email, level, reason }) => {
        Triage.addBadge(email.rowEl, level, reason);
      });
      console.log(`${LOG_PREFIX} Triage complete.`);
      showToast('Triage complete');
    } catch (e) {
      console.error(`${LOG_PREFIX} Triage error:`, e);
      showToast('Triage failed: ' + e.message, 5000);
    }
  }

  // ── Summarize ───────────────────────────────────────────────────

  async function runSummarize() {
    const thread = GmailDOM.getThreadData();
    if (!thread.messages.length) return;

    console.log(`${LOG_PREFIX} Summarizing thread: ${thread.subject}`);

    try {
      const container = document.querySelector('.ade, .nH .if') || document.querySelector('h2.hP')?.parentElement;
      if (!container) return;

      let loadingEl = container.querySelector('.sph-summary-loading');
      if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.className = 'sph-summary-loading';
        loadingEl.innerHTML = '<div class="sph-loading-spinner"></div> Generating summary...';
        container.prepend(loadingEl);
      }

      let summaryData;
      if (thread.messages.length === 1) {
        const msg = thread.messages[0];
        summaryData = await Summarize.summarizeEmail(provider, {
          from: msg.from,
          subject: thread.subject,
          body: msg.body
        });
      } else {
        summaryData = await Summarize.summarizeThread(provider, thread.messages, thread.subject);
      }

      loadingEl.remove();
      Summarize.renderSummaryCard(container, summaryData);
    } catch (e) {
      console.error(`${LOG_PREFIX} Summarize error:`, e);
      const loadingEl = document.querySelector('.sph-summary-loading');
      if (loadingEl) loadingEl.remove();
      showToast('Summary failed: ' + e.message, 5000);
    }
  }

  // ── Smart Reply ─────────────────────────────────────────────────

  async function runSmartReply() {
    const lastMsg = GmailDOM.getLastMessage();
    if (!lastMsg) return;

    console.log(`${LOG_PREFIX} Generating smart replies...`);

    try {
      const suggestions = await SmartReply.suggest(provider, lastMsg, {
        userName: settings.userName
      });

      const threadContainer = lastMsg.element?.closest('.gs') || document.querySelector('.ade, .nH .if');
      if (!threadContainer) return;

      SmartReply.renderChips(threadContainer, suggestions, async (suggestion) => {
        GmailDOM.openReply();
        await new Promise(r => setTimeout(r, 500));

        let replyText = suggestion.body;
        if (suggestion.needsExpansion) {
          replyText = await SmartReply.expand(provider, suggestion.body, lastMsg);
        }

        GmailDOM.setReplyText(replyText);
      });
    } catch (e) {
      console.error(`${LOG_PREFIX} Smart reply error:`, e);
      showToast('Smart replies failed: ' + e.message, 5000);
    }
  }

  // ── Compose Observer ────────────────────────────────────────────

  function observeChanges() {
    const featureFlags = settings.features || { compose: true, triage: true, summarize: true, smartReply: true };

    if (featureFlags.compose) {
      GmailDOM.observeCompose(composeEl => {
        console.log(`${LOG_PREFIX} Compose window detected, injecting toolbar.`);
        Compose.injectToolbar(composeEl, provider);
      });
    }

    GmailDOM.observeNavigation((hash) => {
      console.log(`${LOG_PREFIX} Navigation: ${hash}`);
      setTimeout(() => attachFeatures(), 500);
    });
  }

  // ── Sidebar ─────────────────────────────────────────────────────

  function injectSidebar() {
    if (document.querySelector('.sph-sidebar-toggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'sph-sidebar-toggle';
    toggle.innerHTML = '\u26A1';
    toggle.title = 'SPH Gmail AI';
    toggle.addEventListener('click', () => toggleSidebar());
    document.body.appendChild(toggle);
  }

  function toggleSidebar() {
    let sidebar = document.querySelector('.sph-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('sph-sidebar-open');
      return;
    }

    sidebar = document.createElement('div');
    sidebar.className = 'sph-sidebar sph-sidebar-open';

    sidebar.innerHTML = `
      <div class="sph-sidebar-header">
        <span>\u26A1 SPH Gmail</span>
        <button class="sph-sidebar-close">\u2715</button>
      </div>
      <div class="sph-sidebar-content">
        <div class="sph-sidebar-status">
          <div class="sph-status-dot ${provider ? 'sph-status-active' : ''}"></div>
          <span>${provider ? 'Connected: ' + settings.provider + ' (' + (settings.model || 'default') + ')' : 'Not configured'}</span>
        </div>
        <div class="sph-sidebar-actions">
          <button class="sph-btn sph-btn-primary sph-sidebar-btn" data-action="triage">
            \uD83D\uDCCA Triage Inbox
          </button>
          <button class="sph-btn sph-sidebar-btn" data-action="summarize">
            \u2728 Summarize Thread
          </button>
          <button class="sph-btn sph-sidebar-btn" data-action="replies">
            \u26A1 Smart Replies
          </button>
          <button class="sph-btn sph-sidebar-btn" data-action="settings">
            \u2699 Settings
          </button>
        </div>
        <div class="sph-sidebar-log" id="sph-log"></div>
      </div>
    `;

    sidebar.querySelector('.sph-sidebar-close').addEventListener('click', () => {
      sidebar.classList.remove('sph-sidebar-open');
    });

    sidebar.querySelector('[data-action="triage"]').addEventListener('click', () => runTriage());
    sidebar.querySelector('[data-action="summarize"]').addEventListener('click', () => runSummarize());
    sidebar.querySelector('[data-action="replies"]').addEventListener('click', () => runSmartReply());
    sidebar.querySelector('[data-action="settings"]').addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'openOptions' });
    });

    document.body.appendChild(sidebar);
  }

  // ── Setup Banner ────────────────────────────────────────────────

  function showSetupBanner() {
    if (document.querySelector('.sph-setup-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'sph-setup-banner';
    banner.innerHTML = `
      <span>\u26A1 <strong>SPH Gmail</strong> — Configure your AI provider to get started</span>
      <button class="sph-btn sph-btn-primary" id="sph-open-settings">Open Settings</button>
      <button class="sph-banner-close">\u2715</button>
    `;

    banner.querySelector('#sph-open-settings').addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'openOptions' });
    });
    banner.querySelector('.sph-banner-close').addEventListener('click', () => {
      banner.remove();
    });

    document.body.prepend(banner);
  }

  // ── Listen for messages from popup ──────────────────────────────

  browser.runtime.onMessage.addListener((message) => {
    console.log(`${LOG_PREFIX} Received message:`, message.action);
    switch (message.action) {
      case 'runTriage': runTriage(); break;
      case 'runSummarize': runSummarize(); break;
      case 'runSmartReply': runSmartReply(); break;
    }
  });

  // ── Listen for settings changes ─────────────────────────────────

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sph_settings) {
      console.log(`${LOG_PREFIX} Settings changed, reinitializing...`);
      settings = changes.sph_settings.newValue || {};
      if (settings.provider) {
        try {
          provider = ProviderFactory.create(settings);
          showToast('Settings updated — now using ' + settings.provider);
        } catch (e) {
          console.error(`${LOG_PREFIX} Provider create error:`, e);
        }
      }
    }
  });

  // ── Keyboard Shortcuts ──────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      if (e.key === 'Tab' && e.target.isContentEditable && provider) {
        const composeEl = e.target.closest('.M9, .dw .nH');
        if (composeEl && composeEl.dataset.sphCompose) {
          e.preventDefault();
          const body = e.target.innerText.trim();
          if (body.length > 10) {
            Compose.autocomplete(provider, body).then(completion => {
              if (completion) {
                GmailDOM.setReplyText(body + completion);
              }
            });
          }
        }
      }
      return;
    }

    if (!provider) return;

    if (e.altKey && e.key === 't') { e.preventDefault(); runTriage(); }
    if (e.altKey && e.key === 's') { e.preventDefault(); runSummarize(); }
    if (e.altKey && e.key === 'r') { e.preventDefault(); runSmartReply(); }
    if (e.altKey && e.key === 'p') { e.preventDefault(); toggleSidebar(); }
  });

  // ── Start ───────────────────────────────────────────────────────

  // Wait for body to exist, then init
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
