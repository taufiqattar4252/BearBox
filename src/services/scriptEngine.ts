/**
 * BearBox Userscript Engine (Phase 2 & Phase 5)
 *
 * Implements a Tampermonkey-style userscript execution architecture:
 * - Executes website-specific automation scripts against webpage DOM
 * - Exposes the rich BearBox API (`bearbox`) and data record (`record`)
 * - Compatible with Chrome Extension Manifest V3 security boundaries
 * - Provides duplicate execution prevention across SPA route changes
 * - Handles asynchronous execution and returns per-field diagnostics
 * - Never auto-submits forms
 */

import { BearBoxScript } from '../types/script';
import { AutofillSummary, AutofillFieldResult } from '../types/formConfig';
import { createBearBoxApi } from './bearboxApi';
import { executeSafeScriptInterpretation } from './formFiller';
import { updateScriptRunResult } from './storage';

export interface ScriptExecutionOptions {
  record?: Record<string, any>;
  url?: string;
  hostname?: string;
  trigger?: 'manual' | 'automatic';
  tabId?: number;
}

export interface ScriptExecutionReport {
  success: boolean;
  scriptId: string;
  scriptName: string;
  timestamp: number;
  totalFieldsAttempted: number;
  successfulFieldsCount: number;
  failedFieldsCount: number;
  results: AutofillFieldResult[];
  logs: string[];
  output?: unknown;
  error?: string;
  message: string;
}

/**
 * Tracks execution in current navigation cycle to avoid redundant automatic executions.
 */
const executedSessions = new Set<string>();

export function resetNavigationExecutionCache(): void {
  executedSessions.clear();
}

/**
 * Normalizes input record data into a clean key-value dictionary.
 * Generates variants (snake_case, camelCase, lowercase, and common aliases)
 * so userscripts can access record fields regardless of formatting.
 */
export function normalizeRecord(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object') return {};

  const record: Record<string, any> = {};

  const setWithVariants = (rawKey: string, val: unknown) => {
    if (!rawKey || val === undefined || val === null) return;
    record[rawKey] = val;

    // Standard normalized snake_case (e.g. "Legal entity name" -> "legal_entity_name")
    const snake = rawKey
      .toLowerCase()
      .replace(/[-:=–—\t_\\/]+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    if (snake && record[snake] === undefined) record[snake] = val;

    // camelCase (e.g. "Legal entity name" -> "legalEntityName")
    const camel = rawKey
      .toLowerCase()
      .replace(/[-:=–—\t_\\/]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '');
    if (camel && record[camel] === undefined) record[camel] = val;

    // Simple lowercase (e.g. "legalentityname")
    const lower = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower && record[lower] === undefined) record[lower] = val;

    // Common keyword aliases
    if (snake.includes('legal_entity_name') || snake.includes('legal_name') || snake.includes('company_name')) {
      if (record.legal_name === undefined) record.legal_name = val;
      if (record.legalName === undefined) record.legalName = val;
    }
    if (snake.includes('trade') || snake.includes('dba')) {
      if (record.dba === undefined) record.dba = val;
    }
    if (snake.includes('tax_id') || snake.includes('ein')) {
      if (record.tax_id === undefined) record.tax_id = val;
      if (record.taxId === undefined) record.taxId = val;
    }
    if (snake.includes('vat') || snake.includes('gst')) {
      if (record.vat === undefined) record.vat = val;
    }
    if (snake.includes('duns')) {
      if (record.duns === undefined) record.duns = val;
    }
    if (snake.includes('email') && record.email === undefined) {
      record.email = val;
    }
    if ((snake.includes('phone') || snake.includes('tel')) && record.phone === undefined) {
      record.phone = val;
    }
    if (snake.includes('first_name') || snake.includes('given_name')) {
      if (record.firstName === undefined) record.firstName = val;
      if (record.first_name === undefined) record.first_name = val;
    }
    if (snake.includes('last_name') || snake.includes('family_name')) {
      if (record.lastName === undefined) record.lastName = val;
      if (record.last_name === undefined) record.last_name = val;
    }
  };

  if ('parsed' in (input as any) && (input as any).parsed) {
    for (const [k, v] of Object.entries((input as any).parsed)) {
      const val = v && typeof v === 'object' && 'value' in v ? (v as any).value : v;
      setWithVariants(k, val);
      if (v && typeof v === 'object' && (v as any).label) {
        setWithVariants((v as any).label, val);
      }
    }
  }

  if ('extractedPairs' in (input as any) && (input as any).extractedPairs) {
    for (const [k, v] of Object.entries((input as any).extractedPairs)) {
      setWithVariants(k, v);
    }
  }

  if ('fields' in (input as any) && Array.isArray((input as any).fields)) {
    for (const f of (input as any).fields) {
      if (f.key) setWithVariants(f.key, f.value);
      if (f.label) setWithVariants(f.label, f.value);
    }
  }

  for (const [k, v] of Object.entries(input as Record<string, any>)) {
    if (k !== 'parsed' && k !== 'fields' && k !== 'extractedPairs') {
      setWithVariants(k, v);
    }
  }

  return record;
}

