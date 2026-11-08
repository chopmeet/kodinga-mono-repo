import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useCreateOpportunityMutation, useUpdateOpportunityMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Opportunity, OpportunityWriteData, Technology } from '@/utils/api/opportunity/opportunity.type';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');
const optionalAmount = z.string().trim().refine((v) => !v || /^\d+$/.test(v), 'Montant entier, sans espace');

const schema = z
  .object({
    title: z.string().trim().min(3, 'Au moins 3 caractères').max(255, '255 caractères maximum'),
    company_name: z.string().trim().min(1, "Indiquez l'entreprise").max(255, '255 caractères maximum'),
    company_website: optionalUrl,
    company_logo_url: optionalUrl,
    opportunity_type: z.enum(['full_time', 'part_time', 'contract', 'freelance', 'internship', 'bounty']),
    workplace_type: z.enum(['remote', 'hybrid', 'onsite']),
    location: z.string().trim().max(255, '255 caractères maximum'),
    experience_level: z.enum(['all', 'junior', 'mid', 'senior', 'lead']),
    salary_min: optionalAmount,
    salary_max: optionalAmount,
    description: z.string().trim().min(1, "Décrivez l'offre"),
    requirements: z.string().trim(),
    apply_url: optionalUrl,
    apply_email: z.string().trim().refine((v) => !v || z.email().safeParse(v).success, 'Adresse email invalide'),
    technologies: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
  })
  .refine((v) => !v.salary_min || !v.salary_max || Number(v.salary_max) >= Number(v.salary_min), {
    path: ['salary_max'],
    message: 'Le maximum doit être supérieur au minimum',
  })
  .refine((v) => v.workplace_type === 'remote' || !!v.location, {
    path: ['location'],
    message: 'Indiquez la ville',
  });

export type OpportunityFormValues = z.infer<typeof schema>;

const FIELDS = [
  'title',
  'company_name',
  'company_website',
  'company_logo_url',
  'location',
  'salary_min',
  'salary_max',
  'description',
  'requirements',
  'apply_url',
  'apply_email',
] as const;

const DEFAULTS: OpportunityFormValues = {
  title: '',
  company_name: '',
  company_website: '',
  company_logo_url: '',
  opportunity_type: 'full_time',
  workplace_type: 'remote',
  location: '',
  experience_level: 'all',
  salary_min: '',
  salary_max: '',
  description: '',
  requirements: '',
  apply_url: '',
  apply_email: '',
  technologies: [],
};

/** "300000.00" -> "300000" */
const toAmount = (value: string | null) => (value ? String(Math.round(Number(value))) : '');

const fromOpportunity = (o: Opportunity): OpportunityFormValues => ({
  title: o.title,
  company_name: o.company_name,
  company_website: o.company_website,
  company_logo_url: o.company_logo_url,
  opportunity_type: o.opportunity_type,
  workplace_type: o.workplace_type,
  location: o.workplace_type === 'remote' && o.location === 'Remote' ? '' : o.location,
  experience_level: o.experience_level,
  salary_min: toAmount(o.salary_min),
  salary_max: toAmount(o.salary_max),
  description: o.description,
  requirements: o.requirements,
  apply_url: o.apply_url,
  apply_email: o.apply_email,
  technologies: o.technologies.map(({ id, name, slug }) => ({ id, name, slug })),
});

/**
 * Publish or edit an offer of the community (POST opportunities/ with community_id, PATCH by slug).
 * Offers are published open: the community list of the api only returns open offers.
 * Applications go through Kodinga; apply_url / apply_email are shown as an extra contact.
 */
function UseOpportunityForm({
  communityId,
  opportunity,
  open,
  onDone,
}: {
  communityId: string;
  /** null to create */
  opportunity: Opportunity | null;
  open: boolean;
  onDone: (saved: Opportunity) => void;
}) {
  const [createOpportunity] = useCreateOpportunityMutation();
  const [updateOpportunity] = useUpdateOpportunityMutation();
  const form = useForm<OpportunityFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { reset, setError, setValue, getValues, watch, handleSubmit } = form;

  useEffect(() => {
    if (open) reset(opportunity ? fromOpportunity(opportunity) : DEFAULTS);
  }, [open, opportunity, reset]);

  const technologies = watch('technologies');
  const addTechnology = (tech: Technology) => {
    const current = getValues('technologies');
    if (current.some((t) => t.id === tech.id)) return;
    setValue('technologies', [...current, { id: tech.id, name: tech.name, slug: tech.slug }], { shouldDirty: true });
  };
  const removeTechnology = (id: string) =>
    setValue(
      'technologies',
      getValues('technologies').filter((t) => t.id !== id),
      { shouldDirty: true },
    );

  const onSubmit = async (v: OpportunityFormValues) => {
    const body: OpportunityWriteData = {
      title: v.title,
      company_name: v.company_name,
      company_website: v.company_website,
      company_logo_url: v.company_logo_url,
      opportunity_type: v.opportunity_type,
      workplace_type: v.workplace_type,
      location: v.location || 'Remote',
      experience_level: v.experience_level,
      salary_min: v.salary_min || null,
      salary_max: v.salary_max || null,
      currency: 'XOF',
      description: v.description,
      requirements: v.requirements,
      apply_url: v.apply_url,
      apply_email: v.apply_email,
      status: 'open',
      community_id: communityId,
      technology_ids: v.technologies.map((t) => t.id),
    };
    try {
      const saved = opportunity
        ? await updateOpportunity({ opportunitySlug: opportunity.slug, ...body }).unwrap()
        : await createOpportunity(body).unwrap();
      customToast.success({ message: opportunity ? 'Offre mise à jour.' : 'Offre publiée.' });
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
      if (!onField) customToast.error({ message });
    }
  };

  return {
    form,
    workplace: watch('workplace_type'),
    technologies,
    addTechnology,
    removeTechnology,
    onSubmit: handleSubmit(onSubmit),
  };
}

export default UseOpportunityForm;
