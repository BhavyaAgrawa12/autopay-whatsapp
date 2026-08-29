import React, { useEffect, useState } from 'react';
import {
  ListFilter,
  Plus,
  Users,
  Trash2,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import {
  fetchContactListsApi,
  createContactListApi,
  fetchContactListDetailsApi,
  updateContactListApi,
  deleteContactListApi,
  addContactsToListApi,
  removeContactFromListApi,
  ContactListSummary,
  ContactListMember,
} from '../api/contactLists';
import { fetchContactsApi } from '../api/contacts';
import { Contact } from '../types/contact';

export const ContactListsPage: React.FC = () => {
  const [lists, setLists] = useState<ContactListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactListSummary | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // List Detail View Modal State
  const [selectedList, setSelectedList] = useState<ContactListSummary | null>(null);
  const [detailMembers, setDetailMembers] = useState<ContactListMember[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailTotalPages, setDetailTotalPages] = useState(1);
  const [detailSearch, setDetailSearch] = useState('');

  // Add Contacts Modal State
  const [isAddContactsOpen, setIsAddContactsOpen] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Toast Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContactListsApi();
      setLists(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load contact lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  // Handle Create / Edit Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError('List name is required and cannot be empty.');
      return;
    }

    setIsSubmittingForm(true);

    try {
      if (editingList) {
        await updateContactListApi(editingList.id, trimmed, formDescription);
        showToast(`Contact list '${trimmed}' updated successfully.`);
      } else {
        await createContactListApi(trimmed, formDescription);
        showToast(`Contact list '${trimmed}' created successfully.`);
      }

      setIsCreateModalOpen(false);
      setEditingList(null);
      setFormName('');
      setFormDescription('');
      await loadLists();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save contact list.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const openCreateModal = () => {
    setEditingList(null);
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (list: ContactListSummary) => {
    setEditingList(list);
    setFormName(list.name);
    setFormDescription(list.description || '');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleDeleteList = async (list: ContactListSummary) => {
    if (!window.confirm(`Delete contact list '${list.name}'?\n\nThis will remove the list structure but will NOT delete any contacts.`)) {
      return;
    }

    try {
      await deleteContactListApi(list.id);
      showToast(`Deleted list '${list.name}'.`);
      if (selectedList?.id === list.id) {
        setSelectedList(null);
      }
      await loadLists();
    } catch (err: any) {
      alert(err.message || 'Failed to delete list.');
    }
  };

  // Open List Details
  const openListDetails = async (list: ContactListSummary, page = 1, search = '') => {
    setSelectedList(list);
    setDetailPage(page);
    setDetailSearch(search);
    setDetailLoading(true);

    try {
      const res = await fetchContactListDetailsApi(list.id, { page, limit: 25, search });
      setDetailMembers(res.contacts);
      setDetailTotalPages(res.pagination.totalPages);
      setSelectedList(res.list);
    } catch (err: any) {
      alert(err.message || 'Failed to load list members.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Remove Contact from List
  const handleRemoveContact = async (contactId: string, contactName: string) => {
    if (!selectedList) return;
    if (!window.confirm(`Remove ${contactName} from '${selectedList.name}'?\n(The contact will remain in your global Contacts collection).`)) {
      return;
    }

    try {
      await removeContactFromListApi(selectedList.id, contactId);
      showToast(`Removed ${contactName} from list.`);
      await openListDetails(selectedList, detailPage, detailSearch);
      await loadLists();
    } catch (err: any) {
      alert(err.message || 'Failed to remove contact.');
    }
  };

  // Open Add Contacts Modal
  const openAddContactsModal = async (page = 1, search = '') => {
    setAddSearch(search);
    setSelectedContactIds([]);
    setAddLoading(true);
    setIsAddContactsOpen(true);

    try {
      const res = await fetchContactsApi({ page, limit: 15, search });
      setAvailableContacts(res.contacts);
    } catch (err: any) {
      alert(err.message || 'Failed to load contacts for selection.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddContactsSubmit = async () => {
    if (!selectedList || selectedContactIds.length === 0) return;
    setIsSubmittingAdd(true);

    try {
      const res = await addContactsToListApi(selectedList.id, selectedContactIds);
      showToast(`Added ${res.addedCount} contacts to '${selectedList.name}'.`);
      setIsAddContactsOpen(false);
      setSelectedContactIds([]);
      await openListDetails(selectedList, 1, '');
      await loadLists();
    } catch (err: any) {
      alert(err.message || 'Failed to add contacts.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Lists"
        description="Segment audience into targeted audience lists for promotional campaigns."
        actions={
          <Button variant="primary" size="sm" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
            Create List
          </Button>
        }
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading contact lists from MongoDB..." />
      ) : error ? (
        <ErrorAlert title="Unable to load contact lists" message={error} onRetry={loadLists} />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={ListFilter}
          title="No Contact Lists Available"
          description="Create your first targeted audience list to organize contacts for promotional outreach."
          actionLabel="Create Contact List"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Card key={list.id} variant="bordered" className="flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-white text-base">{list.name}</h3>
                    {list.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{list.description}</p>}
                  </div>
                  <Badge variant="info" size="sm">
                    {list.memberCount} contacts
                  </Badge>
                </div>

                <div className="pt-3 text-xs text-slate-400 space-y-1 font-mono">
                  <div>Created: {new Date(list.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(list)} title="Edit List">
                    <Edit2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteList(list)} title="Delete List">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 hover:text-rose-300" />
                  </Button>
                </div>

                <Button variant="primary" size="sm" onClick={() => openListDetails(list)} leftIcon={<Users className="w-3.5 h-3.5" />}>
                  View Members
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT LIST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">{editingList ? 'Edit Contact List' : 'Create Contact List'}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  List Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VIP Retail Customers"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Description (Optional)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this target segment..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingForm}>
                  {editingList ? 'Save Changes' : 'Create List'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIST DETAILS & MEMBERS MODAL */}
      {selectedList && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <span>{selectedList.name}</span>
                  <Badge variant="info">{selectedList.memberCount} members</Badge>
                </h3>
                {selectedList.description && <p className="text-xs text-slate-400 mt-0.5">{selectedList.description}</p>}
              </div>
              <button onClick={() => setSelectedList(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => openListDetails(selectedList, 1, e.target.value)}
                  placeholder="Search list members..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button variant="primary" size="sm" onClick={() => openAddContactsModal(1, '')} leftIcon={<UserPlus className="w-4 h-4" />}>
                Add Contacts to List
              </Button>
            </div>

            {/* Members Table */}
            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              {detailLoading ? (
                <div className="p-8">
                  <LoadingSpinner label="Loading list members..." />
                </div>
              ) : detailMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No contacts match current filter in this list.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Opt-in Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-white">{m.name}</td>
                        <td className="p-3 font-mono text-slate-300">{m.phone}</td>
                        <td className="p-3 text-slate-400">{m.email || '—'}</td>
                        <td className="p-3">
                          <Badge variant={m.optInStatus === 'OPTED_IN' ? 'success' : 'neutral'} size="sm">
                            {m.optInStatus}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleRemoveContact(m.id, m.name)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {detailTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span>Page {detailPage} of {detailTotalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={detailPage <= 1} onClick={() => openListDetails(selectedList, detailPage - 1, detailSearch)}>
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={detailPage >= detailTotalPages} onClick={() => openListDetails(selectedList, detailPage + 1, detailSearch)}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CONTACTS TO LIST MODAL */}
      {isAddContactsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">Add Contacts to '{selectedList?.name}'</h3>
              <button onClick={() => setIsAddContactsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => openAddContactsModal(1, e.target.value)}
                placeholder="Search Contacts database by name, phone, email..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              {addLoading ? (
                <div className="p-8">
                  <LoadingSpinner label="Loading Contacts database..." />
                </div>
              ) : availableContacts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No available contacts found.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3 w-10">Select</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Consent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {availableContacts.map((c) => {
                      const isSelected = selectedContactIds.includes(c.id);
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedContactIds(selectedContactIds.filter((id) => id !== c.id));
                                } else {
                                  setSelectedContactIds([...selectedContactIds, c.id]);
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3 font-semibold text-white">{c.name}</td>
                          <td className="p-3 font-mono text-slate-300">{c.phone || c.normalizedPhone}</td>
                          <td className="p-3 text-slate-400">{c.company || '—'}</td>
                          <td className="p-3">
                            <Badge variant={c.marketingOptIn === 'OPTED_IN' ? 'success' : 'neutral'} size="sm">
                              {c.marketingOptIn}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">{selectedContactIds.length} contacts selected</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddContactsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedContactIds.length === 0}
                  isLoading={isSubmittingAdd}
                  onClick={handleAddContactsSubmit}
                >
                  Add Selected to List
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST DETAILS & MEMBERS MODAL */}
      {selectedList && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <span>{selectedList.name}</span>
                  <Badge variant="info">{selectedList.memberCount} members</Badge>
                </h3>
                {selectedList.description && <p className="text-xs text-slate-400 mt-0.5">{selectedList.description}</p>}
              </div>
              <button onClick={() => setSelectedList(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => openListDetails(selectedList, 1, e.target.value)}
                  placeholder="Search list members..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button variant="primary" size="sm" onClick={() => openAddContactsModal(1, '')} leftIcon={<UserPlus className="w-4 h-4" />}>
                Add Contacts to List
              </Button>
            </div>

            {/* Members Table */}
            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              {detailLoading ? (
                <div className="p-8">
                  <LoadingSpinner label="Loading list members..." />
                </div>
              ) : detailMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No contacts match current filter in this list.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Opt-in Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-white">{m.name}</td>
                        <td className="p-3 font-mono text-slate-300">{m.phone}</td>
                        <td className="p-3 text-slate-400">{m.email || '—'}</td>
                        <td className="p-3">
                          <Badge variant={m.optInStatus === 'OPTED_IN' ? 'success' : 'neutral'} size="sm">
                            {m.optInStatus}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleRemoveContact(m.id, m.name)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {detailTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span>Page {detailPage} of {detailTotalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={detailPage <= 1} onClick={() => openListDetails(selectedList, detailPage - 1, detailSearch)}>
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={detailPage >= detailTotalPages} onClick={() => openListDetails(selectedList, detailPage + 1, detailSearch)}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CONTACTS TO LIST MODAL */}
      {isAddContactsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">Add Contacts to '{selectedList?.name}'</h3>
              <button onClick={() => setIsAddContactsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => openAddContactsModal(1, e.target.value)}
                placeholder="Search Contacts database by name, phone, email..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              {addLoading ? (
                <div className="p-8">
                  <LoadingSpinner label="Loading Contacts database..." />
                </div>
              ) : availableContacts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No available contacts found.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3 w-10">Select</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Consent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {availableContacts.map((c) => {
                      const cid = String(c.id || (c as any)._id || '');
                      const isSelected = selectedContactIds.includes(cid);
                      return (
                        <tr key={cid} className="hover:bg-slate-800/40">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedContactIds(selectedContactIds.filter((id) => id !== cid));
                                } else {
                                  setSelectedContactIds([...selectedContactIds, cid]);
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3 font-semibold text-white">{c.name}</td>
                          <td className="p-3 font-mono text-slate-300">{c.phone}</td>
                          <td className="p-3 text-slate-400">{c.company || '—'}</td>
                          <td className="p-3">
                            <Badge variant={c.marketingOptIn === 'OPTED_IN' ? 'success' : 'neutral'} size="sm">
                              {c.marketingOptIn}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">{selectedContactIds.length} contacts selected</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddContactsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedContactIds.length === 0}
                  isLoading={isSubmittingAdd}
                  onClick={handleAddContactsSubmit}
                >
                  Add Selected to List
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
