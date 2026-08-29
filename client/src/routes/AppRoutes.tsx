import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/routes/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ContactsPage } from '../pages/ContactsPage';
import { ContactListsPage } from '../pages/ContactListsPage';
import { CampaignsPage } from '../pages/CampaignsPage';
import { CampaignBuilderPage } from '../pages/CampaignBuilderPage';
import { TemplatesPage } from '../pages/TemplatesPage';
import { CompanyPage } from '../pages/CompanyPage';
import { CompanyAssetsPage } from '../pages/CompanyAssetsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Checking session..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      {/* Protected Console App Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contact-lists" element={<ContactListsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/new" element={<CampaignBuilderPage />} />
        <Route path="campaigns/edit/:id" element={<CampaignBuilderPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="company-assets" element={<CompanyAssetsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Direct fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
