/**
 * BearBox Background Service Worker (Manifest V3)
 *
 * Coordinates extension lifecycle, messaging, tab updates, and badge display.
 */

import { getScripts, getSettings, isHostnameDisabled } from '../services/storage';
import { getMatchingScriptsForUrl, extractHostname } from '../services/matcher';

console.log('[BearBox Service Worker] Initialized.');

function getManagerUrl(query?: string): string {
  const manifest = chrome.runtime.getManifest();
  const page = manifest.options_ui?.page || 'manager.html';
  const target = query ? `${page}?${query}` : page;
  return chrome.runtime.getURL(target);
}

// Initialize extension on install / reload
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[BearBox Service Worker] onInstalled event:', details.reason);
  if (details.reason === 'install') {
    // Open manager on first install to welcome user
    chrome.tabs.create({ url: getManagerUrl() });
  }

  // Inject content script into any eligible tabs already open
  if (chrome.scripting && chrome.tabs) {
    try {
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      const manifest = chrome.runtime.getManifest();
      const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0] || 'dist/content.js';

      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [contentScriptFile]
          }).catch(() => {
            // Tab might be restricted or busy
          });
        }
      }
    } catch (e) {
      console.warn('[BearBox Service Worker] Could not inject existing tabs:', e);
    }
  }
});

// Listen for SPA route changes via webNavigation API (e.g. Next.js on ChatGPT)
if (chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // Filter for main frame navigations
    if (details.frameId === 0) {
      updateTabBadge(details.tabId, details.url);
      chrome.tabs.sendMessage(details.tabId, {
        type: 'ROUTE_CHANGED',
        url: details.url
      }).catch(() => {
        // Tab might not have content script listener yet
      });
    }
  });
}

// Update extension icon badge count for the active tab
async function updateTabBadge(tabId: number, url?: string) {
  if (!url || !url.startsWith('http')) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  try {
    const hostname = extractHostname(url);
    const [settings, isSiteDisabled] = await Promise.all([
      getSettings(),
      isHostnameDisabled(hostname)
    ]);

    if (!settings.enabledGlobally || isSiteDisabled) {
      chrome.action.setBadgeText({ tabId, text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#94a3b8' });
      return;
    }

    const scripts = await getScripts();
    const matching = getMatchingScriptsForUrl(url, scripts);

    if (matching.length > 0) {
      chrome.action.setBadgeText({ tabId, text: String(matching.length) });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (err) {
    console.error('[BearBox Service Worker] Failed to update tab badge:', err);
  }
}

// Listen for tab URL updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBadge(tabId, tab.url);
  }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateTabBadge(activeInfo.tabId, tab.url);
  } catch (err) {
    // Tab might have closed
  }
});

// Handle incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_MANAGER') {
    const query = message.rule ? `newRule=${encodeURIComponent(message.rule)}` : undefined;
    chrome.tabs.create({ url: getManagerUrl(query) });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'REFRESH_BADGE') {
    if (sender.tab?.id) {
      updateTabBadge(sender.tab.id, sender.tab.url);
    }
    sendResponse({ success: true });
    return true;
  }

  return false;
});
