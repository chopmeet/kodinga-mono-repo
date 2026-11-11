import type { Categories } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn, Popover, PopoverContent, PopoverTrigger } from '@kodinga/ui';

//
const Picker = lazy(() => import('emoji-picker-react'));

const frenchData = () => import('emoji-picker-react/data/emojis-fr');

const CATEGORIES = ['suggested', 'smileys_people', 'animals_nature', 'food_drink', 'travel_places', 'activities', 'objects', 'symbols', 'flags'] as const;

type Props = {
  onSelect: (emoji: string) => void;
  /** Accessible name of the button ("Insérer un emoji" by default) */
  label?: string;
  children?: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
};


export function EmojiPickerButton({ onSelect, label, children, className, align = 'end', disabled }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label ?? t('common.emoji.open')}
          title={label ?? t('common.emoji.open')}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          {children ?? <Smile className="size-5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto overflow-hidden border-0 p-0">
        {open && (
          <Suspense fallback={<p className="w-80 p-6 text-center text-sm text-slate-500">{t('common.emoji.loading')}</p>}>
            <Picker
              onEmojiClick={(data) => {
                onSelect(data.emoji);
                setOpen(false);
              }}
              emojiData={i18n.resolvedLanguage === 'en' ? undefined : frenchData}
              categories={CATEGORIES.map((category) => ({ category: category as Categories, name: t(`common.emoji.categories.${category}`) }))}
              labels={{ searchPlaceholder: t('common.emoji.search'), searchLabel: t('common.emoji.search'), searchResultsNone: t('common.emoji.noResults') }}
              previewConfig={{ showPreview: false }}
              width={320}
              height={380}
              lazyLoadEmojis
            />
          </Suspense>
        )}
      </PopoverContent>
    </Popover>
  );
}
