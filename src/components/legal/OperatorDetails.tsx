import Link from "next/link";
import { contactConfig } from "@/lib/contact-config";
import type { Locale } from "@/lib/i18n-config";

const copy = {
  ar: { title: "مشغّل RojDeal والمسؤول عن معالجة البيانات", person: "يشغّل Royar Kanan المنصة باسمه الشخصي. RojDeal اسم المنصة.", contact: "التواصل والدعم", privacy: "الخصوصية", deletion: "حذف الحساب والبيانات" },
  ku: { title: "Rêvebirê RojDeal û berpirsiyarê daneyan", person: "Royar Kanan platformê bi navê xwe yê kesane dimeşîne. RojDeal navê platformê ye.", contact: "Têkilî û piştgirî", privacy: "Nepenî", deletion: "Jêbirina hesab û daneyan" },
  de: { title: "Betreiber und Verantwortlicher für die Datenverarbeitung", person: "Royar Kanan betreibt die Plattform im eigenen Namen. RojDeal ist der Plattformname.", contact: "Kontakt und Support", privacy: "Datenschutz", deletion: "Konto und Daten löschen" },
  en: { title: "Platform operator and data controller", person: "Royar Kanan operates the platform in his own name. RojDeal is the platform name.", contact: "Contact and support", privacy: "Privacy", deletion: "Account and data deletion" },
};

export function OperatorDetails({ lang }: { lang: Locale }) {
  const t = copy[lang];
  return <section className="rounded-[22px] bg-white p-6 shadow-sm">
    <h2 className="mb-3 text-lg font-black text-rojRed">{t.title}</h2>
    <p className="mb-3 text-sm leading-7">{t.person}</p>
    <address className="space-y-2 break-words not-italic" dir="ltr">
      <p>{contactConfig.legalName}</p>
      <p>{contactConfig.legalAddress}</p>
      <p><a className="underline" href={`mailto:${contactConfig.supportEmail}`}>{contactConfig.supportEmail}</a></p>
      <p><a className="underline" href="https://rojdeal.app">rojdeal.app</a></p>
    </address>
    <nav className="mt-4 flex flex-wrap gap-4 text-sm underline" aria-label={t.contact}>
      <Link href={`/${lang}/contact`}>{t.contact}</Link>
      <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
      <Link href={`/${lang}/account-deletion`}>{t.deletion}</Link>
    </nav>
  </section>;
}
