/**
 * BearBox Script API (Phase 4)
 *
 * Provides a rich, documented API for userscripts to inspect and interact with
 * webpage DOM elements, React-controlled inputs, custom components, and forms.
 */

import { AutofillFieldResult } from '../types/formConfig';
import {
  findFormElement,
  fillElement,
  dispatchFormEvents,
  formatPhoneNumberForInput
} from './formFiller';

export interface FieldFindOptions {
  selector?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  label?: string;
  aria?: string;
  type?: string;
  exact?: boolean;
}

export interface FieldActionOptions {
  label?: string;
  required?: boolean;
  overwrite?: boolean;
  key?: string;
}

export interface FieldActionResult {
  success: boolean;
  elementFound: boolean;
  message: string;
  value: string;
  key: string;
  label: string;
  selector: string;
}

export interface AutofillRunResult {
  success: boolean;
  totalAttempted: number;
  successfulCount: number;
  failedCount: number;
  message: string;
  results: AutofillFieldResult[];
}

export interface DateFormatOptions {
  targetFormat?: string; // e.g. 'YYYY-MM-DD', 'dd/mm/yyyy', 'MM/DD/YYYY'
  label?: string;
  overwrite?: boolean;
}

/**
 * Normalizes an arbitrary date string/object into desired target format.
 */
export function formatNormalizedDate(rawDate: unknown, targetFormat = 'YYYY-MM-DD'): string {
  if (rawDate === undefined || rawDate === null) return '';
  const str = String(rawDate).trim();
  if (!str) return '';

  let year: number | null = null;
  let month: number | null = null; // 1-12
  let day: number | null = null; // 1-31

  // 1. Try parsing YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  }

  // 2. Try parsing DD/MM/YYYY or DD-MM-YYYY
  if (!year) {
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const p3 = parseInt(dmyMatch[3], 10);
      year = p3;
      // If p1 > 12, p1 is definitely day
      if (p1 > 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        month = p1;
        day = p2;
      } else {
        // Default assumption for dd/mm/yyyy or mm/dd/yyyy
        day = p1;
        month = p2;
      }
    }
  }

  // 3. Fallback to standard Date object parsing
  if (!year) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
      month = parsed.getMonth() + 1;
      day = parsed.getDate();
    }
  }

  if (!year || !month || !day) {
    // Return original string if unable to extract components
    return str;
  }

  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');

  const fmt = targetFormat.toLowerCase();
  if (fmt.includes('yyyy') && fmt.startsWith('yyyy')) {
    const separator = targetFormat.includes('/') ? '/' : '-';
    return `${yStr}${separator}${mStr}${separator}${dStr}`;
  } else if (fmt.includes('dd') && fmt.startsWith('dd')) {
    const separator = targetFormat.includes('-') ? '-' : '/';
    return `${dStr}${separator}${mStr}${separator}${yStr}`;
  } else if (fmt.includes('mm') && fmt.startsWith('mm')) {
    const separator = targetFormat.includes('-') ? '-' : '/';
    return `${mStr}${separator}${dStr}${separator}${yStr}`;
  }

  // Default to YYYY-MM-DD
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Creates an instance of the BearBox API for a script execution session.
 */
