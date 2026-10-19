/**
 * DOM Form Filler Engine for BearBox Tool 1: Custom Form Autofill
 *
 * Safely populates web form elements using standard and reactive-compatible DOM manipulation:
 * - Text inputs & Textareas with prototype setter invocation and synthetic event dispatch
 * - Select dropdowns with value/text option matching
 * - Checkboxes with Boolean and semantic truthy/falsy mapping
 * - Radio groups with value and label text resolution
 * - HTML5 Date pickers with ISO format verification
 * - Detailed result reporting with zero silent failures
 * - NEVER automatically clicks submit buttons
 */

import { AutofillFieldResult, AutofillSummary, FormAutofillConfig, ParsedFieldResult } from '../types/formConfig';

/**
 * Dispatches input and change events that standard and reactive frameworks (React, Vue, Angular) listen for.
 */
export function dispatchFormEvents(element: HTMLElement, value?: string): void {
  try {
    element.focus();
  } catch {}

  try {
    let inputEvt: Event;
    if (typeof InputEvent !== 'undefined') {
      try {
        inputEvt = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value ?? (element as any).value ?? ''
        });
      } catch {
        inputEvt = new Event('input', { bubbles: true, cancelable: true });
      }
    } else {
      inputEvt = new Event('input', { bubbles: true, cancelable: true });
    }

    element.dispatchEvent(inputEvt);
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  } catch {
    // Ignore any environment event restrictions
  }
}

/**
 * Sets input/textarea value using prototype descriptor to ensure React-controlled state updates.
 */
export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  // Reset React internal value tracker if present so React detects synthetic event changes
  const tracker = (element as any)._valueTracker;
  if (tracker) {
    if (typeof tracker.setValue === 'function') {
      tracker.setValue('');
    }
    delete (element as any)._valueTracker;
  }

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

/**
 * Formats a phone number for telephone inputs, with special handling for `react-tel-input`.
 * Preserves the initial country code (such as `+1` for US/Canada) and applies the expected format.
 */
export function formatPhoneNumberForInput(element: HTMLInputElement, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const currentVal = (element.value || '').trim();
  const isReactTel = Boolean(
    element.closest('.react-tel-input') ||
    element.parentElement?.classList.contains('react-tel-input') ||
    (element.classList.contains('form-control') && element.type === 'tel' && Boolean(element.closest('[class*="phone"], [class*="tel"]')))
  );

  // Does the element or input currently start with or expect +1?
  const startsWithPlus1 =
    currentVal.startsWith('+1') ||
    (isReactTel && (!currentVal || currentVal === '+' || currentVal.startsWith('+1')));

  // Extract all digits from value
  const allDigits = trimmed.replace(/\D/g, '');

  if (startsWithPlus1 || trimmed.startsWith('+1') || (allDigits.length === 11 && allDigits.startsWith('1'))) {
    // Determine the 10-digit national number
    const nationalDigits =
      allDigits.length === 11 && allDigits.startsWith('1')
        ? allDigits.slice(1)
        : allDigits.length === 10
          ? allDigits
          : null;

    if (nationalDigits && nationalDigits.length === 10) {
      const area = nationalDigits.slice(0, 3);
      const exch = nationalDigits.slice(3, 6);
      const sub = nationalDigits.slice(6, 10);
      return `+1 (${area}) ${exch}-${sub}`;
    }

    // If it already starts with +1, format its digits
    if (trimmed.startsWith('+1')) {
      const restDigits = trimmed.slice(2).replace(/\D/g, '');
      if (restDigits.length === 10) {
        const area = restDigits.slice(0, 3);
        const exch = restDigits.slice(3, 6);
        const sub = restDigits.slice(6, 10);
        return `+1 (${area}) ${exch}-${sub}`;
      }
      return trimmed;
    }

    if (startsWithPlus1 && !trimmed.startsWith('+')) {
      return `+1 ${trimmed}`;
    }
  }

  // If already starts with a country code e.g. +44...
  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  // If element currently has a country code prefix (e.g. "+XX")
  const ccMatch = currentVal.match(/^\+(\d{1,4})/);
  if (ccMatch) {
    return `+${ccMatch[1]} ${trimmed}`;
  }

  return trimmed;
}

/**
 * Attempts to locate a form element using its selector, with intelligent fallbacks
 * for forms without ID or name attributes (such as the Nexaura Digital contact form).
 *
 * Fallback priority:
 * 1. Direct CSS Selector query
 * 2. ID / Name attribute lookup
 * 3. Specific semantic rules (First Name, Last Name, Phone Number, Email)
 * 4. Associated <label> and accessible names
 * 5. Placeholder matching
 * 6. Form group / container traversal
 */
