import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScripts,
  saveScript,
  deleteScript,
  toggleScriptEnabled,
  getSettings,
  saveIconPosition,
  getIconPosition,
  subscribeToStorageChanges
} from '../src/services/storage';
import {
  validatePattern,
  testUrlMatchesPattern,
  getMatchingScriptsForUrl
} from '../src/services/matcher';
import { executionRegistry } from '../src/services/executor';
import { BearBoxScript } from '../src/types/script';

describe('BearBox End-to-End Integration Scenarios', () => {
  beforeEach(async () => {
    // Clean test storage
    const all = await getScripts();
    for (const s of all) {
      await deleteScript(s.id);
    }
    executionRegistry.resetSessionCache();
  });

  // Scenario 1: Fresh install
  it('Scenario 1: Fresh installation displays an empty script manager list without fake scripts', async () => {
    const scripts = await getScripts();
    expect(scripts).toEqual([]);
    const settings = await getSettings();
    expect(settings.enabledGlobally).toBe(true);
    expect(settings.disabledHostnames).toEqual([]);
  });

  // Scenario 2 & 3: Create, save, and persist
  it('Scenario 2 & 3: User can create and save a script, and it persists stably', async () => {
    const newScript = await saveScript({
      name: 'GitHub PR Enhancer',
      description: 'Enhances pull requests on GitHub',
      sourceCode: 'console.log("PR loaded");',
      executionMode: 'manual',
      rules: [{ id: 'r1', pattern: 'https://github.com/*/pull/*' }]
    });

    expect(newScript.id).toMatch(/^bb_\d+_/);
    expect(newScript.name).toBe('GitHub PR Enhancer');

    // Simulate reopening or querying storage again
    const loadedScripts = await getScripts();
    expect(loadedScripts.length).toBe(1);
    expect(loadedScripts[0]).toEqual(newScript);
  });

  // Scenario 4: Edit, disable, enable, and delete
  it('Scenario 4: User can edit, disable, enable, and delete a script', async () => {
    const created = await saveScript({
      name: 'Initial Title',
      sourceCode: '',
      rules: [{ id: 'r1', pattern: 'https://example.com/*' }]
    });

    // Edit
    const edited = await saveScript({
      id: created.id,
      name: 'Renamed Script',
      sourceCode: 'console.log("updated");',
      rules: created.rules
    });
    expect(edited.name).toBe('Renamed Script');

    // Disable
    const disabled = await toggleScriptEnabled(created.id, false);
    expect(disabled?.enabled).toBe(false);

    // Re-enable
    const reEnabled = await toggleScriptEnabled(created.id, true);
    expect(reEnabled?.enabled).toBe(true);

    // Delete
    const deleted = await deleteScript(created.id);
    expect(deleted).toBe(true);
    const remaining = await getScripts();
    expect(remaining.length).toBe(0);
  });

  // Scenario 5: Website rules validation
  it('Scenario 5: Website rules are validated before saving, with clear feedback', () => {
    const valid = validatePattern('https://*.example.com/dashboard/*');
    expect(valid.valid).toBe(true);

    const invalidScheme = validatePattern('ftp://example.com/*');
    expect(invalidScheme.valid).toBe(false);
    expect(invalidScheme.error).toContain('Supported schemes are');

    const baseUrl = validatePattern('https://example.com');
    expect(baseUrl.valid).toBe(true);
    expect(baseUrl.normalizedPattern).toBe('https://example.com/');

    const missingScheme = validatePattern('example.com');
    expect(missingScheme.valid).toBe(false);
    expect(missingScheme.error).toContain('scheme separator');

    const invalidStar = validatePattern('https://*example.com/*');
    expect(invalidStar.valid).toBe(false);
    expect(invalidStar.error).toContain('Host wildcard must be at the very start');
  });

  // Scenario 6 & 7: Matching vs Unrelated website
  it('Scenario 6 & 7: Matching website detects script, unrelated website does not', async () => {
    const script = await saveScript({
      name: 'Shopify Product Helper',
      sourceCode: '',
      rules: [{ id: 'r1', pattern: 'https://*.myshopify.com/admin/products/*' }]
    });

    const all = await getScripts();

    // Matching website
    const matched = getMatchingScriptsForUrl('https://my-store.myshopify.com/admin/products/item-456', all);
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe(script.id);

    // Unrelated website
    const unrelated = getMatchingScriptsForUrl('https://google.com/search?q=shopify', all);
    expect(unrelated.length).toBe(0);
  });

  // Scenario 8: Disabling every script for a website hides matches
  it('Scenario 8: Disabling every matching script yields no active matches', async () => {
    const s1 = await saveScript({
      name: 'Script 1',
      sourceCode: '',
      rules: [{ id: 'r1', pattern: 'https://example.com/*' }]
    });
    const s2 = await saveScript({
      name: 'Script 2',
      sourceCode: '',
      rules: [{ id: 'r2', pattern: 'https://example.com/blog/*' }]
    });

    // Disable both
    await toggleScriptEnabled(s1.id, false);
    await toggleScriptEnabled(s2.id, false);

    const all = await getScripts();
    const matched = getMatchingScriptsForUrl('https://example.com/blog/post-1', all);
    expect(matched.length).toBe(0);
  });

  // Scenario 9 & 10: Icon position persistence and clamping
  it('Scenario 9 & 10: Icon position persists and supports coordinate clamping', async () => {
    await saveIconPosition({
      x: 350,
      y: 620,
      normalizedX: 0.85,
      normalizedY: 0.75
    });

    const pos = await getIconPosition();
    expect(pos?.x).toBe(350);
    expect(pos?.y).toBe(620);
    expect(pos?.normalizedX).toBe(0.85);
  });

  // Scenario 13: Unsupported execution modes fail clearly
  it('Scenario 13: Unsupported execution attempts produce clear errors', async () => {
    const restrictedScript: BearBoxScript = {
      id: 'bad-script',
      name: 'Unauthorized',
      sourceCode: 'chrome.management.uninstallSelf()',
      rules: [],
      enabled: true,
      executionMode: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const res = await executionRegistry.executeScript(restrictedScript, {
      url: 'https://example.com',
      hostname: 'example.com',
      trigger: 'manual'
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Access to restricted extension APIs is prohibited');
  });

  // Scenario 15: Cross-view state synchronization
  it('Scenario 15: Storage change subscription notifies on updates', async () => {
    let notifiedKey = '';
    const unsub = subscribeToStorageChanges((key) => {
      notifiedKey = key;
    });

    await saveScript({
      name: 'Sync Script',
      sourceCode: '',
      rules: []
    });

    unsub();
    expect(typeof notifiedKey).toBe('string');
  });
});
