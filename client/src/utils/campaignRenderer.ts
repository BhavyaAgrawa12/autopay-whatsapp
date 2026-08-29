import { Contact } from '../types/contact';
import { VariableMapping, CampaignAudienceSelection } from '../types/campaign';

/**
 * Replaces template variables {{1}}, {{2}} with mapped contact properties or static campaign values.
 */
export function renderTemplateBody(
  bodyTemplateText: string,
  mappings: VariableMapping[],
  sampleContact?: Contact
): string {
  if (!bodyTemplateText) return '';

  let renderedText = bodyTemplateText;

  mappings.forEach((mapping) => {
    let value = '';

    if (mapping.mappingType === 'CONTACT_FIELD' && mapping.contactField) {
      const fieldKey = mapping.contactField;
      if (sampleContact) {
        // Standard fields check
        if (fieldKey === 'name') value = sampleContact.name || '';
        else if (fieldKey === 'phone') value = sampleContact.phone || '';
        else if (fieldKey === 'email') value = sampleContact.email || '';
        else if (fieldKey === 'company') value = sampleContact.company || '';
        else if (fieldKey === 'city') value = sampleContact.city || '';
        else if (fieldKey === 'service') value = sampleContact.service || '';
        // Custom fields check
        else if (sampleContact.customFields && sampleContact.customFields[fieldKey]) {
          value = sampleContact.customFields[fieldKey];
        }
      }

      if (!value) {
        value = `[${fieldKey}]`;
      }
    } else if (mapping.mappingType === 'STATIC_TEXT' && mapping.staticValue !== undefined) {
      value = mapping.staticValue;
    }

    // Replace all instances of variable key (e.g. {{1}})
    const key = mapping.variableKey.startsWith('{{') ? mapping.variableKey : `{{${mapping.variableKey}}}`;
    renderedText = renderedText.split(key).join(value || key);
  });

  return renderedText;
}

/**
 * Calculates audience eligibility stats based on contacts and selected IDs.
 * Rules:
 * - Eligible = Selected contacts that are NOT opted out.
 * - Excluded = Opted out contacts + Unknown consent contacts (Unknown is NOT treated as opted-in automatically).
 */
export function calculateAudienceStats(
  allContacts: Contact[],
  selectedIds: string[]
): CampaignAudienceSelection {
  const selectedSet = new Set(selectedIds);
  const selectedContacts = allContacts.filter((c) => selectedSet.has(c.id));

  const totalSelected = selectedContacts.length;

  const optedOutCount = selectedContacts.filter((c) => c.marketingOptIn === 'OPTED_OUT').length;
  const unknownConsentCount = selectedContacts.filter((c) => c.marketingOptIn === 'UNKNOWN').length;

  // Eligible contacts include OPTED_IN and default contacts (only explicitly OPTED_OUT contacts are excluded)
  const eligibleCount = selectedContacts.filter((c) => c.marketingOptIn !== 'OPTED_OUT').length;
  const excludedCount = optedOutCount;

  return {
    mode: 'CUSTOM',
    selectedContactIds: Array.from(selectedSet),
    totalSelected,
    eligibleCount,
    excludedCount,
    optedOutCount,
    unknownConsentCount,
  };
}
