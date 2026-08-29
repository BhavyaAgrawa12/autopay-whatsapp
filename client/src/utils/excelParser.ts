import * as XLSX from 'xlsx';
import { ColumnMapping, OptInStatus } from '../types/contact';

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  fileSize: number;
  totalRows: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Validates and parses uploaded Excel (.xlsx, .xls) or CSV files into headers and JSON rows.
 */
export async function parseExcelFile(file: File): Promise<ParsedFileData> {
  const fileName = file.name;
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  if (!allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported file type '${extension}'. Only .xlsx, .xls, and .csv files are supported.`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 10 MB.`);
  }

  if (file.size === 0) {
    throw new Error('The selected file is empty.');
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel workbook contains no sheets.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert worksheet to JSON rows with raw values
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('The selected file contains no data rows.');
  }

  // Extract headers directly from the first row keys
  const headers = Object.keys(rows[0]).map((h) => h.trim()).filter((h) => h.length > 0);

  if (headers.length === 0) {
    throw new Error('The uploaded file is missing header columns.');
  }

  return {
    headers,
    rows,
    fileName,
    fileSize: file.size,
    totalRows: rows.length,
  };
}

/**
 * Auto-detects matching headers for standard contact fields.
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { phone: '' };

  const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

  headers.forEach((header) => {
    const norm = normalizeHeader(header);

    // Phone matching (Required)
    if (!mapping.phone) {
      if (['phone', 'phonenumber', 'mobile', 'cell', 'contactnumber', 'telephone', 'whatsapp', 'whatsappnumber', 'number'].includes(norm)) {
        mapping.phone = header;
      }
    }

    // Name matching
    if (!mapping.name) {
      if (['name', 'fullname', 'customername', 'contactname', 'clientname', 'firstlast'].includes(norm)) {
        mapping.name = header;
      }
    }

    // Email matching
    if (!mapping.email) {
      if (['email', 'emailaddress', 'mail'].includes(norm)) {
        mapping.email = header;
      }
    }

    // Company matching
    if (!mapping.company) {
      if (['company', 'companyname', 'organization', 'business', 'firm'].includes(norm)) {
        mapping.company = header;
      }
    }

    // City matching
    if (!mapping.city) {
      if (['city', 'location', 'town', 'address', 'region'].includes(norm)) {
        mapping.city = header;
      }
    }

    // Service matching
    if (!mapping.service) {
      if (['service', 'product', 'category', 'interest', 'requirement'].includes(norm)) {
        mapping.service = header;
      }
    }

    // Opt-In matching
    if (!mapping.marketingOptIn) {
      if (['optin', 'marketingoptin', 'optedin', 'subscribed', 'consent', 'marketingconsent', 'agree'].includes(norm)) {
        mapping.marketingOptIn = header;
      }
    }
  });

  return mapping;
}

/**
 * Normalizes opt-in strings into OPTED_IN, OPTED_OUT, or UNKNOWN.
 */
export function normalizeOptInStatus(rawVal: any): OptInStatus {
  if (rawVal === undefined || rawVal === null || rawVal === '') {
    return 'UNKNOWN';
  }

  const str = String(rawVal).trim().toLowerCase();

  const optedInValues = ['yes', 'y', 'true', '1', 'subscribed', 'opted in', 'opted_in', 'opt-in', 'optin', 'allowed', 'agree', 'agreed'];
  const optedOutValues = ['no', 'n', 'false', '0', 'unsubscribed', 'opted out', 'opted_out', 'opt-out', 'optout', 'stop', 'blocked', 'denied'];

  if (optedInValues.includes(str)) {
    return 'OPTED_IN';
  }

  if (optedOutValues.includes(str)) {
    return 'OPTED_OUT';
  }

  return 'UNKNOWN';
}
