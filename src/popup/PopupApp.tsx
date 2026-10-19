import React, { useState, useEffect } from 'react';
import {
  Globe,
  ExternalLink,
  Plus,
  Play,
  ShieldOff,
  Power
} from 'lucide-react';
import { BearBoxScript } from '../types/script';
import { FormAutofillConfig } from '../types/formConfig';
import {
  getScripts,
  toggleScriptEnabled,
  getFormConfigs,
  toggleFormConfigEnabled,
  isHostnameDisabled,
  toggleHostnameDisabled,
  subscribeToStorageChanges
} from '../services/storage';
import { getMatchingScriptsForUrl, getMatchingFormConfigsForUrl, extractHostname } from '../services/matcher';
import { executionRegistry } from '../services/executor';
import { BearBoxLogo } from '../components/BearBoxLogo';
import '../styles/theme.css';

export const PopupApp: React.FC = () => {
  const [currentUrl, setCurrentUrl] = useState<string>('https://example.com');
  const [hostname, setHostname] = useState<string>('example.com');
  const [siteDisabled, setSiteDisabled] = useState<boolean>(false);
  const [matchingScripts, setMatchingScripts] = useState<BearBoxScript[]>([]);
  const [matchingForms, setMatchingForms] = useState<FormAutofillConfig[]>([]);
  const [allScripts, setAllScripts] = useState<BearBoxScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Fetch active tab URL from Chrome API
  const detectActiveTab = async (): Promise<{ url: string; host: string }> => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const host = extractHostname(tab.url);
          return { url: tab.url, host };
        }
      } catch (e) {
        console.warn('Could not query active tab:', e);
      }
    }
    // Fallback for standalone / browser testing
    const fallbackUrl = window.location.href;
    return { url: fallbackUrl, host: extractHostname(fallbackUrl) };
  };

  const loadData = async () => {
    try {
      const { url, host } = await detectActiveTab();
      setCurrentUrl(url);
      setHostname(host);

      const [scripts, forms, disabled] = await Promise.all([
        getScripts(),
        getFormConfigs(),
        isHostnameDisabled(host)
      ]);

      setAllScripts(scripts);
      setSiteDisabled(disabled);

      // Find matching scripts and form configs for current URL
      const matching = getMatchingScriptsForUrl(url, scripts);
      const matchedForms = getMatchingFormConfigsForUrl(url, forms);
      setMatchingScripts(matching);
      setMatchingForms(matchedForms);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToStorageChanges(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const handleToggleSite = async () => {
    const isNowDisabled = await toggleHostnameDisabled(hostname);
    setSiteDisabled(isNowDisabled);
    await loadData();
  };

  const handleToggleScript = async (scriptId: string) => {
    await toggleScriptEnabled(scriptId);
    await loadData();
  };

  const handleRunScript = async (script: BearBoxScript) => {
    setRunningId(script.id);
    setRunStatus(null);

    const result = await executionRegistry.executeScript(script, {
      url: currentUrl,
      hostname,
      trigger: 'manual'
    });

    setRunningId(null);
    setRunStatus({
      id: script.id,
      success: result.success,
      message: result.success
        ? (typeof result.output === 'string' ? result.output : 'Executed successfully')
        : (result.error || 'Execution failed')
    });

    await loadData();
  };

  const openManagerPage = (newScriptUrlRule?: string) => {
    let page = 'manager.html';
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      page = chrome.runtime.getManifest().options_ui?.page || 'manager.html';
    }
    const targetUrl = newScriptUrlRule
      ? `${page}?newRule=${encodeURIComponent(newScriptUrlRule)}`
      : page;

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL(targetUrl) });
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ width: '360px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16' }}>
        <BearBoxLogo size={36} animate />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '360px',
        backgroundColor: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '13px',
        color: '#f8fafc',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        border: '1px solid #1e293b'
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0d1322'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BearBoxLogo size={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc', lineHeight: 1.2 }}>
              BearBox
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Script Manager & Actions
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="bb-btn bb-btn-ghost bb-btn-sm"
            onClick={() => openManagerPage()}
            title="Open full script manager"
            style={{ padding: '6px' }}
          >
            <ExternalLink size={15} />
          </button>
        </div>
      </div>

      {/* Current Website Status Banner */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: siteDisabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          borderBottom: '1px solid ' + (siteDisabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <Globe size={16} color={siteDisabled ? '#ef4444' : '#34d399'} style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '12.5px',
                color: siteDisabled ? '#fca5a5' : '#6ee7b7',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={hostname}
            >
              {hostname}
            </div>
            <div style={{ fontSize: '11px', color: siteDisabled ? '#f87171' : '#34d399' }}>
              {siteDisabled ? 'BearBox is paused on this site' : 'Active on this website'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleSite}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: siteDisabled ? '#ef4444' : '#10b981',
            color: '#ffffff',
            flexShrink: 0,
            transition: 'opacity 0.15s ease'
          }}
          title={siteDisabled ? 'Resume BearBox on this website' : 'Pause BearBox on this website'}
        >
          <Power size={12} />
          {siteDisabled ? 'Disabled' : 'Enabled'}
        </button>
      </div>

      {/* Matching Scripts Section */}
      <div style={{ padding: '14px 16px', flex: 1, minHeight: '180px', maxHeight: '340px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Matching Tools ({matchingScripts.length + matchingForms.length})
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {allScripts.length} scripts in library
          </span>
        </div>

        {/* Internal Browser Page Notice */}
        {(currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://') || currentUrl.startsWith('edge://') || currentUrl.startsWith('about:')) && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '11.5px',
              color: '#fbbf24',
              lineHeight: 1.4
            }}
          >
            <strong>Browser internal page:</strong> Chrome prevents extensions from running scripts on internal pages. Navigate to a standard website (such as <span style={{ textDecoration: 'underline' }}>https://chatgpt.com/</span>) to use BearBox.
          </div>
        )}

        {/* Feedback message banner */}
        {runStatus && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '11.5px',
              marginBottom: '10px',
              backgroundColor: runStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: runStatus.success ? '#6ee7b7' : '#fca5a5',
              border: `1px solid ${runStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {runStatus.message}
            </span>
            <button
              type="button"
              onClick={() => setRunStatus(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {siteDisabled ? (
          <div className="bb-empty-state" style={{ padding: '24px 12px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
            <ShieldOff size={28} color="#64748b" />
            <div className="bb-empty-state-title" style={{ fontSize: '13px', marginTop: '6px', color: '#f8fafc' }}>
              BearBox Paused
            </div>
            <div className="bb-empty-state-desc" style={{ fontSize: '11.5px', marginBottom: '10px', color: '#94a3b8' }}>
              Tools and floating mascot are paused for this website. Click &quot;Disabled&quot; above to re-enable.
            </div>
          </div>
        ) : matchingScripts.length === 0 && matchingForms.length === 0 ? (
          <div className="bb-empty-state" style={{ padding: '24px 12px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
            <div className="bb-empty-state-icon">
              <BearBoxLogo size={36} />
            </div>
            <div className="bb-empty-state-title" style={{ fontSize: '13.5px', color: '#f8fafc' }}>
              No Matching Tools
            </div>
            <div className="bb-empty-state-desc" style={{ fontSize: '11.5px', marginBottom: '12px', color: '#94a3b8' }}>
              No active tools match <code>{hostname}</code>. Create a script or form configuration targeting this website!
            </div>
            <button
              type="button"
              className="bb-btn bb-btn-primary bb-btn-sm"
              onClick={() => openManagerPage(`https://${hostname}/*`)}
            >
              <Plus size={13} />
              Open Manager
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Form Autofill Mappings */}
            {matchingForms.map((form) => (
              <div
                key={form.id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  borderLeft: '3px solid #3b82f6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {form.name}
                    </div>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#93c5fd',
                        fontWeight: 700
                      }}
                    >
                      TOOL 1
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {form.fields.length} fields • Click floating mascot on page to autofill
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <label className="bb-switch" title={form.enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={async () => {
                        await toggleFormConfigEnabled(form.id);
                        await loadData();
                      }}
                    />
                    <span className="bb-slider" />
                  </label>
                </div>
              </div>
            ))}

            {/* Scripts */}
            {matchingScripts.map((script) => (
              <div
                key={script.id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#111827',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {script.name}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: script.executionMode === 'automatic' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: script.executionMode === 'automatic' ? '#fbbf24' : '#60a5fa',
                        fontWeight: 500
                      }}
                    >
                      {script.executionMode === 'automatic' ? 'Auto' : 'Manual'}
                    </span>
                  </div>

                  {script.description && (
                    <div
                      style={{
                        fontSize: '11.5px',
                        color: '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px'
                      }}
                    >
                      {script.description}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="bb-btn bb-btn-secondary bb-btn-sm"
                    onClick={() => handleRunScript(script)}
                    disabled={runningId === script.id || !script.enabled}
                    title="Run script now"
                    style={{ padding: '4px 8px' }}
                  >
                    <Play size={11} color="#60a5fa" fill={runningId === script.id ? '#60a5fa' : 'none'} />
                    {runningId === script.id ? 'Running' : 'Run'}
                  </button>

                  <label className="bb-switch" title={script.enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      checked={script.enabled}
                      onChange={() => handleToggleScript(script.id)}
                    />
                    <span className="bb-slider" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0d1322',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          type="button"
          className="bb-btn bb-btn-secondary bb-btn-sm"
          onClick={() => openManagerPage()}
        >
          Open Script Manager
        </button>

        <button
          type="button"
          className="bb-btn bb-btn-primary bb-btn-sm"
          onClick={() => openManagerPage()}
        >
          <Plus size={13} />
          New Script
        </button>
      </div>
    </div>
  );
};
