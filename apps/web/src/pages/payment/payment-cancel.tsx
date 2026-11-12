import { ArrowLeft, Ban } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@kodinga/ui';

const PENDING_STORAGE_KEY = 'kodinga_pending_payment';

function getStoredPayment(): { slug?: string; paymentId?: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function PaymentCancelPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stored = useMemo(() => getStoredPayment(), []);

  const slug = params.get('slug') || (stored?.slug && stored.slug !== 'kodinga-pro' ? stored.slug : null);

  const handleReturn = () => {
    if (slug) {
      navigate(`/communities/${slug}`);
    } else {
      navigate('/dashboard/billing');
    }
  };

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-border bg-card shadow-xl shadow-slate-500/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground ring-8 ring-slate-50">
            <Ban className="size-9" />
          </div>
          <Badge variant="outline" className="mx-auto mb-2 text-soft">
            Paiement non finalisé
          </Badge>
          <CardTitle className="text-2xl font-bold text-foreground">
            Paiement annulé
          </CardTitle>
          <p className="mt-1 text-sm text-soft">
            Vous avez interrompu la procédure de paiement PayDunya.
          </p>
        </CardHeader>

        <CardContent className="pt-2 text-center text-sm text-muted-foreground">
          <p>
            Aucun prélèvement n'a été effectué sur votre compte bancaire ou mobile money.
            Vous pouvez reprendre votre adhésion à tout moment.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-4">
          <Button
            size="lg"
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold gap-2"
            onClick={handleReturn}
          >
            <ArrowLeft className="size-4" />
            {slug ? 'Retourner à la communauté' : 'Retourner à la facturation'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default PaymentCancelPage;