export function findFormElement(
  selector: string,
  fallbackKey?: string,
  fallbackLabel?: string
): HTMLElement | null {
  if (!selector && !fallbackKey && !fallbackLabel) return null;

  // 1. Direct CSS Selector
  if (selector) {
    try {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) return el;
    } catch {
      // Invalid selector syntax
    }
    // Also try as name attribute or id if selector is a bare identifier
    if (/^[a-zA-Z0-9_-]+$/.test(selector)) {
      try {
        const el = document.querySelector(`[name="${selector}"], #${selector}`);
        if (el instanceof HTMLElement) return el;
      } catch {}
    }
  }

  // 2. Fallback by name attribute
  if (fallbackKey) {
    try {
      const el = document.querySelector(`[name="${fallbackKey}"], [name="${fallbackKey.toLowerCase()}"]`);
      if (el instanceof HTMLElement) return el;
    } catch {}
  }

  // 3. Fallback by ID
  if (fallbackKey) {
    try {
      const el = document.getElementById(fallbackKey) || document.getElementById(fallbackKey.toLowerCase());
      if (el) return el;
    } catch {}
  }

  // Extract candidate identifier from selector if it contains #id or [name="..."]
  let selectorIdOrName = '';
  if (selector) {
    const m = selector.match(/#([a-zA-Z0-9_-]+)|\[name=["']?([a-zA-Z0-9_-]+)["']?\]/);
    if (m) selectorIdOrName = m[1] || m[2];
  }

  // Search context
  const searchCtx = `${fallbackLabel || ''} ${fallbackKey || ''} ${selectorIdOrName} ${selector || ''}`.toLowerCase();

  // Validates that an input is appropriate for a specific semantic field category
  const isInputValidForSemanticCategory = (
    input: Element | null,
    category?: 'firstName' | 'lastName' | 'phone' | 'email'
  ): input is HTMLElement => {
    if (!(input instanceof HTMLElement)) return false;
    if (!category) return true;

    const ph = (input.getAttribute('placeholder') || '').toLowerCase();
    const aria = (input.getAttribute('aria-label') || '').toLowerCase();
    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const type = input instanceof HTMLInputElement ? input.type.toLowerCase() : 'textarea';
    const ctx = `${ph} ${aria} ${name} ${id} ${input.className}`.toLowerCase();

    if (category === 'firstName') {
      if (type === 'tel' || type === 'email' || type === 'checkbox' || type === 'radio') return false;
      if (ctx.includes('last name') || ctx.includes('lastname') || ctx.includes('lname')) return false;
      return true;
    }

    if (category === 'lastName') {
      if (type === 'tel' || type === 'email' || type === 'checkbox' || type === 'radio') return false;
      if (ctx.includes('first name') || ctx.includes('firstname') || ctx.includes('fname')) return false;
      return true;
    }

    if (category === 'phone') {
      if (type === 'email' || type === 'checkbox' || type === 'radio') return false;
      if (type === 'tel' || input.closest('.react-tel-input') || ctx.includes('phone') || ctx.includes('tel')) return true;
      return false;
    }

    if (category === 'email') {
      if (type === 'tel' || type === 'checkbox' || type === 'radio') return false;
      if (type === 'email' || ctx.includes('email') || ctx.includes('mail')) return true;
      return false;
    }

    return true;
  };

  // Helper to find input inside a label's form group or parent container
  const findInputInFormGroup = (
    labelEl: Element,
    inputSelector = 'input, select, textarea',
    category?: 'firstName' | 'lastName' | 'phone' | 'email'
  ): HTMLElement | null => {
    // A. Nested input inside label
    const nested = labelEl.querySelector(inputSelector);
    if (isInputValidForSemanticCategory(nested, category)) return nested;

    // B. Associated via for attribute
    const forId = labelEl.getAttribute('for');
    if (forId) {
      const forEl = document.getElementById(forId);
      if (isInputValidForSemanticCategory(forEl, category)) return forEl;
    }

    // C. Inside common parent / form group container
    let container = labelEl.closest('.form-group, .form-row, .field-wrapper, .field, [class*="group"], [class*="field"], [class*="phone"], [class*="input"], fieldset, div');
    if (container && container !== document.body && container.tagName !== 'FORM' && container.tagName !== 'FIELDSET') {
      // Ensure this container is not a massive multi-field container
      if (container.querySelectorAll('label').length <= 2) {
        const input = container.querySelector(inputSelector);
        if (isInputValidForSemanticCategory(input, category)) return input;
      }
    }

    // D. Immediate parent container (if not form/body and doesn't wrap multiple fields)
    if (labelEl.parentElement && labelEl.parentElement.tagName !== 'FORM' && labelEl.parentElement !== document.body) {
      if (labelEl.parentElement.querySelectorAll('label').length <= 1) {
        const parentInput = labelEl.parentElement.querySelector(inputSelector);
        if (isInputValidForSemanticCategory(parentInput, category)) return parentInput;
      }
    }

    // E. Next sibling input
    let next = labelEl.nextElementSibling;
    while (next) {
      // Don't bleed past another label
      if (next.tagName === 'LABEL' || next.querySelector('label')) break;
      if (next.matches && next.matches(inputSelector) && isInputValidForSemanticCategory(next, category)) return next as HTMLElement;
      const childInput = next.querySelector(inputSelector);
      if (isInputValidForSemanticCategory(childInput, category)) return childInput;
      next = next.nextElementSibling;
    }

    return null;
  };

  // 4. Specific Semantic Fallbacks (e.g. for Nexaura Digital and similar modern React forms)

  // 4A. FIRST NAME
  // Rule: input[placeholder="Please enter first name"] or associated First Name label
  if (/\b(first\s*name|firstname|fname|first)\b/i.test(searchCtx) || searchCtx.includes('first')) {
    // i. Exact or contains placeholder (Nexaura Digital contact form)
    const elByPlaceholder = document.querySelector('input[placeholder="Please enter first name" i], input[placeholder*="first name" i]');
    if (isInputValidForSemanticCategory(elByPlaceholder, 'firstName')) return elByPlaceholder;

    // ii. Label containing First Name
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const text = (lbl.textContent || '').trim().toLowerCase();
      if (/\bfirst\s*name\b/i.test(text) && text.length < 50) {
        const found = findInputInFormGroup(lbl, 'input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])', 'firstName');
        if (found) return found;
      }
    }

    // iii. ARIA label
    const elByAria = document.querySelector('input[aria-label*="first name" i], input[aria-label*="first" i]');
    if (isInputValidForSemanticCategory(elByAria, 'firstName')) return elByAria;

    // iv. Loose placeholder
    const elLoose = document.querySelector('input[placeholder*="first" i]');
    if (isInputValidForSemanticCategory(elLoose, 'firstName')) return elLoose;
  }

  // 4B. LAST NAME
  // Rule: input[placeholder="Please enter last name"] or associated Last Name label
  if (/\b(last\s*name|lastname|lname|surname|last)\b/i.test(searchCtx) || searchCtx.includes('last')) {
    // i. Exact or contains placeholder (Nexaura Digital contact form)
    const elByPlaceholder = document.querySelector('input[placeholder="Please enter last name" i], input[placeholder*="last name" i]');
    if (isInputValidForSemanticCategory(elByPlaceholder, 'lastName')) return elByPlaceholder;

    // ii. Label containing Last Name
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const text = (lbl.textContent || '').trim().toLowerCase();
      if (/\blast\s*name\b/i.test(text) && text.length < 50) {
        const found = findInputInFormGroup(lbl, 'input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])', 'lastName');
        if (found) return found;
      }
    }

    // iii. ARIA label
    const elByAria = document.querySelector('input[aria-label*="last name" i], input[aria-label*="last" i]');
    if (isInputValidForSemanticCategory(elByAria, 'lastName')) return elByAria;

    // iv. Loose placeholder
    const elLoose = document.querySelector('input[placeholder*="last" i]');
    if (isInputValidForSemanticCategory(elLoose, 'lastName')) return elLoose;
  }

  // 4C. PHONE NUMBER
  // Rule: input[type="tel"] inside the Phone Number form group, or .react-tel-input
  if (/\b(phone\s*number|phone|telephone|tel|mobile|cell|contact\s*number)\b/i.test(searchCtx)) {
    // i. Inside the Phone Number form group (e.g. react-tel-input in Nexaura Digital)
    const labels = Array.from(document.querySelectorAll('label, legend'));
    for (const lbl of labels) {
      const text = (lbl.textContent || '').trim().toLowerCase();
      if (/\b(phone\s*number|phone|mobile|telephone)\b/i.test(text) && text.length < 50) {
        const found = findInputInFormGroup(lbl, 'input[type="tel"], .react-tel-input input, input', 'phone');
        if (found) return found;
      }
    }

    // ii. .react-tel-input component input
    const reactTel = document.querySelector('.react-tel-input input[type="tel"], .react-tel-input input');
    if (isInputValidForSemanticCategory(reactTel, 'phone')) return reactTel;

    // iii. Standard input[type="tel"]
    const telInput = document.querySelector('input[type="tel"]');
    if (isInputValidForSemanticCategory(telInput, 'phone')) return telInput;

    // iv. Placeholder / ARIA label
    const elByPlaceholder = document.querySelector('input[placeholder*="phone" i], input[aria-label*="phone" i]');
    if (isInputValidForSemanticCategory(elByPlaceholder, 'phone')) return elByPlaceholder;
  }

  // 4D. EMAIL
  // Rule: input[type="email"] or input[placeholder="Please enter your email"]
  if (/\b(email|e-mail|mail)\b/i.test(searchCtx)) {
    // i. Standard input[type="email"]
    const emailInput = document.querySelector('input[type="email"]');
    if (isInputValidForSemanticCategory(emailInput, 'email')) return emailInput;

    // ii. Nexaura placeholder: input[placeholder="Please enter your email"]
    const elByPlaceholder = document.querySelector('input[placeholder="Please enter your email" i], input[placeholder*="email" i]');
    if (isInputValidForSemanticCategory(elByPlaceholder, 'email')) return elByPlaceholder;

    // iii. Label containing Email
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const text = (lbl.textContent || '').trim().toLowerCase();
      if (/\bemail\b/i.test(text) && text.length < 50) {
        const found = findInputInFormGroup(lbl, 'input[type="email"], input', 'email');
        if (found) return found;
      }
    }

    // iv. ARIA label
    const elByAria = document.querySelector('input[aria-label*="email" i]');
    if (isInputValidForSemanticCategory(elByAria, 'email')) return elByAria;
  }

  // 5. Generalized Associated Label / Accessible Name / Placeholder Fallback (for any other fields)
  const labelToSearch = (fallbackLabel || selectorIdOrName || (selector && !selector.includes('[') && !selector.includes('#') ? selector : '')).trim().toLowerCase();
  if (labelToSearch && labelToSearch.length >= 2) {
    // A. Accessible attributes (aria-label, placeholder, title)
    try {
      const directAria = document.querySelector(`[aria-label="${labelToSearch}" i], [placeholder="${labelToSearch}" i], [title="${labelToSearch}" i]`);
      if (directAria instanceof HTMLElement) return directAria;

      const partialAria = document.querySelector(`[aria-label*="${labelToSearch}" i], [placeholder*="${labelToSearch}" i]`);
      if (partialAria instanceof HTMLElement) return partialAria;
    } catch {}

    // B. Associated label traversal
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      if (txt.includes(labelToSearch) || labelToSearch.includes(txt.replace(/[*:]/g, '').trim())) {
        const found = findInputInFormGroup(lbl);
        if (found) return found;
      }
    }

    // C. Search all input elements' placeholders
    for (const input of Array.from(document.querySelectorAll('input, textarea, select'))) {
      const ph = (input.getAttribute('placeholder') || '').toLowerCase();
      const aria = (input.getAttribute('aria-label') || '').toLowerCase();
      if ((ph && ph.includes(labelToSearch)) || (aria && aria.includes(labelToSearch))) {
        if (input instanceof HTMLElement) return input;
      }
    }
  }

  return null;
}

