import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold">404</p>
      <p className="text-muted-foreground">Cette page n'existe pas.</p>
      <Button asChild variant="outline">
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}

export default NotFound;
