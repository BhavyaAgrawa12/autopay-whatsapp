import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { ErrorType } from '../types/contact';

export interface PhoneValidationResult {
  isValid: boolean;
  original: string;
  normalized: string;
  errorType?: ErrorType;
  errorReason?: string;
}

/**
 * Validates and normalizes international phone numbers.
 * Supports digits with or without leading '+'. Does not destructively alter numbers.
 */
export function validatePhoneNumber(rawPhone: any): PhoneValidationResult {
  if (rawPhone === undefined || rawPhone === null) {
    return {
      isValid: false,
      original: '',
      normalized: '',
      errorType: 'MISSING_PHONE',
      errorReason: 'Phone number is missing',
    };
  }

  const str = String(rawPhone).trim();

  if (!str) {
    return {
      isValid: false,
      original: str,
      normalized: str,
      errorType: 'MISSING_PHONE',
      errorReason: 'Phone number is empty',
    };
  }

  // Remove whitespace, dashes, parens for clean digit check
  const digitsOnly = str.replace(/[\s\-\(\)\.]/g, '');

  // Check if string contains basic digit structure
  if (!/^\+?\d{7,15}$/.test(digitsOnly)) {
    return {
      isValid: false,
      original: str,
      normalized: digitsOnly,
      errorType: 'INVALID_PHONE',
      errorReason: 'Invalid phone format (must contain 7 to 15 digits)',
    };
  }

  try {
    // Attempt parsing with libphonenumber-js (assuming international with leading '+' or default international code)
    const formattedInput = digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
    const phoneNumber = parsePhoneNumberWithError(formattedInput);

    if (phoneNumber && phoneNumber.isValid()) {
      return {
        isValid: true,
        original: str,
        // Normalized E.164 without leading '+' for WhatsApp API standards or with digits
        normalized: phoneNumber.number.replace('+', ''),
      };
    }
  } catch (e: any) {
    // Fallback digit check if libphonenumber error
  }

  // Fallback: If 10-15 digits, treat as valid international format
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    const cleanNumber = digitsOnly.replace('+', '');
    return {
      isValid: true,
      original: str,
      normalized: cleanNumber,
    };
  }

  return {
    isValid: false,
    original: str,
    normalized: digitsOnly,
    errorType: 'INVALID_PHONE',
    errorReason: 'Invalid phone number format or length',
  };
}