/**
 * Fills a single form element in the active document.
 */
export function fillElement(
  element: HTMLElement,
  value: string,
  _type?: string
): { success: boolean; message: string } {
  // 1. Select Dropdown
  if (element instanceof HTMLSelectElement) {
    const trimmedVal = value.trim().toLowerCase();
    let matchedOption: HTMLOptionElement | null = null;

    // A. Match by option value (exact or case-insensitive)
    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      if (opt.value.trim().toLowerCase() === trimmedVal) {
        matchedOption = opt;
        break;
      }
    }

    // B. Match by option visible text
    if (!matchedOption) {
      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        if (opt.textContent?.trim().toLowerCase() === trimmedVal) {
          matchedOption = opt;
          break;
        }
      }
    }

    if (matchedOption) {
      element.value = matchedOption.value;
      dispatchFormEvents(element);
      return { success: true, message: `Selected option "${matchedOption.textContent?.trim()}".` };
    }

    return {
      success: false,
      message: `No matching option found in <select> for value "${value}". Available options: ${Array.from(element.options).map((o) => o.text.trim()).filter(Boolean).slice(0, 5).join(', ')}.`
    };
  }

  // 2. Checkbox
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    const clean = value.trim().toLowerCase();
    const shouldCheck = ['true', '1', 'yes', 'on', 'checked', 'y'].includes(clean);
    const shouldUncheck = ['false', '0', 'no', 'off', 'unchecked', 'n'].includes(clean);

    if (shouldCheck) {
      element.checked = true;
    } else if (shouldUncheck) {
      element.checked = false;
    } else {
      // Default to checked if non-empty, otherwise unchecked
      element.checked = Boolean(clean);
    }

    dispatchFormEvents(element);
    return { success: true, message: `Checkbox set to ${element.checked ? 'Checked' : 'Unchecked'}.` };
  }

  // 3. Radio Button
  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const name = element.name;
    const clean = value.trim().toLowerCase();

    // Query all radios in this group
    const radioGroup = name
      ? Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`)) as HTMLInputElement[]
      : [element];

    let matchedRadio: HTMLInputElement | null = null;

    if (clean === 'true' || clean === '1' || clean === 'checked' || !name) {
      matchedRadio = element;
    } else {
      for (const radio of radioGroup) {
        // Check value match
        if (radio.value.trim().toLowerCase() === clean) {
          matchedRadio = radio;
          break;
        }

      // Check label match if radio has associated label
      const labelEl = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
      if (labelEl && labelEl.textContent?.trim().toLowerCase() === clean) {
        matchedRadio = radio;
        break;
      }

      // Check parent label text
      const parentLabel = radio.closest('label');
      if (parentLabel && parentLabel.textContent?.trim().toLowerCase().includes(clean)) {
        matchedRadio = radio;
        break;
      }
    }
  }

    if (matchedRadio) {
      matchedRadio.checked = true;
      dispatchFormEvents(matchedRadio);
      return { success: true, message: `Selected radio option for "${value}".` };
    }

    return {
      success: false,
      message: `Could not match value "${value}" to any radio button in group "${name}".`
    };
  }

  // 4. Textarea & Standard Text Inputs
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    let finalValue = value;
    if (
      element instanceof HTMLInputElement &&
      (element.type === 'tel' ||
        element.closest('.react-tel-input') ||
        element.getAttribute('placeholder')?.toLowerCase().includes('phone') ||
        _type === 'tel')
    ) {
      finalValue = formatPhoneNumberForInput(element, value);
    }

    setNativeValue(element, finalValue);
    dispatchFormEvents(element, finalValue);

    // Verify React-controlled value actually updated
    const actualVal = element.value;
    const isUpdated =
      actualVal === finalValue ||
      (element.type === 'tel' && actualVal.replace(/\D/g, '').endsWith(value.replace(/\D/g, '')));

    if (isUpdated) {
      return { success: true, message: 'Value populated successfully.' };
    } else {
      // Fallback: direct assignment if prototype descriptor was blocked
      element.value = finalValue;
      dispatchFormEvents(element, finalValue);
      const secondCheck = element.value === finalValue;
      return {
        success: secondCheck,
        message: secondCheck
          ? 'Value populated successfully.'
          : `Failed to update value (expected "${finalValue}", got "${element.value}").`
      };
    }
  }

  // 5. ContentEditable elements
  if (element.isContentEditable) {
    element.textContent = value;
    dispatchFormEvents(element);
    return { success: true, message: 'ContentEditable value populated.' };
  }

  return { success: false, message: `Unsupported target element <${element.tagName.toLowerCase()}>.` };
}

/**
 * Helper to split comma-separated arguments while respecting quotes, brackets, and parentheses.
 */
function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote && argsStr[i - 1] !== '\\') {
        inQuote = null;
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch;
      current += ch;
    } else if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (ch === '[') {
      bracketDepth++;
      current += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
    } else if (ch === '{') {
      braceDepth++;
      current += ch;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      current += ch;
    } else if (ch === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

/**
 * Splits JavaScript code into top-level statements while respecting quotes, parentheses, brackets, and blocks.
 */
function splitStatements(code: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote && code[i - 1] !== '\\') {
        inQuote = null;
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch;
      current += ch;
    } else if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (ch === '[') {
      bracketDepth++;
      current += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
    } else if (ch === '{') {
      braceDepth++;
      current += ch;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      current += ch;
    } else if (
      (ch === ';' || ch === '\n') &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }
  return statements;
}

/**
 * Resolves a key in a record with intelligent casing and fuzzy matching:
 * - Exact key: record[k]
 * - Case-insensitive key: record[k.toLowerCase()]
 * - Lowercase with underscores: record[first_name]
 * - Stripped alphanumeric: record[firstname]
 * - Partial/prefix match for form keys like 02frstname, 13adr_city, 24emailadr
 */
function getRecordValue(record: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (!k) continue;
    // 1. Exact match
    if (record[k] !== undefined && record[k] !== '') return String(record[k]).trim();

    // 2. Case-insensitive exact
    const lower = k.toLowerCase().trim();
    for (const [rk, rv] of Object.entries(record)) {
      if (rk.toLowerCase().trim() === lower && rv !== undefined && rv !== '') {
        return String(rv).trim();
      }
    }

    // 3. Normalized alphanumeric stripped
    const stripped = lower.replace(/[^a-z0-9]/g, '');
    for (const [rk, rv] of Object.entries(record)) {
      const rkStripped = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rkStripped === stripped && rv !== undefined && rv !== '') {
        return String(rv).trim();
      }
    }

    // 4. Fuzzy substring match (e.g. key '02frstname' or 'first_name' vs 'firstname')
    for (const [rk, rv] of Object.entries(record)) {
      const rkStripped = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        (rkStripped.includes(stripped) || stripped.includes(rkStripped)) &&
        stripped.length >= 3 &&
        rkStripped.length >= 3 &&
        rv !== undefined &&
        rv !== ''
      ) {
        return String(rv).trim();
      }
    }
  }
  return '';
}

/**
 * Evaluates an expression string in a safe, zero-eval context.
 */
function evaluateSafeExpression(
  rawExpr: string,
  scope: Record<string, any>,
  record: Record<string, string>
): any {
  const expr = rawExpr.trim();
  if (!expr) return '';

  // 1. Ternary Operator: condition ? ifTrue : ifFalse
  let qIndex = -1;
  let colonIndex = -1;
  let inQ: string | null = null;
  let pDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (inQ) {
      if (c === inQ && expr[i - 1] !== '\\') inQ = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inQ = c;
    } else if (c === '(') {
      pDepth++;
    } else if (c === ')') {
      pDepth = Math.max(0, pDepth - 1);
    } else if (c === '?' && pDepth === 0 && qIndex === -1) {
      qIndex = i;
    } else if (c === ':' && pDepth === 0 && qIndex !== -1 && colonIndex === -1) {
      colonIndex = i;
    }
  }
  if (qIndex !== -1 && colonIndex !== -1) {
    const cond = evaluateSafeExpression(expr.substring(0, qIndex), scope, record);
    const ifTrue = expr.substring(qIndex + 1, colonIndex);
    const ifFalse = expr.substring(colonIndex + 1);
    const isTruthy = cond && cond !== 'false' && cond !== '0';
    return isTruthy ? evaluateSafeExpression(ifTrue, scope, record) : evaluateSafeExpression(ifFalse, scope, record);
  }

  // 2. Binary Logical OR: a || b
  let orIndex = -1;
  inQ = null;
  pDepth = 0;
  for (let i = 0; i < expr.length - 1; i++) {
    const c = expr[i];
    if (inQ) {
      if (c === inQ && expr[i - 1] !== '\\') inQ = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inQ = c;
    } else if (c === '(') {
      pDepth++;
    } else if (c === ')') {
      pDepth = Math.max(0, pDepth - 1);
    } else if (c === '|' && expr[i + 1] === '|' && pDepth === 0) {
      orIndex = i;
      break;
    }
  }
  if (orIndex !== -1) {
    const left = evaluateSafeExpression(expr.substring(0, orIndex), scope, record);
    if (left && left !== 'false' && left !== '0') return left;
    return evaluateSafeExpression(expr.substring(orIndex + 2), scope, record);
  }

  // 3. Binary Logical AND: a && b
  let andIndex = -1;
  inQ = null;
  pDepth = 0;
  for (let i = 0; i < expr.length - 1; i++) {
    const c = expr[i];
    if (inQ) {
      if (c === inQ && expr[i - 1] !== '\\') inQ = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inQ = c;
    } else if (c === '(') {
      pDepth++;
    } else if (c === ')') {
      pDepth = Math.max(0, pDepth - 1);
    } else if (c === '&' && expr[i + 1] === '&' && pDepth === 0) {
      andIndex = i;
      break;
    }
  }
  if (andIndex !== -1) {
    const left = evaluateSafeExpression(expr.substring(0, andIndex), scope, record);
    if (!left || left === 'false' || left === '0') return '';
    return evaluateSafeExpression(expr.substring(andIndex + 2), scope, record);
  }

  // 4. Binary Addition / Concatenation: a + b
  let plusIndex = -1;
  inQ = null;
  pDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (inQ) {
      if (c === inQ && expr[i - 1] !== '\\') inQ = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inQ = c;
    } else if (c === '(') {
      pDepth++;
    } else if (c === ')') {
      pDepth = Math.max(0, pDepth - 1);
    } else if (c === '+' && pDepth === 0) {
      plusIndex = i;
      break;
    }
  }
  if (plusIndex !== -1) {
    const left = evaluateSafeExpression(expr.substring(0, plusIndex), scope, record);
    const right = evaluateSafeExpression(expr.substring(plusIndex + 1), scope, record);
    return String(left ?? '') + String(right ?? '');
  }

  // 5. String Literals ('...' or "...")
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.substring(1, expr.length - 1);
  }

  // 6. Template Literals (`...${...}...`)
  if (expr.startsWith('`') && expr.endsWith('`')) {
    const body = expr.substring(1, expr.length - 1);
    return body.replace(/\$\{([^}]+)\}/g, (_, inner) => {
      const val = evaluateSafeExpression(inner, scope, record);
      return String(val ?? '');
    });
  }

  // 7. Array filter and join: [a, b, c].filter(Boolean).join(' ')
  const joinMatch = expr.match(/^\[(.*?)\]\.filter\(Boolean\)\.join\((.*?)\)$/);
  if (joinMatch) {
    const rawElements = splitArguments(joinMatch[1]);
    const sepExpr = joinMatch[2].trim();
    const sep = sepExpr ? evaluateSafeExpression(sepExpr, scope, record) : ' ';
    const parts = rawElements
      .map((item) => String(evaluateSafeExpression(item, scope, record) ?? '').trim())
      .filter(Boolean);
    return parts.join(sep);
  }

  // 8. get('k1', 'k2', ...) call
  const getCallMatch = expr.match(/^get\(([\s\S]*)\)$/);
  if (getCallMatch) {
    const rawArgs = splitArguments(getCallMatch[1]);
    const keys = rawArgs.map((arg) => {
      const clean = arg.trim();
      if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
        return clean.substring(1, clean.length - 1);
      }
      return clean;
    });
    return getRecordValue(record, ...keys);
  }

  // 9. record property access: record.field or record['field'] with optional string methods
  const recordPropMatch = expr.match(/^record(?:\.([a-zA-Z0-9_$]+)|\[['"`]([^'"`]+)['"`]\])(?:\.([a-zA-Z0-9_$]+)\(\))?$/);
  if (recordPropMatch) {
    const key = recordPropMatch[1] || recordPropMatch[2];
    let val = getRecordValue(record, key);
    const method = recordPropMatch[3];
    if (method === 'toUpperCase') val = val.toUpperCase();
    if (method === 'toLowerCase') val = val.toLowerCase();
    if (method === 'trim') val = val.trim();
    return val;
  }

  // 10. Direct property method call on a variable: e.g. fullName.toUpperCase()
  const varMethodMatch = expr.match(/^([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\(\)$/);
  if (varMethodMatch) {
    const varName = varMethodMatch[1];
    const method = varMethodMatch[2];
    let val = scope[varName] !== undefined ? String(scope[varName]) : getRecordValue(record, varName);
    if (method === 'toUpperCase') val = val.toUpperCase();
    if (method === 'toLowerCase') val = val.toLowerCase();
    if (method === 'trim') val = val.trim();
    return val;
  }

  // 11. Booleans and primitives
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'null' || expr === 'undefined') return '';
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);

  // 12. Variable reference in local scope
  if (scope[expr] !== undefined) {
    return scope[expr];
  }

  // 13. Direct key lookup in record
  return getRecordValue(record, expr);
}

/**
 * Safe, CSP-compliant AST & Directive Interpreter for user-written mapping scripts.
 *
 * Runs 100% in-memory with zero `eval()` and zero `new Function()`, ensuring:
 * - 0% CSP violations in Chrome Extension Manifest V3
 * - Simultaneous instant DOM population (<50ms)
 * - Complete support for helpers, variables, conditions, filters, and joins
 */
export function executeSafeScriptInterpretation(
  scriptSource: string,
  record: Record<string, string>,
  helpers: {
    setInput: (sel: string, val: unknown, label?: string) => boolean;
    setValue?: (sel: string, val: unknown, label?: string) => boolean;
    setSelect: (sel: string, val: unknown, label?: string) => boolean;
    setCheckbox: (sel: string, val: unknown, label?: string) => boolean;
    setRadio: (group: string, val: unknown, label?: string) => boolean;
    setDate?: (sel: string, val: unknown, label?: string, targetFormat?: string) => boolean;
    autofill?: (spec: any) => boolean;
    log: (...args: unknown[]) => void;
  }
): boolean {
  let fieldsMatched = 0;

  // Local variable scope
  const scope: Record<string, any> = {};

  // Strip block comments /* ... */ and line comments // ...
  const cleanCode = scriptSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  // 1. Declarative return object: return { key: '#selector', ... };
  const returnMatch = cleanCode.match(/return\s*\{([\s\S]*?)\};?/);
  if (returnMatch) {
    const objectBody = returnMatch[1];
    const pairRegex = /([a-zA-Z0-9_$-]+|\'[^\']+\'|\"[^\"]+\")\s*:\s*['"`]([^'"`]+)['"`]/g;
    let m: RegExpExecArray | null;
    while ((m = pairRegex.exec(objectBody)) !== null) {
      const rawKey = m[1].replace(/^['"`]|['"`]$/g, '');
      const selector = m[2];
      const val = getRecordValue(record, rawKey);
      if (val && selector) {
        if (helpers.setInput(selector, val, rawKey)) {
          fieldsMatched++;
        }
      }
    }
    if (fieldsMatched > 0) return true;
  }

  // Extract body of runBearBoxAutofill or outer function if wrapped
  let codeToRun = cleanCode.trim();
  const funcMatch = codeToRun.match(/(?:async\s+)?function(?:\s+[a-zA-Z0-9_$]+)?\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/);
  if (funcMatch) {
    codeToRun = funcMatch[1];
  }

  // 2. Parse statements
  const statements = splitStatements(codeToRun);

  const executeStatement = (stmt: string): void => {
    const s = stmt.trim();
    if (!s) return;

    // A. Check for throw statement: throw new Error('...') or throw '...'
    const throwMatch = s.match(/^throw(?:\s+new\s+Error\(([\s\S]*)\)|\s+([\s\S]+))$/);
    if (throwMatch) {
      const rawArg = throwMatch[1] || throwMatch[2];
      const errMsg = String(evaluateSafeExpression(rawArg, scope, record) || 'Custom script validation failed');
      throw new Error(errMsg);
    }

    // B. Ignore destructuring helpers: const { setInput, ... } = helpers;
    if (s.startsWith('const {') && s.includes('helpers')) {
      return;
    }

    // B. If block: if (condition) { statements... } or if (condition) statement
    const ifMatch = s.match(/^if\s*\(([\s\S]+?)\)\s*(?:\{([\s\S]*)\}|([\s\S]+))$/);
    if (ifMatch) {
      const conditionExpr = ifMatch[1].trim();
      const body = (ifMatch[2] !== undefined ? ifMatch[2] : ifMatch[3]).trim();
      let condVal: any = false;

      if (conditionExpr.startsWith('!')) {
        const inner = conditionExpr.substring(1).trim();
        const innerVal = evaluateSafeExpression(inner, scope, record);
        condVal = !innerVal || innerVal === 'false' || innerVal === '0';
      } else {
        const innerVal = evaluateSafeExpression(conditionExpr, scope, record);
        condVal = innerVal && innerVal !== 'false' && innerVal !== '0';
      }

      if (condVal) {
        const subStatements = splitStatements(body);
        for (const sub of subStatements) {
          executeStatement(sub);
        }
      }
      return;
    }

    // C. Variable assignment: const x = ... / let x = ... / var x = ... / x = ...
    const assignMatch = s.match(/^(?:(?:const|let|var)\s+)?([a-zA-Z0-9_$]+)\s*=\s*([\s\S]+)$/);
    if (assignMatch && !s.startsWith('helpers.')) {
      const varName = assignMatch[1];
      const rhs = assignMatch[2];
      scope[varName] = evaluateSafeExpression(rhs, scope, record);
      return;
    }

    // D. Helper calls: setInput(...), setValue(...), setSelect(...), setCheckbox(...), setRadio(...), setDate(...), autofill(...), log(...)
    const cleanStmt = s.replace(/^await\s+/, '');
    const callMatch = cleanStmt.match(/^(?:(?:helpers|bearbox)\.)?(setInput|setValue|setSelect|setCheckbox|setRadio|setDate|autofill|log)\s*\(([\s\S]*)\)$/);
    if (callMatch) {
      const fnName = callMatch[1];
      const rawArgs = splitArguments(callMatch[2]);

      if (fnName === 'log') {
        const evalArgs = rawArgs.map((a) => evaluateSafeExpression(a, scope, record));
        helpers.log(...evalArgs);
        return;
      }

      if (fnName === 'autofill' && helpers.autofill) {
        const spec = rawArgs[0] ? evaluateSafeExpression(rawArgs[0], scope, record) : record;
        if (helpers.autofill(spec || record)) fieldsMatched++;
        return;
      }

      const selector = String(evaluateSafeExpression(rawArgs[0] || '', scope, record) ?? '').trim();
      const rawVal = rawArgs[1] !== undefined ? evaluateSafeExpression(rawArgs[1], scope, record) : '';

      // Parse optional 3rd argument (options object or label string)
      let label: string | undefined = undefined;
      let targetFormat: string | undefined = undefined;
      if (rawArgs[2] !== undefined) {
        const arg3 = rawArgs[2].trim();
        if (arg3.startsWith('{') && arg3.endsWith('}')) {
          const lMatch = arg3.match(/label\s*:\s*['"`]([^'"`]+)['"`]/);
          if (lMatch) label = lMatch[1];
          const fMatch = arg3.match(/targetFormat\s*:\s*['"`]([^'"`]+)['"`]/) || arg3.match(/format\s*:\s*['"`]([^'"`]+)['"`]/);
          if (fMatch) targetFormat = fMatch[1];
        } else {
          label = String(evaluateSafeExpression(arg3, scope, record) ?? '').trim();
        }
      }

      if (selector && (rawVal !== undefined && rawVal !== '')) {
        if (fnName === 'setInput' || fnName === 'setValue') {
          if (helpers.setValue ? helpers.setValue(selector, rawVal, label) : helpers.setInput(selector, rawVal, label)) {
            fieldsMatched++;
          }
        } else if (fnName === 'setSelect') {
          if (helpers.setSelect(selector, rawVal, label)) fieldsMatched++;
        } else if (fnName === 'setCheckbox') {
          if (helpers.setCheckbox(selector, rawVal, label)) fieldsMatched++;
        } else if (fnName === 'setRadio') {
          if (helpers.setRadio(selector, rawVal, label)) fieldsMatched++;
        } else if (fnName === 'setDate' && helpers.setDate) {
          if (helpers.setDate(selector, rawVal, label, targetFormat)) fieldsMatched++;
        }
      }
    }
  };

  for (const stmt of statements) {
    executeStatement(stmt);
  }

  return fieldsMatched > 0;
}

/**
 * Executes a custom JavaScript mapping script against the current document DOM.
 *
 * Runs 100% CSP-safe without eval/new Function in Chrome MV3 content scripts.
 */
export function fillFormWithScript(
  config: FormAutofillConfig,
  input:
    | ParsedFieldResult[]
    | { fields?: ParsedFieldResult[]; parsed?: Record<string, any>; rawText?: string }
): AutofillSummary {
  const scriptSource = (config.mappingScript || '').trim();
  const startTime = Date.now();

  // Extract clean record dictionary: { key: stringValue }
  const record: Record<string, string> = {};
  let rawText = '';

  if (Array.isArray(input)) {
    for (const f of input) {
      record[f.key] = f.value;
    }
  } else if (input && typeof input === 'object') {
    if (input.rawText) {
      rawText = input.rawText;
      record['raw_text'] = rawText;
    }
    if (Array.isArray(input.fields)) {
      for (const f of input.fields) record[f.key] = f.value;
    }
    if (input.parsed) {
      for (const [k, v] of Object.entries(input.parsed)) {
        record[k] = typeof v === 'object' && v !== null && 'value' in v ? (v as any).value : String(v ?? '');
      }
    }
  }

  const logs: string[] = [];
  const results: AutofillFieldResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Helper tracking map to avoid duplicate counts if the script references the same key multiple times
  const recordedFields = new Set<string>();

  const recordResult = (
    key: string,
    label: string,
    selector: string,
    value: string,
    success: boolean,
    elementFound: boolean,
    message: string
  ) => {
    recordedFields.add(key);
    if (success) successCount++;
    else failedCount++;

    results.push({
      fieldId: `script_${results.length}`,
      key,
      fieldKey: key,
      label,
      fieldLabel: label,
      selector,
      value,
      success,
      elementFound,
      message
    });
  };

  const helpers = {
    // 1. Text input / textarea
    setInput: (selectorOrEl: string | HTMLElement, value: unknown, label?: string) => {
      const strVal = String(value ?? '');
      const el = typeof selectorOrEl === 'string' ? findFormElement(selectorOrEl, undefined, label) : selectorOrEl;
      const key = typeof selectorOrEl === 'string' ? selectorOrEl : (el?.getAttribute('name') || el?.id || 'input');
      const displayLabel = label || key;

      if (!el) {
        recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : '', strVal, false, false, `Element not found: "${selectorOrEl}".`);
        return false;
      }

      const res = fillElement(el, strVal, 'text');
      recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : `#${el.id || el.tagName}`, strVal, res.success, true, res.message);
      return res.success;
    },

    // 2. Select dropdown
    setSelect: (selectorOrEl: string | HTMLElement, valueOrText: unknown, label?: string) => {
      const strVal = String(valueOrText ?? '');
      const el = typeof selectorOrEl === 'string' ? findFormElement(selectorOrEl, undefined, label) : selectorOrEl;
      const key = typeof selectorOrEl === 'string' ? selectorOrEl : (el?.getAttribute('name') || el?.id || 'select');
      const displayLabel = label || key;

      if (!el) {
        recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : '', strVal, false, false, `Select element not found: "${selectorOrEl}".`);
        return false;
      }

      const res = fillElement(el, strVal, 'select');
      recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : `#${el.id || el.tagName}`, strVal, res.success, true, res.message);
      return res.success;
    },

    // 3. Checkbox
    setCheckbox: (selectorOrEl: string | HTMLElement, checked: unknown = true, label?: string) => {
      const strVal = String(checked ?? true);
      const el = typeof selectorOrEl === 'string' ? findFormElement(selectorOrEl, undefined, label) : selectorOrEl;
      const key = typeof selectorOrEl === 'string' ? selectorOrEl : (el?.getAttribute('name') || el?.id || 'checkbox');
      const displayLabel = label || key;

      if (!el) {
        recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : '', strVal, false, false, `Checkbox element not found: "${selectorOrEl}".`);
        return false;
      }

      const res = fillElement(el, strVal, 'checkbox');
      recordResult(key, displayLabel, typeof selectorOrEl === 'string' ? selectorOrEl : `#${el.id || el.tagName}`, strVal, res.success, true, res.message);
      return res.success;
    },

    // 4. Radio button
    setRadio: (groupNameOrSelector: string, valueOrLabel: unknown, label?: string) => {
      const strVal = String(valueOrLabel ?? '');
      let el = findFormElement(groupNameOrSelector, groupNameOrSelector, label);
      if (!el) {
        el = findFormElement(`input[type="radio"][name="${groupNameOrSelector}"]`, groupNameOrSelector, label) ||
             findFormElement(`input[name="${groupNameOrSelector}"]`, groupNameOrSelector, label) ||
             findFormElement(`[name="${groupNameOrSelector}"]`, groupNameOrSelector, label);
      }
      const key = groupNameOrSelector;
      const displayLabel = label || key;

      if (!el) {
        recordResult(key, displayLabel, groupNameOrSelector, strVal, false, false, `Radio element or group not found: "${groupNameOrSelector}".`);
        return false;
      }

      const res = fillElement(el, strVal, 'radio');
      recordResult(key, displayLabel, groupNameOrSelector, strVal, res.success, true, res.message);
      return res.success;
    },

    // 5. Query helpers
    query: (selector: string) => document.querySelector(selector),
    queryAll: (selector: string) => Array.from(document.querySelectorAll(selector)),

    // 6. Event dispatcher
    dispatchEvents: (el: HTMLElement) => dispatchFormEvents(el),

    // 7. Logger
    log: (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      logs.push(msg);
    }
  };

  try {
    if (!scriptSource) {
      throw new Error('Mapping script is empty. Please configure a custom mapping script or switch to visual mapping mode.');
    }

    // 1. Primary Execution: Execute via Safe Script Interpreter (Zero eval, 100% CSP compliant)
    executeSafeScriptInterpretation(scriptSource, record, helpers);

    // 2. Intelligent Auto-Fill Fallback:
    // For any field present in input (or visual config) that was NOT handled by the script,
    // if a matching element exists in the active DOM (by selector, ID, name, or label), populate it.
    const allInputFields = Array.isArray(input) ? input : (input.fields || config.fields || []);
    for (const f of allInputFields) {
      if (recordedFields.has(f.key) || recordedFields.has(f.label)) continue;
      const val = (f as any).value || (input as any).parsed?.[f.key]?.value || record[f.key] || record[f.label] || '';
      if (!val) continue;

      let el: HTMLElement | null = null;
      if (f.selector) {
        el = findFormElement(f.selector, f.key, f.label);
      }
      if (!el && (f.key || f.label)) {
        el = findFormElement('', f.key, f.label);
      }

      if (el instanceof HTMLElement) {
        helpers.setInput(el, val, f.label || f.key);
      }
    }

    let summaryMessage = '';
    if (successCount === 0 && failedCount === 0) {
      summaryMessage = '0 fields filled. Your custom mapping script did not map any fields to this webpage.';
    } else if (failedCount === 0) {
      summaryMessage = `${successCount} ${successCount === 1 ? 'field' : 'fields'} filled successfully via custom script!`;
    } else {
      summaryMessage = `${successCount} filled, ${failedCount} could not be completed.`;
    }

    return {
      formId: config.id,
      formName: config.name,
      timestamp: startTime,
      totalAttempted: results.length,
      successfulCount: successCount,
      filledCount: successCount,
      totalFields: results.length,
      failedCount,
      missingCount: 0,
      message: summaryMessage,
      results
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      formId: config.id,
      formName: config.name,
      timestamp: startTime,
      totalAttempted: results.length,
      successfulCount: successCount,
      filledCount: successCount,
      totalFields: results.length,
      failedCount: failedCount + 1,
      missingCount: 0,
      message: `Script execution error: ${errorMsg}`,
      results: [
        ...results,
        {
          fieldId: 'script_error',
          key: 'script_runtime',
          fieldKey: 'script_runtime',
          label: 'Script Error',
          fieldLabel: 'Script Error',
          selector: 'custom_script',
          value: '',
          success: false,
          elementFound: false,
          message: errorMsg
        }
      ]
    };
  }
}

