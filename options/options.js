/**
 * SPH Gmail - Options page logic.
 */
(function () {
  const providerSelect = document.getElementById('provider');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusEl = document.getElementById('status');

  // ── Provider field visibility ────────────────────────────────────

  providerSelect.addEventListener('change', () => {
    document.querySelectorAll('.provider-fields').forEach(el => el.classList.remove('active'));
    const fields = document.getElementById(`fields-${providerSelect.value}`);
    if (fields) fields.classList.add('active');
  });

  // ── Model preset chips ──────────────────────────────────────────

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const modelInput = chip.closest('.form-group').querySelector('input');
      if (modelInput) modelInput.value = chip.dataset.model;
    });
  });

  // ── Load saved settings ─────────────────────────────────────────

  async function loadSettings() {
    const data = await browser.storage.local.get('sph_settings');
    const s = data.sph_settings || {};

    if (s.provider) {
      providerSelect.value = s.provider;
      providerSelect.dispatchEvent(new Event('change'));
    }

    // Fill provider-specific fields
    if (s.apiKey) {
      const keyInput = document.getElementById(`${s.provider}-key`);
      if (keyInput) keyInput.value = s.apiKey;
    }
    if (s.model) {
      const modelInput = document.getElementById(`${s.provider}-model`);
      if (modelInput) modelInput.value = s.model;
    }
    if (s.baseUrl) {
      const urlInput = document.getElementById(`${s.provider}-url`);
      if (urlInput) urlInput.value = s.baseUrl;
    }

    // Features
    if (s.features) {
      Object.keys(s.features).forEach(key => {
        const cb = document.getElementById(`feat-${key}`);
        if (cb) cb.checked = s.features[key];
      });
    }

    // Personalization
    if (s.userName) {
      document.getElementById('user-name').value = s.userName;
    }
  }

  // ── Gather current settings ─────────────────────────────────────

  function gatherSettings() {
    const prov = providerSelect.value;
    if (!prov) return null;

    const settings = {
      provider: prov,
      apiKey: document.getElementById(`${prov}-key`)?.value || '',
      model: document.getElementById(`${prov}-model`)?.value || '',
      baseUrl: document.getElementById(`${prov}-url`)?.value || '',
      userName: document.getElementById('user-name').value || '',
      features: {
        triage: document.getElementById('feat-triage').checked,
        compose: document.getElementById('feat-compose').checked,
        summarize: document.getElementById('feat-summarize').checked,
        smartReply: document.getElementById('feat-smartReply').checked
      }
    };

    return settings;
  }

  // ── Save ────────────────────────────────────────────────────────

  saveBtn.addEventListener('click', async () => {
    const settings = gatherSettings();
    if (!settings) {
      showStatus('Please select a provider', 'error');
      return;
    }

    await browser.storage.local.set({ sph_settings: settings });
    showStatus('Settings saved! Reload Gmail to apply changes.', 'success');
  });

  // ── Test Connection ─────────────────────────────────────────────

  testBtn.addEventListener('click', async () => {
    const settings = gatherSettings();
    if (!settings) {
      showStatus('Please select a provider first', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    showStatus('', '');

    try {
      const result = await browser.runtime.sendMessage({
        action: 'testProvider',
        settings
      });

      if (result.ok) {
        showStatus('Connection successful! Your AI provider is working.', 'success');
      } else {
        showStatus(`Connection failed: ${result.error}`, 'error');
      }
    } catch (e) {
      showStatus(`Test error: ${e.message}`, 'error');
    }

    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  });

  // ── Status display ──────────────────────────────────────────────

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  // ── Init ────────────────────────────────────────────────────────

  loadSettings();
})();
