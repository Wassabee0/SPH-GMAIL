/**
 * SPH Gmail - Popup script.
 */
(async function () {
  // Load status
  const data = await browser.storage.local.get('sph_settings');
  const settings = data.sph_settings || {};

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (settings.provider) {
    statusDot.className = 'status-dot status-active';
    statusText.textContent = `${settings.provider} — ${settings.model || 'default model'}`;
  }

  // Send action to active Gmail tab
  async function sendToGmail(action) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('mail.google.com')) {
      await browser.tabs.sendMessage(tab.id, { action });
      window.close();
    } else {
      // Open Gmail if not on it
      browser.tabs.create({ url: 'https://mail.google.com' });
      window.close();
    }
  }

  document.getElementById('btn-triage').addEventListener('click', () => sendToGmail('runTriage'));
  document.getElementById('btn-summarize').addEventListener('click', () => sendToGmail('runSummarize'));
  document.getElementById('btn-replies').addEventListener('click', () => sendToGmail('runSmartReply'));
  document.getElementById('btn-settings').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
})();
