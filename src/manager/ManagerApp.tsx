import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Settings as SettingsIcon,
  Play,
  Edit2,
  Trash2,
  Globe,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  ShieldAlert,
  FileText,
  Copy,
  Download,
  Upload,
  BookOpen,
  Code
} from 'lucide-react';
import { BearBoxScript, BearBoxSettings } from '../types/script';
import { FormAutofillConfig } from '../types/formConfig';
import {
  getScripts,
  deleteScript,
  toggleScriptEnabled,
  duplicateScript,
  exportScripts,
  importScripts,
  getSettings,
  saveSettings,
  getFormConfigs,
  deleteFormConfig,
  toggleFormConfigEnabled,
  duplicateFormConfig,
  subscribeToStorageChanges
} from '../services/storage';
import { executionRegistry } from '../services/executor';
import { BearBoxLogo } from '../components/BearBoxLogo';
import { ScriptModal } from '../components/ScriptModal';
import { FormConfigModal } from '../components/FormConfigModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { ScriptGuideTab } from '../components/ScriptGuideTab';
import '../styles/theme.css';

export const ManagerApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scripts' | 'forms' | 'guide' | 'settings'>('scripts');
  const [scripts, setScripts] = useState<BearBoxScript[]>([]);
  const [formConfigs, setFormConfigs] = useState<FormAutofillConfig[]>([]);
  const [settings, setSettings] = useState<BearBoxSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter for scripts
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Search & Filter for forms
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [formFilterMode, setFormFilterMode] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Script Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<BearBoxScript | null>(null);
  const [deletingScript, setDeletingScript] = useState<BearBoxScript | null>(null);

  // Form Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingFormConfig, setEditingFormConfig] = useState<FormAutofillConfig | null>(null);
  const [deletingFormConfig, setDeletingFormConfig] = useState<FormAutofillConfig | null>(null);

  // Manual execution feedback
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [execMessage, setExecMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDuplicateScript = async (script: BearBoxScript) => {
    await duplicateScript(script.id);
    await loadData();
  };

  const handleExportAll = async () => {
    const json = await exportScripts();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bearbox-scripts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const res = await importScripts(content);
      if (res.errors.length > 0) {
        setImportStatus(`Imported ${res.importedCount} script(s). Notes: ${res.errors.join('; ')}`);
      } else {
        setImportStatus(`Successfully imported ${res.importedCount} script(s)!`);
      }
      setTimeout(() => setImportStatus(null), 5000);
      await loadData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadData = async () => {
    try {
      const [fetchedScripts, fetchedSettings, fetchedForms] = await Promise.all([
        getScripts(),
        getSettings(),
        getFormConfigs()
      ]);
      setScripts(fetchedScripts);
      setSettings(fetchedSettings);
      setFormConfigs(fetchedForms);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToStorageChanges(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleToggle = async (script: BearBoxScript) => {
    await toggleScriptEnabled(script.id);
    await loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingScript) return;
    await deleteScript(deletingScript.id);
    setDeletingScript(null);
    await loadData();
  };

  const handleRunManual = async (script: BearBoxScript) => {
    setExecutingId(script.id);
    setExecMessage(null);

    const result = await executionRegistry.executeScript(script, {
      url: 'https://example.com/test-environment',
      hostname: 'example.com',
      trigger: 'manual'
    });

    setExecutingId(null);
    if (result.success) {
      const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
      setExecMessage({ id: script.id, text: `Executed successfully: ${outputText}` });
    } else {
      setExecMessage({ id: script.id, text: `Execution failed: ${result.error}`, error: true });
    }
    await loadData();
  };

  const handleToggleForm = async (config: FormAutofillConfig) => {
    await toggleFormConfigEnabled(config.id);
    await loadData();
  };

  const handleDuplicateForm = async (config: FormAutofillConfig) => {
    await duplicateFormConfig(config.id);
    await loadData();
  };

  const handleDeleteFormConfirm = async () => {
    if (!deletingFormConfig) return;
    await deleteFormConfig(deletingFormConfig.id);
    setDeletingFormConfig(null);
    await loadData();
  };

  // Filter scripts
  const filteredScripts = scripts.filter((s) => {
    if (filterMode === 'enabled' && !s.enabled) return false;
    if (filterMode === 'disabled' && s.enabled) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = s.name.toLowerCase().includes(q);
    const matchDesc = s.description?.toLowerCase().includes(q);
    const matchRule = s.rules.some((r) => r.pattern.toLowerCase().includes(q));
    return matchName || matchDesc || matchRule;
  });

  // Filter form configs
  const filteredFormConfigs = formConfigs.filter((c) => {
    if (formFilterMode === 'enabled' && !c.enabled) return false;
    if (formFilterMode === 'disabled' && c.enabled) return false;

    if (!formSearchQuery.trim()) return true;
    const q = formSearchQuery.toLowerCase();
    const matchName = c.name.toLowerCase().includes(q);
    const matchDesc = c.description?.toLowerCase().includes(q);
    const matchRule = c.rules.some((r) => r.pattern.toLowerCase().includes(q));
    const matchField = c.fields.some((f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
    return matchName || matchDesc || matchRule || matchField;
  });

  const totalCount = scripts.length;
  const enabledCount = scripts.filter((s) => s.enabled).length;

  const totalFormsCount = formConfigs.length;
  const enabledFormsCount = formConfigs.filter((c) => c.enabled).length;
  const totalFieldsCount = formConfigs.reduce((acc, c) => acc + (c.fields?.length || 0), 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <BearBoxLogo size={48} animate />
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>Loading BearBox scripts...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#070b14', color: '#f8fafc' }}>
      {/* Floating Modern Header */}
      <div style={{ padding: '16px 24px 0 24px', maxWidth: '1360px', margin: '0 auto', position: 'sticky', top: 0, zIndex: 50 }}>
        <header
          style={{
            backgroundColor: 'rgba(11, 17, 32, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Left Mascot & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <BearBoxLogo size={36} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
                  BearBox
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 9px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(30, 64, 175, 0.25)',
                    color: '#38bdf8',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    letterSpacing: '0.01em'
                  }}
                >
                  Script Manager
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0', fontWeight: 400 }}>
                Rule-based website script automation &amp; floating icon manager
              </p>
            </div>
          </div>

          {/* Center Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Scripts Tab */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActiveTab('scripts')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeTab === 'scripts' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  backgroundColor: activeTab === 'scripts' ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                  color: activeTab === 'scripts' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: activeTab === 'scripts' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Code size={15} color={activeTab === 'scripts' ? '#38bdf8' : '#94a3b8'} />
                <span>Scripts</span>
                <span
                  style={{
                    backgroundColor: activeTab === 'scripts' ? '#1d4ed8' : 'rgba(30, 58, 138, 0.45)',
                    color: activeTab === 'scripts' ? '#ffffff' : '#93c5fd',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: '9999px',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}
                >
                  {scripts.length}
                </span>
              </button>
              {activeTab === 'scripts' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '2.5px',
                    backgroundColor: '#38bdf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)'
                  }}
                />
              )}
            </div>

            {/* Form Autofill Tab */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActiveTab('forms')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeTab === 'forms' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  backgroundColor: activeTab === 'forms' ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                  color: activeTab === 'forms' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: activeTab === 'forms' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <FileText size={15} color={activeTab === 'forms' ? '#38bdf8' : '#94a3b8'} />
                <span>Form Autofill</span>
                <span
                  style={{
                    backgroundColor: activeTab === 'forms' ? '#1d4ed8' : 'rgba(30, 58, 138, 0.45)',
                    color: activeTab === 'forms' ? '#ffffff' : '#93c5fd',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: '9999px',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}
                >
                  {formConfigs.length}
                </span>
              </button>
              {activeTab === 'forms' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '2.5px',
                    backgroundColor: '#38bdf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)'
                  }}
                />
              )}
            </div>

            {/* Script Guide Tab */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeTab === 'guide' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  backgroundColor: activeTab === 'guide' ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                  color: activeTab === 'guide' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: activeTab === 'guide' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <BookOpen size={15} color={activeTab === 'guide' ? '#38bdf8' : '#94a3b8'} />
                <span>Script Guide</span>
              </button>
              {activeTab === 'guide' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '2.5px',
                    backgroundColor: '#38bdf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)'
                  }}
                />
              )}
            </div>

            {/* Settings Tab */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeTab === 'settings' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                  backgroundColor: activeTab === 'settings' ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                  color: activeTab === 'settings' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: activeTab === 'settings' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <SettingsIcon size={15} color={activeTab === 'settings' ? '#38bdf8' : '#94a3b8'} />
                <span>Settings</span>
              </button>
              {activeTab === 'settings' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '2.5px',
                    backgroundColor: '#38bdf8',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)'
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

            {/* Import Button */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Import scripts or forms from JSON"
            >
              <Upload size={14} color="#94a3b8" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Export scripts to JSON"
            >
              <Download size={14} color="#94a3b8" />
              <span>Export</span>
            </button>

            {/* Create Script / Form Primary Button */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'forms') {
                  setEditingFormConfig(null);
                  setIsFormModalOpen(true);
                } else {
                  setEditingScript(null);
                  setIsModalOpen(true);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(14, 165, 233, 0.45)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{activeTab === 'forms' ? 'Create Form Autofill' : 'Create Script'}</span>
            </button>
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>
        {activeTab === 'guide' ? (
          <ScriptGuideTab
            onSwitchToScripts={() => {
              setActiveTab('scripts');
              setEditingScript(null);
              setIsModalOpen(true);
            }}
            onSwitchToForms={() => {
              setActiveTab('forms');
              setEditingFormConfig(null);
              setIsFormModalOpen(true);
            }}
          />
        ) : activeTab === 'settings' ? (
          /* Settings Panel */
          <div
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: 'var(--bb-shadow-md)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Extension Settings
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  Manage global execution options, disabled websites, and preferences.
                </p>
              </div>
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                onClick={() => setActiveTab('scripts')}
              >
                Back to Scripts
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
              {/* Global Enable */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '10px'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>Global Script Execution</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Enable or disable BearBox everywhere across all websites.
                  </div>
                </div>
                <label className="bb-switch">
                  <input
                    type="checkbox"
                    checked={settings?.enabledGlobally ?? true}
                    onChange={async (e) => {
                      const updated = await saveSettings({ enabledGlobally: e.target.checked });
                      setSettings(updated);
                    }}
                  />
                  <span className="bb-slider" />
                </label>
              </div>

              {/* Show Floating Icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '10px'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>Inject Floating BearBox Icon</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Show the draggable BearBox floating mascot on websites with matching enabled scripts.
                  </div>
                </div>
                <label className="bb-switch">
                  <input
                    type="checkbox"
                    checked={settings?.showIconOnMatchingPages ?? true}
                    onChange={async (e) => {
                      const updated = await saveSettings({ showIconOnMatchingPages: e.target.checked });
                      setSettings(updated);
                    }}
                  />
                  <span className="bb-slider" />
                </label>
              </div>

              {/* Disabled Hostnames List */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '10px'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                  Disabled Hostnames ({settings?.disabledHostnames?.length || 0})
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                  Websites where BearBox has been explicitly paused via the toolbar popup.
                </div>

                {!settings?.disabledHostnames || settings.disabledHostnames.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b', fontStyle: 'italic' }}>
                    No hostnames currently disabled. BearBox is active on all matching websites.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {settings.disabledHostnames.map((host) => (
                      <span
                        key={host}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#162035',
                          border: '1px solid #27354f',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      >
                        <Globe size={13} color="#94a3b8" />
                        {host}
                        <button
                          type="button"
                          onClick={async () => {
                            const updatedList = settings.disabledHostnames.filter((h) => h !== host);
                            const updated = await saveSettings({ disabledHostnames: updatedList });
                            setSettings(updated);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            fontWeight: 600,
                            padding: '0 2px'
                          }}
                          title="Re-enable on this site"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Security & Architecture Notice */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '10px',
                  display: 'flex',
                  gap: '12px'
                }}
              >
                <ShieldAlert size={20} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12.5px', color: '#bfdbfe', lineHeight: '1.6' }}>
                  <strong>Manifest V3 Security Compliance:</strong> BearBox isolates all floating controls inside a dedicated Shadow DOM root to prevent website CSS conflicts. Script execution operates through safe modular adapters without arbitrary remote code execution.
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'forms' ? (
          /* Form Autofill Configurations View */
          <div>
            {/* Stats Cards & Controls */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Form Configurations
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {totalFormsCount}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} color="#60a5fa" />
                  </div>
                </div>
              </div>

              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Active Forms
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                      {enabledFormsCount}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={20} color="#34d399" />
                  </div>
                </div>
              </div>

              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Mapped Target Fields
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {totalFieldsCount}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={20} color="#cbd5e1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}
            >
              <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
                <Search
                  size={16}
                  color="#64748b"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Search forms by name, website rule, or field..."
                  value={formSearchQuery}
                  onChange={(e) => setFormSearchQuery(e.target.value)}
                  className="bb-input"
                  style={{ paddingLeft: '36px', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`bb-btn bb-btn-sm ${formFilterMode === 'all' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
                  onClick={() => setFormFilterMode('all')}
                >
                  All ({totalFormsCount})
                </button>
                <button
                  type="button"
                  className={`bb-btn bb-btn-sm ${formFilterMode === 'enabled' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
                  onClick={() => setFormFilterMode('enabled')}
                >
                  Enabled ({enabledFormsCount})
                </button>
                <button
                  type="button"
                  className={`bb-btn bb-btn-sm ${formFilterMode === 'disabled' ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
                  onClick={() => setFormFilterMode('disabled')}
                >
                  Disabled ({totalFormsCount - enabledFormsCount})
                </button>
              </div>
            </div>

            {/* Form List or Empty State */}
            {formConfigs.length === 0 ? (
              <div className="bb-empty-state" style={{ padding: '60px 24px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div className="bb-empty-state-icon">
                  <BearBoxLogo size={64} />
                </div>
                <h3 className="bb-empty-state-title" style={{ fontSize: '18px', marginTop: '14px', color: '#f8fafc' }}>
                  No Form Autofill Configurations Yet
                </h3>
                <p className="bb-empty-state-desc" style={{ maxWidth: '480px', lineHeight: '1.6', color: '#94a3b8' }}>
                  Tool 1: Custom Form Autofill allows you to map target webpage fields and populate them with 1-click using structured data copied from Word, ChatGPT, Gemini, or other documents.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="bb-btn bb-btn-primary"
                    onClick={() => {
                      setEditingFormConfig(null);
                      setIsFormModalOpen(true);
                    }}
                  >
                    <Plus size={16} />
                    Create Form Configuration
                  </button>
                </div>
              </div>
            ) : filteredFormConfigs.length === 0 ? (
              <div className="bb-empty-state" style={{ padding: '40px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <Search size={32} color="#64748b" />
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: '10px 0 4px 0' }}>
                  No matching form configurations found
                </h4>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                  Try adjusting your search query or switching the filter tab.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredFormConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="bb-card"
                    style={{
                      padding: '20px 24px',
                      backgroundColor: '#111827',
                      borderColor: '#1e293b',
                      opacity: config.enabled ? 1 : 0.65,
                      borderLeft: config.enabled ? '4px solid #3b82f6' : '4px solid #334155'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {config.name}
                          </h3>
                          <span className="bb-badge bb-badge-primary">Tool 1: Autofill</span>
                          {config.mappingMode === 'script' ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(124, 58, 237, 0.2)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.4)' }}>
                              ⚡ Custom Script Mapping
                            </span>
                          ) : (
                            <span className="bb-badge bb-badge-info">
                              {config.fields.length} {config.fields.length === 1 ? 'Field' : 'Fields'}
                            </span>
                          )}
                          <span className="bb-badge bb-badge-muted">
                            {config.fields.filter((f) => f.required).length} Required
                          </span>
                        </div>

                        {config.description && (
                          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 10px 0', lineHeight: '1.4' }}>
                            {config.description}
                          </p>
                        )}

                        {/* Rules chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {config.rules.length === 0 ? (
                            <span style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
                              No website rules defined
                            </span>
                          ) : (
                            config.rules.map((rule) => (
                              <span
                                key={rule.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '11.5px',
                                  fontFamily: 'var(--bb-font-mono, monospace)',
                                  backgroundColor: '#162035',
                                  color: '#93c5fd',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #27354f'
                                }}
                              >
                                <Globe size={12} color="#60a5fa" />
                                {rule.pattern}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Mapped Fields preview */}
                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>Mapped:</span>
                          {config.fields.slice(0, 6).map((f) => (
                            <span
                              key={f.id}
                              style={{
                                backgroundColor: '#1e293b',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: '#cbd5e1'
                              }}
                            >
                              {f.label}{f.required ? '*' : ''}
                            </span>
                          ))}
                          {config.fields.length > 6 && (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              +{config.fields.length - 6} more
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px', fontSize: '11.5px', color: '#64748b' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            Updated {new Date(config.updatedAt).toLocaleDateString()}
                          </span>
                          <span>
                            Created {new Date(config.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions and Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {/* Duplicate Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-secondary bb-btn-sm"
                          onClick={() => handleDuplicateForm(config)}
                          title="Duplicate form configuration"
                        >
                          <Copy size={13} />
                          Duplicate
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-secondary bb-btn-sm"
                          onClick={() => {
                            setEditingFormConfig(config);
                            setIsFormModalOpen(true);
                          }}
                          title="Edit form mapping"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-ghost bb-btn-sm"
                          onClick={() => setDeletingFormConfig(config)}
                          title="Delete form mapping"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Enabled Switch */}
                        <div style={{ borderLeft: '1px solid #1e293b', paddingLeft: '12px' }}>
                          <label className="bb-switch" title={config.enabled ? 'Click to disable' : 'Click to enable'}>
                            <input
                              type="checkbox"
                              checked={config.enabled}
                              onChange={() => handleToggleForm(config)}
                            />
                            <span className="bb-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Scripts Management View */
          <div>
            {/* Stats Cards & Controls */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Total Scripts
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {totalCount}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={20} color="#60a5fa" />
                  </div>
                </div>
              </div>

              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Enabled Scripts
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                      {enabledCount}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={20} color="#34d399" />
                  </div>
                </div>
              </div>

              <div className="bb-card" style={{ padding: '18px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Website Rules
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {scripts.reduce((acc, s) => acc + (s.rules?.length || 0), 0)}
                    </div>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={20} color="#cbd5e1" />
                  </div>
                </div>
              </div>
            </div>

            {importStatus && (
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid #3b82f6',
                  borderRadius: '8px',
                  color: '#93c5fd',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{importStatus}</span>
                <button
                  type="button"
                  onClick={() => setImportStatus(null)}
                  style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Search and Filters Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}
            >
              {/* Search input */}
              <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
                <Search
                  size={16}
                  color="#64748b"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="bb-input"
                  style={{ paddingLeft: '36px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search scripts by name, description, or website URL..."
                />
              </div>

              {/* Filter tabs */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#090d16',
                  border: '1px solid #1e293b',
                  padding: '3px',
                  borderRadius: '8px',
                  gap: '2px'
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  style={{
                    border: 'none',
                    background: filterMode === 'all' ? '#1e293b' : 'transparent',
                    color: filterMode === 'all' ? '#f8fafc' : '#94a3b8',
                    fontWeight: 500,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: filterMode === 'all' ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('enabled')}
                  style={{
                    border: 'none',
                    background: filterMode === 'enabled' ? '#1e293b' : 'transparent',
                    color: filterMode === 'enabled' ? '#34d399' : '#94a3b8',
                    fontWeight: 500,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: filterMode === 'enabled' ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Enabled ({enabledCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('disabled')}
                  style={{
                    border: 'none',
                    background: filterMode === 'disabled' ? '#1e293b' : 'transparent',
                    color: filterMode === 'disabled' ? '#f87171' : '#94a3b8',
                    fontWeight: 500,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: filterMode === 'disabled' ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Disabled ({totalCount - enabledCount})
                </button>
              </div>
            </div>

            {/* Execution message banner if any */}
            {execMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: execMessage.error ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${execMessage.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  color: execMessage.error ? '#fca5a5' : '#6ee7b7',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{execMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setExecMessage(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Scripts List or Empty State */}
            {scripts.length === 0 ? (
              /* Clean empty state for new installation */
              <div className="bb-empty-state" style={{ padding: '60px 24px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <div className="bb-empty-state-icon">
                  <BearBoxLogo size={64} />
                </div>
                <h3 className="bb-empty-state-title" style={{ fontSize: '18px', marginTop: '14px', color: '#f8fafc' }}>
                  No Scripts Created Yet
                </h3>
                <p className="bb-empty-state-desc" style={{ maxWidth: '420px', lineHeight: '1.6', color: '#94a3b8' }}>
                  BearBox is ready to automate your favorite websites. Create your first script, assign website matching rules, and enjoy one-click access via the floating BearBox icon.
                </p>
                <button
                  type="button"
                  className="bb-btn bb-btn-primary"
                  onClick={() => {
                    setEditingScript(null);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Create Your First Script
                </button>
              </div>
            ) : filteredScripts.length === 0 ? (
              /* No search results */
              <div className="bb-empty-state" style={{ padding: '40px 20px', backgroundColor: '#111827', borderColor: '#1e293b' }}>
                <Search size={32} color="#64748b" />
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: '10px 0 4px 0' }}>
                  No matching scripts found
                </h4>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                  Try adjusting your search query or switching the filter tab.
                </p>
              </div>
            ) : (
              /* Script Cards Grid */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredScripts.map((script) => (
                  <div
                    key={script.id}
                    className="bb-card"
                    style={{
                      padding: '20px 24px',
                      backgroundColor: '#111827',
                      borderColor: '#1e293b',
                      opacity: script.enabled ? 1 : 0.65,
                      borderLeft: script.enabled ? '4px solid #3b82f6' : '4px solid #334155'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      {/* Left: Name, description, rules */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                            {script.name}
                          </h3>

                          {/* Mode Badge */}
                          <span className={`bb-badge ${script.executionMode === 'automatic' ? 'bb-badge-warning' : 'bb-badge-primary'}`}>
                            {script.executionMode === 'automatic' ? 'Automatic' : 'Manual'}
                          </span>

                          {/* Last run status badge */}
                          {script.lastRunStatus && (
                            <span
                              className={`bb-badge ${script.lastRunStatus === 'success'
                                ? 'bb-badge-success'
                                : script.lastRunStatus === 'error'
                                  ? 'bb-badge-danger'
                                  : 'bb-badge-muted'
                                }`}
                              title={script.lastRunMessage || undefined}
                            >
                              {script.lastRunStatus === 'success' && <CheckCircle size={11} />}
                              {script.lastRunStatus === 'error' && <AlertCircle size={11} />}
                              {script.lastRunStatus.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {script.description && (
                          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 10px 0', lineHeight: '1.4' }}>
                            {script.description}
                          </p>
                        )}

                        {/* Rules chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {script.rules.length === 0 ? (
                            <span style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
                              No website rules defined
                            </span>
                          ) : (
                            script.rules.map((rule) => (
                              <span
                                key={rule.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '11.5px',
                                  fontFamily: 'var(--bb-font-mono, monospace)',
                                  backgroundColor: '#162035',
                                  color: '#93c5fd',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #27354f'
                                }}
                              >
                                <Globe size={12} color="#60a5fa" />
                                {rule.pattern}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Metadata row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px', fontSize: '11.5px', color: '#64748b' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            Updated {new Date(script.updatedAt).toLocaleDateString()}
                          </span>
                          {script.lastRunAt && (
                            <span>
                              Last run: {new Date(script.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions and Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        {/* Run Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-secondary bb-btn-sm"
                          onClick={() => handleRunManual(script)}
                          disabled={executingId === script.id || !script.enabled}
                          title={script.enabled ? 'Test run script' : 'Enable script to run'}
                        >
                          <Play size={13} color="#60a5fa" fill={executingId === script.id ? '#60a5fa' : 'none'} />
                          {executingId === script.id ? 'Running...' : 'Run'}
                        </button>

                        {/* Duplicate Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-secondary bb-btn-sm"
                          onClick={() => handleDuplicateScript(script)}
                          title="Duplicate script"
                        >
                          <Copy size={13} />
                          Duplicate
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-secondary bb-btn-sm"
                          onClick={() => {
                            setEditingScript(script);
                            setIsModalOpen(true);
                          }}
                          title="Edit script"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="bb-btn bb-btn-ghost bb-btn-sm"
                          onClick={() => setDeletingScript(script)}
                          title="Delete script"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Enabled Switch */}
                        <div style={{ borderLeft: '1px solid #1e293b', paddingLeft: '12px' }}>
                          <label className="bb-switch" title={script.enabled ? 'Click to disable' : 'Click to enable'}>
                            <input
                              type="checkbox"
                              checked={script.enabled}
                              onChange={() => handleToggle(script)}
                            />
                            <span className="bb-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Script Create / Edit Modal */}
      {isModalOpen && (
        <ScriptModal
          isOpen={isModalOpen}
          script={editingScript}
          onClose={() => {
            setIsModalOpen(false);
            setEditingScript(null);
          }}
          onSaved={async () => {
            await loadData();
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deletingScript && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingScript)}
          scriptName={deletingScript.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingScript(null)}
        />
      )}

      {/* Form Config Create / Edit Modal */}
      {isFormModalOpen && (
        <FormConfigModal
          isOpen={isFormModalOpen}
          config={editingFormConfig}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingFormConfig(null);
          }}
          onSaved={async () => {
            await loadData();
          }}
        />
      )}

      {/* Confirm Delete Form Dialog */}
      {deletingFormConfig && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingFormConfig)}
          title="Delete Form Configuration"
          itemName={deletingFormConfig.name}
          onConfirm={handleDeleteFormConfirm}
          onCancel={() => setDeletingFormConfig(null)}
        />
      )}
    </div>
  );
};
