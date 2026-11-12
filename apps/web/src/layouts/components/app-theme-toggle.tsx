import { useTranslation } from 'react-i18next';

import { ThemeToggle } from '@kodinga/ui';

/** The theme menu of the kit, in the language of the interface */
export function AppThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ThemeToggle
      className={className}
      labels={{ toggle: t('header.theme.toggle'), light: t('header.theme.light'), dark: t('header.theme.dark'), system: t('header.theme.system') }}
    />
  );
}
