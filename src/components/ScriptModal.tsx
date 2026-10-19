import React, { useState } from 'react';
import { X, Save, Sliders, BookOpen, Sparkles, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BearBoxScript, ExecutionMode, ScriptRule } from '../types/script';
import { CodeEditor } from './CodeEditor';
import { RuleEditor } from './RuleEditor';
import { saveScript } from '../services/storage';
import { executeUserScript, ScriptExecutionReport } from '../services/scriptEngine';

interface ScriptModalProps {
  script?: BearBoxScript | null; // null for Create mode
  isOpen: boolean;
  onClose: () => void;
  onSaved: (saved: BearBoxScript) => void;
}

const TEMPLATES = {
  nexaura: {
    name: 'Nexaura Digital Contact Form',
    pattern: 'https://nexauradigital.com/*',
    code: `/**
 * BearBox Script: Nexaura Digital Contact Form
 * Target: https://nexauradigital.com/*
 *
 * Populates First Name, Last Name, Email, and Phone (+1 react-tel-input)
 * using associated labels, placeholders, and React value setters.
 */
async function runBearBoxAutofill(record) {
  // 1. First Name: matches placeholder "Please enter first name" or label
  if (record.firstName) {
    await bearbox.setValue(
      bearbox.findByPlaceholder('Please enter first name') || 'input[placeholder="Please enter first name"]',
      record.firstName,
      { label: 'First Name' }
    );
  }

  // 2. Last Name: matches placeholder "Please enter last name" or label
  if (record.lastName) {
    await bearbox.setValue(
      bearbox.findByPlaceholder('Please enter last name') || 'input[placeholder="Please enter last name"]',
      record.lastName,
      { label: 'Last Name' }
    );
  }

  // 3. Email: matches type="email" or placeholder "Please enter your email"
  if (record.email) {
    await bearbox.setValue(
      bearbox.findByPlaceholder('Please enter your email') || 'input[type="email"]',
      record.email,
      { label: 'Email' }
    );
  }

  // 4. Telephone: handles react-tel-input with preserved +1 country code
  if (record.phone) {
    const phoneInput = bearbox.$('input[type="tel"]') || bearbox.findByPlaceholder('1 (702) 123-4567');
    const formatted = bearbox.formatPhone(record.phone);
    await bearbox.setValue(phoneInput || 'input[type="tel"]', formatted, { label: 'Phone Number' });
  }

  return bearbox.getResults();
}`
  },
  multiField: {
    name: 'QA Practice Multi-Field Form',
    pattern: 'https://www.qapractice.com/practice-forms*',
    code: `/**
 * BearBox Script: QA Practice Web Form Automation
 * Target: https://www.qapractice.com/practice-forms*
 *
 * Populates Country, Title, Name, React Datepicker (YYYY-MM-DD),
 * Date of Joining (dd/mm/yyyy), Email, Phone Code & Number,
 * and Communication preference radio buttons.
 */
async function runBearBoxAutofill(record) {
  // 1. Dropdown Selects
  const country = record.country || record.countryOfResidence || 'United States';
  await bearbox.setSelect('#forms-country', country, { label: 'Country of Residence' });

  const title = record.title || 'Dr.';
  await bearbox.setSelect('#forms-title', title, { label: 'Title' });

  // 2. Text Inputs
  const firstName = record.firstName || record.first_name || record.givenName;
  if (firstName) await bearbox.setValue('#forms-first-name', firstName, { label: 'First Name' });

  const lastName = record.lastName || record.last_name || record.familyName;
  if (lastName) await bearbox.setValue('#forms-last-name', lastName, { label: 'Last Name' });

  // 3. Dates with target format conversions
  const dob = record.dob || record.dateOfBirth || record.birthDate;
  if (dob) {
    await bearbox.setDate('#forms-dob', dob, { targetFormat: 'YYYY-MM-DD', label: 'Date of Birth' });
  }

  const doj = record.doj || record.dateOfJoining || record.joiningDate;
  if (doj) {
    await bearbox.setDate('#forms-doj', doj, { targetFormat: 'dd/mm/yyyy', label: 'Date of Joining' });
  }

  // 4. Email & Phone
  const email = record.email || record.emailAddress;
  if (email) await bearbox.setValue('#forms-email', email, { label: 'Email Address' });

  const phoneCode = record.phoneCode || record.countryCode || '+1';
  await bearbox.setSelect('#forms-phone-code', phoneCode, { label: 'Phone Country Code' });

  const phone = record.phone || record.phoneNumber;
  if (phone) await bearbox.setValue('#forms-phone-number', phone, { label: 'Phone Number' });

  // 5. Preferred Communication Method (Radio Buttons: Email or Phone)
  const commMethod = (record.commMethod || record.preferredCommunicationMethod || record.communicationMethod || 'Email').toLowerCase();
  const radioId = commMethod.includes('phone') ? '#forms-comm-phone' : '#forms-comm-email';
  await bearbox.setRadio(radioId, true, { label: 'Preferred Communication Method' });

  return bearbox.getResults();
}`
  },
  autofillSimple: {
    name: 'Standard Form Autofill',
    pattern: 'https://*/*',
    code: `/**
 * BearBox Script: General Autofill
 * Uses high-level bearbox.autofill dictionary
 */
async function runBearBoxAutofill(record) {
  return await bearbox.autofill({
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone
  });
}`
  },
  ranasiKyc: {
    name: 'Ranasi Vendor KYC (87 Fields)',
    pattern: 'https://www.ranasi.com/demos/vendor-kyc-87.html*',
    code: `/**
 * BearBox Script: Northwind Vendor KYC (87 Fields)
 * Target: https://www.ranasi.com/demos/vendor-kyc-87.html*
 *
 * Populates all 87 business and representative KYC inputs
 * on the Northwind Vendor KYC benchmark form in seconds.
 */
async function runBearBoxAutofill(record) {
  const data = {
    legal_name: record.legal_name || record.legalName || 'Northwind Traders International Inc.',
    dba: record.dba || record.tradeName || 'Northwind Global',
    entity_type: record.entity_type || record.entityType || 'Corporation (C-Corp)',
    jurisdiction: record.jurisdiction || 'Delaware, United States',
    year_formed: record.year_formed || record.yearFormed || '2016',
    tax_id: record.tax_id || record.taxId || '12-3456789',
    vat: record.vat || record.vatNumber || 'US987654321',
    duns: record.duns || record.dunsNumber || '01-234-5678',
    lei: record.lei || '5493001KJTIIGC8Y1R12',
    reg_no: record.reg_no || record.regNumber || 'SR-9823412',
    website: record.website || record.url || 'https://northwindtraders.example.com',
    industry: record.industry || record.naics || '541512 - Computer Systems Design',
    employees: record.employees || record.employeeCount || '450',
    annual_rev: record.annual_rev || record.annualRevenue || '65000000',
    hq_line1: record.hq_line1 || record.addressLine1 || '100 Northwind Boulevard, Suite 500',
    hq_line2: record.hq_line2 || record.addressLine2 || 'Building B',
    hq_city: record.hq_city || record.city || 'Seattle',
    hq_region: record.hq_region || record.state || 'WA',
    hq_postal: record.hq_postal || record.zip || '98101',
    hq_country: record.hq_country || record.country || 'United States',
    bill_line1: record.bill_line1 || '100 Northwind Boulevard, Suite 500',
    bill_city: record.bill_city || 'Seattle',
    bill_region: record.bill_region || 'WA',
    bill_postal: record.bill_postal || '98101',
    bill_country: record.bill_country || 'United States',
    ship_line1: record.ship_line1 || '742 Evergreen Warehouse Dock 4',
    ship_city: record.ship_city || 'Tacoma',
    ship_postal: record.ship_postal || '98402',
    rep_full: record.rep_full || \`\${record.firstName || 'Sarah'} \${record.lastName || 'Connor'}\`,
    rep_given: record.rep_given || record.firstName || 'Sarah',
    rep_family: record.rep_family || record.lastName || 'Connor',
    rep_title: record.rep_title || record.title || 'Chief Operations Officer',
    rep_dob: record.rep_dob || record.dob || '1982-05-14',
    rep_nationality: record.rep_nationality || 'American',
    rep_country: record.rep_country || 'United States',
    rep_doc_type: record.rep_doc_type || 'Passport',
    rep_passport: record.rep_passport || 'A98765432',
    rep_issued: record.rep_issued || '2020-06-15',
    rep_expiry: record.rep_expiry || '2030-06-15',
    rep_pob: record.rep_pob || 'Los Angeles, CA',
    rep_email: record.rep_email || record.email || 's.connor@northwind.example.com',
    rep_phone: record.rep_phone || record.phone || '+1 (206) 555-0199',
    ap_name: record.ap_name || 'Marcus Brody',
    ap_email: record.ap_email || 'ap@northwind.example.com',
    ap_phone: record.ap_phone || '+1 (206) 555-0144',
    sales_name: record.sales_name || 'Elena Vance',
    sales_email: record.sales_email || 'sales@northwind.example.com',
    support_email: record.support_email || 'support@northwind.example.com',
    bank_name: record.bank_name || 'JPMorgan Chase Bank, N.A.',
    bank_branch: record.bank_branch || 'Downtown Seattle Commercial Branch',
    bank_account_name: record.bank_account_name || 'Northwind Traders International Operating',
    bank_account_no: record.bank_account_no || '987654321012',
    bank_routing: record.bank_routing || '125000024',
    bank_iban: record.bank_iban || 'US64JPMC125000024987654321012',
    bank_swift: record.bank_swift || 'CHASUS33XXX',
    bank_currency: record.bank_currency || 'USD',
    payment_terms: record.payment_terms || 'Net 30 Days',
    payment_method: record.payment_method || 'ACH Direct Deposit',
    po_required: record.po_required || 'Yes',
    w9: record.w9 || 'Yes - Certified & On File',
    coi: record.coi || 'Yes - Active 2026/2027',
    insurance_carrier: record.insurance_carrier || 'Travelers Casualty and Surety',
    insurance_policy: record.insurance_policy || 'TRV-89412-GL',
    gl_limit: record.gl_limit || '2,000,000',
    sanctions: record.sanctions || 'Screened & Cleared (OFAC/EU/UN)',
    pep: record.pep || 'No PEP Association Identified',
    ubo_name: record.ubo_name || 'Jonathan Archer',
    ubo_pct: record.ubo_pct || '65%',
    ubo_country: record.ubo_country || 'United States',
    ubo_id: record.ubo_id || 'UBO-981247',
    controller_name: record.controller_name || 'Michael Chang',
    controller_title: record.controller_title || 'Chief Executive Officer',
    ndaa: record.ndaa || 'Section 889 Compliant',
    conflict: record.conflict || 'No Known Conflicts of Interest',
    subcontract: record.subcontract || 'No Tier-1 Subcontractors',
    diversity: record.diversity || 'Small Business Enterprise (SBE)',
    sustainability: record.sustainability || 'sustainability@northwind.example.com',
    data_residency: record.data_residency || 'United States (AWS us-west-2)',
    security_contact: record.security_contact || 'security-team@northwind.example.com',
    incident_phone: record.incident_phone || '+1 (206) 555-0911',
    onboarding_date: record.onboarding_date || '2026-11-01',
    cost_center: record.cost_center || 'CC-4810-ENG',
    buyer_name: record.buyer_name || 'David Martinez',
    buyer_email: record.buyer_email || 'dmartinez@enterprise-buyer.com',
    category: record.category || 'Software & Cloud Infrastructure Services',
    risk_tier: record.risk_tier || 'Tier 1 - Low Inherent Risk',
    notes: record.notes || 'Full KYC package completed and verified using BearBox Script Engine.'
  };

  const dateFields = new Set(['rep_dob', 'rep_issued', 'rep_expiry', 'onboarding_date']);

  for (const [fieldName, val] of Object.entries(data)) {
    if (val === undefined || val === null || val === '') continue;
    const selector = \`[name="\${fieldName}"]\`;
    if (dateFields.has(fieldName)) {
      await bearbox.setDate(selector, String(val), { label: fieldName });
    } else {
      await bearbox.setValue(selector, String(val), { label: fieldName });
    }
  }

  return bearbox.getResults();
}`
  }
};

