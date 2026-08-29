import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  phoneRaw: string;
  phoneNormalized: string;
  countryCode?: string;
  error?: string;
}

export function validatePhoneNumber(rawPhone: any, defaultCountry: string = 'IN'): PhoneValidationResult {
  const phoneStr = String(rawPhone || '').trim();

  if (!phoneStr) {
    return {
      isValid: false,
      phoneRaw: phoneStr,
      phoneNormalized: '',
      error: 'Phone number is empty',
    };
  }

  try {
    const country = (defaultCountry.toUpperCase() as CountryCode) || 'IN';
    const parsed = parsePhoneNumberWithError(phoneStr, country);

    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        phoneRaw: phoneStr,
        phoneNormalized: parsed.format('E.164'),
        countryCode: parsed.country,
      };
    } else {
      return {
        isValid: false,
        phoneRaw: phoneStr,
        phoneNormalized: phoneStr,
        error: 'Invalid phone number format or length for specified country',
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      phoneRaw: phoneStr,
      phoneNormalized: phoneStr,
      error: err.message || 'Failed to parse phone number',
    };
  }
}
