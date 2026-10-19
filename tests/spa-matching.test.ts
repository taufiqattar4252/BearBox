import { describe, it, expect, beforeEach } from 'vitest';
import {
  testUrlMatchesPattern,
  getMatchingScriptsForUrl,
  validatePattern
} from '../src/services/matcher';
import {
  saveScript,
  getScripts,
  deleteScript,
  toggleScriptEnabled,
  subscribeToStorageChanges
} from '../src/services/storage';
import { BearBoxScript } from '../src/types/script';

describe('BearBox — SPA Route Changes & Real-Time Sync', () => {
  beforeEach(async () => {
    // Clean up any test scripts
    const existing = await getScripts();
    for (const s of existing) {
      await deleteScript(s.id);
    }
  });

  it('handles direct navigation to a ChatGPT conversation URL', async () => {
    const script = await saveScript({
      name: 'ChatGPT Power Tools',
      sourceCode: 'console.log("ChatGPT enhanced");',
      enabled: true,
      rules: [{ id: 'rule_cgt', pattern: 'https://chatgpt.com/' }]
    });

    const conversationUrl = 'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d';
    const matches = getMatchingScriptsForUrl(conversationUrl, [script]);

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe(script.id);
    expect(matches[0].name).toBe('ChatGPT Power Tools');
  });

  it('handles SPA route transitions between different conversation paths on ChatGPT', async () => {
    const script = await saveScript({
      name: 'ChatGPT Assistant',
      sourceCode: '// Assistant code',
      enabled: true,
      rules: [{ id: 'rule_cgt', pattern: 'https://chatgpt.com/' }]
    });

    // Simulate SPA user navigation through various routes without page reload
    const routes = [
      'https://chatgpt.com/',
      'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d',
      'https://chatgpt.com/c/6ad24365-f850-83e8-bdb2-d8c1a5cba205',
      'https://chatgpt.com/settings',
      'https://chatgpt.com/g/g-12345-code-mentor',
      'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d?model=gpt-4o'
    ];

    for (const route of routes) {
      const matches = getMatchingScriptsForUrl(route, [script]);
      expect(matches.length).toBe(1);
      expect(matches[0].id).toBe(script.id);
    }

    // Navigating away to a non-matching site should return 0 matches
    const outsideRoute = 'https://example.com/some/path';
    const outsideMatches = getMatchingScriptsForUrl(outsideRoute, [script]);
    expect(outsideMatches.length).toBe(0);
  });

  it('responds correctly to enabling and disabling scripts', async () => {
    const script = await saveScript({
      name: 'ChatGPT Highlighter',
      sourceCode: '// Highlight',
      enabled: true,
      rules: [{ id: 'rule_cgt', pattern: 'https://chatgpt.com/' }]
    });

    const targetUrl = 'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d';

    // When enabled -> matches
    let currentScripts = await getScripts();
    let matches = getMatchingScriptsForUrl(targetUrl, currentScripts);
    expect(matches.length).toBe(1);

    // User toggles script to disabled
    await toggleScriptEnabled(script.id, false);
    currentScripts = await getScripts();
    matches = getMatchingScriptsForUrl(targetUrl, currentScripts);
    expect(matches.length).toBe(0); // Icon must be removed

    // User toggles script back to enabled
    await toggleScriptEnabled(script.id, true);
    currentScripts = await getScripts();
    matches = getMatchingScriptsForUrl(targetUrl, currentScripts);
    expect(matches.length).toBe(1); // Icon must reappear
  });

  it('triggers storage subscriber callbacks when scripts or rules are modified', async () => {
    let changeNotified = false;
    let modifiedKey = '';

    const unsubscribe = subscribeToStorageChanges((key) => {
      changeNotified = true;
      modifiedKey = key;
    });

    // Save a new script
    await saveScript({
      name: 'Storage Notification Test',
      sourceCode: '// test',
      enabled: true,
      rules: [{ id: 'r1', pattern: 'https://chatgpt.com/' }]
    });

    expect(changeNotified).toBe(true);
    expect(modifiedKey).toBe('bearbox_scripts');

    unsubscribe();
  });

  it('correctly handles trailing slashes in rules and target URLs', () => {
    const ruleWithSlash = 'https://chatgpt.com/';
    const ruleWithoutSlash = 'https://chatgpt.com';

    const targetWithSlash = 'https://chatgpt.com/';
    const targetWithoutSlash = 'https://chatgpt.com';
    const targetSubpath = 'https://chatgpt.com/c/123';

    expect(testUrlMatchesPattern(targetWithSlash, ruleWithSlash)).toBe(true);
    expect(testUrlMatchesPattern(targetWithoutSlash, ruleWithSlash)).toBe(true);
    expect(testUrlMatchesPattern(targetSubpath, ruleWithSlash)).toBe(true);

    expect(testUrlMatchesPattern(targetWithSlash, ruleWithoutSlash)).toBe(true);
    expect(testUrlMatchesPattern(targetWithoutSlash, ruleWithoutSlash)).toBe(true);
    expect(testUrlMatchesPattern(targetSubpath, ruleWithoutSlash)).toBe(true);
  });

  it('rejects invalid URL patterns with clear errors', () => {
    expect(validatePattern('chatgpt.com/').valid).toBe(false);
    expect(validatePattern('ftp://chatgpt.com/').valid).toBe(false);
    expect(validatePattern('https://*chatgpt.com/').valid).toBe(false);
    expect(validatePattern('').valid).toBe(false);
  });
});
