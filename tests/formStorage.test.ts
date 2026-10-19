import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFormConfigs,
  saveFormConfig,
  deleteFormConfig,
  toggleFormConfigEnabled,
  duplicateFormConfig,
  getFormConfigById
} from '../src/services/storage';
import { getMatchingFormConfigsForUrl } from '../src/services/matcher';

describe('Form Configuration Storage & Matcher', () => {
  beforeEach(async () => {
    const configs = await getFormConfigs();
    for (const c of configs) {
      await deleteFormConfig(c.id);
    }
  });

  it('starts with an empty form config list', async () => {
    const list = await getFormConfigs();
    expect(list).toEqual([]);
  });

  it('creates, saves, and retrieves a new form configuration', async () => {
    const saved = await saveFormConfig({
      name: 'Student Admission Portal',
      description: 'Admission form mappings',
      rules: [{ id: 'r1', pattern: 'https://school.example.edu/admissions/*', matchType: 'wildcard' }],
      fields: [
        { id: 'f1', label: 'Student Name', key: 'student_name', targetSelector: '#name', type: 'text', required: true }
      ]
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Student Admission Portal');
    expect(saved.enabled).toBe(true);
    expect(saved.fields.length).toBe(1);
    expect(saved.createdAt).toBeGreaterThan(0);

    const retrieved = await getFormConfigById(saved.id);
    expect(retrieved?.name).toBe('Student Admission Portal');
  });

  it('rejects form config with empty name', async () => {
    await expect(
      saveFormConfig({
        name: '   ',
        rules: [],
        fields: []
      })
    ).rejects.toThrow('Configuration name cannot be empty');
  });

  it('rejects form config with invalid URL patterns', async () => {
    await expect(
      saveFormConfig({
        name: 'Invalid Rule Config',
        rules: [{ id: 'r1', pattern: 'ftp://bad-url.com', matchType: 'wildcard' }],
        fields: []
      })
    ).rejects.toThrow('Invalid website rule');
  });

  it('duplicates an existing form configuration cleanly with unique IDs', async () => {
    const original = await saveFormConfig({
      name: 'Registration Template',
      description: 'Base template',
      rules: [{ id: 'r1', pattern: 'https://example.com/form', matchType: 'exact' }],
      fields: [
        { id: 'f1', label: 'Email', key: 'email', targetSelector: '#email', type: 'email', required: true }
      ]
    });

    const duplicated = await duplicateFormConfig(original.id);
    expect(duplicated).not.toBeNull();
    expect(duplicated!.id).not.toBe(original.id);
    expect(duplicated!.name).toBe('Registration Template (Copy)');
    expect(duplicated!.fields.length).toBe(1);
    expect(duplicated!.fields[0].id).not.toBe(original.fields[0].id);

    const all = await getFormConfigs();
    expect(all.length).toBe(2);
  });

  it('toggles form configuration enabled state', async () => {
    const created = await saveFormConfig({
      name: 'Toggle Test Form',
      rules: [],
      fields: []
    });
    expect(created.enabled).toBe(true);

    const toggledOff = await toggleFormConfigEnabled(created.id);
    expect(toggledOff?.enabled).toBe(false);

    const toggledOn = await toggleFormConfigEnabled(created.id);
    expect(toggledOn?.enabled).toBe(true);
  });

  it('deletes form configuration cleanly', async () => {
    const created = await saveFormConfig({
      name: 'Form To Delete',
      rules: [],
      fields: []
    });

    const deleteOk = await deleteFormConfig(created.id);
    expect(deleteOk).toBe(true);

    const all = await getFormConfigs();
    expect(all.length).toBe(0);
  });

  it('matches form configurations for base URLs and subpages according to rules', async () => {
    const config = await saveFormConfig({
      name: 'University Student Form',
      rules: [
        { id: 'r1', pattern: 'https://university.org/students/*', matchType: 'wildcard' }
      ],
      fields: []
    });

    // Subpage matches
    const matches1 = getMatchingFormConfigsForUrl('https://university.org/students/new', [config]);
    expect(matches1.length).toBe(1);

    const matches2 = getMatchingFormConfigsForUrl('https://university.org/students/edit/42', [config]);
    expect(matches2.length).toBe(1);

    // Unrelated path does not match
    const noMatch = getMatchingFormConfigsForUrl('https://university.org/faculty/dashboard', [config]);
    expect(noMatch.length).toBe(0);

    // Disabled config does not match
    await toggleFormConfigEnabled(config.id, false);
    const updated = await getFormConfigs();
    const disabledMatch = getMatchingFormConfigsForUrl('https://university.org/students/new', updated);
    expect(disabledMatch.length).toBe(0);
  });
});
