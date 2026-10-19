/**
 * Form Script Parser & Synchronizer for BearBox Tool 1: Custom Form Autofill
 *
 * Provides bidirectional translation between JavaScript mapping scripts
 * and the Form Field Mappings Visual Table.
 */

import { FormFieldMapping, FormFieldType, ValueTransform } from '../types/formConfig';
import { generateFieldMappingId } from './storage';

/**
 * Standard known aliases for common form fields to improve
 * recognition when pasting records from external documents.
 */
const KNOWN_ALIASES_MAP: Record<string, string[]> = {
  studentname: ['Student Name', 'Full Name', 'Name'],
  studentid: ['Student ID', 'Roll No', 'Registration No', 'ID'],
  name: ['Full Name', 'Name', 'Student Name'],
  fullname: ['Full Name', 'Name', 'Student Name'],
  dob: ['Date of Birth', 'DOB', 'Birth Date'],
  dateofbirth: ['Date of Birth', 'DOB', 'Birth Date'],
  birthdate: ['Date of Birth', 'DOB', 'Birth Date'],
  class: ['Class', 'Grade', 'Standard'],
  section: ['Section', 'Division'],
  parentname: ['Parent Name', 'Father Name', 'Guardian Name'],
  fathername: ['Father Name', 'Parent Name', 'Guardian Name'],
  mothername: ['Mother Name', 'Parent Name'],
  parentphone: ['Parent Phone', 'Phone', 'Mobile', 'Contact'],
  phone: ['Phone', 'Mobile', 'Contact', 'Telephone'],
  mobile: ['Mobile', 'Phone', 'Contact'],
  email: ['Email', 'Email Address'],
  emailaddress: ['Email Address', 'Email'],
  address: ['Address', 'Permanent Address', 'Residential Address'],
  admissiondate: ['Admission Date', 'Date of Admission'],
  gender: ['Gender', 'Sex'],
  city: ['City', 'Town'],
  state: ['State', 'Province'],
  zip: ['PIN Code', 'Postal Code', 'Zip Code', 'ZIP'],
  pincode: ['PIN Code', 'Postal Code', 'Zip Code'],
  postalcode: ['Postal Code', 'PIN Code', 'Zip Code'],
  country: ['Country', 'Nation']
};

/**
 * Converts a camelCase, PascalCase, or snake_case key into a human-readable title.
 * Examples:
 *   "studentName" -> "Student Name"
 *   "student_id" -> "Student ID"
 *   "dob" -> "Date of Birth"
 */
