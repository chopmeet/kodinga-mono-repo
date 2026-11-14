import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  Users,
  Crown,
  Calendar,
  GraduationCap,
  RotateCcw,
  Save,
  Lock,
  Info,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';

import { Button, customToast, InputSwitch } from '@kodinga/ui';
import {
  useGetCommunitySettingsQuery,
  useUpdateCommunitySettingsMutation,
} from '@/utils/api/community/community.api';
import type {
  RolePermissionKey,
  RolePermissionsMap,
  RolePermissionsMatrix,
} from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

type ConfigurableRole = 'admin' | 'moderator' | 'member';
type DisplayRole = ConfigurableRole | 'owner';

interface PermissionDefinition {
  key: RolePermissionKey;
  label: string;
  description: string;
}

interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  icon: typeof Calendar;
  color: string;
  permissions: PermissionDefinition[];
}

/**
 * Only the permissions the api checks (has_community_permission). The others of the matrix
 * (posts, hackathons, projects, sanctions, settings…) are not shown: the api stores them but
 * applies none, and they are sent back unchanged on save.
 */
const PERMISSION_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'events',
    name: 'Événements & Lives',
    description: 'Organisation d’ateliers, webinaires, hackathons et rencontres en direct.',
    icon: Calendar,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    permissions: [
      {
        key: 'can_manage_events',
        label: 'Gérer les événements et les hackathons',
        description: 'Créer, modifier et annuler des événements, et gérer les hackathons de la communauté.',
      },
      {
        key: 'can_start_live',
        label: 'Démarrer un direct (Live)',
        description: 'Lancer un direct vidéo ou audio interactif pour la communauté.',
      },
    ],
  },
  {
    id: 'classroom',
    name: 'Cours & Formations (Classroom)',
    description: 'Création et gestion des parcours pédagogiques interactifs.',
    icon: GraduationCap,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    permissions: [
      {
        key: 'can_manage_courses',
        label: 'Créer et gérer les cours',
        description: 'Créer des cours, modifier leur contenu et l’ordre des modules, les publier ou les archiver.',
      },
    ],
  },
  {
    id: 'moderation',
    name: 'Membres',
    description: 'Accueil et recrutement des membres.',
    icon: ShieldCheck,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    permissions: [
      {
        key: 'can_invite_members',
        label: 'Inviter de nouveaux membres',
        description: 'Générer des liens d’invitation personnalisés pour faire grandir la communauté.',
      },
      {
        key: 'can_review_requests',
        label: 'Valider les demandes d’adhésion',
        description: 'Examiner et approuver ou rejeter les adhésions en attente.',
      },
    ],
  },
];

/** The keys shown above: the counts and "tout autoriser / restreindre" only touch them */
const SHOWN_PERMISSIONS = PERMISSION_CATEGORIES.flatMap((cat) => cat.permissions.map((perm) => perm.key));

const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  admin: {
    can_create_posts: true,
    can_pin_posts: true,
    can_delete_posts: true,
    can_moderate_comments: true,
    can_create_events: true,
    can_manage_events: true,
    can_start_live: false,
    can_create_courses: true,
    can_manage_courses: true,
    can_create_hackathons: true,
    can_manage_hackathons: true,
    can_create_projects: true,
    can_feature_projects: true,
    can_invite_members: true,
    can_review_requests: true,
    can_sanction_members: true,
    can_assign_roles: true,
    can_manage_settings: true,
    can_view_analytics: true,
  },
  moderator: {
    can_create_posts: true,
    can_pin_posts: true,
    can_delete_posts: true,
    can_moderate_comments: true,
    can_create_events: true,
    can_manage_events: false,
    can_start_live: false,
    can_create_courses: false,
    can_manage_courses: false,
    can_create_hackathons: false,
    can_manage_hackathons: false,
    can_create_projects: true,
    can_feature_projects: true,
    can_invite_members: true,
    can_review_requests: true,
    can_sanction_members: true,
    can_assign_roles: false,
    can_manage_settings: false,
    can_view_analytics: true,
  },
  member: {
    can_create_posts: true,
    can_pin_posts: false,
    can_delete_posts: false,
    can_moderate_comments: false,
    can_create_events: false,
    can_manage_events: false,
    can_start_live: false,
    can_create_courses: false,
    can_manage_courses: false,
    can_create_hackathons: false,
    can_manage_hackathons: false,
    can_create_projects: true,
    can_feature_projects: false,
    can_invite_members: true,
    can_review_requests: false,
    can_sanction_members: false,
    can_assign_roles: false,
    can_manage_settings: false,
    can_view_analytics: false,
  },
  owner: {
    can_create_posts: true,
    can_pin_posts: true,
    can_delete_posts: true,
    can_moderate_comments: true,
    can_create_events: true,
    can_manage_events: true,
    can_start_live: true,
    can_create_courses: true,
    can_manage_courses: true,
    can_create_hackathons: true,
    can_manage_hackathons: true,
    can_create_projects: true,
    can_feature_projects: true,
    can_invite_members: true,
    can_review_requests: true,
    can_sanction_members: true,
    can_assign_roles: true,
    can_manage_settings: true,
    can_view_analytics: true,
  },
};

