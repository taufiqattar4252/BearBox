import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScripts,
  saveScript,
  deleteScript,
  toggleScriptEnabled,
  getSettings,
  saveSettings,
  toggleHostnameDisabled,
  saveIconPosition,
  getIconPosition,
  generateScriptId
} from '../src/services/storage';

describe('BearBox Storage Service', () => {
  beforeEach(async () => {
    // Clear storage before each test
    const scripts = await getScripts();
    for (const s of scripts) {
      await deleteScript(s.id);
    }
  });

  it('starts with an empty script list', async () => {
    const scripts = await getScripts();
    expect(scripts).toEqual([]);
  });

  it('creates and saves a new script with generated ID and timestamps', async () => {
    const saved = await saveScript({
      name: 'Test Automation',
      description: 'Automates test tasks',
      sourceCode: 'console.log("hello test");',
      executionMode: 'manual',
      rules: [{ id: 'r1', pattern: 'https://example.com/*' }]
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Test Automation');
    expect(saved.enabled).toBe(true);
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.updatedAt).toBeGreaterThan(0);

    const all = await getScripts();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(saved.id);
  });

  it('validates rule patterns on save and throws error for invalid rules', async () => {
    await expect(
      saveScript({
        name: 'Invalid Pattern Script',
        sourceCode: '',
        rules: [{ id: 'r1', pattern: 'ftp://bad-scheme.com/*' }]
      })
    ).rejects.toThrow('Invalid website rule');
  });

  it('rejects script with empty name', async () => {
    await expect(
      saveScript({
        name: '   ',
        sourceCode: ''
      })
    ).rejects.toThrow('Script name cannot be empty');
  });

  it('updates an existing script preserving creation timestamp', async () => {
    const created = await saveScript({
      name: 'Initial Name',
      sourceCode: 'code v1',
      rules: []
    });

    const updated = await saveScript({
      id: created.id,
      name: 'Updated Name',
      sourceCode: 'code v2',
      createdAt: created.createdAt
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated Name');
    expect(updated.sourceCode).toBe('code v2');
    expect(updated.createdAt).toBe(created.createdAt);

    const all = await getScripts();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Updated Name');
  });

  it('toggles script enabled status', async () => {
    const created = await saveScript({
      name: 'Toggle Test',
      sourceCode: '',
      rules: []
    });
    expect(created.enabled).toBe(true);

    const toggled = await toggleScriptEnabled(created.id);
    expect(toggled?.enabled).toBe(false);

    const reToggled = await toggleScriptEnabled(created.id);
    expect(reToggled?.enabled).toBe(true);
  });

  it('deletes a script cleanly', async () => {
    const created = await saveScript({
      name: 'To Delete',
      sourceCode: '',
      rules: []
    });

    const deleteResult = await deleteScript(created.id);
    expect(deleteResult).toBe(true);

    const all = await getScripts();
    expect(all.length).toBe(0);
  });

  it('persists and retrieves settings and host disabling', async () => {
    const initialSettings = await getSettings();
    expect(initialSettings.enabledGlobally).toBe(true);
    expect(initialSettings.disabledHostnames).toEqual([]);

    const isDisabled1 = await toggleHostnameDisabled('badsite.com');
    expect(isDisabled1).toBe(true);

    const settingsAfterDisable = await getSettings();
    expect(settingsAfterDisable.disabledHostnames).toContain('badsite.com');

    const isDisabled2 = await toggleHostnameDisabled('badsite.com');
    expect(isDisabled2).toBe(false);
  });

  it('saves and retrieves icon position', async () => {
    await saveIconPosition({ x: 120, y: 340, normalizedX: 0.8, normalizedY: 0.5 });
    const pos = await getIconPosition();
    expect(pos).toEqual({ x: 120, y: 340, normalizedX: 0.8, normalizedY: 0.5 });
  });
});