/**
 * Executes a BearBox userscript against the current document DOM.
 */
export async function executeUserScript(
  script: BearBoxScript,
  options?: ScriptExecutionOptions
): Promise<ScriptExecutionReport> {
  const startTime = Date.now();
  const scriptId = script.id;
  const scriptName = script.name;
  const sourceCode = (script.sourceCode || '').trim();
  const record = normalizeRecord(options?.record);
  const currentUrl = options?.url || (typeof window !== 'undefined' ? window.location.href : '');

  // Session duplicate guard for automatic triggers
  if (options?.trigger === 'automatic') {
    const sessionKey = `${scriptId}:${currentUrl}`;
    if (executedSessions.has(sessionKey)) {
      return {
        success: true,
        scriptId,
        scriptName,
        timestamp: startTime,
        totalFieldsAttempted: 0,
        successfulFieldsCount: 0,
        failedFieldsCount: 0,
        results: [],
        logs: ['Notice: Skipped duplicate automatic execution in current navigation cycle.'],
        message: 'Skipped duplicate automatic execution.'
      };
    }
    executedSessions.add(sessionKey);
  }

  // Update status to running
  await updateScriptRunResult(scriptId, { status: 'running', message: 'Executing userscript...' });

  const logs: string[] = [];
  const bearbox = createBearBoxApi({
    scriptName,
    record,
    onLog: (msg) => logs.push(msg)
  });

  try {
    if (!sourceCode) {
      return {
        success: true,
        scriptId,
        scriptName,
        timestamp: startTime,
        totalFieldsAttempted: 0,
        successfulFieldsCount: 0,
        failedFieldsCount: 0,
        results: [],
        logs: ['Empty script source code; no operations executed.'],
        message: 'Script has no source code.'
      };
    }

    // Safety checks against prohibited APIs
    if (sourceCode.includes('chrome.cookies') || sourceCode.includes('chrome.management')) {
      throw new Error('Access to restricted extension internal APIs is prohibited.');
    }

    let scriptOutput: unknown = null;

    // Build the execution wrapper:
    // If the user script defined a function `runBearBoxAutofill`, call it.
    // Otherwise execute the script directly.
    const wrappedCode = `
      "use strict";
      ${sourceCode}

      if (typeof runBearBoxAutofill === 'function') {
        return await runBearBoxAutofill(record);
      }
    `;

    try {
      // Create asynchronous runner
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const runner = new AsyncFunction('bearbox', 'record', 'context', wrappedCode);
      scriptOutput = await runner(bearbox, record, {
        url: currentUrl,
        hostname: options?.hostname || '',
        trigger: options?.trigger || 'manual'
      });
    } catch (evalErr: unknown) {
      const errMsg = evalErr instanceof Error ? evalErr.message : String(evalErr);
      if (
        errMsg.includes('unsafe-eval') ||
        errMsg.includes('Content Security Policy') ||
        errMsg.includes('CSP')
      ) {
        // Fallback to Safe Script Interpretation Engine (100% CSP safe)
        logs.push('Notice: Page CSP restricted dynamic eval. Running in safe DOM interpreter mode.');

        const interpreterHelpers = {
          setInput: (sel: string, val: unknown, label?: string) => {
            bearbox.setValue(sel, val, { label });
            return true;
          },
          setValue: (sel: string, val: unknown, label?: string) => {
            bearbox.setValue(sel, val, { label });
            return true;
          },
          setSelect: (sel: string, val: unknown, label?: string) => {
            bearbox.setSelect(sel, val, { label });
            return true;
          },
          setCheckbox: (sel: string, val: unknown, label?: string) => {
            bearbox.setCheckbox(sel, val, { label });
            return true;
          },
          setRadio: (grp: string, val: unknown, label?: string) => {
            bearbox.setRadio(grp, val, { label });
            return true;
          },
          setDate: (sel: string, val: unknown, label?: string, targetFormat?: string) => {
            bearbox.setDate(sel, val, { label, targetFormat });
            return true;
          },
          autofill: (spec: any) => {
            bearbox.autofill(spec);
            return true;
          },
          log: (...args: unknown[]) => bearbox.log(...args)
        };

        executeSafeScriptInterpretation(sourceCode, record, interpreterHelpers);
      } else {
        // Runtime or syntax error from the userscript itself
        throw evalErr;
      }
    }

    // Collect recorded field results
    const results = bearbox.getResults();
    const successfulFieldsCount = results.filter((r) => r.success).length;
    const failedFieldsCount = results.filter((r) => !r.success).length;

    let overallSuccess = true;
    if (failedFieldsCount > 0) {
      overallSuccess = false;
    } else if (results.length === 0 && scriptOutput && typeof scriptOutput === 'object' && 'success' in (scriptOutput as any)) {
      overallSuccess = Boolean((scriptOutput as any).success);
    }

    const message =
      results.length > 0
        ? failedFieldsCount === 0
          ? `${successfulFieldsCount} field(s) filled successfully!`
          : `${successfulFieldsCount} filled, ${failedFieldsCount} could not be completed.`
        : 'Script executed successfully.';

    await updateScriptRunResult(scriptId, {
      status: overallSuccess ? 'success' : 'error',
      message
    });

    return {
      success: overallSuccess,
      scriptId,
      scriptName,
      timestamp: startTime,
      totalFieldsAttempted: results.length,
      successfulFieldsCount,
      failedFieldsCount,
      results,
      logs: [...logs, ...bearbox.getLogs()],
      output: scriptOutput,
      message
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateScriptRunResult(scriptId, {
      status: 'error',
      message: errorMsg
    });

    return {
      success: false,
      scriptId,
      scriptName,
      timestamp: startTime,
      totalFieldsAttempted: bearbox.getResults().length,
      successfulFieldsCount: bearbox.getResults().filter((r) => r.success).length,
      failedFieldsCount: bearbox.getResults().filter((r) => !r.success).length + 1,
      results: [
        ...bearbox.getResults(),
        {
          fieldId: 'err_runtime',
          key: 'runtime_error',
          label: 'Script Error',
          selector: 'userscript',
          value: '',
          success: false,
          elementFound: false,
          message: errorMsg
        }
      ],
      logs: [...logs, ...bearbox.getLogs(), `Error: ${errorMsg}`],
      error: errorMsg,
      message: `Script error: ${errorMsg}`
    };
  }
}

/**
 * Converts a userscript execution report into an AutofillSummary for UI display.
 */
export function reportToAutofillSummary(report: ScriptExecutionReport): AutofillSummary {
  return {
    formId: report.scriptId,
    formName: report.scriptName,
    timestamp: report.timestamp,
    totalAttempted: report.totalFieldsAttempted,
    successfulCount: report.successfulFieldsCount,
    filledCount: report.successfulFieldsCount,
    totalFields: report.totalFieldsAttempted,
    failedCount: report.failedFieldsCount,
    missingCount: 0,
    message: report.message,
    results: report.results
  };
}
