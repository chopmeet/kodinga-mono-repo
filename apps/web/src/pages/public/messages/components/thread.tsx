import { ArrowLeft, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kodinga/ui';
import { dateFormat } from '@/utils/format';
import i18n from '@/utils/i18n';
import type { ChatMessage } from '@/utils/api/messaging/messaging.type';
import { nameInitials } from '@/utils/Utils';
import { conversationName, otherPerson, type MessagesPage } from '../form/UseMessages';
import { EmojiPickerButton } from '@/pages/shared/emoji-picker-button';
import { useEmojiInsert } from '@/pages/shared/use-emoji-insert';


/** "Aujourd’hui", "Hier", "lundi 12 octobre" */
function day(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return i18n.t('inbox.messages.today');
  if (d.toDateString() === yesterday.toDateString()) return i18n.t('inbox.messages.yesterday');
  return dateFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

function Bubble({ message: m, mine, page }: { message: ChatMessage; mine: boolean; page: MessagesPage }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const draftEmoji = useEmojiInsert(draft, setDraft);

  const save = async () => {
    const text = draft.trim();
    if (!text || text === m.content) return setEditing(false);
    if (await page.edit(m.id, text)) setEditing(false);
  };

  return (
    <div className={cn('group flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
      {mine && !m.is_deleted && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('inbox.messages.actions')} className="rounded-md p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 focus:opacity-100">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setDraft(m.content);
                setEditing(true);
              }}
            >
              <Pencil /> {t('inbox.messages.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => page.remove(m.id)}>
              <Trash2 /> {t('inbox.messages.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
          m.is_deleted ? 'border border-dashed border-slate-200 bg-transparent text-slate-400 italic' : mine ? 'rounded-br-md bg-blue-900 text-white' : 'rounded-bl-md bg-white text-slate-800 shadow-2xs ring-1 ring-slate-200',
        )}
      >
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              ref={draftEmoji.ref}
              aria-label={t('inbox.messages.editLabel')}
              value={draft}
              autoFocus
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              className="w-64 max-w-full resize-y rounded-md bg-white/95 p-2 text-sm text-slate-900"
            />
            <div className="flex items-center justify-end gap-2 text-xs">
              <EmojiPickerButton onSelect={draftEmoji.insert} className="mr-auto p-1 text-blue-100 hover:bg-white/10 hover:text-white" />
              <button type="button" onClick={() => setEditing(false)} className="opacity-80 hover:opacity-100">
                {t('common.actions.cancel')}
              </button>
              <button type="button" onClick={save} className="font-semibold">
                {t('common.actions.save')}
              </button>
            </div>
          </div>
        ) : (
          <p className="break-words whitespace-pre-line">{m.is_deleted ? t('inbox.messages.deleted') : m.content}</p>
        )}
        <p className={cn('mt-1 text-right text-[10px]', mine && !m.is_deleted ? 'text-blue-100' : 'text-slate-400')}>
          {dateFormat({ hour: '2-digit', minute: '2-digit' }).format(new Date(m.created_at))}
          {m.is_edited && !m.is_deleted ? t('inbox.messages.edited') : ''}
        </p>
      </div>
    </div>
  );
}

/** Open conversation: messages by day, newest at the bottom, and the composer */
/** "Awa est en train d’écrire…", "Awa et Kofi sont en train d’écrire…" */
export function typingLabel(names: string[]) {
  if (names.length === 0) return '';
  if (names.length === 1) return i18n.t('inbox.messages.typingOne', { name: names[0] });
  if (names.length === 2) return i18n.t('inbox.messages.typingTwo', { first: names[0], second: names[1] });
  return i18n.t('inbox.messages.typingMany');
}

export function Thread({ page }: { page: MessagesPage }) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const contentEmoji = useEmojiInsert(content, (next) => {
    setContent(next);
    page.sendTyping(!!next.trim());
  });
  const endRef = useRef<HTMLDivElement>(null);
  const conversation = page.current;
  const count = page.messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [count, page.conversationId]);

  if (!conversation) return null;
  const name = conversationName(conversation, page.meId);
  const other = conversation.conversation_type === 'direct' ? otherPerson(conversation, page.meId) : null;

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    page.sendTyping(false);
    if (await page.send(text)) setContent('');
  };

  // Enter sends, Shift + Enter goes to the line
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/messages" className="rounded-md p-1 text-slate-600 hover:bg-slate-100 md:hidden" aria-label={t('inbox.messages.backToList')}>
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar className="size-10">
          {other?.avatar_url && <AvatarImage src={other.avatar_url} alt="" />}
          <AvatarFallback className="bg-blue-50 text-sm font-semibold text-blue-900">{nameInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-900">{name}</h2>
          {other && (
            <Link to={`/profiles/${other.username}`} className="text-xs text-slate-500 hover:text-blue-900 hover:underline">
              {t('inbox.messages.seeProfile', { username: other.username })}
            </Link>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5" aria-live="polite">
        {page.isMessagesLoading ? (
          <p className="text-center text-sm text-slate-500">{t('inbox.messages.loading')}</p>
        ) : count === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500">{t('inbox.messages.sayHello', { name })}</p>
        ) : (
          <ol className="flex flex-col gap-2" aria-label={t('inbox.messages.title')}>
            {page.messages.map((m, i) => {
              const newDay = i === 0 || day(page.messages[i - 1].created_at) !== day(m.created_at);
              return (
                <li key={m.id}>
                  {newDay && <p className="my-3 text-center text-xs font-medium text-slate-400 first-letter:uppercase">{day(m.created_at)}</p>}
                  <Bubble message={m} mine={m.sender.id === page.meId} page={page} />
                </li>
              );
            })}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <p className="min-h-6 bg-slate-50 px-5 pb-1 text-xs text-slate-500 italic" aria-live="polite">
        {typingLabel(page.typingUsers)}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
      >
        <label className="sr-only" htmlFor="message-input">
          {t('inbox.messages.yourMessage')}
        </label>
        <EmojiPickerButton onSelect={contentEmoji.insert} align="start" className="mb-1.5" />
        <textarea
          ref={contentEmoji.ref}
          id="message-input"
          rows={1}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            page.sendTyping(!!e.target.value.trim());
          }}
          onBlur={() => page.sendTyping(false)}
          onKeyDown={onKeyDown}
          placeholder={t('inbox.messages.writeTo', { name })}
          className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-900 focus:bg-white focus:outline-none"
        />
        <Button type="submit" className="h-11" isLoading={page.isSending} disabled={!content.trim()} aria-label={t('inbox.messages.send')}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
