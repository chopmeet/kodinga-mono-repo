import { MessagesSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import { ConversationList } from './components/conversation-list';
import { Thread } from './components/thread';
import UseMessages from './form/UseMessages';

function MessagesContent() {
  const { t } = useTranslation();
  const page = UseMessages();
  const open = !!page.conversationId;

  return (
    <div className="mx-auto max-w-285 px-0 sm:px-6 sm:py-6 lg:px-8">
      {/* Phones: the list, or the open conversation */}
      <div className="grid h-[calc(100dvh-4.5rem)] overflow-hidden border-slate-200 bg-white sm:h-[calc(100dvh-7.5rem)] sm:rounded-2xl sm:border md:grid-cols-[320px_1fr]">
        <aside className={cn('min-h-0 border-slate-200 md:border-r', open && 'hidden md:block')}>
          <ConversationList page={page} />
        </aside>
        <section className={cn('min-h-0', !open && 'hidden md:block')}>
          {page.notFound ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <p className="font-semibold text-slate-900">{t('inbox.messages.notFound')}</p>
              <Link to="/messages" className="mt-2 text-sm font-semibold text-blue-900 hover:underline">
                {t('inbox.messages.back')}
              </Link>
            </div>
          ) : page.current ? (
            <Thread page={page} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <MessagesSquare className="size-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-900">{t('inbox.messages.yours')}</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">{t('inbox.messages.choose')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** /messages(/:conversationId) — private messages between developers (signed-in users) */
function Messages() {
  const token = useAppSelector((s) => s.user.token);
  const { pathname } = useLocation();
  if (!token) return <Navigate to={`/auth/login?next=${encodeURIComponent(pathname)}`} replace />;
  return <MessagesContent />;
}

export default Messages;
