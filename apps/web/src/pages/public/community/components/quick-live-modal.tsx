import { Globe, Lock, Radio, Video } from 'lucide-react';
import { useState } from 'react';
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
      setError('Le titre doit comporter au moins 3 caractères.');
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

      customToast.success({ message: 'Votre direct est lancé ! Connexion au salon…' });
      onClose();
      navigate(`/communities/${slug}/events/${created.id}/live`);
    } catch (err) {
      const parsed = parseApiError(err);
      customToast.error({ message: parsed.message || 'Impossible de démarrer le live.' });
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
            <DialogTitle className="text-xl">Lancer un direct maintenant</DialogTitle>
          </div>
          <DialogDescription>
            Démarrez une session vidéo interactive en temps réel avec les membres de la communauté.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleStart} className="space-y-4">
          <Input
            id="quick-live-title"
            label="Titre du direct"
            placeholder="Ex. Session Q&A, Live Coding, Démo…"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={error}
          />

          <TextareaInput
            id="quick-live-description"
            label="Description (facultative)"
            placeholder="De quoi va-t-on discuter pendant ce live ?"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">Confidentialité du direct</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer',
                  isPublic
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Globe className={cn('size-3.5', isPublic ? 'text-blue-600' : 'text-slate-400')} /> Public
                </span>
                <span className="text-[11px] leading-tight text-slate-500">
                  Accessible à tous les membres et visiteurs.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer',
                  !isPublic
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Lock className={cn('size-3.5', !isPublic ? 'text-amber-600' : 'text-slate-400')} /> Privé (Membres)
                </span>
                <span className="text-[11px] leading-tight text-slate-500">
                  Réservé uniquement aux membres de la communauté.
                </span>
              </button>
            </div>
          </div>

          <DialogFooter className="mt-6 pt-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isStarting}>
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={isStarting}
              className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/30 hover:bg-red-500"
            >
              <Video className="size-4" />
              Lancer le direct
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
