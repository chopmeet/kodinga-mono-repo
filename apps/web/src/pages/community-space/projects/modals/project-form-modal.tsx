import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TextareaInput,
} from '@kodinga-mono-repo/ui';
import { TechnologyPicker } from '@/pages/shared/technology-picker';
import type { Project } from '@/utils/api/project/project.type';
import UseProjectForm from '../form/UseProjectForm';

type Props = {
  communityId: string;
  open: boolean;
  /** null to create */
  project: Project | null;
  onClose: () => void;
  onSaved?: (saved: Project) => void;
};

function ProjectFormModal({ communityId, open, project, onClose, onSaved }: Props) {
  const { form, technologies, addTechnology, removeTechnology, onSubmit } = UseProjectForm({
    communityId,
    project,
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
          <DialogTitle>{project ? 'Modifier le projet' : 'Partager un projet'}</DialogTitle>
          <DialogDescription>Les membres pourront le voter et le commenter.</DialogDescription>
        </DialogHeader>

        <form id="project-form" onSubmit={onSubmit} noValidate className="grid gap-x-4 sm:grid-cols-2">
          <Input id="project-title" label="Nom du projet" required customClassContainer="sm:col-span-2" error={errors.title?.message} {...register('title')} />
          <Input
            id="project-tagline"
            label="Accroche (facultatif)"
            placeholder="Ex. Le suivi d'irrigation par SMS pour les maraîchers"
            customClassContainer="sm:col-span-2"
            error={errors.tagline?.message}
            {...register('tagline')}
          />
          <Input
            id="project-repo"
            label="Dépôt de code"
            placeholder="https://github.com/…"
            error={errors.repository_url?.message}
            {...register('repository_url')}
          />
          <Input id="project-demo" label="Démo" placeholder="https://…" error={errors.demo_url?.message} {...register('demo_url')} />

          <TechnologyPicker id="project-tech" value={technologies} onAdd={addTechnology} onRemove={removeTechnology} />

          <TextareaInput id="project-description" label="Description" rows={5} customClassContainer="sm:col-span-2" {...register('description')} />
          <Input
            id="project-cover"
            label="Image de couverture (facultatif)"
            placeholder="https://…"
            customClassContainer="sm:col-span-2"
            error={errors.cover_image_url?.message}
            {...register('cover_image_url')}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="project-form" isLoading={isSubmitting}>
            {project ? 'Enregistrer' : 'Partager le projet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectFormModal;
