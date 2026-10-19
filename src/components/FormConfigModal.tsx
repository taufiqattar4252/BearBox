import React, { useState, useMemo } from 'react';
import { X, Save, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Code, Table, RefreshCw, CheckCircle } from 'lucide-react';
import { FormAutofillConfig, FormFieldMapping, FormFieldType, MappingMode } from '../types/formConfig';
import { RuleEditor } from './RuleEditor';
import { CodeEditor } from './CodeEditor';
import { saveFormConfig, generateFieldMappingId } from '../services/storage';
import { generateFieldsFromScript, generateScriptFromFields } from '../services/formScriptParser';

interface FormConfigModalProps {
  config?: FormAutofillConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (saved: FormAutofillConfig) => void;
}

const STUDENT_REGISTRATION_SCRIPT = `/**
 * Student Registration Form Mapping Script
 *
 * Maps parsed student record fields to webpage form elements.
 *
 * Available variables:
 * - record: { studentName, studentId, dob, class, section, parentName, parentPhone, email, address, admissionDate }
 * - helpers: { setInput, setSelect, setCheckbox, setRadio, query, queryAll, log }
 * - document: Webpage document DOM
 */

const { setInput, setSelect, setCheckbox, setRadio, log } = helpers;

// 1. Text & contact inputs
if (record.studentName) setInput('#student-name, [name="student_name"]', record.studentName, 'Student Name');
if (record.studentId) setInput('#student-id, [name="student_id"]', record.studentId, 'Student ID');
if (record.parentName) setInput('#parent-name, [name="parent_name"]', record.parentName, 'Parent Name');
if (record.parentPhone) setInput('#parent-phone, [name="parent_phone"]', record.parentPhone, 'Parent Phone');
if (record.email) setInput('#email, [name="email"]', record.email, 'Email');
if (record.address) setInput('#address, [name="address"]', record.address, 'Address');

// 2. Date pickers (YYYY-MM-DD)
if (record.dob) setInput('#dob, [name="dob"]', record.dob, 'Date of Birth');
if (record.admissionDate) setInput('#admission-date, [name="admission_date"]', record.admissionDate, 'Admission Date');

// 3. Dropdowns & radio groups
if (record.class) setSelect('#class-select, #class, [name="class"]', record.class, 'Class');
if (record.section) setRadio('section', record.section, 'Section');

log('Student registration fields populated successfully via custom script.');`;

