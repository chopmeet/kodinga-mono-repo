import { Plus, RotateCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyAlert,
} from '@kodinga-mono-repo/ui';
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useGetAdminCategoriesQuery,
  useUpdateCategoryMutation,
} from '@/utils/api/community/community.api';
import type { AdminCategoryItem } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import CategoryModal from '../modals/category-modal';
import CategoriesTable from '../tables/categories-table';

function CategoriesSettingsTab() {
  const { data: categories = [], isLoading, error, refetch } = useGetAdminCategoriesQuery();
  const [createCategory] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();
  const [editing, setEditing] = useState<AdminCategoryItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryItem | null>(null);

  /** Returns the error to show in the modal (duplicate name, etc.), null once saved */
  const save = async ({ name, slug, description }: { name: string; slug: string; description: string }) => {
    try {
      if (editing && editing !== 'new') {
        await updateCategory({ currentSlug: editing.slug, name, slug: slug || undefined, description }).unwrap();
        customToast.success({ message: `Catégorie « ${name} » mise à jour.` });
      } else {
        const order = Math.max(0, ...categories.map((c) => c.order)) + 1;
        await createCategory({ name, slug: slug || undefined, description, order }).unwrap();
        customToast.success({ message: `Catégorie « ${name} » créée.` });
      }
      setEditing(null);
      return null;
    } catch (err) {
      const { message, fields } = parseApiError(err);
      return fields.name ?? fields.slug ?? message;
    }
  };

  // Categories are referenced by communities: deactivate (hidden from filters) rather than delete
  const toggle = async (category: AdminCategoryItem) => {
    try {
      await updateCategory({ currentSlug: category.slug, is_active: !category.is_active }).unwrap();
      customToast.success({ message: `« ${category.name} » ${category.is_active ? 'désactivée' : 'réactivée'}.` });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await deleteCategory({ slug: deleting.slug, hard: true }).unwrap();
      customToast.success({ message: `« ${deleting.name} » a été supprimée.` });
      setDeleting(null);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Catégories</h2>
          <p className="text-sm text-slate-500">Une catégorie désactivée n'apparaît plus dans les filtres, ses communautés restent visibles.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Nouvelle catégorie
        </Button>
      </div>

      {error && categories.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw />
            Réessayer
          </Button>
        </div>
      ) : !isLoading && categories.length === 0 ? (
        <EmptyAlert text="Aucune catégorie pour l'instant." />
      ) : (
        <CategoriesTable categories={categories} isLoading={isLoading} onEdit={setEditing} onToggle={toggle} onDelete={setDeleting} />
      )}

      <CategoryModal
        category={editing}
        existingSlugs={categories.map((c) => c.slug)}
        onClose={() => setEditing(null)}
        onSave={save}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {deleting?.name} » ?</DialogTitle>
            <DialogDescription>Aucune communauté ne l'utilise : elle sera supprimée définitivement.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button variant="danger" onClick={remove} isLoading={isDeleting}>
              <Trash2 />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CategoriesSettingsTab;
