import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Zap,
  Table,
  CheckCircle2,
  Terminal,
  Bot,
  FileText,
  Layers,
  Globe,
  Database,
  MousePointer,
  BookOpen,
  Sliders,
  Clipboard,
  Shield,
  Clock,
  Code,
  Download,
  RefreshCw
} from 'lucide-react';

interface ScriptGuideTabProps {
  onSwitchToScripts?: () => void;
  onSwitchToForms?: () => void;
}

type MainToolSection = 'tool1' | 'tool2' | 'tool3' | 'tool4' | 'tool5' | 'tool6' | 'api' | 'ai-hub';

export const ScriptGuideTab: React.FC<ScriptGuideTabProps> = () => {
  const [activeSection, setActiveSection] = useState<MainToolSection>('tool1');

  // Sub-tab states for each tool
  const [tool1SubTab, setTool1SubTab] = useState<'ai-prompt' | 'option1' | 'option2' | 'comparison' | 'examples'>('ai-prompt');
  const [tool2SubTab, setTool2SubTab] = useState<'ai-prompt' | 'workflows' | 'popups' | 'monitor' | 'examples'>('ai-prompt');
  const [tool3SubTab, setTool3SubTab] = useState<'ai-prompt' | 'table-json' | 'card-grid' | 'export-copy' | 'pagination'>('ai-prompt');
  const [tool4SubTab, setTool4SubTab] = useState<'picker-guide' | 'resilient-selectors' | 'shadow-dom' | 'cheatsheet'>('picker-guide');
  const [tool5SubTab, setTool5SubTab] = useState<'url-patterns' | 'spa-lifecycle' | 'timing-triggers' | 'troubleshooting'>('url-patterns');
  const [tool6SubTab, setTool6SubTab] = useState<'how-it-works' | 'data-formats' | 'fuzzy-matching' | 'examples'>('how-it-works');
  const [apiSubTab, setApiSubTab] = useState<'bearbox-core' | 'bearbox-inputs' | 'helpers' | 'events'>('bearbox-core');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 3000);
    }
  };

  // ==========================================================================
  // MASTER PROMPTS FOR AI
  // ==========================================================================

  const MASTER_AI_PROMPT = `You are an expert browser automation engineer specializing in the BearBox Chrome Extension.

Your task is to analyze the target webpage form HTML or field list provided at the end of this prompt and generate a 100% compliant, ready-to-use BearBox script.

================================================================================
BEARBOX SCRIPT ARCHITECTURE SPECIFICATION (TOOL 1: FORM AUTOFILL)
================================================================================

BearBox supports TWO ways to write form autofill scripts:

--------------------------------------------------------------------------------
OPTION 1: Declarative & Helper Script (Best for standard forms, 95% of use cases)
--------------------------------------------------------------------------------
- Environment: Synchronous, safe, zero-boilerplate runtime.
- Input: An object named 'record' containing parsed keys (e.g., record.fullName, record.email).
  * BearBox automatically creates camelCase, snake_case, lowercase, and original label aliases.
- Built-in Helpers available in scope:
  * helpers.setInput(selector, value, label?)
    Populates text, textarea, email, tel, number, and HTML5 date inputs.
    Automatically dispatches input, change, and blur events, and resets React _valueTracker.
  * helpers.setSelect(selector, valueOrText, label?)
    Selects option in <select> dropdown by exact value or visible text.
  * helpers.setCheckbox(selector, booleanOrTruthy, label?)
    Sets checkbox checked status.
  * helpers.setRadio(nameOrSelector, valueOrLabel, label?)
    Selects matching radio in a radio button group.
  * helpers.setDate(selector, dateValue, label?, format?)
    Formats and populates dates (auto-detects ISO YYYY-MM-DD or custom format).
  * helpers.log(message)
    Logs diagnostics safely without leaking sensitive PII.

Option 1 Code Structure:
const { setInput, setSelect, setCheckbox, setRadio, setDate, log } = helpers;

if (record.fullName) setInput('#full-name, input[name="full_name"]', record.fullName, 'Full Name');
if (record.email) setInput('#email, input[name="email"]', record.email, 'Email Address');
if (record.phone) setInput('input[type="tel"], [name="phone"]', record.phone, 'Phone');
if (record.country) setSelect('select[name="country"]', record.country, 'Country');
if (record.gender) setRadio('gender', record.gender, 'Gender');
if (record.agree) setCheckbox('#agree-terms', record.agree, 'Terms');
log('Form fields populated successfully.');

Alternatively, Option 1 can simply return a selector mapping object:
return {
  fullName: '#full-name, input[name="full_name"]',
  email: '#email, input[name="email"]',
  phone: 'input[name="phone"]',
  country: 'select[name="country"]'
};

--------------------------------------------------------------------------------
OPTION 2: Programmatic Userscript Engine (Best for complex SPAs, wizards, dynamic forms)
--------------------------------------------------------------------------------
- Environment: Tampermonkey-style asynchronous context.
- Function signature:
  async function runBearBoxAutofill(record) { ... return bearbox.getResults(); }
- Built-in BearBox API available in scope:
  * await bearbox.setValue(selector, value, { label?: string, overwrite?: boolean })
  * await bearbox.setSelect(selector, valueOrText, { label?: string })
  * await bearbox.setCheckbox(selector, boolean, { label?: string })
  * await bearbox.setRadio(nameOrSelector, valueOrLabel, { label?: string })
  * await bearbox.setDate(selector, dateValue, { label?: string, targetFormat?: string })
  * await bearbox.waitFor(selector, { timeout?: number }) // Waits for dynamic elements
  * bearbox.getResults() // Returns field execution report
  * bearbox.log(msg) // Safe logging

Option 2 Code Structure:
async function runBearBoxAutofill(record) {
  const name = record.fullName || \`\${record.firstName || ''} \${record.lastName || ''}\`.trim();

  if (name) await bearbox.setValue('input[name="full_name"]', name, { label: 'Full Name' });
  if (record.email) await bearbox.setValue('input[name="email"]', record.email, { label: 'Email' });
  if (record.country) await bearbox.setSelect('select[name="country"]', record.country, { label: 'Country' });
  if (record.dob) await bearbox.setDate('input[name="dob"]', record.dob, { label: 'Date of Birth' });

  return bearbox.getResults();
}

================================================================================
INSTRUCTIONS FOR THE AI:
================================================================================
1. Inspect the form HTML, fields, or inputs provided below.
2. Choose Option 1 (recommended for standard single-page forms) or Option 2 (for multi-step wizards or dynamic React/Vue SPAs with delayed inputs).
3. Use robust CSS selectors (combining IDs and name attributes, e.g. '#user-email, input[name="email"]').
4. Output the complete, copy-paste ready BearBox script inside a single javascript code block.
5. Provide a brief 2-bullet summary: Option chosen and list of mapped fields.

================================================================================
TARGET WEBPAGE & FORM INPUTS (Provided by User):
================================================================================
URL: [Enter target website URL here e.g. https://example.com/form]
Target Form HTML / Input Elements:
[PASTE YOUR FORM HTML OR LIST OF INPUT FIELDS HERE]
`;

  const TOOL2_AUTOMATION_AI_PROMPT = `You are an expert browser automation developer specializing in BearBox Chrome Extension scripts.

Your task is to write a BearBox Web Automation script for a target website.

BearBox Automation Environment:
- The script executes directly in the target webpage context.
- Built-in 'bearbox' object provides:
  * await bearbox.waitFor(selector, { timeout: 5000 }): waits for elements to appear.
  * bearbox.$(selector): document.querySelector shortcut.
  * bearbox.$$(selector): document.querySelectorAll shortcut.
  * bearbox.click(selector): safe click with event dispatch.
  * bearbox.log(...messages): safe console output.
  * bearbox.setValue(selector, value): sets input value bypassing React state shadowing.
  * bearbox.wait(milliseconds): async delay helper.

Requirements:
1. Handle dynamic elements gracefully using await bearbox.waitFor().
2. Add safe condition guards before clicking buttons or modifying DOM elements.
3. Output the script as an async function run() or top-level statements inside a javascript code block.

Target Website / Action Description:
[DESCRIBE WHAT YOU WANT AUTOMATED OR PASTE RELEVANT HTML HERE]`;

  const TOOL3_SCRAPER_AI_PROMPT = `You are a data extraction specialist writing a BearBox Data Scraper script.

Your task is to write a BearBox script that extracts data from a webpage table, card grid, or search results and copies it to the user's clipboard as JSON/CSV.

BearBox Scraper Environment:
- Standard DOM Document API is available.
- 'bearbox' object provides:
  * bearbox.$$(selector): querySelectorAll array.
  * bearbox.copy(text): copies text directly to clipboard.
  * bearbox.log(message): logs output.

Requirements:
1. Query rows, cards, or items using clean CSS selectors.
2. Map text contents into clean, trimmed JSON records.
3. Copy the formatted JSON or CSV to the clipboard and show a confirmation alert or console log.
4. Output the ready-to-run script inside a single javascript code block.

Target Webpage HTML or Table Structure:
[PASTE WEBPAGE HTML TABLE / LIST STRUCTURE HERE]`;

  const TOOL4_SELECTOR_AI_PROMPT = `You are a CSS selector engineer for the BearBox Chrome Extension.

Your task is to examine HTML elements and generate the most resilient, stable CSS selectors that will not break when website classes or build hashes change.

Guidelines:
1. Prioritize stable attributes: id, name, data-testid, role, aria-label, for.
2. Avoid auto-generated build hashes (e.g. avoid .css-19v8x4, .sc-bdVaJa, Tailwind dynamic utility chains).
3. If IDs might be dynamic, use fallback chains (e.g. '#user_email, input[name="email"], input[type="email"]').
4. Provide the selector and a brief explanation why it was selected.

HTML Elements to analyze:
[PASTE HTML FRAGMENT HERE]`;

  const TOOL5_URL_MATCHING_AI_PROMPT = `You are a URL pattern matching expert for BearBox Chrome Extension.

Given a list of URLs or user scenarios, write the optimal BearBox matching rules.

BearBox Matching Syntax:
- Wildcards: '*' matches any characters inside path or subdomain.
- Domain rules: 'https://example.com/*' matches any page on example.com.
- Subdomain rules: 'https://*.example.com/*' matches subdomains like portal.example.com.
- Global rules: '*://*/checkout*' matches any domain having /checkout in URL.

User URLs / Requirements:
[ENTER TARGET URLS OR DOMAIN PATTERNS HERE]`;

  const TOOL6_CLIPBOARD_AI_PROMPT = `You are a data formatting specialist for BearBox's 1-Click "Paste & Fill" engine.

Your task is to convert raw unstructured text (resumes, invoices, KYC docs, user sheets) into clean JSON or Key:Value format that matches BearBox form keys.

Requirements:
1. Output clean key-value pairs or JSON object.
2. Normalize dates to YYYY-MM-DD.
3. Normalize phone numbers and strip unnecessary punctuation.
4. Provide the exact text that can be copied directly to the clipboard for 1-Click Paste & Fill.

Raw Text to Convert:
[PASTE YOUR RAW UNSTRUCTURED TEXT HERE]`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0d1a36 100%)',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '28px 32px',
          boxShadow: 'var(--bb-shadow-md)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="bb-badge bb-badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <BookOpen size={12} />
                BEARBOX DEVELOPER HUB
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: '#d8b4fe',
                  border: '1px solid rgba(168, 85, 247, 0.3)'
                }}
              >
                MULTI-TOOL SCRIPTING MASTERCLASS
              </span>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              BearBox Script Writing &amp; AI Prompt Guide
            </h2>

            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
              Comprehensive sub-page guides, ready-to-copy code templates, and master AI prompts for every single tool in BearBox: Form Autofill (Tool 1), Web Automation (Tool 2), Data Scraping (Tool 3), Visual Field Picker (Tool 4), URL Matching Rules (Tool 5), and 1-Click Paste &amp; Fill (Tool 6).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="bb-btn bb-btn-primary"
              style={{
                backgroundColor: '#7c3aed',
                borderColor: '#6d28d9',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600
              }}
              onClick={() => handleCopy(MASTER_AI_PROMPT, 'hero-master')}
            >
              {copiedKey === 'hero-master' ? <Check size={16} /> : <Bot size={16} />}
              {copiedKey === 'hero-master' ? 'Copied Master AI Prompt!' : 'Copy Master AI Prompt'}
            </button>
          </div>
        </div>

        {/* Top-Level Tool Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '18px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSection('tool1')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool1' ? '#2563eb' : '#090d16',
              color: activeSection === 'tool1' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool1' ? '#2563eb' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={14} />
            Tool 1: Form Autofill
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>5 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tool2')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool2' ? '#059669' : '#090d16',
              color: activeSection === 'tool2' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool2' ? '#059669' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={14} />
            Tool 2: Web Automation
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>5 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tool3')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool3' ? '#d97706' : '#090d16',
              color: activeSection === 'tool3' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool3' ? '#d97706' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Database size={14} />
            Tool 3: Data Scraper
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>5 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tool4')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool4' ? '#0284c7' : '#090d16',
              color: activeSection === 'tool4' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool4' ? '#0284c7' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <MousePointer size={14} />
            Tool 4: Selector Picker
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>4 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tool5')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool5' ? '#6366f1' : '#090d16',
              color: activeSection === 'tool5' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool5' ? '#6366f1' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={14} />
            Tool 5: URL Rules &amp; SPAs
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>4 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tool6')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'tool6' ? '#ec4899' : '#090d16',
              color: activeSection === 'tool6' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'tool6' ? '#ec4899' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Clipboard size={14} />
            Tool 6: 1-Click Paste &amp; Fill
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>4 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('api')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'api' ? '#475569' : '#090d16',
              color: activeSection === 'api' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'api' ? '#475569' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Terminal size={14} />
            API Reference
            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>4 SUB-PAGES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ai-hub')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeSection === 'ai-hub' ? '#7c3aed' : '#090d16',
              color: activeSection === 'ai-hub' ? '#ffffff' : '#94a3b8',
              border: `1px solid ${activeSection === 'ai-hub' ? '#7c3aed' : '#1e293b'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <Bot size={14} />
            🤖 AI Prompt Hub
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: TOOL 1 - FORM AUTOFILL & DATA MAPPING                          */}
      {/* ========================================================================= */}
      {activeSection === 'tool1' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 1 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool1SubTab === 'ai-prompt' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool1SubTab('ai-prompt')}
            >
              <Bot size={14} /> AI Prompt for Tool 1
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool1SubTab === 'option1' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool1SubTab('option1')}
            >
              <Zap size={14} /> Option 1: Declarative &amp; Helpers
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool1SubTab === 'option2' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool1SubTab('option2')}
            >
              <Terminal size={14} /> Option 2: Programmatic Userscript
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool1SubTab === 'comparison' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool1SubTab('comparison')}
            >
              <Table size={14} /> When to Use Which
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool1SubTab === 'examples' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool1SubTab('examples')}
            >
              <CheckCircle2 size={14} /> Benchmarks &amp; Examples
            </button>
          </div>

          {tool1SubTab === 'ai-prompt' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #7c3aed', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#171a2e', padding: '14px 20px', borderBottom: '1px solid #2e2850', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={16} style={{ color: '#c084fc' }} />
                    Tool 1 Master AI Prompt (Option 1 &amp; Option 2)
                  </span>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Copy this prompt into ChatGPT, Claude, Gemini, or DeepSeek with your HTML form to get instant scripts!
                  </div>
                </div>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#7c3aed', borderColor: '#6d28d9', padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => handleCopy(MASTER_AI_PROMPT, 'tool1-prompt')}
                >
                  {copiedKey === 'tool1-prompt' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'tool1-prompt' ? 'Copied Prompt!' : 'Copy AI Prompt'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '16px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, maxHeight: '420px', overflowY: 'auto' }}>
                {MASTER_AI_PROMPT}
              </pre>
            </div>
          )}

          {tool1SubTab === 'option1' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-primary">TOOL 1: OPTION 1</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Declarative Helpers &amp; Auto-Sync Visual Table
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Option 1 is synchronous, 100% CSP-Safe in Chrome MV3 without <code>eval</code>, and automatically synchronizes with the BearBox Form Visual Table.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Option 1 Helper Script Template</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`const { setInput, setSelect, setCheckbox, setRadio, setDate, log } = helpers;

if (record.fullName) setInput('#full-name, input[name="full_name"]', record.fullName, 'Full Name');
if (record.email) setInput('#email, input[name="email"]', record.email, 'Email Address');
if (record.phone) setInput('input[type="tel"], [name="phone"]', record.phone, 'Phone Number');
if (record.country) setSelect('select[name="country"]', record.country, 'Country');
if (record.agree) setCheckbox('#agree-terms', record.agree, 'Terms');
if (record.dob) setDate('#dob, [name="dob"]', record.dob, 'Date of Birth');

log("Form populated successfully.");`, 'opt1-code')}
                  >
                    {copiedKey === 'opt1-code' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'opt1-code' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`const { setInput, setSelect, setCheckbox, setRadio, setDate, log } = helpers;

if (record.fullName) setInput('#full-name, input[name="full_name"]', record.fullName, 'Full Name');
if (record.email) setInput('#email, input[name="email"]', record.email, 'Email Address');
if (record.phone) setInput('input[type="tel"], [name="phone"]', record.phone, 'Phone Number');
if (record.country) setSelect('select[name="country"]', record.country, 'Country');
if (record.agree) setCheckbox('#agree-terms', record.agree, 'Terms');
if (record.dob) setDate('#dob, [name="dob"]', record.dob, 'Date of Birth');

log("Form populated successfully.");`}
                </pre>
              </div>
            </div>
          )}

          {tool1SubTab === 'option2' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-success">TOOL 1: OPTION 2</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Programmatic Userscript Engine (<code>runBearBoxAutofill</code>)
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Option 2 gives you full async/await power. Use <code>bearbox.waitFor</code>, multi-step tab clicks, and custom calculations.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Option 2 Async Function Template</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`async function runBearBoxAutofill(record) {
  const fullName = record.fullName || \`\${record.firstName || ''} \${record.lastName || ''}\`.trim();

  if (fullName) await bearbox.setValue('input[name="full_name"]', fullName, { label: 'Full Name' });
  if (record.email) await bearbox.setValue('input[name="email"]', record.email, { label: 'Email' });
  if (record.country) await bearbox.setSelect('select[name="country"]', record.country, { label: 'Country' });
  if (record.dob) await bearbox.setDate('input[name="dob"]', record.dob, { label: 'Date of Birth' });

  return bearbox.getResults();
}`, 'opt2-code')}
                  >
                    {copiedKey === 'opt2-code' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 'opt2-code' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`async function runBearBoxAutofill(record) {
  const fullName = record.fullName || \`\${record.firstName || ''} \${record.lastName || ''}\`.trim();

  if (fullName) await bearbox.setValue('input[name="full_name"]', fullName, { label: 'Full Name' });
  if (record.email) await bearbox.setValue('input[name="email"]', record.email, { label: 'Email' });
  if (record.country) await bearbox.setSelect('select[name="country"]', record.country, { label: 'Country' });
  if (record.dob) await bearbox.setDate('input[name="dob"]', record.dob, { label: 'Date of Birth' });

  return bearbox.getResults();
}`}
                </pre>
              </div>
            </div>
          )}

          {tool1SubTab === 'comparison' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                Tool 1: Option 1 vs Option 2 Comparison Matrix
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#090d16', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f8fafc' }}>Feature / Capability</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#60a5fa' }}>Option 1 (Helpers)</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#34d399' }}>Option 2 (Userscript)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Target Form Complexity</td>
                      <td style={{ padding: '10px 14px' }}>Standard single-page forms (95% of web)</td>
                      <td style={{ padding: '10px 14px' }}>Multi-step wizards, SPAs with delayed inputs</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Visual Table Two-Way Sync</td>
                      <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 600 }}>✓ Automatic Two-Way Sync</td>
                      <td style={{ padding: '10px 14px' }}>Custom script mode</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Multi-Step Button Clicks</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>Visible DOM only</td>
                      <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 600 }}>✓ Supported (clicks next, tabs, popups)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Dynamic Asynchronous Waiting</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>Immediate</td>
                      <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 600 }}>✓ await bearbox.waitFor(selector)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Security &amp; CSP Policy</td>
                      <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 600 }}>100% CSP-Safe (No eval)</td>
                      <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 600 }}>Isolated userscript context</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tool1SubTab === 'examples' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <span className="bb-badge bb-badge-primary">BENCHMARK</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '8px 0 6px 0' }}>
                  Ranasi Vendor KYC (87 Fields) — Option 2
                </h4>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                  Autofills 87 legal, banking, tax, and rep fields with 100% accuracy.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px', marginBottom: '8px' }}
                  onClick={() => handleCopy(`async function runBearBoxAutofill(record) {
  await bearbox.setValue('input[name="legal_name"]', record.legal_name || 'Northwind Traders Inc.');
  await bearbox.setValue('input[name="tax_id"]', record.tax_id || '12-3456789');
  await bearbox.setSelect('select[name="entity_type"]', record.entity_type || 'Corporation (C-Corp)');
  await bearbox.setDate('input[name="rep_dob"]', record.rep_dob || '1980-01-11');
  return bearbox.getResults();
}`, 'ex1')}
                >
                  {copiedKey === 'ex1' ? <Check size={12} /> : <Copy size={12} />} Copy Benchmark Code
                </button>
              </div>

              <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <span className="bb-badge bb-badge-primary">BENCHMARK</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '8px 0 6px 0' }}>
                  Student Registration Form — Option 1
                </h4>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                  Demonstrates <code>setInput</code>, <code>setSelect</code>, <code>setRadio</code>, and <code>setDate</code>.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px', marginBottom: '8px' }}
                  onClick={() => handleCopy(`const { setInput, setSelect, setRadio, setDate } = helpers;
if (record.studentName) setInput('#student-name', record.studentName);
if (record.class) setSelect('#class-select', record.class);
if (record.section) setRadio('section', record.section);
if (record.dob) setDate('#dob', record.dob);`, 'ex2')}
                >
                  {copiedKey === 'ex2' ? <Check size={12} /> : <Copy size={12} />} Copy Benchmark Code
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: TOOL 2 - WEB AUTOMATION & USERSCRIPTS                          */}
      {/* ========================================================================= */}
      {activeSection === 'tool2' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 2 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool2SubTab === 'ai-prompt' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool2SubTab('ai-prompt')}
            >
              <Bot size={14} /> AI Prompt for Automation
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool2SubTab === 'workflows' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool2SubTab('workflows')}
            >
              <Zap size={14} /> Clickers &amp; Action Pipelines
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool2SubTab === 'popups' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool2SubTab('popups')}
            >
              <Shield size={14} /> Cookie &amp; Popup Dismissers
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool2SubTab === 'monitor' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool2SubTab('monitor')}
            >
              <RefreshCw size={14} /> Auto-Refresh &amp; Monitors
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool2SubTab === 'examples' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool2SubTab('examples')}
            >
              <Code size={14} /> Ready-to-Use Scripts
            </button>
          </div>

          {/* Sub-tab 1: AI Prompt */}
          {tool2SubTab === 'ai-prompt' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #059669', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#09231b', padding: '14px 20px', borderBottom: '1px solid #064e3b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={16} style={{ color: '#34d399' }} />
                    Tool 2 Web Automation Master AI Prompt
                  </span>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Paste this prompt into ChatGPT or Claude with your automation task or target HTML to get immediate code!
                  </div>
                </div>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#047857', padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL2_AUTOMATION_AI_PROMPT, 'tool2-prompt')}
                >
                  {copiedKey === 'tool2-prompt' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'tool2-prompt' ? 'Copied Prompt!' : 'Copy AI Prompt'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '16px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, maxHeight: '420px', overflowY: 'auto' }}>
                {TOOL2_AUTOMATION_AI_PROMPT}
              </pre>
            </div>
          )}

          {/* Sub-tab 2: Clickers & Action Pipelines */}
          {tool2SubTab === 'workflows' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-success">WORKFLOWS</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Multi-Step Button Clickers &amp; Sequential Action Pipelines
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Automate chained operations such as opening drop-down menus, switching tabs, clicking confirmation buttons, and waiting for asynchronous spinners.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Chained Action Pipeline Template</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Step 1: Wait for navigation tab to be interactive
const reportsTab = await bearbox.waitFor('button#reports-tab, [data-tab="reports"]', { timeout: 4000 });
if (reportsTab) {
  reportsTab.click();
  bearbox.log('Clicked Reports Tab');
}

// Step 2: Wait 800ms for animations and table load
await bearbox.wait(800);

// Step 3: Open date range dropdown and select 'Last 30 Days'
const filterBtn = await bearbox.waitFor('#date-filter-dropdown', { timeout: 3000 });
if (filterBtn) {
  filterBtn.click();
  const option = await bearbox.waitFor('.dropdown-item[data-range="30d"]', { timeout: 2000 });
  if (option) option.click();
}

// Step 4: Click the Export CSV button
const exportBtn = await bearbox.waitFor('button.export-csv-btn', { timeout: 3000 });
if (exportBtn) {
  exportBtn.click();
  bearbox.log('Export CSV triggered successfully.');
}`, 't2-wf')}
                  >
                    {copiedKey === 't2-wf' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't2-wf' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Step 1: Wait for navigation tab to be interactive
const reportsTab = await bearbox.waitFor('button#reports-tab, [data-tab="reports"]', { timeout: 4000 });
if (reportsTab) {
  reportsTab.click();
  bearbox.log('Clicked Reports Tab');
}

// Step 2: Wait 800ms for animations and table load
await bearbox.wait(800);

// Step 3: Open date range dropdown and select 'Last 30 Days'
const filterBtn = await bearbox.waitFor('#date-filter-dropdown', { timeout: 3000 });
if (filterBtn) {
  filterBtn.click();
  const option = await bearbox.waitFor('.dropdown-item[data-range="30d"]', { timeout: 2000 });
  if (option) option.click();
}

// Step 4: Click the Export CSV button
const exportBtn = await bearbox.waitFor('button.export-csv-btn', { timeout: 3000 });
if (exportBtn) {
  exportBtn.click();
  bearbox.log('Export CSV triggered successfully.');
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Cookie & Popup Dismissers */}
          {tool2SubTab === 'popups' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-success">POPUPS</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Automated Cookie Consent &amp; Newsletter Modal Dismissers
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Run this automatically on page load to dismiss GDPR consent dialogs, close newsletter subscription modals, and remove modal backdrop blur overlays.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Universal Modal &amp; Banner Dismisser</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Universal Cookie Accept & Modal Dismiss Script
const cookieSelectors = [
  '#onetrust-accept-btn-handler',
  'button[id*="cookie-accept"]',
  'button[aria-label="Accept all cookies"]',
  '.cookie-banner button.accept-all',
  'button[data-testid="cookie-accept-all"]'
];

for (const sel of cookieSelectors) {
  const btn = document.querySelector(sel);
  if (btn && btn instanceof HTMLElement) {
    btn.click();
    bearbox.log('Dismissed cookie banner:', sel);
    break;
  }
}

// Remove newsletter overlay if present
const modalClose = document.querySelector('.modal-close, button.close-newsletter, [aria-label="Close dialog"]');
if (modalClose && modalClose instanceof HTMLElement) {
  modalClose.click();
}`, 't2-popups')}
                  >
                    {copiedKey === 't2-popups' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't2-popups' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Universal Cookie Accept & Modal Dismiss Script
const cookieSelectors = [
  '#onetrust-accept-btn-handler',
  'button[id*="cookie-accept"]',
  'button[aria-label="Accept all cookies"]',
  '.cookie-banner button.accept-all',
  'button[data-testid="cookie-accept-all"]'
];

for (const sel of cookieSelectors) {
  const btn = document.querySelector(sel);
  if (btn && btn instanceof HTMLElement) {
    btn.click();
    bearbox.log('Dismissed cookie banner:', sel);
    break;
  }
}

// Remove newsletter overlay if present
const modalClose = document.querySelector('.modal-close, button.close-newsletter, [aria-label="Close dialog"]');
if (modalClose && modalClose instanceof HTMLElement) {
  modalClose.click();
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Auto-Refresh & Monitors */}
          {tool2SubTab === 'monitor' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-success">MONITOR</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Periodic Dashboard Refresh &amp; DOM Status Monitors
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Keep live metrics up-to-date, monitor e-commerce stock availability, or trigger an alert sound when ticket queue statuses change.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Dashboard Auto-Refresh &amp; Audio Alarm</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Auto-refresh monitor with DOM watcher
setInterval(() => {
  // Find refresh button or call window.location.reload()
  const refreshBtn = document.querySelector('button.refresh-dashboard, [aria-label="Refresh"]');
  if (refreshBtn && refreshBtn instanceof HTMLElement) {
    refreshBtn.click();
    bearbox.log('Dashboard refreshed at:', new Date().toLocaleTimeString());
  }

  // Check if an alert status badge turned 'CRITICAL'
  const criticalBadges = document.querySelectorAll('.status-critical, .badge-danger');
  if (criticalBadges.length > 0) {
    bearbox.log('ALERT: Critical status detected!');
    // Trigger notification or alert
    document.title = '🚨 ALERT: Action Required!';
  }
}, 30000); // Poll every 30 seconds`, 't2-mon')}
                  >
                    {copiedKey === 't2-mon' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't2-mon' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Auto-refresh monitor with DOM watcher
setInterval(() => {
  // Find refresh button or call window.location.reload()
  const refreshBtn = document.querySelector('button.refresh-dashboard, [aria-label="Refresh"]');
  if (refreshBtn && refreshBtn instanceof HTMLElement) {
    refreshBtn.click();
    bearbox.log('Dashboard refreshed at:', new Date().toLocaleTimeString());
  }

  // Check if an alert status badge turned 'CRITICAL'
  const criticalBadges = document.querySelectorAll('.status-critical, .badge-danger');
  if (criticalBadges.length > 0) {
    bearbox.log('ALERT: Critical status detected!');
    // Trigger notification or alert
    document.title = '🚨 ALERT: Action Required!';
  }
}, 30000); // Poll every 30 seconds`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 5: Ready-to-Use Scripts */}
          {tool2SubTab === 'examples' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <span className="bb-badge bb-badge-success">AUTOMATION</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '8px 0 6px 0' }}>
                  Bulk Checkbox Selector &amp; Delete Approver
                </h4>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                  Selects all rows matching pending status and triggers the batch approve button.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px', marginBottom: '8px' }}
                  onClick={() => handleCopy(`// Select all unchecked pending rows
const checkboxes = document.querySelectorAll('tr[data-status="pending"] input[type="checkbox"]:not(:checked)');
checkboxes.forEach(cb => {
  if (cb instanceof HTMLInputElement) cb.click();
});
bearbox.log(\`Selected \${checkboxes.length} pending items.\`);`, 't2-ex1')}
                >
                  {copiedKey === 't2-ex1' ? <Check size={12} /> : <Copy size={12} />} Copy Automation Code
                </button>
              </div>

              <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
                <span className="bb-badge bb-badge-success">AUTOMATION</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '8px 0 6px 0' }}>
                  Auto-Expand Collapsed Accordions &amp; Details
                </h4>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
                  Expands all hidden HTML5 details and Bootstrap/Tailwind accordion items on load.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px', marginBottom: '8px' }}
                  onClick={() => handleCopy(`document.querySelectorAll('details:not([open])').forEach(d => d.setAttribute('open', 'true'));
document.querySelectorAll('[aria-expanded="false"]').forEach(btn => {
  if (btn instanceof HTMLElement) btn.click();
});`, 't2-ex2')}
                >
                  {copiedKey === 't2-ex2' ? <Check size={12} /> : <Copy size={12} />} Copy Automation Code
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: TOOL 3 - DATA SCRAPER & TABLE EXTRACTOR                        */}
      {/* ========================================================================= */}
      {activeSection === 'tool3' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 3 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool3SubTab === 'ai-prompt' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool3SubTab('ai-prompt')}
            >
              <Bot size={14} /> AI Prompt for Scraper
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool3SubTab === 'table-json' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool3SubTab('table-json')}
            >
              <Table size={14} /> HTML Table to JSON &amp; CSV
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool3SubTab === 'card-grid' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool3SubTab('card-grid')}
            >
              <Layers size={14} /> Product Cards &amp; Grid Feeds
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool3SubTab === 'export-copy' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool3SubTab('export-copy')}
            >
              <Download size={14} /> Clipboard &amp; File Downloads
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool3SubTab === 'pagination' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool3SubTab('pagination')}
            >
              <RefreshCw size={14} /> Pagination &amp; Infinite Scroll
            </button>
          </div>

          {/* Sub-tab 1: AI Prompt */}
          {tool3SubTab === 'ai-prompt' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #d97706', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#2d1b06', padding: '14px 20px', borderBottom: '1px solid #78350f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={16} style={{ color: '#fbbf24' }} />
                    Tool 3 Data Scraper Master AI Prompt
                  </span>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Paste this prompt with any HTML table or product listing into an AI to generate scraper code!
                  </div>
                </div>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#d97706', borderColor: '#b45309', padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL3_SCRAPER_AI_PROMPT, 'tool3-prompt')}
                >
                  {copiedKey === 'tool3-prompt' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'tool3-prompt' ? 'Copied Prompt!' : 'Copy AI Prompt'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '16px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, maxHeight: '420px', overflowY: 'auto' }}>
                {TOOL3_SCRAPER_AI_PROMPT}
              </pre>
            </div>
          )}

          {/* Sub-tab 2: HTML Table to JSON & CSV */}
          {tool3SubTab === 'table-json' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-warning">TABLE SCRAPER</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Extract Any HTML &lt;table&gt; to JSON or Clean CSV
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Dynamically reads table headers (<code>th</code>) and all rows (<code>tr &gt; td</code>), strips whitespace, formats dates, and outputs to the clipboard.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Automatic Table Extractor</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Query table headers
const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent.trim().toLowerCase().replace(/\\s+/g, '_'));

