/**
 * BearBox Storage Service
 *
 * Provides a type-safe abstraction over `chrome.storage.local` with automatic
 * fallback to `localStorage` or in-memory storage for test/standalone environments.
 */

import { BearBoxScript, BearBoxSettings, FloatingIconPosition, ScriptRunStatus } from '../types/script';
import { FormAutofillConfig, FormFieldMapping } from '../types/formConfig';
import { validatePattern } from './matcher';

const STORAGE_KEYS = {
  SCRIPTS: 'bearbox_scripts',
  SETTINGS: 'bearbox_settings',
  ICON_POSITION: 'bearbox_icon_position',
  FORM_CONFIGS: 'bearbox_form_configs'
} as const;

export const DEFAULT_SETTINGS: BearBoxSettings = {
  enabledGlobally: true,
  disabledHostnames: [],
  showIconOnMatchingPages: true,
  theme: 'system'
};

/**
 * Checks if the Chrome storage API is available.
 */
function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.storage) &&
    Boolean(chrome.storage.local)
  );
}

// In-memory fallback for test runner environments where neither chrome.storage nor localStorage is present
const memoryStore: Record<string, string> = {};
const memoryListeners: Array<(changedKey: string) => void> = [];

async function rawGet(key: string): Promise<unknown> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => {
        resolve(res[key]);
      });
    });
  }

  if (typeof localStorage !== 'undefined') {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : undefined;
  }

  const inMem = memoryStore[key];
  return inMem ? JSON.parse(inMem) : undefined;
}

async function rawSet(key: string, value: unknown): Promise<void> {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  const serialized = JSON.stringify(value);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, serialized);
  } else {
    memoryStore[key] = serialized;
  }

  // Notify any in-memory subscribers (e.g. test environments)
  for (const listener of memoryListeners) {
    try {
      listener(key);
    } catch { }
  }
}

/**
 * Generates a unique, stable script ID.
 */
export function generateScriptId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `bb_${Date.now()}_${rand}`;
}

/**
 * Generates a unique rule ID.
 */
export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Retrieves all saved scripts.
 */
