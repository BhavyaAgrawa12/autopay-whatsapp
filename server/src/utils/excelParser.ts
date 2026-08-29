import * as XLSX from 'xlsx';

export interface ParsedContactRow {
  name: string;
  phoneRaw: string;
  email?: string;
  company?: string;
  city?: string;
  service?: string;
  optInStatus?: 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN';
  customFields?: Record<string, string>;
  rawRow: Record<string, any>;
}

export function parseContactFile(
  buffer: Buffer,
  customMapping?: Record<string, string>
): ParsedContactRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Uploaded workbook contains no sheet.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('Uploaded file contains no data rows.');
  }

  const headers = Object.keys(rawRows[0]).map((h) => h.trim());
  const phoneHeader = customMapping?.phone || autoDetectHeader(headers, ['phone', 'mobile', 'contact', 'whatsapp', 'number']);
  const nameHeader = customMapping?.name || autoDetectHeader(headers, ['name', 'fullname', 'customer', 'contactname']);
  const emailHeader = customMapping?.email || autoDetectHeader(headers, ['email', 'mail']);
  const companyHeader = customMapping?.company || autoDetectHeader(headers, ['company', 'organization', 'business']);
  const cityHeader = customMapping?.city || autoDetectHeader(headers, ['city', 'location', 'address']);
  const serviceHeader = customMapping?.service || autoDetectHeader(headers, ['service', 'product']);
  const optInHeader = customMapping?.marketingOptIn || autoDetectHeader(headers, ['optin', 'consent', 'subscribed']);

  return rawRows.map((row) => {
    const phoneRaw = String(row[phoneHeader] || '').trim();
    const name = String(row[nameHeader] || 'Valued Customer').trim();
    const email = emailHeader ? String(row[emailHeader] || '').trim() : undefined;
    const company = companyHeader ? String(row[companyHeader] || '').trim() : undefined;
    const city = cityHeader ? String(row[cityHeader] || '').trim() : undefined;
    const service = serviceHeader ? String(row[serviceHeader] || '').trim() : undefined;

    // Collect custom fields for remaining columns
    const customFields: Record<string, string> = {};
    Object.keys(row).forEach((key) => {
      const trimmedKey = key.trim();
      if (
        ![phoneHeader, nameHeader, emailHeader, companyHeader, cityHeader, serviceHeader, optInHeader].includes(
          trimmedKey
        )
      ) {
        customFields[trimmedKey] = String(row[key] || '').trim();
      }
    });

    const optInRaw = optInHeader ? String(row[optInHeader] || '').trim() : '';
    let optInStatus: 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN' = 'OPTED_IN';

    if (['no', 'n', 'false', '0', 'opted out', 'unsubscribed', 'stop'].includes(optInRaw.toLowerCase())) {
      optInStatus = 'OPTED_OUT';
    } else if (['unknown', ''].includes(optInRaw.toLowerCase()) && optInHeader) {
      optInStatus = 'UNKNOWN';
    }

    return {
      name,
      phoneRaw,
      email,
      company,
      city,
      service,
      optInStatus,
      customFields,
      rawRow: row,
    };
  });
}

function autoDetectHeader(headers: string[], keywords: string[]): string {
  for (const header of headers) {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keywords.some((kw) => norm.includes(kw))) {
      return header;
    }
  }
  return '';
}