// Query all table body rows
const rows = Array.from(document.querySelectorAll('table tbody tr'));
const data = rows.map(row => {
  const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
  const record = {};
  headers.forEach((h, i) => {
    record[h || \`col_\${i}\`] = cells[i] || '';
  });
  return record;
});

const jsonOutput = JSON.stringify(data, null, 2);
navigator.clipboard.writeText(jsonOutput);
alert(\`Successfully extracted \${data.length} rows to clipboard as JSON!\`);`, 't3-tbl')}
                  >
                    {copiedKey === 't3-tbl' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't3-tbl' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Query table headers
const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent.trim().toLowerCase().replace(/\\s+/g, '_'));

// Query all table body rows
const rows = Array.from(document.querySelectorAll('table tbody tr'));
const data = rows.map(row => {
  const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
  const record = {};
  headers.forEach((h, i) => {
    record[h || \`col_\${i}\`] = cells[i] || '';
  });
  return record;
});

const jsonOutput = JSON.stringify(data, null, 2);
navigator.clipboard.writeText(jsonOutput);
alert(\`Successfully extracted \${data.length} rows to clipboard as JSON!\`);`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Product Cards & Grid Feeds */}
          {tool3SubTab === 'card-grid' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-warning">GRID SCRAPER</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Extract E-Commerce Products, Card Listings &amp; Social Feeds
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Parses repeating container cards into structured items with titles, links, price numbers, and image URLs.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Product Card Grid Scraper</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Query all product or item cards
const cards = Array.from(document.querySelectorAll('.product-card, [data-testid="product-item"], .search-result-card'));
const items = cards.map(card => {
  const titleEl = card.querySelector('h2, h3, .product-title, [class*="title"]');
  const priceEl = card.querySelector('.price, [class*="price"], .amount');
  const linkEl = card.querySelector('a[href]');
  const imgEl = card.querySelector('img[src]');

  return {
    title: titleEl?.textContent?.trim() || '',
    price: priceEl?.textContent?.trim() || '',
    link: linkEl ? (linkEl as HTMLAnchorElement).href : '',
    imageUrl: imgEl ? (imgEl as HTMLImageElement).src : ''
  };
});

navigator.clipboard.writeText(JSON.stringify(items, null, 2));
bearbox.log(\`Extracted \${items.length} cards to clipboard.\`);`, 't3-cards')}
                  >
                    {copiedKey === 't3-cards' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't3-cards' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Query all product or item cards
const cards = Array.from(document.querySelectorAll('.product-card, [data-testid="product-item"], .search-result-card'));
const items = cards.map(card => {
  const titleEl = card.querySelector('h2, h3, .product-title, [class*="title"]');
  const priceEl = card.querySelector('.price, [class*="price"], .amount');
  const linkEl = card.querySelector('a[href]');
  const imgEl = card.querySelector('img[src]');

  return {
    title: titleEl?.textContent?.trim() || '',
    price: priceEl?.textContent?.trim() || '',
    link: linkEl ? (linkEl as HTMLAnchorElement).href : '',
    imageUrl: imgEl ? (imgEl as HTMLImageElement).src : ''
  };
});

navigator.clipboard.writeText(JSON.stringify(items, null, 2));
bearbox.log(\`Extracted \${items.length} cards to clipboard.\`);`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Clipboard & File Downloads */}
          {tool3SubTab === 'export-copy' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-warning">DOWNLOAD / EXPORT</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  One-Click CSV File Download &amp; Direct Clipboard Sync
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Converts your scraped records directly into a downloadable CSV file or puts clean tab-separated text onto your clipboard for pasting directly into Google Sheets or Excel.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>CSV File Download Helper Function</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`function downloadCSV(records, filename = 'bearbox-export.csv') {
  if (!records || records.length === 0) return;
  const headers = Object.keys(records[0]);
  const csvRows = [
    headers.join(','),
    ...records.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
  ];
  const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}`, 't3-csv')}
                  >
                    {copiedKey === 't3-csv' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't3-csv' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`function downloadCSV(records, filename = 'bearbox-export.csv') {
  if (!records || records.length === 0) return;
  const headers = Object.keys(records[0]);
  const csvRows = [
    headers.join(','),
    ...records.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
  ];
  const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 5: Pagination & Infinite Scroll */}
          {tool3SubTab === 'pagination' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-warning">PAGINATION</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Handling Multi-Page Crawling &amp; Infinite Scrolling
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Extract records while clicking "Next Page" or smoothly scrolling down to load lazy-rendered infinite lists.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Smooth Infinite Scroll Loader</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`async function autoScrollToBottom(maxScrolls = 5, delayMs = 1200) {
  for (let i = 0; i < maxScrolls; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    bearbox.log(\`Scrolled page (\${i + 1}/\${maxScrolls}). Waiting for network fetch...\`);
    await bearbox.wait(delayMs);
  }
}

// Usage before extraction:
await autoScrollToBottom(4, 1500);
// Extract cards now that all elements are loaded!`, 't3-scroll')}
                  >
                    {copiedKey === 't3-scroll' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't3-scroll' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`async function autoScrollToBottom(maxScrolls = 5, delayMs = 1200) {
  for (let i = 0; i < maxScrolls; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    bearbox.log(\`Scrolled page (\${i + 1}/\${maxScrolls}). Waiting for network fetch...\`);
    await bearbox.wait(delayMs);
  }
}

// Usage before extraction:
await autoScrollToBottom(4, 1500);
// Extract cards now that all elements are loaded!`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: TOOL 4 - SELECTOR PICKER & INSPECTION                          */}
      {/* ========================================================================= */}
      {activeSection === 'tool4' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 4 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool4SubTab === 'picker-guide' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool4SubTab('picker-guide')}
            >
              <MousePointer size={14} /> Visual Picker Guide
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool4SubTab === 'resilient-selectors' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool4SubTab('resilient-selectors')}
            >
              <Shield size={14} /> Stable vs Fragile Selectors
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool4SubTab === 'shadow-dom' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool4SubTab('shadow-dom')}
            >
              <Layers size={14} /> Shadow DOM &amp; Web Components
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool4SubTab === 'cheatsheet' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool4SubTab('cheatsheet')}
            >
              <Code size={14} /> CSS Selector Cheatsheet
            </button>
          </div>

          {/* Sub-tab 1: Picker Guide */}
          {tool4SubTab === 'picker-guide' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-primary">TOOL 4</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  How to Use the Interactive Visual Field Picker
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                BearBox includes an interactive <strong>🎯 Pick Selector</strong> tool in the floating panel. Click it, hover over any field on the live webpage, and click to automatically generate and copy an optimal selector.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Step 1: Activate Picker</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    Open the BearBox floating mascot on any webpage and click the <strong>🎯 Pick Selector</strong> button.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Step 2: Hover Over Field</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    Hover over inputs, buttons, or tables. A blue outline and live selector tooltip will track your mouse.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Step 3: Click to Copy</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    Click the element. BearBox automatically copies the calculated resilient selector to your clipboard!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Resilient Selectors */}
          {tool4SubTab === 'resilient-selectors' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                Stable vs Fragile CSS Selectors Engineering
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <strong style={{ fontSize: '13.5px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Recommended Selectors (Stable &amp; Future-Proof)
                  </strong>
                  <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7 }}>
                    <li><code>#student-id</code> (Unique static ID)</li>
                    <li><code>input[name="email"]</code> (Standard form name)</li>
                    <li><code>[data-testid="submit-btn"]</code> (Explicit test attributes)</li>
                    <li><code>#dob, [name="dob"]</code> (Multi-fallback selector)</li>
                    <li><code>button[aria-label="Confirm"]</code> (Accessible labels)</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
                  <strong style={{ fontSize: '13.5px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} /> Fragile Selectors (Avoid!)
                  </strong>
                  <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7 }}>
                    <li><code>.css-19v8x4</code> (Auto-generated CSS-in-JS hashes)</li>
                    <li><code>div &gt; div:nth-child(3) &gt; input</code> (Strict DOM hierarchy)</li>
                    <li><code>input#input-12849</code> (Dynamic random IDs)</li>
                    <li>Absolute XPath expressions like <code>/html/body/div[2]/form/div[4]</code></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Shadow DOM & Web Components */}
          {tool4SubTab === 'shadow-dom' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-primary">SHADOW DOM</span>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Penetrating Shadow DOM Roots &amp; Web Components
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Modern web apps (Salesforce, Shopify, custom components) encapsulate inputs inside Shadow DOM. Standard <code>document.querySelector</code> cannot see inside open shadow roots without penetrating them.
              </p>

              <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#0d1322', padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Shadow DOM Traversal Helper</span>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleCopy(`// Helper to find an element nested inside one or more shadow roots
function queryShadow(hostSelector, innerSelector) {
  const host = document.querySelector(hostSelector);
  if (!host || !host.shadowRoot) return null;
  return host.shadowRoot.querySelector(innerSelector);
}

// Example usage:
const customInput = queryShadow('user-profile-card', 'input[name="bio"]');
if (customInput) {
  helpers.setInput(customInput, 'Software Engineer', 'Bio');
}`, 't4-shadow')}
                  >
                    {copiedKey === 't4-shadow' ? <Check size={12} /> : <Copy size={12} />}
                    {copiedKey === 't4-shadow' ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
                  {`// Helper to find an element nested inside one or more shadow roots
function queryShadow(hostSelector, innerSelector) {
  const host = document.querySelector(hostSelector);
  if (!host || !host.shadowRoot) return null;
  return host.shadowRoot.querySelector(innerSelector);
}

// Example usage:
const customInput = queryShadow('user-profile-card', 'input[name="bio"]');
if (customInput) {
  helpers.setInput(customInput, 'Software Engineer', 'Bio');
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Cheatsheet */}
          {tool4SubTab === 'cheatsheet' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                CSS Attribute Selector Engineering Cheatsheet
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#090d16', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f8fafc' }}>Syntax</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#60a5fa' }}>Example</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#34d399' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>[attr="val"]</code></td>
                      <td style={{ padding: '10px 14px' }}><code>input[name="email"]</code></td>
                      <td style={{ padding: '10px 14px' }}>Exact match of attribute value</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>[attr*="val"]</code></td>
                      <td style={{ padding: '10px 14px' }}><code>input[id*="phone"]</code></td>
                      <td style={{ padding: '10px 14px' }}>Contains substring anywhere inside attribute</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>[attr^="val"]</code></td>
                      <td style={{ padding: '10px 14px' }}><code>button[data-action^="save"]</code></td>
                      <td style={{ padding: '10px 14px' }}>Starts with prefix string</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>[attr$="val"]</code></td>
                      <td style={{ padding: '10px 14px' }}><code>input[name$="address"]</code></td>
                      <td style={{ padding: '10px 14px' }}>Ends with suffix string</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>sel1, sel2</code></td>
                      <td style={{ padding: '10px 14px' }}><code>#email, [name="email"]</code></td>
                      <td style={{ padding: '10px 14px' }}>Comma-separated fallback chain</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: TOOL 5 - WEBSITE MATCHING RULES & SPAs                         */}
      {/* ========================================================================= */}
      {activeSection === 'tool5' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 5 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool5SubTab === 'url-patterns' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool5SubTab('url-patterns')}
            >
              <Globe size={14} /> URL Wildcard Engine
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool5SubTab === 'spa-lifecycle' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool5SubTab('spa-lifecycle')}
            >
              <Zap size={14} /> SPA Route Interception
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool5SubTab === 'timing-triggers' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool5SubTab('timing-triggers')}
            >
              <Clock size={14} /> Execution Timing &amp; Trigger Modes
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool5SubTab === 'troubleshooting' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool5SubTab('troubleshooting')}
            >
              <Shield size={14} /> Deduplication &amp; Debugging
            </button>
          </div>

          {/* Sub-tab 1: URL Wildcards */}
          {tool5SubTab === 'url-patterns' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-primary">URL MATCHING</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Wildcard &amp; Glob Matching Patterns
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                BearBox evaluates webpage URLs in real time using asterisks (<code>*</code>) to match any sequence of characters in the domain or path.
              </p>

              <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#090d16', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f8fafc' }}>Pattern Example</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#60a5fa' }}>Matches</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f87171' }}>Does Not Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>https://example.com/*</code></td>
                      <td style={{ padding: '10px 14px' }}>Any path on example.com</td>
                      <td style={{ padding: '10px 14px' }}>subdomain.example.com</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>https://*.example.com/*</code></td>
                      <td style={{ padding: '10px 14px' }}>app.example.com, portal.example.com</td>
                      <td style={{ padding: '10px 14px' }}>otherdomain.com</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>*://*/checkout*</code></td>
                      <td style={{ padding: '10px 14px' }}>Any domain with /checkout in URL</td>
                      <td style={{ padding: '10px 14px' }}>pages without /checkout</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: SPA Route Interception */}
          {tool5SubTab === 'spa-lifecycle' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px 0' }}>
                Single Page Application (SPA) Route Interception
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Modern websites built with Next.js, React Router, Vue, or Angular navigate between pages without triggering a browser page reload.
                BearBox hooks into <code>window.history.pushState</code>, <code>replaceState</code>, and <code>popstate</code> so your scripts fire automatically on route changes!
              </p>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13px', color: '#60a5fa' }}>SPA Event Flow in BearBox:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7 }}>
                  <li>User clicks an in-app link (e.g. <code>/dashboard &rarr; /settings</code>).</li>
                  <li>BearBox URL Observer detects the route change instantly.</li>
                  <li>Target scripts matching the new path are queried from storage.</li>
                  <li>Scripts are safely executed with automatic session deduplication.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Execution Timing */}
          {tool5SubTab === 'timing-triggers' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                Execution Timing &amp; Trigger Modes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} /> Automatic Mode
                  </strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    Executes immediately when the matching webpage loads or changes SPA route. Ideal for ad-blockers, cookie dismissers, and auto-login scripts.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={15} /> Manual Mode
                  </strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    Only runs when the user clicks the <strong>▶ Run</strong> button in the floating panel. Ideal for sensitive submissions, irreversible batch operations, and testing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Troubleshooting */}
          {tool5SubTab === 'troubleshooting' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                Session Deduplication &amp; Script Diagnostics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Automatic Session Deduplication</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    BearBox tracks execution per URL lifecycle so automatic scripts will not run more than once per page load even if subframes or child components re-render.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Safe Logging</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    Use <code>bearbox.log()</code> instead of <code>console.log()</code>. BearBox prefixes outputs with clean extension tags and sanitizes potential credentials.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: TOOL 6 - 1-CLICK CLIPBOARD PASTE & FILL                         */}
      {/* ========================================================================= */}
      {activeSection === 'tool6' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tool 6 Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool6SubTab === 'how-it-works' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool6SubTab('how-it-works')}
            >
              <Clipboard size={14} /> How Paste &amp; Fill Works
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool6SubTab === 'data-formats' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool6SubTab('data-formats')}
            >
              <FileText size={14} /> Supported Data Formats
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool6SubTab === 'fuzzy-matching' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool6SubTab('fuzzy-matching')}
            >
              <Sparkles size={14} /> Smart Key Aliasing &amp; Fuzzy Matching
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${tool6SubTab === 'examples' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setTool6SubTab('examples')}
            >
              <Code size={14} /> Test Payloads &amp; Templates
            </button>
          </div>

          {/* Sub-tab 1: How it works */}
          {tool6SubTab === 'how-it-works' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="bb-badge bb-badge-primary">TOOL 6</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  1-Click Instant Clipboard &quot;Paste &amp; Fill&quot; Engine
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                No modal popups needed! When you copy client data, customer details, or KYC profiles from any spreadsheet or PDF, you can simply click the <strong>📋 Paste &amp; Fill</strong> button directly on the floating BearBox panel.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#ec4899' }}>1. Copy Data Anywhere</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    Copy an Excel row, CSV line, JSON snippet, or colon-separated text to your clipboard.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#ec4899' }}>2. Click 📋 Paste &amp; Fill</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    Click the button on the floating mascot. BearBox reads your clipboard securely via Chrome extension permissions.
                  </p>
                </div>
                <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#ec4899' }}>3. Instant Zero-Popup Fill</strong>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    The form is immediately populated, React state is updated, and a success notification appears on screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Supported Formats */}
          {tool6SubTab === 'data-formats' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 16px 0' }}>
                Supported Clipboard Data Formats
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Format 1: Standard JSON</strong>
                  <pre style={{ margin: '8px 0 0 0', padding: '10px', backgroundColor: '#05070c', borderRadius: '6px', fontSize: '11.5px', color: '#cbd5e1' }}>
                    {`{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1 555-0199"
}`}
                  </pre>
                </div>

                <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#34d399' }}>Format 2: Key: Value Multiline</strong>
                  <pre style={{ margin: '8px 0 0 0', padding: '10px', backgroundColor: '#05070c', borderRadius: '6px', fontSize: '11.5px', color: '#cbd5e1' }}>
                    {`Full Name: Jane Doe
Email Address: jane@example.com
Phone: +1 555-0199`}
                  </pre>
                </div>

                <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <strong style={{ fontSize: '13px', color: '#fbbf24' }}>Format 3: CSV / Excel Row</strong>
                  <pre style={{ margin: '8px 0 0 0', padding: '10px', backgroundColor: '#05070c', borderRadius: '6px', fontSize: '11.5px', color: '#cbd5e1' }}>
                    {`fullName,email,phone
Jane Doe,jane@example.com,555-0199`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Fuzzy Matching */}
          {tool6SubTab === 'fuzzy-matching' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px 0' }}>
                Intelligent Key Aliasing &amp; Fuzzy Matching Engine
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                You never have to worry about exact casing or punctuation. When you copy data with the label &quot;Full Name:&quot;, BearBox automatically creates normalized aliases:
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#090d16', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f8fafc' }}>Copied Clipboard Key</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#60a5fa' }}>Generated Aliases Available in Script</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>Full Name</code></td>
                      <td style={{ padding: '10px 14px' }}><code>record.fullName</code>, <code>record.full_name</code>, <code>record['Full Name']</code></td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>Date of Birth (DOB)</code></td>
                      <td style={{ padding: '10px 14px' }}><code>record.dob</code>, <code>record.dateOfBirth</code>, <code>record.date_of_birth</code></td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px' }}><code>Tax ID / EIN</code></td>
                      <td style={{ padding: '10px 14px' }}><code>record.taxId</code>, <code>record.tax_id</code>, <code>record.ein</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Examples */}
          {tool6SubTab === 'examples' && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Quick-Test Clipboard Payloads
                </h3>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#ec4899', borderColor: '#db2777', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(`{\n  "fullName": "Sarah Connor",\n  "email": "sarah.connor@cyberdyne.org",\n  "phone": "+1 415-555-0142",\n  "dob": "1985-05-12",\n  "country": "United States"\n}`, 'test-payload')}
                >
                  {copiedKey === 'test-payload' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'test-payload' ? 'Copied Test Payload!' : 'Copy Test Payload'}
                </button>
              </div>

              <pre style={{ margin: 0, padding: '14px', backgroundColor: '#090d16', color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto', borderRadius: '8px' }}>
                {`{
  "fullName": "Sarah Connor",
  "email": "sarah.connor@cyberdyne.org",
  "phone": "+1 415-555-0142",
  "dob": "1985-05-12",
  "country": "United States"
}`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: API REFERENCE DICTIONARY                                       */}
      {/* ========================================================================= */}
      {activeSection === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* API Sub-Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${apiSubTab === 'bearbox-core' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setApiSubTab('bearbox-core')}
            >
              <Terminal size={14} /> bearbox.* Core Methods
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${apiSubTab === 'bearbox-inputs' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setApiSubTab('bearbox-inputs')}
            >
              <Code size={14} /> bearbox.* Form Setters
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${apiSubTab === 'helpers' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setApiSubTab('helpers')}
            >
              <Zap size={14} /> helpers.* Option 1 API
            </button>
            <button
              type="button"
              className={`bb-btn bb-btn-sm ${apiSubTab === 'events' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
              onClick={() => setApiSubTab('events')}
            >
              <Sparkles size={14} /> React &amp; DOM Event Pipeline
            </button>
          </div>

          <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
              Complete BearBox API Reference
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 18px 0' }}>
              Full dictionary of all global methods, signature parameters, and return types available in BearBox scripts.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { name: 'bearbox.setValue(target, value, options?)', desc: 'Sets text, textarea, email, or tel value. Resets React _valueTracker and dispatches input/change/blur.', type: 'Promise<FieldActionResult>' },
                { name: 'bearbox.setSelect(target, valueOrText, options?)', desc: 'Selects <select> option by exact value or matching visible option text.', type: 'Promise<FieldActionResult>' },
                { name: 'bearbox.setCheckbox(target, boolean, options?)', desc: 'Sets checkbox checked status (supports true, false, "yes", "no", 1, 0).', type: 'Promise<FieldActionResult>' },
                { name: 'bearbox.setRadio(nameOrTarget, valueOrLabel, options?)', desc: 'Selects matching radio in radio group by value or associated label text.', type: 'Promise<FieldActionResult>' },
                { name: 'bearbox.setDate(target, date, options?)', desc: 'Converts date string or Date object into expected format (YYYY-MM-DD or custom).', type: 'Promise<FieldActionResult>' },
                { name: 'bearbox.waitFor(selector, { timeout, interval }?)', desc: 'Waits asynchronously for an element to appear in the DOM.', type: 'Promise<HTMLElement | null>' },
                { name: 'bearbox.click(selector)', desc: 'Finds element and triggers focus and click event with bubbling.', type: 'boolean' },
                { name: 'bearbox.autofill(specObject)', desc: 'Batch populates multiple fields from a dictionary or list.', type: 'Promise<AutofillRunResult>' },
                { name: 'bearbox.log(...messages)', desc: 'Safe logger that prevents accidental PII leaks to the public console.', type: 'void' },
                { name: 'helpers.setInput(sel, val, label?)', desc: 'Option 1 helper for text, textarea, and date inputs.', type: 'boolean' },
                { name: 'helpers.setSelect(sel, val, label?)', desc: 'Option 1 helper for dropdowns.', type: 'boolean' },
                { name: 'helpers.setCheckbox(sel, val, label?)', desc: 'Option 1 helper for checkboxes.', type: 'boolean' },
                { name: 'helpers.setRadio(sel, val, label?)', desc: 'Option 1 helper for radio buttons.', type: 'boolean' }
              ].map((item, idx) => (
                <div key={idx} style={{ backgroundColor: '#090d16', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ color: '#60a5fa', fontWeight: 700, fontSize: '13px' }}>{item.name}</code>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{item.type}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 8: AI PROMPT HUB                                                  */}
      {/* ========================================================================= */}
      {activeSection === 'ai-hub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#111827', border: '1px solid #7c3aed', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Bot size={22} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Universal AI Prompt Hub
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 18px 0' }}>
              Select any prompt below, click Copy, and paste it into ChatGPT, Claude, Gemini, or DeepSeek along with your form HTML to generate your BearBox scripts automatically!
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#a855f7' }}>Master AI Prompt (Tool 1: Form Autofill)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Complete prompt containing Option 1 and Option 2 specifications for form autofill.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#7c3aed', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(MASTER_AI_PROMPT, 'hub-master')}
                >
                  {copiedKey === 'hub-master' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-master' ? 'Copied Master Prompt!' : 'Copy Master Prompt'}
                </button>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#34d399' }}>Web Automation Prompt (Tool 2)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Generates userscripts for auto-clicking buttons, closing popups, and expanding forms.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#059669', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL2_AUTOMATION_AI_PROMPT, 'hub-t2')}
                >
                  {copiedKey === 'hub-t2' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-t2' ? 'Copied Automation Prompt!' : 'Copy Automation Prompt'}
                </button>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#fbbf24' }}>Data Scraper Prompt (Tool 3)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Generates scripts to extract tables and card grids into JSON or CSV.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#d97706', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL3_SCRAPER_AI_PROMPT, 'hub-t3')}
                >
                  {copiedKey === 'hub-t3' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-t3' ? 'Copied Scraper Prompt!' : 'Copy Scraper Prompt'}
                </button>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#38bdf8' }}>Selector Engineering Prompt (Tool 4)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Analyzes complex or dynamic HTML and outputs stable, resilient CSS selectors.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#0284c7', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL4_SELECTOR_AI_PROMPT, 'hub-t4')}
                >
                  {copiedKey === 'hub-t4' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-t4' ? 'Copied Selector Prompt!' : 'Copy Selector Prompt'}
                </button>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#818cf8' }}>URL Matching Rules Prompt (Tool 5)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Generates optimal glob and wildcard rules for URL matching.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#4f46e5', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL5_URL_MATCHING_AI_PROMPT, 'hub-t5')}
                >
                  {copiedKey === 'hub-t5' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-t5' ? 'Copied URL Rule Prompt!' : 'Copy URL Rule Prompt'}
                </button>
              </div>

              <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <strong style={{ fontSize: '13.5px', color: '#ec4899' }}>1-Click Paste &amp; Fill Formatter (Tool 6)</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 12px 0' }}>
                  Converts raw text/resumes into formatted JSON for 1-click clipboard autofilling.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  style={{ backgroundColor: '#db2777', padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => handleCopy(TOOL6_CLIPBOARD_AI_PROMPT, 'hub-t6')}
                >
                  {copiedKey === 'hub-t6' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === 'hub-t6' ? 'Copied Clipboard Prompt!' : 'Copy Clipboard Prompt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
