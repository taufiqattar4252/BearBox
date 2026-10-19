import { describe, it, expect } from 'vitest';
import { FormAutofillConfig } from '../src/types/formConfig';
import {
  parseSourceRecord,
  parseRecordText,
  parseDateValue,
  parseCheckboxValue,
  normalizeKey
} from '../src/services/formParser';

const sampleStudentConfig: FormAutofillConfig = {
  id: 'cfg_student_test',
  name: 'Student Registration Form',
  description: 'Standard student registration mapping',
  enabled: true,
  rules: [{ id: 'r1', pattern: 'https://example.org/students/*', matchType: 'wildcard' }],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  fields: [
    { id: 'f1', label: 'Student Name', key: 'student_name', targetSelector: '#student_name', type: 'text', required: true, aliases: ['Name', 'Full Name', 'Student'] },
    { id: 'f2', label: 'Student ID', key: 'student_id', targetSelector: '#student_id', type: 'text', required: true, aliases: ['ID', 'Roll No', 'Registration No'] },
    { id: 'f3', label: 'Date of Birth', key: 'date_of_birth', targetSelector: '#dob', type: 'date', required: true, aliases: ['DOB', 'Birth Date'] },
    { id: 'f4', label: 'Class', key: 'class', targetSelector: '#class_select', type: 'select', required: true, aliases: ['Grade', 'Standard'] },
    { id: 'f5', label: 'Section', key: 'section', targetSelector: '#section_select', type: 'select', required: false, aliases: ['Sec', 'Division'] },
    { id: 'f6', label: 'Parent Name', key: 'parent_name', targetSelector: '#parent_name', type: 'text', required: true, aliases: ['Guardian Name', 'Father Name', 'Mother Name'] },
    { id: 'f7', label: 'Parent Phone', key: 'parent_phone', targetSelector: '#parent_phone', type: 'text', required: true, aliases: ['Phone', 'Mobile', 'Contact Number', 'Emergency Phone'] },
    { id: 'f8', label: 'Email', key: 'email', targetSelector: '#email', type: 'email', required: false, aliases: ['Parent Email', 'Contact Email'] },
    { id: 'f9', label: 'Address', key: 'address', targetSelector: '#address', type: 'textarea', required: true, aliases: ['Residential Address', 'Home Address'] },
    { id: 'f10', label: 'Admission Date', key: 'admission_date', targetSelector: '#admission_date', type: 'date', required: false, aliases: ['Date of Admission', 'Joining Date'] }
  ]
};

