/**
 * BearBox Script Execution Architecture
 *
 * Implements a secure, modular execution framework adhering to Manifest V3
 * security policies and Chrome Web Store guidelines.
 *
 * Designed with pluggable execution adapters so that when the true purpose of
 * user scripts is defined, new runtime adapters can be plugged in without
 * modifying UI or storage layers.
 */

import { BearBoxScript, ExecutionContext, ExecutionResult } from '../types/script';
import { updateScriptRunResult } from './storage';
import { executeUserScript } from './scriptEngine';

/**
 * Interface that all BearBox execution adapters must implement.
 */
export interface IExecutionAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  /**
   * Checks whether this adapter can handle the given script.
   */
  canExecute(script: BearBoxScript, context: ExecutionContext): boolean;

  /**
   * Executes the script within the defined context.
   */
  execute(script: BearBoxScript, context: ExecutionContext): Promise<ExecutionResult>;
}

/**
 * Standard Safe DOM & Action Execution Adapter
 *
 * Operates safely within the content script's isolated world or page context.
 * Provides a structured execution sandbox that handles DOM operations,
 * page inspection, element queries, visual highlights, and structured commands.
 */
export class SafeDOMExecutionAdapter implements IExecutionAdapter {
  readonly id = 'safe-dom-adapter';
  readonly name = 'Safe DOM & Structured Execution Engine';
  readonly description = 'Executes safe, DOM-aware actions, visual highlights, and structured commands in isolated world.';

  canExecute(script: BearBoxScript): boolean {
    return Boolean(script && script.enabled);
  }

  async execute(script: BearBoxScript, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const scriptId = script.id;

    try {
      if (!script.sourceCode || script.sourceCode.trim().length === 0) {
        return {
          success: true,
          scriptId,
          timestamp: startTime,
          output: 'Script has no source code; execution completed as no-op.',
          mode: context.trigger
        };
      }

      // Check for common security violations or restricted dynamic code
      const trimmedSource = script.sourceCode.trim();
      if (trimmedSource.includes('chrome.cookies') || trimmedSource.includes('chrome.management')) {
        throw new Error('Access to restricted extension APIs is prohibited for user scripts.');
      }

      // Check if running in a real browser environment with DOM access
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return {
          success: true,
          scriptId,
          timestamp: startTime,
          output: `[Simulated Environment] Script "${script.name}" executed successfully.`,
          mode: context.trigger
        };
      }

      // Parse structured directives or perform safe DOM operations
      const logs: string[] = [];
      const safeContext = {
        url: context.url,
        hostname: context.hostname,
        title: document.title,
        timestamp: new Date().toISOString(),
        log: (...args: unknown[]) => {
          const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          logs.push(msg);
          console.log(`[BearBox Script: ${script.name}]`, ...args);
        },
        highlight: (selector: string, color = 'rgba(37, 99, 235, 0.2)') => {
          const els = document.querySelectorAll(selector);
          els.forEach((el) => {
            (el as HTMLElement).style.outline = `3px solid ${color}`;
            (el as HTMLElement).style.transition = 'outline 0.3s ease';
          });
          logs.push(`Highlighted ${els.length} element(s) matching "${selector}"`);
          return els.length;
        },
        querySelector: (selector: string) => {
          const el = document.querySelector(selector);
          return el ? { tagName: el.tagName, text: el.textContent?.trim().substring(0, 100) } : null;
        }
      };

      // Execute structured action or safe script evaluation
      // In Chrome Extension MV3, arbitrary eval is restricted by default CSP.
      // We implement a dual-mode executor:
      // 1. If script is declarative / structured, execute through safe commands.
      // 2. If user provided custom JS code, attempt clean dispatch or page script injection if CSP allows,
      //    or provide clear security-compliant reporting.
      let executionOutput: unknown = null;
      if (trimmedSource.startsWith('// @bearbox:action') || trimmedSource.startsWith('/* @bearbox:action */')) {
        // Structured directive format
        executionOutput = this.executeStructuredDirectives(trimmedSource, safeContext);
        const finalOutput = logs.length > 0 ? logs.join('\n') : executionOutput || 'Execution completed successfully.';
        return {
          success: true,
          scriptId,
          timestamp: startTime,
          output: finalOutput,
          mode: context.trigger
        };
      }

      // Execute via BearBox Userscript Engine
      const report = await executeUserScript(script, {
        url: context.url,
        hostname: context.hostname,
        trigger: context.trigger
      });

      return {
        success: report.success,
        scriptId,
        timestamp: startTime,
        output: report.output || report.message || (report.logs.length > 0 ? report.logs.join('\n') : 'Execution completed successfully.'),
        error: report.error,
        mode: context.trigger
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        scriptId,
        timestamp: startTime,
        error: errorMsg,
        mode: context.trigger
      };
    }
  }

  private executeStructuredDirectives(
    source: string,
    safeContext: {
      log: (...args: unknown[]) => void;
      highlight: (selector: string, color?: string) => number;
      querySelector: (selector: string) => unknown;
    }
  ): Record<string, unknown> {
    const lines = source.split('\n');
    const actionsExecuted: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('highlight:')) {
        const selector = trimmed.replace('highlight:', '').trim();
        const count = safeContext.highlight(selector);
        actionsExecuted.push(`highlighted ${count} matching "${selector}"`);
      } else if (trimmed.startsWith('log:')) {
        const text = trimmed.replace('log:', '').trim();
        safeContext.log(text);
        actionsExecuted.push(`log: ${text}`);
      }
    }

    return { actions: actionsExecuted };
  }
}

