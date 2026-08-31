import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Contact, MarketingOptInStatus } from '../types/contact';
import {
  fetchContactsApi,
  importContactsApi,
  updateContactOptInApi,
  deleteContactApi,
} from '../api/contacts';

export interface ContactFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  optIn?: string;
  city?: string;
  company?: string;
  service?: string;
  sort?: string;
}

interface ContactContextType {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  selectedContactIds: Set<string>;
  lastImportSummary: any | null;
  totalContactsCount: number;
  optedOutCount: number;
  selectedCount: number;
  eligibleSelectedCount: number;
  facets: {
    cities: string[];
    companies: string[];
    services: string[];
  };
  loadContacts: (params?: ContactFilterParams) => Promise<void>;
  importContacts: (arg1: any, arg2?: any) => Promise<any>;
  importContactsFromFile: (arg1: any, arg2?: any) => Promise<any>;
  updateOptInStatus: (id: string, newStatus: MarketingOptInStatus) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  clearContacts: () => Promise<void>;
  downloadLastErrorReport: () => void;
  toggleSelectContact: (id: string) => void;
  selectAllContacts: (ids?: string[]) => void;
  deselectAllContacts: () => void;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export const ContactProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [globalStats, setGlobalStats] = useState<{
    totalContacts: number;
    optedOutCount: number;
    optedInCount: number;
    unknownCount: number;
  }>({ totalContacts: 0, optedOutCount: 0, optedInCount: 0, unknownCount: 0 });

  const [facets, setFacets] = useState<{
    cities: string[];
    companies: string[];
    services: string[];
  }>({ cities: [], companies: [], services: [] });

  const [activeParams, setActiveParams] = useState<ContactFilterParams>({
    page: 1,
    limit: 50,
    sort: 'newest',
  });

  const [lastImportSummary, setLastImportSummary] = useState<any | null>(null);
  const [lastErrorReportBase64, setLastErrorReportBase64] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  const loadContacts = useCallback(async (params?: ContactFilterParams) => {
    setLoading(true);
    setError(null);
    const query = { ...activeParams, ...(params || {}) };
    setActiveParams(query);

    try {
      const data = await fetchContactsApi(query);
      setContacts(data.contacts || []);
      setPage(data.page || 1);
      setLimit(data.limit || 50);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

      if (data.stats) {
        setGlobalStats(data.stats);
      }
      if (data.facets) {
        setFacets(data.facets);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts from database');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [activeParams]);

  useEffect(() => {
    loadContacts({ page: 1, limit: 50, sort: 'newest' });
  }, []);

  const importContactsFromFile = async (arg1: any, arg2?: any) => {
    setLoading(true);
    try {
      if (arg1 instanceof FormData) {
        const result = await importContactsApi(arg1);
        setLastImportSummary(result.summary || null);
        if (result.errorReportXlsxBase64) {
          setLastErrorReportBase64(result.errorReportXlsxBase64);
        }
        // Immediately reload page 1 with newest sort so newly uploaded contacts appear at top
        await loadContacts({ page: 1, sort: 'newest', search: '', optIn: '', city: '', company: '', service: '' });
        return result;
      } else {
        setLastImportSummary(arg2 || null);
        await loadContacts({ page: 1, sort: 'newest' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import contacts file.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOptInStatus = async (id: string, newStatus: MarketingOptInStatus) => {
    try {
      const updated = await updateContactOptInApi(id, newStatus);
      setContacts((prev) => prev.map((c) => (c.id === id || (c as any)._id === id ? updated : c)));
      loadContacts();
    } catch (err: any) {
      setError(err.message || 'Failed to update contact status');
      throw err;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await deleteContactApi(id);
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadContacts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete contact');
      throw err;
    }
  };

  const clearContacts = async () => {
    for (const id of Array.from(selectedContactIds)) {
      await deleteContactApi(id).catch(() => {});
    }
    setSelectedContactIds(new Set());
    await loadContacts();
  };

  const downloadLastErrorReport = () => {
    if (!lastErrorReportBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${lastErrorReportBase64}`;
    link.download = `Invalid_Contacts_Report_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllContacts = (ids?: string[]) => {
    const targetIds = ids || contacts.map((c) => c.id || (c as any)._id);
    setSelectedContactIds(new Set(targetIds));
  };

  const deselectAllContacts = () => {
    setSelectedContactIds(new Set());
  };

  const totalContactsCount = globalStats.totalContacts || total;
  const optedOutCount = globalStats.optedOutCount || contacts.filter((c) => c.marketingOptIn === 'OPTED_OUT').length;
  const selectedCount = selectedContactIds.size;
  const eligibleSelectedCount = contacts.filter(
    (c) => selectedContactIds.has(c.id || (c as any)._id) && c.marketingOptIn === 'OPTED_IN'
  ).length;

  return (
    <ContactContext.Provider
      value={{
        contacts,
        loading,
        error,
        page,
        limit,
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
        importContacts: importContactsFromFile,
        importContactsFromFile,
        updateOptInStatus,
        deleteContact,
        removeContact: deleteContact,
        clearContacts,
        downloadLastErrorReport,
        toggleSelectContact,
        selectAllContacts,
        deselectAllContacts,
      }}
    >
      {children}
    </ContactContext.Provider>
  );
};

export const useContacts = (): ContactContextType => {
  const context = useContext(ContactContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactProvider');
  }
  return context;
};
