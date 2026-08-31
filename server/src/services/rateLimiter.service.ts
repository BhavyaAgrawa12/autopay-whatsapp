import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type RateLimitClassification = 'MARKETING_LIMITED' | 'RATE_LIMITED' | 'FAILED';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface RateLimitStatus {
  allowed: boolean;
  state: CircuitState;
  currentConcurrency: number;
  maxConcurrency: number;
  cooldownMs: number;
  consecutiveRateLimits: number;
}

export interface AcquireResult {
  proceed: boolean;
  reason?: 'COOLDOWN';
  cooldownMs?: number;
}

/**
 * Meta error codes that indicate a per-recipient MARKETING delivery cap.
 * These are NOT global rate limits — the campaign must NOT pause for them.
 */
const MARKETING_LIMIT_CODES = new Set(['131049', '131026']);

/**
 * Meta error codes (and HTTP 429) that indicate a spam / throughput / rate limit.
 * The FIRST of these must trip the circuit breaker and stop the campaign.
 */
const RATE_LIMIT_CODES = new Set(['131048', '131056', '130429', '80007', '4', '368', '130497', '429']);

/**
 * GlobalRateLimiterService — a circuit breaker + synchronous send gate for the
 * WhatsApp Cloud API. It is the single source of truth for:
 *   - classify(): what a given Meta error / stored recipient means
 *     (MARKETING_LIMITED vs RATE_LIMITED vs FAILED)
 *   - acquire(): whether a send may proceed right now
 *   - recordRateLimit()/recordSuccess(): driving the CLOSED→OPEN→HALF_OPEN cycle
 *
 * States:
 *   CLOSED    — normal operation, sends allowed, concurrency may ramp up.
 *   OPEN      — a rate limit was hit; sends are BLOCKED until cooldownUntil.
 *   HALF_OPEN — cautious probe after a fresh start / resume / cooldown elapse;
 *               concurrency pinned to 1 until a sustained success streak.
 *
 * SECURITY: only ever logs { errorCode, httpStatus, classifiedAs, retryable,
 * cooldownMs } — never tokens, secrets, phone numbers, or payloads.
 */
export class GlobalRateLimiterService {
  private static state: CircuitState = 'CLOSED';
  private static cooldownUntil = 0;
  private static currentConcurrency = env.WHATSAPP_MAX_CONCURRENCY || 5;
  private static consecutiveRateLimits = 0;
  private static successStreak = 0;

  // ---------------------------------------------------------------------------
  // Classification
  // ---------------------------------------------------------------------------

