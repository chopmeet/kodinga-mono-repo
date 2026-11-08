import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { fromLocalInput, toLocalInput } from '@/pages/community-space/events/event-labels';
import { useCreateHackathonMutation, useUpdateHackathonMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon, HackathonWriteData } from '@/utils/api/hackathon/hackathon.type';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');
const optionalInt = (min: number) =>
  z.string().trim().refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= min), `Nombre entier, au moins ${min}`);

const DATES = ['registration_start', 'registration_end', 'start_time', 'submission_deadline', 'judging_end'] as const;

const schema = z
  .object({
    title: z.string().trim().min(3, 'Au moins 3 caractères').max(255, '255 caractères maximum'),
    tagline: z.string().trim().max(255, '255 caractères maximum'),
    description: z.string().trim().min(10, 'Décrivez le défi (10 caractères minimum)'),
    theme: z.string().trim().max(255),
    format: z.enum(['online', 'in_person', 'hybrid']),
    venue_name: z.string().trim().max(255),
    venue_city: z.string().trim().max(100),
    venue_country: z.string().trim().max(100),
    location_url: optionalUrl,
    cover_image_url: optionalUrl,
    rules_url: optionalUrl,
    target_audience: z.string().trim().max(255),
    prerequisites: z.string().trim(),
    registration_start: z.string().min(1, 'Date requise'),
    registration_end: z.string().min(1, 'Date requise'),
    start_time: z.string().min(1, 'Date requise'),
    submission_deadline: z.string().min(1, 'Date requise'),
    judging_end: z.string().min(1, 'Date requise'),
    is_member_only: z.boolean(),
    allow_teams: z.boolean(),
    min_team_size: optionalInt(1),
    max_team_size: optionalInt(1),
    max_participants: optionalInt(1),
    auto_accept_applications: z.boolean(),
    require_repo_url: z.boolean(),
    require_demo_url: z.boolean(),
    require_video_url: z.boolean(),
    prizes: z.array(
      z.object({
        title: z.string().trim().min(1, 'Titre requis'),
        reward_amount: optionalInt(0),
        reward_description: z.string().trim().max(255),
      })
    ),
    criteria: z.array(
      z.object({
        name: z.string().trim().min(1, 'Nom requis'),
        weight: z.string().trim().refine((v) => !v || Number(v) > 0, 'Poids positif'),
        max_score: optionalInt(1),
      })
    ),
  })
  // The api checks these too (HackathonService.create_hackathon); shown here before sending
  .refine((v) => new Date(v.registration_end) > new Date(v.registration_start), {
    path: ['registration_end'],
    message: 'Après l’ouverture des inscriptions',
  })
  .refine((v) => new Date(v.submission_deadline) > new Date(v.start_time), {
    path: ['submission_deadline'],
    message: 'Après le début du hackathon',
  })
  .refine((v) => new Date(v.judging_end) > new Date(v.submission_deadline), {
    path: ['judging_end'],
    message: 'Après la date limite de soumission',
  })
  .refine((v) => !v.allow_teams || !v.min_team_size || !v.max_team_size || Number(v.max_team_size) >= Number(v.min_team_size), {
    path: ['max_team_size'],
    message: 'Au moins la taille minimale',
  });

export type HackathonFormValues = z.infer<typeof schema>;

const inDays = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

/** A sensible calendar: registrations for 2 weeks, a 48 h hackathon, a week of judging */
const defaults = (): HackathonFormValues => ({
  title: '',
  tagline: '',
  description: '',
  theme: '',
  format: 'online',
  venue_name: '',
  venue_city: '',
  venue_country: '',
  location_url: '',
  cover_image_url: '',
  rules_url: '',
  target_audience: '',
  prerequisites: '',
  registration_start: inDays(1),
  registration_end: inDays(15, 23),
  start_time: inDays(17),
  submission_deadline: inDays(19),
  judging_end: inDays(26, 18),
  is_member_only: false,
  allow_teams: true,
  min_team_size: '1',
  max_team_size: '4',
  max_participants: '',
  auto_accept_applications: true,
  require_repo_url: true,
  require_demo_url: false,
  require_video_url: false,
  prizes: [{ title: '1er prix', reward_amount: '', reward_description: '' }],
  criteria: [
    { name: 'Innovation', weight: '1', max_score: '20' },
    { name: 'Qualité technique', weight: '1', max_score: '20' },
    { name: 'Impact', weight: '1', max_score: '20' },
  ],
});

