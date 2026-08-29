export interface WhatsAppStatusInfo {
  configured: boolean;
  connected: boolean;
  phoneNumberIdConfigured: boolean;
  businessAccountIdConfigured: boolean;
  accessTokenConfigured: boolean;
  appSecretConfigured: boolean;
  verifyTokenConfigured: boolean;
  apiVersion: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  message?: string;
}

export interface WATemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  variables?: string[];
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

export interface WATemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: WATemplateComponent[];
  headerType?: string;
  bodyText?: string;
  footerText?: string;
  variables: string[];
}

export interface SendTestMessagePayload {
  recipientPhone: string;
  templateName: string;
  languageCode: string;
  variables?: Record<string, string>;
  headerConfig?: any;
}
