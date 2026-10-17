import { Controller } from 'react-hook-form';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
  TextareaInput,
} from '@kodinga-mono-repo/ui';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { CommunityEvent, EventFormat, EventType } from '@/utils/api/event/event.type';
import { eventFormatLabel, eventTypeLabel, hasLink, hasVenue } from '../event-labels';
import UseEventForm from '../form/UseEventForm';

type Props = {
  slug: string;
  open: boolean;
  /** null to create */
  event: CommunityEvent | null;
  onClose: () => void;
  onSaved?: (saved: CommunityEvent) => void;
};

const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

function EventFormModal({ slug, open, event, onClose, onSaved }: Props) {
  const { form, format, onSubmit } = UseEventForm({
    slug,
    event,
    open,
    onDone: (saved) => {
      onSaved?.(saved);
      onClose();
    },
  });
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent position="top" className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event ? "Modifier l'événement" : 'Nouvel événement'}</DialogTitle>
          <DialogDescription>Les membres de la communauté pourront s'y inscrire.</DialogDescription>
        </DialogHeader>

        <form id="event-form" onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
          <Input id="event-title" label="Titre" required customClassContainer="sm:col-span-2" error={errors.title?.message} {...register('title')} />
          <SelectInput label="Type" options={options<EventType>(eventTypeLabel)} {...register('event_type')} />
          <SelectInput label="Format" options={options<EventFormat>(eventFormatLabel)} {...register('format')} />
          <Input id="event-start" type="datetime-local" label="Début" required error={errors.start?.message} {...register('start')} />
          <Input id="event-end" type="datetime-local" label="Fin" required error={errors.end?.message} {...register('end')} />

          {hasVenue(format) && (
            <>
              <Input id="event-venue" label="Lieu" placeholder="Ex. Jokkolabs" error={errors.venue_name?.message} {...register('venue_name')} />
              <Input id="event-address" label="Adresse" {...register('location_address')} />
              <Input id="event-city" label="Ville" {...register('location_city')} />
              <Input id="event-country" label="Pays" {...register('location_country')} />
            </>
          )}
          {hasLink(format) && (
            <Input
              id="event-url"
              label="Lien de connexion"
              placeholder="https://meet.google.com/…"
              customClassContainer="sm:col-span-2"
              error={errors.location_url?.message}
              {...register('location_url')}
            />
          )}

          <TextareaInput id="event-description" label="Description" rows={4} customClassContainer="sm:col-span-2" {...register('description')} />
          <Input
            id="event-max"
            type="number"
            min={1}
            label="Places (facultatif)"
            fieldHelp="Vide : sans limite."
            error={errors.max_attendees?.message}
            {...register('max_attendees')}
          />
          <Input
            id="event-cover"
            label="Image de couverture (facultatif)"
            placeholder="https://…"
            error={errors.cover_image_url?.message}
            {...register('cover_image_url')}
          />

          <div className="divide-y divide-slate-100 border-t border-slate-100 sm:col-span-2">
            <Controller
              control={control}
              name="is_public"
              render={({ field }) => (
                <SettingSwitch
                  label="Visible publiquement"
                  description="Sinon, seuls les membres de la communauté le voient."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="is_recorded"
              render={({ field }) => (
                <SettingSwitch label="Enregistré" description="Un replay sera proposé après l'événement." checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="event-form" isLoading={isSubmitting}>
            {event ? 'Enregistrer' : "Créer l'événement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EventFormModal;
