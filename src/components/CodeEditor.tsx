import React, { useState, useEffect, useRef } from 'react';
import { Check, Copy, AlertCircle, Code } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  placeholder?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  minHeight = '240px',
  placeholder = '// Enter your JavaScript code here...'
}) => {
  const [copied, setCopied] = useState(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validate JavaScript syntax safely without triggering MV3 CSP eval restrictions
  useEffect(() => {
    if (!value.trim()) {
      setSyntaxError(null);
      return;
    }
    // Check for unbalanced braces, parentheses, or unclosed string literals
    const stack: { char: string; line: number }[] = [];
    const lines = value.split('\n');
    let inQuote: string | null = null;
    let err: string | null = null;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuote) {
          if (ch === inQuote && line[i - 1] !== '\\') {
            inQuote = null;
          }
        } else if (ch === '/' && line[i + 1] === '/') {
          // Line comment
          break;
        } else if (ch === '"' || ch === "'" || ch === '`') {
          inQuote = ch;
        } else if (ch === '(' || ch === '{' || ch === '[') {
          stack.push({ char: ch, line: lineIdx + 1 });
        } else if (ch === ')' || ch === '}' || ch === ']') {
          const match = stack.pop();
          const expected = ch === ')' ? '(' : ch === '}' ? '{' : '[';
          if (!match || match.char !== expected) {
            err = `Mismatched closing "${ch}" on line ${lineIdx + 1}`;
            break;
          }
        }
      }
      if (err) break;
    }

    if (!err && stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      err = `Unclosed "${unclosed.char}" from line ${unclosed.line}`;
    }

    setSyntaxError(err);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    // Support Tab key indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Restore cursor position after state update
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate line numbers
  const lines = (value || '\n').split('\n');

  return (
    <div style={{
      border: '1px solid #1e293b',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
    }}>
      {/* Editor Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        fontSize: '11.5px',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Code size={14} color="#60a5fa" />
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>JavaScript</span>
          <span style={{ opacity: 0.7 }}>• {lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {syntaxError ? (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#f87171',
              fontSize: '11px'
            }}>
              <AlertCircle size={13} />
              Syntax Error
            </span>
          ) : value.trim() ? (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#4ade80',
              fontSize: '11px'
            }}>
              <Check size={13} />
              Valid JS
            </span>
          ) : null}

          <button
            type="button"
            onClick={handleCopy}
            title="Copy script"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#cbd5e1',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Editor Main Content: Line Numbers + Textarea */}
      <div style={{ display: 'flex', minHeight, position: 'relative' }}>
        {/* Line numbers gutter */}
        <div style={{
          width: '38px',
          padding: '12px 6px 12px 0',
          backgroundColor: '#090d16',
          color: '#475569',
          fontFamily: 'var(--bb-font-mono, monospace)',
          fontSize: '12px',
          lineHeight: '1.6',
          textAlign: 'right',
          userSelect: 'none',
          borderRight: '1px solid #1e293b'
        }}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'transparent',
            color: '#f1f5f9',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--bb-font-mono, monospace)',
            fontSize: '12px',
            lineHeight: '1.6',
            resize: 'vertical',
            whiteSpace: 'pre',
            overflowX: 'auto',
            tabSize: 2
          }}
        />
      </div>

      {/* Syntax error callout */}
      {syntaxError && (
        <div style={{
          padding: '6px 12px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderTop: '1px solid #ef4444',
          color: '#fca5a5',
          fontSize: '11.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{syntaxError}</span>
        </div>
      )}
    </div>
  );
};
