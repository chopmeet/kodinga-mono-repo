import { Crown, Mail, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@kodinga/ui';
import type { HackathonPage } from '../form/UseHackathonPage';
import { TeammateSuggestions } from './teammate-suggestions';
import { getName } from '@/utils/Utils';

/** Team of the participant: answer an invitation, create a team, invite teammates, leave */
function TeamPanel({ page }: { page: HackathonPage }) {
  const { t } = useTranslation();
  const h = page.hackathon;
  const team = page.myTeam;
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!h) return null;

  if (!team) {
    return (
      <section aria-labelledby="team-title" className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 id="team-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Users className="size-5 text-blue-900" /> {t('hackathon.team.mine')}
        </h2>
        {page.invitations.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2" aria-label={t('hackathon.team.invitations')}>
            {page.invitations.map((team) => (
              <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                <p className="text-sm text-slate-700">
                  <Mail className="mr-1.5 inline size-4 text-blue-900" />
                  <strong className="text-slate-900">{getName(team.leader)}</strong> {t('hackathon.team.invitesYou')} <strong className="text-slate-900">{team.name}</strong>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" isLoading={page.isResponding} onClick={() => page.respond(team.id, true)}>
                    {t('hackathon.team.join')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={page.isResponding} onClick={() => page.respond(team.id, false)}>
                    {t('hackathon.team.decline')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-slate-600">
          {t('hackathon.team.createIntro', { min: h.min_team_size, max: h.max_team_size })}
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            if (await page.createTeam(name.trim(), tagline.trim())) {
              setName('');
              setTagline('');
            }
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">{t('hackathon.team.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="custom-form-control bg-background px-4 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">{t('hackathon.team.tagline')}</span>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
          </label>
          <Button type="submit" isLoading={page.isCreatingTeam} disabled={name.trim().length < 2}>
            {t('hackathon.team.create')}
          </Button>
        </form>
      </section>
    );
  }

  const active = team.members.filter((m) => m.status === 'accepted');
  const invited = team.members.filter((m) => m.status === 'invited');
  const full = active.length >= h.max_team_size;
  const alone = active.length <= 1;

  return (
    <section aria-labelledby="team-title" className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('hackathon.team.mine')}</p>
          <h2 id="team-title" className="mt-1 text-lg font-semibold text-slate-900">
            {team.name}
          </h2>
          {team.tagline && <p className="text-sm text-slate-500">{team.tagline}</p>}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {active.length} / {h.max_team_size}
        </span>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-slate-100" aria-label={t('hackathon.team.members')}>
        {[...active, ...invited].map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-slate-800">
              {m.role === 'leader' && <Crown className="size-4 text-amber-500" aria-label={t('hackathon.team.captain')} />}
              {getName(m.user)}
              <span className="text-sm text-slate-400">@{m.user.username}</span>
            </span>
            {m.status === 'invited' && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{t('hackathon.team.invitationSent')}</span>}
          </li>
        ))}
      </ul>
      {active.length < h.min_team_size && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('hackathon.team.needMore', { min: h.min_team_size, count: h.min_team_size - active.length })}
        </p>
      )}

      {page.isLeader && !full && (
        <form
          className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!identifier.trim()) return;
            if (await page.invite(identifier.trim())) setIdentifier('');
          }}
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="custom-form-label">{t('hackathon.team.invite')}</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('hackathon.team.invitePlaceholder')}
              className="custom-form-control bg-background px-4 py-2"
            />
            <span className="text-xs text-slate-500">{t('hackathon.team.inviteHelp')}</span>
          </label>
          <Button type="submit" isLoading={page.isInviting} disabled={!identifier.trim()} className="sm:mb-5">
            <UserPlus /> {t('hackathon.team.inviteButton')}
          </Button>
        </form>
      )}

      {page.isLeader && !full && <TeammateSuggestions page={page} hackathonId={h.id} />}

      <div className="mt-5 border-t border-slate-100 pt-4">
        {!confirmLeave ? (
          <button type="button" onClick={() => setConfirmLeave(true)} className="text-sm font-semibold text-slate-500 hover:text-red-600">
            {page.isLeader && alone ? t('hackathon.team.dissolve') : t('hackathon.team.leave')}
          </button>
        ) : page.isLeader && !alone ? (
          <p className="text-sm text-slate-600">
            {t('hackathon.team.captainCannotLeave')}{' '}
            <button type="button" className="font-semibold text-blue-900" onClick={() => setConfirmLeave(false)}>
              {t('hackathon.team.understood')}
            </button>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-700">{page.isLeader ? t('hackathon.team.dissolveConfirm') : t('hackathon.team.leaveConfirm')}</span>
            <Button size="sm" variant="danger" isLoading={page.isLeaving} onClick={() => page.leaveTeam().then(() => setConfirmLeave(false))}>
              {t('hackathon.participation.confirm')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmLeave(false)}>
              {t('common.actions.cancel')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default TeamPanel;
