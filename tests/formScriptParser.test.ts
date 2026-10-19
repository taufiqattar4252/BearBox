import { describe, it, expect } from 'vitest';
import {
  generateFieldsFromScript,
  generateScriptFromFields,
  formatKeyToLabel,
  inferFieldType
} from '../src/services/formScriptParser';
import { FormFieldMapping } from '../src/types/formConfig';

describe('formScriptParser', () => {
  it('formats keys into clean human-readable labels', () => {
    expect(formatKeyToLabel('studentName')).toBe('Student Name');
    expect(formatKeyToLabel('student_id')).toBe('Student ID');
    expect(formatKeyToLabel('dob')).toBe('Date of Birth');
    expect(formatKeyToLabel('parentPhone')).toBe('Parent Phone');
    expect(formatKeyToLabel('email')).toBe('Email');
    expect(formatKeyToLabel('admission_date')).toBe('Admission Date');
  });

  it('infers field types correctly', () => {
    expect(inferFieldType('setSelect', '#class', 'class', 'Class')).toBe('select');
    expect(inferFieldType('setCheckbox', '#agree', 'agree', 'Agree')).toBe('checkbox');
    expect(inferFieldType('setRadio', 'gender', 'gender', 'Gender')).toBe('radio');
    expect(inferFieldType('setInput', '#dob', 'dob', 'Date of Birth')).toBe('date');
    expect(inferFieldType('setInput', '#email', 'email', 'Email Address')).toBe('email');
    expect(inferFieldType('setInput', '#phone', 'phone', 'Mobile Phone')).toBe('tel');
    expect(inferFieldType('setInput', '#address', 'address', 'Address')).toBe('textarea');
    expect(inferFieldType('setInput', '#age', 'age', 'Age')).toBe('number');
    expect(inferFieldType('setInput', '#name', 'studentName', 'Student Name')).toBe('text');
  });

  it('generates Visual Table fields from a standard mapping script', () => {
    const script = `
      const { setInput, setSelect, setCheckbox, setRadio } = helpers;

      // 1. Text inputs
      if (record.studentName) setInput('#student-name, [name="student_name"]', record.studentName, 'Student Name');
      if (record.studentId) setInput('#student-id, [name="student_id"]', record.studentId, 'Student ID');
      if (record.email) setInput('#email', record.email, 'Email');
      if (record.parentPhone) setInput('#phone', record.parentPhone, 'Parent Phone');
      if (record.address) setInput('#address', record.address, 'Permanent Address');

      // 2. Date input
      if (record.dob) setInput('#dob', record.dob, 'Date of Birth');

      // 3. Dropdowns & radios
      if (record.class) setSelect('#class-select', record.class, 'Class');
      if (record.section) setRadio('section', record.section, 'Section');
      if (record.terms) setCheckbox('#terms', record.terms, 'Accept Terms');
    `;

    const fields = generateFieldsFromScript(script);

    expect(fields.length).toBe(9);

    const nameField = fields.find((f) => f.key === 'studentName');
    expect(nameField).toBeDefined();
    expect(nameField?.label).toBe('Student Name');
    expect(nameField?.selector).toBe('#student-name, [name="student_name"]');
    expect(nameField?.type).toBe('text');
    expect(nameField?.aliases).toContain('Student Name');
    expect(nameField?.aliases).toContain('Full Name');

    const dobField = fields.find((f) => f.key === 'dob');
    expect(dobField?.type).toBe('date');
    expect(dobField?.label).toBe('Date of Birth');

    const classField = fields.find((f) => f.key === 'class');
    expect(classField?.type).toBe('select');
    expect(classField?.selector).toBe('#class-select');

    const sectionField = fields.find((f) => f.key === 'section');
    expect(sectionField?.type).toBe('radio');
    expect(sectionField?.selector).toBe('section');

    const termsField = fields.find((f) => f.key === 'terms');
    expect(termsField?.type).toBe('checkbox');

    const addrField = fields.find((f) => f.key === 'address');
    expect(addrField?.type).toBe('textarea');

    const phoneField = fields.find((f) => f.key === 'parentPhone');
    expect(phoneField?.type).toBe('tel');
  });

  it('handles declarative return mapping object', () => {
    const script = `
      return {
        studentName: '#student-name',
        studentId: '#student-id',
        email: 'input[name="email"]',
        dob: '#dob'
      };
    `;

    const fields = generateFieldsFromScript(script);
    expect(fields.length).toBe(4);
    expect(fields[0].key).toBe('studentName');
    expect(fields[0].selector).toBe('#student-name');
    expect(fields[0].label).toBe('Student Name');
    expect(fields[2].key).toBe('email');
    expect(fields[2].type).toBe('email');
    expect(fields[3].key).toBe('dob');
    expect(fields[3].type).toBe('date');
  });

  it('preserves existing field IDs and custom attributes', () => {
    const existing: FormFieldMapping[] = [
      {
        id: 'stable_id_1',
        key: 'studentName',
        label: 'Custom Name Label',
        aliases: ['Special Alias', 'My Name'],
        selector: '#old-selector',
        type: 'text',
        required: true,
        transform: 'uppercase',
        description: 'Existing description'
      }
    ];

    const script = `
      if (record.studentName) setInput('#new-selector', record.studentName, 'Custom Name Label');
      if (record.email) setInput('#email', record.email, 'Email');
    `;

    const fields = generateFieldsFromScript(script, existing);
    expect(fields.length).toBe(2);

    const nameField = fields.find((f) => f.key === 'studentName');
    expect(nameField?.id).toBe('stable_id_1');
    expect(nameField?.selector).toBe('#new-selector');
    expect(nameField?.aliases).toContain('Special Alias');
    expect(nameField?.aliases).toContain('My Name');
    expect(nameField?.description).toBe('Existing description');
    expect(nameField?.transform).toBe('uppercase');
  });

  it('roundtrips between fields and script seamlessly', () => {
    const originalFields: FormFieldMapping[] = [
      {
        id: 'f1',
        key: 'studentName',
        label: 'Student Name',
        aliases: ['Student Name', 'Full Name'],
        selector: '#student-name',
        type: 'text',
        required: true,
        transform: 'trim'
      },
      {
        id: 'f2',
        key: 'dob',
        label: 'Date of Birth',
        aliases: ['Date of Birth', 'DOB'],
        selector: '#dob',
        type: 'date',
        required: true,
        transform: 'none'
      },
      {
        id: 'f3',
        key: 'class',
        label: 'Class',
        aliases: ['Class'],
        selector: '#class',
        type: 'select',
        required: false,
        transform: 'trim'
      }
    ];

    const script = generateScriptFromFields(originalFields);
    expect(script).toContain('setInput');
    expect(script).toContain('setSelect');

    const parsedBack = generateFieldsFromScript(script, originalFields);
    expect(parsedBack.length).toBe(3);
    expect(parsedBack[0].key).toBe('studentName');
    expect(parsedBack[0].selector).toBe('#student-name');
    expect(parsedBack[1].key).toBe('dob');
    expect(parsedBack[1].type).toBe('date');
    expect(parsedBack[2].key).toBe('class');
    expect(parsedBack[2].type).toBe('select');
  });
});