export const ScriptModal: React.FC<ScriptModalProps> = ({
  script,
  isOpen,
  onClose,
  onSaved
}) => {
  const isEditing = Boolean(script);

  const [name, setName] = useState(script?.name || '');
  const [description, setDescription] = useState(script?.description || '');
  const [sourceCode, setSourceCode] = useState(script?.sourceCode || TEMPLATES.autofillSimple.code);
  const [rules, setRules] = useState<ScriptRule[]>(
    script?.rules || [{ id: 'r1', pattern: 'https://example.com/*' }]
  );
  const [enabled, setEnabled] = useState(script?.enabled ?? true);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(script?.executionMode || 'manual');
  const [runAt, setRunAt] = useState<'document_idle' | 'document_start' | 'document_end'>(
    script?.runAt || 'document_idle'
  );
  const [category, setCategory] = useState<'autofill' | 'automation' | 'general'>(
    script?.category || 'autofill'
  );
  const [configJson, setConfigJson] = useState(
    script?.config ? JSON.stringify(script.config, null, 2) : '{\n  \n}'
  );
  const [showConfig, setShowConfig] = useState(false);
  const [showApiDocs, setShowApiDocs] = useState(false);

  // Test Run in Modal
  const [testRecordInput, setTestRecordInput] = useState(
    '{\n  "firstName": "Alex",\n  "lastName": "Morgan",\n  "email": "alex.morgan@example.com",\n  "phone": "7021234567"\n}'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testReport, setTestReport] = useState<ScriptExecutionReport | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (key: keyof typeof TEMPLATES) => {
    const t = TEMPLATES[key];
    if (!name.trim()) setName(t.name);
    setSourceCode(t.code);
    if (rules.length === 0 || (rules.length === 1 && rules[0].pattern === 'https://example.com/*')) {
      setRules([{ id: `rule_${Date.now()}`, pattern: t.pattern }]);
    }
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestReport(null);
    try {
      let parsedRecord: Record<string, any> = {};
      try {
        parsedRecord = JSON.parse(testRecordInput);
      } catch {
        parsedRecord = { rawText: testRecordInput };
      }

      const tempScript: BearBoxScript = {
        id: script?.id || 'temp_test_script',
        name: name || 'Test Script',
        sourceCode,
        rules,
        enabled: true,
        executionMode: 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const report = await executeUserScript(tempScript, {
        record: parsedRecord,
        url: window.location.href,
        hostname: window.location.hostname,
        trigger: 'manual'
      });

      setTestReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestReport({
        success: false,
        scriptId: 'test_error',
        scriptName: name || 'Test Script',
        timestamp: Date.now(),
        totalFieldsAttempted: 0,
        successfulFieldsCount: 0,
        failedFieldsCount: 1,
        results: [],
        logs: [`Test execution error: ${msg}`],
        error: msg,
        message: msg
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a script name.');
      return;
    }

    let parsedConfig: Record<string, unknown> = {};
    if (configJson.trim()) {
      try {
        parsedConfig = JSON.parse(configJson);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Invalid JSON configuration: ${msg}`);
        return;
      }
    }

    try {
      setSaving(true);
      const saved = await saveScript({
        id: script?.id,
        name: name.trim(),
        description: description.trim(),
        sourceCode,
        rules,
        enabled,
        executionMode,
        runAt,
        category,
        config: parsedConfig,
        createdAt: script?.createdAt
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
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '94vh',
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #1e293b'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#111827'
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              {isEditing ? 'Edit Userscript' : 'Create New Userscript'}
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              {isEditing
                ? `Modifying "${script?.name}"`
                : 'Define website-specific automation logic using the BearBox Userscript Engine.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowApiDocs(!showApiDocs)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: showApiDocs ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: '1px solid #334155',
                color: showApiDocs ? '#93c5fd' : '#cbd5e1',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <BookOpen size={13} />
              API Docs
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
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
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              backgroundColor: '#0f172a'
            }}
          >
            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fca5a5',
                  fontSize: '13px'
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* API Documentation Drawer */}
            {showApiDocs && (
              <div
                style={{
                  backgroundColor: '#090d16',
                  border: '1px solid #2563eb',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  fontSize: '12px',
                  color: '#cbd5e1',
                  lineHeight: '1.5'
                }}
              >
                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '6px', fontSize: '13px' }}>
                  ⚡ BearBox Userscript API Reference
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  <div>
                    <strong style={{ color: '#f8fafc' }}>Element Queries:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><code>bearbox.$(selector)</code> — querySelector</li>
                      <li><code>bearbox.$$(selector)</code> — querySelectorAll</li>
                      <li><code>bearbox.findByLabel(text)</code> — associated label</li>
                      <li><code>bearbox.findByPlaceholder(text)</code> — placeholder</li>
                      <li><code>bearbox.findById(id)</code> — element by ID</li>
                      <li><code>bearbox.findField(criteria)</code> — multi-locator</li>
                      <li><code>bearbox.waitFor(selector, opts)</code> — async wait</li>
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: '#f8fafc' }}>Field Setters (React safe):</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><code>await bearbox.setValue(el, val, opts)</code> — text/tel/email</li>
                      <li><code>await bearbox.setSelect(el, valOrText)</code> — dropdown</li>
                      <li><code>await bearbox.setCheckbox(el, bool)</code> — checkbox</li>
                      <li><code>await bearbox.setRadio(group, val)</code> — radio group</li>
                      <li><code>await bearbox.setDate(el, val, opts)</code> — date format</li>
                      <li><code>bearbox.formatPhone(val)</code> — +1 react-tel-input</li>
                      <li><code>await bearbox.autofill(map)</code> — batch fill</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Template Selector Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                backgroundColor: '#111827',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #1e293b'
              }}
            >
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} color="#fbbf24" />
                Templates:
              </span>
              <button
                type="button"
                className="bb-btn bb-btn-secondary bb-btn-sm"
                onClick={() => handleApplyTemplate('nexaura')}
              >
                Nexaura Contact Form
              </button>
              <button
                type="button"
                className="bb-btn bb-btn-secondary bb-btn-sm"
                onClick={() => handleApplyTemplate('multiField')}
              >
                QA Practice Form (Select/Date/Radio)
              </button>
              <button
                type="button"
                className="bb-btn bb-btn-secondary bb-btn-sm"
                onClick={() => handleApplyTemplate('autofillSimple')}
              >
                Clean Autofill Map
              </button>
              <button
                type="button"
                className="bb-btn bb-btn-secondary bb-btn-sm"
                onClick={() => handleApplyTemplate('ranasiKyc')}
              >
                Ranasi KYC (87 Fields)
              </button>
            </div>

            {/* Script Name & Enabled Toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'flex-start' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Script Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="bb-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Nexaura Digital Autofill, Student Admissions Form..."
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                  Status
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <label className="bb-switch">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span className="bb-slider" />
                  </label>
                  <span style={{ fontSize: '13px', color: enabled ? '#34d399' : '#64748b', fontWeight: 500 }}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Description <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  className="bb-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this script does..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  className="bb-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="autofill">Custom Form Autofill (Tool 1)</option>
                  <option value="automation">DOM Automation</option>
                  <option value="general">General Userscript</option>
                </select>
              </div>
            </div>

            {/* Execution Timing & Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Execution Trigger
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${executionMode === 'manual' ? '#3b82f6' : '#1e293b'}`,
                      backgroundColor: executionMode === 'manual' ? 'rgba(59, 130, 246, 0.12)' : '#090d16',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                  >
                    <input
                      type="radio"
                      name="executionMode"
                      value="manual"
                      checked={executionMode === 'manual'}
                      onChange={() => setExecutionMode('manual')}
                    />
                    Manual (On-Click)
                  </label>

                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${executionMode === 'automatic' ? '#3b82f6' : '#1e293b'}`,
                      backgroundColor: executionMode === 'automatic' ? 'rgba(59, 130, 246, 0.12)' : '#090d16',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                  >
                    <input
                      type="radio"
                      name="executionMode"
                      value="automatic"
                      checked={executionMode === 'automatic'}
                      onChange={() => setExecutionMode('automatic')}
                    />
                    Automatic
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  Execution Timing (runAt)
                </label>
                <select
                  className="bb-input"
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value as any)}
                >
                  <option value="document_idle">document_idle (Default - after DOM & resources load)</option>
                  <option value="document_end">document_end (Immediate after DOM is loaded)</option>
                  <option value="document_start">document_start (Before DOM starts loading)</option>
                </select>
              </div>
            </div>

            {/* Website Matching Rules */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
              <RuleEditor rules={rules} onChange={setRules} />
            </div>

            {/* Source Code Editor */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  JavaScript Source Code
                </label>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Async function or top-level statements with <code>bearbox</code> and <code>record</code> in scope
                </span>
              </div>
              <CodeEditor
                value={sourceCode}
                onChange={setSourceCode}
                minHeight="260px"
                placeholder="// Enter JavaScript logic..."
              />
            </div>

            {/* Test on Current Page / Fixture */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play size={14} color="#60a5fa" />
                  Test Execution Preview
                </label>
                <button
                  type="button"
                  className="bb-btn bb-btn-secondary bb-btn-sm"
                  onClick={handleRunTest}
                  disabled={isTesting}
                >
                  {isTesting ? 'Testing...' : '▶ Run Test'}
                </button>
              </div>

              <textarea
                className="bb-input"
                value={testRecordInput}
                onChange={(e) => setTestRecordInput(e.target.value)}
                rows={3}
                style={{ fontFamily: 'var(--bb-font-mono, monospace)', fontSize: '11.5px', backgroundColor: '#090d16' }}
                placeholder="Test record JSON input..."
              />

              {testReport && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: testReport.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${testReport.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: testReport.success ? '#34d399' : '#f87171' }}>
                    {testReport.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {testReport.message}
                  </div>
                  {testReport.results.length > 0 && (
                    <div style={{ marginTop: '6px', color: '#cbd5e1' }}>
                      Fields: {testReport.results.map((r) => `${r.label || r.key}: ${r.success ? '✓' : '✕ (' + r.message + ')'}`).join('; ')}
                    </div>
                  )}
                  {testReport.logs.length > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                      Logs: {testReport.logs.join(' | ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Extensible Script Configuration (Collapsible) */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => setShowConfig(!showConfig)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  <Sliders size={15} color="#60a5fa" />
                  Custom Script Configuration (JSON)
                </div>
                <span style={{ fontSize: '12px', color: '#60a5fa' }}>
                  {showConfig ? 'Hide' : 'Show / Configure'}
                </span>
              </div>

              {showConfig && (
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    className="bb-input"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    rows={3}
                    style={{ fontFamily: 'var(--bb-font-mono, monospace)', fontSize: '12px', backgroundColor: '#090d16' }}
                    placeholder="{ &quot;apiKey&quot;: &quot;...&quot;, &quot;targetSelector&quot;: &quot;.main-content&quot; }"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Optional JSON parameters accessible in script execution via <code>bearbox.config</code>.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Bar */}
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: '#111827',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {isEditing && script?.updatedAt && (
                <span>Last updated: {new Date(script.updatedAt).toLocaleString()}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bb-btn bb-btn-primary"
                disabled={saving}
              >
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Userscript'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
