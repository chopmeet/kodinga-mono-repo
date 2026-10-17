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
import { TechnologyPicker } from '@/pages/shared/technology-picker';
import type { ExperienceLevel, Opportunity, OpportunityType, WorkplaceType } from '@/utils/api/opportunity/opportunity.type';
import UseOpportunityForm from '../form/UseOpportunityForm';
import { experienceLabel, opportunityTypeLabel, workplaceLabel } from '../opportunity-labels';

type Props = {
  communityId: string;
  open: boolean;
  /** null to create */
  opportunity: Opportunity | null;
  onClose: () => void;
  onSaved?: (saved: Opportunity) => void;
};

const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

function OpportunityFormModal({ communityId, open, opportunity, onClose, onSaved }: Props) {
  const { form, workplace, technologies, addTechnology, removeTechnology, onSubmit } = UseOpportunityForm({
    communityId,
    opportunity,
    open,
    onDone: (saved) => {
      onSaved?.(saved);
      onClose();
    },
  });
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent position="top" className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{opportunity ? "Modifier l'offre" : 'Nouvelle offre'}</DialogTitle>
          <DialogDescription>Les membres postulent depuis Kodinga ; vous suivez les candidatures ici.</DialogDescription>
        </DialogHeader>

        <form id="opportunity-form" onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
          <Input
            id="opportunity-title"
            label="Intitulé du poste ou de la mission"
            placeholder="Ex. Développeur·se React confirmé·e"
            required
            customClassContainer="sm:col-span-2"
            error={errors.title?.message}
            {...register('title')}
          />
          <Input id="opportunity-company" label="Entreprise" required error={errors.company_name?.message} {...register('company_name')} />
          <Input
            id="opportunity-website"
            label="Site de l'entreprise (facultatif)"
            placeholder="https://…"
            error={errors.company_website?.message}
            {...register('company_website')}
          />
          <SelectInput label="Type" options={options<OpportunityType>(opportunityTypeLabel)} {...register('opportunity_type')} />
          <SelectInput label="Niveau" options={options<ExperienceLevel>(experienceLabel)} {...register('experience_level')} />
          <SelectInput label="Mode de travail" options={options<WorkplaceType>(workplaceLabel)} {...register('workplace_type')} />
          <Input
            id="opportunity-location"
            label={workplace === 'remote' ? 'Ville / fuseau (facultatif)' : 'Ville'}
            placeholder={workplace === 'remote' ? 'Ex. Afrique de l’Ouest' : 'Ex. Dakar'}
            required={workplace !== 'remote'}
            error={errors.location?.message}
            {...register('location')}
          />
          <Input
            id="opportunity-salary-min"
            inputMode="numeric"
            label="Rémunération min. (FCFA)"
            fieldHelp="Mensuelle, ou totale pour un bounty."
            error={errors.salary_min?.message}
            {...register('salary_min')}
          />
          <Input id="opportunity-salary-max" inputMode="numeric" label="Rémunération max. (FCFA)" error={errors.salary_max?.message} {...register('salary_max')} />

          <TechnologyPicker id="opportunity-tech" value={technologies} onAdd={addTechnology} onRemove={removeTechnology} />

          <TextareaInput
            id="opportunity-description"
            label="Description"
            rows={5}
            required
            customClassContainer="sm:col-span-2"
            error={errors.description?.message}
            {...register('description')}
          />
          <TextareaInput
            id="opportunity-requirements"
            label="Profil recherché (facultatif)"
            rows={3}
            customClassContainer="sm:col-span-2"
            {...register('requirements')}
          />
          <Input
            id="opportunity-apply-url"
            label="Lien de candidature externe (facultatif)"
            placeholder="https://…"
            error={errors.apply_url?.message}
            {...register('apply_url')}
          />
          <Input
            id="opportunity-apply-email"
            type="email"
            label="Email de contact (facultatif)"
            error={errors.apply_email?.message}
            {...register('apply_email')}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="opportunity-form" isLoading={isSubmitting}>
            {opportunity ? 'Enregistrer' : "Publier l'offre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OpportunityFormModal;
