/**
 * Website Matching Engine for BearBox
 *
 * Implements centralized, robust website matching supporting:
 * 1. Base website rules (e.g. "https://chatgpt.com/" or "https://chatgpt.com")
 *    which match the origin and every path on that origin (/c/123, /settings, /a/b/c).
 * 2. Chrome-style match patterns with wildcards (*://*.example.com/*, https://example.com/*).
 * 3. Specific path prefixes with safe path-boundary enforcement (/products matches /products/123 but not /products-discount).
 * 4. Scheme isolation (https-only rules do not match http).
 * 5. Ignoring query strings and hash fragments during origin/path evaluation.
 */

import { BearBoxScript, ScriptRule } from '../types/script';
import { FormAutofillConfig } from '../types/formConfig';

export interface PatternValidationResult {
  valid: boolean;
  error?: string;
  normalizedPattern?: string;
}

/**
 * Validates and normalizes a website matching pattern.
 * Supports:
 * - Base website URLs: "https://chatgpt.com/", "https://chatgpt.com"
 * - Chrome match patterns: "https://*.example.com/*", "<all_urls>", "http://localhost:3000/*"
 * - Subpaths: "https://example.com/shop/*", "https://example.com/shop"
 */
export function validatePattern(rawPattern: string): PatternValidationResult {
  if (!rawPattern || typeof rawPattern !== 'string') {
    return { valid: false, error: 'Rule pattern cannot be empty.' };
  }

  const trimmed = rawPattern.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Rule pattern cannot be empty.' };
  }

  // Strip query string and hash from the rule if entered by the user
  const cleanPattern = trimmed.split('?')[0].split('#')[0];

  // Check for scheme separator
  const schemeSplit = cleanPattern.split('://');
  if (schemeSplit.length !== 2) {
    return {
      valid: false,
      error: 'Pattern must include a valid scheme separator "://" (e.g., https://chatgpt.com/ or *://*.example.com/*).'
    };
  }

  const [schemeRaw, rest] = schemeSplit;
  const scheme = schemeRaw.toLowerCase();

  // Validate scheme: must be http, https, *, or file
  const allowedSchemes = ['http', 'https', '*', 'file'];
  if (!allowedSchemes.includes(scheme)) {
    return {
      valid: false,
      error: `Invalid scheme "${schemeRaw}". Supported schemes are: http, https, * (or file).`
    };
  }

  // Extract host and path
  const firstSlashIndex = rest.indexOf('/');
  let host = firstSlashIndex === -1 ? rest : rest.substring(0, firstSlashIndex);
  let path = firstSlashIndex === -1 ? '/' : rest.substring(firstSlashIndex);

  // Validate host
  if (host.length === 0) {
    return { valid: false, error: 'Host cannot be empty.' };
  }

  // Normalize host: lowercase hostname
  const hostParts = host.split(':');
  const hostname = hostParts[0].toLowerCase();
  const port = hostParts[1];

  if (hostname !== '*') {
    // Check wildcards in host
    const starCount = (hostname.match(/\*/g) || []).length;
    if (starCount > 1) {
      return {
        valid: false,
        error: 'Host can only contain at most one wildcard "*" at the start (e.g., *.example.com).'
      };
    }
    if (starCount === 1) {
      if (!hostname.startsWith('*.')) {
        return {
          valid: false,
          error: 'Host wildcard must be at the very start followed by a period (e.g., *.example.com).'
        };
      }
      const domainAfterStar = hostname.substring(2);
      if (!domainAfterStar || domainAfterStar.includes('*')) {
        return {
          valid: false,
          error: 'Invalid domain after "*.". Expected domain like *.example.com.'
        };
      }
    }

    // Check for invalid characters in host
    const validHostRegex = /^(\*\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+|:\*)?$/;
    const fullHost = port !== undefined ? `${hostname}:${port}` : hostname;
    if (!validHostRegex.test(fullHost)) {
      return {
        valid: false,
        error: `Host "${host}" contains invalid characters. Use valid hostnames (e.g., chatgpt.com, *.github.com, localhost:3000).`
      };
    }
  }

  // Ensure path starts with '/'
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const normalizedHost = port !== undefined ? `${hostname}:${port}` : hostname;
  const normalizedPattern = `${scheme}://${normalizedHost}${path}`;

  return {
    valid: true,
    normalizedPattern
  };
}