export function formatKeyToLabel(key: string): string {
  if (!key) return '';
  const lower = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower === 'dob' || lower === 'dateofbirth') return 'Date of Birth';
  if (lower === 'studentid' || lower === 'id') return 'Student ID';
  if (lower === 'parentphone') return 'Parent Phone';
  if (lower === 'parentname') return 'Parent Name';
  if (lower === 'admissiondate') return 'Admission Date';
  if (lower === 'email' || lower === 'emailaddress') return 'Email';
  if (lower === 'url') return 'URL';
  if (lower === 'ssn') return 'SSN';

  // Split on snake_case, kebab-case, or camelCase boundaries
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/);

  return words
    .map((w) => {
      const wLower = w.toLowerCase();
      if (wLower === 'id') return 'ID';
      if (wLower === 'dob') return 'DOB';
      if (wLower === 'url') return 'URL';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalizes string for alias lookup.
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Safely strips comments from JavaScript code.
 */
export function stripComments(code: string): string {
  let result = '';
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === inString && code[i - 1] !== '\\') {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Splits argument string respecting nested quotes and brackets.
 */
export function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];

    if (inQuote) {
      current += c;
      if (c === inQuote && argsStr[i - 1] !== '\\') {
        inQuote = null;
      }
    } else if (c === '"' || c === "'" || c === '`') {
      inQuote = c;
      current += c;
    } else if (c === '(' || c === '[' || c === '{') {
      depth++;
      current += c;
    } else if (c === ')' || c === ']' || c === '}') {
      depth = Math.max(0, depth - 1);
      current += c;
    } else if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Unquotes a string literal ('val', "val", `val`).
 */
function cleanStringLiteral(str: string): string {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Extracts key from an argument expression like `record.studentName`,
 * `record['student_name']`, `get('student_name')`, or a variable name.
 */
function extractKeyFromExpression(expr: string, variableMap: Map<string, string>): string | null {
  const trimmed = expr.trim();

  // 1. record.field or record.field.method()
  const dotMatch = trimmed.match(/record\.([a-zA-Z0-9_$]+)/);
  if (dotMatch) return dotMatch[1];

  // 2. record['field'] or record["field"]
  const bracketMatch = trimmed.match(/record\[['"`]([^'"`]+)['"`]\]/);
  if (bracketMatch) return bracketMatch[1];

  // 3. get('field')
  const getMatch = trimmed.match(/get\(['"`]([^'"`]+)['"`]\)/);
  if (getMatch) return getMatch[1];

  // 4. Look up in variable map (e.g. const studentName = record.studentName)
  if (variableMap.has(trimmed)) {
    return variableMap.get(trimmed)!;
  }

  // 5. Bare identifier that looks like a field key
  if (/^[a-zA-Z0-9_$]+$/.test(trimmed) && trimmed !== 'true' && trimmed !== 'false' && trimmed !== 'null') {
    return trimmed;
  }

  return null;
}

/**
 * Infers input field type based on helper function, selector, key, and label.
 */
export function inferFieldType(
  helperName: string,
  selector: string,
  key: string,
  label: string
): FormFieldType {
  if (helperName === 'setSelect') return 'select';
  if (helperName === 'setCheckbox') return 'checkbox';
  if (helperName === 'setRadio') return 'radio';

  const combined = `${selector} ${key} ${label}`.toLowerCase();

  // HTML5 Date
  if (
    combined.includes('type="date"') ||
    combined.includes("type='date'") ||
    /\b(dob|birth|birthdate|admissiondate|date|joiningdate|expiry)\b/i.test(`${key} ${label}`)
  ) {
    return 'date';
  }

  // Email
  if (
    combined.includes('type="email"') ||
    combined.includes("type='email'") ||
    /\b(email|mail)\b/i.test(`${key} ${label}`)
  ) {
    return 'email';
  }

  // Phone / Tel
  if (
    combined.includes('type="tel"') ||
    combined.includes("type='tel'") ||
    /\b(phone|tel|mobile|cell|fax|contact)\b/i.test(`${key} ${label}`)
  ) {
    return 'tel';
  }

  // Number
  if (
    combined.includes('type="number"') ||
    combined.includes("type='number'") ||
    /\b(number|age|qty|quantity|count|amount|price|pincode|zip|postal)\b/i.test(`${key} ${label}`)
  ) {
    return 'number';
  }

  // Textarea
  if (
    combined.includes('textarea') ||
    /\b(address|notes|comment|comments|desc|description|message|bio|remarks|feedback)\b/i.test(
      `${key} ${label}`
    )
  ) {
    return 'textarea';
  }

  return 'text';
}

/**
 * Builds aliases list for a field, combining known aliases, label, and key.
 */
export function generateDefaultAliases(key: string, label: string, existingAliases?: string[]): string[] {
  const aliasSet = new Set<string>();

  // Add existing aliases first if available
  if (existingAliases && existingAliases.length > 0) {
    for (const a of existingAliases) {
      if (a && a.trim()) aliasSet.add(a.trim());
    }
  }

  // Add primary label
  if (label && label.trim()) {
    aliasSet.add(label.trim());
  }

  // Add known dictionary aliases
  const normK = normalizeKey(key);
  const normL = normalizeKey(label);
  const known = KNOWN_ALIASES_MAP[normK] || KNOWN_ALIASES_MAP[normL];
  if (known) {
    for (const a of known) aliasSet.add(a);
  }

  // Add key if reasonably readable
  if (key && !key.startsWith('field_')) {
    aliasSet.add(key);
    const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    if (spaced) aliasSet.add(spaced);
  }

  return Array.from(aliasSet).filter(Boolean);
}

/**
 * Infers value transformation based on script call and type.
 */
function inferTransform(valExpr: string, type: FormFieldType, existingTransform?: ValueTransform): ValueTransform {
  if (type === 'date') return 'none';
  if (valExpr.includes('.toUpperCase()')) return 'uppercase';
  if (valExpr.includes('.toLowerCase()')) return 'lowercase';
  if (valExpr.includes('.trim()')) return 'trim';
  if (existingTransform) return existingTransform;
  return 'trim';
}

/**
 * In-depth Parser: Generates Visual Table fields from a JavaScript mapping script.
 *
 * Supports:
 * - `helpers.setInput(selector, value, label)`
 * - `helpers.setSelect(selector, value, label)`
 * - `helpers.setCheckbox(selector, value, label)`
 * - `helpers.setRadio(group, value, label)`
 * - Direct calls: `setInput(...)`, `setSelect(...)`, `setCheckbox(...)`, `setRadio(...)`
 * - Conditional checks: `if (record.key) setInput(...)`
 * - Return mappings: `return { key: '#selector', ... };`
 * - DOM assignments: `document.querySelector('#id').value = record.key;`
 * - Preserves existing field IDs, aliases, and settings when matching keys are found
 */
export function generateFieldsFromScript(
  scriptSource: string,
  existingFields: FormFieldMapping[] = []
): FormFieldMapping[] {
  if (!scriptSource || typeof scriptSource !== 'string' || !scriptSource.trim()) {
    return [];
  }

  const clean = stripComments(scriptSource);
  const existingMapByKey = new Map<string, FormFieldMapping>();
  const existingMapBySelector = new Map<string, FormFieldMapping>();

  for (const f of existingFields) {
    if (f.key) existingMapByKey.set(f.key.toLowerCase(), f);
    if (f.selector) existingMapBySelector.set(f.selector.trim(), f);
  }

  // Track variable assignments: e.g. const name = record.studentName;
  const variableMap = new Map<string, string>();
  const varAssignRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:record\.([a-zA-Z0-9_$]+)|record\[['"`]([^'"`]+)['"`]\]|get\(['"`]([^'"`]+)['"`]\))/g;
  let varMatch: RegExpExecArray | null;
  while ((varMatch = varAssignRegex.exec(clean)) !== null) {
    const varName = varMatch[1];
    const recKey = varMatch[2] || varMatch[3] || varMatch[4];
    if (varName && recKey) {
      variableMap.set(varName, recKey);
    }
  }

  // Track destructuring: const { studentName, dob, email } = record;
  const destructRegex = /(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*record\b/g;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = destructRegex.exec(clean)) !== null) {
    const vars = dMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const v of vars) {
      const parts = v.split(':').map((s) => s.trim());
      const recKey = parts[0];
      const localName = parts[1] || parts[0];
      variableMap.set(localName, recKey);
    }
  }

  const detectedFields: FormFieldMapping[] = [];
  const processedKeys = new Set<string>();

  // Helper to add or merge a field mapping
  const addDetectedField = (
    rawKey: string,
    rawSelector: string,
    rawLabel: string | undefined,
    helperName: string,
    valExpr: string = ''
  ) => {
    const key = rawKey.trim();
    if (!key) return;

    const lowerKey = key.toLowerCase();
    if (processedKeys.has(lowerKey)) return;
    processedKeys.add(lowerKey);

    const selector = rawSelector.trim();
    const existing = existingMapByKey.get(lowerKey) || existingMapBySelector.get(selector);

    const label = (rawLabel && rawLabel.trim()) || existing?.label || formatKeyToLabel(key);
    const type = inferFieldType(helperName, selector, key, label);
    const aliases = generateDefaultAliases(key, label, existing?.aliases);
    const transform = inferTransform(valExpr, type, existing?.transform);

    // Required check: default to true for essential identifiers, or preserve existing
    let required = existing?.required;
    if (required === undefined) {
      const isCore = /^(studentname|studentid|name|parentname|parentphone|phone|dob|dateofbirth)$/i.test(
        normalizeKey(key)
      );
      required = isCore;
    }

    detectedFields.push({
      id: existing?.id || generateFieldMappingId(),
      key,
      label,
      aliases,
      selector,
      type,
      required,
      defaultValue: existing?.defaultValue,
      transform,
      valueMapping: existing?.valueMapping,
      description: existing?.description
    });
  };

  // 1. Check helper calls: (helpers.)?(setInput|setSelect|setCheckbox|setRadio)(...)
  const helperCallRegex = /(?:helpers\.)?(setInput|setSelect|setCheckbox|setRadio)\s*\(([\s\S]*?)\)(?:;|\n|$)/g;
  let callMatch: RegExpExecArray | null;

  while ((callMatch = helperCallRegex.exec(clean)) !== null) {
    const helperName = callMatch[1];
    const argsRaw = callMatch[2];
    const args = splitArguments(argsRaw);

    if (args.length === 0) continue;

    const selector = cleanStringLiteral(args[0]);
    const valExpr = args[1] || '';
    const labelArg = args[2] ? cleanStringLiteral(args[2]) : undefined;

    // Determine key
    let key = extractKeyFromExpression(valExpr, variableMap);

    // If key not in value expression, see if enclosing `if (record.XYZ)` exists
    if (!key) {
      const matchIndex = callMatch.index;
      const precedingCode = clean.substring(Math.max(0, matchIndex - 120), matchIndex);
      const ifMatch = precedingCode.match(/if\s*\(\s*record\.([a-zA-Z0-9_$]+)/);
      if (ifMatch) {
        key = ifMatch[1];
      }
    }

    // Fallback: derive key from label or selector
    if (!key) {
      if (labelArg) {
        key = labelArg.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
      } else if (selector) {
        const idOrName = selector.match(/#([a-zA-Z0-9_-]+)|\[name=["']?([a-zA-Z0-9_-]+)["']?\]/);
        if (idOrName) {
          key = (idOrName[1] || idOrName[2]).replace(/[-]/g, '_');
        } else {
          key = selector.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
        }
      }
    }

    if (key && selector) {
      addDetectedField(key, selector, labelArg, helperName, valExpr);
    }
  }

  // 2. Check declarative return mapping: return { key: '#selector', ... };
  const returnMatch = clean.match(/return\s*\{([\s\S]*?)\};?/);
  if (returnMatch) {
    const objectBody = returnMatch[1];
    const pairRegex = /([a-zA-Z0-9_$-]+|['"][^'"]+['"])\s*:\s*['"`]([^'"`]+)['"`]/g;
    let m: RegExpExecArray | null;
    while ((m = pairRegex.exec(objectBody)) !== null) {
      const rawKey = m[1].replace(/^['"`]|['"`]$/g, '');
      const selector = m[2];
      if (rawKey && selector) {
        addDetectedField(rawKey, selector, undefined, 'setInput');
      }
    }
  }

  // 3. Check direct DOM assignments: document.querySelector('#id').value = record.key;
  const domAssignRegex = /document\.(?:querySelector|getElementById)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\.value\s*=\s*(?:record\.([a-zA-Z0-9_$]+)|record\[['"`]([^'"`]+)['"`]\])/g;
  let domMatch: RegExpExecArray | null;
  while ((domMatch = domAssignRegex.exec(clean)) !== null) {
    const rawSel = domMatch[1];
    const rawKey = domMatch[2] || domMatch[3];
    const selector = rawSel.startsWith('#') || rawSel.startsWith('[') ? rawSel : `#${rawSel}`;
    if (rawKey && selector) {
      addDetectedField(rawKey, selector, undefined, 'setInput');
    }
  }

  return detectedFields;
}

/**
 * Generates clean JavaScript mapping code from Visual Table fields.
 */
export function generateScriptFromFields(fieldList: FormFieldMapping[]): string {
  const lines: string[] = [
    '/**',
    ' * BearBox Custom Form Mapping Script',
    ' *',
    ' * Available parameters:',
    ' *   - record: Object containing parsed values { key: value, ... }',
    ' *   - rawRecord: { rawText, record } with original source context',
    ' *   - document: Target webpage DOM Document',
    ' *   - helpers: { setInput, setSelect, setCheckbox, setRadio, query, queryAll, log, dispatchEvents }',
    ' *',
    ' * You can either:',
    ' * 1. Fill elements directly: helpers.setInput("#selector", record.key);',
    ' * 2. Return a selector mapping object: return { key: "#selector", ... };',
    ' */',
    '',
    'const { setInput, setSelect, setCheckbox, setRadio, log } = helpers;',
    ''
  ];

  for (const f of fieldList) {
    const sel = f.selector || `[name="${f.key}"]`;
    if (f.type === 'select') {
      lines.push(`if (record.${f.key}) setSelect('${sel}', record.${f.key}, '${f.label}');`);
    } else if (f.type === 'checkbox') {
      lines.push(`if (record.${f.key}) setCheckbox('${sel}', record.${f.key}, '${f.label}');`);
    } else if (f.type === 'radio') {
      lines.push(`if (record.${f.key}) setRadio('${f.selector || f.key}', record.${f.key}, '${f.label}');`);
    } else {
      lines.push(`if (record.${f.key}) setInput('${sel}', record.${f.key}, '${f.label}');`);
    }
  }

  lines.push('');
  lines.push('log("Form fields populated successfully via custom mapping script.");');
  return lines.join('\n');
}
