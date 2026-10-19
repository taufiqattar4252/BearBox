import { describe, it, expect } from 'vitest';
import {
  validatePattern,
  testUrlMatchesPattern,
  getMatchingScriptsForUrl,
  extractHostname
} from '../src/services/matcher';
import { BearBoxScript } from '../src/types/script';

describe('Website Matcher — Pattern Validation', () => {
  it('validates base website URLs (with or without trailing slash)', () => {
    const res1 = validatePattern('https://chatgpt.com/');
    expect(res1.valid).toBe(true);
    expect(res1.normalizedPattern).toBe('https://chatgpt.com/');

    const res2 = validatePattern('https://chatgpt.com');
    expect(res2.valid).toBe(true);
    expect(res2.normalizedPattern).toBe('https://chatgpt.com/');

    const res3 = validatePattern('http://localhost:3000');
    expect(res3.valid).toBe(true);
    expect(res3.normalizedPattern).toBe('http://localhost:3000/');
  });

  it('validates Chrome-style match patterns with wildcards', () => {
    expect(validatePattern('https://example.com/*').valid).toBe(true);
    expect(validatePattern('https://*.example.com/*').valid).toBe(true);
    expect(validatePattern('http://localhost:3000/*').valid).toBe(true);
    expect(validatePattern('*://*.github.com/orgs/*').valid).toBe(true);
    expect(validatePattern('https://example.com/products/item-123').valid).toBe(true);
    expect(validatePattern('*://*/*').valid).toBe(true);
  });

  it('normalizes patterns by stripping query strings and hash fragments', () => {
    const res = validatePattern('https://chatgpt.com/c/123?model=gpt4#top');
    expect(res.valid).toBe(true);
    expect(res.normalizedPattern).toBe('https://chatgpt.com/c/123');
  });

  it('rejects empty or whitespace-only patterns', () => {
    expect(validatePattern('').valid).toBe(false);
    expect(validatePattern('   ').valid).toBe(false);
  });

  it('rejects patterns with missing or invalid schemes', () => {
    expect(validatePattern('example.com/*').valid).toBe(false);
    expect(validatePattern('ftp://example.com/*').valid).toBe(false);
    expect(validatePattern('custom://example.com/*').valid).toBe(false);
  });

  it('rejects invalid wildcards in host', () => {
    expect(validatePattern('https://foo.*.bar.com/*').valid).toBe(false);
    expect(validatePattern('https://*example.com/*').valid).toBe(false);
    expect(validatePattern('https://example.*/*').valid).toBe(false);
  });
});