export async function getScripts(): Promise<BearBoxScript[]> {
  const data = await rawGet(STORAGE_KEYS.SCRIPTS);
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

/**
 * Retrieves a single script by ID.
 */
export async function getScriptById(id: string): Promise<BearBoxScript | null> {
  const scripts = await getScripts();
  return scripts.find((s) => s.id === id) || null;
}

/**
 * Saves or updates a script. Validates fields and rules before persisting.
 */
export async function saveScript(scriptData: Partial<BearBoxScript> & { name: string }): Promise<BearBoxScript> {
  if (!scriptData.name || scriptData.name.trim().length === 0) {
    throw new Error('Script name cannot be empty.');
  }

  // Validate all rules if provided
  if (scriptData.rules && scriptData.rules.length > 0) {
    for (const rule of scriptData.rules) {
      const validation = validatePattern(rule.pattern);
      if (!validation.valid) {
        throw new Error(`Invalid website rule "${rule.pattern}": ${validation.error}`);
      }
    }
  }

  const scripts = await getScripts();
  const now = Date.now();
  let savedScript: BearBoxScript;

  if (scriptData.id) {
    // Update existing script
    const existingIndex = scripts.findIndex((s) => s.id === scriptData.id);
    if (existingIndex >= 0) {
      savedScript = {
        ...scripts[existingIndex],
        ...scriptData,
        id: scriptData.id,
        updatedAt: now
      };
      scripts[existingIndex] = savedScript;
    } else {
      // Re-create or insert with provided ID
      savedScript = {
        id: scriptData.id,
        name: scriptData.name.trim(),
        description: scriptData.description?.trim() || '',
        sourceCode: scriptData.sourceCode || '',
        rules: scriptData.rules || [],
        enabled: scriptData.enabled !== undefined ? scriptData.enabled : true,
        executionMode: scriptData.executionMode || 'manual',
        runAt: scriptData.runAt || 'document_idle',
        category: scriptData.category || 'general',
        config: scriptData.config || {},
        createdAt: scriptData.createdAt || now,
        updatedAt: now
      };
      scripts.push(savedScript);
    }
  } else {
    // Create new script
    savedScript = {
      id: generateScriptId(),
      name: scriptData.name.trim(),
      description: scriptData.description?.trim() || '',
      sourceCode: scriptData.sourceCode || '',
      rules: scriptData.rules || [],
      enabled: scriptData.enabled !== undefined ? scriptData.enabled : true,
      executionMode: scriptData.executionMode || 'manual',
      runAt: scriptData.runAt || 'document_idle',
      category: scriptData.category || 'general',
      config: scriptData.config || {},
      createdAt: now,
      updatedAt: now
    };
    scripts.push(savedScript);
  }

  await rawSet(STORAGE_KEYS.SCRIPTS, scripts);
  return savedScript;
}

/**
 * Deletes a script by ID.
 */
export async function deleteScript(id: string): Promise<boolean> {
  const scripts = await getScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  if (filtered.length !== scripts.length) {
    await rawSet(STORAGE_KEYS.SCRIPTS, filtered);
    return true;
  }
  return false;
}

/**
 * Duplicates a script by ID, creating a new unique script with "(Copy)" appended.
 */
export async function duplicateScript(id: string): Promise<BearBoxScript | null> {
  const original = await getScriptById(id);
  if (!original) return null;

  const now = Date.now();
  const duplicated: BearBoxScript = {
    ...original,
    id: generateScriptId(),
    name: `${original.name} (Copy)`,
    rules: (original.rules || []).map((r) => ({ ...r, id: generateRuleId() })),
    createdAt: now,
    updatedAt: now,
    lastRunAt: undefined,
    lastRunStatus: undefined,
    lastRunMessage: undefined
  };

  const scripts = await getScripts();
  scripts.push(duplicated);
  await rawSet(STORAGE_KEYS.SCRIPTS, scripts);
  return duplicated;
}

/**
 * Exports scripts as a JSON string.
 */
export async function exportScripts(ids?: string[]): Promise<string> {
  const all = await getScripts();
  const toExport = ids && ids.length > 0 ? all.filter((s) => ids.includes(s.id)) : all;
  return JSON.stringify(
    {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      generator: 'BearBox Script Engine',
      scripts: toExport
    },
    null,
    2
  );
}

/**
 * Imports scripts from a JSON string.
 */
export async function importScripts(
  jsonContent: string
): Promise<{ importedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let importedCount = 0;

  try {
    const parsed = JSON.parse(jsonContent);
    const scriptList: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scripts)
        ? parsed.scripts
        : [];

    if (scriptList.length === 0) {
      errors.push('No valid scripts found in the provided file.');
      return { importedCount: 0, errors };
    }

    for (const rawItem of scriptList) {
      try {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const item = rawItem as Partial<BearBoxScript>;
        if (!item.name || typeof item.name !== 'string') {
          errors.push('Skipped item with missing name.');
          continue;
        }

        await saveScript({
          name: item.name.trim(),
          description: item.description?.trim() || '',
          sourceCode: item.sourceCode || '',
          rules: Array.isArray(item.rules)
            ? item.rules.map((r) => ({
              id: generateRuleId(),
              pattern: r.pattern,
              description: r.description
            }))
            : [],
          enabled: item.enabled !== undefined ? item.enabled : true,
          executionMode: item.executionMode || 'manual',
          runAt: item.runAt || 'document_idle',
          category: item.category || 'general',
          config: item.config || {}
        });

        importedCount++;
      } catch (itemErr: unknown) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(`Error importing script: ${msg}`);
      }
    }
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    errors.push(`Invalid JSON format: ${msg}`);
  }

  return { importedCount, errors };
}

/**
 * Toggles a script's enabled state.
 */
export async function toggleScriptEnabled(id: string, explicitlyEnabled?: boolean): Promise<BearBoxScript | null> {
  const scripts = await getScripts();
  const script = scripts.find((s) => s.id === id);
  if (!script) return null;

  script.enabled = explicitlyEnabled !== undefined ? explicitlyEnabled : !script.enabled;
  script.updatedAt = Date.now();

  await rawSet(STORAGE_KEYS.SCRIPTS, scripts);
  return script;
}

/**
 * Updates execution status metadata for a script.
 */
export async function updateScriptRunResult(
  id: string,
  result: { status: ScriptRunStatus; message?: string }
): Promise<void> {
  const scripts = await getScripts();
  const script = scripts.find((s) => s.id === id);
  if (!script) return;

  script.lastRunAt = Date.now();
  script.lastRunStatus = result.status;
  script.lastRunMessage = result.message;

  await rawSet(STORAGE_KEYS.SCRIPTS, scripts);
}

