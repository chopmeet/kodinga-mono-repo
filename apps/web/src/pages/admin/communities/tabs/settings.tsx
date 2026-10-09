import { getCommunityRules } from '@/data/admin-community-details.data';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';

const postPermissionLabel = {
  all_members: 'Tous les membres',
  moderators_only: 'Modérateurs et administrateurs',
  admins_only: 'Administrateurs uniquement',
} as const;

const yesNo = (v: boolean) => (v ? 'Oui' : 'Non');

function CommunitySettingsTab() {
  const community = useDetailsCommunity();
  const { rules, settings } = getCommunityRules(community);

  const rows = [
    { label: 'Adhésion soumise à approbation', value: yesNo(settings.require_approval_to_join) },
    { label: 'Les membres peuvent inviter', value: yesNo(settings.allow_member_invites) },
    { label: 'Qui peut publier', value: postPermissionLabel[settings.default_post_permission] },
    { label: 'Message de bienvenue', value: settings.welcome_message },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Règles de la communauté</h2>
        <ol className="mt-3 space-y-3">
          {rules.map((rule, i) => (
            <li key={rule.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-slate-900">{rule.title}</p>
                <p className="text-sm text-slate-500">{rule.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Paramètres</h2>
        <dl className="mt-3 divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:justify-between sm:gap-6">
              <dt className="text-sm text-slate-500">{row.label}</dt>
              <dd className="text-sm font-medium text-slate-900 sm:text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">Lecture seule : ces réglages appartiennent au propriétaire de la communauté.</p>
      </section>
    </div>
  );
}

export default CommunitySettingsTab;
