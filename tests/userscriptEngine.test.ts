import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createBearBoxApi, formatNormalizedDate } from '../src/services/bearboxApi';
import { executeUserScript, resetNavigationExecutionCache } from '../src/services/scriptEngine';
import { executeSafeScriptInterpretation } from '../src/services/formFiller';
import {
  saveScript,
  getScripts,
  duplicateScript,
  exportScripts,
  importScripts,
  toggleScriptEnabled,
  deleteScript
} from '../src/services/storage';
import { BearBoxScript } from '../src/types/script';

describe('BearBox Tampermonkey-Style Userscript Engine', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
    (global as any).HTMLSelectElement = dom.window.HTMLSelectElement;
    (global as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    (global as any).Event = dom.window.Event;
    (global as any).InputEvent = dom.window.InputEvent || dom.window.Event;

    resetNavigationExecutionCache();
  });

  /* =========================================================================
     1. Date & Phone Utilities
     ========================================================================= */
  describe('Utility Formatters', () => {
    it('formats dates into YYYY-MM-DD and dd/mm/yyyy correctly', () => {
      // YYYY-MM-DD
      expect(formatNormalizedDate('2000-05-15', 'YYYY-MM-DD')).toBe('2000-05-15');
      expect(formatNormalizedDate('15/05/2000', 'YYYY-MM-DD')).toBe('2000-05-15');

      // dd/mm/yyyy
      expect(formatNormalizedDate('2000-05-15', 'dd/mm/yyyy')).toBe('15/05/2000');
      expect(formatNormalizedDate('05/15/2000', 'dd/mm/yyyy')).toBe('15/05/2000');
      expect(formatNormalizedDate('2000/05/15', 'dd/mm/yyyy')).toBe('15/05/2000');
    });

    it('formats phone numbers preserving +1 country code', () => {
      const bearbox = createBearBoxApi();
      expect(bearbox.formatPhone('7021234567')).toBe('+1 (702) 123-4567');
      expect(bearbox.formatPhone('17021234567')).toBe('+1 (702) 123-4567');
      expect(bearbox.formatPhone('+1 (702) 123-4567')).toBe('+1 (702) 123-4567');
    });
  });

  /* =========================================================================
     2. BearBox API Helpers & React State
     ========================================================================= */
  describe('BearBox API Helpers & Field Setters', () => {
    it('locates elements by label, placeholder, aria, and id', () => {
      document.body.innerHTML = `
        <div>
          <label for="f-user">Username</label>
          <input id="f-user" />
          <input placeholder="Enter Secret Code" />
          <input aria-label="Security Token" />
        </div>
      `;

      const bearbox = createBearBoxApi();
      expect(bearbox.findByLabel('Username')).not.toBeNull();
      expect(bearbox.findByPlaceholder('Enter Secret Code')).not.toBeNull();
      expect(bearbox.findByAria('Security Token')).not.toBeNull();
      expect(bearbox.findById('f-user')).not.toBeNull();
    });

    it('sets input value, resets React _valueTracker, and fires events', async () => {
      document.body.innerHTML = '<input id="firstName" />';
      const input = document.getElementById('firstName') as HTMLInputElement;

      // Simulate React _valueTracker
      (input as any)._valueTracker = {
        getValue: () => '',
        setValue: () => {},
        stop: () => {}
      };

      let inputFired = false;
      let changeFired = false;
      input.addEventListener('input', () => { inputFired = true; });
      input.addEventListener('change', () => { changeFired = true; });

      const bearbox = createBearBoxApi();
      const res = await bearbox.setValue(input, 'Samantha');

      expect(res.success).toBe(true);
      expect(input.value).toBe('Samantha');
      expect(inputFired).toBe(true);
      expect(changeFired).toBe(true);
      expect((input as any)._valueTracker).toBeUndefined();
    });

    it('respects non-empty field overwrite policy when overwrite is false', async () => {
      document.body.innerHTML = '<input id="city" value="Chicago" />';
      const bearbox = createBearBoxApi();

      const res = await bearbox.setValue('#city', 'New York', { overwrite: false });
      expect(res.success).toBe(true);
      expect((document.getElementById('city') as HTMLInputElement).value).toBe('Chicago');
      expect(res.message).toContain('Skipped');
    });

    it('throws security error if userscript attempts auto-submission', () => {
      const bearbox = createBearBoxApi();
      expect(() => bearbox.submit()).toThrow('Auto-submission is disabled in BearBox');
    });
  });

  /* =========================================================================
     3. TEST A: Nexaura Digital Contact Form (No IDs or names, react-tel-input)
     ========================================================================= */
  describe('Test A: Nexaura Digital Contact Form (Userscript Execution)', () => {
    beforeEach(() => {
      // Representative local fixture matching actual Nexaura Digital DOM
      document.body.innerHTML = `
        <form class="contact-form-wrapper">
          <div class="form-group">
            <label class="field-label">First Name</label>
            <input type="text" class="custom-input-class" placeholder="Please enter first name" />
          </div>
          <div class="form-group">
            <label class="field-label">Last Name</label>
            <input type="text" class="custom-input-class" placeholder="Please enter last name" />
          </div>
          <div class="form-group">
            <label class="field-label">Email</label>
            <input type="email" class="custom-input-class" placeholder="Please enter your email" />
          </div>
          <div class="form-group react-tel-input">
            <label class="field-label">Phone Number</label>
            <input type="tel" class="form-control" placeholder="1 (702) 123-4567" value="+1" />
          </div>
          <button type="button" class="btn-submit">Submit</button>
        </form>
      `;

      // Attach React valueTrackers
      document.querySelectorAll('input').forEach((el) => {
        (el as any)._valueTracker = {
          getValue: () => (el.value === '+1' ? '+1' : ''),
          setValue: () => {},
          stop: () => {}
        };
      });
    });

    it('executes website-specific userscript and successfully populates all 4 fields', async () => {
      const nexauraScript: BearBoxScript = {
        id: 'script-nexaura-1',
        name: 'Nexaura Digital Autofill',
        rules: [{ id: 'r1', pattern: 'https://nexauradigital.com/*' }],
        enabled: true,
        executionMode: 'manual',
        sourceCode: `
          async function runBearBoxAutofill(record) {
            // First Name
            await bearbox.setValue(
              bearbox.findByPlaceholder('Please enter first name'),
              record.firstName,
              { label: 'First Name' }
            );

            // Last Name
            await bearbox.setValue(
              bearbox.findByPlaceholder('Please enter last name'),
              record.lastName,
              { label: 'Last Name' }
            );

            // Email
            await bearbox.setValue(
              bearbox.findByPlaceholder('Please enter your email'),
              record.email,
              { label: 'Email' }
            );

            // Telephone with react-tel-input format
            const phoneEl = bearbox.$('input[type="tel"]');
            const formattedPhone = bearbox.formatPhone(record.phone);
            await bearbox.setValue(phoneEl, formattedPhone, { label: 'Phone Number' });

            return bearbox.getResults();
          }
        `,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const record = {
        firstName: 'Taylor',
        lastName: 'Swift',
        email: 'taylor@example.com',
        phone: '7025550199'
      };

      const report = await executeUserScript(nexauraScript, {
        record,
        url: 'https://nexauradigital.com/contact',
        hostname: 'nexauradigital.com'
      });

      expect(report.success).toBe(true);
      expect(report.successfulFieldsCount).toBe(4);
      expect(report.failedFieldsCount).toBe(0);

      // Verify DOM values
      const fnInput = document.querySelector('input[placeholder="Please enter first name"]') as HTMLInputElement;
      const lnInput = document.querySelector('input[placeholder="Please enter last name"]') as HTMLInputElement;
      const emInput = document.querySelector('input[placeholder="Please enter your email"]') as HTMLInputElement;
      const telInput = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(fnInput.value).toBe('Taylor');
      expect(lnInput.value).toBe('Swift');
      expect(emInput.value).toBe('taylor@example.com');
      expect(telInput.value).toBe('+1 (702) 555-0199');
    });

    it('reports clear failure if a required element cannot be found', async () => {
      // Remove the email input from the DOM
      const emInput = document.querySelector('input[placeholder="Please enter your email"]');
      emInput?.remove();

      const nexauraScript: BearBoxScript = {
        id: 'script-nexaura-fail',
        name: 'Nexaura Autofill',
        rules: [{ id: 'r1', pattern: 'https://nexauradigital.com/*' }],
        enabled: true,
        executionMode: 'manual',
        sourceCode: `
          async function runBearBoxAutofill(record) {
            await bearbox.setValue(bearbox.findByPlaceholder('Please enter first name'), record.firstName, { label: 'First Name' });
            await bearbox.setValue(bearbox.findByPlaceholder('Please enter your email'), record.email, { label: 'Email' });
          }
        `,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const report = await executeUserScript(nexauraScript, {
        record: { firstName: 'Taylor', email: 'test@example.com' }
      });

      expect(report.success).toBe(false);
      expect(report.successfulFieldsCount).toBe(1);
      expect(report.failedFieldsCount).toBe(1);
      const emailResult = report.results.find((r) => r.label === 'Email');
      expect(emailResult?.success).toBe(false);
      expect(emailResult?.elementFound).toBe(false);
    });
  });

  /* =========================================================================
     4. TEST B: Multi-Field Form (Selects, Radios, Dates with specific formats)
     ========================================================================= */
  describe('Test B: Multi-Field Form Controls', () => {
    beforeEach(() => {
      // Representative local fixture matching all requested IDs and control types
      document.body.innerHTML = `
        <form id="multi-control-form">
          <!-- Country of Residence -->
          <select id="forms-country">
            <option value="">Select Country</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="IN">India</option>
          </select>

          <!-- Title -->
          <select id="forms-title">
            <option value="">Select Title</option>
            <option value="Mr">Mr.</option>
            <option value="Ms">Ms.</option>
            <option value="Dr">Dr.</option>
          </select>

          <!-- First Name & Last Name -->
          <input type="text" id="forms-first-name" />
          <input type="text" id="forms-last-name" />

          <!-- Date of Birth (placeholder: YYYY-MM-DD) -->
          <input type="text" id="forms-dob" placeholder="YYYY-MM-DD" />

          <!-- Date of Joining (placeholder: dd/mm/yyyy) -->
          <input type="text" id="forms-doj" placeholder="dd/mm/yyyy" />

          <!-- Email -->
          <input type="email" id="forms-email" />

          <!-- Phone country code -->
          <select id="forms-phone-code">
            <option value="">Code</option>
            <option value="+1">+1 (US)</option>
            <option value="+44">+44 (UK)</option>
            <option value="+91">+91 (IN)</option>
          </select>

          <!-- Phone Number -->
          <input type="tel" id="forms-phone-number" />

          <!-- Preferred Communication Method (Radios) -->
          <input type="radio" id="forms-comm-email" name="comm-method" value="email" />
          <input type="radio" id="forms-comm-phone" name="comm-method" value="phone" />
        </form>
      `;
    });

    it('populates all controls with proper format conversions without mistaking radios or codes', async () => {
      const multiFieldScript: BearBoxScript = {
        id: 'script-multi-1',
        name: 'Multi-Field Registration Automation',
        rules: [
          { id: 'r1', pattern: 'https://example.com/forms/*' },
          { id: 'r2', pattern: 'https://www.qapractice.com/practice-forms*' }
        ],
        enabled: true,
        executionMode: 'manual',
        sourceCode: `
          async function runBearBoxAutofill(record) {
            // 1. Selects
            await bearbox.setSelect('#forms-country', record.country, { label: 'Country' });
            await bearbox.setSelect('#forms-title', record.title, { label: 'Title' });

            // 2. Names
            await bearbox.setValue('#forms-first-name', record.firstName, { label: 'First Name' });
            await bearbox.setValue('#forms-last-name', record.lastName, { label: 'Last Name' });

            // 3. Dates with specific format conversions
            await bearbox.setDate('#forms-dob', record.dob, { targetFormat: 'YYYY-MM-DD', label: 'DOB' });
            await bearbox.setDate('#forms-doj', record.doj, { targetFormat: 'dd/mm/yyyy', label: 'DOJ' });

            // 4. Email & Phone
            await bearbox.setValue('#forms-email', record.email, { label: 'Email' });
            await bearbox.setSelect('#forms-phone-code', record.phoneCode, { label: 'Phone Code' });
            await bearbox.setValue('#forms-phone-number', record.phone, { label: 'Phone Number' });

            // 5. Radio button
            await bearbox.setRadio(record.commMethod === 'phone' ? '#forms-comm-phone' : '#forms-comm-email', record.commMethod, { label: 'Comm Method' });

            return bearbox.getResults();
          }
        `,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const testRecord = {
        country: 'Canada', // Select by visible text
        title: 'Dr', // Select by value
        firstName: 'Jordan',
        lastName: 'Lee',
        dob: '15/05/1992', // Input is dd/mm/yyyy -> target is YYYY-MM-DD
        doj: '2023-08-01', // Input is YYYY-MM-DD -> target is dd/mm/yyyy
        email: 'jordan.lee@example.org',
        phoneCode: '+44',
        phone: '7911123456',
        commMethod: 'phone'
      };

      const report = await executeUserScript(multiFieldScript, {
        record: testRecord,
        url: 'https://example.com/forms/admissions'
      });

      expect(report.success).toBe(true);
      expect(report.failedFieldsCount).toBe(0);

      // Verify DOM values
      const countryEl = document.getElementById('forms-country') as HTMLSelectElement;
      const titleEl = document.getElementById('forms-title') as HTMLSelectElement;
      const fnEl = document.getElementById('forms-first-name') as HTMLInputElement;
      const lnEl = document.getElementById('forms-last-name') as HTMLInputElement;
      const dobEl = document.getElementById('forms-dob') as HTMLInputElement;
      const dojEl = document.getElementById('forms-doj') as HTMLInputElement;
      const emailEl = document.getElementById('forms-email') as HTMLInputElement;
      const codeEl = document.getElementById('forms-phone-code') as HTMLSelectElement;
      const phoneEl = document.getElementById('forms-phone-number') as HTMLInputElement;
      const radioPhone = document.getElementById('forms-comm-phone') as HTMLInputElement;
      const radioEmail = document.getElementById('forms-comm-email') as HTMLInputElement;

      expect(countryEl.value).toBe('CA');
      expect(titleEl.value).toBe('Dr');
      expect(fnEl.value).toBe('Jordan');
      expect(lnEl.value).toBe('Lee');

      // Date of Birth converted to YYYY-MM-DD
      expect(dobEl.value).toBe('1992-05-15');

      // Date of Joining converted to dd/mm/yyyy
      expect(dojEl.value).toBe('01/08/2023');

      expect(emailEl.value).toBe('jordan.lee@example.org');
      expect(codeEl.value).toBe('+44');
      expect(phoneEl.value).toBe('7911123456');

      // Radio button selection
      expect(radioPhone.checked).toBe(true);
      expect(radioEmail.checked).toBe(false);
    });
  });

  /* =========================================================================
     5. Storage, Duplicate, Import, and Export Operations
     ========================================================================= */
  describe('Script Storage & Management Operations', () => {
    it('supports creating, duplicating, exporting, importing, and deleting scripts', async () => {
      const initial = await saveScript({
        name: 'Exportable Script',
        description: 'For import/export tests',
        sourceCode: 'console.log("hello");',
        rules: [{ id: 'r1', pattern: 'https://testsite.com/*' }]
      });

      expect(initial.id).toBeDefined();

      // Duplicate
      const dup = await duplicateScript(initial.id);
      expect(dup).not.toBeNull();
      expect(dup?.name).toBe('Exportable Script (Copy)');
      expect(dup?.id).not.toBe(initial.id);

      // Export
      const exportedJson = await exportScripts([initial.id]);
      expect(exportedJson).toContain('Exportable Script');
      expect(exportedJson).toContain('https://testsite.com/*');

      // Delete initial
      await deleteScript(initial.id);
      const scriptsAfterDelete = await getScripts();
      expect(scriptsAfterDelete.find((s) => s.id === initial.id)).toBeUndefined();

      // Import back
      const importResult = await importScripts(exportedJson);
      expect(importResult.importedCount).toBe(1);
      expect(importResult.errors.length).toBe(0);

      const scriptsAfterImport = await getScripts();
      const restored = scriptsAfterImport.find((s) => s.name === 'Exportable Script');
      expect(restored).toBeDefined();
    });

    it('toggles script enabled/disabled state cleanly', async () => {
      const script = await saveScript({
        name: 'Toggle Test Script',
        sourceCode: '// test'
      });

      expect(script.enabled).toBe(true);

      const toggledOff = await toggleScriptEnabled(script.id, false);
      expect(toggledOff?.enabled).toBe(false);

      const toggledOn = await toggleScriptEnabled(script.id, true);
      expect(toggledOn?.enabled).toBe(true);
    });
  });

  /* =========================================================================
     6. Navigation & SPA Duplicate Run Guard
     ========================================================================= */
  describe('SPA Navigation Execution Guard', () => {
    it('skips duplicate automatic executions on the same page cycle but runs on route change', async () => {
      const autoScript: BearBoxScript = {
        id: 'script-spa-auto',
        name: 'SPA Auto Script',
        rules: [{ id: 'r1', pattern: 'https://example.com/*' }],
        enabled: true,
        executionMode: 'automatic',
        sourceCode: 'bearbox.log("auto running");',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // First run on /page1
      const res1 = await executeUserScript(autoScript, {
        url: 'https://example.com/page1',
        trigger: 'automatic'
      });
      expect(res1.message).not.toContain('Skipped duplicate');

      // Repeated run on /page1 in same navigation cycle
      const res2 = await executeUserScript(autoScript, {
        url: 'https://example.com/page1',
        trigger: 'automatic'
      });
      expect(res2.message).toContain('Skipped duplicate');

      // Reset cache on SPA route change
      resetNavigationExecutionCache();

      // Run on new route /page2
      const res3 = await executeUserScript(autoScript, {
        url: 'https://example.com/page2',
        trigger: 'automatic'
      });
      expect(res3.message).not.toContain('Skipped duplicate');
    });
  });

  /* =========================================================================
     7. Live Web Benchmark: Ranasi Vendor KYC (87 Fields)
     ========================================================================= */
  describe('Ranasi Vendor KYC Benchmark Form (87 Fields)', () => {
    it('populates and verifies all 87 fields with 100% accuracy', async () => {
      document.body.innerHTML = `
        <form id="vendor-kyc-form">
          <label>Legal entity name <input name="legal_name" type="text" /></label>
          <label>Trade / DBA name <input name="dba" type="text" /></label>
          <label>Entity type <input name="entity_type" type="text" /></label>
          <label>Jurisdiction of formation <input name="jurisdiction" type="text" /></label>
          <label>Year formed <input name="year_formed" type="text" /></label>
          <label>Tax ID / EIN <input name="tax_id" type="text" /></label>
          <label>VAT / GST number <input name="vat" type="text" /></label>
          <label>D-U-N-S number <input name="duns" type="text" /></label>
          <label>LEI <input name="lei" type="text" /></label>
          <label>Company registration number <input name="reg_no" type="text" /></label>
          <label>Company website <input name="website" type="url" /></label>
          <label>Industry / NAICS <input name="industry" type="text" /></label>
          <label>Employee count <input name="employees" type="text" /></label>
          <label>Annual revenue (USD) <input name="annual_rev" type="text" /></label>
          <label>HQ address line 1 <input name="hq_line1" type="text" /></label>
          <label>HQ address line 2 <input name="hq_line2" type="text" /></label>
          <label>HQ city <input name="hq_city" type="text" /></label>
          <label>HQ state / region <input name="hq_region" type="text" /></label>
          <label>HQ postal code <input name="hq_postal" type="text" /></label>
          <label>HQ country <input name="hq_country" type="text" /></label>
          <label>Billing address line 1 <input name="bill_line1" type="text" /></label>
          <label>Billing city <input name="bill_city" type="text" /></label>
          <label>Billing state / region <input name="bill_region" type="text" /></label>
          <label>Billing postal code <input name="bill_postal" type="text" /></label>
          <label>Billing country <input name="bill_country" type="text" /></label>
          <label>Remit-to address line 1 <input name="ship_line1" type="text" /></label>
          <label>Remit-to city <input name="ship_city" type="text" /></label>
          <label>Remit-to postal code <input name="ship_postal" type="text" /></label>
          <label>Authorized representative <input name="rep_full" type="text" /></label>
          <label>Representative given name <input name="rep_given" type="text" /></label>
          <label>Representative family name <input name="rep_family" type="text" /></label>
          <label>Representative title <input name="rep_title" type="text" /></label>
          <label>Representative date of birth <input name="rep_dob" type="date" /></label>
          <label>Representative nationality <input name="rep_nationality" type="text" /></label>
          <label>Representative country of issue <input name="rep_country" type="text" /></label>
          <label>Representative document type <input name="rep_doc_type" type="text" /></label>
          <label>Representative passport number <input name="rep_passport" type="text" /></label>
          <label>Passport date of issue <input name="rep_issued" type="date" /></label>
          <label>Passport date of expiry <input name="rep_expiry" type="date" /></label>
          <label>Representative place of birth <input name="rep_pob" type="text" /></label>
          <label>Representative work email <input name="rep_email" type="email" /></label>
          <label>Representative phone <input name="rep_phone" type="tel" /></label>
          <label>Accounts payable contact <input name="ap_name" type="text" /></label>
          <label>AP email <input name="ap_email" type="email" /></label>
          <label>AP phone <input name="ap_phone" type="tel" /></label>
          <label>Sales contact <input name="sales_name" type="text" /></label>
          <label>Sales email <input name="sales_email" type="email" /></label>
          <label>Support email <input name="support_email" type="email" /></label>
          <label>Remittance bank name <input name="bank_name" type="text" /></label>
          <label>Bank branch <input name="bank_branch" type="text" /></label>
          <label>Account name <input name="bank_account_name" type="text" /></label>
          <label>Account number <input name="bank_account_no" type="text" /></label>
          <label>ABA / routing number <input name="bank_routing" type="text" /></label>
          <label>IBAN <input name="bank_iban" type="text" /></label>
          <label>SWIFT / BIC <input name="bank_swift" type="text" /></label>
          <label>Settlement currency <input name="bank_currency" type="text" /></label>
          <label>Payment terms <input name="payment_terms" type="text" /></label>
          <label>Preferred payment method <input name="payment_method" type="text" /></label>
          <label>PO required <input name="po_required" type="text" /></label>
          <label>W-9 on file <input name="w9" type="text" /></label>
          <label>Certificate of insurance on file <input name="coi" type="text" /></label>
          <label>Insurance carrier <input name="insurance_carrier" type="text" /></label>
          <label>Insurance policy number <input name="insurance_policy" type="text" /></label>
          <label>General liability limit (USD) <input name="gl_limit" type="text" /></label>
          <label>Sanctions screening status <input name="sanctions" type="text" /></label>
          <label>PEP declaration <input name="pep" type="text" /></label>
          <label>Ultimate beneficial owner <input name="ubo_name" type="text" /></label>
          <label>UBO ownership % <input name="ubo_pct" type="text" /></label>
          <label>UBO country of residence <input name="ubo_country" type="text" /></label>
          <label>UBO document number <input name="ubo_id" type="text" /></label>
          <label>Control person <input name="controller_name" type="text" /></label>
          <label>Control person title <input name="controller_title" type="text" /></label>
          <label>NDAA / covered telecom attestation <input name="ndaa" type="text" /></label>
          <label>Conflict of interest <input name="conflict" type="text" /></label>
          <label>Uses subcontractors <input name="subcontract" type="text" /></label>
          <label>Supplier diversity classification <input name="diversity" type="text" /></label>
          <label>Sustainability contact <input name="sustainability" type="text" /></label>
          <label>Data residency <input name="data_residency" type="text" /></label>
          <label>Security contact email <input name="security_contact" type="email" /></label>
          <label>Incident phone <input name="incident_phone" type="tel" /></label>
          <label>Requested onboarding date <input name="onboarding_date" type="date" /></label>
          <label>Buyer cost center <input name="cost_center" type="text" /></label>
          <label>Buyer / requester <input name="buyer_name" type="text" /></label>
          <label>Buyer email <input name="buyer_email" type="email" /></label>
          <label>Spend category <input name="category" type="text" /></label>
          <label>Inherent risk tier <input name="risk_tier" type="text" /></label>
          <label>Compliance notes <textarea name="notes"></textarea></label>
        </form>
      `;

      // Verify form has 87 fields
      const inputs = document.querySelectorAll('#vendor-kyc-form input, #vendor-kyc-form textarea');
      expect(inputs.length).toBe(87);

      const kycScript: BearBoxScript = {
        id: 'script_ranasi_kyc',
        name: 'Ranasi Vendor KYC Script',
        description: 'Autofills 87 fields',
        enabled: true,
        executionMode: 'manual',
        runAt: 'document_idle',
        category: 'autofill',
        rules: [{ id: 'r_kyc', pattern: 'https://www.ranasi.com/demos/vendor-kyc-87.html*' }],
        sourceCode: `
          async function runBearBoxAutofill(record) {
            const data = {
              legal_name: record.legalName || 'Acme Global Corp',
              dba: 'Acme International',
              entity_type: 'Corporation',
              jurisdiction: 'Delaware',
              year_formed: '2018',
              tax_id: '12-9876543',
              vat: 'US129876543',
              duns: '98-765-4321',
              lei: '5493001KJTIIGC8Y1R12',
              reg_no: 'REG-554433',
              website: 'https://acmeglobal.example.com',
              industry: 'Technology',
              employees: '350',
              annual_rev: '50000000',
              hq_line1: '100 Innovation Way',
              hq_line2: 'Suite 400',
              hq_city: 'Austin',
              hq_region: 'TX',
              hq_postal: '78701',
              hq_country: 'United States',
              bill_line1: '100 Innovation Way',
              bill_city: 'Austin',
              bill_region: 'TX',
              bill_postal: '78701',
              bill_country: 'United States',
              ship_line1: '200 Logistics Pkwy',
              ship_city: 'San Antonio',
              ship_postal: '78201',
              rep_full: 'Alexander Hamilton',
              rep_given: 'Alexander',
              rep_family: 'Hamilton',
              rep_title: 'Chief Compliance Officer',
              rep_dob: '1980-01-11',
              rep_nationality: 'American',
              rep_country: 'United States',
              rep_doc_type: 'Passport',
              rep_passport: 'P98124765',
              rep_issued: '2019-05-20',
              rep_expiry: '2029-05-20',
              rep_pob: 'Nevis',
              rep_email: 'a.hamilton@acmeglobal.example.com',
              rep_phone: '+1 (512) 555-0199',
              ap_name: 'Peggy Schuyler',
              ap_email: 'ap@acmeglobal.example.com',
              ap_phone: '+1 (512) 555-0144',
              sales_name: 'John Laurens',
              sales_email: 'sales@acmeglobal.example.com',
              support_email: 'support@acmeglobal.example.com',
              bank_name: 'Citibank N.A.',
              bank_branch: 'Austin Commercial',
              bank_account_name: 'Acme Global Corp Operating',
              bank_account_no: '998877665544',
              bank_routing: '111000025',
              bank_iban: 'US33CITI111000025998877665544',
              bank_swift: 'CITIUS33XXX',
              bank_currency: 'USD',
              payment_terms: 'Net 30',
              payment_method: 'ACH Direct Deposit',
              po_required: 'Yes',
              w9: 'Yes',
              coi: 'Yes',
              insurance_carrier: 'Hartford Fire Insurance',
              insurance_policy: 'HART-229911',
              gl_limit: '2000000',
              sanctions: 'Cleared',
              pep: 'None',
              ubo_name: 'George Washington',
              ubo_pct: '70%',
              ubo_country: 'United States',
              ubo_id: 'GW-1732',
              controller_name: 'Thomas Jefferson',
              controller_title: 'VP Operations',
              ndaa: 'Compliant',
              conflict: 'None',
              subcontract: 'No',
              diversity: 'Small Business',
              sustainability: 'green@acmeglobal.example.com',
              data_residency: 'US Only',
              security_contact: 'infosec@acmeglobal.example.com',
              incident_phone: '+1 (512) 555-0911',
              onboarding_date: '2026-12-01',
              cost_center: 'CC-Austin-Tech',
              buyer_name: 'Aaron Burr',
              buyer_email: 'aburr@buyer-corp.example.com',
              category: 'IT Services',
              risk_tier: 'Low',
              notes: 'All 87 fields validated via BearBox Engine.'
            };

            const dateFields = new Set(['rep_dob', 'rep_issued', 'rep_expiry', 'onboarding_date']);

            for (const [key, val] of Object.entries(data)) {
              const sel = '[name="' + key + '"]';
              if (dateFields.has(key)) {
                await bearbox.setDate(sel, val, { label: key });
              } else {
                await bearbox.setValue(sel, val, { label: key });
              }
            }
            return bearbox.getResults();
          }
        `,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const result = await executeUserScript(kycScript, {
        record: { legalName: 'Northwind Global Holdings LLC' },
        url: 'https://www.ranasi.com/demos/vendor-kyc-87.html?utm_source=chatgpt.com',
        trigger: 'manual'
      });

      expect(result.success).toBe(true);
      expect(result.successfulFieldsCount).toBe(87);
      expect(result.failedFieldsCount).toBe(0);

      // Verify DOM values
      const legalNameInput = document.querySelector('input[name="legal_name"]') as HTMLInputElement;
      expect(legalNameInput.value).toBe('Northwind Global Holdings LLC');

      const notesTextarea = document.querySelector('textarea[name="notes"]') as HTMLTextAreaElement;
      expect(notesTextarea.value).toBe('All 87 fields validated via BearBox Engine.');

      const dobInput = document.querySelector('input[name="rep_dob"]') as HTMLInputElement;
      expect(dobInput.value).toBe('1980-01-11');
    });
  });

  /* =========================================================================
     8. CSP-Safe Interpreter Mode (Simulating Chrome MV3 eval restriction)
     ========================================================================= */
  describe('CSP-Safe Interpreter Mode (Manifest V3 eval restriction)', () => {
    it('unwraps async function runBearBoxAutofill and populates fields under strict CSP', () => {
      document.body.innerHTML = `
        <select id="forms-country"><option value="">Select</option><option value="India">India</option></select>
        <input id="forms-first-name" type="text" />
        <input id="forms-dob" type="text" />
        <input type="radio" id="forms-comm-phone" name="comm" value="phone" />
      `;

      const sourceCode = `
        async function runBearBoxAutofill(record) {
          const country = record.country || 'India';
          await bearbox.setSelect('#forms-country', country, { label: 'Country' });
          if (record.firstName) {
            await bearbox.setValue('#forms-first-name', record.firstName, { label: 'First Name' });
          }
          if (record.dob) {
            await bearbox.setDate('#forms-dob', record.dob, { targetFormat: 'YYYY-MM-DD' });
          }
          await bearbox.setRadio('#forms-comm-phone', true);
          return bearbox.getResults();
        }
      `;

      const bearbox = createBearBoxApi();
      const interpreterHelpers = {
        setInput: (sel: string, val: unknown, label?: string) => {
          bearbox.setValue(sel, val, { label });
          return true;
        },
        setValue: (sel: string, val: unknown, label?: string) => {
          bearbox.setValue(sel, val, { label });
          return true;
        },
        setSelect: (sel: string, val: unknown, label?: string) => {
          bearbox.setSelect(sel, val, { label });
          return true;
        },
        setCheckbox: (sel: string, val: unknown, label?: string) => {
          bearbox.setCheckbox(sel, val, { label });
          return true;
        },
        setRadio: (grp: string, val: unknown, label?: string) => {
          bearbox.setRadio(grp, val, { label });
          return true;
        },
        setDate: (sel: string, val: unknown, label?: string, targetFormat?: string) => {
          bearbox.setDate(sel, val, { label, targetFormat });
          return true;
        },
        autofill: (spec: any) => {
          bearbox.autofill(spec);
          return true;
        },
        log: (...args: unknown[]) => bearbox.log(...args)
      };

      const matched = executeSafeScriptInterpretation(
        sourceCode,
        { country: 'India', firstName: 'Ada', dob: '1990-05-20' },
        interpreterHelpers
      );

      expect(matched).toBe(true);

      const countryEl = document.getElementById('forms-country') as HTMLSelectElement;
      const fnEl = document.getElementById('forms-first-name') as HTMLInputElement;
      const dobEl = document.getElementById('forms-dob') as HTMLInputElement;
      const radioEl = document.getElementById('forms-comm-phone') as HTMLInputElement;

      expect(countryEl.value).toBe('India');
      expect(fnEl.value).toBe('Ada');
      expect(dobEl.value).toBe('1990-05-20');
      expect(radioEl.checked).toBe(true);
    });
  });
});