export const FormConfigModal: React.FC<FormConfigModalProps> = ({
  config,
  isOpen,
  onClose,
  onSaved
}) => {
  const isEditing = Boolean(config);

  const [name, setName] = useState(config?.name || '');
  const [description, setDescription] = useState(config?.description || '');
  const [rules, setRules] = useState(config?.rules || [{ id: 'r1', pattern: 'https://example.com/register' }]);
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const initialFields: FormFieldMapping[] = config?.fields || [
    {
      id: generateFieldMappingId(),
      key: 'studentName',
      label: 'Student Name',
      aliases: ['Student Name', 'Full Name', 'Name'],
      selector: '#student-name, input[name="student_name"]',
      type: 'text',
      required: true,
      transform: 'trim'
    },
    {
      id: generateFieldMappingId(),
      key: 'studentId',
      label: 'Student ID',
      aliases: ['Student ID', 'Roll No', 'Registration No'],
      selector: '#student-id, input[name="student_id"]',
      type: 'text',
      required: true,
      transform: 'trim'
    },
    {
      id: generateFieldMappingId(),
      key: 'dob',
      label: 'Date of Birth',
      aliases: ['Date of Birth', 'DOB', 'Birth Date'],
      selector: '#dob, input[name="dob"]',
      type: 'date',
      required: true,
      transform: 'none'
    }
  ];

  const [fields, setFields] = useState<FormFieldMapping[]>(initialFields);
  const [mappingMode, setMappingMode] = useState<MappingMode>(config?.mappingMode || 'visual');
  const [mappingScript, setMappingScript] = useState<string>(
    config?.mappingScript || generateScriptFromFields(initialFields)
  );
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Number of fields currently detected from mappingScript
  const detectedCount = useMemo(() => {
    return generateFieldsFromScript(mappingScript, fields).length;
  }, [mappingScript, fields]);

  // Real-time update: when script changes, also generate the Visual Table
  const handleScriptChange = (newScript: string) => {
    setMappingScript(newScript);
    const detected = generateFieldsFromScript(newScript, fields);
    if (detected.length > 0) {
      setFields(detected);
    }
  };

  const handleSyncTableFromScript = () => {
    const detected = generateFieldsFromScript(mappingScript, fields);
    setFields(detected);
    setSyncStatus(`Visual Table synchronized (${detected.length} ${detected.length === 1 ? 'field' : 'fields'} mapped).`);
    setTimeout(() => setSyncStatus(null), 3500);
  };

  const handleGenerateScriptFromFields = () => {
    const script = generateScriptFromFields(fields);
    setMappingScript(script);
    setSyncStatus(`Script generated from ${fields.length} table fields.`);
    setTimeout(() => setSyncStatus(null), 3500);
  };

  const handleSwitchToVisual = () => {
    const detected = generateFieldsFromScript(mappingScript, fields);
    if (detected.length > 0) {
      setFields(detected);
    }
    setMappingMode('visual');
  };

  const handleSwitchToScript = () => {
    setMappingMode('script');
    if (!mappingScript.trim() && fields.length > 0) {
      setMappingScript(generateScriptFromFields(fields));
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    const nextScript = mappingScript.trim() ? `${mappingScript}\n${snippet}` : snippet;
    handleScriptChange(nextScript);
  };

  if (!isOpen) return null;

  const handleAddField = () => {
    const newField: FormFieldMapping = {
      id: generateFieldMappingId(),
      key: `field_${fields.length + 1}`,
      label: `Field ${fields.length + 1}`,
      aliases: [`Field ${fields.length + 1}`],
      selector: '',
      type: 'text',
      required: false,
      transform: 'trim'
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (id: string, updates: Partial<FormFieldMapping>) => {
    setFields(
      fields.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, ...updates };
        // If label changed and key is default, update key
        if (updates.label && (!f.key || f.key.startsWith('field_'))) {
          updated.key = updates.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
        }
        return updated;
      })
    );
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setFields(updated);
  };

  const handleLoadStudentTemplate = () => {
    setName('Student Registration Form');
    setDescription('Autofills student admission forms from records copied from Word, ChatGPT, or Gemini.');
    setRules([{ id: 'r_std', pattern: 'https://example.org/students/new' }]);
    setFields([
      { id: generateFieldMappingId(), key: 'studentName', label: 'Student Name', aliases: ['Student Name', 'Name', 'Full Name'], selector: '#student-name, [name="student_name"]', type: 'text', required: true, transform: 'titlecase' },
      { id: generateFieldMappingId(), key: 'studentId', label: 'Student ID', aliases: ['Student ID', 'ID', 'Roll Number'], selector: '#student-id, [name="student_id"]', type: 'text', required: true, transform: 'uppercase' },
      { id: generateFieldMappingId(), key: 'dob', label: 'Date of Birth', aliases: ['Date of Birth', 'DOB', 'Birth Date'], selector: '#dob, [name="dob"]', type: 'date', required: true, transform: 'none' },
      { id: generateFieldMappingId(), key: 'class', label: 'Class', aliases: ['Class', 'Grade', 'Standard'], selector: '#class, [name="class"]', type: 'text', required: false, transform: 'trim' },
      { id: generateFieldMappingId(), key: 'section', label: 'Section', aliases: ['Section', 'Division'], selector: '#section, [name="section"]', type: 'text', required: false, transform: 'uppercase' },
      { id: generateFieldMappingId(), key: 'parentName', label: 'Parent Name', aliases: ['Parent Name', 'Father Name', 'Guardian Name'], selector: '#parent-name, [name="parent_name"]', type: 'text', required: true, transform: 'titlecase' },
      { id: generateFieldMappingId(), key: 'parentPhone', label: 'Parent Phone', aliases: ['Parent Phone', 'Phone', 'Mobile', 'Contact'], selector: '#parent-phone, [name="parent_phone"]', type: 'tel', required: true, transform: 'trim' },
      { id: generateFieldMappingId(), key: 'email', label: 'Email', aliases: ['Email', 'Email Address'], selector: '#email, [name="email"]', type: 'email', required: false, transform: 'lowercase' },
      { id: generateFieldMappingId(), key: 'address', label: 'Address', aliases: ['Address', 'Permanent Address', 'Residential Address'], selector: '#address, [name="address"]', type: 'textarea', required: false, transform: 'trim' },
      { id: generateFieldMappingId(), key: 'admissionDate', label: 'Admission Date', aliases: ['Admission Date', 'Date of Admission'], selector: '#admission-date, [name="admission_date"]', type: 'date', required: false, transform: 'none' }
    ]);
    setMappingScript(STUDENT_REGISTRATION_SCRIPT);
    setSyncStatus('Loaded 10-field student registration template!');
    setTimeout(() => setSyncStatus(null), 3500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a configuration name.');
      return;
    }

    if (mappingMode === 'visual' && fields.length === 0) {
      setErrorMessage('Please add at least one field mapping or switch to Script Mode.');
      return;
    }

    if (mappingMode === 'script' && !mappingScript.trim()) {
      setErrorMessage('Please enter your custom JavaScript mapping script.');
      return;
    }

    try {
      setSaving(true);
      // Synchronize visual fields from script so saved configuration is consistent
      let finalFields = fields;
      if (mappingMode === 'script' && mappingScript.trim()) {
        const fromScript = generateFieldsFromScript(mappingScript, fields);
        if (fromScript.length > 0) {
          finalFields = fromScript;
        }
      }

      const saved = await saveFormConfig({
        id: config?.id,
        name: name.trim(),
        description: description.trim(),
        rules,
        enabled,
        fields: finalFields,
        mappingMode,
        mappingScript
      });
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0d1322'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              {isEditing ? 'Edit Form Configuration' : 'Create Form Configuration'}
            </h2>
            <button
              type="button"
              onClick={handleLoadStudentTemplate}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#60a5fa',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Pre-fill standard 10-field Student Form"
            >
              <Sparkles size={13} /> Load 10-Field Template
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {errorMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  color: '#f87171',
                  fontSize: '13px'
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Configuration Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Student Registration Form"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. For onboarding new students from Word or ChatGPT"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Target Website Rules */}
            <div
              style={{
                backgroundColor: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '14px'
              }}
            >
              <RuleEditor rules={rules} onChange={setRules} />
            </div>

            {/* Field Mappings Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Form Field Mappings ({fields.length})
                    {mappingMode === 'script' && (
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(124, 58, 237, 0.2)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.4)' }}>
                        ⚡ Script Mode
                      </span>
                    )}
                  </h3>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {mappingMode === 'script'
                      ? 'Custom JavaScript script defines how parsed fields are identified, transformed, and filled.'
                      : 'Maps source labels from copied text to target input selectors on the webpage.'}
                  </div>
                </div>

                {/* Mode Selector Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', background: '#090d16', padding: '3px', borderRadius: '7px', border: '1px solid #1e293b' }}>
                    <button
                      type="button"
                      onClick={handleSwitchToVisual}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: mappingMode === 'visual' ? '#2563eb' : 'transparent',
                        color: mappingMode === 'visual' ? '#ffffff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Table size={13} /> Visual Table ({fields.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToScript}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: mappingMode === 'script' ? '#7c3aed' : 'transparent',
                        color: mappingMode === 'script' ? '#ffffff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Code size={13} /> Custom Script
                    </button>
                  </div>

                  {mappingMode === 'visual' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleAddField}
                        style={{
                          padding: '5px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Plus size={14} /> Add Field
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMappingScript(generateScriptFromFields(fields));
                          setMappingMode('script');
                        }}
                        title="Open script editor generated from these visual table fields"
                        style={{
                          padding: '5px 10px',
                          backgroundColor: 'rgba(124, 58, 237, 0.15)',
                          border: '1px solid rgba(124, 58, 237, 0.35)',
                          borderRadius: '6px',
                          color: '#c084fc',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Code size={12} /> Convert to Script
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSyncTableFromScript}
                        title="Rebuild Visual Table directly from this script"
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #3b82f6',
                          borderRadius: '6px',
                          color: '#93c5fd',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <RefreshCw size={12} /> Sync Table ({detectedCount})
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateScriptFromFields}
                        title="Convert visual fields table into a JavaScript mapping script"
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Sparkles size={12} color="#a855f7" /> Overwrite from Table
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SCRIPT MODE CONTENT */}
              {mappingMode === 'script' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Script Guidance Box */}
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'rgba(124, 58, 237, 0.08)',
                      border: '1px solid rgba(124, 58, 237, 0.25)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#cbd5e1',
                      lineHeight: '1.5'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#c084fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Code size={14} /> JavaScript Mapping Engine
                    </div>
                    <div>
                      Write custom code to locate and populate elements on the webpage. Access parsed values via <code style={{ color: '#93c5fd' }}>record.&lt;key&gt;</code> and DOM utilities via <code style={{ color: '#93c5fd' }}>helpers</code>:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      <span style={{ backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#67e8f9' }}>helpers.setInput(selector, val)</span>
                      <span style={{ backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#67e8f9' }}>helpers.setSelect(selector, val)</span>
                      <span style={{ backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#67e8f9' }}>helpers.setCheckbox(selector, bool)</span>
                      <span style={{ backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#67e8f9' }}>helpers.setRadio(name, val)</span>
                      <span style={{ backgroundColor: '#090d16', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#67e8f9' }}>return &#123; key: selector &#125;</span>
                    </div>
                  </div>

                  {/* Live Auto-Sync Status Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#93c5fd'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={14} color="#60a5fa" />
                      <span>
                        <strong>Visual Table Auto-Sync:</strong> As you write your script, the Visual Table is automatically generated (<strong>{detectedCount}</strong> {detectedCount === 1 ? 'field' : 'fields'} mapped).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwitchToVisual}
                      style={{
                        padding: '3px 9px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#2563eb',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Table size={12} /> View Visual Table →
                    </button>
                  </div>

                  {syncStatus && (
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        color: '#34d399',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle size={14} /> {syncStatus}
                    </div>
                  )}

                  {/* Snippet Insertion Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Insert Snippet:</span>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`if (record.fieldKey) setInput('#target-selector', record.fieldKey, 'Field Label');`)}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' }}
                    >
                      + setInput
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`if (record.fieldKey) setSelect('#select-selector', record.fieldKey, 'Select Label');`)}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' }}
                    >
                      + setSelect
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`if (record.fieldKey) setCheckbox('#checkbox-selector', record.fieldKey, 'Checkbox Label');`)}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' }}
                    >
                      + setCheckbox
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`if (record.fieldKey) setRadio('group_name', record.fieldKey, 'Radio Label');`)}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' }}
                    >
                      + setRadio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`return {\n  studentName: '#student-name',\n  studentId: '#student-id'\n};`)}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', cursor: 'pointer' }}
                    >
                      + Selector Map
                    </button>
                  </div>

                  {/* Code Editor */}
                  <CodeEditor
                    value={mappingScript}
                    onChange={handleScriptChange}
                    minHeight="280px"
                    placeholder="// Write JavaScript mapping script..."
                  />
                </div>
              ) : (
                /* VISUAL TABLE CONTENT */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {syncStatus && (
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        color: '#34d399',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle size={14} /> {syncStatus}
                    </div>
                  )}

                  {/* Visual Table Subtitle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: '11.5px', color: '#94a3b8' }}>
                    <span>
                      These {fields.length} {fields.length === 1 ? 'field is' : 'fields are'} automatically synchronized with your mapping script.
                    </span>
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                      ⚡ Auto-synced with Custom Script
                    </span>
                  </div>

                  {/* Visual Table Header */}
                  {fields.length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1.6fr 1.8fr 100px 90px 45px',
                        gap: '8px',
                        padding: '6px 12px',
                        backgroundColor: '#090d16',
                        borderRadius: '6px',
                        border: '1px solid #1e293b',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      <div>Field Label &amp; Key</div>
                      <div>Source Aliases</div>
                      <div>Target CSS Selector</div>
                      <div>Type</div>
                      <div>Required</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>
                  )}

                  {fields.length === 0 && (
                    <div
                      style={{
                        padding: '30px',
                        textAlign: 'center',
                        backgroundColor: '#111827',
                        border: '1px dashed #334155',
                        borderRadius: '8px',
                        color: '#94a3b8'
                      }}
                    >
                      <Table size={28} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>No Fields in Visual Table</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Write a script in the Custom Script tab, or click <strong>Add Field</strong> to add fields manually.
                      </div>
                      <button
                        type="button"
                        onClick={handleAddField}
                        style={{
                          marginTop: '12px',
                          padding: '6px 14px',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Add First Field
                      </button>
                    </div>
                  )}
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    style={{
                      backgroundColor: '#111827',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1.8fr 100px 90px 45px', gap: '8px', alignItems: 'center' }}>
                      {/* Label & Key */}
                      <div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                          placeholder="Field Label"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#090d16',
                            border: '1px solid #1e293b',
                            borderRadius: '5px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                          title="Field Label"
                        />
                      </div>

                      {/* Source Aliases */}
                      <div>
                        <input
                          type="text"
                          value={field.aliases.join(', ')}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="Aliases: Name, Full Name"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#090d16',
                            border: '1px solid #1e293b',
                            borderRadius: '5px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                          title="Source Aliases (comma-separated)"
                        />
                      </div>

                      {/* Selector */}
                      <div>
                        <input
                          type="text"
                          value={field.selector}
                          onChange={(e) => handleUpdateField(field.id, { selector: e.target.value })}
                          placeholder="CSS Selector: #id or [name='...']"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#090d16',
                            border: '1px solid #1e293b',
                            borderRadius: '5px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            boxSizing: 'border-box'
                          }}
                          title="Target CSS Selector"
                        />
                      </div>

                      {/* Element Type */}
                      <div>
                        <select
                          value={field.type}
                          onChange={(e) => handleUpdateField(field.id, { type: e.target.value as FormFieldType })}
                          style={{
                            width: '100%',
                            padding: '6px 4px',
                            backgroundColor: '#090d16',
                            border: '1px solid #1e293b',
                            borderRadius: '5px',
                            color: '#f8fafc',
                            fontSize: '11.5px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Select</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="radio">Radio</option>
                          <option value="date">Date</option>
                          <option value="number">Number</option>
                          <option value="email">Email</option>
                          <option value="tel">Phone</option>
                        </select>
                      </div>

                      {/* Required Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="checkbox"
                          id={`req_${field.id}`}
                          checked={field.required}
                          onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                          style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                        />
                        <label htmlFor={`req_${field.id}`} style={{ fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}>
                          Req.
                        </label>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'up')}
                          disabled={idx === 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: idx === 0 ? '#475569' : '#94a3b8',
                            cursor: idx === 0 ? 'default' : 'pointer',
                            padding: '3px'
                          }}
                          title="Move up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(idx, 'down')}
                          disabled={idx === fields.length - 1}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: idx === fields.length - 1 ? '#475569' : '#94a3b8',
                            cursor: idx === fields.length - 1 ? 'default' : 'pointer',
                            padding: '3px'
                          }}
                          title="Move down"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '3px',
                            borderRadius: '4px'
                          }}
                          title="Delete field"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#0d1322'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                Enabled
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
