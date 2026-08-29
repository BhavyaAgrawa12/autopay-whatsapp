import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Download,
  Check,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorAlert } from '../ui/ErrorAlert';
import { parseExcelFile, autoDetectColumnMapping, normalizeOptInStatus } from '../../utils/excelParser';
import { validatePhoneNumber } from '../../utils/phoneValidator';
import { ColumnMapping, RawImportRow, ImportResultSummary, ValidationStatus } from '../../types/contact';
import { useContacts } from '../../context/ContactContext';
import { downloadErrorReport } from '../../utils/errorReportGenerator';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'complete';

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({ isOpen, onClose }) => {
  const { contacts: existingSessionContacts, importContacts } = useContacts();

  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed raw file state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({ phone: '' });

  // Processed preview rows
  const [processedRows, setProcessedRows] = useState<RawImportRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | ValidationStatus>('ALL');

  // Summary result
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);

  if (!isOpen) return null;

  const resetWizard = () => {
    setStep('upload');
    setFile(null);
    setIsProcessing(false);
    setErrorMessage(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({ phone: '' });
    setProcessedRows([]);
    setPreviewFilter('ALL');
    setImportSummary(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  // Step 1: File selection & parsing
  const handleFileSelect = async (selectedFile: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setFile(selectedFile);

    try {
      const parsed = await parseExcelFile(selectedFile);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Auto detect mapping
      const autoMap = autoDetectColumnMapping(parsed.headers);
      setMapping(autoMap);

      setStep('mapping');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Step 2: Mapping submission & Validation processing
  const handleMappingSubmit = () => {
    if (!mapping.phone) {
      setErrorMessage('The "Phone" field is required. Please map a column to Phone before proceeding.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    const existingPhonesInSession = new Set(existingSessionContacts.map((c) => c.normalizedPhone));
    const seenPhonesInFile = new Set<string>();

    const rows: RawImportRow[] = rawRows.map((row, idx) => {
      const rawPhoneVal = row[mapping.phone];
      const phoneValidation = validatePhoneNumber(rawPhoneVal);

      const rawName = mapping.name ? String(row[mapping.name] || '').trim() : undefined;
      const rawEmail = mapping.email ? String(row[mapping.email] || '').trim() : undefined;
      const rawCompany = mapping.company ? String(row[mapping.company] || '').trim() : undefined;
      const rawCity = mapping.city ? String(row[mapping.city] || '').trim() : undefined;
      const rawService = mapping.service ? String(row[mapping.service] || '').trim() : undefined;
      const rawOptIn = mapping.marketingOptIn ? normalizeOptInStatus(row[mapping.marketingOptIn]) : 'UNKNOWN';

      // Extract custom unmapped fields
      const mappedHeaders = new Set(
        [
          mapping.phone,
          mapping.name,
          mapping.email,
          mapping.company,
          mapping.city,
          mapping.service,
          mapping.marketingOptIn,
        ].filter(Boolean)
      );

      const customFields: Record<string, string> = {};
      Object.keys(row).forEach((key) => {
        if (!mappedHeaders.has(key) && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          customFields[key] = String(row[key]).trim();
        }
      });

      let status: ValidationStatus = 'VALID';
      let errorType: RawImportRow['errorType'] = undefined;
      let errorReason: string | undefined = undefined;

      if (!phoneValidation.isValid) {
        status = 'INVALID';
        errorType = phoneValidation.errorType;
        errorReason = phoneValidation.errorReason;
      } else {
        const norm = phoneValidation.normalized;

        if (seenPhonesInFile.has(norm)) {
          status = 'DUPLICATE';
          errorType = 'DUPLICATE_FILE';
          errorReason = 'Duplicate phone number found within this file';
        } else if (existingPhonesInSession.has(norm)) {
          status = 'DUPLICATE';
          errorType = 'DUPLICATE_SESSION';
          errorReason = 'Phone number already exists in current session contacts';
        } else {
          seenPhonesInFile.add(norm);
        }
      }

      return {
        rowIndex: idx + 2, // Header is row 1
        originalData: row,
        mappedData: {
          name: rawName,
          phone: String(rawPhoneVal || ''),
          email: rawEmail,
          company: rawCompany,
          city: rawCity,
          service: rawService,
          marketingOptIn: rawOptIn,
          customFields,
        },
        normalizedPhone: phoneValidation.normalized,
        status,
        errorType,
        errorReason,
      };
    });

    setProcessedRows(rows);
    setIsProcessing(false);
    setStep('preview');
  };

  // Step 3: Execute import by sending file to MongoDB backend
  const handleExecuteImport = async () => {
    if (!file) {
      setErrorMessage('No file selected for upload.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (mapping) {
        formData.append('mapping', JSON.stringify(mapping));
      }

      const result = await importContacts(formData);

      const summary: ImportResultSummary = {
        totalRows: result?.summary?.totalUploaded || processedRows.length,
        importedCount: result?.summary?.importedCount || 0,
        skippedCount: result?.summary?.invalidCount || 0,
        invalidCount: result?.summary?.invalidCount || 0,
        duplicateCount: result?.summary?.duplicateCount || 0,
        fileName: file.name,
        invalidRows: (result?.invalidRows || []).map((row: any, idx: number) => ({
          rowIndex: idx + 2,
          originalData: row,
          mappedData: { phone: row.phoneRaw || '', name: row.name },
          status: 'INVALID',
          errorReason: row.errorReason || 'Validation error',
        })),
      };

      setImportSummary(summary);
      setStep('complete');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload contacts to server database.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Stats calculation
  const totalRowsCount = processedRows.length;
  const validCount = processedRows.filter((r) => r.status === 'VALID').length;
  const invalidCount = processedRows.filter((r) => r.status === 'INVALID').length;
  const duplicateCount = processedRows.filter((r) => r.status === 'DUPLICATE').length;

  const filteredPreviewRows = processedRows.filter((r) => {
    if (previewFilter === 'ALL') return true;
    return r.status === previewFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-lg">Import Contacts Wizard</h3>
              <p className="text-xs text-slate-400">Excel / CSV Contact Import into Session State</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Progress Indicator */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}>1</span>
            Upload File
          </div>
          <span className="text-slate-700">→</span>
          <div className={`flex items-center gap-2 ${step === 'mapping' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'mapping' ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}>2</span>
            Column Mapping
          </div>
          <span className="text-slate-700">→</span>
          <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'preview' ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}>3</span>
            Validation & Preview
          </div>
          <span className="text-slate-700">→</span>
          <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}>4</span>
            Import Complete
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && <ErrorAlert message={errorMessage} />}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/40 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h4 className="text-base font-semibold text-slate-100 mb-1">
                  Drag & Drop Excel or CSV file here
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Supports <code className="text-emerald-400">.xlsx</code>, <code className="text-emerald-400">.xls</code>, and <code className="text-emerald-400">.csv</code> files up to 10 MB.
                </p>
                <Button variant="outline" size="sm">
                  Browse Files
                </Button>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              {isProcessing && <LoadingSpinner label="Parsing file headers and structure..." />}

              {file && !isProcessing && (
                <Card variant="bordered" className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-bold text-slate-200 block">{file.name}</span>
                      <span className="text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <Badge variant="success">File Loaded</Badge>
                </Card>
              )}
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="font-bold text-white text-sm">Map Excel Columns to Contact Fields</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Detected {headers.length} headers. Unmapped headers (e.g. Budget) will be preserved in custom fields.
                  </p>
                </div>
                <Badge variant="info">Detected Headers: {headers.length}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Phone Mapping (REQUIRED) */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-emerald-800/60">
                  <label className="block font-bold text-emerald-400 mb-1 flex items-center justify-between">
                    <span>Phone Number *</span>
                    <Badge variant="error" size="sm">Required</Badge>
                  </label>
                  <select
                    value={mapping.phone}
                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Phone Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Name Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                  <select
                    value={mapping.name || ''}
                    onChange={(e) => setMapping({ ...mapping, name: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Ignore / Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Email Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
                  <select
                    value={mapping.email || ''}
                    onChange={(e) => setMapping({ ...mapping, email: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Ignore / Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Company Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="block font-semibold text-slate-300 mb-1">Company</label>
                  <select
                    value={mapping.company || ''}
                    onChange={(e) => setMapping({ ...mapping, company: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Ignore / Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* City Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="block font-semibold text-slate-300 mb-1">City</label>
                  <select
                    value={mapping.city || ''}
                    onChange={(e) => setMapping({ ...mapping, city: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Ignore / Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Service Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="block font-semibold text-slate-300 mb-1">Service / Requirement</label>
                  <select
                    value={mapping.service || ''}
                    onChange={(e) => setMapping({ ...mapping, service: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Ignore / Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Marketing Opt-In Mapping */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Marketing Opt-In / Consent</label>
                  <select
                    value={mapping.marketingOptIn || ''}
                    onChange={(e) => setMapping({ ...mapping, marketingOptIn: e.target.value || undefined })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Unmapped (Will be set to UNKNOWN) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Total Rows</span>
                  <span className="text-xl font-bold text-white">{totalRowsCount}</span>
                </Card>
                <Card className="p-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Valid</span>
                  <span className="text-xl font-bold text-emerald-400">{validCount}</span>
                </Card>
                <Card className="p-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Invalid</span>
                  <span className="text-xl font-bold text-rose-400">{invalidCount}</span>
                </Card>
                <Card className="p-3">
                  <span className="text-[11px] text-slate-400 block font-medium">Duplicates</span>
                  <span className="text-xl font-bold text-amber-400">{duplicateCount}</span>
                </Card>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setPreviewFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All ({totalRowsCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('VALID')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'VALID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Valid ({validCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('INVALID')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'INVALID' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Invalid ({invalidCount})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('DUPLICATE')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'DUPLICATE' ? 'bg-amber-950 text-amber-400 border border-amber-800/40' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Duplicate ({duplicateCount})
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Raw Phone</th>
                      <th className="p-2.5">Normalized Phone</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Error Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPreviewRows.slice(0, 100).map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-slate-900/40">
                        <td className="p-2.5 text-slate-500 font-mono">#{row.rowIndex}</td>
                        <td className="p-2.5 text-slate-200 font-medium">{row.mappedData.name || '-'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{row.mappedData.phone || '-'}</td>
                        <td className="p-2.5 text-emerald-400 font-mono">{row.normalizedPhone || '-'}</td>
                        <td className="p-2.5">
                          {row.status === 'VALID' && <Badge variant="success" size="sm">Valid</Badge>}
                          {row.status === 'INVALID' && <Badge variant="error" size="sm">Invalid</Badge>}
                          {row.status === 'DUPLICATE' && <Badge variant="warning" size="sm">Duplicate</Badge>}
                        </td>
                        <td className="p-2.5 text-rose-300 font-medium">
                          {row.errorReason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === 'complete' && importSummary && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Import Complete ✓</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Processed {importSummary.totalRows} rows from <span className="font-semibold text-slate-200">{importSummary.fileName}</span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-3 bg-slate-950 rounded-xl border border-emerald-800/40">
                  <span className="text-2xl font-bold text-emerald-400">{importSummary.importedCount}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">Imported</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-rose-800/40">
                  <span className="text-2xl font-bold text-rose-400">{importSummary.invalidCount}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">Invalid</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-amber-800/40">
                  <span className="text-2xl font-bold text-amber-400">{importSummary.duplicateCount}</span>
                  <span className="text-xs text-slate-400 block mt-0.5">Duplicates</span>
                </div>
              </div>

              {(importSummary?.invalidRows?.length ?? 0) > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 max-w-lg mx-auto flex items-center justify-between text-left">
                  <div>
                    <span className="font-bold text-slate-200 text-xs block">Error Report Ready</span>
                    <span className="text-[11px] text-slate-400">
                      {importSummary.skippedCount} skipped rows recorded with exact rejection reasons.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadErrorReport(importSummary.invalidRows, importSummary.fileName)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Download Excel Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          {step === 'upload' && (
            <div className="text-xs text-slate-500">Select file to proceed</div>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to File
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleMappingSubmit}
                isLoading={isProcessing}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep('mapping')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Adjust Mapping
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteImport}
                disabled={validCount === 0}
                rightIcon={<Check className="w-4 h-4" />}
              >
                Import {validCount} Valid Contacts
              </Button>
            </>
          )}

          {step === 'complete' && (
            <div className="w-full flex justify-end">
              <Button variant="primary" size="sm" onClick={handleClose}>
                View Contacts Directory
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