/**
 * Escapes characters with special meaning in RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a match pattern or base URL rule into a RegExp for URL testing.
 * Compatible with base website rules, prefix rules, and wildcard patterns.
 */
export function patternToRegex(pattern: string): RegExp | null {
  const validation = validatePattern(pattern);
  if (!validation.valid || !validation.normalizedPattern) {
    return null;
  }

  const [scheme, rest] = validation.normalizedPattern.split('://');
  const firstSlashIndex = rest.indexOf('/');
  const host = rest.substring(0, firstSlashIndex);
  const path = rest.substring(firstSlashIndex);

  // Scheme regex
  let schemeRegex: string;
  if (scheme === '*') {
    schemeRegex = 'https?';
  } else {
    schemeRegex = escapeRegex(scheme);
  }

  // Host regex
  let hostRegex: string;
  const [hostname, port] = host.split(':');

  if (hostname === '*') {
    hostRegex = '[^:/]+';
  } else if (hostname.startsWith('*.')) {
    const baseDomain = escapeRegex(hostname.substring(2));
    hostRegex = `([a-zA-Z0-9-]+\\.)*${baseDomain}`;
  } else {
    hostRegex = escapeRegex(hostname);
  }

  // Port regex
  if (port) {
    if (port === '*') {
      hostRegex += '(:\\d+)?';
    } else {
      hostRegex += `:${escapeRegex(port)}`;
    }
  } else {
    hostRegex += '(:\\d+)?';
  }

  // Path regex
  let pathRegex: string;
  if (path.includes('*')) {
    // Wildcard path pattern
    const wildcardSegments = path
      .split('*')
      .map((segment) => escapeRegex(segment))
      .join('.*');
    pathRegex = `${wildcardSegments}(\\?.*)?(#.*)?$`;
  } else if (path === '/' || path === '') {
    // Base website rule: matches root AND any subpath on this origin!
    pathRegex = '(\\/.*)?(\\?.*)?(#.*)?$';
  } else {
    // Specific path prefix without wildcards (e.g. /products)
    const normalizedPrefix = path.endsWith('/') ? path.slice(0, -1) : path;
    const escapedPrefix = escapeRegex(normalizedPrefix);
    pathRegex = `(${escapedPrefix}|${escapedPrefix}\\/.*)(\\?.*)?(#.*)?$`;
  }

  const fullRegexString = `^${schemeRegex}:\\/\\/${hostRegex}${pathRegex}`;
  return new RegExp(fullRegexString, 'i');
}

/**
 * Centralized, safe, and reusable website matching function.
 * Tests whether a target page URL matches a given rule pattern.
 *
 * Safe component parsing via URL API:
 * - Checks protocol equality (or wildcard '*').
 * - Checks hostname equality (or wildcard subdomain '*.domain.com' or '*').
 * - Checks port compatibility.
 * - Compares paths with path-boundary prefix semantics for base rules.
 * - Safely ignores query strings and fragments on the target page.
 */
