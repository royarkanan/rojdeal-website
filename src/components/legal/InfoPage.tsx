"use client";
import { useEffect, useState } from "react";
import { contactConfig } from "@/lib/contact-config";
import type { Locale } from "@/lib/i18n-config";
import { managedPage } from "@/services/platform-content";
import { OperatorDetails } from "./OperatorDetails";
type Kind = "about" | "safety" | "privacy" | "terms" | "imprint";
type Section = { title: string; body: string };
const content: Record<
  Locale,
  Record<Kind, { title: string; intro: string; sections: Section[] }>
> = {
  ar: {
    about: {
      title: "عن RojDeal",
      intro:
        "منصة إعلانات مبوبة تربط البائعين والمشترين في العقارات والسيارات والآليات والأغراض المتنوعة.",
      sections: [
        {
          title: "مهمتنا",
          body: "تسهيل عرض الإعلانات والبحث والتواصل بأربع لغات مع تجربة واضحة وآمنة.",
        },
        {
          title: "دور المنصة",
          body: "RojDeal وسيط تقني للإعلانات والتواصل، وليس طرفاً في البيع أو الإيجار ولا يحتفظ بأموال الصفقات.",
        },
      ],
    },
    safety: {
      title: "المساعدة وقواعد السلامة",
      intro: "تحقق قبل الدفع أو التسليم ولا ترسل بيانات حساسة في الرسائل.",
      sections: [
        {
          title: "قبل الصفقة",
          body: "افحص السلعة والملكية وهوية الطرف الآخر، والتقِ في مكان آمن، واستخدم عقداً مناسباً للعقار أو السيارة.",
        },
        {
          title: "احمِ حسابك",
          body: "لا ترسل كلمة المرور أو رمز التحقق أو صور الوثائق أو المعلومات البنكية لأي شخص.",
        },
        {
          title: "البلاغ والدعم",
          body: "أبلغ عن الإعلانات أو الرسائل المشبوهة وتواصل مع الدعم عند الاشتباه بالاحتيال.",
        },
      ],
    },
    privacy: {
      title: "سياسة الخصوصية",
      intro:
        "نستخدم البيانات اللازمة لتشغيل RojDeal وحماية المستخدمين، ولا نبيع البيانات الشخصية.",
      sections: [
        {
          title: "البيانات التي نعالجها",
          body: "بيانات التسجيل والملف الشخصي والتواصل، الإعلانات والصور والفيديو والموقع، المفضلة والرسائل والبلاغات وطلبات الدعم، إضافة إلى السجلات التقنية والأمنية.",
        },
        {
          title: "أغراض الاستخدام",
          body: "إنشاء الحساب، نشر الإعلانات والبحث، المحادثات، مراجعة المحتوى، الدعم، منع الإساءة وحماية المنصة.",
        },
        {
          title: "مقدمو الخدمة",
          body: "قد تعالج Supabase ومقدمو الاستضافة والتخزين والتسليم التقني البيانات بالقدر اللازم لتقديم الخدمة.",
        },
        {
          title: "الحفظ والحذف",
          body: "يمكن طلب حذف الحساب والبيانات المرتبطة به، مع احتفاظ محدود عندما يفرض القانون ذلك أو يلزم لمنع الاحتيال وحماية الحقوق.",
        },
        {
          title: "التواصل",
          body: `طلبات الخصوصية: ${contactConfig.supportEmail}`,
        },
      ],
    },
    terms: {
      title: "شروط الاستخدام",
      intro: "باستخدام RojDeal توافق على استخدام المنصة بصورة قانونية وصحيحة.",
      sections: [
        {
          title: "الإعلانات",
          body: "يجب أن يصف الإعلان شيئاً حقيقياً يحق للمعلن عرضه، وأن تكون الصور والسعر والموقع والحالة صحيحة. الإعلانات المضللة أو المكررة ممنوعة.",
        },
        {
          title: "المحتوى المحظور",
          body: "تُمنع السلع المسروقة والأسلحة والمواد الخطرة والمخدرات والوثائق الشخصية والتزوير والاتجار بالبشر والخدمات غير القانونية وانتهاك حقوق الآخرين.",
        },
        {
          title: "الصفقات",
          body: "يتحمل البائع والمشتري مسؤولية الفحص والعقد والدفع والتسليم والضرائب والالتزام بالقانون. RojDeal ليس طرفاً في الصفقة.",
        },
        {
          title: "المراجعة والإدارة",
          body: "يمكن للإدارة إخفاء المحتوى أو حذف الإعلان أو تقييد الحساب عند مخالفة القواعد. الفيديو لا يظهر قبل موافقة الإدارة.",
        },
      ],
    },
    imprint: {
      title: "بيانات الناشر",
      intro: "معلومات الجهة المسؤولة عن موقع وتطبيق RojDeal.",
      sections: [
        {
          title: "الجهة المسؤولة",
          body:
            contactConfig.legalName ||
            "يجب إضافة الاسم القانوني قبل نشر الموقع.",
        },
        {
          title: "العنوان",
          body:
            contactConfig.legalAddress ||
            "يجب إضافة العنوان القانوني قبل نشر الموقع.",
        },
        { title: "البريد", body: contactConfig.supportEmail },
      ],
    },
  },
  ku: {
    about: {
      title: "Derbarê RojDeal",
      intro: "Platforma îlanan ji bo emlak, erebe, makîne û tiştên cuda.",
      sections: [
        {
          title: "Armanc",
          body: "Weşandin, lêgerîn û têkilî bi çar zimanan hêsan û ewle bike.",
        },
        {
          title: "Rola platformê",
          body: "RojDeal navgîna teknîkî ye; ne aliyê firotin an kirêkirinê ye û pereyê danûstandinê nagire.",
        },
      ],
    },
    safety: {
      title: "Alîkarî û ewlehî",
      intro: "Berî dayîn an radestkirinê hemû agahiyan kontrol bike.",
      sections: [
        {
          title: "Berî danûstandinê",
          body: "Mal, xwedîtî û nasnameyê kontrol bike û li cihê ewle hevdîtin bike.",
        },
        {
          title: "Hesabê biparêze",
          body: "Şîfre, koda piştrastkirinê, belge an agahiyên bankê neşîne.",
        },
        {
          title: "Ragihandin",
          body: "Îlan û peyamên gumanbar ragihîne û bi piştgiriyê re têkilî dayne.",
        },
      ],
    },
    privacy: {
      title: "Siyaseta nepeniyê",
      intro:
        "Em daneyên pêwîst ji bo xebitandin û parastina RojDeal dixebitînin û daneyên kesane nafiroşin.",
      sections: [
        {
          title: "Dane",
          body: "Têketin, profîl, têkilî, îlan, wêne, vîdyo, cih, bijare, peyam, ragihandin û daxwazên piştgiriyê.",
        },
        {
          title: "Armanc",
          body: "Hesab, weşandin, lêgerîn, sohbet, kontrol, piştgirî û rêgirtina xerabkariyê.",
        },
        {
          title: "Pêşkêşker",
          body: "Supabase û pêşkêşkerên mêvandariyê û depokirinê tenê bi qasî pêwîst daneyan dixebitînin.",
        },
        {
          title: "Jêbirin",
          body: "Daxwaza jêbirina hesabê dikare were kirin; daneyên qanûnî dikarin bi sînor werin ragirtin.",
        },
        { title: "Têkilî", body: contactConfig.supportEmail },
      ],
    },
    terms: {
      title: "Mercên bikaranînê",
      intro: "Bikaranîna RojDeal divê qanûnî û rast be.",
      sections: [
        {
          title: "Îlan",
          body: "Îlan divê rast be û wêne, biha, cih û rewş rast bin.",
        },
        {
          title: "Qedexe",
          body: "Tiştên dizî, çek, madeyên xeternak, narkotîk, belgeyên kesane, sextekari û karên neqanûnî qedexe ne.",
        },
        {
          title: "Danûstandin",
          body: "Firoşkar û kiryar ji kontrol, peyman, dayîn û radestkirinê berpirsiyar in.",
        },
        {
          title: "Kontrol",
          body: "Rêveber dikare naveroka binpêkirî rake; vîdyo piştî pejirandinê xuya dibe.",
        },
      ],
    },
    imprint: {
      title: "Agahiyên weşanger",
      intro: "Agahiyên berpirsiyarê RojDeal.",
      sections: [
        {
          title: "Berpirsiyar",
          body:
            contactConfig.legalName || "Berî weşandinê navê qanûnî zêde bike.",
        },
        {
          title: "Navnîşan",
          body:
            contactConfig.legalAddress ||
            "Berî weşandinê navnîşana qanûnî zêde bike.",
        },
        { title: "E-name", body: contactConfig.supportEmail },
      ],
    },
  },
  de: {
    about: {
      title: "Über RojDeal",
      intro:
        "Eine Kleinanzeigenplattform für Immobilien, Fahrzeuge, Maschinen und Verschiedenes.",
      sections: [
        {
          title: "Unsere Aufgabe",
          body: "Anzeigen, Suche und Kontakt in vier Sprachen einfach und sicher zugänglich machen.",
        },
        {
          title: "Rolle der Plattform",
          body: "RojDeal vermittelt Anzeigen und Kommunikation, ist aber keine Partei eines Kauf- oder Mietvertrags und verwahrt keine Transaktionsgelder.",
        },
      ],
    },
    safety: {
      title: "Hilfe und Sicherheit",
      intro: "Prüfe Ware, Eigentum und Identität vor Zahlung oder Übergabe.",
      sections: [
        {
          title: "Vor dem Geschäft",
          body: "Triff dich sicher, prüfe Unterlagen und verwende bei Immobilien oder Fahrzeugen geeignete Verträge.",
        },
        {
          title: "Konto schützen",
          body: "Sende niemals Passwörter, Bestätigungscodes, Ausweisbilder oder Bankdaten im Chat.",
        },
        {
          title: "Melden",
          body: "Melde verdächtige Anzeigen oder Nachrichten und kontaktiere bei Betrugsverdacht den Support.",
        },
      ],
    },
    privacy: {
      title: "Datenschutzerklärung",
      intro:
        "Wir verarbeiten erforderliche Daten für Betrieb und Schutz von RojDeal und verkaufen keine personenbezogenen Daten.",
      sections: [
        {
          title: "Verarbeitete Daten",
          body: "Registrierungs-, Profil- und Kontaktdaten, Anzeigen, Fotos, Videos, Standorte, Favoriten, Nachrichten, Meldungen, Supportanfragen sowie technische Sicherheitsprotokolle.",
        },
        {
          title: "Zwecke",
          body: "Kontoführung, Veröffentlichung, Suche, Chat, Moderation, Support, Missbrauchsprävention und Plattformsicherheit.",
        },
        {
          title: "Dienstleister",
          body: "Supabase sowie Hosting-, Speicher- und technische Zustelldienste können Daten im erforderlichen Umfang verarbeiten.",
        },
        {
          title: "Speicherung und Löschung",
          body: "Kontolöschung kann beantragt werden. Gesetzlich notwendige oder zur Betrugsprävention und Rechtsverteidigung erforderliche Daten können begrenzt gespeichert bleiben.",
        },
        {
          title: "Kontakt",
          body: `Datenschutzanfragen: ${contactConfig.supportEmail}`,
        },
      ],
    },
    terms: {
      title: "Nutzungsbedingungen",
      intro: "RojDeal darf nur rechtmäßig und wahrheitsgemäß genutzt werden.",
      sections: [
        {
          title: "Anzeigen",
          body: "Anzeigen müssen echte, rechtmäßig angebotene Gegenstände, Immobilien oder Fahrzeuge beschreiben. Bilder, Preis, Standort und Zustand müssen stimmen.",
        },
        {
          title: "Verbotene Inhalte",
          body: "Gestohlene Ware, Waffen, Gefahrstoffe, Drogen, personenbezogene Dokumente, Fälschungen, Menschenhandel, illegale Dienste und Rechtsverletzungen sind verboten.",
        },
        {
          title: "Geschäfte",
          body: "Käufer und Verkäufer verantworten Prüfung, Vertrag, Zahlung, Übergabe, Steuern und Rechtmäßigkeit. RojDeal ist nicht Vertragspartei.",
        },
        {
          title: "Moderation",
          body: "Regelwidrige Inhalte können verborgen oder entfernt und Konten beschränkt werden. Videos erscheinen erst nach Freigabe.",
        },
      ],
    },
    imprint: {
      title: "Impressum",
      intro: "Anbieterinformationen für Website und RojDeal-App.",
      sections: [
        {
          title: "Diensteanbieter",
          body:
            contactConfig.legalName ||
            "Vor Veröffentlichung muss hier der vollständige rechtliche Name eingetragen werden.",
        },
        {
          title: "Anschrift",
          body:
            contactConfig.legalAddress ||
            "Vor Veröffentlichung muss hier eine ladungsfähige Anschrift eingetragen werden.",
        },
        { title: "Kontakt", body: contactConfig.supportEmail },
      ],
    },
  },
  en: {
    about: {
      title: "About RojDeal",
      intro:
        "A classifieds platform for real estate, vehicles, machinery and miscellaneous items.",
      sections: [
        {
          title: "Mission",
          body: "Make listing, search and communication accessible and safe in four languages.",
        },
        {
          title: "Platform role",
          body: "RojDeal provides listing and communication tools but is not a party to a sale or rental and does not hold transaction funds.",
        },
      ],
    },
    safety: {
      title: "Help and safety",
      intro:
        "Verify the item, ownership and identity before payment or delivery.",
      sections: [
        {
          title: "Before a transaction",
          body: "Meet safely, inspect documents and use suitable contracts for real estate or vehicles.",
        },
        {
          title: "Protect your account",
          body: "Never send passwords, verification codes, identity documents or bank details through chat.",
        },
        {
          title: "Report",
          body: "Report suspicious listings or messages and contact support if fraud is suspected.",
        },
      ],
    },
    privacy: {
      title: "Privacy policy",
      intro:
        "We process data required to operate and protect RojDeal and do not sell personal data.",
      sections: [
        {
          title: "Data processed",
          body: "Registration, profile and contact data, listings, photos, videos, locations, favourites, messages, reports, support requests and technical security logs.",
        },
        {
          title: "Purposes",
          body: "Accounts, publishing, search, chat, moderation, support, abuse prevention and platform security.",
        },
        {
          title: "Providers",
          body: "Supabase and technical hosting, storage and delivery services may process data as required to provide the service.",
        },
        {
          title: "Retention and deletion",
          body: "Account deletion can be requested. Limited data may be retained where required by law or necessary for fraud prevention and legal defence.",
        },
        {
          title: "Contact",
          body: `Privacy requests: ${contactConfig.supportEmail}`,
        },
      ],
    },
    terms: {
      title: "Terms of use",
      intro: "RojDeal must be used lawfully and truthfully.",
      sections: [
        {
          title: "Listings",
          body: "Listings must describe genuine items, property or vehicles that the advertiser may lawfully offer. Images, price, location and condition must be accurate.",
        },
        {
          title: "Prohibited content",
          body: "Stolen goods, weapons, hazardous substances, drugs, personal documents, counterfeits, trafficking, illegal services and rights violations are prohibited.",
        },
        {
          title: "Transactions",
          body: "Buyer and seller are responsible for inspection, contracts, payment, delivery, taxes and legal compliance. RojDeal is not a contracting party.",
        },
        {
          title: "Moderation",
          body: "Violating content may be hidden or removed and accounts restricted. Videos appear only after approval.",
        },
      ],
    },
    imprint: {
      title: "Legal notice",
      intro: "Provider information for the RojDeal website and app.",
      sections: [
        {
          title: "Provider",
          body:
            contactConfig.legalName ||
            "The legal provider name must be added before publication.",
        },
        {
          title: "Address",
          body:
            contactConfig.legalAddress ||
            "A legal service address must be added before publication.",
        },
        { title: "Contact", body: contactConfig.supportEmail },
      ],
    },
  },
};
export function InfoPage({ lang, kind }: { lang: Locale; kind: Kind }) {
  const page = content[lang][kind],
    [remote, setRemote] = useState({ title: "", content: "" });
  useEffect(() => {
    let active = true;
    setRemote({ title: "", content: "" });
    void managedPage(kind, lang)
      .then((value) => { if (active) setRemote(value); })
      .catch(() => { if (active) setRemote({ title: "", content: "" }); });
    return () => { active = false; };
  }, [kind, lang]);
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <header className="rounded-[24px] bg-rojNavy p-6 text-white">
        <h1 className="text-2xl font-black">{remote.title || page.title}</h1>
        <p className="mt-2 text-sm leading-7 opacity-80">
          {remote.content ? remote.content.split(/\n\n+/)[0] : page.intro}
        </p>
      </header>
      {(kind === "imprint" || kind === "privacy" || kind === "about") && <OperatorDetails lang={lang} />}
      {remote.content ? (
        <section className="rounded-[22px] bg-white p-6 shadow-sm">
          <div className="whitespace-pre-line text-sm leading-8 text-gray-700">
            {remote.content}
          </div>
        </section>
      ) : (
        page.sections.map((s) => (
          <section
            key={s.title}
            className="rounded-[22px] bg-white p-6 shadow-sm"
          >
            <h2 className="mb-2 text-lg font-black text-rojRed">{s.title}</h2>
            <p className="whitespace-pre-line text-sm leading-7 text-gray-700">
              {s.body}
            </p>
          </section>
        ))
      )}
    </article>
  );
}
