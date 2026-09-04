export const i18n = { defaultLocale: "ar", locales: ["ar", "ku", "en", "de"] } as const;
export type Locale = (typeof i18n)["locales"][number];
export const isRTL = (locale: Locale): boolean => locale === "ar";