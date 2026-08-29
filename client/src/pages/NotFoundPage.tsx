import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
        <FileQuestion className="w-8 h-8 text-emerald-400" />
      </div>
      <h1 className="text-3xl font-extrabold text-white mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        The requested page does not exist in the WhatsApp Promotional Campaign Management System.
      </p>
      <NavLink to="/">
        <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Dashboard
        </Button>
      </NavLink>
    </div>
  );
};
