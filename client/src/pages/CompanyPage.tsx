import React, { useEffect, useState } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  Plus,
  Edit2,
  CheckCircle2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Linkedin,
  Twitter,
  ShieldCheck,
  Save,
  Briefcase,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { CompanyProfile, CompanyServiceItem } from '../types/company';
import {
  fetchCompanyProfileApi,
  updateCompanyProfileApi,
  uploadCompanyLogoApi,
  removeCompanyLogoApi,
  addCompanyServiceApi,
  updateCompanyServiceApi,
  deleteCompanyServiceApi,
} from '../api/company';

export const CompanyPage: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Form state
  const [formData, setFormData] = useState({
    companyName: '',
    description: '',
    website: '',
    phone: '',
    email: '',
    address: '',
    linkedin: '',
    twitter: '',
    facebook: '',
    instagram: '',
  });

  // Services state & modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<CompanyServiceItem | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceActive, setServiceActive] = useState(true);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanyProfileApi();
      setProfile(data);
      setFormData({
        companyName: data.companyName || '',
        description: data.description || '',
        website: data.website || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        linkedin: data.socialLinks?.linkedin || '',
        twitter: data.socialLinks?.twitter || '',
        facebook: data.socialLinks?.facebook || '',
        instagram: data.socialLinks?.instagram || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const updated = await updateCompanyProfileApi({
        companyName: formData.companyName,
        description: formData.description,
        website: formData.website,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        socialLinks: {
          linkedin: formData.linkedin,
          twitter: formData.twitter,
          facebook: formData.facebook,
          instagram: formData.instagram,
        },
      });
      setProfile(updated);
      setSuccessMessage('Company profile updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update company profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setError(null);

    try {
      const res = await uploadCompanyLogoApi(file);
      setProfile(res.profile);
      setSuccessMessage('Company logo uploaded successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo.');
    }
  };

  const handleLogoRemove = async () => {
    setError(null);
    try {
      const updated = await removeCompanyLogoApi();
      setProfile(updated);
      setSuccessMessage('Company logo removed.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove logo.');
    }
  };

  // Service Handlers
  const handleOpenAddService = () => {
    setEditingService(null);
    setServiceName('');
    setServiceDesc('');
    setServiceActive(true);
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (service: CompanyServiceItem) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceDesc(service.description);
    setServiceActive(service.isActive);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) return;

    try {
      if (editingService) {
        await updateCompanyServiceApi(editingService.id, {
          name: serviceName,
          description: serviceDesc,
          isActive: serviceActive,
        });
      } else {
        await addCompanyServiceApi({
          name: serviceName,
          description: serviceDesc,
        });
      }
      setIsServiceModalOpen(false);
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to save service.');
    }
  };

  const handleToggleServiceActive = async (service: CompanyServiceItem) => {
    try {
      await updateCompanyServiceApi(service.id, { isActive: !service.isActive });
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to update service state.');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company service?')) return;
    try {
      await deleteCompanyServiceApi(id);
      await loadProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to delete service.');
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading company configuration..." />;
  }

  return (
    <div>
      <PageHeader
        title="Company Profile & Services"
        description="Manage single organization profile details, official logo, and offerings."
        badge={<Badge variant="success">Verified Organization</Badge>}
      />

      {error && <ErrorAlert message={error} />}

      {successMessage && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Company Profile Form */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-800">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-base">Company Organization Details</h3>
              <p className="text-xs text-slate-400">Primary business information used in campaign templates</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Website URL</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Official Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Official Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Office Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Social Media Profiles</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Linkedin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="url"
                    placeholder="LinkedIn URL"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="relative">
                  <Twitter className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="url"
                    placeholder="Twitter URL"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
                Save Profile Changes
              </Button>
            </div>
          </form>
        </Card>

        {/* Company Logo Card */}
        <Card variant="glass" className="border-emerald-800/40 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-white font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Official Company Logo
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
            {profile?.logoUrl ? (
              <div className="relative group mb-4">
                <img
                  src={profile.logoUrl}
                  alt="Company Logo"
                  className="w-32 h-32 object-contain rounded-xl bg-slate-900 border border-slate-700 p-2 shadow-lg"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-xl bg-slate-900 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 mb-4">
                <Building2 className="w-10 h-10 mb-1" />
                <span className="text-[11px]">No Logo Set</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                  {profile?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                </Button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </label>
              {profile?.logoUrl && (
                <Button variant="danger" size="sm" onClick={handleLogoRemove} leftIcon={<Trash2 className="w-4 h-4" />}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Supported: JPG, PNG, WEBP, SVG (Max 10MB)
            </p>
          </div>
        </Card>
      </div>

      {/* Services Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              Company Services Directory
            </h3>
            <p className="text-xs text-slate-400">Offerings enabled for WhatsApp campaign categorization</p>
          </div>
          <Button variant="primary" size="sm" onClick={handleOpenAddService} leftIcon={<Plus className="w-4 h-4" />}>
            Add New Service
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {profile?.services.map((service) => (
            <Card key={service.id} variant="bordered" className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white text-sm">{service.name}</h4>
                  <button onClick={() => handleToggleServiceActive(service)} title="Toggle active status">
                    {service.isActive ? (
                      <Badge variant="success" size="sm">Active</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Inactive</Badge>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{service.description || 'No description provided.'}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEditService(service)}
                  leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteService(service.id)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">
                {editingService ? 'Edit Company Service' : 'Add New Service'}
              </h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Mobile App Development"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                  placeholder="Short summary of service offering"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-300">Active Service Status</span>
                <button
                  type="button"
                  onClick={() => setServiceActive(!serviceActive)}
                  className="text-emerald-400 font-semibold flex items-center gap-1.5"
                >
                  {serviceActive ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6 text-slate-600" />}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsServiceModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {editingService ? 'Save Changes' : 'Create Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