describe('Website Matcher — Exact ChatGPT Scenario', () => {
  const chatGptRule = 'https://chatgpt.com/';

  it('matches origin root https://chatgpt.com/', () => {
    expect(testUrlMatchesPattern('https://chatgpt.com/', chatGptRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com', chatGptRule)).toBe(true);
  });

  it('matches conversation subpaths https://chatgpt.com/c/123', () => {
    expect(testUrlMatchesPattern('https://chatgpt.com/c/123', chatGptRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d', chatGptRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/c/6ad24365-f850-83e8-bdb2-d8c1a5cba205', chatGptRule)).toBe(true);
  });

  it('matches settings and deep paths', () => {
    expect(testUrlMatchesPattern('https://chatgpt.com/settings', chatGptRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/a/b/c', chatGptRule)).toBe(true);
  });

  it('matches URLs containing query parameters and fragments', () => {
    expect(testUrlMatchesPattern('https://chatgpt.com/c/123?model=x', chatGptRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/c/123?model=x&mode=pro#anchor', chatGptRule)).toBe(true);
  });

  it('does NOT match unrelated origins or domain suffixes', () => {
    expect(testUrlMatchesPattern('https://chatgpt.com.example.org/', chatGptRule)).toBe(false);
    expect(testUrlMatchesPattern('https://chatgpt.com.evil.com/c/123', chatGptRule)).toBe(false);
    expect(testUrlMatchesPattern('https://example.com/', chatGptRule)).toBe(false);
    expect(testUrlMatchesPattern('https://otherchatgpt.com/', chatGptRule)).toBe(false);
  });

  it('does NOT match http for an https-only rule', () => {
    expect(testUrlMatchesPattern('http://chatgpt.com/', chatGptRule)).toBe(false);
    expect(testUrlMatchesPattern('http://chatgpt.com/c/123', chatGptRule)).toBe(false);
  });

  it('supports equivalent trailing-slash variants in rules', () => {
    // When user enters rule without trailing slash: "https://chatgpt.com"
    const noSlashRule = 'https://chatgpt.com';
    expect(testUrlMatchesPattern('https://chatgpt.com/', noSlashRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/c/123', noSlashRule)).toBe(true);
    expect(testUrlMatchesPattern('https://chatgpt.com/settings', noSlashRule)).toBe(true);
  });
});

describe('Website Matcher — Wildcard and Path Boundary Rules', () => {
  it('handles subdomain wildcard (*.domain.com)', () => {
    const pattern = 'https://*.example.com/*';
    expect(testUrlMatchesPattern('https://example.com/', pattern)).toBe(true);
    expect(testUrlMatchesPattern('https://app.example.com/dashboard', pattern)).toBe(true);
    expect(testUrlMatchesPattern('https://api.v2.example.com/test', pattern)).toBe(true);

    // Must not match unrelated domains
    expect(testUrlMatchesPattern('https://myexample.com/', pattern)).toBe(false);
    expect(testUrlMatchesPattern('https://example.org/', pattern)).toBe(false);
  });

  it('handles scheme wildcard (*://)', () => {
    const pattern = '*://example.com/*';
    expect(testUrlMatchesPattern('https://example.com/test', pattern)).toBe(true);
    expect(testUrlMatchesPattern('http://example.com/test', pattern)).toBe(true);
    expect(testUrlMatchesPattern('ftp://example.com/test', pattern)).toBe(false);
  });

  it('handles specific path prefixes with boundary enforcement', () => {
    const pattern = 'https://example.com/products';
    expect(testUrlMatchesPattern('https://example.com/products', pattern)).toBe(true);
    expect(testUrlMatchesPattern('https://example.com/products/', pattern)).toBe(true);
    expect(testUrlMatchesPattern('https://example.com/products/shoes', pattern)).toBe(true);
    expect(testUrlMatchesPattern('https://example.com/products/shoes/red', pattern)).toBe(true);

    // Must not match sibling words that start with the prefix
    expect(testUrlMatchesPattern('https://example.com/products-discount', pattern)).toBe(false);
    expect(testUrlMatchesPattern('https://example.com/productstore', pattern)).toBe(false);
    expect(testUrlMatchesPattern('https://example.com/orders', pattern)).toBe(false);
  });

  it('handles port numbers on localhost', () => {
    const pattern = 'http://localhost:3000/';
    expect(testUrlMatchesPattern('http://localhost:3000/', pattern)).toBe(true);
    expect(testUrlMatchesPattern('http://localhost:3000/app', pattern)).toBe(true);
    expect(testUrlMatchesPattern('http://localhost:8080/', pattern)).toBe(false);
  });
});

describe('Website Matcher — Script Filtering and Enabled State', () => {
  const enabledChatGptScript: BearBoxScript = {
    id: 'script-chatgpt',
    name: 'ChatGPT Assistant',
    sourceCode: '// chatgpt script',
    enabled: true,
    executionMode: 'manual',
    rules: [{ id: 'r_cgt', pattern: 'https://chatgpt.com/' }],
    createdAt: 1000,
    updatedAt: 1000
  };

  const disabledChatGptScript: BearBoxScript = {
    id: 'script-chatgpt-disabled',
    name: 'ChatGPT Disabled',
    sourceCode: '// disabled script',
    enabled: false,
    executionMode: 'manual',
    rules: [{ id: 'r_cgt_dis', pattern: 'https://chatgpt.com/' }],
    createdAt: 1000,
    updatedAt: 1000
  };

  const otherScript: BearBoxScript = {
    id: 'script-github',
    name: 'GitHub Tools',
    sourceCode: '// github script',
    enabled: true,
    executionMode: 'automatic',
    rules: [{ id: 'r_gh', pattern: 'https://github.com/*' }],
    createdAt: 1000,
    updatedAt: 1000
  };

  it('matches conversation URL for enabled script', () => {
    const scripts = [enabledChatGptScript, otherScript];
    const matches = getMatchingScriptsForUrl(
      'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d',
      scripts
    );
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('script-chatgpt');
  });

  it('excludes matching scripts when they are disabled', () => {
    const scripts = [disabledChatGptScript];
    const matches = getMatchingScriptsForUrl(
      'https://chatgpt.com/c/6ad250e7-ccb8-83ec-9eef-343d3b5c623d',
      scripts
    );
    expect(matches.length).toBe(0);
  });

  it('returns empty array when URL does not match any script rules', () => {
    const scripts = [enabledChatGptScript, otherScript];
    const matches = getMatchingScriptsForUrl('https://google.com/search', scripts);
    expect(matches.length).toBe(0);
  });

  it('extracts hostnames cleanly', () => {
    expect(extractHostname('https://chatgpt.com/c/123')).toBe('chatgpt.com');
    expect(extractHostname('https://github.com/torvalds/linux')).toBe('github.com');
    expect(extractHostname('http://localhost:3000/')).toBe('localhost');
    expect(extractHostname('invalid-url')).toBe('invalid-url');
  });
});