/** Permissions of a role in the matrix; the owner has them all (it is optional in the matrix) */
function permissionsOf(matrix: RolePermissionsMatrix, role: DisplayRole): RolePermissionsMap {
  if (role === 'owner') {
    return matrix.owner ?? (Object.fromEntries(Object.keys(DEFAULT_ROLE_PERMISSIONS.admin).map((key) => [key, true])) as RolePermissionsMap);
  }
  return matrix[role] ?? DEFAULT_ROLE_PERMISSIONS[role];
}

const ROLE_INFO: Record<
  DisplayRole,
  { title: string; badge: string; description: string; icon: typeof Crown; color: string }
> = {
  admin: {
    title: 'Administrateurs',
    badge: 'Pilotage & Opérations',
    description:
      'Les administrateurs assistent le propriétaire dans la gestion quotidienne. Vous pouvez restreindre certaines actions sensibles si souhaité.',
    icon: Shield,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  moderator: {
    title: 'Modérateurs',
    badge: 'Cadre & Modération',
    description:
      'Les modérateurs veillent à la qualité des échanges et au respect de la charte. Vous pouvez leur accorder des droits de création supplémentaires.',
    icon: ShieldCheck,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  member: {
    title: 'Membres standards',
    badge: 'Membres actifs',
    description:
      'Permissions attribuées par défaut à tout membre actif de la communauté. Vous pouvez étendre leurs droits (ex: créer des événements ou des projets).',
    icon: Users,
    color: 'text-blue-600 bg-brand-subtle border-brand-muted',
  },
  owner: {
    title: 'Propriétaire (Créateur)',
    badge: 'Droits absolus',
    description:
      'En tant que propriétaire fondateur de l’espace, vous disposez de l’ensemble des droits de manière permanente et inaltérable.',
    icon: Crown,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
};

export function SpaceRolesTab() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: storedSettings, isLoading } = useGetCommunitySettingsQuery(slug, { skip: !slug });
  const [updateSettings, { isLoading: isSaving }] = useUpdateCommunitySettingsMutation();

  const [activeRole, setActiveRole] = useState<DisplayRole>('admin');
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Synchronize state when backend data loads or updates
  useEffect(() => {
    if (storedSettings?.all_role_permissions) {
      setMatrix((prev) => ({
        ...prev,
        ...storedSettings.all_role_permissions,
      }));
      setHasUnsavedChanges(false);
    } else if (storedSettings?.role_permissions) {
      // Merge stored overrides with defaults
      setMatrix({
        admin: { ...DEFAULT_ROLE_PERMISSIONS.admin, ...(storedSettings.role_permissions.admin || {}) },
        moderator: { ...DEFAULT_ROLE_PERMISSIONS.moderator, ...(storedSettings.role_permissions.moderator || {}) },
        member: { ...DEFAULT_ROLE_PERMISSIONS.member, ...(storedSettings.role_permissions.member || {}) },
        owner: DEFAULT_ROLE_PERMISSIONS.owner,
      });
      setHasUnsavedChanges(false);
    }
  }, [storedSettings]);

  const togglePermission = (role: ConfigurableRole, key: RolePermissionKey) => {
    setMatrix((prev) => {
      const currentRolePerms = prev[role] || DEFAULT_ROLE_PERMISSIONS[role];
      const updated = {
        ...prev,
        [role]: {
          ...currentRolePerms,
          [key]: !currentRolePerms[key],
        },
      };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleBatchToggle = (role: ConfigurableRole, enableAll: boolean) => {
    setMatrix((prev) => {
      const rolePerms = { ...(prev[role] ?? DEFAULT_ROLE_PERMISSIONS[role]) };
      SHOWN_PERMISSIONS.forEach((key) => {
        rolePerms[key] = enableAll;
      });
      return {
        ...prev,
        [role]: rolePerms,
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleResetRoleDefaults = (role: ConfigurableRole) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...DEFAULT_ROLE_PERMISSIONS[role] },
    }));
    setHasUnsavedChanges(true);
    customToast.success({ message: `Permissions du rôle "${ROLE_INFO[role].title}" rétablies par défaut.` });
  };

  const handleResetAllDefaults = () => {
    setMatrix(DEFAULT_ROLE_PERMISSIONS);
    setHasUnsavedChanges(true);
    customToast.success({ message: 'Toutes les permissions ont été réinitialisées aux valeurs par défaut.' });
  };

  const handleSave = async () => {
    if (!slug) return;
    try {
      await updateSettings({
        slug,
        role_permissions: {
          admin: matrix.admin,
          moderator: matrix.moderator,
          member: matrix.member,
        },
      }).unwrap();
      setHasUnsavedChanges(false);
      customToast.success({ message: 'Matrice des permissions des rôles enregistrée avec succès.' });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Chargement de la configuration des permissions...</p>
      </div>
    );
  }

  const currentRolePerms = permissionsOf(matrix, activeRole);
  const activeCount = SHOWN_PERMISSIONS.filter((key) => currentRolePerms[key]).length;
  const totalCount = SHOWN_PERMISSIONS.length;
  const isOwner = activeRole === 'owner';

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border-soft">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Gestion des rôles & permissions</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Contrôle RBAC Granulaire
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            En tant que propriétaire, vous pouvez augmenter ou restreindre librement les actions autorisées pour
            chaque rôle de votre communauté.
          </p>
        </div>

        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-medium text-amber-700">Modifications non enregistrées</span>
          </div>
        )}
      </div>

      {/* Role Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['admin', 'moderator', 'member', 'owner'] as DisplayRole[]).map((role) => {
          const info = ROLE_INFO[role];
          const Icon = info.icon;
          const isSelected = activeRole === role;
          const rolePerms = permissionsOf(matrix, role);
          const count = SHOWN_PERMISSIONS.filter((key) => rolePerms[key]).length;

          return (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-150 ${
                isSelected
                  ? 'border-brand bg-brand-subtle shadow-sm ring-1 ring-brand/20'
                  : 'border-border hover:border-border-strong hover:bg-subtle/50 bg-card'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span
                  className={`inline-flex items-center justify-center p-2 rounded-lg border ${info.color}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    role === 'owner'
                      ? 'bg-amber-100 text-amber-800'
                      : count === totalCount
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-muted text-body'
                  }`}
                >
                  {count} / {totalCount}
                </span>
              </div>
              <span className="font-medium text-sm text-foreground">{info.title}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{info.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Role Banner Summary */}
      <div className="rounded-xl border border-border/80 bg-subtle/50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex items-center justify-center p-2.5 rounded-xl border mt-0.5 ${ROLE_INFO[activeRole].color}`}
            >
              {(() => {
                const Icon = ROLE_INFO[activeRole].icon;
                return <Icon className="w-5 h-5" />;
              })()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">{ROLE_INFO[activeRole].title}</h3>
                <span className="text-xs text-muted-foreground">
                  ({activeCount} action{activeCount > 1 ? 's' : ''} autorisée{activeCount > 1 ? 's' : ''} sur {totalCount})
                </span>
              </div>
              <p className="text-sm text-soft mt-0.5">{ROLE_INFO[activeRole].description}</p>
            </div>
          </div>

          {!isOwner && (
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => handleBatchToggle(activeRole, true)}>
                Tout autoriser
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleBatchToggle(activeRole, false)}>
                Tout restreindre
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleResetRoleDefaults(activeRole)}
                title="Rétablir les permissions par défaut de ce rôle"
              >
                <RotateCcw />
                Par défaut
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Owner Inviolability Notice */}
      {isOwner && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            <strong>Règle de sécurité :</strong> Le propriétaire fondateur possède l'ensemble des permissions
            sans restriction possible afin de garantir la pérennité et la gouvernance de la communauté.
          </p>
        </div>
      )}

      {/* Permission Categories */}
      <div className="space-y-5">
        {PERMISSION_CATEGORIES.map((cat) => {
          const CategoryIcon = cat.icon;
          return (
            <div
              key={cat.id}
              className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-subtle/60 border-b border-border-soft">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${cat.color}`}>
                    <CategoryIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{cat.name}</h4>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border-soft">
                {cat.permissions.map((perm) => {
                  const isAllowed = isOwner ? true : !!currentRolePerms[perm.key];
                  const switchId = `perm-${activeRole}-${perm.key}`;

                  return (
                    <div
                      key={perm.key}
                      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-subtle/40 transition-colors"
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={switchId}
                            className="text-sm font-medium text-foreground cursor-pointer"
                          >
                            {perm.label}
                          </label>
                          {isAllowed ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Autorisé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted text-soft">
                              <XCircle className="w-3 h-3 text-faint" />
                              Restreint
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{perm.description}</p>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isOwner ? (
                          <div
                            className="flex items-center gap-1 text-xs text-faint font-medium px-2 py-1 bg-muted rounded-lg"
                            title="Inviolable pour le propriétaire"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Fixe
                          </div>
                        ) : (
                          <InputSwitch
                            id={switchId}
                            checked={isAllowed}
                            onCheckedChange={() => togglePermission(activeRole as ConfigurableRole, perm.key)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={handleResetAllDefaults}>
            <RotateCcw />
            Réinitialiser tous les rôles par défaut
          </Button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {!isSaving && <Save />}
            Enregistrer les permissions
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SpaceRolesTab;
