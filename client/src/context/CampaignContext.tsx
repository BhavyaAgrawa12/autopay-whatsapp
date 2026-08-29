import React, { createContext, useContext, useState, useEffect } from 'react';
import { Campaign, CampaignStatus } from '../types/campaign';
import { fetchCampaignsApi, saveCampaignApi, deleteCampaignApi } from '../api/campaigns';

interface CampaignContextType {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  loadCampaigns: () => Promise<void>;
  saveCampaign: (campaign: Partial<Campaign>) => Promise<Campaign>;
  updateCampaignStatus: (id: string, status: CampaignStatus) => Promise<void>;
  duplicateCampaign: (id: string) => Promise<Campaign | null>;
  deleteCampaign: (id: string) => Promise<void>;
  getCampaignById: (id: string) => Campaign | undefined;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export const CampaignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaignsApi();
      setCampaigns(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns from database');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const saveCampaign = async (campaignData: Partial<Campaign>): Promise<Campaign> => {
    try {
      const saved = await saveCampaignApi(campaignData);
      await loadCampaigns();
      return saved;
    } catch (err: any) {
      setError(err.message || 'Failed to save campaign');
      throw err;
    }
  };

  const updateCampaignStatus = async (id: string, status: CampaignStatus) => {
    const existing = campaigns.find((c) => c.id === id || (c as any).campaignId === id);
    if (!existing) return;
    await saveCampaign({ ...existing, status });
  };

  const duplicateCampaign = async (id: string): Promise<Campaign | null> => {
    const existing = campaigns.find((c) => c.id === id || (c as any).campaignId === id);
    if (!existing) return null;

    const duplicatedData: Partial<Campaign> = {
      ...existing,
      id: `campaign-${Date.now()}`,
      name: `Copy of ${existing.name}`,
      status: 'DRAFT',
    };

    const saved = await saveCampaignApi(duplicatedData);
    await loadCampaigns();
    return saved;
  };

  const deleteCampaign = async (id: string) => {
    try {
      await deleteCampaignApi(id);
      await loadCampaigns();
    } catch (err: any) {
      setError(err.message || 'Failed to delete campaign');
      throw err;
    }
  };

  const getCampaignById = (id: string): Campaign | undefined => {
    return campaigns.find((c) => c.id === id || (c as any).campaignId === id);
  };

  return (
    <CampaignContext.Provider
      value={{
        campaigns,
        loading,
        error,
        loadCampaigns,
        saveCampaign,
        updateCampaignStatus,
        duplicateCampaign,
        deleteCampaign,
        getCampaignById,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaigns = (): CampaignContextType => {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaigns must be used within a CampaignProvider');
  }
  return context;
};