const fromHackathon = (h: Hackathon): HackathonFormValues => ({
  title: h.title,
  tagline: h.tagline,
  description: h.description,
  theme: h.theme,
  format: h.format,
  venue_name: h.venue_name,
  venue_city: h.venue_city,
  venue_country: h.venue_country,
  location_url: h.location_url,
  cover_image_url: h.cover_image_url,
  rules_url: h.rules_url,
  target_audience: h.target_audience,
  prerequisites: h.prerequisites,
  registration_start: toLocalInput(h.registration_start),
  registration_end: toLocalInput(h.registration_end),
  start_time: toLocalInput(h.start_time),
  submission_deadline: toLocalInput(h.submission_deadline),
  judging_end: toLocalInput(h.judging_end),
  is_member_only: h.is_member_only,
  allow_teams: h.allow_teams,
  min_team_size: String(h.min_team_size),
  max_team_size: String(h.max_team_size),
  max_participants: h.max_participants ? String(h.max_participants) : '',
  auto_accept_applications: h.auto_accept_applications,
  require_repo_url: h.require_repo_url,
  require_demo_url: h.require_demo_url,
  require_video_url: h.require_video_url,
  prizes: h.prizes
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({ title: p.title, reward_amount: p.reward_amount ? String(Math.round(Number(p.reward_amount))) : '', reward_description: p.reward_description })),
  criteria: h.criteria.map((c) => ({ name: c.name, weight: String(Number(c.weight)), max_score: String(Math.round(Number(c.max_score))) })),
});

const TEXT_FIELDS = ['title', 'tagline', 'description', 'theme', 'location_url', 'cover_image_url', 'rules_url', ...DATES] as const;

/** Create or edit a hackathon (POST / PATCH communities/<slug>/hackathons/), then open it */
function UseHackathonForm({ slug, hackathon }: { slug: string; hackathon?: Hackathon }) {
  const navigate = useNavigate();
  const [createHackathon] = useCreateHackathonMutation();
  const [updateHackathon] = useUpdateHackathonMutation();
  const form = useForm<HackathonFormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const prizes = useFieldArray({ control: form.control, name: 'prizes' });
  const criteria = useFieldArray({ control: form.control, name: 'criteria' });

  useEffect(() => {
    if (hackathon) form.reset(fromHackathon(hackathon));
  }, [hackathon, form]);

  const onSubmit = async (v: HackathonFormValues) => {
    const onSite = v.format !== 'online';
    const body: HackathonWriteData = {
      title: v.title,
      tagline: v.tagline,
      description: v.description,
      theme: v.theme,
      format: v.format,
      venue_name: onSite ? v.venue_name : '',
      venue_city: onSite ? v.venue_city : '',
      venue_country: onSite ? v.venue_country : '',
      location_url: v.location_url,
      cover_image_url: v.cover_image_url,
      rules_url: v.rules_url,
      target_audience: v.target_audience,
      prerequisites: v.prerequisites,
      registration_start: fromLocalInput(v.registration_start),
      registration_end: fromLocalInput(v.registration_end),
      start_time: fromLocalInput(v.start_time),
      submission_deadline: fromLocalInput(v.submission_deadline),
      judging_end: fromLocalInput(v.judging_end),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      is_member_only: v.is_member_only,
      allow_teams: v.allow_teams,
      min_team_size: v.allow_teams ? Number(v.min_team_size || 1) : 1,
      max_team_size: v.allow_teams ? Number(v.max_team_size || 4) : 1,
      max_participants: v.max_participants ? Number(v.max_participants) : null,
      auto_accept_applications: v.auto_accept_applications,
      require_repo_url: v.require_repo_url,
      require_demo_url: v.require_demo_url,
      require_video_url: v.require_video_url,
      prizes: v.prizes.map((p, i) => ({
        title: p.title,
        reward_amount: p.reward_amount ? Number(p.reward_amount) : null,
        reward_currency: 'XOF',
        reward_description: p.reward_description,
        rank: i + 1,
      })),
      criteria: v.criteria.map((c) => ({ name: c.name, weight: c.weight ? Number(c.weight) : 1, max_score: c.max_score ? Number(c.max_score) : 20 })),
    };
    try {
      const saved = hackathon
        ? await updateHackathon({ slug, hackathonSlug: hackathon.slug, ...body }).unwrap()
        : await createHackathon({ slug, ...body }).unwrap();
      customToast.success({ message: hackathon ? 'Hackathon mis à jour.' : 'Hackathon créé en brouillon.' });
      navigate(`/c/${slug}/hackathons/${saved.slug}`);
    } catch (error) {
      const { message, fields } = parseApiError(error);
      let onField = false;
      for (const field of TEXT_FIELDS) {
        if (fields[field]) {
          form.setError(field, { message: fields[field] });
          onField = true;
        }
      }
      customToast.error({ message: onField ? 'Certains champs sont à corriger.' : message });
    }
  };

  return { form, prizes, criteria, onSubmit: form.handleSubmit(onSubmit, () => customToast.error({ message: 'Certains champs sont à corriger.' })) };
}

export default UseHackathonForm;
