import { LogOut, Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { Button, InputPassword } from '@kodinga-mono-repo/ui';
import type { UserSession } from '@/utils/api/profile/profile.type';
import { ago } from '@/utils/Utils';
import UseAccountSecurity from '../form/UseAccountSecurity';
import { GoKey } from 'react-icons/go';

/** "Chrome · Linux" from the user agent, when the api has no device name */
export function deviceOf(s: UserSession) {
  if (s.device_name) return s.device_name;
  const ua = s.user_agent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}

/** /dashboard/profile/security — change the password, see and close the sessions */
function SecurityTab() {
  const security = UseAccountSecurity();
  const [confirmAll, setConfirmAll] = useState(false);
  const {
    register,
    formState: { errors },
  } = security.form;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="password-title" className="max-w-lg">
        <h2 id="password-title" className="font-semibold text-slate-900">
          Mot de passe
        </h2>
        <p className="mt-1 text-sm text-slate-500">Au moins 8 caractères, évitez les mots de passe trop courants.</p>
        <form noValidate onSubmit={security.submitPassword} className="mt-4">
          <InputPassword 
            id="__current_password" 
            label="Mot de passe actuel" 
            autoComplete="current-password" 
            icon={<GoKey />}
            required 
            error={errors.current_password?.message} 
            {...register('current_password')} 
          />
          <InputPassword 
            id="__new_password" 
            label="Nouveau mot de passe" 
            autoComplete="new-password" 
            icon={<GoKey />}
            required 
            error={errors.new_password?.message} 
            {...register('new_password')} 
          />
          <InputPassword 
            id="__confirm_password" 
            label="Confirmer le nouveau mot de passe" 
            autoComplete="new-password" 
            icon={<GoKey />}
            required 
            error={errors.confirm_password?.message} 
            {...register('confirm_password')} 
          />
          <Button type="submit" isLoading={security.isChanging}>
            Modifier le mot de passe
          </Button>
        </form>
      </section>

      <section aria-labelledby="sessions-title">
        <h2 id="sessions-title" className="font-semibold text-slate-900">
          Appareils connectés
        </h2>
        <p className="mt-1 text-sm text-slate-500">Vous ne reconnaissez pas un appareil ? Déconnectez-le, puis changez votre mot de passe.</p>
        {security.isLoadingSessions ? (
          <p className="mt-4 text-sm text-slate-500">Chargement…</p>
        ) : security.sessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucune session active.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Appareils connectés">
            {security.sessions.map((s) => {
              const mobile = /Android|iPhone|iPad|Mobile/.test(s.user_agent || '');
              const Icon = mobile ? Smartphone : Monitor;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="size-5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{deviceOf(s)}</p>
                      <p className="text-xs text-slate-500">
                        {[s.ip_address, `Connecté ${ago(s.created_at).toLowerCase()}`, s.last_seen_at ? `vu ${ago(s.last_seen_at).toLowerCase()}` : ''].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" isLoading={security.revokingId === s.id} onClick={() => security.revoke(s.id)}>
                    Déconnecter
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          {!confirmAll ? (
            <Button variant="danger" onClick={() => setConfirmAll(true)}>
              <LogOut /> Se déconnecter de tous les appareils
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              <span>Tous vos appareils seront déconnectés, celui-ci compris.</span>
              <Button size="sm" variant="danger" isLoading={security.isLoggingOutAll} onClick={security.logoutEverywhere}>
                Confirmer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmAll(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default SecurityTab;
