import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useGetCommunityMembersQuery } from '@/utils/api/community/community.api';
import type { PointsAdjustment } from '@/utils/api/gamification/gamification.type';

const schema = z.object({
  points: z.coerce
    .number({ message: 'Saisissez un nombre de points' })
    .int('Nombre entier')
    .refine((n) => n !== 0, 'Saisissez un nombre différent de 0'),
  reason: z.string().trim().min(3, 'Expliquez l’ajustement (il est visible dans le journal)').max(255, '255 caractères maximum'),
});

type Values = z.input<typeof schema>;

const EMPTY: Values = { points: '', reason: '' };

/** The member found by the search, once chosen */
export type ChosenMember = { id: string; name: string };

type Options = {
  open: boolean;
  slug: string;
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onAdjust: (input: PointsAdjustment) => Promise<boolean>;
};

/**
 * Manual adjustment of the points of one member: the member is searched among the active ones
 * (2 letters at least, 8 results), then a signed number of points and a reason
 */
function UseAdjustPointsForm({ open, slug, onOpenChange, onAdjust }: Options) {
  const [search, setSearch] = useState('');
  const [member, setMember] = useState<ChosenMember | null>(null);
  const [memberError, setMemberError] = useState(false);
  const found = useGetCommunityMembersQuery({ slug, status: 'active', search: search.trim(), page_size: 8 }, { skip: !open || search.trim().length < 2 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Each opening starts from scratch
  useEffect(() => {
    if (open) {
      setSearch('');
      setMember(null);
      setMemberError(false);
      reset(EMPTY);
    }
  }, [open, reset]);

  const onValid = async (raw: Values) => {
    if (!member) return;
    const values = schema.parse(raw);
    if (await onAdjust({ user_id: member.id, points: values.points, reason: values.reason })) onOpenChange(false);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Said with the other errors, not after them
    if (!member) setMemberError(true);
    return handleSubmit(onValid)(e);
  };

  return {
    register,
    errors,
    isSubmitting,
    onSubmit,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setMemberError(false);
    },
    results: found.data?.results ?? [],
    member,
    setMember,
    memberError,
  };
}

export default UseAdjustPointsForm;