  /**
   * Resolve the numeric Meta error code from either a thrown AppError
   * (`{ code: 'WHATSAPP_API_ERROR', statusCode, details: { code: 131048 } }`)
   * or a stored recipient (`{ errorCode: '131049' }`) or a plain webhook object.
   *
   * CRITICAL: the internal AppError.code is the constant string
   * 'WHATSAPP_API_ERROR', so we only accept `code` when it is numeric. The real
   * Meta code lives in `details.code`. This is the exact bug that caused the
   * cascade — every failure short-circuited on the constant string.
   */
  public static extractMetaCode(input: any): string {
    if (!input) return '';
    const candidates = [
      input.details?.code,
      input.details?.error_subcode,
      typeof input.code === 'number' ? input.code : undefined,
      typeof input.code === 'string' && /^\d+$/.test(input.code) ? input.code : undefined,
      input.errorCode,
      input.status,
      input.statusCode,
      input.httpStatus,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null && String(c).trim() !== '') {
        return String(c).trim();
      }
    }
    return '';
  }

  private static resolveMessage(input: any): string {
    if (!input) return '';
    return String(
      input.message ||
        input.errorReason ||
        input.details?.message ||
        input.details?.error_data?.details ||
        input.title ||
        ''
    ).toLowerCase();
  }

  /**
   * The single source of truth for what a Meta failure means. Accepts a thrown
   * error, a stored recipient, or a webhook error object.
   */
  public static classify(input: any): RateLimitClassification {
    const code = GlobalRateLimiterService.extractMetaCode(input);
    const message = GlobalRateLimiterService.resolveMessage(input);

    // 1. Marketing delivery cap (per-recipient) — checked FIRST so it is never
    //    misread as a global rate limit.
    if (
      MARKETING_LIMIT_CODES.has(code) ||
      message.includes('ecosystem engagement') ||
      message.includes('marketing delivery limit')
    ) {
      return 'MARKETING_LIMITED';
    }

    // 2. Spam / throughput / rate limits (global) — must trip the breaker.
    if (
      RATE_LIMIT_CODES.has(code) ||
      message.includes('rate limit') ||
      message.includes('rate-limit') ||
      message.includes('spam rate') ||
      message.includes('too many requests') ||
      message.includes('throttl') ||
      message.includes('user limit reached') ||
      message.includes('messaging limit reached')
    ) {
      return 'RATE_LIMITED';
    }

    // 3. Everything else is a permanent, non-retryable failure.
    return 'FAILED';
  }

  /** Back-compat helper — delegates to classify(). */
  public static isMarketingLimitError(input: any): boolean {
    return GlobalRateLimiterService.classify(input) === 'MARKETING_LIMITED';
  }

  /** Back-compat helper — delegates to classify(). */
  public static isRateLimitError(input: any): boolean {
    return GlobalRateLimiterService.classify(input) === 'RATE_LIMITED';
  }

  // ---------------------------------------------------------------------------
  // Circuit breaker + send gate
  // ---------------------------------------------------------------------------

  /**
   * Synchronous gate consulted immediately before every send. Returns
   * proceed:false while the circuit is OPEN and the cooldown has not elapsed.
   * This is what actually blocks siblings the instant the breaker trips.
   */
  public static acquire(): AcquireResult {
    if (GlobalRateLimiterService.state === 'OPEN') {
      const remaining = GlobalRateLimiterService.cooldownUntil - Date.now();
      if (remaining > 0) {
        return { proceed: false, reason: 'COOLDOWN', cooldownMs: remaining };
      }
      // Cooldown elapsed. Move to a cautious probe; the campaign itself stays
      // PAUSED and only resumes on explicit admin action (manual resume).
      GlobalRateLimiterService.state = 'HALF_OPEN';
      GlobalRateLimiterService.currentConcurrency = 1;
    }
    return { proceed: true };
  }

  /**
   * Record a Meta rate-limit response. Opens the circuit on the FIRST hit:
   * blocks further sends, pins concurrency to 1, and sets an exponential
   * cooldown (initial * 2^n + jitter, capped at max).
   */
  public static recordRateLimit(err: any): { cooldownMs: number } {
    GlobalRateLimiterService.consecutiveRateLimits++;
    GlobalRateLimiterService.successStreak = 0;
    GlobalRateLimiterService.currentConcurrency = 1;

    const initial = env.WHATSAPP_INITIAL_BACKOFF_MS || 1000;
    const max = env.WHATSAPP_MAX_BACKOFF_MS || 60000;
    const exponent = Math.min(GlobalRateLimiterService.consecutiveRateLimits - 1, 6);
    const base = initial * Math.pow(2, exponent);
    const jitter = Math.floor(Math.random() * 500);
    const cooldownMs = Math.min(max, base + jitter);

    GlobalRateLimiterService.state = 'OPEN';
    GlobalRateLimiterService.cooldownUntil = Date.now() + cooldownMs;

    logger.warn('[AdaptiveRateLimiter] Circuit OPEN — Meta rate limit detected, halting new sends', {
      classifiedAs: 'RATE_LIMITED',
      retryable: true,
      httpStatus: err?.statusCode ?? err?.status,
      errorCode: GlobalRateLimiterService.extractMetaCode(err) || undefined,
      cooldownMs,
      consecutiveRateLimits: GlobalRateLimiterService.consecutiveRateLimits,
    });

    return { cooldownMs };
  }

  /**
   * Record a successful send. Clears the rate-limit counter and, after a
   * sustained streak, closes the circuit and ramps concurrency up by one toward
   * the ceiling (gradual recovery per the resume spec).
   */
  public static recordSuccess(): void {
    GlobalRateLimiterService.consecutiveRateLimits = 0;
    GlobalRateLimiterService.cooldownUntil = 0;
    GlobalRateLimiterService.successStreak++;

    const maxConcurrency = env.WHATSAPP_MAX_CONCURRENCY || 5;
    const rampStreak = env.WHATSAPP_SUCCESS_RAMP_STREAK || 10;

    if (GlobalRateLimiterService.successStreak >= rampStreak) {
      GlobalRateLimiterService.state = 'CLOSED';
      if (GlobalRateLimiterService.currentConcurrency < maxConcurrency) {
        GlobalRateLimiterService.currentConcurrency++;
        logger.info('[AdaptiveRateLimiter] Sustained successes — ramping concurrency up', {
          currentConcurrency: GlobalRateLimiterService.currentConcurrency,
          maxConcurrency,
        });
      }
      GlobalRateLimiterService.successStreak = 0;
    }
  }

  /**
   * Cautious cold-start for a fresh run or an admin resume: HALF_OPEN, start at
   * concurrency 1, clear cooldown and counters. Concurrency only ramps back to
   * the ceiling after sustained success.
   */
  public static beginRun(): void {
    GlobalRateLimiterService.state = 'HALF_OPEN';
    GlobalRateLimiterService.currentConcurrency = 1;
    GlobalRateLimiterService.cooldownUntil = 0;
    GlobalRateLimiterService.consecutiveRateLimits = 0;
    GlobalRateLimiterService.successStreak = 0;
  }

  /** Full reset to a clean CLOSED slate at max concurrency (tests / boot). */
  public static resetState(): void {
    GlobalRateLimiterService.state = 'CLOSED';
    GlobalRateLimiterService.currentConcurrency = env.WHATSAPP_MAX_CONCURRENCY || 5;
    GlobalRateLimiterService.cooldownUntil = 0;
    GlobalRateLimiterService.consecutiveRateLimits = 0;
    GlobalRateLimiterService.successStreak = 0;
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  public static getCurrentConcurrency(): number {
    return GlobalRateLimiterService.currentConcurrency;
  }

  public static getState(): CircuitState {
    return GlobalRateLimiterService.state;
  }

  /** True while the breaker is OPEN and the cooldown has not yet elapsed. */
  public static isOpen(): boolean {
    if (GlobalRateLimiterService.state === 'OPEN') {
      return GlobalRateLimiterService.cooldownUntil - Date.now() > 0;
    }
    return false;
  }

  public static getCooldownRemainingMs(): number {
    return Math.max(0, GlobalRateLimiterService.cooldownUntil - Date.now());
  }

  public static getConsecutiveRateLimits(): number {
    return GlobalRateLimiterService.consecutiveRateLimits;
  }

  public static async getOutboundCountLastHour(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return CampaignRecipient.countDocuments({
      status: { $in: ['SENT', 'DELIVERED', 'READ', 'FAILED', 'MARKETING_LIMITED', 'RATE_LIMITED'] },
      updatedAt: { $gte: oneHourAgo },
    });
  }

  /**
   * Adaptive rate check (no artificial fixed hourly cap — see spec §8). Reports
   * whether sending is currently allowed and the live circuit state.
   */
  public static async checkRateLimit(): Promise<RateLimitStatus> {
    const maxConcurrency = env.WHATSAPP_MAX_CONCURRENCY || 5;
    return {
      allowed: !GlobalRateLimiterService.isOpen(),
      state: GlobalRateLimiterService.state,
      currentConcurrency: GlobalRateLimiterService.currentConcurrency,
      maxConcurrency,
      cooldownMs: GlobalRateLimiterService.getCooldownRemainingMs(),
      consecutiveRateLimits: GlobalRateLimiterService.consecutiveRateLimits,
    };
  }
}
