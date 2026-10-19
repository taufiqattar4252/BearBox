import { describe, it, expect, beforeEach } from 'vitest';
import { executionRegistry, SafeDOMExecutionAdapter } from '../src/services/executor';
import { BearBoxScript } from '../src/types/script';

describe('BearBox Execution Framework', () => {
  beforeEach(() => {
    executionRegistry.resetSessionCache();
  });

  const sampleScript: BearBoxScript = {
    id: 'script-exec-1',
    name: 'Sample DOM Script',
    sourceCode: '// @bearbox:action\nlog: Hello from BearBox test\n',
    rules: [{ id: 'r1', pattern: 'https://example.com/*' }],
    enabled: true,
    executionMode: 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('provides safe DOM adapter and accepts enabled scripts', () => {
    const adapter = new SafeDOMExecutionAdapter();
    expect(adapter.canExecute(sampleScript)).toBe(true);
  });

  it('executes structured script actions successfully', async () => {
    const result = await executionRegistry.executeScript(sampleScript, {
      url: 'https://example.com/test',
      hostname: 'example.com',
      trigger: 'manual'
    });

    expect(result.success).toBe(true);
    expect(result.scriptId).toBe('script-exec-1');
    expect(result.output).toBeDefined();
  });

  it('prevents duplicate automatic executions in the same navigation cycle', async () => {
    const autoScript: BearBoxScript = {
      ...sampleScript,
      id: 'script-auto-1',
      executionMode: 'automatic'
    };

    const firstRun = await executionRegistry.executeScript(autoScript, {
      url: 'https://example.com/test',
      hostname: 'example.com',
      trigger: 'automatic'
    });
    expect(firstRun.success).toBe(true);

    const secondRun = await executionRegistry.executeScript(autoScript, {
      url: 'https://example.com/test',
      hostname: 'example.com',
      trigger: 'automatic'
    });
    expect(secondRun.success).toBe(true);
    expect(secondRun.output).toContain('Skipped repeated automatic execution');
  });

  it('allows manual execution even if automatic was already run', async () => {
    const script: BearBoxScript = {
      ...sampleScript,
      id: 'script-hybrid-1'
    };

    await executionRegistry.executeScript(script, {
      url: 'https://example.com/test',
      hostname: 'example.com',
      trigger: 'automatic'
    });

    const manualRun = await executionRegistry.executeScript(script, {
      url: 'https://example.com/test',
      hostname: 'example.com',
      trigger: 'manual'
    });
    expect(manualRun.success).toBe(true);
    expect(manualRun.output).not.toContain('Skipped repeated');
  });

  it('blocks access to restricted extension APIs with clear error', async () => {
    const maliciousScript: BearBoxScript = {
      id: 'script-evil',
      name: 'Sneaky Script',
      sourceCode: 'chrome.cookies.getAll({})',
      rules: [],
      enabled: true,
      executionMode: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const result = await executionRegistry.executeScript(maliciousScript, {
      url: 'https://example.com',
      hostname: 'example.com',
      trigger: 'manual'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Access to restricted extension APIs is prohibited');
  });
});
