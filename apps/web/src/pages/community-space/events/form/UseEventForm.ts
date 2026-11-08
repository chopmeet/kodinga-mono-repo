import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useCreateEventMutation, useUpdateEventMutation } from '@/utils/api/community/community.api';
import type { CommunityEvent, EventWriteData } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { fromLocalInput, hasLink, hasVenue, toLocalInput } from '../event-labels';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');

const schema = z
  .object({
    title: z.string().trim().min(3, 'Au moins 3 caractères').max(255, '255 caractères maximum'),
    description: z.string().trim(),
    event_type: z.enum(['live_stream', 'webinar', 'workshop', 'qna', 'meetup']),
    format: z.enum(['livekit', 'external', 'in_person', 'hybrid']),
    start: z.string().min(1, 'Indiquez le début'),
    end: z.string().min(1, 'Indiquez la fin'),
    venue_name: z.string().trim().max(255),
    location_address: z.string().trim().max(500),
    location_city: z.string().trim().max(100),
    location_country: z.string().trim().max(100),
    location_url: optionalUrl,
    max_attendees: z.string().trim().refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1), 'Nombre entier, au moins 1'),
    cover_image_url: optionalUrl,
    is_recorded: z.boolean(),
    is_public: z.boolean(),
  })
  // Same check as the api, plus what each format needs
  .refine((v) => !v.start || !v.end || new Date(v.end) > new Date(v.start), {
    path: ['end'],
    message: 'La fin doit être après le début',
  })
  .refine((v) => !hasVenue(v.format) || !!v.venue_name || !!v.location_city, {
    path: ['venue_name'],
    message: 'Indiquez au moins le lieu ou la ville',
  })
  .refine((v) => !hasLink(v.format) || !!v.location_url, {
    path: ['location_url'],
    message: 'Indiquez le lien de connexion',
  });

export type EventFormValues = z.infer<typeof schema>;

const FIELDS = ['title', 'description', 'venue_name', 'location_address', 'location_city', 'location_country', 'location_url', 'cover_image_url'] as const;

/** Next full hour + 1 day, for 1 h */
function defaults(): EventFormValues {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: '',
    description: '',
    event_type: 'live_stream',
    format: 'livekit',
    start: toLocalInput(start.toISOString()),
    end: toLocalInput(end.toISOString()),
    venue_name: '',
    location_address: '',
    location_city: '',
    location_country: '',
    location_url: '',
    max_attendees: '',
    cover_image_url: '',
    is_recorded: true,
    is_public: true,
  };
}

const fromEvent = (e: CommunityEvent): EventFormValues => ({
  title: e.title,
  description: e.description,
  event_type: e.event_type,
  format: e.format,
  start: toLocalInput(e.start_time),
  end: toLocalInput(e.end_time),
  venue_name: e.venue_name,
  location_address: e.location_address,
  location_city: e.location_city,
  location_country: e.location_country,
  location_url: e.location_url ?? '',
  max_attendees: e.max_attendees ? String(e.max_attendees) : '',
  cover_image_url: e.cover_image_url,
  is_recorded: e.is_recorded,
  is_public: e.is_public,
});

/**
 * Create or edit an event of the community (POST / PATCH communities/<slug>/events/).
 * `event`: null to create; `onDone` receives the saved event.
 */
function UseEventForm({ slug, event, open, onDone }: { slug: string; event: CommunityEvent | null; open: boolean; onDone: (saved: CommunityEvent) => void }) {
  const [createEvent] = useCreateEventMutation();
  const [updateEvent] = useUpdateEventMutation();
  const form = useForm<EventFormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { reset, setError, watch, handleSubmit } = form;

  useEffect(() => {
    if (open) reset(event ? fromEvent(event) : defaults());
  }, [open, event, reset]);

  const onSubmit = async (v: EventFormValues) => {
    // Fields that do not apply to the chosen format are sent empty
    const body: EventWriteData = {
      title: v.title,
      description: v.description,
      cover_image_url: v.cover_image_url,
      event_type: v.event_type,
      format: v.format,
      start_time: fromLocalInput(v.start),
      end_time: fromLocalInput(v.end),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      venue_name: hasVenue(v.format) ? v.venue_name : '',
      location_address: hasVenue(v.format) ? v.location_address : '',
      location_city: hasVenue(v.format) ? v.location_city : '',
      location_country: hasVenue(v.format) ? v.location_country : '',
      location_url: hasLink(v.format) ? v.location_url : '',
      max_attendees: v.max_attendees ? Number(v.max_attendees) : null,
      is_recorded: v.is_recorded,
      is_public: v.is_public,
    };
    try {
      const saved = event
        ? await updateEvent({ slug, eventId: event.id, ...body }).unwrap()
        : await createEvent({ slug, ...body }).unwrap();
      customToast.success({ message: event ? 'Événement mis à jour.' : 'Événement créé.' });
      onDone(saved);
    } catch (error) {
      const { message, fields } = parseApiError(error);
      let onField = false;
      for (const field of FIELDS) {
        if (fields[field]) {
          setError(field, { message: fields[field] });
          onField = true;
        }
      }
      if (fields.start_time) setError('start', { message: fields.start_time });
      if (fields.end_time) setError('end', { message: fields.end_time });
      if (!onField && !fields.start_time && !fields.end_time) customToast.error({ message });
    }
  };

  return { form, format: watch('format'), onSubmit: handleSubmit(onSubmit) };
}

export default UseEventForm;
