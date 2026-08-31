import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ServerWakeGateway } from './components/ui/ServerWakeGateway';
import { AuthProvider } from './context/AuthContext';
import { ContactProvider } from './context/ContactContext';
import { CampaignProvider } from './context/CampaignContext';
import { AppRoutes } from './routes/AppRoutes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ServerWakeGateway>
        <AuthProvider>
          <ContactProvider>
            <CampaignProvider>
              <AppRoutes />
            </CampaignProvider>
          </ContactProvider>
        </AuthProvider>
      </ServerWakeGateway>
    </BrowserRouter>
  );
};

export default App;

