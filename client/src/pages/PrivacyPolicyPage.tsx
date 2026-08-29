import React from 'react';
import { ShieldCheck, Lock, Building2, Mail } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 border-b border-slate-800 pb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Autopay Tech • WhatsApp Marketing & Promotional Messaging Platform</p>
          <span className="inline-block text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full">
            Last Updated: August 29, 2026
          </span>
        </div>

        {/* Content Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-xs text-slate-300 leading-relaxed shadow-2xl">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Lock className="w-4 h-4" /> 1. Overview & Scope
            </h2>
            <p>
              This Privacy Policy explains how <strong>Autopay Tech</strong> ("we", "us", or "our") collects, uses, stores, and protects information when you utilize our WhatsApp Marketing Console and Meta WhatsApp Cloud API promotional campaign platform.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              2. Information We Process
            </h2>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300">
              <li><strong>Contact Information:</strong> Phone numbers, recipient names, and custom variables uploaded explicitly by account administrators for broadcast campaign execution.</li>
              <li><strong>Campaign Data:</strong> Broadcast logs, message delivery statuses (Sent, Delivered, Read, Failed), and engagement statistics.</li>
              <li><strong>Company Assets:</strong> Promotional media (images, videos, audio notes, document assets, and logos) uploaded for WhatsApp template headers.</li>
            </ul>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              3. Use of Meta WhatsApp Cloud API & Webhooks
            </h2>
            <p>
              Our platform integrates directly with official Meta Graph API endpoints. Webhook callback notifications (X-Hub-Signature-256 verified) are processed strictly to track real-time delivery rates, read checkmarks, and opt-out preferences. We do not sell or monetize recipient phone numbers or message content to third parties.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              4. Opt-Out & User Consent
            </h2>
            <p>
              All promotional broadcasts are conducted in accordance with Meta WhatsApp Commerce Policies. Recipients can opt out of promotional messages at any time by replying STOP or requesting removal from official contact lists.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              5. Data Security & Storage
            </h2>
            <p>
              Data is stored securely using encrypted MongoDB Atlas databases and HTTPS TLS 1.3 endpoints. Access to administrative controls requires authenticated JSON Web Tokens (JWT).
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> 6. Contact Us
            </h2>
            <p>
              If you have questions regarding this Privacy Policy or data processing practices, please contact us at:
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-300 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>contact@autopaytech.com</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          © 2026 Autopay Tech. All rights reserved. • WhatsApp Marketing Console
        </div>
      </div>
    </div>
  );
};
