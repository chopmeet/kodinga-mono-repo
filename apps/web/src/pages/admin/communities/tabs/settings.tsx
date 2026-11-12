import { useDetailsCommunity } from '../form/UseCommunityFromParams';

const postPermissionLabel = {
  all_members: 'Tous les membres',
  moderators_only: 'Modérateurs et administrateurs',
  admins_only: 'Administrateurs uniquement',
} as const;

const yesNo = (v: boolean) => (v ? 'Oui' : 'Non');

function CommunitySettingsTab() {
  const community = useDetailsCommunity();
  // Both come with GET communities/<slug>/
  const rules = [...(community.rules ?? [])].sort((a, b) => a.order - b.order);
  const settings = community.settings;

  const rows = settings
    ? [
        { label: 'Adhésion soumise à approbation', value: yesNo(settings.require_approval_to_join) },
        { label: 'Les membres peuvent inviter', value: yesNo(settings.allow_member_invites) },
        { label: 'Qui peut publier', value: postPermissionLabel[settings.default_post_permission] },
        { label: 'Message de bienvenue', value: settings.welcome_message || '—' },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Règles de la communauté</h2>
        <ol className="mt-3 space-y-3">
          {rules.length === 0 && <li className="text-sm text-muted-foreground">Aucune règle définie.</li>}
          {rules.map((rule, i) => (
            <li key={rule.id} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-body">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{rule.title}</p>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Paramètres</h2>
        <dl className="mt-3 divide-y divide-border-soft">
          {rows.length === 0 && <p className="py-2.5 text-sm text-muted-foreground">Paramètres non définis.</p>}
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:justify-between sm:gap-6">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium text-foreground sm:text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Lecture seule : ces réglages appartiennent au propriétaire de la communauté.</p>
      </section>
    </div>
  );
}

export default CommunitySettingsTab;
