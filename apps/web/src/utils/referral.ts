// Affiliate code of the visitor (?ref=CODE on any page, see billing/affiliate/), sent with the next
// PayDunya checkout: the api pays the commission on the first paid subscription only
import { AppStorage } from './storage';

export const REFERRAL_KEY = 'kodinga_referral';
/** The code is kept 30 days after the visit */
const TTL = 30 * 24 * 60 * 60 * 1000;

type Saved = { code: string; at: number };

/** Keeps the ?ref= of the url (the latest one wins) */
export function rememberReferral(search: string) {
  const code = new URLSearchParams(search).get('ref')?.trim();
  if (code) AppStorage.setItem(REFERRAL_KEY, { code: code.slice(0, 50), at: Date.now() } satisfies Saved);
}

/** The kept code, if still valid */
export function referralCode(): string | undefined {
  const saved = AppStorage.getItem<Saved>(REFERRAL_KEY);
  return saved && Date.now() - saved.at < TTL ? saved.code : undefined;
}