/**
 * Execution Registry to allow plugging in future script runtimes
 */
class ExecutionRegistry {
  private adapters: IExecutionAdapter[] = [];
  private executedInCurrentSession = new Set<string>();

  constructor() {
    // Register standard safe DOM execution adapter by default
    this.registerAdapter(new SafeDOMExecutionAdapter());
  }

  registerAdapter(adapter: IExecutionAdapter): void {
    this.adapters.unshift(adapter); // newer adapters take precedence
  }

  getAdapters(): IExecutionAdapter[] {
    return [...this.adapters];
  }

  /**
   * Resets the session execution cache (e.g. on full navigation or page reload).
   */
  resetSessionCache(): void {
    this.executedInCurrentSession.clear();
  }

  /**
   * Executes a script using the best matching adapter.
   */
  async executeScript(script: BearBoxScript, context: ExecutionContext): Promise<ExecutionResult> {
    // If automatic trigger, prevent repeated executions on the same page state
    const sessionKey = `${script.id}:${context.url}`;
    if (context.trigger === 'automatic') {
      if (this.executedInCurrentSession.has(sessionKey)) {
        return {
          success: true,
          scriptId: script.id,
          timestamp: Date.now(),
          output: 'Skipped repeated automatic execution in current navigation cycle.',
          mode: 'automatic'
        };
      }
      this.executedInCurrentSession.add(sessionKey);
    }

    // Set running state in storage
    await updateScriptRunResult(script.id, { status: 'running', message: 'Executing...' });

    // Find capable adapter
    const adapter = this.adapters.find((a) => a.canExecute(script, context));
    if (!adapter) {
      const errorMsg = 'No compatible execution adapter found for this script.';
      await updateScriptRunResult(script.id, { status: 'error', message: errorMsg });
      return {
        success: false,
        scriptId: script.id,
        timestamp: Date.now(),
        error: errorMsg,
        mode: context.trigger
      };
    }

    const result = await adapter.execute(script, context);

    // Save final status in storage
    await updateScriptRunResult(script.id, {
      status: result.success ? 'success' : 'error',
      message: result.success ? (typeof result.output === 'string' ? result.output : 'Success') : result.error
    });

    return result;
  }
}

export const executionRegistry = new ExecutionRegistry();
