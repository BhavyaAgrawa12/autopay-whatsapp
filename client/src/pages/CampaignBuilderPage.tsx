import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send,
  Users,
  FileCode2,
  Sliders,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  Upload,
  Info,
  Search,
  FolderOpen,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { useContacts } from '../context/ContactContext';
import { useCampaigns } from '../context/CampaignContext';
import { fetchTemplatesApi, sendTestMessageApi } from '../api/whatsapp';
import { fetchContactsApi } from '../api/contacts';
import { fetchContactListsApi, fetchContactListDetailsApi, ContactListSummary } from '../api/contactLists';
import { Contact } from '../types/contact';
import { WATemplate } from '../types/whatsapp';
import { CompanyAssetRecord } from '../types/company';
import { Campaign, HeaderConfig, VariableMapping, CampaignStatus } from '../types/campaign';
import { renderTemplateBody, calculateAudienceStats } from '../utils/campaignRenderer';
import { AssetPickerModal } from '../components/campaigns/AssetPickerModal';
import { WhatsAppPhonePreview } from '../components/campaigns/WhatsAppPhonePreview';
import { CampaignStartModal } from '../components/campaigns/CampaignStartModal';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const CampaignBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { contacts: sessionContacts, selectedContactIds } = useContacts();
  const { saveCampaign, getCampaignById } = useCampaigns();

  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form States
  const [campaignName, setCampaignName] = useState('');
  const [maxMessagesPerHour, setMaxMessagesPerHour] = useState<number>(100);
  const [selectedTemplate, setSelectedTemplate] = useState<WATemplate | null>(null);
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Header & Variable Config
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({ format: 'NONE' });
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);

  // Selected Audience IDs
  const [audienceIds, setAudienceIds] = useState<string[]>([]);

  // Modals & Testing State
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [sampleContactId, setSampleContactId] = useState<string>('');
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load existing campaign if editing
  useEffect(() => {
    if (id) {
      const existing = getCampaignById(id);
      if (existing) {
        setCampaignName(existing.name);
        setMaxMessagesPerHour(existing.maxMessagesPerHour || 100);
        setHeaderConfig(existing.headerConfig);
        setVariableMappings(existing.variableMappings);
        setAudienceIds(existing.audience.selectedContactIds);
      }
    } else {
      // Default to selected contacts from Phase 3
      setAudienceIds(Array.from(selectedContactIds));
    }
  }, [id]);

  // Load templates from Phase 5 API
  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const tpls = await fetchTemplatesApi();
        setTemplates(tpls);
        if (id) {
          const existing = getCampaignById(id);
          if (existing) {
            const match = tpls.find((t) => t.name === existing.templateName);
            if (match) setSelectedTemplate(match);
          }
        }
      } catch {
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  // Database Audience & Contact Lists State
  const [dbContacts, setDbContacts] = useState<Contact[]>([]);
  const [availableLists, setAvailableLists] = useState<ContactListSummary[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [loadingAudience, setLoadingAudience] = useState<boolean>(false);
  const [audienceSearch, setAudienceSearch] = useState<string>('');

  // Fetch Database Contacts & Contact Lists from API
  useEffect(() => {
    const loadAudienceData = async () => {
      setLoadingAudience(true);
      try {
        const [ctsRes, lists] = await Promise.all([
          fetchContactsApi({ limit: 1000 }).catch(() => ({ contacts: [] })),
          fetchContactListsApi().catch(() => []),
        ]);
        setDbContacts(ctsRes.contacts || []);
        setAvailableLists(lists || []);
      } catch (err) {
        console.error('Failed to load audience data', err);
      } finally {
        setLoadingAudience(false);
      }
    };
    loadAudienceData();
  }, []);

  // Merge Session Contacts with DB Contacts
  const allAvailableContacts = useMemo(() => {
    const map = new Map<string, Contact>();
    sessionContacts.forEach((c) => map.set(c.id, c));
    dbContacts.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [sessionContacts, dbContacts]);

  // Audience Stats calculation
  const audienceStats = useMemo(() => {
    return calculateAudienceStats(allAvailableContacts, audienceIds);
  }, [allAvailableContacts, audienceIds]);

  // Toggle Contact List selection
  const handleToggleList = async (listId: string) => {
    try {
      const isSelected = selectedListIds.includes(listId);
      const nextListIds = isSelected
        ? selectedListIds.filter((l) => l !== listId)
        : [...selectedListIds, listId];

      setSelectedListIds(nextListIds);

      const newContactIds = new Set<string>(audienceIds);
      if (!isSelected) {
        const details = await fetchContactListDetailsApi(listId, { limit: 1000 });
        (details.contacts || []).forEach((m) => newContactIds.add(m.id));
      } else {
        const details = await fetchContactListDetailsApi(listId, { limit: 1000 });
        const listMemberIds = new Set((details.contacts || []).map((m) => m.id));
        listMemberIds.forEach((mid) => newContactIds.delete(mid));
      }
      setAudienceIds(Array.from(newContactIds));
    } catch (err) {
      console.error('Failed to toggle contact list selection', err);
    }
  };

  // Auto-detect template parameters when template selected
  const handleSelectTemplate = (tpl: WATemplate) => {
    setSelectedTemplate(tpl);

    // 1. Header setup
    let format: HeaderConfig['format'] = 'NONE';
    if (tpl.headerType === 'IMAGE') format = 'IMAGE';
    else if (tpl.headerType === 'VIDEO') format = 'VIDEO';
    else if (tpl.headerType === 'DOCUMENT') format = 'DOCUMENT';
    else if (tpl.headerType === 'TEXT') format = 'TEXT';

    setHeaderConfig({ format });

    // 2. Body variables setup {{1}}, {{2}}
    const mappings: VariableMapping[] = (tpl.variables || []).map((vKey) => ({
      variableKey: vKey,
      mappingType: 'CONTACT_FIELD',
      contactField: 'name',
    }));
    setVariableMappings(mappings);
  };

  // Sample contact for preview
  const sampleContact = useMemo(() => {
    if (sampleContactId) {
      return sessionContacts.find((c) => c.id === sampleContactId);
    }
    return sessionContacts[0];
  }, [sessionContacts, sampleContactId]);

  // Rendered Body Text preview
  const renderedBodyText = useMemo(() => {
    if (!selectedTemplate) return '';
    return renderTemplateBody(selectedTemplate.bodyText || '', variableMappings, sampleContact);
  }, [selectedTemplate, variableMappings, sampleContact]);

  // Extract unique custom field keys for variable dropdown
  const contactFieldsOptions = useMemo(() => {
    const standard = [
      { key: 'name', label: 'Full Name (Contact)' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'company', label: 'Company Name' },
      { key: 'city', label: 'City' },
      { key: 'service', label: 'Service / Requirement' },
    ];

    const customKeys = new Set<string>();
    sessionContacts.forEach((c) => {
      if (c.customFields) Object.keys(c.customFields).forEach((k) => customKeys.add(k));
    });

    const customOptions = Array.from(customKeys).map((k) => ({
      key: k,
      label: `Custom Excel Field: ${k}`,
    }));

    return [...standard, ...customOptions];
  }, [sessionContacts]);

  // Step Progression Validation
  const validateCurrentStep = (): boolean => {
    setValidationError(null);

    if (currentStep === 1) {
      if (!campaignName.trim()) {
        setValidationError('Please enter a descriptive campaign name.');
        return false;
      }
    }

    if (currentStep === 2) {
      if (audienceStats.totalSelected === 0) {
        setValidationError('Please select at least one contact for the campaign audience.');
        return false;
      }
      if (audienceStats.eligibleCount === 0) {
        setValidationError('No eligible contacts selected (all selected records are opted-out).');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!selectedTemplate) {
        setValidationError('Please select an approved WhatsApp message template.');
        return false;
      }
    }

    if (currentStep === 4) {
      if (headerConfig.format !== 'NONE' && headerConfig.format !== 'TEXT' && !headerConfig.assetUrl) {
        setValidationError(`Please select a compatible ${headerConfig.format} asset from Company Assets.`);
        return false;
      }
      for (const m of variableMappings) {
        if (m.mappingType === 'STATIC_TEXT' && (!m.staticValue || !m.staticValue.trim())) {
          setValidationError(`Please provide a static text value for variable ${m.variableKey}.`);
          return false;
        }
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(7, prev + 1) as Step);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  };

  // Build Campaign Object
  const buildCampaignObject = (status: CampaignStatus = 'DRAFT'): Campaign => {
    return {
      id: id || `campaign-${Date.now()}`,
      name: campaignName.trim(),
      templateName: selectedTemplate?.name || '',
      templateLanguage: selectedTemplate?.language || 'en',
      templateCategory: selectedTemplate?.category || 'MARKETING',
      templateStatus: selectedTemplate?.status || 'APPROVED',
      templateComponents: selectedTemplate?.components || [],
      headerConfig,
      variableMappings,
      audience: audienceStats,
      status,
      maxMessagesPerHour,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      setValidationError('Campaign name is required to save draft.');
      return;
    }
    const campaign = buildCampaignObject('DRAFT');
    await saveCampaign(campaign);
    setStatusMessage('Campaign draft saved successfully in database.');
    setTimeout(() => navigate('/campaigns'), 1200);
  };

  const handleMarkReady = async () => {
    if (!validateCurrentStep()) return;
    const campaign = buildCampaignObject('READY');
    await saveCampaign(campaign);
    setStatusMessage('Campaign marked as READY for dispatching.');
    setTimeout(() => navigate('/campaigns'), 1200);
  };

  // Send Single Test Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      setValidationError('Please enter a test recipient phone number.');
      return;
    }
    if (!selectedTemplate) return;

    setIsSendingTest(true);
    setTestResult(null);
    setValidationError(null);

    // Build variable values object
    const varValues: Record<string, string> = {};
    variableMappings.forEach((m) => {
      let val = '';
      if (m.mappingType === 'CONTACT_FIELD' && m.contactField && sampleContact) {
        val = (sampleContact as any)[m.contactField] || sampleContact.customFields?.[m.contactField] || '';
      } else if (m.mappingType === 'STATIC_TEXT') {
        val = m.staticValue || '';
      }
      varValues[m.variableKey] = val || `TestVal`;
    });

    try {
      const res = await sendTestMessageApi({
        recipientPhone: testPhone.trim(),
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        variables: varValues,
        headerConfig,
      });

      setTestResult({
        success: true,
        message: `Test message sent successfully! Message ID: ${res.messageId}`,
      });

      // Update campaign status to TESTED
      const campaign = buildCampaignObject('TESTED');
      saveCampaign(campaign);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test message.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={id ? 'Edit Campaign' : 'Create Promotional Campaign'}
        description="Configure target audience, Meta template variables, and live WhatsApp preview."
        badge={<Badge variant="info">Phase 6 Builder</Badge>}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveDraft} leftIcon={<Save className="w-4 h-4" />}>
              Save Draft
            </Button>
          </div>
        }
      />

      {validationError && <ErrorAlert message={validationError} />}

      {statusMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {statusMessage}
        </div>
      )}

      {/* Step Wizard Progress Header */}
      <div className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        {[
          { num: 1, label: 'Details' },
          { num: 2, label: 'Audience' },
          { num: 3, label: 'Template' },
          { num: 4, label: 'Configuration' },
          { num: 5, label: 'Preview' },
          { num: 6, label: 'Test' },
          { num: 7, label: 'Review' },
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => setCurrentStep(s.num as Step)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              currentStep === s.num
                ? 'bg-emerald-600 text-white font-bold'
                : currentStep > s.num
                ? 'bg-slate-800 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-slate-950/40 flex items-center justify-center text-[10px]">
              {s.num}
            </span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Main Split Layout: Left Config / Right WhatsApp Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Panel */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: CAMPAIGN DETAILS */}
          {currentStep === 1 && (
            <Card className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Step 1: Campaign Details</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Festive Retailer Offer 2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Internal campaign identifier for reporting and tracking.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    Max Sending Rate (Messages / Hour)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxMessagesPerHour}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) setMaxMessagesPerHour(100);
                        else setMaxMessagesPerHour(Math.max(1, Math.min(100, val)));
                      }}
                      className="w-32 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">
                      Messages/hour (Default: 100 max rate, Min: 1, Max: 100)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Application-level queue sending throttle. Safety capped at maximum 100 messages/hour.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 2: AUDIENCE SELECTION */}
          {currentStep === 2 && (
            <Card className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Step 2: Target Audience Selection</h3>
                </div>
                <Badge variant="info">Total Available Contacts ({allAvailableContacts.length})</Badge>
              </div>

              {/* Audience Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block font-medium">Selected</span>
                  <span className="text-xl font-bold text-white">{audienceStats.totalSelected}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-emerald-800/40">
                  <span className="text-slate-400 block font-medium">Eligible</span>
                  <span className="text-xl font-bold text-emerald-400">{audienceStats.eligibleCount}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-rose-800/40">
                  <span className="text-slate-400 block font-medium">Opted Out</span>
                  <span className="text-xl font-bold text-rose-400">{audienceStats.optedOutCount}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-amber-800/40">
                  <span className="text-slate-400 block font-medium">Unknown Consent</span>
                  <span className="text-xl font-bold text-amber-400">{audienceStats.unknownConsentCount}</span>
                </div>
              </div>

              {/* Excluded Warning Card */}
              {audienceStats.excludedCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-3 text-xs text-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-100 mb-0.5">Audience Consent Warning</span>
                    <span>
                      {audienceStats.excludedCount} selected records are excluded ({audienceStats.optedOutCount} opted-out, {audienceStats.unknownConsentCount} unknown consent). Unknown consent is NOT automatically treated as opted-in.
                    </span>
                  </div>
                </div>
              )}

              {/* SECTION A: SAVED CONTACT LISTS (SEGMENTS) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                    Select Target Contact Lists (Segments)
                  </h4>
                </div>

                {availableLists.length === 0 ? (
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400">
                    No custom contact lists created yet. You can create segments under <b>Contact Lists</b> page.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableLists.map((list) => {
                      const isSelected = selectedListIds.includes(list.id);
                      return (
                        <div
                          key={list.id}
                          onClick={() => handleToggleList(list.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'bg-emerald-950/30 border-emerald-500 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-1 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-white text-xs truncate">{list.name}</h5>
                              <Badge variant="neutral" size="sm">{list.memberCount} contacts</Badge>
                            </div>
                            {list.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{list.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION B: QUICK SELECTION ACTIONS & INDIVIDUAL CONTACT TABLE */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={audienceSearch}
                      onChange={(e) => setAudienceSearch(e.target.value)}
                      placeholder="Search contacts by name, phone, or company..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAudienceIds(allAvailableContacts.map((c) => c.id))}
                    >
                      Select All ({allAvailableContacts.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAudienceIds([]);
                        setSelectedListIds([]);
                      }}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                {/* Individual Contacts Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-slate-950">
                  {loadingAudience ? (
                    <div className="p-6">
                      <LoadingSpinner label="Loading contacts database..." />
                    </div>
                  ) : allAvailableContacts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No contacts found in database or session. Import contacts under <b>Contacts</b> page to select target recipients.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold">
                        <tr>
                          <th className="p-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={audienceIds.length === allAvailableContacts.length && allAvailableContacts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setAudienceIds(allAvailableContacts.map((c) => c.id));
                                else {
                                  setAudienceIds([]);
                                  setSelectedListIds([]);
                                }
                              }}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                            />
                          </th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Phone</th>
                          <th className="p-2.5">Company</th>
                          <th className="p-2.5 text-right">Opt-In Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {allAvailableContacts
                          .filter((c) => {
                            if (!audienceSearch.trim()) return true;
                            const q = audienceSearch.toLowerCase();
                            return (
                              (c.name && c.name.toLowerCase().includes(q)) ||
                              (c.phone && c.phone.includes(q)) ||
                              (c.company && c.company.toLowerCase().includes(q))
                            );
                          })
                          .map((contact) => {
                            const isSelected = audienceIds.includes(contact.id);
                            return (
                              <tr
                                key={contact.id}
                                onClick={() => {
                                  setAudienceIds((prev) =>
                                    isSelected ? prev.filter((i) => i !== contact.id) : [...prev, contact.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors hover:bg-slate-900/60 ${
                                  isSelected ? 'bg-emerald-950/20' : ''
                                }`}
                              >
                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setAudienceIds((prev) =>
                                        isSelected ? prev.filter((i) => i !== contact.id) : [...prev, contact.id]
                                      );
                                    }}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                  />
                                </td>
                                <td className="p-2.5 font-medium text-white">{contact.name || 'Unnamed'}</td>
                                <td className="p-2.5 font-mono text-slate-300">{contact.phone}</td>
                                <td className="p-2.5 text-slate-400">{contact.company || '-'}</td>
                                <td className="p-2.5 text-right">
                                  <Badge
                                    variant={
                                      contact.marketingOptIn === 'OPTED_IN'
                                        ? 'success'
                                        : contact.marketingOptIn === 'OPTED_OUT'
                                        ? 'error'
                                        : 'warning'
                                    }
                                    size="sm"
                                  >
                                    {contact.marketingOptIn || 'UNKNOWN'}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* STEP 3: TEMPLATE SELECTION */}
          {currentStep === 3 && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <FileCode2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Step 3: Select WhatsApp Template</h3>
                </div>
              </div>

              {loadingTemplates ? (
                <LoadingSpinner label="Fetching approved templates from Meta API..." />
              ) : templates.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-2">
                  <FileCode2 className="w-10 h-10 text-slate-500 mx-auto" />
                  <h4 className="font-bold text-white text-sm">No WhatsApp Templates Available</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Possible reasons: WhatsApp API credentials missing, or templates still under review in Meta.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id || tpl.name}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedTemplate?.name === tpl.name
                          ? 'bg-emerald-950/30 border-emerald-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm font-mono">{tpl.name}</h4>
                          <Badge variant="success" size="sm">{tpl.status}</Badge>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{tpl.language}</span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{tpl.bodyText}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* STEP 4: MESSAGE CONFIGURATION */}
          {currentStep === 4 && selectedTemplate && (
            <Card className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Step 4: Configure Header & Body Variables</h3>
              </div>

              {/* Dynamic Header Config */}
              {headerConfig.format !== 'NONE' && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      Header Component Format: <code className="text-emerald-400">{headerConfig.format}</code>
                    </span>
                    {headerConfig.format !== 'TEXT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAssetPickerOpen(true)}
                        leftIcon={<Upload className="w-4 h-4" />}
                      >
                        Choose from Company Assets
                      </Button>
                    )}
                  </div>

                  {headerConfig.format === 'TEXT' && (
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Header Text</label>
                      <input
                        type="text"
                        value={headerConfig.textValue || ''}
                        onChange={(e) => setHeaderConfig({ ...headerConfig, textValue: e.target.value })}
                        placeholder="Header Title"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  {headerConfig.assetFilename && (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="font-semibold text-emerald-400">{headerConfig.assetFilename}</span>
                      <Badge variant="success">Media Selected</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Body Read-Only Rule Notice */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Approved Template Body Text:</strong> Meta approved text cannot be freely modified. Configure parameter values below for placeholders.
                </span>
              </div>

              {/* Variable Mapping Section */}
              {variableMappings.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                    Configure Template Variables ({variableMappings.length})
                  </h4>

                  {variableMappings.map((mapping, idx) => (
                    <div key={mapping.variableKey} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          Variable {mapping.variableKey}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`type-${idx}`}
                              checked={mapping.mappingType === 'CONTACT_FIELD'}
                              onChange={() => {
                                const next = [...variableMappings];
                                next[idx].mappingType = 'CONTACT_FIELD';
                                setVariableMappings(next);
                              }}
                            />
                            <span>Contact Field</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`type-${idx}`}
                              checked={mapping.mappingType === 'STATIC_TEXT'}
                              onChange={() => {
                                const next = [...variableMappings];
                                next[idx].mappingType = 'STATIC_TEXT';
                                setVariableMappings(next);
                              }}
                            />
                            <span>Static Text</span>
                          </label>
                        </div>
                      </div>

                      {mapping.mappingType === 'CONTACT_FIELD' ? (
                        <div>
                          <label className="block text-slate-400 mb-1">Map to Contact Property</label>
                          <select
                            value={mapping.contactField || 'name'}
                            onChange={(e) => {
                              const next = [...variableMappings];
                              next[idx].contactField = e.target.value;
                              setVariableMappings(next);
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                          >
                            {contactFieldsOptions.map((opt) => (
                              <option key={opt.key} value={opt.key}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-slate-400 mb-1">Static Campaign Text</label>
                          <input
                            type="text"
                            value={mapping.staticValue || ''}
                            onChange={(e) => {
                              const next = [...variableMappings];
                              next[idx].staticValue = e.target.value;
                              setVariableMappings(next);
                            }}
                            placeholder="e.g. Special festive discount offer"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* STEP 5: PREVIEW */}
          {currentStep === 5 && (
            <Card className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Step 5: Live Campaign Summary</h3>
                </div>
              </div>

              {/* Sample Contact Selector */}
              {sessionContacts.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Select Sample Contact for Rendered Preview
                  </label>
                  <select
                    value={sampleContactId}
                    onChange={(e) => setSampleContactId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {sessionContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.phone} ({c.company || 'No Company'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Campaign Name:</span>
                  <span className="font-bold text-white">{campaignName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Template Name:</span>
                  <span className="font-bold text-emerald-400">{selectedTemplate?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Eligible Recipients:</span>
                  <span className="font-bold text-emerald-400">{audienceStats.eligibleCount} contacts</span>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 6: TEST MESSAGE */}
          {currentStep === 6 && (
            <Card className="space-y-4 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <Send className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Step 6: Send Single Test Message</h3>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200">
                <span className="font-bold block mb-1">Single Test Message Dispatch</span>
                <span>Send ONE real WhatsApp test message to verify template parameter rendering and media delivery.</span>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border font-semibold ${testResult.success ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' : 'bg-rose-950/60 border-rose-800/60 text-rose-300'}`}>
                  {testResult.message}
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Test Phone Number *</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSendingTest}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Single Test Message
                </Button>
              </form>
            </Card>
          )}

          {/* STEP 7: FINAL REVIEW */}
          {currentStep === 7 && (
            <Card className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Step 7: Final Campaign Review</h3>
                </div>
                <Badge variant="success">Validation Passed ✓</Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Campaign Summary:</span>
                  <p className="text-white font-semibold">{campaignName}</p>
                  <p className="text-emerald-400">Template: {selectedTemplate?.name} ({selectedTemplate?.language})</p>
                  <p className="text-slate-300">Target Audience: {audienceStats.eligibleCount} eligible contacts</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={handleSaveDraft} leftIcon={<Save className="w-4 h-4" />}>
                    Save Draft
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleMarkReady} leftIcon={<Check className="w-4 h-4" />}>
                    Mark Ready
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsStartModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    leftIcon={<Send className="w-4 h-4" />}
                  >
                    START BULK CAMPAIGN
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentStep === 1}
              onClick={handlePrevStep}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous Step
            </Button>
            {currentStep < 7 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNextStep}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Next Step
              </Button>
            )}
          </div>
        </div>

        {/* Right Panel: Live WhatsApp Phone Simulator */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-20">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block text-center">
              Live WhatsApp Phone Preview
            </span>
            <WhatsAppPhonePreview
              headerConfig={headerConfig}
              renderedBodyText={renderedBodyText}
              components={selectedTemplate?.components || []}
            />
          </div>
        </div>
      </div>

      {/* Asset Picker Modal Component */}
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        headerFormat={
          headerConfig.format === 'IMAGE'
            ? 'IMAGE'
            : headerConfig.format === 'VIDEO'
            ? 'VIDEO'
            : 'DOCUMENT'
        }
        onSelectAsset={(asset: CompanyAssetRecord) => {
          const targetAssetId = asset.id || (asset as any).assetId || (asset as any)._id;
          setHeaderConfig({
            ...headerConfig,
            assetId: targetAssetId,
            assetUrl: asset.relativePath,
            assetFilename: asset.originalFilename,
          });
        }}
      />

      {/* Start Bulk Campaign Confirmation Modal */}
      <CampaignStartModal
        campaign={buildCampaignObject('READY')}
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onSuccess={() => navigate('/campaigns')}
      />
    </div>
  );
};
