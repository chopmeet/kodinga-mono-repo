import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAppDispatch } from '@/redux/hook';
import { CommunityApi, useGetMyPaymentsQuery, useGetPaymentStatusQuery } from '@/utils/api/community/community.api';

const KEY = 'kodinga_pending_payment';
const POLLING = 3_000;
/** After this, the payment is told "pending": PayDunya confirms it later (IPN) */
const PATIENCE = 90_000;

/**
 * What the payment buys: a community (its slug and id), or Kodinga Pro (PRO_SCOPE: plans with no
 * community)
 */
export type PaymentScope = { slug: string; communityId: string | null };
export const PRO_SCOPE: PaymentScope = { slug: 'kodinga-pro', communityId: null };

/** The payment started for a scope, kept for the return from PayDunya (same tab) */
export function rememberPayment(slug: string, paymentId: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ slug, paymentId }));
  } catch {
    // Private mode: the latest payment of the scope is used instead
  }
}

function rememberedPayment(slug: string): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { slug: string; paymentId: string } | null;
    return saved?.slug === slug ? saved.paymentId : null;
  } catch {
    return null;
  }
}

const forget = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
};

export type PaymentReturn = 'checking' | 'paid' | 'pending' | 'failed' | 'cancelled' | null;

/**
 * Back from PayDunya (?payment=done|cancelled): the payment is checked with the api (it asks
 * PayDunya while pending) until it is paid or failed. Paid: the membership (or Pro) is read again.
 * The payment is the one of the url (the api adds ?payment_id= to the return urls), else the one
 * kept before leaving, else the latest one of the scope.
 */
function UsePaymentReturn(scope: PaymentScope | undefined, param: string | null): PaymentReturn {
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const slug = scope?.slug ?? '';
  const done = param === 'done';
  const fromUrl = done ? params.get('payment_id') : null;
  const remembered = done && slug && !fromUrl ? rememberedPayment(slug) : null;
  // Paid in another tab, or no storage: the latest payment of this scope
  const payments = useGetMyPaymentsQuery(undefined, { skip: !done || !slug || !!fromUrl || !!remembered });
  const latest = (payments.data ?? []).find((p) => !!p.plan && p.plan.community_id === scope?.communityId);
  const paymentId = fromUrl ?? remembered ?? latest?.id ?? '';

  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const check = useGetPaymentStatusQuery(paymentId, { skip: !paymentId || timedOut, pollingInterval: POLLING });
  const status = check.data?.status;
  const final = check.data?.is_paid || status === 'PAID' || status === 'FAILED' || status === 'CANCELLED';

  useEffect(() => {
    if (!done || final) return;
    const timer = setTimeout(() => setTimedOut(true), Math.max(0, PATIENCE - (Date.now() - startedAt)));
    return () => clearTimeout(timer);
  }, [done, final, startedAt]);

  const paid = !!check.data?.is_paid || status === 'PAID';
  useEffect(() => {
    if (param === 'cancelled') forget();
    if (!paid) return;
    forget();
    // The payment created the membership or the Pro subscription: the page and the account read it again
    dispatch(CommunityApi.util.invalidateTags([{ type: 'communities', id: slug }, { type: 'communities', id: 'my-billing' }]));
  }, [paid, param, slug, dispatch]);

  if (param === 'cancelled') return 'cancelled';
  if (!done) return null;
  if (paid) return 'paid';
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed';
  if (timedOut || (!paymentId && payments.isSuccess)) return 'pending';
  return 'checking';
}

export default UsePaymentReturn;
