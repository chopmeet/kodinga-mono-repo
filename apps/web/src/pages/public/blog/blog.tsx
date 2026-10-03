import { useTranslation } from 'react-i18next';

function Blog() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('blog.title')}</h1>
      <p className="mt-2 text-slate-600">{t('blog.comingSoon')}</p>
    </section>
  );
}

export default Blog;