/**
 * Retrieves extension settings.
 */
export async function getSettings(): Promise<BearBoxSettings> {
  const data = await rawGet(STORAGE_KEYS.SETTINGS);
  if (data && typeof data === 'object') {
    return { ...DEFAULT_SETTINGS, ...(data as Record<string, unknown>) };
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Updates extension settings.
 */
export async function saveSettings(partial: Partial<BearBoxSettings>): Promise<BearBoxSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await rawSet(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

/**
 * Checks if a specific hostname is disabled by the user.
 */
export async function isHostnameDisabled(hostname: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.enabledGlobally) return true;
  return settings.disabledHostnames.includes(hostname.toLowerCase());
}

/**
 * Toggles disabled state for a specific hostname.
 */
export async function toggleHostnameDisabled(hostname: string): Promise<boolean> {
  const cleanHost = hostname.toLowerCase();
  const settings = await getSettings();
  const exists = settings.disabledHostnames.includes(cleanHost);
  let updatedList: string[];

  if (exists) {
    updatedList = settings.disabledHostnames.filter((h) => h !== cleanHost);
  } else {
    updatedList = [...settings.disabledHostnames, cleanHost];
  }

  await saveSettings({ disabledHostnames: updatedList });
  return !exists; // returns true if now disabled, false if now enabled
}

/**
 * Retrieves the stored floating icon position.
 */
export async function getIconPosition(): Promise<FloatingIconPosition | null> {
  const pos = await rawGet(STORAGE_KEYS.ICON_POSITION);
  if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
    return pos as FloatingIconPosition;
  }
  return null;
}

/**
 * Saves the floating icon position.
 */
export async function saveIconPosition(pos: FloatingIconPosition): Promise<void> {
  await rawSet(STORAGE_KEYS.ICON_POSITION, pos);
}

/**
 * Subscribes to storage changes across popup, manager, and content scripts.
 */
export function subscribeToStorageChanges(callback: (changedKey: string) => void): () => void {
  if (isChromeStorageAvailable()) {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        for (const key of Object.keys(changes)) {
          callback(key);
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  if (typeof window !== 'undefined') {
    const listener = (e: StorageEvent) => {
      if (e.key) {
        callback(e.key);
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  // Fallback to in-memory listeners
  memoryListeners.push(callback);
  return () => {
    const idx = memoryListeners.indexOf(callback);
    if (idx >= 0) {
      memoryListeners.splice(idx, 1);
    }
  };
}

/* ==========================================================================
   Tool 1: Custom Form Autofill Storage Service
   ========================================================================== */

/**
 * Generates a unique form configuration ID.
 */
export function generateFormConfigId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `form_${Date.now()}_${rand}`;
}

/**
 * Generates a unique field mapping ID.
 */
export function generateFieldMappingId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `fld_${Date.now()}_${rand}`;
}

/**
 * Retrieves all saved form autofill configurations.
 */
export async function getFormConfigs(): Promise<FormAutofillConfig[]> {
  const data = await rawGet(STORAGE_KEYS.FORM_CONFIGS);
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

/**
 * Retrieves a single form configuration by ID.
 */
export async function getFormConfigById(id: string): Promise<FormAutofillConfig | null> {
  const configs = await getFormConfigs();
  return configs.find((c) => c.id === id) || null;
}

/**
 * Saves or updates a form configuration.
 * Validates rule patterns and field mapping integrity.
 */
export async function saveFormConfig(
  configData: Partial<FormAutofillConfig> & { name: string }
): Promise<FormAutofillConfig> {
  if (!configData.name || configData.name.trim().length === 0) {
    throw new Error('Configuration name cannot be empty.');
  }

  // Validate website rules
  if (configData.rules && configData.rules.length > 0) {
    for (const rule of configData.rules) {
      const validation = validatePattern(rule.pattern);
      if (!validation.valid) {
        throw new Error(`Invalid website rule "${rule.pattern}": ${validation.error}`);
      }
    }
  }

  const configs = await getFormConfigs();
  const now = Date.now();
  let savedConfig: FormAutofillConfig;

  // Sanitize fields to ensure stable keys and aliases
  const sanitizedFields: FormFieldMapping[] = (configData.fields || []).map((field, idx) => {
    const label = field.label?.trim() || `Field ${idx + 1}`;
    const key = field.key?.trim() || label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return {
      id: field.id || generateFieldMappingId(),
      key,
      label,
      aliases: Array.isArray(field.aliases) ? field.aliases.map((a) => a.trim()).filter(Boolean) : [label],
      selector: ((field as any).targetSelector || field.selector || '').trim(),
      type: field.type || 'text',
      required: Boolean(field.required),
      defaultValue: field.defaultValue?.trim() || undefined,
      transform: field.transform || 'none',
      valueMapping: field.valueMapping || undefined,
      description: field.description?.trim() || undefined
    };
  });

  if (configData.id) {
    const existingIdx = configs.findIndex((c) => c.id === configData.id);
    if (existingIdx >= 0) {
      savedConfig = {
        ...configs[existingIdx],
        ...configData,
        id: configData.id,
        name: configData.name.trim(),
        description: configData.description?.trim() || '',
        rules: configData.rules || [],
        fields: sanitizedFields,
        mappingMode: configData.mappingMode || configs[existingIdx].mappingMode || 'visual',
        mappingScript: configData.mappingScript !== undefined ? configData.mappingScript : configs[existingIdx].mappingScript,
        enabled: configData.enabled !== undefined ? configData.enabled : true,
        updatedAt: now
      };
      configs[existingIdx] = savedConfig;
    } else {
      savedConfig = {
        id: configData.id,
        name: configData.name.trim(),
        description: configData.description?.trim() || '',
        rules: configData.rules || [],
        fields: sanitizedFields,
        mappingMode: configData.mappingMode || 'visual',
        mappingScript: configData.mappingScript || '',
        enabled: configData.enabled !== undefined ? configData.enabled : true,
        createdAt: configData.createdAt || now,
        updatedAt: now
      };
      configs.push(savedConfig);
    }
  } else {
    savedConfig = {
      id: generateFormConfigId(),
      name: configData.name.trim(),
      description: configData.description?.trim() || '',
      rules: configData.rules || [],
      fields: sanitizedFields,
      mappingMode: configData.mappingMode || 'visual',
      mappingScript: configData.mappingScript || '',
      enabled: configData.enabled !== undefined ? configData.enabled : true,
      createdAt: now,
      updatedAt: now
    };
    configs.push(savedConfig);
  }

  await rawSet(STORAGE_KEYS.FORM_CONFIGS, configs);
  return savedConfig;
}

/**
 * Deletes a form configuration by ID.
 */
export async function deleteFormConfig(id: string): Promise<boolean> {
  const configs = await getFormConfigs();
  const filtered = configs.filter((c) => c.id !== id);
  if (filtered.length !== configs.length) {
    await rawSet(STORAGE_KEYS.FORM_CONFIGS, filtered);
    return true;
  }
  return false;
}

/**
 * Toggles the enabled state of a form configuration.
 */
export async function toggleFormConfigEnabled(id: string, enabled?: boolean): Promise<FormAutofillConfig | null> {
  const configs = await getFormConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return null;

  config.enabled = enabled !== undefined ? enabled : !config.enabled;
  config.updatedAt = Date.now();
  await rawSet(STORAGE_KEYS.FORM_CONFIGS, configs);
  return config;
}

/**
 * Duplicates a form configuration with a new unique ID and "(Copy)" appended.
 */
export async function duplicateFormConfig(id: string): Promise<FormAutofillConfig | null> {
  const original = await getFormConfigById(id);
  if (!original) return null;

  const now = Date.now();
  const duplicated: FormAutofillConfig = {
    ...original,
    id: generateFormConfigId(),
    name: `${original.name} (Copy)`,
    fields: original.fields.map((f) => ({ ...f, id: generateFieldMappingId() })),
    createdAt: now,
    updatedAt: now
  };

  const configs = await getFormConfigs();
  configs.push(duplicated);
  await rawSet(STORAGE_KEYS.FORM_CONFIGS, configs);
  return duplicated;
}

/**
 * Records that a form configuration was executed/used.
 */
export async function updateFormConfigLastUsed(id: string): Promise<void> {
  const configs = await getFormConfigs();
  const config = configs.find((c) => c.id === id);
  if (config) {
    config.lastUsedAt = Date.now();
    await rawSet(STORAGE_KEYS.FORM_CONFIGS, configs);
  }
}

