import * as XLSX from 'xlsx';
import { RawImportRow } from '../types/contact';

/**
 * Generates an Excel error report containing all original columns plus Import Status, Error Type, and Error Reason.
 * Triggers browser download directly.
 */
export function downloadErrorReport(invalidRows: RawImportRow[], originalFileName: string): void {
  if (!invalidRows || invalidRows.length === 0) {
    alert('No error records available to export.');
    return;
  }

  // Map each invalid row to export object containing original fields + error details
  const exportData = invalidRows.map((row) => {
    const record: Record<string, any> = { ...row.originalData };

    // Append standardized error tracking columns
    record['Import Status'] = 'Rejected';
    record['Error Type'] = row.errorType || 'INVALID';
    record['Error Reason'] = row.errorReason || 'Validation failed';

    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-fit column widths
  const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
    wch: Math.max(key.length + 2, 15),
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Errors');

  // Format date for filename: contact_import_errors_2026-08-27.xlsx
  const today = new Date().toISOString().split('T')[0];
  const cleanName = originalFileName.replace(/\.[^/.]+$/, '');
  const exportFileName = `contact_import_errors_${cleanName}_${today}.xlsx`;

  XLSX.writeFile(workbook, exportFileName);
}