describe('Form Source Parser Module', () => {
  it('parses a valid ten-field labelled student record with standard colons', () => {
    const rawRecord = `
Student Name: Aarav Sharma
Student ID: STU-1042
Date of Birth: 2012-05-14
Class: 7
Section: A
Parent Name: Priya Sharma
Parent Phone: 9876543210
Email: priya@example.com
Address: 12 Lake Road, Pune
Admission Date: 2026-06-10
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);

    expect(result.missingRequiredKeys).toEqual([]);
    expect(result.unrecognizedLines).toEqual([]);
    expect(Object.keys(result.parsed).length).toBe(10);

    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['student_id'].value).toBe('STU-1042');
    expect(result.parsed['date_of_birth'].formattedValue).toBe('2012-05-14');
    expect(result.parsed['class'].value).toBe('7');
    expect(result.parsed['section'].value).toBe('A');
    expect(result.parsed['parent_name'].value).toBe('Priya Sharma');
    expect(result.parsed['parent_phone'].value).toBe('9876543210');
    expect(result.parsed['email'].value).toBe('priya@example.com');
    expect(result.parsed['address'].value).toBe('12 Lake Road, Pune');
    expect(result.parsed['admission_date'].formattedValue).toBe('2026-06-10');
  });

  it('parses records with Field = Value syntax', () => {
    const rawRecord = `
Student Name = Aarav Sharma
Student ID = STU-1042
Date of Birth = 2012-05-14
Class = 7
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['student_id'].value).toBe('STU-1042');
    expect(result.parsed['class'].value).toBe('7');
  });

  it('correctly matches fields in completely different order', () => {
    const rawRecord = `
Email: priya@example.com
Parent Phone: 9876543210
Student Name: Aarav Sharma
Admission Date: 2026-06-10
Address: 12 Lake Road, Pune
Class: 7
Student ID: STU-1042
Date of Birth: 2012-05-14
Section: A
Parent Name: Priya Sharma
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.missingRequiredKeys).toEqual([]);
    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['email'].value).toBe('priya@example.com');
    expect(result.parsed['parent_phone'].value).toBe('9876543210');
    expect(result.parsed['student_id'].value).toBe('STU-1042');
  });

  it('handles extra blank lines and surrounding whitespace', () => {
    const rawRecord = `

   
Student Name:   Aarav Sharma   

Student ID: STU-1042


Class: 7

    `;

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['student_id'].value).toBe('STU-1042');
    expect(result.parsed['class'].value).toBe('7');
  });

  it('handles missing optional fields without error', () => {
    // Missing 'section', 'email', 'admission_date' (all optional)
    const rawRecord = `
Student Name: Aarav Sharma
Student ID: STU-1042
Date of Birth: 2012-05-14
Class: 7
Parent Name: Priya Sharma
Parent Phone: 9876543210
Address: 12 Lake Road, Pune
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.missingRequiredKeys).toEqual([]);
    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['section']).toBeUndefined();
    expect(result.parsed['email']).toBeUndefined();
  });

  it('detects missing required fields and lists them in missingRequiredKeys', () => {
    // Missing required: student_id, address
    const rawRecord = `
Student Name: Aarav Sharma
Date of Birth: 2012-05-14
Class: 7
Parent Name: Priya Sharma
Parent Phone: 9876543210
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.missingRequiredKeys).toContain('student_id');
    expect(result.missingRequiredKeys).toContain('address');
  });

  it('matches aliases and case-insensitive labels', () => {
    const rawRecord = `
full name: Aarav Sharma
Roll No: STU-1042
DOB: 2012-05-14
Grade: 7
Sec: B
Guardian Name: Priya Sharma
Contact Number: 9876543210
Home Address: Flat 402, Green Valley, Pune
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.parsed['student_name']?.value).toBe('Aarav Sharma');
    expect(result.parsed['student_id']?.value).toBe('STU-1042');
    expect(result.parsed['date_of_birth']?.value).toBe('2012-05-14');
    expect(result.parsed['class']?.value).toBe('7');
    expect(result.parsed['section']?.value).toBe('B');
    expect(result.parsed['parent_name']?.value).toBe('Priya Sharma');
    expect(result.parsed['parent_phone']?.value).toBe('9876543210');
    expect(result.parsed['address']?.value).toBe('Flat 402, Green Valley, Pune');
  });

  it('records unknown field labels in unrecognizedLines', () => {
    const rawRecord = `
Student Name: Aarav Sharma
Favorite Color: Blue
Shoe Size: 8
Student ID: STU-1042
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.parsed['student_name'].value).toBe('Aarav Sharma');
    expect(result.parsed['student_id'].value).toBe('STU-1042');
    expect(result.unrecognizedLines).toContain('Favorite Color: Blue');
    expect(result.unrecognizedLines).toContain('Shoe Size: 8');
  });

  it('supports multiline address values', () => {
    const rawRecord = `
Student Name: Aarav Sharma
Student ID: STU-1042
Address: Flat 402, Building 5
Green Valley Apartments, MG Road
Pune, Maharashtra 411001
Class: 7
Parent Name: Priya Sharma
Parent Phone: 9876543210
Date of Birth: 2012-05-14
    `.trim();

    const result = parseSourceRecord(rawRecord, sampleStudentConfig);
    expect(result.parsed['address'].value).toContain('Flat 402, Building 5');
    expect(result.parsed['address'].value).toContain('Green Valley Apartments, MG Road');
    expect(result.parsed['address'].value).toContain('Pune, Maharashtra 411001');
    expect(result.parsed['class'].value).toBe('7');
  });

  it('parses diverse date formats to standard YYYY-MM-DD', () => {
    expect(parseDateValue('2012-05-14')).toBe('2012-05-14');
    expect(parseDateValue('14/05/2012')).toBe('2012-05-14');
    expect(parseDateValue('05-14-2012')).toBe('2012-05-14');
    expect(parseDateValue('May 14, 2012')).toBe('2012-05-14');
    expect(parseDateValue('14 May 2012')).toBe('2012-05-14');
    // Invalid date returns original string without crashing
    expect(parseDateValue('not-a-valid-date')).toBe('not-a-valid-date');
  });

  it('parses boolean checkbox values accurately', () => {
    expect(parseCheckboxValue('true')).toBe(true);
    expect(parseCheckboxValue('Yes')).toBe(true);
    expect(parseCheckboxValue('1')).toBe(true);
    expect(parseCheckboxValue('checked')).toBe(true);
    expect(parseCheckboxValue('false')).toBe(false);
    expect(parseCheckboxValue('No')).toBe(false);
    expect(parseCheckboxValue('0')).toBe(false);
    expect(parseCheckboxValue('unchecked')).toBe(false);
  });

  it('normalizes keys consistently', () => {
    expect(normalizeKey('Student Name')).toBe('student_name');
    expect(normalizeKey('Date-of-Birth')).toBe('date_of_birth');
    expect(normalizeKey('  Parent\'s Phone Number  ')).toBe('parents_phone_number');
    expect(normalizeKey('E-MAIL')).toBe('e_mail');
  });

  it('detects all unconfigured fields dynamically in script mapping mode', () => {
    const customerRecord = `
Title: Mr.
First Name: David
Middle Initial: J
Last Name: Miller
Company: Acme Corp
Position: Architect
Address Line 1: 742 Evergreen Terrace
City: Springfield
State / Province: Oregon
Zip: 97477
Cell Phone: 541-555-0190
E-mail: david.miller@example.com
Credit Card Type: Visa
Credit Card Number: 4111111111111111
Comments: Please deliver between 9am and 5pm
    `.trim();

    // A config that only had 3 student fields configured in visual table
    const scriptConfig: FormAutofillConfig = {
      id: 'cfg_customer_script',
      name: 'Customer Registration',
      enabled: true,
      rules: [{ id: 'r1', pattern: 'http://localhost:8080/*' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fields: [
        { id: 'f1', key: 'student_name', label: 'Student Name', selector: '#student_name', type: 'text', required: false },
        { id: 'f2', key: 'student_id', label: 'Student ID', selector: '#student_id', type: 'text', required: false },
        { id: 'f3', key: 'dob', label: 'Date of Birth', selector: '#dob', type: 'date', required: false }
      ],
      mappingMode: 'script',
      mappingScript: 'helpers.log("ok");'
    };

    const result = parseSourceRecord(customerRecord, scriptConfig);

    // All 15 fields detected
    expect(result.allDetectedFields?.length).toBe(15);
    expect(result.totalFieldsMatched).toBe(15);

    // In script mode, all fields are accessible in parsed map
    expect(result.parsed['first_name']?.value).toBe('David');
    expect(result.parsed['last_name']?.value).toBe('Miller');
    expect(result.parsed['company']?.value).toBe('Acme Corp');
    expect(result.parsed['city']?.value).toBe('Springfield');
    expect(result.parsed['zip']?.value).toBe('97477');
    expect(result.parsed['credit_card_type']?.value).toBe('Visa');
  });

  it('parses alternating lines (Label on even line, Value on odd line) without colons', () => {
    const alternatingRecord = `
First Name
David
Last Name
Miller
Company
Acme Corp
City
Springfield
    `.trim();

    const result = parseRecordText(alternatingRecord, []);
    expect(result.allDetectedFields?.length).toBe(4);
    expect(result.extractedPairs?.['first_name']).toBe('David');
    expect(result.extractedPairs?.['last_name']).toBe('Miller');
    expect(result.extractedPairs?.['company']).toBe('Acme Corp');
    expect(result.extractedPairs?.['city']).toBe('Springfield');
  });
});
