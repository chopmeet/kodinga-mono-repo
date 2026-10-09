import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button, customToast } from '@kodinga-mono-repo/ui';
import type { AdminCategory } from '@/data/admin-settings.data';
import { useSettings } from '../admin-settings';
import CategoryModal from '../modals/category-modal';
import CategoriesTable from '../tables/categories-table';

function CategoriesSettingsTab() {
  const { categories, setCategories } = useSettings();
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);

  const save = ({ name, slug, description }: { name: string; slug: string; description: string }) => {
    if (editing && editing !== 'new') {
      setCategories((list) => list.map((c) => (c.id === editing.id ? { ...c, name, slug, description } : c)));
      customToast.success({ message: `Catégorie « ${name} » mise à jour.` });
    } else {
      setCategories((list) => [
        ...list,
        {
          id: `cat-${Date.now()}`,
          name,
          slug,
          description,
          icon_url: '',
          order: list.length + 1,
          created_at: new Date().toISOString(),
          is_active: true,
          communities_count: 0,
        },
      ]);
      customToast.success({ message: `Catégorie « ${name} » créée.` });
    }
    setEditing(null);
  };

  // Categories are referenced by communities: deactivate (hidden from filters) rather than delete
  const toggle = (category: AdminCategory) => {
    setCategories((list) => list.map((c) => (c.id === category.id ? { ...c, is_active: !c.is_active } : c)));
    customToast.success({ message: `« ${category.name} » ${category.is_active ? 'désactivée' : 'réactivée'}.` });
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
      <CategoriesTable categories={categories} onEdit={setEditing} onToggle={toggle} />
      <CategoryModal
        category={editing}
        existingSlugs={categories.map((c) => c.slug)}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  );
}

export default CategoriesSettingsTab;
