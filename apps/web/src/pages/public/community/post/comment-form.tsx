import { Send } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';

import { Button } from '@kodinga/ui';

type Props = {
  label: string;
  placeholder: string;
  submitLabel: string;
  isSending?: boolean;
  /** true when published: the field empties */
  onSend: (content: string) => boolean | Promise<boolean> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Height of the text area: 4 on the page of the post, less under a card of the feed */
  rows?: number;
};

/** Text area + publish (answer to the post, or reply to a comment) */
export function CommentForm({ label, placeholder, submitLabel, isSending = false, onSend, onCancel, autoFocus, rows = 4 }: Props) {
  const id = useId();
  const [content, setContent] = useState('');
  const text = content.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text) return;
    const sentText = text;
    setContent('');
    onSend(sentText);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={content}
        autoFocus={autoFocus}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Markdown accepté : **gras**, `code`, listes…</p>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSending}>
              Annuler
            </Button>
          )}
          <Button type="submit" size="sm" isLoading={isSending} disabled={!text}>
            <Send /> {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
