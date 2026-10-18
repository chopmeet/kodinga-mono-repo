import { MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { useUser } from '@/utils/Utils';
import { useStartConversation } from '../form/UseMessages';

type Props = { userId: string; label?: string; size?: 'sm' | 'default' | 'lg'; variant?: 'default' | 'outline'; className?: string };

/** Opens the direct conversation with a user; visitors sign in first; nothing on one's own profile */
export function MessageButton({ userId, label = 'Envoyer un message', size = 'default', variant = 'default', className }: Props) {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const me = useUser();
  const { pathname } = useLocation();
  const { open, isLoading } = useStartConversation();

  if (me?.id === userId) return null;
  if (!signedIn) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link to={`/auth/login?next=${encodeURIComponent(pathname)}`}>
          <MessageCircle /> {label}
        </Link>
      </Button>
    );
  }
  return (
    <Button size={size} variant={variant} className={className} isLoading={isLoading} onClick={() => open(userId)}>
      <MessageCircle /> {label}
    </Button>
  );
}
