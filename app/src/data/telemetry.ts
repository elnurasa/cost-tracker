/**
 * AC-PRIV-02 by construction. v1 has NO transport: TELEMETRY_ENDPOINT is null, nothing is ever sent (also enforced by the
 * CSP `connect-src 'self'` and asserted by the e2e "zero third-party requests" test). What exists is the payload gate every
 * future sender must go through: only whitelisted event names, integer counts, app version, locale and the random install id.
 */
export const TELEMETRY_ENDPOINT: string | null = null;

export const TELEMETRY_EVENTS = ['app_open', 'expense_added', 'income_received', 'period_confirmed', 'backup_exported', 'lock_enabled', 'thumbs_answer'] as const;
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];
export const TELEMETRY_COUNT_KEYS = ['entries_period', 'days_with_entries', 'envelopes', 'open_count'] as const;

export interface TelemetryPayload {
  event: TelemetryEvent;
  counts: Partial<Record<(typeof TELEMETRY_COUNT_KEYS)[number], number>>;
  appVersion: string;
  locale: string;
  installId: string;
}

export function buildTelemetryPayload(event: string, counts: Record<string, unknown>, ctx: { appVersion: string; locale: string; installId: string }): TelemetryPayload {
  if (!(TELEMETRY_EVENTS as readonly string[]).includes(event)) throw new Error('telemetry: event not whitelisted');
  const clean: TelemetryPayload['counts'] = {};
  for (const [k, v] of Object.entries(counts)) {
    if (!(TELEMETRY_COUNT_KEYS as readonly string[]).includes(k)) throw new Error('telemetry: count key not whitelisted');
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1_000_000) throw new Error('telemetry: counts must be small integers');
    clean[k as keyof typeof clean] = v;
  }
  if (!/^[0-9a-f]{16}$/.test(ctx.installId)) throw new Error('telemetry: install id must be random hex');
  if (!/^(en|az|tr|ru)$/.test(ctx.locale)) throw new Error('telemetry: locale');
  if (!/^\d+\.\d+\.\d+$/.test(ctx.appVersion)) throw new Error('telemetry: version');
  return { event: event as TelemetryEvent, counts: clean, appVersion: ctx.appVersion, locale: ctx.locale, installId: ctx.installId };
}

/** v1: nothing leaves the device. Returns why, so callers and tests can assert it. */
export async function flushTelemetry(_payloads: TelemetryPayload[]): Promise<'disabled'> {
  void _payloads;
  return 'disabled';
}
