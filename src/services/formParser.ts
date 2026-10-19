/**
 * Source Data Parser for BearBox Tool 1: Custom Form Autofill
 *
 * Parses unstructured/semi-structured text records copied from Word, ChatGPT, Gemini, etc.
 * Supports:
 * - "Key: Value", "Key = Value", "Key - Value", Tab-separated records
 * - Case-insensitive alias matching
 * - Multiline values (e.g. addresses, notes)
 * - Extra blank lines, whitespace resilience
 * - Order independence (does not rely on fixed line numbers)
 * - Required field validation
 * - Value transformation (trim, uppercase, lowercase, titlecase)
 * - Option/Value mapping (e.g. Male -> M)
 * - Date format standardization for HTML5 date inputs
 */

import { FormAutofillConfig, FormFieldMapping, ParseRecordResult, ParsedFieldResult, ValueTransform } from '../types/formConfig';

/**
 * Normalizes a key or alias string for flexible, fuzzy comparison.
 * Strips colons, hyphens, underscores, extra spaces, and converts to lowercase with underscores.
 * Example: "Student Name:" -> "student_name"
 */
export function normalizeKey(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[-:=–—\t_]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Parses a string to boolean for checkbox inputs.
 */
export function parseCheckboxValue(val: string): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return ['true', 'yes', '1', 'checked', 'y', 'on'].includes(lower);
}

/**
 * Applies configured transformation rule to a parsed value.
 */
export function applyTransform(val: string, transform?: ValueTransform): string {
  if (!val) return '';
  const trimmed = val.trim();
  switch (transform) {
    case 'trim':
      return trimmed;
    case 'uppercase':
      return trimmed.toUpperCase();
    case 'lowercase':
      return trimmed.toLowerCase();
    case 'titlecase':
      return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return trimmed;
  }
}

/**
 * Attempts to parse and normalize common date string formats to HTML5 standard "YYYY-MM-DD".
 * If date cannot be parsed reliably, preserves original text.
 */
