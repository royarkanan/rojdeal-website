import Link from "next/link";
import type { Locale } from "@/lib/i18n-config";
import { contactConfig } from "@/lib/contact-config";
const copy = {
  ar: {
    intro:
      "منصة للإعلانات المبوبة وبيع وشراء وتأجير العقارات والسيارات والآليات.",
    sections: "الأقسام",
    property: "العقارات",
    vehicles: "السيارات والآليات",
    misc: "أغراض متنوعة",
    help: "المساعدة والأمان",
    safety: "قواعد السلامة",
    contact: "التواصل والدعم",
    about: "عن المنصة",
    aboutLink: "عن RojDeal",
    terms: "الشروط",
    privacy: "الخصوصية",
    imprint: "بيانات الناشر",
    howTo: "كيفية استخدام RojDeal",
    community: "قواعد المجتمع",
    deletion: "حذف الحساب والبيانات",
    rights: "جميع الحقوق محفوظة",
  },
  ku: {
    intro: "Platforma îlanan ji bo emlak, erebe, makîne û tiştên cuda.",
    sections: "Beş",
    property: "Emlak",
    vehicles: "Erebe û makîne",
    misc: "Tiştên cuda",
    help: "Alîkarî û ewlehî",
    safety: "Rêbazên ewlehiyê",
    contact: "Têkilî û piştgirî",
    about: "Derbarê platformê",
    aboutLink: "Derbarê RojDeal",
    terms: "Merc",
    privacy: "Nepenî",
    imprint: "Agahiyên weşanger",
    howTo: "RojDeal çawa tê bikaranîn",
    community: "Rêbazên civakê",
    deletion: "Jêbirina hesab û daneyan",
    rights: "Hemû maf parastî ne",
  },
  de: {
    intro:
      "Kleinanzeigenplattform für Immobilien, Fahrzeuge, Maschinen und Verschiedenes.",
    sections: "Kategorien",
    property: "Immobilien",
    vehicles: "Fahrzeuge und Maschinen",
    misc: "Verschiedenes",
    help: "Hilfe und Sicherheit",
    safety: "Sicherheitshinweise",
    contact: "Kontakt und Support",
    about: "Über die Plattform",
    aboutLink: "Über RojDeal",
    terms: "Bedingungen",
    privacy: "Datenschutz",
    imprint: "Impressum",
    howTo: "So funktioniert RojDeal",
    community: "Community-Regeln",
    deletion: "Konto und Daten löschen",
    rights: "Alle Rechte vorbehalten",
  },
  en: {
    intro:
      "Classifieds for real estate, vehicles, machinery and miscellaneous items.",
    sections: "Categories",
    property: "Real estate",
    vehicles: "Vehicles and machinery",
    misc: "Miscellaneous",
    help: "Help and safety",
    safety: "Safety guidance",
    contact: "Contact and support",
    about: "About the platform",
    aboutLink: "About RojDeal",
    terms: "Terms",
    privacy: "Privacy",
    imprint: "Legal notice",
    howTo: "How to use RojDeal",
    community: "Community rules",
    deletion: "Delete account and data",
    rights: "All rights reserved",
  },
} as const;
export function Footer({
  lang,
}: {
  lang: Locale;
  dict: Record<string, unknown>;
}) {
  const t = copy[lang];
  return (
    <footer id="site-footer" className="mb-[calc(100px+env(safe-area-inset-bottom))] mt-12 border-t border-gray-800 bg-rojNavy text-white md:mb-0">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4 lg:gap-6">
          <div>
            <h4 className="mb-3 text-sm font-black">RojDeal</h4>
            <p className="text-xs leading-relaxed text-gray-400">{t.intro}</p>
            <a
              className="mt-3 block break-all text-xs text-rojRed"
              dir="ltr"
              href={`mailto:${contactConfig.supportEmail}`}
            >
              {contactConfig.supportEmail}
            </a>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold">{t.sections}</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <Link href={`/${lang}/search?category=real_estate`}>
                  {t.property}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/search?category=vehicles`}>
                  {t.vehicles}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/search?category=miscellaneous`}>
                  {t.misc}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold">{t.help}</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <Link href={`/${lang}/safety`}>{t.safety}</Link>
              </li>
              <li>
                <Link href={`/${lang}/contact`}>{t.contact}</Link>
              </li>
              <li><Link href={`/${lang}/how-to`}>{t.howTo}</Link></li>
              <li><Link href={`/${lang}/community-rules`}>{t.community}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold">{t.about}</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <Link href={`/${lang}/about`}>{t.aboutLink}</Link>
              </li>
              <li>
                <Link href={`/${lang}/terms`}>{t.terms}</Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
              </li>
              <li>
                <Link href={`/${lang}/imprint`}>{t.imprint}</Link>
              </li>
              <li><Link href={`/${lang}/legal-documents`}>{({ar:"المعلومات القانونية",ku:"Agahiyên hiqûqî",de:"Rechtliche Informationen",en:"Legal information"})[lang]}</Link></li>
              <li><Link href={`/${lang}/account-deletion`}>{t.deletion}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} RojDeal. {t.rights}.
        </div>
      </div>
    </footer>
  );
}
