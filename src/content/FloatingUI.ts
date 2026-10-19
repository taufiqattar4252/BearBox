/**
 * BearBox Floating UI (Shadow DOM Isolated Component)
 *
 * Implements:
 * - Shadow DOM style isolation
 * - Pointer events dragging with boundary clamping
 * - Saved position persistence and resize adaptation
 * - Distinguishing click vs drag
 * - Attached quick-action script panel
 * - Accessibility and reduced-motion support
 */

import { BearBoxScript } from '../types/script';
import { FormAutofillConfig, ParseRecordResult, AutofillSummary, AutofillFieldResult } from '../types/formConfig';
import { getIconPosition, saveIconPosition, toggleScriptEnabled, toggleFormConfigEnabled } from '../services/storage';
import { executionRegistry } from '../services/executor';
import { parseSourceRecord } from '../services/formParser';
import { fillFormFields, fillElement } from '../services/formFiller';
import { executeUserScript, reportToAutofillSummary } from '../services/scriptEngine';
import { fieldPicker, PickedFieldInfo } from '../services/fieldPicker';
import { BEARBOX_MASCOT_BASE64 } from './mascotData';

export interface FloatingUIOptions {
  scripts: BearBoxScript[];
  formConfigs?: FormAutofillConfig[];
  hostname: string;
  url: string;
  onOpenManager: () => void;
  onRefresh: () => void;
}

export class FloatingUI {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private iconButton: HTMLElement | null = null;
  private panel: HTMLElement | null = null;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialIconX = 0;
  private initialIconY = 0;
  private hasMovedSignificantly = false;

  private posX = 0;
  private posY = 0;
  private isPanelOpen = false;

  private options: FloatingUIOptions;
  private runningScriptId: string | null = null;
  private executionResults: Record<string, { success: boolean; message: string }> = {};

  private activeAutofillConfig: FormAutofillConfig | null = null;
  private activeAutofillScript: BearBoxScript | null = null;
  private activeParsedRecord: ParseRecordResult | null = null;
  private activeFillSummary: AutofillSummary | null = null;
  private autofillErrorMessage: string | null = null;
  private autofillRawText = '';

  constructor(options: FloatingUIOptions) {
    this.options = options;
  }

  public updateOptions(newOptions: Partial<FloatingUIOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.renderPanelContent();
  }

  public async mount() {
    // Prevent duplicate injection
    const existing = document.getElementById('bearbox-floating-host');
    if (existing) {
      this.container = existing;
      this.shadowRoot = existing.shadowRoot;
      this.render();
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'bearbox-floating-host';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      overflow: visible;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Attach open Shadow DOM
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Determine initial position
    await this.initPosition();

    // Render styles and DOM
    this.render();

    document.documentElement.appendChild(this.container);

    // Viewport resize handling
    window.addEventListener('resize', this.handleWindowResize);
  }

  public unmount() {
    window.removeEventListener('resize', this.handleWindowResize);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadowRoot = null;
  }

  private async initPosition() {
    const savedPos = await getIconPosition();
    const btnWidth = 68;
    const btnHeight = 59;
    const padding = 16;

    if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
      // If normalized percentage is available, adapt to current viewport
      if (savedPos.normalizedX !== undefined && savedPos.normalizedY !== undefined) {
        this.posX = Math.round(savedPos.normalizedX * window.innerWidth);
        this.posY = Math.round(savedPos.normalizedY * window.innerHeight);
      } else {
        this.posX = savedPos.x;
        this.posY = savedPos.y;
      }
    } else {
      // Default: Bottom-right corner with 24px margin
      this.posX = window.innerWidth - btnWidth - padding;
      this.posY = window.innerHeight - btnHeight - 80;
    }

    this.clampPosition();
  }

  private clampPosition() {
    const btnWidth = 68;
    const btnHeight = 59;
    const padding = 10;
    const minX = padding;
    const maxX = Math.max(minX, window.innerWidth - btnWidth - padding);
    const minY = padding;
    const maxY = Math.max(minY, window.innerHeight - btnHeight - padding);

    this.posX = Math.max(minX, Math.min(this.posX, maxX));
    this.posY = Math.max(minY, Math.min(this.posY, maxY));
  }

