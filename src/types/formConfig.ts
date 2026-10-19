/**
 * Core type definitions for BearBox Tool 1: Custom Form Autofill
 */

import { ScriptRule } from './script';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'number'
  | 'email'
  | 'tel';

export type ValueTransform =
  | 'none'
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'titlecase';

/**
 * Defines the mapping between an external data source key and a target webpage input element.
 */
export interface FormFieldMapping {
  id: string;                         // Unique stable field ID (e.g. "f_student_name")
  key: string;                        // Stable internal key (e.g. "studentName")
  label: string;                      // Display label (e.g. "Student Name")
  aliases: string[];                  // Source label aliases in copied text (e.g. ["Student Name", "Name", "Full Name"])
  selector: string;                   // Robust CSS selector (e.g. "#student-name" or "[name='student_name']")
  targetSelector?: string;            // Alias for selector
  type: FormFieldType;                // Input element type
  required: boolean;                  // Mandatory requirement check
  defaultValue?: string;              // Optional fallback value
  transform?: ValueTransform;         // Value transformation
  valueMapping?: Record<string, string>; // Value mapping for select options/radios/checkboxes
  description?: string;               // Optional guidance note
}

export type MappingMode = 'visual' | 'script';

/**
 * Reusable configuration for a target web form.
 */
export interface FormAutofillConfig {
  id: string;                         // Unique configuration ID (e.g. "form_student_reg")
  name: string;                       // Name (e.g. "Student Registration Form")
  description?: string;               // Optional description
  rules: ScriptRule[];                // Website matching rules (uses centralized BearBox matcher)
  fields: FormFieldMapping[];         // Configured field mappings
  mappingMode?: MappingMode;          // 'visual' (table-based) or 'script' (custom JS mapping function)
  mappingScript?: string;             // Custom JavaScript mapping function source code
  enabled: boolean;                   // Toggle configuration availability
  createdAt: number;                  // Timestamp
  updatedAt: number;                  // Timestamp
  lastUsedAt?: number;                // Last autofill execution timestamp
}

/**
 * Result of parsing a single field from source text.
 */
export interface ParsedFieldResult {
  fieldId: string;
  key: string;
  fieldKey?: string;
  label: string;
  fieldLabel?: string;
  value: string;
  formattedValue?: string;
  matchedAlias?: string;
  sourceLabel?: string;
  matchedVia?: string;
  isValid?: boolean;
  isMissing?: boolean;
  required: boolean;
  type: FormFieldType;
  selector: string;
  targetSelector?: string;
  status: 'valid' | 'missing_required' | 'unmapped' | 'invalid_format';
  errorMessage?: string;
  validationError?: string;
  elementFound?: boolean;
}

/**
 * Aggregate result from parsing external clipboard or pasted text.
 */
export interface ParseRecordResult {
  fields: ParsedFieldResult[];
  unrecognizedLines: string[];
  totalFieldsConfigured: number;
  totalFieldsMatched: number;
  missingRequiredCount: number;
  isValid: boolean;
  parsed?: Record<string, ParsedFieldResult>;
  missingRequiredKeys?: string[];
  rawText?: string;
  extractedPairs?: Record<string, string>;
  allDetectedFields?: ParsedFieldResult[];
}

/**
 * Result of attempting to fill an individual DOM field.
 */
export interface AutofillFieldResult {
  fieldId: string;
  key: string;
  fieldKey?: string;
  label: string;
  fieldLabel?: string;
  selector: string;
  value: string;
  success: boolean;
  message?: string;
  elementFound: boolean;
}

/**
 * Summary of a complete form autofill run.
 */
export interface AutofillSummary {
  formId: string;
  formName: string;
  timestamp: number;
  totalAttempted: number;
  successfulCount: number;
  filledCount?: number;
  totalFields?: number;
  failedCount: number;
  missingCount: number;
  message?: string;
  results: AutofillFieldResult[];
}
