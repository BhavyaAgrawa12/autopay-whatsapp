import { WATemplateComponent } from './whatsapp';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY'
  | 'TESTED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'INTERRUPTED';

export type VariableMappingType = 'CONTACT_FIELD' | 'STATIC_TEXT';

export interface VariableMapping {
  variableKey: string; // e.g. "{{1}}"
  mappingType: VariableMappingType;
  contactField?: string; // e.g. "name", "company", "city", or custom field name
  staticValue?: string;
}

export interface HeaderConfig {
  format: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  textValue?: string;
  assetId?: string;
  assetUrl?: string;
  assetFilename?: string;
}

export interface CampaignAudienceSelection {
  mode: 'ALL_VALID' | 'FILTERED' | 'CUSTOM';
  selectedContactIds: string[];
  totalSelected: number;
  eligibleCount: number;
  excludedCount: number;
  optedOutCount: number;
  unknownConsentCount: number;
}

export interface Campaign {
  id: string;
  campaignId?: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  templateCategory: string;
  templateStatus: string;
  templateComponents: WATemplateComponent[];
  headerConfig: HeaderConfig;
  variableMappings: VariableMapping[];
  audience: CampaignAudienceSelection;
  status: CampaignStatus;
  maxMessagesPerHour?: number;
  pauseReason?: string;
  rateLimitCooldownUntil?: string;
  createdAt: string;
  updatedAt: string;
  testedAt?: string;
  testRecipientPhone?: string;
}
