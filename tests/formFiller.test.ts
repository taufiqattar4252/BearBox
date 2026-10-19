// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FormAutofillConfig, ParseRecordResult } from '../src/types/formConfig';
import { fillFormFields } from '../src/services/formFiller';

describe('Form Filler Engine (DOM automation)', () => {
  let formContainer: HTMLElement;

  beforeEach(() => {
    // Setup fresh test form in JSDOM document body
    document.body.innerHTML = `
      <form id="student-form">
        <input type="text" id="student_name" name="name" />
        <input type="text" id="student_id" name="id" />
        <input type="date" id="dob" name="dob" />
        <select id="class_select" name="class">
          <option value="">Select Class</option>
          <option value="6">Class 6</option>
          <option value="7">Class 7</option>
          <option value="8">Class 8</option>
        </select>
        <select id="section_select" name="section">
          <option value="">Select Section</option>
          <option value="A">Section A</option>
          <option value="B">Section B</option>
        </select>
        <textarea id="address" name="address"></textarea>
        <input type="checkbox" id="hostel_needed" name="hostel" />
        
        <input type="radio" name="gender" id="gender_male" value="male" />
        <input type="radio" name="gender" id="gender_female" value="female" />

        <button type="submit" id="submit_btn">Register Student</button>
      </form>
    `;
    formContainer = document.getElementById('student-form') as HTMLElement;
  });

  const testConfig: FormAutofillConfig = {
    id: 'cfg_filler_test',
    name: 'Student Form',
    enabled: true,
    rules: [{ id: 'r1', pattern: 'https://example.com/*', matchType: 'wildcard' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'f1', label: 'Student Name', key: 'student_name', targetSelector: '#student_name', type: 'text', required: true },
      { id: 'f2', label: 'Student ID', key: 'student_id', targetSelector: '#student_id', type: 'text', required: true },
      { id: 'f3', label: 'DOB', key: 'dob', targetSelector: '#dob', type: 'date', required: true },
      { id: 'f4', label: 'Class', key: 'class', targetSelector: '#class_select', type: 'select', required: true },
      { id: 'f5', label: 'Section', key: 'section', targetSelector: '#section_select', type: 'select', required: false },
      { id: 'f6', label: 'Address', key: 'address', targetSelector: '#address', type: 'textarea', required: true },
      { id: 'f7', label: 'Hostel', key: 'hostel', targetSelector: '#hostel_needed', type: 'checkbox', required: false },
      { id: 'f8', label: 'Gender', key: 'gender', targetSelector: 'input[name="gender"]', type: 'radio', required: false }
    ]
  };

  it('populates text input, textarea, date, select, checkbox, and radio correctly', () => {
    let inputEventFired = false;
    let changeEventFired = false;

    const nameInput = document.getElementById('student_name') as HTMLInputElement;
    nameInput.addEventListener('input', () => { inputEventFired = true; });
    nameInput.addEventListener('change', () => { changeEventFired = true; });

    const record: ParseRecordResult = {
      rawText: '...',
      missingRequiredKeys: [],
      unrecognizedLines: [],
      parsed: {
        student_name: { fieldKey: 'student_name', fieldLabel: 'Student Name', sourceLabel: 'Student Name', value: 'Aarav Sharma', formattedValue: 'Aarav Sharma', matchedVia: 'exact', isValid: true, isMissing: false },
        student_id: { fieldKey: 'student_id', fieldLabel: 'Student ID', sourceLabel: 'Student ID', value: 'STU-1042', formattedValue: 'STU-1042', matchedVia: 'exact', isValid: true, isMissing: false },
        dob: { fieldKey: 'dob', fieldLabel: 'DOB', sourceLabel: 'DOB', value: '2012-05-14', formattedValue: '2012-05-14', matchedVia: 'exact', isValid: true, isMissing: false },
        class: { fieldKey: 'class', fieldLabel: 'Class', sourceLabel: 'Class', value: '7', formattedValue: '7', matchedVia: 'exact', isValid: true, isMissing: false },
        section: { fieldKey: 'section', fieldLabel: 'Section', sourceLabel: 'Section', value: 'A', formattedValue: 'A', matchedVia: 'exact', isValid: true, isMissing: false },
        address: { fieldKey: 'address', fieldLabel: 'Address', sourceLabel: 'Address', value: '12 Lake Road, Pune', formattedValue: '12 Lake Road, Pune', matchedVia: 'exact', isValid: true, isMissing: false },
        hostel: { fieldKey: 'hostel', fieldLabel: 'Hostel', sourceLabel: 'Hostel', value: 'true', formattedValue: 'true', matchedVia: 'exact', isValid: true, isMissing: false },
        gender: { fieldKey: 'gender', fieldLabel: 'Gender', sourceLabel: 'Gender', value: 'female', formattedValue: 'female', matchedVia: 'exact', isValid: true, isMissing: false }
      }
    };

    const summary = fillFormFields(testConfig, record);

    expect(summary.totalFields).toBe(8);
    expect(summary.filledCount).toBe(8);
    expect(summary.failedCount).toBe(0);

    // Verify DOM values
    expect((document.getElementById('student_name') as HTMLInputElement).value).toBe('Aarav Sharma');
    expect((document.getElementById('student_id') as HTMLInputElement).value).toBe('STU-1042');
    expect((document.getElementById('dob') as HTMLInputElement).value).toBe('2012-05-14');
    expect((document.getElementById('class_select') as HTMLSelectElement).value).toBe('7');
    expect((document.getElementById('section_select') as HTMLSelectElement).value).toBe('A');
    expect((document.getElementById('address') as HTMLTextAreaElement).value).toBe('12 Lake Road, Pune');
    expect((document.getElementById('hostel_needed') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('gender_female') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('gender_male') as HTMLInputElement).checked).toBe(false);

    // Events were dispatched
    expect(inputEventFired).toBe(true);
    expect(changeEventFired).toBe(true);
  });

  it('matches select options by visible text when value differs', () => {
    const record: ParseRecordResult = {
      rawText: '...',
      missingRequiredKeys: [],
      unrecognizedLines: [],
      parsed: {
        class: { fieldKey: 'class', fieldLabel: 'Class', sourceLabel: 'Class', value: 'Class 8', formattedValue: 'Class 8', matchedVia: 'exact', isValid: true, isMissing: false }
      }
    };

    const summary = fillFormFields(testConfig, record);
    expect(summary.results.find(r => r.fieldKey === 'class')?.success).toBe(true);
    expect((document.getElementById('class_select') as HTMLSelectElement).value).toBe('8');
  });

  it('reports error when a target element selector is missing from the DOM', () => {
    const configWithMissingSelector: FormAutofillConfig = {
      ...testConfig,
      fields: [
        { id: 'f99', label: 'Passport No', key: 'passport', targetSelector: '#non_existent_passport_input', type: 'text', required: true }
      ]
    };

    const record: ParseRecordResult = {
      rawText: '...',
      missingRequiredKeys: [],
      unrecognizedLines: [],
      parsed: {
        passport: { fieldKey: 'passport', fieldLabel: 'Passport No', sourceLabel: 'Passport', value: 'Z1234567', formattedValue: 'Z1234567', matchedVia: 'exact', isValid: true, isMissing: false }
      }
    };

    const summary = fillFormFields(configWithMissingSelector, record);
    expect(summary.filledCount).toBe(0);
    expect(summary.failedCount).toBe(1);
    expect(summary.results[0].success).toBe(false);
    expect(summary.results[0].message).toContain('Element not found');
  });

  it('never clicks the submit button or submits the form automatically', () => {
    let submitEventFired = false;
    formContainer.addEventListener('submit', (e) => {
      e.preventDefault();
      submitEventFired = true;
    });

    const submitBtn = document.getElementById('submit_btn') as HTMLButtonElement;
    let submitButtonClicked = false;
    submitBtn.addEventListener('click', () => {
      submitButtonClicked = true;
    });

    const record: ParseRecordResult = {
      rawText: '...',
      missingRequiredKeys: [],
      unrecognizedLines: [],
      parsed: {
        student_name: { fieldKey: 'student_name', fieldLabel: 'Student Name', sourceLabel: 'Student Name', value: 'Test Name', formattedValue: 'Test Name', matchedVia: 'exact', isValid: true, isMissing: false }
      }
    };

    fillFormFields(testConfig, record);

    // Form was NOT automatically submitted
    expect(submitEventFired).toBe(false);
    expect(submitButtonClicked).toBe(false);
  });

  describe('Custom JavaScript Mapping Script', () => {
    it('executes imperative custom script using helpers.setInput, setSelect, setRadio, setCheckbox', () => {
      const scriptConfig: FormAutofillConfig = {
        id: 'cfg_script_test',
        name: 'Custom Script Form',
        enabled: true,
        rules: [{ id: 'r1', pattern: 'https://example.com/*', matchType: 'wildcard' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [],
        mappingMode: 'script',
        mappingScript: `
          const { setInput, setSelect, setCheckbox, setRadio, log } = helpers;
          if (record.student_name) setInput('#student_name', record.student_name.toUpperCase(), 'Student Name');
          if (record.student_id) setInput('#student_id', record.student_id, 'Student ID');
          if (record.class) setSelect('#class_select', record.class, 'Class');
          if (record.gender) setRadio('gender', record.gender, 'Gender');
          if (record.hostel) setCheckbox('#hostel_needed', record.hostel, 'Hostel');
          log('Finished script mapping');
        `
      };

      const record: ParseRecordResult = {
        rawText: '...',
        missingRequiredKeys: [],
        unrecognizedLines: [],
        parsed: {
          student_name: { fieldKey: 'student_name', fieldLabel: 'Student Name', sourceLabel: 'Student Name', value: 'Rohan Verma', formattedValue: 'Rohan Verma', matchedVia: 'exact', isValid: true, isMissing: false },
          student_id: { fieldKey: 'student_id', fieldLabel: 'Student ID', sourceLabel: 'Student ID', value: 'STU-9999', formattedValue: 'STU-9999', matchedVia: 'exact', isValid: true, isMissing: false },
          class: { fieldKey: 'class', fieldLabel: 'Class', sourceLabel: 'Class', value: '7', formattedValue: '7', matchedVia: 'exact', isValid: true, isMissing: false },
          gender: { fieldKey: 'gender', fieldLabel: 'Gender', sourceLabel: 'Gender', value: 'male', formattedValue: 'male', matchedVia: 'exact', isValid: true, isMissing: false },
          hostel: { fieldKey: 'hostel', fieldLabel: 'Hostel', sourceLabel: 'Hostel', value: 'true', formattedValue: 'true', matchedVia: 'exact', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(scriptConfig, record);

      expect(summary.successfulCount).toBe(5);
      expect(summary.failedCount).toBe(0);

      // Verify DOM values and uppercase transformation performed by script
      expect((document.getElementById('student_name') as HTMLInputElement).value).toBe('ROHAN VERMA');
      expect((document.getElementById('student_id') as HTMLInputElement).value).toBe('STU-9999');
      expect((document.getElementById('class_select') as HTMLSelectElement).value).toBe('7');
      expect((document.getElementById('gender_male') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('hostel_needed') as HTMLInputElement).checked).toBe(true);
    });

    it('supports declarative mapping when script returns an object mapping keys to selectors', () => {
      const declarativeConfig: FormAutofillConfig = {
        id: 'cfg_script_declarative',
        name: 'Declarative Script Form',
        enabled: true,
        rules: [{ id: 'r1', pattern: 'https://example.com/*', matchType: 'wildcard' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [],
        mappingMode: 'script',
        mappingScript: `
          return {
            student_name: '#student_name',
            student_id: '#student_id',
            address: '#address'
          };
        `
      };

      const record: ParseRecordResult = {
        rawText: '...',
        missingRequiredKeys: [],
        unrecognizedLines: [],
        parsed: {
          student_name: { fieldKey: 'student_name', fieldLabel: 'Student Name', sourceLabel: 'Student Name', value: 'Ananya Roy', formattedValue: 'Ananya Roy', matchedVia: 'exact', isValid: true, isMissing: false },
          student_id: { fieldKey: 'student_id', fieldLabel: 'Student ID', sourceLabel: 'Student ID', value: 'STU-5555', formattedValue: 'STU-5555', matchedVia: 'exact', isValid: true, isMissing: false },
          address: { fieldKey: 'address', fieldLabel: 'Address', sourceLabel: 'Address', value: '45 Park Street, Kolkata', formattedValue: '45 Park Street, Kolkata', matchedVia: 'exact', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(declarativeConfig, record);
      expect(summary.successfulCount).toBe(3);
      expect((document.getElementById('student_name') as HTMLInputElement).value).toBe('Ananya Roy');
      expect((document.getElementById('student_id') as HTMLInputElement).value).toBe('STU-5555');
      expect((document.getElementById('address') as HTMLTextAreaElement).value).toBe('45 Park Street, Kolkata');
    });

    it('gracefully catches and reports runtime script error without crashing', () => {
      const faultyConfig: FormAutofillConfig = {
        id: 'cfg_faulty_script',
        name: 'Faulty Script Form',
        enabled: true,
        rules: [{ id: 'r1', pattern: 'https://example.com/*', matchType: 'wildcard' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [],
        mappingMode: 'script',
        mappingScript: `
          // Intentionally throw error
          throw new Error('Custom script validation failed');
        `
      };

      const record: ParseRecordResult = {
        rawText: '...',
        missingRequiredKeys: [],
        unrecognizedLines: [],
        parsed: {
          student_name: { fieldKey: 'student_name', fieldLabel: 'Student Name', sourceLabel: 'Student Name', value: 'Test', formattedValue: 'Test', matchedVia: 'exact', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(faultyConfig, record);
      expect(summary.failedCount).toBe(1);
      expect(summary.message).toContain('Script execution error');
      expect(summary.results[0].message).toContain('Custom script validation failed');
    });

    it('populates fields using advanced expressions (get multi-args, join, ternary, fallback) with zero CSP eval', () => {
      const advancedConfig: FormAutofillConfig = {
        id: 'cfg_script_advanced',
        name: 'Advanced Script Form',
        enabled: true,
        rules: [{ id: 'r1', pattern: 'https://example.com/*', matchType: 'wildcard' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [],
        mappingMode: 'script',
        mappingScript: `
          const { setInput, setSelect, setCheckbox, setRadio, log } = helpers;
          
          // Test multi-argument get with comma inside argument
          const firstName = get('first_name', 'firstname', 'first');
          const lastName = get('last_name', 'lastname', 'last');
          const fullName = [firstName, lastName].filter(Boolean).join(' ');

          setInput('#student_name', fullName, 'Full Name');
          setInput('#student_id', get('student_id', 'id') || 'STU-DEFAULT', 'Student ID');
          setInput('#address', record.city ? record.address + ', ' + record.city : record.address, 'Address');
          setSelect('#class_select', get('class', 'grade') || '7', 'Class');
          setCheckbox('#hostel_needed', get('hostel', 'boarder'), 'Hostel');
          setRadio('gender', get('gender', 'sex'), 'Gender');
          
          log('All advanced fields mapped cleanly');
        `
      };

      const record: ParseRecordResult = {
        rawText: '...',
        missingRequiredKeys: [],
        unrecognizedLines: [],
        parsed: {
          first_name: { fieldKey: 'first_name', fieldLabel: 'First Name', sourceLabel: 'First Name', value: 'Siddharth', formattedValue: 'Siddharth', matchedVia: 'exact', isValid: true, isMissing: false },
          last_name: { fieldKey: 'last_name', fieldLabel: 'Last Name', sourceLabel: 'Last Name', value: 'Gupta', formattedValue: 'Gupta', matchedVia: 'exact', isValid: true, isMissing: false },
          id: { fieldKey: 'id', fieldLabel: 'ID', sourceLabel: 'ID', value: 'STU-7777', formattedValue: 'STU-7777', matchedVia: 'exact', isValid: true, isMissing: false },
          address: { fieldKey: 'address', fieldLabel: 'Address', sourceLabel: 'Address', value: '88 MG Road', formattedValue: '88 MG Road', matchedVia: 'exact', isValid: true, isMissing: false },
          city: { fieldKey: 'city', fieldLabel: 'City', sourceLabel: 'City', value: 'Bengaluru', formattedValue: 'Bengaluru', matchedVia: 'exact', isValid: true, isMissing: false },
          class: { fieldKey: 'class', fieldLabel: 'Class', sourceLabel: 'Class', value: '8', formattedValue: '8', matchedVia: 'exact', isValid: true, isMissing: false },
          hostel: { fieldKey: 'hostel', fieldLabel: 'Hostel', sourceLabel: 'Hostel', value: 'true', formattedValue: 'true', matchedVia: 'exact', isValid: true, isMissing: false },
          gender: { fieldKey: 'gender', fieldLabel: 'Gender', sourceLabel: 'Gender', value: 'male', formattedValue: 'male', matchedVia: 'exact', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(advancedConfig, record);

      expect(summary.failedCount).toBe(0);
      expect(summary.successfulCount).toBe(6);

      // Verify DOM values
      expect((document.getElementById('student_name') as HTMLInputElement).value).toBe('Siddharth Gupta');
      expect((document.getElementById('student_id') as HTMLInputElement).value).toBe('STU-7777');
      expect((document.getElementById('address') as HTMLTextAreaElement).value).toBe('88 MG Road, Bengaluru');
      expect((document.getElementById('class_select') as HTMLSelectElement).value).toBe('8');
      expect((document.getElementById('hostel_needed') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('gender_male') as HTMLInputElement).checked).toBe(true);
    });
  });

  describe('Nexaura Digital Contact Form & Forms Without ID/Name Attributes', () => {
    let nexauraForm: HTMLElement;
    let submitClicked: boolean;

    beforeEach(() => {
      submitClicked = false;
      document.body.innerHTML = `
        <form id="nexaura-contact-form" class="nexaura-contact-form">
          <!-- First Name form group: no id, no name -->
          <div class="form-group field-wrapper">
            <label>First Name</label>
            <input type="text" placeholder="Please enter first name" value="" />
          </div>

          <!-- Last Name form group: no id, no name -->
          <div class="form-group field-wrapper">
            <label>Last Name</label>
            <input type="text" placeholder="Please enter last name" value="" />
          </div>

          <!-- Phone Number form group: react-tel-input, starts with +1, no id, no name -->
          <div class="form-group phone-number-group">
            <label>Phone Number</label>
            <div class="react-tel-input">
              <input type="tel" class="form-control" value="+1" placeholder="1 (702) 123-4567" />
            </div>
          </div>

          <!-- Email form group: type email, placeholder, no id, no name -->
          <div class="form-group field-wrapper">
            <label>Email</label>
            <input type="email" placeholder="Please enter your email" value="" />
          </div>

          <button type="submit" id="nexaura-submit">Send Message</button>
        </form>
      `;

      nexauraForm = document.getElementById('nexaura-contact-form') as HTMLElement;
      nexauraForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitClicked = true;
      });
      document.getElementById('nexaura-submit')?.addEventListener('click', () => {
        submitClicked = true;
      });
    });

    it('autofills all four Nexaura Digital fields using intelligent fallbacks even when selectors use #id or [name="..."]', () => {
      // Configuration with typical selectors that do not exist as id/name on this form
      const nexauraConfig: FormAutofillConfig = {
        id: 'cfg_nexaura_digital',
        name: 'Nexaura Digital Contact Form',
        enabled: true,
        rules: [{ id: 'r_nex', pattern: 'https://*nexaura*/*', matchType: 'wildcard' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [
          { id: 'f_fn', label: 'First Name', key: 'firstName', selector: '#firstName, [name="firstName"]', type: 'text', required: true },
          { id: 'f_ln', label: 'Last Name', key: 'lastName', selector: '#lastName, [name="lastName"]', type: 'text', required: true },
          { id: 'f_ph', label: 'Phone Number', key: 'phone', selector: '#phone, [name="phone"]', type: 'tel', required: true },
          { id: 'f_em', label: 'Email', key: 'email', selector: '#email, [name="email"]', type: 'email', required: true }
        ]
      };

      const record: ParseRecordResult = {
        rawText: 'First Name: Alex\nLast Name: Mercer\nPhone: (202) 555-0143\nEmail: alex.mercer@nexaura.com',
        missingRequiredKeys: [],
        unrecognizedLines: [],
        parsed: {
          firstName: { fieldKey: 'firstName', fieldLabel: 'First Name', sourceLabel: 'First Name', value: 'Alex', formattedValue: 'Alex', matchedVia: 'exact', isValid: true, isMissing: false },
          lastName: { fieldKey: 'lastName', fieldLabel: 'Last Name', sourceLabel: 'Last Name', value: 'Mercer', formattedValue: 'Mercer', matchedVia: 'exact', isValid: true, isMissing: false },
          phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', sourceLabel: 'Phone', value: '202-555-0143', formattedValue: '202-555-0143', matchedVia: 'exact', isValid: true, isMissing: false },
          email: { fieldKey: 'email', fieldLabel: 'Email', sourceLabel: 'Email', value: 'alex.mercer@nexaura.com', formattedValue: 'alex.mercer@nexaura.com', matchedVia: 'exact', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(nexauraConfig, record);

      // Verify all four fields succeeded
      expect(summary.totalFields).toBe(4);
      expect(summary.successfulCount).toBe(4);
      expect(summary.failedCount).toBe(0);

      // 1. First Name matched via placeholder="Please enter first name"
      const fnInput = document.querySelector('input[placeholder="Please enter first name"]') as HTMLInputElement;
      expect(fnInput).not.toBeNull();
      expect(fnInput.value).toBe('Alex');

      // 2. Last Name matched via placeholder="Please enter last name"
      const lnInput = document.querySelector('input[placeholder="Please enter last name"]') as HTMLInputElement;
      expect(lnInput).not.toBeNull();
      expect(lnInput.value).toBe('Mercer');

      // 3. Phone Number matched input[type="tel"] in Phone Number group and formatted for react-tel-input preserving +1
      const telInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      expect(telInput).not.toBeNull();
      expect(telInput.value).toBe('+1 (202) 555-0143');

      // 4. Email matched input[type="email"] and input[placeholder="Please enter your email"]
      const emailInput = document.querySelector('input[placeholder="Please enter your email"]') as HTMLInputElement;
      expect(emailInput).not.toBeNull();
      expect(emailInput.value).toBe('alex.mercer@nexaura.com');

      // Crucial requirement: Form was NEVER automatically submitted
      expect(submitClicked).toBe(false);
    });

    it('handles react-tel-input starting with +1 and preserves country code across various raw phone formats', () => {
      const telInput = document.querySelector('input[type="tel"]') as HTMLInputElement;

      // Case A: 10 raw digits "2025550143"
      telInput.value = '+1';
      const nexauraConfigA: FormAutofillConfig = {
        id: 'cfg_tel_a',
        name: 'Tel Test',
        enabled: true,
        rules: [{ id: 'r1', pattern: '*' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [{ id: 'f_tel', label: 'Phone Number', key: 'phone', selector: 'input[type="tel"]', type: 'tel', required: true }]
      };
      fillFormFields(nexauraConfigA, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: { phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '2025550143', isValid: true, isMissing: false } }
      });
      expect(telInput.value).toBe('+1 (202) 555-0143');

      // Case B: 11 digits starting with 1 "12025550143"
      telInput.value = '+1';
      fillFormFields(nexauraConfigA, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: { phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '12025550143', isValid: true, isMissing: false } }
      });
      expect(telInput.value).toBe('+1 (202) 555-0143');

      // Case C: Raw formatted "+12025550143"
      telInput.value = '+1';
      fillFormFields(nexauraConfigA, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: { phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '+12025550143', isValid: true, isMissing: false } }
      });
      expect(telInput.value).toBe('+1 (202) 555-0143');

      // Case D: Already formatted "+1 (202) 555-0143"
      telInput.value = '+1';
      fillFormFields(nexauraConfigA, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: { phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '+1 (202) 555-0143', isValid: true, isMissing: false } }
      });
      expect(telInput.value).toBe('+1 (202) 555-0143');
    });

    it('works seamlessly in custom JavaScript mapping script mode for the Nexaura Digital form', () => {
      const scriptConfig: FormAutofillConfig = {
        id: 'cfg_nexaura_script',
        name: 'Nexaura Custom Script Form',
        enabled: true,
        rules: [{ id: 'r1', pattern: '*' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [],
        mappingMode: 'script',
        mappingScript: `
          const { setInput, log } = helpers;
          if (record.firstName) setInput('#firstName', record.firstName, 'First Name');
          if (record.lastName) setInput('#lastName', record.lastName, 'Last Name');
          if (record.phone) setInput('#phone', record.phone, 'Phone Number');
          if (record.email) setInput('#email', record.email, 'Email');
          log('Nexaura fields mapped via custom script');
        `
      };

      const record: ParseRecordResult = {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: {
          firstName: { fieldKey: 'firstName', fieldLabel: 'First Name', value: 'Jordan', isValid: true, isMissing: false },
          lastName: { fieldKey: 'lastName', fieldLabel: 'Last Name', value: 'Lee', isValid: true, isMissing: false },
          phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '2025550199', isValid: true, isMissing: false },
          email: { fieldKey: 'email', fieldLabel: 'Email', value: 'jordan.lee@example.com', isValid: true, isMissing: false }
        }
      };

      const summary = fillFormFields(scriptConfig, record);

      expect(summary.successfulCount).toBe(4);
      expect(summary.failedCount).toBe(0);

      expect((document.querySelector('input[placeholder="Please enter first name"]') as HTMLInputElement).value).toBe('Jordan');
      expect((document.querySelector('input[placeholder="Please enter last name"]') as HTMLInputElement).value).toBe('Lee');
      expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value).toBe('+1 (202) 555-0199');
      expect((document.querySelector('input[placeholder="Please enter your email"]') as HTMLInputElement).value).toBe('jordan.lee@example.com');
      expect(submitClicked).toBe(false);
    });

    it('updates React-controlled values by resetting _valueTracker and dispatching synthetic events', () => {
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;

      let trackerValue = 'initial';
      (emailInput as any)._valueTracker = {
        getValue: () => trackerValue,
        setValue: (v: string) => { trackerValue = v; }
      };

      let inputDispatched = false;
      let changeDispatched = false;
      emailInput.addEventListener('input', () => { inputDispatched = true; });
      emailInput.addEventListener('change', () => { changeDispatched = true; });

      const config: FormAutofillConfig = {
        id: 'cfg_react_tracker',
        name: 'React Tracker Test',
        enabled: true,
        rules: [{ id: 'r1', pattern: '*' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [{ id: 'f_em', label: 'Email', key: 'email', selector: 'input[placeholder="Please enter your email"]', type: 'email', required: true }]
      };

      const summary = fillFormFields(config, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: { email: { fieldKey: 'email', fieldLabel: 'Email', value: 'react.user@nexaura.com', isValid: true, isMissing: false } }
      });

      expect(summary.successfulCount).toBe(1);
      expect(emailInput.value).toBe('react.user@nexaura.com');
      expect(inputDispatched).toBe(true);
      expect(changeDispatched).toBe(true);
    });

    it('accurately reports which fields succeeded and which failed when a field is missing from DOM', () => {
      // Remove the last name input from DOM
      const lnInput = document.querySelector('input[placeholder="Please enter last name"]');
      lnInput?.remove();

      const config: FormAutofillConfig = {
        id: 'cfg_partial',
        name: 'Partial Form Test',
        enabled: true,
        rules: [{ id: 'r1', pattern: '*' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fields: [
          { id: 'f_fn', label: 'First Name', key: 'firstName', selector: '#firstName', type: 'text', required: true },
          { id: 'f_ln', label: 'Last Name', key: 'lastName', selector: '#nonExistentLastName', type: 'text', required: true },
          { id: 'f_ph', label: 'Phone Number', key: 'phone', selector: '#phone', type: 'tel', required: true },
          { id: 'f_em', label: 'Email', key: 'email', selector: '#email', type: 'email', required: true }
        ]
      };

      const summary = fillFormFields(config, {
        rawText: '...', missingRequiredKeys: [], unrecognizedLines: [],
        parsed: {
          firstName: { fieldKey: 'firstName', fieldLabel: 'First Name', value: 'FirstOnly', isValid: true, isMissing: false },
          lastName: { fieldKey: 'lastName', fieldLabel: 'Last Name', value: 'MissingLastName', isValid: true, isMissing: false },
          phone: { fieldKey: 'phone', fieldLabel: 'Phone Number', value: '2025550188', isValid: true, isMissing: false },
          email: { fieldKey: 'email', fieldLabel: 'Email', value: 'email@test.com', isValid: true, isMissing: false }
        }
      });

      // 3 succeeded, 1 failed
      expect(summary.successfulCount).toBe(3);
      expect(summary.failedCount).toBe(1);

      const fnResult = summary.results.find((r) => r.fieldKey === 'firstName');
      expect(fnResult?.success).toBe(true);

      const lnResult = summary.results.find((r) => r.fieldKey === 'lastName');
      expect(lnResult?.success).toBe(false);
      expect(lnResult?.elementFound).toBe(false);

      const phResult = summary.results.find((r) => r.fieldKey === 'phone');
      expect(phResult?.success).toBe(true);

      const emResult = summary.results.find((r) => r.fieldKey === 'email');
      expect(emResult?.success).toBe(true);
    });
  });
});

