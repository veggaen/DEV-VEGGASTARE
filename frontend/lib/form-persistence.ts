/**
 * Form state persistence utilities
 * Securely stores form data in sessionStorage for unauthenticated users
 * Files are NOT stored - user must re-select after login
 */

import { z } from 'zod';

const STORAGE_PREFIX = 'vegga_form_';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Schema for validating stored form data
const StoredFormDataSchema = z.object({
  data: z.record(z.unknown()),
  timestamp: z.number(),
  version: z.literal(1), // For future migrations
});

type StoredFormData = z.infer<typeof StoredFormDataSchema>;

/**
 * Fields that should NEVER be persisted (security/privacy sensitive)
 */
const EXCLUDED_FIELDS = new Set([
  'password',
  'confirmPassword',
  'token',
  'secret',
  'apiKey',
  'creditCard',
  'cvv',
  'ssn',
]);

/**
 * Fields that are file-related and cannot be serialized
 */
const FILE_FIELDS = new Set([
  'image',
  'images',
  'file',
  'files',
  'digitalFile',
  'attachment',
  'attachments',
]);

/**
 * Save form data to sessionStorage
 * Automatically excludes sensitive and file fields
 */
export function saveFormState<T extends Record<string, unknown>>(
  formKey: string,
  data: T,
  additionalExcludedFields: string[] = []
): void {
  try {
    const excludedSet = new Set([
      ...EXCLUDED_FIELDS,
      ...FILE_FIELDS,
      ...additionalExcludedFields,
    ]);

    // Filter out excluded fields and non-serializable values
    const safeData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (excludedSet.has(key)) continue;
      if (value instanceof File || value instanceof Blob) continue;
      if (Array.isArray(value) && value.some(v => v instanceof File || v instanceof Blob)) continue;
      if (typeof value === 'function') continue;
      
      safeData[key] = value;
    }

    const stored: StoredFormData = {
      data: safeData,
      timestamp: Date.now(),
      version: 1,
    };

    sessionStorage.setItem(
      `${STORAGE_PREFIX}${formKey}`,
      JSON.stringify(stored)
    );
  } catch (error) {
    console.warn('[form-persistence] Failed to save form state:', error);
  }
}

/**
 * Load form data from sessionStorage
 * Returns null if no data, expired, or invalid
 */
export function loadFormState<T extends Record<string, unknown>>(
  formKey: string
): Partial<T> | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${formKey}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const result = StoredFormDataSchema.safeParse(parsed);
    
    if (!result.success) {
      console.warn('[form-persistence] Invalid stored data, clearing');
      clearFormState(formKey);
      return null;
    }

    // Check expiry
    if (Date.now() - result.data.timestamp > EXPIRY_MS) {
      console.info('[form-persistence] Stored data expired, clearing');
      clearFormState(formKey);
      return null;
    }

    return result.data.data as Partial<T>;
  } catch (error) {
    console.warn('[form-persistence] Failed to load form state:', error);
    return null;
  }
}

/**
 * Clear stored form data
 */
export function clearFormState(formKey: string): void {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${formKey}`);
  } catch (error) {
    console.warn('[form-persistence] Failed to clear form state:', error);
  }
}

/**
 * Check if there's pending form data that needs file re-selection
 */
export function hasPendingFormData(formKey: string): boolean {
  return loadFormState(formKey) !== null;
}

/**
 * Get the list of file fields that need to be re-selected
 */
export function getFileFieldsToReselect(): string[] {
  return Array.from(FILE_FIELDS);
}
