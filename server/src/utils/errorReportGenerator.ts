import * as XLSX from 'xlsx';

export function generateErrorReportXlsx(invalidRows: any[]): Buffer {
  const exportData = invalidRows.map((item) => ({
    'Original Name': item.name || '',
    'Original Phone': item.phoneRaw || '',
    'Original Email': item.email || '',
    'Original Company': item.company || '',
    'Original City': item.city || '',
    'Failure Reason / Error': item.errorReason || 'Invalid contact data',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invalid Contacts Report');

  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}
