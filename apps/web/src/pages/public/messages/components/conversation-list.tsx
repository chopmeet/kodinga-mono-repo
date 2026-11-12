import { MessagesSquare, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, cn } from '@kodinga/ui';
import { ago, nameInitials } from '@/utils/Utils';
import { conversationName, otherPerson, type MessagesPage } from '../form/UseMessages';

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Conversations of the user, most recent first (the api order) */
export function ConversationList({ page }: { page: MessagesPage }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const needle = normalize(search.trim());
  const list = page.conversations.filter((c) => !needle || normalize(conversationName(c, page.meId)).includes(needle));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h1 className="text-xl font-semibold text-foreground">{t('inbox.messages.title')}</h1>
        <label className="relative mt-3 block">
          <span className="sr-only">{t('inbox.messages.searchLabel')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inbox.messages.searchPlaceholder')}
            className="h-10 w-full rounded-lg border border-border bg-subtle pr-3 pl-9 text-sm placeholder:text-faint focus:bg-card focus:outline-none"
          />
        </label>
      </div>

      {page.isConversationsLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t('common.actions.loading')}</p>
      ) : page.conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <MessagesSquare className="size-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-foreground">{t('inbox.messages.none')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('inbox.messages.noneText')}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border-soft overflow-y-auto" aria-label={t('inbox.messages.conversations')}>
          {list.map((c) => {
            const name = conversationName(c, page.meId);
            const other = otherPerson(c, page.meId);
            const unread = c.unread_count > 0 && c.id !== page.conversationId;
            return (
              <li key={c.id}>
                <NavLink
                  to={`/messages/${c.id}`}
                  className={({ isActive }) => cn('flex items-center gap-3 px-4 py-3 transition-colors', isActive ? 'bg-brand-subtle' : 'hover:bg-subtle')}
                >
                  <Avatar className="size-11">
                    {c.conversation_type === 'direct' && other?.avatar_url && <AvatarImage src={other.avatar_url} alt="" />}
                    <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-strong">
                      {c.conversation_type === 'group' ? <Users className="size-4" /> : nameInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', unread ? 'font-bold text-foreground' : 'font-medium text-foreground')}>{name}</span>
                      {c.last_message && <span className="shrink-0 text-[11px] text-faint">{ago(c.last_message.created_at)}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-xs', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        {c.last_message ? c.last_message.content : t('inbox.messages.newConversation')}
                      </span>
                      {unread && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-900 px-1.5 text-[11px] font-semibold text-white" aria-label={t('inbox.messages.unread', { count: c.unread_count })}>
                          {c.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </NavLink>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t('inbox.messages.noMatch')}</li>}
        </ul>
      )}
    </div>
  );
}
