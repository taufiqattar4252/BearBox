/**
 * Interactive Form Field Inspector & Selector Generator
 *
 * Allows users to click on web form inputs directly in their browser.
 * Generates robust, stable CSS selectors (ID, Name, Label, Aria, TestId)
 * and infers field types and human-readable labels.
 */

import { FormFieldType } from '../types/formConfig';

export interface PickedFieldInfo {
  selector: string;
  type: FormFieldType;
  suggestedLabel: string;
  suggestedKey: string;
  tagName: string;
}

export class FieldPicker {
  private isActive = false;
  private overlayEl: HTMLElement | null = null;
  private badgeEl: HTMLElement | null = null;
  private hoveredElement: HTMLElement | null = null;
  private onPickCallback: ((info: PickedFieldInfo) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  public start(onPick: (info: PickedFieldInfo) => void, onCancel?: () => void): void {
    if (this.isActive) return;
    this.isActive = true;
    this.onPickCallback = onPick;
    this.onCancelCallback = onCancel || null;

    this.createOverlay();
    this.attachEvents();
  }

  public stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.detachEvents();
    this.removeOverlay();
    this.hoveredElement = null;
    this.onPickCallback = null;
  }

  private createOverlay() {
    // Floating highlight box
    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'bearbox-picker-overlay';
    this.overlayEl.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483645;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.12);
      border-radius: 6px;
      transition: all 0.08s ease-out;
      display: none;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    `;

    // Tooltip badge
    this.badgeEl = document.createElement('div');
    this.badgeEl.id = 'bearbox-picker-badge';
    this.badgeEl.style.cssText = `
      position: absolute;
      top: -26px;
      left: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #1e293b;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
      pointer-events: none;
    `;

    this.overlayEl.appendChild(this.badgeEl);
    document.documentElement.appendChild(this.overlayEl);
  }

  private removeOverlay() {
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.badgeEl = null;
  }

  private attachEvents() {
    window.addEventListener('pointermove', this.handlePointerMove, true);
    window.addEventListener('click', this.handleClick, true);
    window.addEventListener('keydown', this.handleKeyDown, true);
  }

  private detachEvents() {
    window.removeEventListener('pointermove', this.handlePointerMove, true);
    window.removeEventListener('click', this.handleClick, true);
    window.removeEventListener('keydown', this.handleKeyDown, true);
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isActive || !this.overlayEl) return;

    // Ignore BearBox UI elements
    const target = e.target as HTMLElement;
    if (!target || target.closest('#bearbox-floating-host') || target.closest('#bearbox-picker-overlay')) {
      return;
    }

    // Only target form inputs, buttons, selects, or contenteditable
    const inputEl = this.resolveFormElement(target);
    if (!inputEl) {
      this.overlayEl.style.display = 'none';
      this.hoveredElement = null;
      return;
    }

    this.hoveredElement = inputEl;
    const rect = inputEl.getBoundingClientRect();

    this.overlayEl.style.display = 'block';
    this.overlayEl.style.top = `${rect.top}px`;
    this.overlayEl.style.left = `${rect.left}px`;
    this.overlayEl.style.width = `${rect.width}px`;
    this.overlayEl.style.height = `${rect.height}px`;

    const suggested = this.inferFieldInfo(inputEl);
    if (this.badgeEl) {
      if (rect.top < 36) {
        this.badgeEl.style.top = `${rect.height + 4}px`;
      } else {
        this.badgeEl.style.top = '-28px';
      }
      this.badgeEl.textContent = `🎯 Click to pick: ${suggested.suggestedLabel} → ${suggested.selector}`;
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (!this.isActive) return;

    const target = e.target as HTMLElement;
    if (target?.closest('#bearbox-floating-host')) return;

    if (this.hoveredElement) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const info = this.inferFieldInfo(this.hoveredElement);
      const cb = this.onPickCallback;
      this.stop();
      if (cb) cb(info);
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const cb = this.onCancelCallback;
      this.stop();
      if (cb) cb();
    }
  };

  private resolveFormElement(el: HTMLElement): HTMLElement | null {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) {
      return el;
    }
    if (el.isContentEditable) {
      return el;
    }

    // Check if clicked element is a label or inside a label
    const closestLabel = el.closest('label');
    if (closestLabel) {
      const forId = closestLabel.getAttribute('for');
      if (forId) {
        const target = document.getElementById(forId);
        if (target) return target;
      }
      const nestedInput = closestLabel.querySelector('input, textarea, select, button');
      if (nestedInput instanceof HTMLElement) {
        return nestedInput;
      }
    }

    // Check closest button
    const closestButton = el.closest('button, [role="button"]');
    if (closestButton instanceof HTMLElement) {
      return closestButton;
    }

    // Check interactive ARIA role
    const role = el.getAttribute('role');
    if (role && /^(textbox|combobox|checkbox|radio|listbox|option|button)$/i.test(role)) {
      return el;
    }

    // Check nested form control
    const nestedInput = el.querySelector('input, textarea, select, button, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"]');
    if (nestedInput instanceof HTMLElement) {
      return nestedInput;
    }

    // Check common form field wrapper
    const wrapper = el.closest('.form-group, .form-control, .input-group, [class*="form-group"], [class*="control"], [class*="field"], [class*="input"], [class*="react-tel"]');
    if (wrapper) {
      const formEl = wrapper.querySelector('input, textarea, select, button');
      if (formEl instanceof HTMLElement) return formEl;
    }

    // Fallback: if element has an ID, name, placeholder, data-testid, aria-label
    if (el.id || el.getAttribute('name') || el.getAttribute('placeholder') || el.getAttribute('data-testid') || el.getAttribute('aria-label')) {
      return el;
    }

    return null;
  }

  /**
   * Generates a stable CSS selector and infers type & label.
   */
  public inferFieldInfo(el: HTMLElement): PickedFieldInfo {
    const selector = this.generateStableSelector(el);
    const type = this.inferFieldType(el);
    const label = this.inferLabelText(el);
    let key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');

    // Canonicalize common field keys for ease of use
    if (key.includes('first_name') || key === 'firstname') key = 'firstName';
    else if (key.includes('last_name') || key === 'lastname') key = 'lastName';
    else if (key.includes('email')) key = 'email';
    else if (key.includes('phone') || key.includes('mobile') || key.includes('tel')) key = 'phone';
    else if (key.includes('address')) key = 'address';
    else if (key.includes('city')) key = 'city';
    else if (key.includes('state')) key = 'state';
    else if (key.includes('zip') || key.includes('postal')) key = 'zipCode';
    else if (key.includes('country')) key = 'country';
    else if (key.includes('company') || key.includes('organization')) key = 'company';

    return {
      selector,
      type,
      suggestedLabel: label,
      suggestedKey: key || 'field',
      tagName: el.tagName.toLowerCase()
    };
  }

  private generateStableSelector(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();

    // 1. Stable, non-random ID
    if (el.id && !this.isRandomOrDynamic(el.id)) {
      return `#${CSS.escape(el.id)}`;
    }

    const type = el.getAttribute('type')?.toLowerCase();
    const name = el.getAttribute('name');
    const val = el.getAttribute('value');

    // 2. Radio & Checkbox with name and value
    if ((type === 'radio' || type === 'checkbox') && name) {
      if (val) {
        return `${tag}[name="${escapeAttr(name)}"][value="${escapeAttr(val)}"]`;
      }
      return `${tag}[name="${escapeAttr(name)}"]`;
    }

    // 3. Name attribute
    if (name) {
      return `${tag}[name="${escapeAttr(name)}"]`;
    }

    // 4. Data-testid or data-id
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-id') || el.getAttribute('data-cy');
    if (testId) {
      return `[data-testid="${escapeAttr(testId)}"]`;
    }

    // 5. Placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      return `${tag}[placeholder="${escapeAttr(placeholder)}"]`;
    }

    // 6. Aria Label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      return `${tag}[aria-label="${escapeAttr(ariaLabel)}"]`;
    }

    // 7. Distinctive input types (tel, email, date) if unique
    if (type && ['tel', 'email', 'date', 'number', 'password'].includes(type)) {
      try {
        const matches = document.querySelectorAll(`${tag}[type="${type}"]`);
        if (matches.length === 1) {
          return `${tag}[type="${type}"]`;
        }
      } catch {}
    }

    // 8. Label associated with input
    if (el.id) {
      return `[id="${CSS.escape(el.id)}"]`;
    }

    // 9. Minimal DOM hierarchy fallback
    const parent = el.parentElement;
    if (parent && parent.id && !this.isRandomOrDynamic(parent.id)) {
      return `#${CSS.escape(parent.id)} > ${tag}`;
    }

    return tag;
  }

  private isRandomOrDynamic(str: string): boolean {
    // Avoid IDs like ":r1:", "react-aria-12345", "radix-12", "uid_847293"
    if (/^(:r|react|radix|headlessui|chakra|__)/i.test(str)) return true;
    if (/\d{5,}/.test(str)) return true;
    return false;
  }

  private inferFieldType(el: HTMLElement): FormFieldType {
    if (el instanceof HTMLTextAreaElement) return 'textarea';
    if (el instanceof HTMLSelectElement) return 'select';
    if (el instanceof HTMLInputElement) {
      const t = el.type.toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'date') return 'date';
      if (t === 'number') return 'number';
      if (t === 'email') return 'email';
      if (t === 'tel') return 'tel';
    }
    return 'text';
  }

  private inferLabelText(el: HTMLElement): string {
    // 1. Check <label for="id">
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl && labelEl.textContent?.trim()) {
        return labelEl.textContent.trim().replace(/[*:]+$/, '').trim();
      }
    }

    // 2. Check closest enclosing label
    const enclosingLabel = el.closest('label');
    if (enclosingLabel) {
      // Get text without the input value
      const clone = enclosingLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
      const txt = clone.textContent?.trim();
      if (txt) return txt.replace(/[*:]+$/, '').trim();
    }

    // 3. Check aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    // 4. Check placeholder (strip prompt words like 'Please enter')
    const placeholder = el.getAttribute('placeholder');
    if (placeholder?.trim()) {
      const clean = placeholder.trim()
        .replace(/^(please\s+enter\s+(your\s+)?|enter\s+(your\s+)?|type\s+(your\s+)?|select\s+(your\s+)?|input\s+(your\s+)?)/i, '')
        .replace(/[*:]+$/, '')
        .trim();
      if (clean) {
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }
      return placeholder.trim();
    }

    // 5. Check name attribute
    const name = el.getAttribute('name');
    if (name?.trim()) {
      return name
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }

    return 'Input Field';
  }
}

function escapeAttr(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const fieldPicker = new FieldPicker();
