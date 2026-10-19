/**
 * BearBox Content Script Entry Point
 *
 * Runs on matching web pages:
 * - Detects active URL and SPA route changes
 * - Evaluates website matching rules against enabled scripts
 * - Injects/updates/removes the floating BearBox icon and panel in Shadow DOM
 * - Coordinates automatic script execution on matching pages
 * - Syncs in real time with storage changes
 */

import { getScripts, getSettings, isHostnameDisabled, getFormConfigs, subscribeToStorageChanges } from '../services/storage';
import { getMatchingScriptsForUrl, getMatchingFormConfigsForUrl, extractHostname } from '../services/matcher';
import { executionRegistry } from '../services/executor';
import { FloatingUI } from './FloatingUI';

class ContentScriptController {
  private floatingUI: FloatingUI | null = null;
  private currentUrl = '';
  private isProcessing = false;
  private _urlCheckInterval: number | null = null;

  public async start() {
    console.log('[BearBox Content Script] Starting on:', window.location.href);

    // Initial evaluation
    await this.evaluateCurrentPage();

    // Setup SPA navigation interceptors
    this.setupSpaNavigation();

    // Real-time synchronization with storage changes (from popup or manager)
    subscribeToStorageChanges(async () => {
      console.log('[BearBox Content Script] Storage changed; re-evaluating page.');
      await this.evaluateCurrentPage();
    });
  }

  /**
   * Evaluates the current page URL against user scripts, form configs, and settings.
   */
  public async evaluateCurrentPage() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const url = window.location.href;
      this.currentUrl = url;
      const hostname = extractHostname(url);

      const [settings, siteDisabled, scripts, formConfigs] = await Promise.all([
        getSettings(),
        isHostnameDisabled(hostname),
        getScripts(),
        getFormConfigs()
      ]);

      // If globally disabled or disabled for this specific hostname, hide icon
      if (!settings.enabledGlobally || siteDisabled || !settings.showIconOnMatchingPages) {
        this.destroyFloatingUI();
        return;
      }

      // Filter matching enabled scripts and form configs
      const matchingScripts = getMatchingScriptsForUrl(url, scripts);
      const matchingFormConfigs = getMatchingFormConfigsForUrl(url, formConfigs);

      // If no matching scripts and no matching form configs, remove/hide icon
      if (matchingScripts.length === 0 && matchingFormConfigs.length === 0) {
        this.destroyFloatingUI();
        return;
      }

      // Matching tools exist: Ensure floating icon is mounted
      if (!this.floatingUI) {
        this.floatingUI = new FloatingUI({
          scripts: matchingScripts,
          formConfigs: matchingFormConfigs,
          hostname,
          url,
          onOpenManager: () => this.openManagerPage(),
          onRefresh: () => this.evaluateCurrentPage()
        });
        await this.floatingUI.mount();
      } else {
        this.floatingUI.updateOptions({
          scripts: matchingScripts,
          formConfigs: matchingFormConfigs,
          hostname,
          url
        });
      }

      // Coordinate automatic script execution (once per navigation cycle)
      for (const script of matchingScripts) {
        if (script.executionMode === 'automatic' && script.enabled) {
          executionRegistry.executeScript(script, {
            url,
            hostname,
            trigger: 'automatic'
          }).catch((err) => {
            console.error(`[BearBox] Error running automatic script "${script.name}":`, err);
          });
        }
      }

      // Notify background to update tab badge if available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {
          // ignore if background worker is inactive
        });
      }
    } catch (err) {
      console.error('[BearBox Content Script] Evaluation error:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private destroyFloatingUI() {
    if (this.floatingUI) {
      this.floatingUI.unmount();
      this.floatingUI = null;
    }
  }

  private openManagerPage() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_MANAGER' });
    } else {
      window.open('manager.html', '_blank');
    }
  }

  /**
   * Sets up listeners for Single Page Application (SPA) route changes
   * without creating duplicate icons or missing client-side navigations.
   */
  private setupSpaNavigation() {
    // 1. Listen to browser history events
    window.addEventListener('popstate', () => this.handleUrlChange());
    window.addEventListener('hashchange', () => this.handleUrlChange());

    // 2. Intercept History API (pushState & replaceState used by ChatGPT / Next.js)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      // Allow current call stack to complete before re-evaluating
      setTimeout(() => this.handleUrlChange(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleUrlChange(), 0);
    };

    // 3. Listen for background service worker navigation events (webNavigation API)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'ROUTE_CHANGED') {
          console.log('[BearBox Content Script] Received ROUTE_CHANGED message:', message.url);
          this.handleUrlChange(message.url);
        }
      });
    }

    // 4. Polling fallback to catch frameworks that mutate location directly
    this._urlCheckInterval = window.setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        this.handleUrlChange();
      }
    }, 800);
  }

  public stop() {
    if (this._urlCheckInterval) {
      clearInterval(this._urlCheckInterval);
      this._urlCheckInterval = null;
    }
    this.destroyFloatingUI();
  }

  private handleUrlChange(newUrl?: string) {
    const targetUrl = newUrl || window.location.href;
    if (targetUrl !== this.currentUrl) {
      console.log('[BearBox] SPA Route changed to:', targetUrl);
      this.currentUrl = targetUrl;
      // Reset session cache for auto-exec scripts on new route
      executionRegistry.resetSessionCache();
      this.evaluateCurrentPage();
    }
  }
}

// Guard against duplicate injection on the same document
const INJECTION_GUARD_KEY = '__BEARBOX_CONTENT_SCRIPT_INITIALIZED__';
if ((window as unknown as Record<string, boolean>)[INJECTION_GUARD_KEY]) {
  console.log('[BearBox] Content script already initialized on this page.');
} else {
  (window as unknown as Record<string, boolean>)[INJECTION_GUARD_KEY] = true;
  const controller = new ContentScriptController();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => controller.start());
  } else {
    controller.start();
  }
}

