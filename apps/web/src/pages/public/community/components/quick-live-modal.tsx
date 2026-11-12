import { Globe, Lock, Radio, Video } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  cn,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TextareaInput,
} from '@kodinga/ui';
import { useCreateEventMutation, useUpdateEventStatusMutation } from '@/utils/api/community/community.api';
import type { EventWriteData } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';

type Props = {
  slug: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Rapid modal allowing community hosts/moderators to launch an instant live session with one click.
 * Creates the event in LiveKit format, marks it as 'live', and redirects into the studio.
 */
export function QuickLiveModal({ slug, open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [createEvent] = useCreateEventMutation();
  const [updateStatus] = useUpdateEventStatusMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setError(t('community.quickLive.titleTooShort'));
      return;
    }
    setError('');
    setIsStarting(true);

    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours default duration

    const body: EventWriteData = {
      title: title.trim(),
      description: description.trim(),
      event_type: 'live_stream',
      format: 'livekit',
      start_time: now.toISOString(),
      end_time: end.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      is_public: isPublic,
      is_recorded: true,
      max_attendees: null,
      venue_name: '',
      location_address: '',
      location_city: '',
      location_country: '',
      location_url: '',
      cover_image_url: '',
    };

    try {
      const created = await createEvent({ slug, ...body }).unwrap();
      // Immediately transition status to live
      await updateStatus({ slug, eventId: created.id, status: 'live' }).unwrap();

      customToast.success({ message: t('community.quickLive.started') });
      onClose();
      navigate(`/communities/${slug}/events/${created.id}/live`);
    } catch (err) {
      const parsed = parseApiError(err);
      customToast.error({ message: parsed.message || t('community.quickLive.failed') });
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isStarting && onClose()}>
      <DialogContent position="top" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-red-600">
            <span className="flex size-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Radio className="size-5 animate-pulse" />
            </span>
            <DialogTitle className="text-xl">{t('community.quickLive.title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('community.quickLive.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStart} className="space-y-4">
          <Input
            id="quick-live-title"
            label={t('community.quickLive.liveTitle')}
            placeholder={t('community.quickLive.liveTitlePlaceholder')}
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={error}
          />

          <TextareaInput
            id="quick-live-description"
            label={t('community.quickLive.liveDescription')}
            placeholder={t('community.quickLive.liveDescriptionPlaceholder')}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-2">
            <span className="text-xs font-semibold text-body">{t('community.quickLive.privacy')}</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer',
                  isPublic
                    ? 'border-blue-600 bg-brand-subtle/60 ring-2 ring-blue-600/20'
                    : 'border-border bg-card hover:border-border-strong',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Globe className={cn('size-3.5', isPublic ? 'text-blue-600' : 'text-faint')} /> {t('community.quickLive.public')}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {t('community.quickLive.publicText')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer',
                  !isPublic
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/20'
                    : 'border-border bg-card hover:border-border-strong',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Lock className={cn('size-3.5', !isPublic ? 'text-amber-600' : 'text-faint')} /> {t('community.quickLive.private')}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {t('community.quickLive.privateText')}
                </span>
              </button>
            </div>
          </div>

          <DialogFooter className="mt-6 pt-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isStarting}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={isStarting}
              className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/30 hover:bg-red-500"
            >
              <Video className="size-4" />
              {t('community.quickLive.start')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