export function normalizeDateValue(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (!trimmed) return '';

  // 1. Already ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Format: DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    // Case: YYYY/MM/DD
    if (parts[0].length === 4 && p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      const mm = String(p1).padStart(2, '0');
      const dd = String(p2).padStart(2, '0');
      return `${parts[0]}-${mm}-${dd}`;
    }

    // Case: DD/MM/YYYY vs MM/DD/YYYY
    if (parts[2].length === 4) {
      const yyyy = parts[2];
      // If first number > 12, it must be DD/MM/YYYY
      if (p0 > 12 && p0 <= 31 && p1 >= 1 && p1 <= 12) {
        const dd = String(p0).padStart(2, '0');
        const mm = String(p1).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      // If second number > 12, it must be MM/DD/YYYY
      if (p1 > 12 && p1 <= 31 && p0 >= 1 && p0 <= 12) {
        const mm = String(p0).padStart(2, '0');
        const dd = String(p1).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      // Ambiguity default: DD/MM/YYYY standard international
      const dd = String(p0).padStart(2, '0');
      const mm = String(p1).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // 3. Native Date parse fallback (e.g. "14 May 2012" or "May 14, 2012")
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return trimmed;
}

/**
 * Parses raw text input against a list of target form field mappings.
 *
 * Resilient parsing engine:
 * 1. JSON records: { "first_name": "John", ... }
 * 2. Delimited lines: "Key: Value", "Key = Value", "Key\tValue", "Key - Value"
 * 3. Alternating lines: Label line followed by Value line
 * 4. Captures ALL extracted pairs so script mapping and review have access to every field
 */
export function parseRecordText(
  rawText: string,
  fieldMappings: FormFieldMapping[]
): ParseRecordResult {
  const extractedPairs: Record<string, string> = {};
  const rawKeyToValueList: { rawKey: string; normKey: string; value: string }[] = [];
  const unrecognizedLines: string[] = [];

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      fields: fieldMappings.map((f) => ({
        fieldId: f.id,
        key: f.key,
        label: f.label,
        value: f.defaultValue || '',
        required: f.required,
        type: f.type,
        selector: f.selector || (f as any).targetSelector || '',
        status: f.required && !f.defaultValue ? 'missing_required' : 'valid'
      })),
      unrecognizedLines: [],
      totalFieldsConfigured: fieldMappings.length,
      totalFieldsMatched: 0,
      missingRequiredCount: fieldMappings.filter((f) => f.required && !f.defaultValue).length,
      isValid: !fieldMappings.some((f) => f.required && !f.defaultValue),
      extractedPairs: {},
      allDetectedFields: []
    };
  }

  const trimmedRaw = rawText.trim();

  // A. Check for JSON input
  let isJson = false;
  if (trimmedRaw.startsWith('{') && trimmedRaw.endsWith('}')) {
    try {
      const parsedObj = JSON.parse(trimmedRaw);
      if (parsedObj && typeof parsedObj === 'object' && !Array.isArray(parsedObj)) {
        isJson = true;
        for (const [k, v] of Object.entries(parsedObj)) {
          const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '').trim();
          rawKeyToValueList.push({
            rawKey: k,
            normKey: normalizeKey(k),
            value: valStr
          });
        }
      }
    } catch {}
  }

  // B. Standard line parsing if not JSON
  if (!isJson) {
    const lines = rawText.split(/\r?\n/);
    const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean);

    // Count lines with standard delimiters
    let delimiterCount = 0;
    for (const l of nonEmptyLines) {
      if (l.includes(':') || l.includes('=') || l.includes('\t')) {
        delimiterCount++;
      }
    }

    if (delimiterCount > 0 || nonEmptyLines.length <= 1) {
      // Delimited parsing mode (Colon, Equals, Tab)
      let currentKey: string | null = null;
      let currentNormKey = '';
      let currentAcc: string[] = [];

      const flush = () => {
        if (currentKey) {
          const val = currentAcc.join('\n').trim();
          rawKeyToValueList.push({
            rawKey: currentKey,
            normKey: currentNormKey,
            value: val
          });
          currentKey = null;
          currentNormKey = '';
          currentAcc = [];
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let sepIdx = -1;
        const colonIdx = line.indexOf(':');
        const eqIdx = line.indexOf('=');
        const tabIdx = line.indexOf('\t');

        if (colonIdx > 0) {
          sepIdx = colonIdx;
        } else if (eqIdx > 0) {
          sepIdx = eqIdx;
        } else if (tabIdx > 0) {
          sepIdx = tabIdx;
        }

        if (sepIdx > 0) {
          flush();
          const kPart = line.substring(0, sepIdx).trim();
          const vPart = line.substring(sepIdx + 1).trim();
          currentKey = kPart;
          currentNormKey = normalizeKey(kPart);
          currentAcc = [vPart];
        } else if (currentKey) {
          // Multiline continuation
          currentAcc.push(trimmed);
        } else {
          unrecognizedLines.push(trimmed);
        }
      }
      flush();
    } else {
      // Alternating lines mode (Label on even index, Value on odd index)
      // e.g. when copying table columns: "First Name\nDavid\nLast Name\nMiller"
      for (let i = 0; i < nonEmptyLines.length; i += 2) {
        const kPart = nonEmptyLines[i];
        const vPart = i + 1 < nonEmptyLines.length ? nonEmptyLines[i + 1] : '';
        rawKeyToValueList.push({
          rawKey: kPart,
          normKey: normalizeKey(kPart),
          value: vPart
        });
      }
    }
  }

  // Build lookup index of normalized aliases -> configured field mapping
  const aliasToFieldMap = new Map<string, FormFieldMapping>();
  for (const field of fieldMappings) {
    const normLabel = normalizeKey(field.label);
    if (normLabel) aliasToFieldMap.set(normLabel, field);

    const normKey = normalizeKey(field.key);
    if (normKey) aliasToFieldMap.set(normKey, field);

    if (Array.isArray(field.aliases)) {
      for (const alias of field.aliases) {
        const normAlias = normalizeKey(alias);
        if (normAlias) aliasToFieldMap.set(normAlias, field);
      }
    }
  }

  const parsedValuesByFieldId = new Map<string, { value: string; matchedAlias: string }>();
  const allDetectedFields: ParsedFieldResult[] = [];
  const assignedFieldIds = new Set<string>();

  for (const item of rawKeyToValueList) {
    if (!item.value && !item.rawKey) continue;
    extractedPairs[item.normKey] = item.value;
    extractedPairs[item.rawKey] = item.value;

    let matchedField: FormFieldMapping | null = null;

    // 1. Direct match in configured fields
    if (aliasToFieldMap.has(item.normKey)) {
      matchedField = aliasToFieldMap.get(item.normKey)!;
    } else {
      // 2. Fuzzy match against configured fields
      const stripped = item.normKey.replace(/[^a-z0-9]/g, '');
      for (const field of fieldMappings) {
        const fKeyStripped = normalizeKey(field.key).replace(/[^a-z0-9]/g, '');
        const fLabelStripped = normalizeKey(field.label).replace(/[^a-z0-9]/g, '');
        if (
          fKeyStripped === stripped ||
          fLabelStripped === stripped ||
          (stripped.length >= 4 && (fKeyStripped.includes(stripped) || stripped.includes(fKeyStripped)))
        ) {
          matchedField = field;
          break;
        }
      }
    }

    if (matchedField) {
      assignedFieldIds.add(matchedField.id);
      parsedValuesByFieldId.set(matchedField.id, {
        value: item.value,
        matchedAlias: item.rawKey
      });
      allDetectedFields.push({
        fieldId: matchedField.id,
        key: matchedField.key,
        label: matchedField.label,
        value: item.value,
        matchedAlias: item.rawKey,
        required: matchedField.required,
        type: matchedField.type,
        selector: matchedField.selector || (matchedField as any).targetSelector || '',
        status: 'valid'
      });
    } else {
      // Dynamic detected field: capture so it is never lost!
      allDetectedFields.push({
        fieldId: `dyn_${item.normKey || allDetectedFields.length}`,
        key: item.normKey || `field_${allDetectedFields.length}`,
        label: item.rawKey,
        value: item.value,
        matchedAlias: item.rawKey,
        required: false,
        type: 'text',
        selector: '',
        status: 'valid'
      });
      // Also record in unrecognizedLines so visual mode can flag it
      unrecognizedLines.push(item.value ? `${item.rawKey}: ${item.value}` : item.rawKey);
    }
  }

  // Assemble configured fields
  const results: ParsedFieldResult[] = [];
  let missingRequiredCount = 0;
  let totalMatched = 0;

  for (const field of fieldMappings) {
    const parsed = parsedValuesByFieldId.get(field.id);
    let value = parsed ? parsed.value : (field.defaultValue || '');

    // Apply transformation
    value = applyTransform(value, field.transform);

    // Apply custom value mapping (e.g. for radios/selects: "Male" -> "M")
    if (field.valueMapping && typeof field.valueMapping === 'object') {
      const cleanValLower = value.toLowerCase();
      for (const [mapKey, mapTarget] of Object.entries(field.valueMapping)) {
        if (mapKey.toLowerCase() === cleanValLower) {
          value = mapTarget;
          break;
        }
      }
    }

    // Date normalization if input type is date
    if (field.type === 'date' && value) {
      value = normalizeDateValue(value);
    }

    const hasValue = value.length > 0;
    if (hasValue && parsed) {
      totalMatched++;
    }

    let status: ParsedFieldResult['status'] = 'valid';
    let errorMessage: string | undefined = undefined;

    if (field.required && !hasValue) {
      status = 'missing_required';
      errorMessage = `Required field "${field.label}" is missing.`;
      missingRequiredCount++;
    }

    results.push({
      fieldId: field.id,
      key: field.key,
      label: field.label,
      value,
      matchedAlias: parsed?.matchedAlias,
      required: field.required,
      type: field.type,
      selector: field.selector || (field as any).targetSelector || '',
      status,
      errorMessage
    });
  }

  return {
    fields: results,
    unrecognizedLines,
    totalFieldsConfigured: fieldMappings.length || allDetectedFields.length,
    totalFieldsMatched: allDetectedFields.length > 0 ? allDetectedFields.length : totalMatched,
    missingRequiredCount,
    isValid: missingRequiredCount === 0,
    extractedPairs,
    allDetectedFields
  };
}

