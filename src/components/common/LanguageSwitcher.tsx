'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Locale, i18n } from '@/lib/i18n-config';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC<{ currentLocale: Locale }> = ({ currentLocale }) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLanguageChange = (newLocale: Locale) => {
    if (!pathname) return;
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/') + window.location.search);
  };

  const labels: Record<Locale, string> = {
    ar: 'العربية',
    ku: 'Kurdî',
    de: 'Deutsch',
    en: 'English',
  };

  return (
    <div className="relative inline-flex shrink-0 items-center gap-1 bg-rojWarmBg px-2.5 py-1.5 rounded-full border border-gray-200">
      <Globe className="w-3.5 h-3.5 text-rojNavy" />
      <select
        value={currentLocale}
        onChange={(e) => handleLanguageChange(e.target.value as Locale)}
        aria-label="Select Language"
        className="bg-transparent text-xs font-bold text-rojNavy border-none focus:outline-none cursor-pointer"
      >
        {i18n.locales.map((loc) => (
          <option key={loc} value={loc}>
            {labels[loc]}
          </option>
        ))}
      </select>
    </div>
  );
};