  private handleWindowResize = () => {
    this.clampPosition();
    this.updateIconPositionStyle();
    this.updatePanelPosition();
  };

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .bearbox-floating-btn {
          position: fixed;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: grab;
          display: inline-block;
          pointer-events: auto;
          user-select: none;
          touch-action: none;
          z-index: 2147483647;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease;
          filter: drop-shadow(0 6px 14px rgba(15, 23, 42, 0.35)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
        }

        .bearbox-floating-btn:hover {
          transform: scale(1.08) translateY(-3px);
          filter: drop-shadow(0 12px 22px rgba(15, 23, 42, 0.45)) drop-shadow(0 4px 8px rgba(15, 23, 42, 0.25));
        }

        .bearbox-floating-btn:active, .bearbox-floating-btn.is-dragging {
          cursor: grabbing;
          transform: scale(0.96);
          filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.28));
        }

        .bearbox-mascot-img {
          display: block;
          width: 68px;
          height: auto;
          aspect-ratio: 777 / 677;
          pointer-events: none;
          -webkit-user-drag: none;
          user-select: none;
        }

        .bearbox-badge-count {
          position: absolute;
          top: 2px;
          right: 2px;
          background-color: #2563eb;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          height: 18px;
          min-width: 18px;
          padding: 0 5px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid #ffffff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.25);
          pointer-events: none;
        }

        /* Floating Attached Panel */
        .bearbox-panel {
          position: fixed;
          width: 345px;
          max-height: 480px;
          background: #0f172a;
          border-radius: 14px;
          border: 1px solid #1e293b;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.65), 0 6px 14px -2px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          overflow: hidden;
          z-index: 2147483646;
          color: #f8fafc;
          font-size: 12.5px;
          line-height: 1.4;
          animation: bbFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes bbFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bearbox-floating-btn, .bearbox-panel {
            transition: none !important;
            animation: none !important;
          }
        }

        .bb-panel-header {
          padding: 10px 14px;
          background-color: #0d1322;
          border-bottom: 1px solid #1e293b;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bb-panel-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bb-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }

        .bb-close-btn:hover {
          color: #f8fafc;
          background: #1e293b;
        }

        .bb-panel-host {
          display: none !important;
        }

        .bb-script-list {
          padding: 10px;
          overflow-y: auto;
          max-height: 280px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bb-script-list::-webkit-scrollbar {
          width: 5px;
        }
        .bb-script-list::-webkit-scrollbar-track {
          background: #0b0f19;
        }
        .bb-script-list::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }

        .bb-script-card {
          padding: 8px 10px;
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        }

        .bb-script-card-header {
          display: none !important;
        }

        .bb-script-name {
          font-weight: 600;
          font-size: 12.5px;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bb-script-desc {
          font-size: 11px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bb-script-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bb-action-btn {
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 5px;
          border: 1px solid #334155;
          background: #1e293b;
          color: #f8fafc;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s, border-color 0.15s;
        }

        .bb-action-btn:hover {
          background: #334155;
          border-color: #475569;
        }

        .bb-action-btn.primary {
          background: #3b82f6;
          color: #ffffff;
          border-color: #3b82f6;
        }

        .bb-action-btn.primary:hover {
          background: #2563eb;
          border-color: #2563eb;
        }

        .bb-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bb-switch {
          position: relative;
          display: inline-block;
          width: 32px;
          height: 18px;
        }

        .bb-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .bb-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #334155;
          transition: 0.2s;
          border-radius: 18px;
        }

        .bb-slider:before {
          position: absolute;
          content: "";
          height: 12px;
          width: 12px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }

        input:checked + .bb-slider {
          background-color: #3b82f6;
        }

        input:checked + .bb-slider:before {
          transform: translateX(14px);
        }

        .bb-panel-footer {
          padding: 10px 14px;
          background-color: #0d1322;
          border-top: 1px solid #1e293b;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bb-footer-link {
          font-size: 11px;
          color: #60a5fa;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
        }

        .bb-footer-link:hover {
          text-decoration: underline;
          color: #93c5fd;
        }

        .bb-result-banner {
          font-size: 11px;
          padding: 5px 8px;
          border-radius: 4px;
          margin-top: 4px;
          word-break: break-all;
        }

        .bb-result-success {
          background-color: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .bb-result-error {
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .bb-section-title {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 6px 4px 2px 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bb-tool-tag {
          font-size: 9.5px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        /* Autofill Modal Overlay */
        .bb-autofill-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          pointer-events: auto;
        }

        .bb-autofill-modal {
          width: 100%;
          max-width: 560px;
          max-height: 88vh;
          background: #0f172a;
          border-radius: 14px;
          border: 1px solid #1e293b;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #f8fafc;
          font-size: 13px;
          animation: bbFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .bb-autofill-header {
          padding: 14px 18px;
          background-color: #0d1322;
          border-bottom: 1px solid #1e293b;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bb-autofill-body {
          padding: 16px 18px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: calc(88vh - 125px);
        }

        .bb-autofill-body::-webkit-scrollbar {
          width: 5px;
        }
        .bb-autofill-body::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }

        .bb-autofill-footer {
          padding: 12px 18px;
          background-color: #0d1322;
          border-top: 1px solid #1e293b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .bb-box {
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 12px;
        }

        .bb-preview-input {
          width: 100%;
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #f8fafc;
          padding: 6px 10px;
          font-size: 12px;
          font-family: inherit;
          box-sizing: border-box;
        }
        .bb-preview-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }

        .bb-paste-textarea {
          width: 100%;
          background: #090d16;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #f8fafc;
          padding: 8px 10px;
          font-size: 11.5px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
          min-height: 80px;
          resize: vertical;
          box-sizing: border-box;
        }
        .bb-paste-textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .bb-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #0f172a;
          border: 1px solid #3b82f6;
          color: #f8fafc;
          padding: 10px 18px;
          border-radius: 8px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7);
          font-size: 12.5px;
          z-index: 2147483647;
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: bbFadeIn 0.2s ease;
        }
      </style>

      <!-- Draggable Floating Mascot (Cut-out without box container) -->
      <button
        id="bearbox-btn"
        class="bearbox-floating-btn"
        aria-label="BearBox Tools"
        title="BearBox — Click to open tools, drag to reposition"
      >
        <img
          src="${BEARBOX_MASCOT_BASE64}"
          alt="BearBox Mascot"
          class="bearbox-mascot-img"
          draggable="false"
        />

        <span class="bearbox-badge-count" id="bearbox-badge">
          ${(this.options.scripts?.length || 0) + (this.options.formConfigs?.length || 0)}
        </span>
      </button>

      <!-- Attached Floating Script Panel -->
      <div id="bearbox-panel" class="bearbox-panel" style="display: none;">
        <!-- Panel header -->
        <div class="bb-panel-header">
          <div class="bb-panel-title">
            <img src="${BEARBOX_MASCOT_BASE64}" width="22" height="19" alt="BearBox" style="vertical-align: middle; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));" />
            BearBox Tools
          </div>
          <button id="bb-close-panel" class="bb-close-btn" title="Close panel">✕</button>
        </div>

        <!-- Current site indicator (hidden) -->
        <div class="bb-panel-host" style="display: none;">
          <span>Target: <strong>${this.options.hostname}</strong></span>
          <span>${(this.options.scripts?.length || 0) + (this.options.formConfigs?.length || 0)} active</span>
        </div>

        <!-- Tool and Script List Items -->
        <div id="bb-script-list" class="bb-script-list"></div>

        <!-- Footer -->
        <div class="bb-panel-footer">
          <button id="bb-pick-field-btn" class="bb-action-btn" style="padding: 3px 8px; font-size: 11px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">
            🎯 Pick Selector
          </button>
          <button id="bb-open-manager" class="bb-action-btn" style="border: none; color: #60a5fa; background: none; font-size: 11.5px; cursor: pointer; padding: 2px 6px;">
            Open Manager ↗
          </button>
        </div>
      </div>

      <!-- Container for Autofill Modal -->
      <div id="bb-autofill-container"></div>

      <!-- Toast Container -->
      <div id="bb-toast-container"></div>
    `;

    this.iconButton = this.shadowRoot.getElementById('bearbox-btn');
    this.panel = this.shadowRoot.getElementById('bearbox-panel');

    this.updateIconPositionStyle();
    this.setupEventListeners();
    this.renderPanelContent();
  }

  private updateIconPositionStyle() {
    if (!this.iconButton) return;
    this.iconButton.style.left = `${this.posX}px`;
    this.iconButton.style.top = `${this.posY}px`;
  }

  private updatePanelPosition() {
    if (!this.panel) return;

    const panelWidth = 345;
    const panelHeight = this.panel.offsetHeight || 180;
    const padding = 12;

    let targetLeft = this.posX - panelWidth - 12;
    // If not enough room on the left, position on the right of the mascot
    if (targetLeft < padding) {
      targetLeft = this.posX + 68 + 12;
    }
    // Clamp inside viewport
    if (targetLeft + panelWidth > window.innerWidth - padding) {
      targetLeft = window.innerWidth - panelWidth - padding;
    }
    targetLeft = Math.max(padding, targetLeft);

    let targetTop = this.posY - 40;
    // Clamp top and bottom
    if (targetTop + panelHeight > window.innerHeight - padding) {
      targetTop = window.innerHeight - panelHeight - padding;
    }
    targetTop = Math.max(padding, targetTop);

    this.panel.style.left = `${targetLeft}px`;
    this.panel.style.top = `${targetTop}px`;
  }

  private setupEventListeners() {
    if (!this.iconButton || !this.shadowRoot) return;

    // Pointer events for robust mouse/touch dragging
    this.iconButton.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);

    // Keyboard accessibility
    this.iconButton.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.togglePanel();
      }
    });

    // Close button
    const closeBtn = this.shadowRoot.getElementById('bb-close-panel');
    closeBtn?.addEventListener('click', () => {
      this.closePanel();
    });

    // Open Manager button
    const openManagerBtn = this.shadowRoot.getElementById('bb-open-manager');
    openManagerBtn?.addEventListener('click', () => {
      this.options.onOpenManager();
    });

    // Pick Selector button in panel footer
    const pickFieldBtn = this.shadowRoot.getElementById('bb-pick-field-btn');
    pickFieldBtn?.addEventListener('click', () => {
      this.startFieldPicker();
    });
  }

  private handlePointerDown = (e: PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;

    this.isDragging = true;
    this.hasMovedSignificantly = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.initialIconX = this.posX;
    this.initialIconY = this.posY;

    if (this.iconButton) {
      this.iconButton.classList.add('is-dragging');
      this.iconButton.setPointerCapture(e.pointerId);
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    if (Math.hypot(deltaX, deltaY) > 5) {
      this.hasMovedSignificantly = true;
    }

    this.posX = this.initialIconX + deltaX;
    this.posY = this.initialIconY + deltaY;

    this.clampPosition();
    this.updateIconPositionStyle();
    if (this.isPanelOpen) {
      this.updatePanelPosition();
    }
  };

  private handlePointerUp = async (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.iconButton) {
      this.iconButton.classList.remove('is-dragging');
      try {
        this.iconButton.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
    }

    if (this.hasMovedSignificantly) {
      // Save position to storage
      await saveIconPosition({
        x: this.posX,
        y: this.posY,
        normalizedX: this.posX / window.innerWidth,
        normalizedY: this.posY / window.innerHeight
      });
    } else {
      // Intentional click! Toggle panel
      this.togglePanel();
    }
  };

  private togglePanel() {
    this.isPanelOpen = !this.isPanelOpen;
    if (this.panel) {
      this.panel.style.display = this.isPanelOpen ? 'flex' : 'none';
      if (this.isPanelOpen) {
        this.updatePanelPosition();
      }
    }
  }

  public closePanel() {
    this.isPanelOpen = false;
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }

  private renderPanelContent() {
    if (!this.shadowRoot) return;

    // Update badge count
    const totalCount = (this.options.scripts?.length || 0) + (this.options.formConfigs?.length || 0);
    const badge = this.shadowRoot.getElementById('bearbox-badge');
    if (badge) {
      badge.textContent = String(totalCount);
    }

    const scriptListEl = this.shadowRoot.getElementById('bb-script-list');
    if (!scriptListEl) return;

    const forms = this.options.formConfigs || [];
    const scripts = this.options.scripts || [];

    if (forms.length === 0 && scripts.length === 0) {
      scriptListEl.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: #94a3b8;">
          <div style="font-weight: 600; color: #f8fafc; margin-bottom: 4px;">No Matching Tools</div>
          <div style="font-size: 11px; margin-bottom: 14px;">No active form mappings or scripts match this webpage.</div>
          <button id="bb-empty-pick-btn" class="bb-action-btn primary" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; font-size: 11.5px; margin: 0 auto; cursor: pointer;">
            🎯 Pick Field Selector
          </button>
        </div>
      `;

      const emptyPickBtn = scriptListEl.querySelector('#bb-empty-pick-btn');
      emptyPickBtn?.addEventListener('click', () => {
        this.startFieldPicker();
      });

      return;
    }

    scriptListEl.innerHTML = '';

    // Render Form Autofill (Tool 1) section if available
    if (forms.length > 0) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'bb-section-title';
      sectionTitle.innerHTML = `
        <span>Form Autofill</span>
        <span class="bb-tool-tag">TOOL 1</span>
      `;
      scriptListEl.appendChild(sectionTitle);

      for (const formConfig of forms) {
        const card = document.createElement('div');
        card.className = 'bb-script-card';
        card.title = `${formConfig.name} (${formConfig.mappingMode === 'script' ? 'Script' : `${formConfig.fields.length} Fields`})`;

        card.innerHTML = `
          <div class="bb-script-card-header">
            <div style="overflow: hidden;">
              <div class="bb-script-name">${escapeHtml(formConfig.name)}</div>
              ${formConfig.description ? `<div class="bb-script-desc">${escapeHtml(formConfig.description)}</div>` : ''}
            </div>
            <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${formConfig.mappingMode === 'script' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(59, 130, 246, 0.15)'
          }; color: ${formConfig.mappingMode === 'script' ? '#c084fc' : '#60a5fa'}; border: 1px solid ${formConfig.mappingMode === 'script' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(59, 130, 246, 0.3)'
          }; flex-shrink: 0;">
              ${formConfig.mappingMode === 'script' ? '⚡ Script' : `${formConfig.fields.length} Fields`}
            </span>
          </div>

          <div class="bb-script-actions">
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <button class="bb-action-btn primary bb-form-paste-fill-btn" data-form-id="${formConfig.id}" title="Directly fill form from clipboard (no popup)">
                📋 Paste &amp; Fill
              </button>
              <button class="bb-action-btn bb-autofill-btn" data-form-id="${formConfig.id}" title="Open review popup to edit values">
                ⚡ Autofill
              </button>
              <button class="bb-action-btn bb-pick-btn" data-form-id="${formConfig.id}" title="Pick target fields on this webpage">
                🎯 Pick
              </button>
            </div>

            <label class="bb-switch" title="${formConfig.enabled ? 'Enabled' : 'Disabled'}">
              <input type="checkbox" class="bb-toggle-form" data-form-id="${formConfig.id}" ${formConfig.enabled ? 'checked' : ''}/>
              <span class="bb-slider"></span>
            </label>
          </div>
        `;

        // Click Paste & Fill -> directly read clipboard & fill without modal popup
        const pasteFillBtn = card.querySelector('.bb-form-paste-fill-btn') as HTMLButtonElement;
        pasteFillBtn?.addEventListener('click', async () => {
          const originalText = pasteFillBtn.innerHTML;
          pasteFillBtn.innerHTML = '⏳ Filling...';
          pasteFillBtn.disabled = true;
          try {
            await this.directClipboardFill(formConfig);
          } finally {
            pasteFillBtn.innerHTML = originalText;
            pasteFillBtn.disabled = false;
          }
        });

        // Click Autofill -> open autofill preview modal
        const autofillBtn = card.querySelector('.bb-autofill-btn') as HTMLButtonElement;
        autofillBtn?.addEventListener('click', () => {
          this.openAutofillModal(formConfig);
        });

        // Click Pick Fields -> start visual picker
        const pickBtn = card.querySelector('.bb-pick-btn') as HTMLButtonElement;
        pickBtn?.addEventListener('click', () => {
          this.startFieldPicker(formConfig);
        });

        // Toggle form configuration enable/disable
        const toggleInput = card.querySelector('.bb-toggle-form') as HTMLInputElement;
        toggleInput?.addEventListener('change', async (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          await toggleFormConfigEnabled(formConfig.id, checked);
          this.options.onRefresh();
        });

        scriptListEl.appendChild(card);
      }
    }

    // Render Custom Scripts section if available
    if (scripts.length > 0) {
      if (forms.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'bb-section-title';
        divider.style.marginTop = '8px';
        divider.innerHTML = `
          <span>Custom Scripts</span>
          <span class="bb-tool-tag">${scripts.length}</span>
        `;
        scriptListEl.appendChild(divider);
      }

      for (const script of scripts) {
        const card = document.createElement('div');
        card.className = 'bb-script-card';
        card.title = `${script.name} (${script.executionMode === 'automatic' ? 'Auto' : 'Manual'})`;

        const isRunning = this.runningScriptId === script.id;
        const result = this.executionResults[script.id];

        card.innerHTML = `
          <div class="bb-script-card-header">
            <div style="overflow: hidden;">
              <div class="bb-script-name">${escapeHtml(script.name)}</div>
              ${script.description ? `<div class="bb-script-desc">${escapeHtml(script.description)}</div>` : ''}
            </div>
            <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${script.executionMode === 'automatic' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)'
          }; color: ${script.executionMode === 'automatic' ? '#fbbf24' : '#60a5fa'}; border: 1px solid ${script.executionMode === 'automatic' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'
          }; flex-shrink: 0;">
              ${script.executionMode === 'automatic' ? 'Auto' : 'Manual'}
            </span>
          </div>

          <div class="bb-script-actions">
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <button class="bb-action-btn primary bb-script-paste-fill-btn" data-script-id="${script.id}" title="Directly fill form from clipboard (no popup)">
                📋 Paste &amp; Fill
              </button>
              <button class="bb-action-btn bb-script-autofill-btn" data-script-id="${script.id}" title="Open review popup to edit values">
                ⚡ Autofill
              </button>
              <button class="bb-action-btn bb-pick-script-btn" data-script-id="${script.id}" title="Pick target fields on this webpage">
                🎯 Pick
              </button>
              <button class="bb-action-btn bb-run-btn" data-script-id="${script.id}" ${isRunning || !script.enabled ? 'disabled' : ''}>
                ${isRunning ? '⏳ Running...' : '▶ Run'}
              </button>
            </div>

            <label class="bb-switch" title="${script.enabled ? 'Enabled' : 'Disabled'}">
              <input type="checkbox" class="bb-toggle-script" data-script-id="${script.id}" ${script.enabled ? 'checked' : ''}/>
              <span class="bb-slider"></span>
            </label>
          </div>

          ${result
            ? `<div class="bb-result-banner ${result.success ? 'bb-result-success' : 'bb-result-error'}">
                  ${result.success ? '✓ ' : '✕ '} ${escapeHtml(result.message)}
                </div>`
            : ''
          }
        `;

        // Click Paste & Fill -> directly read clipboard & fill without modal popup
        const scriptPasteFillBtn = card.querySelector('.bb-script-paste-fill-btn') as HTMLButtonElement;
        scriptPasteFillBtn?.addEventListener('click', async () => {
          const originalText = scriptPasteFillBtn.innerHTML;
          scriptPasteFillBtn.innerHTML = '⏳ Filling...';
          scriptPasteFillBtn.disabled = true;
          try {
            await this.directClipboardFill(script);
          } finally {
            scriptPasteFillBtn.innerHTML = originalText;
            scriptPasteFillBtn.disabled = false;
          }
        });

        // Event listener for Autofill button
        const autofillBtn = card.querySelector('.bb-script-autofill-btn') as HTMLButtonElement;
        autofillBtn?.addEventListener('click', () => {
          this.openAutofillModal(script);
        });

        // Event listener for Pick button
        const pickScriptBtn = card.querySelector('.bb-pick-script-btn') as HTMLButtonElement;
        pickScriptBtn?.addEventListener('click', () => {
          this.startFieldPicker();
        });

        // Event listener for Run button
        const runBtn = card.querySelector('.bb-run-btn') as HTMLButtonElement;
        runBtn?.addEventListener('click', () => {
          this.handleManualRun(script);
        });

        // Event listener for toggle switch
        const toggleInput = card.querySelector('.bb-toggle-script') as HTMLInputElement;
        toggleInput?.addEventListener('change', async (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          await toggleScriptEnabled(script.id, checked);
          this.options.onRefresh();
        });

        scriptListEl.appendChild(card);
      }
    }
  }

  private async handleManualRun(script: BearBoxScript) {
    this.runningScriptId = script.id;
    this.renderPanelContent();

    try {
      const result = await executionRegistry.executeScript(script, {
        url: this.options.url,
        hostname: this.options.hostname,
        trigger: 'manual'
      });

      this.executionResults[script.id] = {
        success: result.success,
        message: result.success
          ? (typeof result.output === 'string' ? result.output : 'Execution successful.')
          : (result.error || 'Execution failed.')
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.executionResults[script.id] = {
        success: false,
        message: msg
      };
    } finally {
      this.runningScriptId = null;
      this.renderPanelContent();
    }
  }

  // ==========================================
  // Form Autofill Interactive Modal
  // ==========================================

  public openAutofillModal(target: FormAutofillConfig | BearBoxScript) {
    if ('fields' in target) {
      this.activeAutofillConfig = target;
      this.activeAutofillScript = null;
    } else {
      this.activeAutofillScript = target;
      this.activeAutofillConfig = null;
    }
    this.activeParsedRecord = null;
    this.activeFillSummary = null;
    this.autofillErrorMessage = null;
    this.autofillRawText = '';
    this.closePanel();
    this.renderAutofillModal();
  }

  public closeAutofillModal() {
    this.activeAutofillConfig = null;
    this.activeAutofillScript = null;
    this.activeParsedRecord = null;
    this.activeFillSummary = null;
    this.autofillErrorMessage = null;
    this.autofillRawText = '';
    const container = this.shadowRoot?.getElementById('bb-autofill-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  private renderAutofillModal() {
    if (!this.shadowRoot || (!this.activeAutofillConfig && !this.activeAutofillScript)) return;
    const container = this.shadowRoot.getElementById('bb-autofill-container');
    if (!container) return;

    const config = this.activeAutofillConfig;
    const script = this.activeAutofillScript;
    const targetName = config?.name || script?.name || 'Custom Form Autofill';
    const isScriptMode = Boolean(script || config?.mappingMode === 'script');
    const parsedRecord = this.activeParsedRecord;
    const fillSummary = this.activeFillSummary;

    // Determine list of fields to display in Step 2
    let fieldsToDisplay: {
      fieldId?: string;
      key: string;
      label: string;
      selector?: string;
      required?: boolean;
      type?: string;
      defaultValue?: string;
    }[] = [];

    if (isScriptMode) {
      if (parsedRecord?.allDetectedFields && parsedRecord.allDetectedFields.length > 0) {
        fieldsToDisplay = parsedRecord.allDetectedFields.map((df) => ({
          fieldId: df.fieldId,
          key: df.key,
          label: df.label,
          selector: df.selector || '',
          required: false,
          type: df.type || 'text'
        }));
      } else if (config) {
        fieldsToDisplay = config.fields;
      }
    } else if (config) {
      fieldsToDisplay = [...config.fields];
      if (parsedRecord?.allDetectedFields) {
        const existingKeys = new Set(config.fields.map((f) => f.key.toLowerCase()));
        for (const df of parsedRecord.allDetectedFields) {
          if (!existingKeys.has(df.key.toLowerCase())) {
            fieldsToDisplay.push({
              fieldId: df.fieldId,
              key: df.key,
              label: df.label,
              selector: df.selector || '',
              required: false,
              type: df.type || 'text'
            });
          }
        }
      }
    }

    // Check DOM matching status for each field
    const fieldStatuses = fieldsToDisplay.map((f) => {
      let elementFound = false;
      const sel = f.selector || (f as any).targetSelector || '';
      try {
        if (sel) {
          elementFound = Boolean(document.querySelector(sel));
        } else {
          // Intelligent locator fallback by ID, name, or label
          let el = document.getElementById(f.key) ||
            document.querySelector(`[name="${f.key}"]`) ||
            document.querySelector(`[name*="${f.key}"]`);

          if (!el && f.label) {
            const clean = f.label.toLowerCase().trim();
            const labels = Array.from(document.querySelectorAll('label'));
            for (const lbl of labels) {
              const txt = (lbl.textContent || '').toLowerCase().trim();
              if (txt.includes(clean) || clean.includes(txt.replace(/[*:]/g, '').trim())) {
                el = lbl.querySelector('input, select, textarea');
                if (el) break;
              }
            }
          }
          elementFound = Boolean(el);
        }
      } catch {
        elementFound = false;
      }
      const parsedItem = parsedRecord?.parsed
        ? (parsedRecord.parsed[f.key] || parsedRecord.parsed[f.label])
        : undefined;
      const parsedValue = parsedItem?.value ||
        (parsedRecord?.extractedPairs ? (parsedRecord.extractedPairs[f.key] || parsedRecord.extractedPairs[f.label]) : '') ||
        (f as any).defaultValue ||
        (f as any).value ||
        '';
      return {
        field: f,
        elementFound,
        parsedValue,
        isMissing: Boolean(config && config.mappingMode !== 'script' && f.required && !parsedValue),
        isValid: parsedItem ? parsedItem.isValid : true,
        validationError: parsedItem?.validationError
      };
    });

    const detectedCount = parsedRecord?.allDetectedFields && parsedRecord.allDetectedFields.length > 0
      ? parsedRecord.allDetectedFields.filter((p) => p.value && p.value.trim().length > 0).length
      : (parsedRecord?.parsed ? Object.values(parsedRecord.parsed).filter((p) => p && p.value && p.value.trim().length > 0).length : 0);

    container.innerHTML = `
      <div class="bb-autofill-overlay" id="bb-autofill-overlay">
        <div class="bb-autofill-modal">
          <!-- Header -->
          <div class="bb-autofill-header">
            <div>
              <div style="display: flex; alignItems: center; gap: 8px;">
                <span style="font-weight: 700; font-size: 14px; color: #f8fafc;">
                  ⚡ Custom Form Autofill
                </span>
                <span class="bb-tool-tag">${escapeHtml(targetName)}</span>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                Read clipboard record or paste text to map and fill fields.
              </div>
            </div>
            <button id="bb-close-autofill" class="bb-close-btn" title="Cancel & Close">✕</button>
          </div>

          <!-- Body -->
          <div class="bb-autofill-body">
            <!-- Step 1: Input Record Source -->
            <div class="bb-box">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">
                  Step 1: Record Source (Word, ChatGPT, Gemini, etc.)
                </span>
                <span style="font-size: 11px; color: #60a5fa;">Local & Private</span>
              </div>

              <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <button id="bb-read-clipboard-btn" class="bb-action-btn primary" style="padding: 7px 14px; font-size: 12px;">
                  📋 Read Clipboard
                </button>
                <span style="font-size: 11.5px; color: #94a3b8; align-self: center;">
                  (Explicit user action only)
                </span>
              </div>

              ${this.autofillErrorMessage
        ? `<div class="bb-result-banner bb-result-error" style="margin-bottom: 8px;">
                      ⚠️ ${escapeHtml(this.autofillErrorMessage)}
                    </div>`
        : ''
      }

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <textarea
                  id="bb-paste-input"
                  class="bb-paste-textarea"
                  placeholder="Or paste copied record here (Key: Value or Key = Value)..."
                >${escapeHtml(this.autofillRawText)}</textarea>

                <div style="display: flex; justify-content: flex-end;">
                  <button id="bb-parse-btn" class="bb-action-btn" style="padding: 5px 12px; font-size: 11.5px;">
                    Parse Pasted Text
                  </button>
                </div>
              </div>
            </div>

            <!-- Execution Result Banner if filled -->
            ${fillSummary
        ? `<div class="bb-box" style="background: ${fillSummary.filledCount && fillSummary.filledCount > 0 && fillSummary.failedCount === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)'}; border-color: ${fillSummary.filledCount && fillSummary.filledCount > 0 && fillSummary.failedCount === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'};">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="font-weight: 600; font-size: 13px; color: ${fillSummary.filledCount && fillSummary.filledCount > 0 && fillSummary.failedCount === 0 ? '#34d399' : '#fbbf24'};">
                        ${fillSummary.filledCount && fillSummary.filledCount > 0 && fillSummary.failedCount === 0 ? '✓ ' : '⚠️ '} ${fillSummary.message}
                      </div>
                      <span style="font-size: 11px; color: #cbd5e1;">
                        ${fillSummary.filledCount || 0} filled / ${fillSummary.totalFields || 0} total
                      </span>
                    </div>

                    ${(!fillSummary.filledCount || fillSummary.filledCount === 0) && fillSummary.failedCount === 0
          ? `<div style="font-size: 11.5px; color: #fde68a; margin-top: 6px; line-height: 1.4;">
                            💡 Note: The mapping script for this form has no instructions matching the pasted keys, and elements for these fields were not found in the DOM. Open BearBox Manager to customize the script, or check field selectors.
                          </div>`
          : ''
        }

                    ${fillSummary.failedCount > 0
          ? `<div style="font-size: 11.5px; color: #fca5a5; margin-top: 6px; line-height: 1.4;">
                            Unresolved: ${fillSummary.results
            .filter((r) => !r.success)
            .map((r) => `${r.fieldLabel} (${r.message})`)
            .join(', ')}
                          </div>`
          : ''
        }

                    <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
                      💡 Review the completed form on your webpage and click Submit manually. BearBox will never auto-submit forms.
                    </div>
                  </div>`
        : ''
      }

            <!-- Step 2: Live Parsed Fields & Editor -->
            <div class="bb-box">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">
                  Step 2: Review & Edit Parsed Values (${detectedCount} detected${isScriptMode ? ' • ⚡ Script Mapping' : ` / ${config?.fields.length || detectedCount} configured`})
                </span>
                ${!isScriptMode && parsedRecord?.missingRequiredKeys && parsedRecord.missingRequiredKeys.length > 0
        ? `<span style="font-size: 11px; color: #f87171; font-weight: 600;">
                        ⚠️ ${parsedRecord.missingRequiredKeys.length} required missing
                      </span>`
        : ''
      }
              </div>

              ${parsedRecord?.unrecognizedLines && parsedRecord.unrecognizedLines.length > 0
        ? `<div style="font-size: 11px; color: #fbbf24; background: rgba(245, 158, 11, 0.1); padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(245, 158, 11, 0.2);">
                      ℹ️ ${parsedRecord.unrecognizedLines.length} unrecognized line(s): ${escapeHtml(
          parsedRecord.unrecognizedLines.slice(0, 2).join('; ')
        )}
                    </div>`
        : ''
      }

              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${fieldStatuses
        .map(
          (item) => `
                  <div style="background: #090d16; border: 1px solid ${item.isMissing ? 'rgba(239, 68, 68, 0.5)' : '#1e293b'
            }; border-radius: 6px; padding: 8px 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <label style="font-size: 11.5px; font-weight: 600; color: #e2e8f0;">
                        ${escapeHtml(item.field.label)}
                        ${item.field.required ? '<span style="color: #ef4444;"> *</span>' : ''}
                      </label>

                      <div style="display: flex; align-items: center; gap: 6px;">
                        ${item.field.selector
              ? `<span style="font-size: 10px; font-family: monospace; color: #64748b;">
                                ${escapeHtml(item.field.selector)}
                              </span>`
              : ''
            }
                        <span style="font-size: 10px; padding: 1px 5px; border-radius: 4px; ${isScriptMode
              ? (item.elementFound ? 'background: rgba(16, 185, 129, 0.15); color: #34d399;' : 'background: rgba(59, 130, 246, 0.15); color: #93c5fd;')
              : (item.elementFound ? 'background: rgba(16, 185, 129, 0.15); color: #34d399;' : 'background: rgba(239, 68, 68, 0.15); color: #f87171;')
            }">
                          ${isScriptMode
              ? (item.elementFound ? '✓ in DOM' : '⚡ Script Mapped')
              : (item.elementFound ? '✓ in DOM' : '✕ Not in DOM')
            }
                        </span>
                      </div>
                    </div>

                    ${item.field.type === 'textarea'
              ? `<textarea
                            id="bb-val-${item.field.key}"
                            class="bb-preview-input"
                            style="min-height: 48px; resize: vertical;"
                            placeholder="Value for ${escapeHtml(item.field.label)}..."
                          >${escapeHtml(item.parsedValue)}</textarea>`
              : `<input
                            type="${item.field.type === 'date' ? 'date' : 'text'}"
                            id="bb-val-${item.field.key}"
                            class="bb-preview-input"
                            value="${escapeHtml(item.parsedValue)}"
                            placeholder="Value for ${escapeHtml(item.field.label)}..."
                          />`
            }

                    ${item.validationError
              ? `<div style="font-size: 10.5px; color: #f87171; margin-top: 3px;">
                            ${escapeHtml(item.validationError)}
                          </div>`
              : ''
            }
                  </div>
                `
        )
        .join('')}
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="bb-autofill-footer">
            <button id="bb-cancel-autofill" class="bb-action-btn" style="padding: 7px 14px;">
              Cancel
            </button>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; color: #94a3b8;">
                No automatic submission
              </span>
              <button
                id="bb-fill-form-btn"
                class="bb-action-btn primary"
                style="padding: 7px 18px; font-size: 13px;"
                ${detectedCount === 0 && !fillSummary ? '' : ''}
              >
                ${fillSummary ? '🔄 Re-fill Form' : '⚡ Fill Form'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook up event listeners in modal
    const overlay = this.shadowRoot.getElementById('bb-autofill-overlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeAutofillModal();
      }
    });

    const closeBtn = this.shadowRoot.getElementById('bb-close-autofill');
    closeBtn?.addEventListener('click', () => {
      this.closeAutofillModal();
    });

    const cancelBtn = this.shadowRoot.getElementById('bb-cancel-autofill');
    cancelBtn?.addEventListener('click', () => {
      this.closeAutofillModal();
    });

    // Read Clipboard button
    const readClipboardBtn = this.shadowRoot.getElementById('bb-read-clipboard-btn');
    readClipboardBtn?.addEventListener('click', async () => {
      await this.handleReadClipboard();
    });

    // Parse button
    const parseBtn = this.shadowRoot.getElementById('bb-parse-btn');
    parseBtn?.addEventListener('click', () => {
      const pasteInput = this.shadowRoot?.getElementById('bb-paste-input') as HTMLTextAreaElement | null;
      if (pasteInput) {
        this.handleParseText(pasteInput.value);
      }
    });

    // Fill Form button
    const fillBtn = this.shadowRoot.getElementById('bb-fill-form-btn');
    fillBtn?.addEventListener('click', () => {
      this.handleFillForm();
    });
  }

  private async handleReadClipboard() {
    this.autofillErrorMessage = null;
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        this.autofillErrorMessage = 'Clipboard API not supported in this environment. Please paste manually.';
        this.renderAutofillModal();
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        this.autofillErrorMessage = 'Clipboard is empty. Please copy a record first or paste text below.';
        this.renderAutofillModal();
        return;
      }
      this.autofillRawText = text;
      this.handleParseText(text);
    } catch (err) {
      console.warn('[BearBox] Clipboard read permission blocked or denied:', err);
      this.autofillErrorMessage = 'Clipboard read permission was denied. Please paste your text into the box below.';
      this.renderAutofillModal();
    }
  }

  private handleParseText(rawText: string) {
    if (!this.activeAutofillConfig && !this.activeAutofillScript) return;
    this.autofillRawText = rawText;
    this.activeFillSummary = null;

    if (this.activeAutofillConfig) {
      this.activeParsedRecord = parseSourceRecord(rawText, this.activeAutofillConfig);
    } else if (this.activeAutofillScript) {
      const syntheticConfig: FormAutofillConfig = {
        id: this.activeAutofillScript.id,
        name: this.activeAutofillScript.name,
        rules: this.activeAutofillScript.rules,
        fields: [],
        mappingMode: 'script',
        mappingScript: this.activeAutofillScript.sourceCode,
        enabled: true,
        createdAt: 0,
        updatedAt: 0
      };
      this.activeParsedRecord = parseSourceRecord(rawText, syntheticConfig);
    }

    this.renderAutofillModal();
  }

  /**
   * 1-Click Clipboard Autofill: Reads clipboard, parses text, and directly
   * populates fields on the active webpage without opening the review popup modal.
   */
  public async directClipboardFill(target: FormAutofillConfig | BearBoxScript) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        this.showToast('⚠️ Clipboard API not supported. Click ⚡ Autofill to paste manually.', 4000);
        return;
      }

      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        console.warn('[BearBox] Clipboard read permission blocked:', err);
        this.showToast('⚠️ Clipboard permission blocked. Click ⚡ Autofill to paste manually.', 4000);
        return;
      }

      if (!text || !text.trim()) {
        this.showToast('⚠️ Clipboard is empty. Copy text or record data first, then click Paste & Fill.', 4000);
        return;
      }

      const isScript = !('fields' in target);
      const syntheticConfig: FormAutofillConfig = isScript
        ? {
            id: target.id,
            name: target.name,
            rules: target.rules,
            fields: [],
            mappingMode: 'script',
            mappingScript: (target as BearBoxScript).sourceCode,
            enabled: true,
            createdAt: 0,
            updatedAt: 0
          }
        : (target as FormAutofillConfig);

      const parsedRecord = parseSourceRecord(text, syntheticConfig);
      const summary = await this.executeFill(target, text, parsedRecord);

      const filled = summary.filledCount || 0;
      if (filled > 0) {
        this.showToast(`✓ Filled ${filled} field(s) directly from clipboard!`, 4000);
        this.executionResults[target.id] = {
          success: true,
          message: `✓ ${filled} field(s) filled directly from clipboard`
        };
      } else {
        this.showToast(`⚠️ No matching fields found in clipboard data. Click ⚡ Autofill to inspect.`, 4500);
        this.executionResults[target.id] = {
          success: false,
          message: summary.message || 'No fields matched clipboard data'
        };
      }

      this.renderPanelContent();
    } catch (err) {
      console.warn('[BearBox] Direct clipboard autofill error:', err);
      this.showToast('⚠️ An error occurred during direct autofill. Click ⚡ Autofill to inspect.', 4000);
    }
  }

  /**
   * Shared form filling pipeline used by both direct clipboard fill and the interactive modal.
   */
  public async executeFill(
    target: FormAutofillConfig | BearBoxScript,
    rawText: string,
    parsedRecord: ParseRecordResult,
    customValues?: Record<string, string>
  ): Promise<AutofillSummary> {
    const isScript = !('fields' in target);
    const updatedParsed: Record<string, any> = {};

    // 1. Copy all existing parsed records and extracted pairs
    if (parsedRecord?.parsed) {
      for (const [k, v] of Object.entries(parsedRecord.parsed)) {
        updatedParsed[k] = { ...v };
      }
    }
    if (parsedRecord?.extractedPairs) {
      for (const [k, v] of Object.entries(parsedRecord.extractedPairs)) {
        if (!updatedParsed[k]) {
          updatedParsed[k] = {
            fieldId: `dyn_${k}`,
            key: k,
            label: k,
            value: v,
            formattedValue: v,
            isValid: true,
            isMissing: false
          };
        }
      }
    }

    // 2. Overlay any manual overrides from the modal if provided
    if (customValues) {
      for (const [key, val] of Object.entries(customValues)) {
        if (updatedParsed[key]) {
          updatedParsed[key].value = val;
          updatedParsed[key].formattedValue = val;
        } else {
          updatedParsed[key] = {
            fieldId: `custom_${key}`,
            key,
            label: key,
            value: val,
            formattedValue: val,
            isValid: true,
            isMissing: false
          };
        }
      }
    }

    // 3. Discover any DOM inputs matching fields in updatedParsed to enrich recordToFill
    for (const [key, item] of Object.entries(updatedParsed)) {
      const val = item.value;
      if (!val) continue;

      let el: Element | null = null;
      if (item.selector) {
        try { el = document.querySelector(item.selector); } catch { }
      }
      if (!el) {
        el = document.getElementById(key) ||
          document.querySelector(`[name="${key}"]`) ||
          document.querySelector(`[name="${key.toLowerCase()}"]`);
      }
      if (!el && item.label) {
        const clean = item.label.toLowerCase().trim();
        const labels = Array.from(document.querySelectorAll('label'));
        for (const lbl of labels) {
          const txt = (lbl.textContent || '').toLowerCase().trim();
          if (txt.includes(clean) || clean.includes(txt.replace(/[*:]/g, '').trim())) {
            el = lbl.querySelector('input, select, textarea');
            if (el) break;
          }
        }
      }

      if (el instanceof HTMLElement) {
        const domName = el.getAttribute('name');
        if (domName && !updatedParsed[domName]) {
          updatedParsed[domName] = {
            fieldId: `dom_${domName}`,
            key: domName,
            label: domName,
            value: val,
            formattedValue: val,
            isValid: true,
            isMissing: false
          };
        }
      }
    }

    const missingKeys = (!isScript && (target as FormAutofillConfig).mappingMode !== 'script')
      ? (target as FormAutofillConfig).fields
        .filter((f) => f.required && (!updatedParsed[f.key] || !updatedParsed[f.key].value))
        .map((f) => f.key)
      : [];

    const recordToFill: ParseRecordResult = {
      rawText,
      parsed: updatedParsed,
      missingRequiredKeys: missingKeys,
      unrecognizedLines: parsedRecord?.unrecognizedLines || [],
      fields: Object.values(updatedParsed),
      totalFieldsConfigured: Object.keys(updatedParsed).length,
      totalFieldsMatched: Object.keys(updatedParsed).length,
      missingRequiredCount: missingKeys.length,
      isValid: missingKeys.length === 0,
      extractedPairs: parsedRecord?.extractedPairs || {}
    };

    if (isScript) {
      const script = target as BearBoxScript;
      const report = await executeUserScript(script, {
        record: recordToFill,
        url: this.options.url,
        hostname: this.options.hostname,
        trigger: 'manual'
      });

      if (report.successfulFieldsCount > 0) {
        return reportToAutofillSummary(report);
      } else {
        // Fallback: The script had no instructions matching the parsed record or matched 0 fields.
        // Automatically populate all fields displayed that were verified in the DOM!
        const autoResults: AutofillFieldResult[] = [];
        for (const [key, item] of Object.entries(updatedParsed)) {
          const val = item.value;
          if (val === undefined || val === null || val === '') continue;

          let el: Element | null = null;
          if (item.selector) {
            try { el = document.querySelector(item.selector); } catch { }
          }
          if (!el) {
            el = document.getElementById(key) ||
              document.querySelector(`[name="${key}"]`) ||
              document.querySelector(`[name="${key.toLowerCase()}"]`);
          }
          if (!el && item.label) {
            const clean = item.label.toLowerCase().trim();
            const labels = Array.from(document.querySelectorAll('label'));
            for (const lbl of labels) {
              const txt = (lbl.textContent || '').toLowerCase().trim();
              if (txt.includes(clean) || clean.includes(txt.replace(/[*:]/g, '').trim())) {
                el = lbl.querySelector('input, select, textarea');
                if (el) break;
              }
            }
          }

          if (el instanceof HTMLElement) {
            const isSelect = el.tagName.toLowerCase() === 'select';
            const isDate = el.getAttribute('type') === 'date';
            const fillType = isSelect ? 'select' : (isDate ? 'date' : 'text');
            const res = fillElement(el, val, fillType);
            autoResults.push({
              fieldId: `auto_${key}`,
              key,
              fieldKey: key,
              label: item.label || key,
              fieldLabel: item.label || key,
              selector: el.id ? `#${el.id}` : (el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : el.tagName.toLowerCase()),
              value: val,
              success: res.success,
              elementFound: true,
              message: res.message
            });
          }
        }

        if (autoResults.length > 0) {
          const successfulCount = autoResults.filter((r) => r.success).length;
          const failedCount = autoResults.filter((r) => !r.success).length;
          return {
            formId: script.id,
            formName: script.name,
            timestamp: Date.now(),
            totalAttempted: autoResults.length,
            successfulCount,
            filledCount: successfulCount,
            totalFields: autoResults.length,
            failedCount,
            missingCount: 0,
            message: `${successfulCount} field(s) filled successfully based on detected DOM elements!`,
            results: autoResults
          };
        } else {
          return reportToAutofillSummary(report);
        }
      }
    } else {
      const config = target as FormAutofillConfig;
      return fillFormFields(config, recordToFill);
    }
  }

  private async handleFillForm() {
    if (!this.activeAutofillConfig && !this.activeAutofillScript) return;
    const target = this.activeAutofillConfig || this.activeAutofillScript!;

    // Collect latest edited values from all inputs in modal
    const customValues: Record<string, string> = {};
    const inputElements = this.shadowRoot?.querySelectorAll('.bb-preview-input') as NodeListOf<HTMLInputElement | HTMLTextAreaElement> | null;
    if (inputElements) {
      inputElements.forEach((inputEl) => {
        const id = inputEl.id || '';
        if (id.startsWith('bb-val-')) {
          const key = id.replace('bb-val-', '');
          customValues[key] = inputEl.value;
        }
      });
    }

    if (!this.activeParsedRecord) {
      const isScript = !('fields' in target);
      const syntheticConfig: FormAutofillConfig = isScript
        ? {
            id: target.id,
            name: target.name,
            rules: target.rules,
            fields: [],
            mappingMode: 'script',
            mappingScript: (target as BearBoxScript).sourceCode,
            enabled: true,
            createdAt: 0,
            updatedAt: 0
          }
        : (target as FormAutofillConfig);
      this.activeParsedRecord = parseSourceRecord(this.autofillRawText, syntheticConfig);
    }

    this.activeFillSummary = await this.executeFill(target, this.autofillRawText, this.activeParsedRecord, customValues);
    this.renderAutofillModal();
  }

  private startFieldPicker(_config?: FormAutofillConfig) {
    this.closePanel();
    this.showToast(`🎯 Field Inspector Active: Hover over any input/field on the webpage and click to copy its selector. Press Escape to cancel.`);

    fieldPicker.start(
      (info: PickedFieldInfo) => {
        this.copyToClipboard(info.selector);

        const isClickable = info.type === 'radio' || info.type === 'checkbox';
        const snippet = isClickable
          ? `await bearbox.setValue('${info.selector}', true);`
          : `await bearbox.setValue('${info.selector}', record.${info.suggestedKey});`;

        const html = `
          <div style="font-size: 12.5px;">
            <div style="font-weight: 700; color: #38bdf8; margin-bottom: 3px;">
              🎯 Picked: ${escapeHtml(info.suggestedLabel)} (${escapeHtml(info.type)})
            </div>
            <div style="margin-bottom: 4px;">
              Selector: <code style="background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; color: #60a5fa; font-family: monospace;">${escapeHtml(info.selector)}</code>
              <span style="color: #4ade80; font-weight: 600; margin-left: 6px;">✓ Copied!</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              Script: <code style="color: #cbd5e1; font-family: monospace;">${escapeHtml(snippet)}</code>
            </div>
          </div>
        `;

        this.showToastHtml(html, 7000);
      },
      () => {
        this.showToast('Field inspector cancelled.');
      }
    );
  }

  private copyToClipboard(text: string) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          this.fallbackCopyToClipboard(text);
        });
        return;
      }
    } catch { }
    this.fallbackCopyToClipboard(text);
  }

  private fallbackCopyToClipboard(text: string) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      // ignore
    }
  }

  private showToast(message: string, durationMs = 4500) {
    this.showToastHtml(`<span>${escapeHtml(message)}</span>`, durationMs);
  }

  private showToastHtml(htmlContent: string, durationMs = 5000) {
    if (!this.shadowRoot) return;
    const container = this.shadowRoot.getElementById('bb-toast-container');
    if (!container) return;

    container.innerHTML = `
      <div class="bb-toast" style="max-width: 90vw; line-height: 1.5; white-space: normal;">
        <div style="flex: 1;">${htmlContent}</div>
        <button id="bb-toast-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0 4px; font-weight: bold; margin-left: 12px; font-size: 14px;">✕</button>
      </div>
    `;

    const closeBtn = this.shadowRoot.getElementById('bb-toast-close');
    closeBtn?.addEventListener('click', () => {
      container.innerHTML = '';
    });

    setTimeout(() => {
      if (container.innerHTML.includes(htmlContent)) {
        container.innerHTML = '';
      }
    }, durationMs);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
