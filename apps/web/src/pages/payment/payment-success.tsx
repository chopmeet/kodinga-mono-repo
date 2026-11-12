import { CheckCircle2, Clock, ExternalLink, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, customToast, Loader } from '@kodinga/ui';
import { useAppDispatch } from '@/redux/hook';
import {
  CommunityApi,
  useGetMyPaymentsQuery,
  useGetPaymentStatusQuery,
  useVerifyPaymentMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { xof } from '@/utils/Utils';

const PENDING_STORAGE_KEY = 'kodinga_pending_payment';

function getStoredPayment(): { slug?: string; paymentId?: string; token?: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function clearStoredPayment() {
  try {
    sessionStorage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const stored = useMemo(() => getStoredPayment(), []);
  const fromUrl =
    params.get('payment_id') ||
    params.get('token') ||
    params.get('invoice_token') ||
    '';
  const storedPaymentId = stored?.paymentId || stored?.token || '';

  // Fallback: if no ID in URL or storage, inspect user's payments
  const paymentsQuery = useGetMyPaymentsQuery(undefined, {
    skip: !!fromUrl || !!storedPaymentId,
  });
  const latestPayment = paymentsQuery.data?.[0];

  const paymentId = fromUrl || storedPaymentId || latestPayment?.id || '';

  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [verifyPayment, { isLoading: isVerifying }] = useVerifyPaymentMutation();

  const handleVerifyNow = async () => {
    if (!paymentId) return;
    try {
      const res = await verifyPayment({ paymentId, force: true }).unwrap();
      if (res.is_paid || res.status === 'PAID') {
        customToast.success({
          message: 'Paiement validé avec succès ! Votre accès est activé.',
        });
        refetch();
      } else {
        customToast.info({
          message: 'La confirmation auprès de votre opérateur est toujours en cours. Réessayez dans un instant.',
        });
        refetch();
      }
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  // Poll status while not final
  const {
    data: paymentData,
    isLoading: isStatusLoading,
    isFetching,
    refetch,
  } = useGetPaymentStatusQuery(paymentId, {
    skip: !paymentId,
    pollingInterval: 2500,
  });

  const isPaid = !!paymentData?.is_paid || paymentData?.status === 'PAID';
  const isFailed =
    paymentData?.status === 'FAILED' || paymentData?.status === 'CANCELLED';

  // Timer for patience / fallback
  useEffect(() => {
    if (isPaid || isFailed) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev >= 25) {
          setHasTimedOut(true);
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaid, isFailed]);

  // When paid: invalidate cache and clear stored payment
  useEffect(() => {
    if (isPaid) {
      clearStoredPayment();
      dispatch(
        CommunityApi.util.invalidateTags([
          'communities',
          'plans',
          'community-billing',
          'my-billing',
          'members',
          'member-activity',
        ])
      );
    }
  }, [isPaid, dispatch]);

  const targetSlug =
    paymentData?.community_slug ||
    (stored?.slug && stored.slug !== 'kodinga-pro' ? stored.slug : null);

  const isProPlan = !targetSlug;

  const handleOkay = () => {
    if (targetSlug) {
      navigate(`/communities/${targetSlug}`);
    } else {
      navigate('/dashboard/billing');
    }
  };

  // 1. Initial lookup loading
  if (!paymentId && paymentsQuery.isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-4">
        <Loader
          inline
          className="py-12"
          message="Recherche de votre paiement PayDunya..."
        />
      </main>
    );
  }

  // 2. Verified & Paid: Success View
  if (isPaid) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg border-emerald-200 bg-card/90 shadow-xl shadow-emerald-500/5 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="size-10" />
            </div>
            <Badge className="mx-auto mb-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              Paiement Confirmé
            </Badge>
            <CardTitle className="text-2xl font-bold text-foreground">
              Paiement validé avec succès !
            </CardTitle>
            <p className="mt-1 text-sm text-soft">
              {isProPlan
                ? 'Félicitations ! Votre forfait Kodinga Pro est désormais actif.'
                : `Félicitations ! Votre accès à la communauté est désormais débloqué.`}
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="rounded-xl border border-border bg-subtle/60 p-4 space-y-2.5 text-sm">
              {paymentData?.community_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Communauté</span>
                  <span className="font-semibold text-foreground">
                    {paymentData.community_name}
                  </span>
                </div>
              )}
              {paymentData?.plan_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Formule souscrite</span>
                  <span className="font-semibold text-foreground">
                    {paymentData.plan_name}
                  </span>
                </div>
              )}
              {paymentData?.amount && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Montant réglé</span>
                  <span className="font-bold text-foreground">
                    {xof(Number(paymentData.amount))}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Statut de l'accès</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <Sparkles className="size-3.5" /> Actif & Illimité
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 leading-relaxed">
              {targetSlug
                ? 'Vous avez désormais un accès direct à toutes les ressources de la communauté : flux de discussion, modules Classroom, événements en direct et hackathons.'
                : 'Votre compte dispose désormais de toutes les fonctionnalités Kodinga Pro pour monétiser vos communautés et gérer vos abonnés.'}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button
              size="lg"
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-6 text-base shadow-md transition-all"
              onClick={handleOkay}
            >
              {targetSlug
                ? 'Okay — Accéder à la communauté'
                : 'Okay — Accéder à mon espace'}
            </Button>
            {paymentData?.receipt_url && (
              <a
                href={paymentData.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-body hover:underline"
              >
                <ExternalLink className="size-3" /> Télécharger mon reçu PayDunya
              </a>
            )}
          </CardFooter>
        </Card>
      </main>
    );
  }

  // 3. Failed or Cancelled View
  if (isFailed) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg border-red-200 bg-card/95 shadow-xl shadow-red-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600 ring-8 ring-red-50">
              <ShieldAlert className="size-10" />
            </div>
            <Badge className="mx-auto mb-2 bg-red-100 text-red-800 hover:bg-red-100">
              Non abouti
            </Badge>
            <CardTitle className="text-2xl font-bold text-foreground">
              Le paiement n'a pas pu aboutir
            </CardTitle>
            <p className="mt-1 text-sm text-soft">
              La transaction a été annulée ou refusée par l'opérateur. Aucun
              montant n'a été débité.
            </p>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 pt-4">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (targetSlug) {
                  navigate(`/communities/${targetSlug}`);
                } else {
                  navigate('/dashboard/billing');
                }
              }}
            >
              Retourner à {targetSlug ? 'la communauté' : 'la facturation'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // 4. Checking / In-Progress View (while backend queries PayDunya API)
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-brand-muted bg-card shadow-xl shadow-blue-500/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-subtle text-brand-strong ring-8 ring-blue-50/50">
            {hasTimedOut ? (
              <Clock className="size-9 text-amber-600" />
            ) : (
              <div className="size-8 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />
            )}
          </div>
          <Badge
            className={`mx-auto mb-2 ${
              hasTimedOut
                ? 'bg-amber-100 text-amber-800'
                : 'bg-brand-muted text-brand-strong'
            }`}
          >
            {hasTimedOut
              ? 'Traitement en cours'
              : 'Vérification PayDunya en cours'}
          </Badge>
          <CardTitle className="text-2xl font-bold text-foreground">
            {hasTimedOut
              ? 'Votre paiement est en cours de traitement'
              : 'Validation de votre paiement…'}
          </CardTitle>
          <p className="mt-1.5 text-sm text-soft leading-relaxed">
            {hasTimedOut
              ? 'PayDunya finalise la validation avec votre opérateur mobile (Wave, Orange Money, MoMo). Dès confirmation, votre accès sera activé automatiquement.'
              : 'Nous vérifions la confirmation de la transaction avec PayDunya. Cela ne prend que quelques secondes…'}
          </p>
        </CardHeader>

        <CardContent className="pt-4 text-center">
          <p className="text-xs text-faint">
            Temps écoulé : {elapsedSeconds}s · Connexion sécurisée PayDunya
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2.5 pt-2">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 text-base shadow-md gap-2"
            isLoading={isVerifying}
            onClick={handleVerifyNow}
          >
            <CheckCircle2 className="size-5" /> Valider mon paiement maintenant
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            isLoading={isStatusLoading || isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className="size-4" /> Actualiser le statut
          </Button>

          {hasTimedOut && (
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-soft hover:text-foreground"
              onClick={handleOkay}
            >
              {targetSlug
                ? 'Accéder quand même à la communauté'
                : 'Accéder à mon tableau de bord'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

export default PaymentSuccessPage;