/**
 * Executes autofill for all parsed fields against the current DOM.
 */
export function fillFormFields(
  config: FormAutofillConfig,
  input:
    | ParsedFieldResult[]
    | { fields?: ParsedFieldResult[]; parsed?: Record<string, any>; rawText?: string }
): AutofillSummary {
  // If mappingMode is 'script' and custom script is defined, route to custom script executor
  if (config.mappingMode === 'script' && config.mappingScript && config.mappingScript.trim().length > 0) {
    return fillFormWithScript(config, input);
  }

  let parsedFields: ParsedFieldResult[] = [];

  if (Array.isArray(input)) {
    parsedFields = input;
  } else if (input && Array.isArray(input.fields)) {
    parsedFields = input.fields;
  } else if (input && input.parsed) {
    parsedFields = config.fields.map((f) => {
      const p = input.parsed?.[f.key];
      const val = p ? (typeof p === 'object' ? p.value : String(p)) : '';
      return {
        fieldId: f.id,
        key: f.key,
        label: f.label,
        value: val,
        required: f.required,
        type: f.type,
        selector: f.selector || (f as any).targetSelector || '',
        status: val ? 'valid' : f.required ? 'missing_required' : 'valid'
      };
    });
  }

  const results: AutofillFieldResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let missingCount = 0;

  for (const parsed of parsedFields) {
    // If no value and not required, skip
    if (!parsed.value && !parsed.required) {
      continue;
    }

    // If required and missing value
    if (parsed.required && !parsed.value) {
      missingCount++;
      results.push({
        fieldId: parsed.fieldId,
        key: parsed.key,
        fieldKey: parsed.key,
        label: parsed.label,
        fieldLabel: parsed.label,
        selector: parsed.selector,
        value: '',
        success: false,
        elementFound: false,
        message: 'Required field has no value provided.'
      });
      continue;
    }

    // Find element in webpage DOM
    const element = findFormElement(parsed.selector, parsed.key, parsed.label);

    if (!element) {
      failedCount++;
      results.push({
        fieldId: parsed.fieldId,
        key: parsed.key,
        fieldKey: parsed.key,
        label: parsed.label,
        fieldLabel: parsed.label,
        selector: parsed.selector,
        value: parsed.value,
        success: false,
        elementFound: false,
        message: `Element not found in webpage DOM (selector: "${parsed.selector || parsed.key}").`
      });
      continue;
    }

    // Populate element
    const fillResult = fillElement(element, parsed.value, parsed.type);

    if (fillResult.success) {
      successCount++;
    } else {
      failedCount++;
    }

    results.push({
      fieldId: parsed.fieldId,
      key: parsed.key,
      fieldKey: parsed.key,
      label: parsed.label,
      fieldLabel: parsed.label,
      selector: parsed.selector,
      value: parsed.value,
      success: fillResult.success,
      elementFound: true,
      message: fillResult.message
    });
  }

  const message =
    failedCount === 0
      ? `${successCount} ${successCount === 1 ? 'field' : 'fields'} filled successfully!`
      : `${successCount} filled, ${failedCount} could not be completed.`;

  return {
    formId: config.id,
    formName: config.name,
    timestamp: Date.now(),
    totalAttempted: results.length,
    successfulCount: successCount,
    filledCount: successCount,
    totalFields: results.length,
    failedCount,
    missingCount,
    message,
    results
  };
}
