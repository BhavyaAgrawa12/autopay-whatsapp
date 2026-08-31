import { Request, Response, NextFunction } from 'express';
import { Contact, MarketingOptInStatus } from '../models/Contact.model.js';
import { ContactList } from '../models/ContactList.model.js';
import { parseContactFile } from '../utils/excelParser.js';
import { validatePhoneNumber } from '../utils/phoneValidator.js';
import { generateErrorReportXlsx } from '../utils/errorReportGenerator.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function getContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const search = (req.query.search as string) || '';
    const optIn = (req.query.optIn as string) || '';
    const city = (req.query.city as string) || '';
    const company = (req.query.company as string) || '';
    const service = (req.query.service as string) || '';
    const sortMode = (req.query.sort as string) || 'newest';

    const filterQuery: any = {};

    if (optIn && optIn !== 'ALL') {
      filterQuery.marketingOptIn = optIn;
    }
    if (city && city !== 'ALL') {
      filterQuery.city = city;
    }
    if (company && company !== 'ALL') {
      filterQuery.company = company;
    }
    if (service && service !== 'ALL') {
      filterQuery.service = service;
    }

    if (search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(sanitized, 'i');
      filterQuery.$or = [
        { name: regex },
        { phoneNormalized: regex },
        { phoneRaw: regex },
        { email: regex },
        { company: regex },
        { city: regex },
        { service: regex },
      ];
    }

    const total = await Contact.countDocuments(filterQuery);
    const totalPages = Math.ceil(total / limit) || 1;

    let sortOptions: any = { updatedAt: -1, createdAt: -1 };
    if (sortMode === 'oldest') sortOptions = { createdAt: 1 };
    else if (sortMode === 'name') sortOptions = { name: 1 };
    else if (sortMode === 'newest') sortOptions = { updatedAt: -1, createdAt: -1 };

    const contacts = await Contact.find(filterQuery)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit);

    // Aggregate global stats & facet dropdown values in parallel
    const [totalContacts, optedOutCount, optedInCount, unknownCount, rawCities, rawCompanies, rawServices] = await Promise.all([
      Contact.countDocuments({}),
      Contact.countDocuments({ marketingOptIn: 'OPTED_OUT' }),
      Contact.countDocuments({ marketingOptIn: 'OPTED_IN' }),
      Contact.countDocuments({ marketingOptIn: 'UNKNOWN' }),
      Contact.distinct('city', { city: { $nin: [null, ''] } }),
      Contact.distinct('company', { company: { $nin: [null, ''] } }),
      Contact.distinct('service', { service: { $nin: [null, ''] } }),
    ]);

    const cities = (rawCities as string[]).filter(Boolean).sort();
    const companies = (rawCompanies as string[]).filter(Boolean).sort();
    const services = (rawServices as string[]).filter(Boolean).sort();

    res.status(200).json({
      success: true,
      data: {
        contacts,
        page,
        limit,
        total,
        totalPages,
        stats: {
          totalContacts,
          optedOutCount,
          optedInCount,
          unknownCount,
        },
        facets: {
          cities,
          companies,
          services,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function importContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new ValidationError('Please upload a valid Excel (.xlsx) or CSV file');
    }

    const { mapping, defaultCountryCode } = req.body;
    let customMapping: Record<string, string> | undefined;

    if (mapping) {
      try {
        customMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
      } catch (e) {
        throw new ValidationError('Invalid column mapping JSON format');
      }
    }

    // 1. Parse uploaded Excel/CSV file
    const parsedRows = parseContactFile(file.buffer, customMapping);

    // Fetch all existing contacts for smart upsert / update
    const existingContacts = await Contact.find({});
    const existingMap = new Map<string, any>(existingContacts.map((c) => [c.phoneNormalized, c]));

    const bulkOps: any[] = [];
    const invalidRows: any[] = [];
    let duplicateCount = 0;
    let insertedCount = 0;
    const seenInFileSet = new Set<string>();
    const now = new Date();

    // 2. Validate row by row and build Upsert operations
    parsedRows.forEach((row) => {
      const phoneValidation = validatePhoneNumber(row.phoneRaw, defaultCountryCode || 'IN');

      if (!phoneValidation.isValid) {
        invalidRows.push({
          ...row,
          errorReason: phoneValidation.error || 'Invalid phone number format',
        });
        return;
      }

      const pNorm = phoneValidation.phoneNormalized;

      // Handle duplicate rows WITHIN the same uploaded Excel/CSV file silently (upsert without erroring)
      if (seenInFileSet.has(pNorm)) {
        duplicateCount++;
      }
      seenInFileSet.add(pNorm);

      const existingInDb = existingMap.get(pNorm);
      if (!existingInDb) {
        insertedCount++;
      }

      bulkOps.push({
        updateOne: {
          filter: { phoneNormalized: pNorm },
          update: {
            $set: {
              name: row.name || existingInDb?.name || 'Unnamed',
              phoneRaw: row.phoneRaw,
              phoneNormalized: pNorm,
              email: row.email || existingInDb?.email,
              company: row.company || existingInDb?.company,
              city: row.city || existingInDb?.city,
              service: row.service || existingInDb?.service,
              marketingOptIn: row.optInStatus || existingInDb?.marketingOptIn || 'OPTED_IN',
              customFields: { ...(existingInDb?.customFields || {}), ...(row.customFields || {}) },
              source: file.originalname,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          upsert: true,
        },
      });

      existingMap.set(pNorm, { name: row.name, phoneNormalized: pNorm });
    });

    // 3. Execute Upsert operations into MongoDB
    if (bulkOps.length > 0) {
      await Contact.bulkWrite(bulkOps);
    }

    // 4. Generate downloadable Excel error report if invalid rows exist
    let errorReportBase64: string | undefined = undefined;
    if (invalidRows.length > 0) {
      const reportBuffer = generateErrorReportXlsx(invalidRows);
      errorReportBase64 = reportBuffer.toString('base64');
    }

    const totalUploaded = parsedRows.length;
    const importedCount = bulkOps.length;
    const invalidCount = invalidRows.length;

    logger.info('Contact import completed with MongoDB persistence', {
      totalUploaded,
      importedCount,
      invalidCount,
      duplicateCount,
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUploaded,
          importedCount,
          invalidCount,
          duplicateCount,
          optedOutCount: 0,
          unknownCount: 0,
        },
        invalidRows,
        errorReportXlsxBase64: errorReportBase64,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateContactOptIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { marketingOptIn } = req.body;

    if (!['OPTED_IN', 'OPTED_OUT', 'UNKNOWN'].includes(marketingOptIn)) {
      throw new ValidationError('Invalid opt-in status. Must be OPTED_IN, OPTED_OUT, or UNKNOWN.');
    }

    const contact = await Contact.findByIdAndUpdate(
      id,
      { marketingOptIn: marketingOptIn as MarketingOptInStatus },
      { returnDocument: 'after' }
    );

    if (!contact) {
      throw new NotFoundError(`Contact with ID '${id}' not found`);
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      throw new NotFoundError(`Contact with ID '${id}' not found`);
    }

    // Automatically pull deleted contact ID from all ContactLists
    try {
      await ContactList.updateMany(
        { contactIds: id },
        { $pull: { contactIds: id } }
      );
    } catch (err) {
      logger.warn('Failed to pull deleted contact ID from ContactLists', { error: err });
    }

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