export const parseDateValue = normalizeDateValue;

/**
 * Convenient wrapper that parses raw text against a FormAutofillConfig
 * and returns both the structured array and key-indexed parsed map.
 */
export function parseSourceRecord(
  rawText: string,
  config: FormAutofillConfig
): ParseRecordResult & {
  parsed: Record<string, ParsedFieldResult & { formattedValue?: string }>;
  missingRequiredKeys: string[];
  allDetectedFields: ParsedFieldResult[];
  extractedPairs: Record<string, string>;
} {
  const result = parseRecordText(rawText, config.fields);
  const parsedMap: Record<string, ParsedFieldResult & { formattedValue?: string }> = {};
  const missingRequiredKeys: string[] = [];

  // 1. Populate configured fields
  for (const f of result.fields) {
    if (f.value && f.value.trim().length > 0) {
      parsedMap[f.key] = {
        ...f,
        formattedValue: f.value
      };
    }
    // Only track missing required fields from visual table if in visual mapping mode
    if (config.mappingMode !== 'script' && f.status === 'missing_required') {
      missingRequiredKeys.push(f.key);
    }
  }

  // 2. Expose all detected dynamic fields in parsedMap so they are directly accessible
  const allDetected = result.allDetectedFields || [];
  for (const df of allDetected) {
    if (df.value && df.value.trim().length > 0 && !parsedMap[df.key]) {
      parsedMap[df.key] = {
        ...df,
        formattedValue: df.value
      };
    }
  }

  // 3. In script mode, all detected key-value pairs are valid fields for the script,
  // NOT unrecognized lines! Only genuine syntax errors or unparseable lines belong in unrecognizedLines.
  const unrecognizedLines = config.mappingMode === 'script'
    ? result.unrecognizedLines.filter((line) => {
        const trimmed = line.trim();
        const colonIdx = trimmed.indexOf(':');
        const eqIdx = trimmed.indexOf('=');
        const sepIdx = colonIdx > 0 ? colonIdx : eqIdx;
        if (sepIdx > 0) {
          const kPart = trimmed.substring(0, sepIdx).trim().toLowerCase();
          return !allDetected.some(
            (df) =>
              df.label.toLowerCase() === kPart ||
              df.key.toLowerCase() === kPart ||
              normalizeKey(df.label) === normalizeKey(kPart)
          );
        }
        return true;
      })
    : result.unrecognizedLines;

  return {
    ...result,
    unrecognizedLines,
    parsed: parsedMap,
    missingRequiredKeys,
    allDetectedFields: allDetected,
    extractedPairs: result.extractedPairs || {},
    totalFieldsConfigured: config.mappingMode === 'script' ? (allDetected.length || config.fields.length) : config.fields.length,
    totalFieldsMatched: allDetected.length > 0 ? allDetected.length : result.totalFieldsMatched,
    missingRequiredCount: missingRequiredKeys.length,
    isValid: missingRequiredKeys.length === 0
  };
}
