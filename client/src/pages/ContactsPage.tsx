import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  UploadCloud,
  Search,
  Trash2,
  CheckSquare,
  Square,
  Download,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useContacts } from '../context/ContactContext';
import { ImportWizardModal } from '../components/contacts/ImportWizardModal';
import { OptInStatus } from '../types/contact';

export const ContactsPage: React.FC = () => {
  const {
    contacts,
    loading,
    total,
    totalPages,
    selectedContactIds,
    lastImportSummary,
    totalContactsCount,
    optedOutCount,
    selectedCount,
    eligibleSelectedCount,
    facets,
    loadContacts,
    removeContact,
    clearContacts,
    toggleSelectContact,
    selectAllContacts,
    deselectAllContacts,
    downloadLastErrorReport,
  } = useContacts();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [optInFilter, setOptInFilter] = useState<'ALL' | OptInStatus>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search debounce ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger server fetch on filter, page, or page size changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadContacts({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        optIn: optInFilter !== 'ALL' ? optInFilter : undefined,
        city: cityFilter !== 'ALL' ? cityFilter : undefined,
        company: companyFilter !== 'ALL' ? companyFilter : undefined,
        service: serviceFilter !== 'ALL' ? serviceFilter : undefined,
        sort: 'newest',
      });
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [currentPage, pageSize, searchTerm, optInFilter, cityFilter, companyFilter, serviceFilter, loadContacts]);

  // Extract unique custom field keys across all currently loaded contacts
  const customFieldKeys = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.customFields) {
        Object.keys(c.customFields).forEach((key) => set.add(key));
      }
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Cities, companies, services from facets or fallback to contacts in memory
  const uniqueCities = useMemo(() => {
    if (facets?.cities && facets.cities.length > 0) return facets.cities;
    const set = new Set<string>();
    contacts.forEach((c) => c.city && set.add(c.city));
    return Array.from(set).sort();
  }, [facets, contacts]);

  const uniqueCompanies = useMemo(() => {
    if (facets?.companies && facets.companies.length > 0) return facets.companies;
    const set = new Set<string>();
    contacts.forEach((c) => c.company && set.add(c.company));
    return Array.from(set).sort();
  }, [facets, contacts]);

  const uniqueServices = useMemo(() => {
    if (facets?.services && facets.services.length > 0) return facets.services;
    const set = new Set<string>();
    contacts.forEach((c) => c.service && set.add(c.service));
    return Array.from(set).sort();
  }, [facets, contacts]);

  const isAllCurrentSelected = useMemo(() => {
    if (contacts.length === 0) return false;
    return contacts.every((c) => selectedContactIds.has(c.id || (c as any)._id));
  }, [contacts, selectedContactIds]);

  const handleSelectAllCurrentToggle = () => {
    if (isAllCurrentSelected) {
      deselectAllContacts();
    } else {
      selectAllContacts(contacts.map((c) => c.id || (c as any)._id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedCount} selected contact(s)? This action cannot be undone.`)) {
      await clearContacts();
    }
  };

  const handleRefresh = () => {
    loadContacts({
      page: currentPage,
      limit: pageSize,
      search: searchTerm.trim() || undefined,
      optIn: optInFilter !== 'ALL' ? optInFilter : undefined,
      city: cityFilter !== 'ALL' ? cityFilter : undefined,
      company: companyFilter !== 'ALL' ? companyFilter : undefined,
      service: serviceFilter !== 'ALL' ? serviceFilter : undefined,
      sort: 'newest',
    });
  };

  return (
    <div>
      <PageHeader
        title="Target Contacts Directory"
        description="Load and manage single company promotional customer lists via Excel/CSV."
        badge={<Badge variant="info">MongoDB Persistence Active</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            {lastImportSummary && (lastImportSummary.invalidRows?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLastErrorReport}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Error Report
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<UploadCloud className="w-4 h-4" />}
            >
              Import Contacts
            </Button>
          </div>
        }
      />

      {/* Session Lifetime Notice Banner */}
      <div className="mb-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <strong>Database Persistence:</strong> All contacts are stored securely in your database and accessible anytime across campaigns.
          </span>
        </div>
        {totalContactsCount > 0 && selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearContacts}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
          >
            Delete {selectedCount} Selected
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Contacts</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{totalContactsCount}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Valid Records</span>
            <Badge variant="success" size="sm">Valid</Badge>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{totalContactsCount}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Opted Out</span>
            <Badge variant="error" size="sm">Opt-Out</Badge>
          </div>
          <span className="text-2xl font-bold text-rose-400">{optedOutCount}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Last Skipped Errors</span>
            <Badge variant="warning" size="sm">Skipped</Badge>
          </div>
          <span className="text-2xl font-bold text-amber-400">
            {lastImportSummary ? lastImportSummary.skippedCount : 0}
          </span>
        </Card>
      </div>

      {totalContactsCount === 0 && !loading && !searchTerm && optInFilter === 'ALL' ? (
        <EmptyState
          icon={Users}
          title="No Contacts Loaded in Database"
          description="Upload an Excel (.xlsx, .xls) or CSV file to import target contacts into database."
          actionLabel="Import Contacts Now"
          onAction={() => setIsImportModalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Search & Multi-dimensional Filters */}
          <Card className="p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search Name, Phone, Email, Company, City, Service..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Filters Group */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Opt-In Filter */}
                <select
                  value={optInFilter}
                  onChange={(e) => {
                    setOptInFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Opt-In Statuses</option>
                  <option value="OPTED_IN">Opted In</option>
                  <option value="OPTED_OUT">Opted Out</option>
                  <option value="UNKNOWN">Unknown Consent</option>
                </select>

                {/* City Filter */}
                {uniqueCities.length > 0 && (
                  <select
                    value={cityFilter}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Cities ({uniqueCities.length})</option>
                    {uniqueCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                )}

                {/* Company Filter */}
                {uniqueCompanies.length > 0 && (
                  <select
                    value={companyFilter}
                    onChange={(e) => {
                      setCompanyFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Companies ({uniqueCompanies.length})</option>
                    {uniqueCompanies.map((comp) => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                )}

                {/* Service Filter */}
                {uniqueServices.length > 0 && (
                  <select
                    value={serviceFilter}
                    onChange={(e) => {
                      setServiceFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Services ({uniqueServices.length})</option>
                    {uniqueServices.map((srv) => (
                      <option key={srv} value={srv}>{srv}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Selection & Bulk Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleSelectAllCurrentToggle}
                  className="flex items-center gap-1.5 font-medium text-slate-300 hover:text-white transition-colors"
                >
                  {isAllCurrentSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  Select Page ({contacts.length})
                </button>
                {selectedCount > 0 && (
                  <button
                    onClick={deselectAllContacts}
                    className="text-slate-500 hover:text-slate-300 underline"
                  >
                    Deselect All
                  </button>
                )}
                {selectedCount > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 text-rose-400 hover:text-white font-semibold border border-rose-800/60 bg-rose-950/50 hover:bg-rose-900/60 px-2.5 py-1 rounded-lg transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedCount})
                  </button>
                )}
              </div>

              {/* Selection Summary Indicator */}
              <div className="flex items-center gap-3">
                <Badge variant="info">Selected: {selectedCount}</Badge>
                <Badge variant="success">Eligible for Campaign: {eligibleSelectedCount}</Badge>
              </div>
            </div>
          </Card>

          {/* Contact Data Table Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-xs relative">
            {/* Subtle top loading progress bar when refetching */}
            {loading && (
              <div className="h-0.5 w-full bg-emerald-500/20 overflow-hidden absolute top-0 left-0 right-0 z-10">
                <div className="h-full bg-emerald-400 animate-pulse w-1/3" />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentSelected}
                        onChange={handleSelectAllCurrentToggle}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="p-3 text-slate-200">Name</th>
                    <th className="p-3 text-slate-200">Phone</th>
                    <th className="p-3 text-slate-200">Email</th>
                    <th className="p-3 text-slate-200">Company</th>
                    <th className="p-3 text-slate-200">City</th>
                    <th className="p-3 text-slate-200">Service</th>
                    <th className="p-3 text-slate-200">Marketing Opt-In</th>
                    {/* Render preserved custom Excel columns */}
                    {customFieldKeys.map((key) => (
                      <th key={key} className="p-3 text-slate-200 font-bold">{key}</th>
                    ))}
                    <th className="p-3 text-right text-slate-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={8 + customFieldKeys.length} className="p-12 text-center text-slate-400">
                        {loading ? (
                          <div className="flex flex-col items-center justify-center py-4">
                            <LoadingSpinner size="md" label="Loading contacts from database..." />
                          </div>
                        ) : (
                          'No contacts match the active search and filter criteria.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact) => {
                      const cid = contact.id || (contact as any)._id;
                      const isSelected = selectedContactIds.has(cid);
                      const displayPhone = contact.normalizedPhone
                        ? (contact.normalizedPhone.startsWith('+') ? contact.normalizedPhone : `+${contact.normalizedPhone}`)
                        : (contact.phone || '-');
                      return (
                        <tr
                          key={cid}
                          className={`hover:bg-slate-800/60 transition-colors ${
                            isSelected ? 'bg-emerald-950/30' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectContact(cid)}
                              className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3 font-semibold text-white">{contact.name || '-'}</td>
                          <td className="p-3 font-mono text-emerald-400 font-semibold">{displayPhone}</td>
                          <td className="p-3 text-slate-200">{contact.email || '-'}</td>
                          <td className="p-3 text-slate-200">{contact.company || '-'}</td>
                          <td className="p-3 text-slate-200">{contact.city || '-'}</td>
                          <td className="p-3 text-slate-200">{contact.service || '-'}</td>
                          <td className="p-3">
                            {contact.marketingOptIn === 'OPTED_IN' && <Badge variant="success" size="sm">Opted In</Badge>}
                            {contact.marketingOptIn === 'OPTED_OUT' && <Badge variant="error" size="sm">Opted Out</Badge>}
                            {contact.marketingOptIn === 'UNKNOWN' && <Badge variant="neutral" size="sm">Unknown</Badge>}
                          </td>
                          {/* Render custom columns */}
                          {customFieldKeys.map((key) => (
                            <td key={key} className="p-3 text-slate-200 font-mono">
                              {contact.customFields?.[key] || '-'}
                            </td>
                          ))}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => removeContact(cid)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                              title="Delete contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400">
                  Showing {total > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                  {Math.min(currentPage * pageSize, total)} of {total} contacts
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Prev
                </Button>
                <span className="font-semibold text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Wizard Modal Component */}
      <ImportWizardModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          loadContacts({ page: 1, sort: 'newest' });
        }}
      />
    </div>
  );
};
