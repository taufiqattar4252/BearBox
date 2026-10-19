/**
 * Core type definitions for BearBox Chrome Extension
 */

export type ExecutionMode = 'manual' | 'automatic';

export type ScriptRunStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScriptRule {
  id: string;
  pattern: string; // e.g. "https://*.example.com/*", "https://github.com/*"
  description?: string;
}

export interface ScriptConfig {
  [key: string]: unknown;
}

export interface BearBoxScript {
  id: string;
  name: string;
  description?: string;
  sourceCode: string;
  rules: ScriptRule[];
  enabled: boolean;
  executionMode: ExecutionMode;
  runAt?: 'document_idle' | 'document_start' | 'document_end';
  category?: 'autofill' | 'automation' | 'general';
  config?: ScriptConfig;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunStatus?: ScriptRunStatus;
  lastRunMessage?: string;
}

export interface FloatingIconPosition {
  x: number; // Viewport pixel X coordinate
  y: number; // Viewport pixel Y coordinate
  normalizedX?: number; // 0 to 1 relative to viewport width
  normalizedY?: number; // 0 to 1 relative to viewport height
}

export interface BearBoxSettings {
  enabledGlobally: boolean;
  disabledHostnames: string[];
  iconPosition?: FloatingIconPosition;
  showIconOnMatchingPages: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface WebsiteMatchResult {
  isMatch: boolean;
  matchedRules: ScriptRule[];
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  scriptId: string;
  timestamp: number;
  output?: unknown;
  error?: string;
  mode: ExecutionMode;
}

export interface ExecutionContext {
  url: string;
  hostname: string;
  tabId?: number;
  trigger: 'manual' | 'automatic';
}