export function testUrlMatchesPattern(targetUrl: string, rawPattern: string): boolean {
  if (!targetUrl || !rawPattern) return false;

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return false;
  }

  // Only match supported schemes
  const targetScheme = target.protocol.replace(':', '').toLowerCase();
  if (!['http', 'https', 'file'].includes(targetScheme)) {
    return false;
  }

  const validation = validatePattern(rawPattern);
  if (!validation.valid || !validation.normalizedPattern) {
    return false;
  }

  const [ruleScheme, rest] = validation.normalizedPattern.split('://');

  // 1. SCHEME MATCHING
  if (ruleScheme !== '*' && ruleScheme !== targetScheme) {
    return false;
  }

  // Split host and path
  const slashIdx = rest.indexOf('/');
  const ruleHostRaw = slashIdx === -1 ? rest : rest.substring(0, slashIdx);
  const rulePathRaw = slashIdx === -1 ? '/' : rest.substring(slashIdx);

  // 2. HOST & PORT MATCHING
  const [ruleHost, rulePort] = ruleHostRaw.split(':');
  const targetHostname = target.hostname.toLowerCase();
  const targetPort = target.port;

  // Check port if specified in rule
  if (rulePort !== undefined && rulePort !== '*') {
    if (rulePort !== targetPort) {
      // Check standard default ports
      const isDefaultTarget =
        (targetPort === '' && ((targetScheme === 'http' && rulePort === '80') || (targetScheme === 'https' && rulePort === '443'))) ||
        (rulePort === '' && ((targetScheme === 'http' && targetPort === '80') || (targetScheme === 'https' && targetPort === '443')));
      if (!isDefaultTarget) {
        return false;
      }
    }
  }

  // Check hostname
  const ruleHostname = ruleHost.toLowerCase();
  if (ruleHostname === '*') {
    // Wildcard matches all hosts
  } else if (ruleHostname.startsWith('*.')) {
    // Subdomain wildcard: *.chatgpt.com matches chatgpt.com or sub.chatgpt.com
    const baseDomain = ruleHostname.substring(2);
    if (targetHostname !== baseDomain && !targetHostname.endsWith('.' + baseDomain)) {
      return false;
    }
  } else {
    // Exact hostname match
    if (targetHostname !== ruleHostname) {
      return false;
    }
  }

  // 3. PATH MATCHING
  // Ignore query string and hash on target URL for matching
  const targetPath = target.pathname || '/';

  // Normalize rule path (strip query and hash if present in pattern)
  const cleanRulePath = rulePathRaw.split('?')[0].split('#')[0] || '/';

  // Case A: Rule has wildcards in path (e.g. /*, /products/*, /c/*, /*/edit)
  if (cleanRulePath.includes('*')) {
    const pathRegexStr = cleanRulePath
      .split('*')
      .map(escapeRegex)
      .join('.*');
    const pathRegex = new RegExp(`^${pathRegexStr}$`, 'i');
    return pathRegex.test(targetPath);
  }

  // Case B: Base website rule (path is '/' or empty)
  // E.g. 'https://chatgpt.com/' or 'https://chatgpt.com'
  // Matches the origin root AND ANY subpath on this origin!
  if (cleanRulePath === '/' || cleanRulePath === '') {
    return true;
  }

  // Case C: Base URL with specific path prefix, e.g. '/products' or '/products/'
  const normalizedRulePrefix = cleanRulePath.endsWith('/')
    ? cleanRulePath.slice(0, -1)
    : cleanRulePath;

  // Path boundary check: exact match or followed by a path slash '/'
  if (targetPath === normalizedRulePrefix || targetPath.startsWith(normalizedRulePrefix + '/')) {
    return true;
  }

  return false;
}

/**
 * Finds all rules from a script that match the given URL.
 */
export function getMatchingRulesForScript(url: string, script: BearBoxScript): ScriptRule[] {
  if (!script.enabled || !script.rules || script.rules.length === 0) {
    return [];
  }
  return script.rules.filter((rule) => testUrlMatchesPattern(url, rule.pattern));
}

/**
 * Filters a list of scripts to only those that are enabled and have at least
 * one matching rule for the given URL.
 */
export function getMatchingScriptsForUrl(url: string, scripts: BearBoxScript[]): BearBoxScript[] {
  if (!url || !Array.isArray(scripts)) return [];
  return scripts.filter((script) => {
    if (!script.enabled) return false;
    return script.rules && script.rules.some((rule) => testUrlMatchesPattern(url, rule.pattern));
  });
}

/**
 * Filters a list of form autofill configurations to only those that are enabled
 * and have at least one matching rule for the given URL.
 */
export function getMatchingFormConfigsForUrl(url: string, configs: FormAutofillConfig[]): FormAutofillConfig[] {
  if (!url || !Array.isArray(configs)) return [];
  return configs.filter((config) => {
    if (!config.enabled) return false;
    return config.rules && config.rules.some((rule) => testUrlMatchesPattern(url, rule.pattern));
  });
}

/**
 * Extracts a clean hostname from a URL.
 */
export function extractHostname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
}
