export type OptInStatus = 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN';
export type MarketingOptInStatus = OptInStatus;

export type ValidationStatus = 'VALID' | 'INVALID' | 'DUPLICATE';

export type ErrorType =
  | 'MISSING_PHONE'
  | 'INVALID_PHONE'
  | 'DUPLICATE_FILE'
  | 'DUPLICATE_SESSION';

export interface Contact {
  id: string;
  name?: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  company?: string;
  city?: string;
  service?: string;
  marketingOptIn: OptInStatus;
  status: 'VALID';
  customFields: Record<string, string>;
  importedAt: string;
}

export interface RawImportRow {
  rowIndex: number;
  originalData: Record<string, any>;
  mappedData: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    city?: string;
    service?: string;
    marketingOptIn?: OptInStatus;
    customFields: Record<string, string>;
  };
  normalizedPhone?: string;
  status: ValidationStatus;
  errorType?: ErrorType;
  errorReason?: string;
}

export interface ColumnMapping {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  city?: string;
  service?: string;
  marketingOptIn?: string;
}

export interface ImportResultSummary {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  duplicateCount: number;
  fileName: string;
  invalidRows: RawImportRow[];
}
