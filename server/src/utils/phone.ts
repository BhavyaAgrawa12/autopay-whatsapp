/**
 * Normalizes a phone number to standard digits-only format.
 * If 10 digits (e.g. Indian mobile number), defaults country code prefix to '91'.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  
  // Remove all non-numeric characters except leading +
  let cleaned = String(rawPhone).trim().replace(/[^\d+]/g, '');
  
  // If starts with +, remove +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // If cleaned is 10 digits (e.g., standard Indian 10-digit number), add 91 prefix
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = `91${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Formats a normalized phone number for display (e.g. +91 98765 43210 or +1 555 123 4567)
 */
export function formatPhoneForDisplay(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return '';
  if (norm.length === 12 && norm.startsWith('91')) {
    return `+91 ${norm.slice(2, 7)} ${norm.slice(7)}`;
  }
  return `+${norm}`;
}
