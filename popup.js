(() => {
  'use strict';

  let currentTab = null;
  let normalizedUrl = '';

  // ── Utilities ──────────────────────────────────────────────────────────────

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      let href = u.href;
      if (href.endsWith('/')) href = href.slice(0, -1);
      return href;
    } catch {
      return url;
    }
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function countFields(profile) {
    return (profile.forms || []).reduce((sum, f) => sum + (f.fields || []).length, 0);
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  let statusTimer = null;

  function showStatus(msg, type = 'success') {
    const bar = document.getElementById('status-bar');
    bar.textContent = msg;
    bar.className = `status-bar ${type}`;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      bar.className = 'status-bar hidden';
    }, 3500);
  }

  // ── Storage helpers ────────────────────────────────────────────────────────

  async function loadProfiles() {
    return new Promise(resolve => {
      chrome.storage.local.get(normalizedUrl, data => {
        resolve((data[normalizedUrl] && data[normalizedUrl].profiles) || {});
      });
    });
  }

  async function saveProfiles(profiles) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [normalizedUrl]: { profiles } }, resolve);
    });
  }

  // ── Message helpers ────────────────────────────────────────────────────────

  function sendToContent(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(currentTab.id, msg, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── UI rendering ───────────────────────────────────────────────────────────

  function renderProfiles(profiles) {
    const list = document.getElementById('profile-list');
    const empty = document.getElementById('no-profiles');
    const fillBtn = document.getElementById('btn-fill');
    list.innerHTML = '';

    const keys = Object.keys(profiles);
    if (keys.length === 0) {
      empty.style.display = '';
      fillBtn.disabled = true;
      return;
    }

    empty.style.display = 'none';
    fillBtn.disabled = false;

    keys.sort((a, b) => {
      const ta = profiles[a].savedAt || 0;
      const tb = profiles[b].savedAt || 0;
      return tb - ta;
    });

    for (const key of keys) {
      const profile = profiles[key];
      const li = document.createElement('li');
      li.className = 'profile-item';

      const info = document.createElement('div');
      info.className = 'profile-info';

      const name = document.createElement('span');
      name.className = 'profile-name';
      name.textContent = key === 'default' ? 'Default' : key;

      const meta = document.createElement('span');
      meta.className = 'profile-meta';
      meta.textContent = `${countFields(profile)} fields · saved ${formatDate(profile.savedAt)}`;

      info.appendChild(name);
      info.appendChild(meta);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete';
      delBtn.title = 'Delete this profile';
      delBtn.textContent = '×';
      delBtn.dataset.profileKey = key;

      li.appendChild(info);
      li.appendChild(delBtn);
      list.appendChild(li);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSave() {
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const response = await sendToContent({ action: 'SCAN_FORMS' });

      if (!response || !response.ok) {
        throw new Error(response?.error || 'No response from page');
      }

      const forms = response.forms;
      const totalFields = forms.reduce((s, f) => s + f.fields.length, 0);

      if (totalFields === 0) {
        showStatus('No fillable fields found on this page.', 'error');
        return;
      }

      const profiles = await loadProfiles();
      profiles['default'] = {
        savedAt: Date.now(),
        forms
      };
      await saveProfiles(profiles);
      renderProfiles(profiles);
      showStatus(`Saved ${totalFields} field${totalFields === 1 ? '' : 's'}.`, 'success');
    } catch (err) {
      showStatus(`Cannot access this page: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Form';
    }
  }

  async function handleFill() {
    const btn = document.getElementById('btn-fill');
    btn.disabled = true;
    btn.textContent = 'Filling…';

    try {
      const profiles = await loadProfiles();
      const profile = profiles['default'];

      if (!profile) {
        showStatus('No saved data for this page.', 'error');
        return;
      }

      const response = await sendToContent({
        action: 'FILL_FORMS',
        payload: { forms: profile.forms }
      });

      if (!response || !response.ok) {
        throw new Error(response?.error || 'No response from page');
      }

      const { filled, skipped } = response;
      const msg = skipped > 0
        ? `Filled ${filled} field${filled === 1 ? '' : 's'} (${skipped} skipped).`
        : `Filled ${filled} field${filled === 1 ? '' : 's'}.`;
      showStatus(msg, 'success');
    } catch (err) {
      showStatus(`Cannot access this page: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Fill Form';
    }
  }

  async function handleDelete(profileKey) {
    const profiles = await loadProfiles();
    delete profiles[profileKey];
    await saveProfiles(profiles);
    renderProfiles(profiles);
    showStatus('Profile deleted.', 'success');
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    const tabs = await new Promise(resolve =>
      chrome.tabs.query({ active: true, currentWindow: true }, resolve)
    );

    currentTab = tabs[0];
    if (!currentTab) return;

    normalizedUrl = normalizeUrl(currentTab.url || '');

    const urlEl = document.getElementById('current-url');
    urlEl.textContent = normalizedUrl;
    urlEl.title = normalizedUrl;

    // Disable on chrome:// and extension pages
    if (
      currentTab.url.startsWith('chrome://') ||
      currentTab.url.startsWith('chrome-extension://') ||
      currentTab.url.startsWith('about:')
    ) {
      document.getElementById('btn-save').disabled = true;
      document.getElementById('btn-fill').disabled = true;
      showStatus('FillFast cannot run on this page.', 'error');
      return;
    }

    const profiles = await loadProfiles();
    renderProfiles(profiles);
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('btn-save').addEventListener('click', handleSave);
    document.getElementById('btn-fill').addEventListener('click', handleFill);

    document.getElementById('profile-list').addEventListener('click', e => {
      const delBtn = e.target.closest('.btn-delete');
      if (delBtn) {
        handleDelete(delBtn.dataset.profileKey);
      }
    });
  });
})();