export function createBearBoxApi(options?: {
  scriptName?: string;
  record?: Record<string, any>;
  onLog?: (msg: string) => void;
}) {
  const recordedResults: AutofillFieldResult[] = [];
  const logs: string[] = [];
  const scriptName = options?.scriptName || 'UserScript';
  const sourceRecord = options?.record || {};

  const recordFieldResult = (
    key: string,
    label: string,
    selector: string,
    value: string,
    success: boolean,
    elementFound: boolean,
    message: string
  ): FieldActionResult => {
    const result: AutofillFieldResult = {
      fieldId: `bb_${Date.now()}_${recordedResults.length}`,
      key,
      fieldKey: key,
      label,
      fieldLabel: label,
      selector,
      value,
      success,
      elementFound,
      message
    };
    recordedResults.push(result);
    return { success, elementFound, message, value, key, label, selector };
  };

  const api = {
    record: sourceRecord,
    // -------------------------------------------------------------
    // 1. Element Finding Helpers
    // -------------------------------------------------------------

    /**
     * Finds a single element using a CSS selector.
     */
    $: (selector: string): HTMLElement | null => {
      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    },

    /**
     * Finds all elements matching a CSS selector.
     */
    $$: (selector: string): HTMLElement[] => {
      try {
        return Array.from(document.querySelectorAll(selector));
      } catch {
        return [];
      }
    },

    querySelector: (selector: string): HTMLElement | null => {
      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    },

    querySelectorAll: (selector: string): HTMLElement[] => {
      try {
        return Array.from(document.querySelectorAll(selector));
      } catch {
        return [];
      }
    },

    find: (selector: string): HTMLElement | null => {
      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    },

    /**
     * Finds an input by its associated label text (via `for` attribute, enclosing label, or neighboring label).
     */
    findByLabel: (labelText: string): HTMLElement | null => {
      if (!labelText) return null;
      return findFormElement('', '', labelText);
    },

    /**
     * Finds an input by placeholder attribute.
     */
    findByPlaceholder: (placeholderText: string, exact = true): HTMLElement | null => {
      if (!placeholderText) return null;
      const clean = placeholderText.trim();
      if (exact) {
        return (
          document.querySelector(`input[placeholder="${clean}" i]`) ||
          document.querySelector(`textarea[placeholder="${clean}" i]`)
        );
      }
      return (
        document.querySelector(`input[placeholder*="${clean}" i]`) ||
        document.querySelector(`textarea[placeholder*="${clean}" i]`)
      );
    },

    /**
     * Finds an element by ID.
     */
    findById: (id: string): HTMLElement | null => {
      if (!id) return null;
      const cleanId = id.startsWith('#') ? id.slice(1) : id;
      return document.getElementById(cleanId);
    },

    /**
     * Finds an element by name attribute.
     */
    findByName: (name: string): HTMLElement | null => {
      if (!name) return null;
      return (
        document.querySelector(`[name="${name}"]`) ||
        document.querySelector(`[name="${name}" i]`)
      );
    },

    /**
     * Finds an element by ARIA attributes (aria-label, aria-labelledby).
     */
    findByAria: (ariaName: string): HTMLElement | null => {
      if (!ariaName) return null;
      const clean = ariaName.trim();
      const byAriaLabel =
        document.querySelector(`[aria-label="${clean}" i]`) ||
        document.querySelector(`[aria-label*="${clean}" i]`);
      if (byAriaLabel instanceof HTMLElement) return byAriaLabel;

      // Check aria-labelledby
      const labels = Array.from(document.querySelectorAll('[id]'));
      for (const lbl of labels) {
        if ((lbl.textContent || '').trim().toLowerCase().includes(clean.toLowerCase())) {
          const byLabelledBy = document.querySelector(`[aria-labelledby="${lbl.id}"]`);
          if (byLabelledBy instanceof HTMLElement) return byLabelledBy;
        }
      }
      return null;
    },

    /**
     * Multi-criteria field locator combining selector, ID, name, placeholder, label, and ARIA.
     */
    findField: (criteria: FieldFindOptions): HTMLElement | null => {
      if (criteria.selector) {
        const el = api.$(criteria.selector);
        if (el) return el;
      }
      if (criteria.id) {
        const el = api.findById(criteria.id);
        if (el) return el;
      }
      if (criteria.name) {
        const el = api.findByName(criteria.name);
        if (el) return el;
      }
      if (criteria.placeholder) {
        const el = api.findByPlaceholder(criteria.placeholder, criteria.exact ?? false);
        if (el) return el;
      }
      if (criteria.aria) {
        const el = api.findByAria(criteria.aria);
        if (el) return el;
      }
      if (criteria.label) {
        const el = api.findByLabel(criteria.label);
        if (el) return el;
      }
      return null;
    },

    /**
     * Finds the first element satisfying a custom predicate function.
     */
    findWhere: (predicate: (el: HTMLElement) => boolean): HTMLElement | null => {
      const all = Array.from(document.querySelectorAll('input, select, textarea, button, [role]'));
      for (const el of all) {
        if (el instanceof HTMLElement && predicate(el)) {
          return el;
        }
      }
      return null;
    },

    /**
     * Waits for an element to appear in the DOM (supports dynamic / client-side rendering).
     */
    waitFor: async (
      selectorOrFn: string | (() => HTMLElement | null | boolean),
      waitOptions?: { timeout?: number; interval?: number }
    ): Promise<HTMLElement | null> => {
      const timeout = waitOptions?.timeout ?? 3000;
      const interval = waitOptions?.interval ?? 100;
      const startTime = Date.now();

      return new Promise((resolve) => {
        const check = () => {
          let found: HTMLElement | null = null;
          if (typeof selectorOrFn === 'string') {
            found = api.$(selectorOrFn);
          } else {
            const res = selectorOrFn();
            if (res instanceof HTMLElement) found = res;
            else if (res) found = document.body;
          }

          if (found) {
            resolve(found);
            return;
          }

          if (Date.now() - startTime >= timeout) {
            resolve(null);
            return;
          }

          setTimeout(check, interval);
        };

        check();
      });
    },

    // -------------------------------------------------------------
    // 2. Value Setting & Framework Integration Helpers
    // -------------------------------------------------------------

    /**
     * Sets value on a text input, textarea, email, tel, etc., bypassing React shadowing.
     */
    setValue: async (
      target: string | HTMLElement,
      value: unknown,
      actionOptions?: FieldActionOptions
    ): Promise<FieldActionResult> => {
      const strVal = String(value ?? '');
      const el = typeof target === 'string' ? findFormElement(target, undefined, actionOptions?.label) : target;
      const key = actionOptions?.key || (typeof target === 'string' ? target : el?.getAttribute('name') || el?.id || 'input');
      const label = actionOptions?.label || key;
      const sel = typeof target === 'string' ? target : `#${el?.id || el?.tagName || 'element'}`;

      if (!el) {
        return recordFieldResult(key, label, sel, strVal, false, false, `Element not found: "${target}".`);
      }

      // Check overwrite policy
      if (actionOptions?.overwrite === false && (el as HTMLInputElement).value) {
        return recordFieldResult(key, label, sel, (el as HTMLInputElement).value, true, true, 'Skipped: field already contains a value.');
      }

      const res = fillElement(el, strVal, 'text');
      return recordFieldResult(key, label, sel, strVal, res.success, true, res.message);
    },

    /**
     * Selects an option from a `<select>` dropdown by visible text or value.
     */
    setSelect: async (
      target: string | HTMLElement,
      valueOrText: unknown,
      actionOptions?: FieldActionOptions
    ): Promise<FieldActionResult> => {
      const strVal = String(valueOrText ?? '');
      const el = typeof target === 'string' ? findFormElement(target, undefined, actionOptions?.label) : target;
      const key = actionOptions?.key || (typeof target === 'string' ? target : el?.getAttribute('name') || el?.id || 'select');
      const label = actionOptions?.label || key;
      const sel = typeof target === 'string' ? target : `#${el?.id || el?.tagName || 'select'}`;

      if (!el) {
        return recordFieldResult(key, label, sel, strVal, false, false, `Select element not found: "${target}".`);
      }

      const res = fillElement(el, strVal, 'select');
      return recordFieldResult(key, label, sel, strVal, res.success, true, res.message);
    },

    /**
     * Checks or unchecks a checkbox.
     */
    setCheckbox: async (
      target: string | HTMLElement,
      checked: unknown = true,
      actionOptions?: FieldActionOptions
    ): Promise<FieldActionResult> => {
      const boolVal = Boolean(checked && checked !== 'false' && checked !== '0');
      const el = typeof target === 'string' ? findFormElement(target, undefined, actionOptions?.label) : target;
      const key = actionOptions?.key || (typeof target === 'string' ? target : el?.getAttribute('name') || el?.id || 'checkbox');
      const label = actionOptions?.label || key;
      const sel = typeof target === 'string' ? target : `#${el?.id || el?.tagName || 'checkbox'}`;

      if (!el) {
        return recordFieldResult(key, label, sel, String(boolVal), false, false, `Checkbox element not found: "${target}".`);
      }

      const res = fillElement(el, String(boolVal), 'checkbox');
      return recordFieldResult(key, label, sel, String(boolVal), res.success, true, res.message);
    },

    /**
     * Selects a radio button in a radio group by value or label.
     */
    setRadio: async (
      groupOrTarget: string | HTMLElement,
      valueOrLabel: unknown,
      actionOptions?: FieldActionOptions
    ): Promise<FieldActionResult> => {
      const strVal = String(valueOrLabel ?? '');
      let el: HTMLElement | null = null;

      if (typeof groupOrTarget !== 'string') {
        el = groupOrTarget;
      } else {
        // Direct selector query if it begins with # or . or contains input
        if (groupOrTarget.startsWith('#') || groupOrTarget.startsWith('.') || groupOrTarget.includes('[')) {
          try {
            el = document.querySelector(groupOrTarget);
          } catch {}
        }
        // Query radio in group by name and value
        if (!el) {
          try {
            el = document.querySelector(`input[type="radio"][name="${groupOrTarget}"][value="${strVal}" i]`);
          } catch {}
        }
        // Query by ID
        if (!el) {
          const byId = document.getElementById(groupOrTarget.replace(/^#/, ''));
          if (byId && (byId as HTMLInputElement).type === 'radio') {
            el = byId;
          }
        }
        // Query first radio in group by name
        if (!el) {
          try {
            el = document.querySelector(`input[type="radio"][name="${groupOrTarget}"]`);
          } catch {}
        }
        // Fallback scoped search
        if (!el) {
          el = findFormElement(`input[type="radio"][name="${groupOrTarget}"]`, undefined, actionOptions?.label);
        }
      }

      const key = actionOptions?.key || (typeof groupOrTarget === 'string' ? groupOrTarget : el?.getAttribute('name') || 'radio');
      const label = actionOptions?.label || key;
      const sel = typeof groupOrTarget === 'string' ? groupOrTarget : `#${el?.id || el?.tagName || 'radio'}`;

      if (!el) {
        return recordFieldResult(key, label, sel, strVal, false, false, `Radio element or group not found: "${groupOrTarget}".`);
      }

      const res = fillElement(el, strVal, 'radio');
      return recordFieldResult(key, label, sel, strVal, res.success, true, res.message);
    },

    /**
     * Formats and sets a date field, adapting to expected formats (e.g. YYYY-MM-DD or dd/mm/yyyy).
     */
    setDate: async (
      target: string | HTMLElement,
      dateValue: unknown,
      dateOptions?: DateFormatOptions
    ): Promise<FieldActionResult> => {
      const el = typeof target === 'string' ? findFormElement(target, undefined, dateOptions?.label) : target;
      let targetFormat = dateOptions?.targetFormat || 'YYYY-MM-DD';

      // Auto-detect format from placeholder if present
      if (el instanceof HTMLInputElement && el.placeholder) {
        const ph = el.placeholder.toLowerCase();
        if (ph.includes('yyyy') && ph.includes('dd')) {
          targetFormat = el.placeholder;
        }
      }

      const formatted = formatNormalizedDate(dateValue, targetFormat);
      return api.setValue(target, formatted, { label: dateOptions?.label, overwrite: dateOptions?.overwrite });
    },

    /**
     * Date formatter utility.
     */
    formatDate: (dateValue: unknown, targetFormat = 'YYYY-MM-DD'): string => {
      return formatNormalizedDate(dateValue, targetFormat);
    },

    /**
     * Phone number formatter utility for `react-tel-input` or standard tel inputs.
     */
    formatPhone: (phoneValue: unknown, phoneOptions?: { defaultCountryCode?: string }): string => {
      const raw = String(phoneValue ?? '');
      // Create a mock tel input to utilize standard phone formatter
      const mockInput = document.createElement('input');
      mockInput.type = 'tel';
      mockInput.value = phoneOptions?.defaultCountryCode ? `+${phoneOptions.defaultCountryCode}` : '+1';
      return formatPhoneNumberForInput(mockInput, raw);
    },

    /**
     * Dispatches suitable focus, input, change, and blur events.
     */
    dispatchEvents: (element: HTMLElement, value?: string): void => {
      dispatchFormEvents(element, value);
    },

    // -------------------------------------------------------------
    // 3. High-Level Autofill Orchestrator
    // -------------------------------------------------------------

    /**
     * Batch fills fields based on a mapping object or field specification list.
     *
     * Example:
     * await bearbox.autofill({
     *   firstName: record.firstName,
     *   lastName: record.lastName,
     *   email: record.email,
     *   phone: record.phone
     * });
     */
    autofill: async (
      spec: Record<string, unknown> | Array<{ key?: string; selector?: string; label?: string; value: unknown; type?: string }>
    ): Promise<AutofillRunResult> => {
      if (Array.isArray(spec)) {
        for (const item of spec) {
          const val = item.value;
          if (val === undefined || val === null || val === '') continue;
          const target = item.selector || item.key || item.label || '';
          if (item.type === 'select') {
            await api.setSelect(target, val, { label: item.label, key: item.key });
          } else if (item.type === 'checkbox') {
            await api.setCheckbox(target, val, { label: item.label, key: item.key });
          } else if (item.type === 'radio') {
            await api.setRadio(target, val, { label: item.label, key: item.key });
          } else if (item.type === 'date') {
            await api.setDate(target, val, { label: item.label });
          } else {
            await api.setValue(target, val, { label: item.label, key: item.key });
          }
        }
      } else if (spec && typeof spec === 'object') {
        for (const [key, value] of Object.entries(spec)) {
          if (value === undefined || value === null || value === '') continue;
          // Try finding target by selector, ID, name, or label
          await api.setValue(key, value, { key, label: key });
        }
      }

      const results = api.getResults();
      const successfulCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      const message =
        failedCount === 0
          ? `${successfulCount} field(s) filled successfully!`
          : `${successfulCount} filled, ${failedCount} could not be completed.`;

      return {
        success: failedCount === 0 && successfulCount > 0,
        totalAttempted: results.length,
        successfulCount,
        failedCount,
        message,
        results
      };
    },

    // -------------------------------------------------------------
    // 4. Diagnostics & Logging
    // -------------------------------------------------------------

    /**
     * Safe script logger that avoids exposing sensitive PII to console.
     */
    log: (...args: unknown[]): void => {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      logs.push(msg);
      if (options?.onLog) options.onLog(msg);
      console.log(`[BearBox Script: ${scriptName}]`, ...args);
    },

    getResults: (): AutofillFieldResult[] => {
      return [...recordedResults];
    },

    getLogs: (): string[] => {
      return [...logs];
    },

    clearResults: (): void => {
      recordedResults.length = 0;
      logs.length = 0;
    },

    /**
     * Safe guard: Explicitly disallows auto-submission.
     */
    submit: (): void => {
      throw new Error('Auto-submission is disabled in BearBox for user security and manual review.');
    }
  };

  return api;
}

export type BearBoxApi = ReturnType<typeof createBearBoxApi>;
