import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { customToast, SelectInput } from '@kodinga-mono-repo/ui';
import SettingSwitch from '@/pages/shared/setting-switch';

interface AISettingsData {
  ai_translation_enabled: boolean;
  default_community_language: string;
  supported_languages: string[];
  sentiment_analytics_enabled: boolean;
  non_mandatory_moderation: Record<string, boolean>;
  moderation_strictness: string;
  platform_locked_rules?: {
    prohibit_sexual_harassment: boolean;
    prohibit_targeted_harassment: boolean;
    prohibit_hate_speech_and_bullying: boolean;
    mandatory_pre_publication_moderation: boolean;
    fail_closed_on_outage: boolean;
    notice: string;
  };
}

export function SpaceAITab() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AISettingsData>({
    ai_translation_enabled: true,
    default_community_language: 'fr',
    supported_languages: ['fr', 'en', 'wo', 'bm'],
    sentiment_analytics_enabled: true,
    non_mandatory_moderation: { profanity: false, spam: true },
    moderation_strictness: 'standard',
  });

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/communities/${slug}/ai-settings/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res?.data) {
          setSettings(res.data);
        }
      })
      .catch((err) => console.error('Error fetching AI settings:', err))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/communities/${slug}/ai-settings/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_translation_enabled: settings.ai_translation_enabled,
          default_community_language: settings.default_community_language,
          supported_languages: settings.supported_languages,
          sentiment_analytics_enabled: settings.sentiment_analytics_enabled,
          non_mandatory_moderation: settings.non_mandatory_moderation,
          moderation_strictness: settings.moderation_strictness,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          setSettings(data.data);
        }
        customToast.success({ message: 'Paramètres d’intelligence artificielle enregistrés.' });
      } else {
        customToast.error({ message: 'Échec de l’enregistrement des paramètres IA.' });
      }
    } catch {
      customToast.error({ message: 'Erreur réseau lors de l’enregistrement.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Chargement des paramètres d’intelligence artificielle...</div>;
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Intelligence Artificielle & Modération</h2>
          <p className="text-sm text-slate-500">
            Configurez la traduction multilingue, l'analyse de sentiment et les règles optionnelles.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Gemini 2.5 (Prioritaire) + OpenAI
        </span>
      </div>

      {/* 1. Traduction multilingue */}
      <div className="mt-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Traduction Automatique Multilingue
        </h3>

        <SettingSwitch
          label="Traduction multilingue automatique"
          description="Traduit automatiquement les messages vers la langue préférée de chaque membre (Wolof, Bambara, Français, Anglais) avec conservation de l'original."
          checked={settings.ai_translation_enabled}
          onChange={(checked) => setSettings({ ...settings, ai_translation_enabled: checked })}
        />

        <div className="grid gap-4 md:grid-cols-2 pt-2">
          <SelectInput
            label="Langue principale par défaut"
            fieldHelp="Langue de référence suggérée pour les nouvelles publications de la communauté."
            value={settings.default_community_language}
            onChange={(e) => setSettings({ ...settings, default_community_language: e.target.value })}
            options={[
              { value: 'fr', label: 'Français (fr)' },
              { value: 'en', label: 'English (en)' },
              { value: 'wo', label: 'Wolof (wo)' },
              { value: 'bm', label: 'Bambara (bm)' },
            ]}
          />

          <SelectInput
            label="Sensibilité de modération optionnelle"
            fieldHelp="Niveau de rigueur pour les filtres secondaires (insultes, spam)."
            value={settings.moderation_strictness}
            onChange={(e) => setSettings({ ...settings, moderation_strictness: e.target.value })}
            options={[
              { value: 'relaxed', label: 'Souple (débat ouvert)' },
              { value: 'standard', label: 'Standard (recommandé)' },
              { value: 'strict', label: 'Strict (modération accrue)' },
            ]}
          />
        </div>
      </div>

      {/* 2. Analyse de sentiment */}
      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Analytique & Sentiment
        </h3>

        <SettingSwitch
          label="Activer l'analyse de sentiment de la communauté"
          description="Mesure les tendances positives, neutres et négatives de manière anonymisée. La critique technique légitime n'est jamais censurée."
          checked={settings.sentiment_analytics_enabled}
          onChange={(checked) => setSettings({ ...settings, sentiment_analytics_enabled: checked })}
        />
      </div>

      {/* 3. Modération optionnelle */}
      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Modération Personnalisée (Règles optionnelles)
        </h3>

        <SettingSwitch
          label="Filtrer la vulgarité & gros mots légers"
          description="Place en file d'attente de modération les messages contenant des vulgarités ou jurons répétés."
          checked={Boolean(settings.non_mandatory_moderation?.profanity)}
          onChange={(checked) =>
            setSettings({
              ...settings,
              non_mandatory_moderation: { ...settings.non_mandatory_moderation, profanity: checked },
            })
          }
        />

        <SettingSwitch
          label="Filtrer le spam et démarchage commercial"
          description="Détecte et bloque automatiquement les liens suspects, le phishing et la promotion abusive."
          checked={Boolean(settings.non_mandatory_moderation?.spam ?? true)}
          onChange={(checked) =>
            setSettings({
              ...settings,
              non_mandatory_moderation: { ...settings.non_mandatory_moderation, spam: checked },
            })
          }
        />
      </div>

      {/* 4. Protections Plateforme Verrouillées (Invariants non modifiables) */}
      <div className="mt-8 p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
        <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
          <span>🔒</span>
          <span>Règles de Sécurité Verrouillées (Non désactivables)</span>
        </div>
        <p className="text-xs text-blue-800 leading-relaxed">
          Pour préserver la sécurité de tous les membres et la légalité des échanges, les protections suivantes sont
          strictement appliquées en continu par Kodinga avant chaque publication :
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-950 font-medium">
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Interdiction du harcèlement sexuel & abus
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Interdiction du harcèlement ciblé & menaces
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Interdiction de l'humiliation & dénigrement
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Modération préalable obligatoire (Fail-Closed)
          </li>
        </ul>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Enregistrement en cours...' : 'Enregistrer les paramètres IA'}
        </button>
      </div>

      <CommunityImprovementSection slug={slug} />
    </form>
  );
}

function CommunityImprovementSection({ slug }: { slug?: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const runAnalysis = async () => {
    if (!slug || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/v1/ai-assistant/analyze-community/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: slug, language: 'fr' }),
      });
      const data = await res.json();
      if (data?.data) {
        setAnalysis(data.data);
        customToast.success('Diagnostic communautaire généré avec succès !');
      } else {
        customToast.error(data?.error || 'Erreur lors du diagnostic.');
      }
    } catch {
      customToast.error("Service d'analyse IA indisponible.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>🚀</span>
            <span>Assistant d'Amélioration & Diagnostic Communautaire</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Analyse vos métriques réelles (membres, publications récentes, questions en attente) et suggère des actions concrètes.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={analyzing}
          className="shrink-0 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 shadow-sm"
        >
          {analyzing ? 'Analyse en cours...' : 'Lancer le diagnostic IA'}
        </button>
      </div>

      {analysis && (
        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {/* Real Metrics Badges */}
          {analysis.metrics_summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                <span className="text-[11px] text-slate-500 block">Membres</span>
                <span className="text-lg font-bold text-slate-900">{analysis.metrics_summary.members_count ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                <span className="text-[11px] text-slate-500 block">Posts (30j)</span>
                <span className="text-lg font-bold text-slate-900">{analysis.metrics_summary.recent_posts_30d ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                <span className="text-[11px] text-slate-500 block">Questions sans réponse</span>
                <span className="text-lg font-bold text-amber-600">{analysis.metrics_summary.unanswered_questions_count ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
                <span className="text-[11px] text-slate-500 block">Événements à venir</span>
                <span className="text-lg font-bold text-brand">{analysis.metrics_summary.upcoming_events_count ?? 0}</span>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Diagnostic Global :</h4>
            <p className="mt-1 text-xs text-slate-800 leading-relaxed bg-white rounded-xl p-3 border border-slate-200">
              {analysis.overview_assessment}
            </p>
          </div>

          {analysis.actionable_recommendations && analysis.actionable_recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Recommandations d'Actions :</h4>
              <div className="space-y-2">
                {analysis.actionable_recommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{rec.title}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{rec.rationale}</p>
                    {rec.action_draft && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs font-mono text-slate-700 border border-slate-100">
                        {rec.action_draft}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SpaceAITab;

