import React, { useState } from 'react';
import { Plus, Trash2, Globe, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { ScriptRule } from '../types/script';
import { validatePattern } from '../services/matcher';
import { generateRuleId } from '../services/storage';

interface RuleEditorProps {
  rules: ScriptRule[];
  onChange: (rules: ScriptRule[]) => void;
  readOnly?: boolean;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  rules,
  onChange,
  readOnly = false
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const handleAddRule = () => {
    const newRule: ScriptRule = {
      id: generateRuleId(),
      pattern: 'https://example.com/*'
    };
    onChange([...rules, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const handlePatternChange = (id: string, newPattern: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, pattern: newPattern } : r));
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
            Target Website Matching Rules ({rules.length})
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
            title="Pattern help"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddRule}
            className="bb-btn bb-btn-secondary bb-btn-sm"
          >
            <Plus size={14} /> Add Rule
          </button>
        )}
      </div>

      {showHelp && (
        <div style={{
          backgroundColor: '#162035',
          border: '1px solid #27354f',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          color: '#bfdbfe'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: '#f8fafc' }}>Supported Pattern Examples:</div>
          <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li><code>https://chatgpt.com/</code> — Matches all ChatGPT pages (conversations, settings, etc.)</li>
            <li><code>https://example.com/</code> — Base website rule matching any path on the origin</li>
            <li><code>https://*.example.com/*</code> — Matches example.com and any subdomain (e.g. app.example.com)</li>
            <li><code>https://example.com/products</code> — Matches specific path prefixes</li>
            <li><code>*://*.github.com/*</code> — Matches GitHub across both http and https</li>
            <li><code>http://localhost:3000/</code> — Matches localhost on specific port</li>
          </ul>
        </div>
      )}

      {rules.length === 0 ? (
        <div style={{
          padding: '16px',
          backgroundColor: '#090d16',
          border: '1px dashed #1e293b',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '12.5px',
          color: '#64748b'
        }}>
          No website matching rules added yet. Click &quot;Add Rule&quot; to specify which websites this script runs on.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map((rule, idx) => {
            const validation = validatePattern(rule.pattern);
            return (
              <div
                key={rule.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  backgroundColor: '#090d16',
                  border: `1px solid ${validation.valid ? '#1e293b' : '#ef4444'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} color={validation.valid ? '#60a5fa' : '#ef4444'} style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    value={rule.pattern}
                    onChange={(e) => handlePatternChange(rule.id, e.target.value)}
                    placeholder="https://example.com/*"
                    readOnly={readOnly}
                    style={{
                      flex: 1,
                      fontFamily: 'var(--bb-font-mono, monospace)',
                      fontSize: '12.5px',
                      padding: '6px 10px',
                      backgroundColor: '#111827',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      outline: 'none',
                      color: '#f8fafc'
                    }}
                  />

                  {validation.valid ? (
                    <span title="Valid pattern" style={{ display: 'inline-flex', flexShrink: 0 }}>
                      <CheckCircle2 size={16} color="#34d399" />
                    </span>
                  ) : (
                    <span title="Invalid pattern" style={{ display: 'inline-flex', flexShrink: 0 }}>
                      <AlertTriangle size={16} color="#ef4444" />
                    </span>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(rule.id)}
                      title="Remove rule"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {!validation.valid && validation.error && (
                  <div style={{ fontSize: '11px', color: '#f87171', paddingLeft: '24px' }}>
                    {validation.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
