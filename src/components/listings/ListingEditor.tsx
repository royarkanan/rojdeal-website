"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createListing,
  SavedDraftError,
  listingSaveProgress,
  listingCatalog,
  listingVideoPolicy,
  locationChoices,
  rawOwnListing,
  updateListing,
  type ListingDraft,
  type CatalogCategory,
  type LocationChoice,
} from "@/services/listing-editor";
import type { Locale } from "@/lib/i18n-config";
import { ArrowLeft, Camera, FileImage, Trash2 } from "lucide-react";
import {FilePreview} from './FilePreview';
import {ExistingListingMedia} from './ExistingListingMedia';
import {GeoLocationFields} from './GeoLocationFields';
import {inspectVideo} from '@/lib/video-file';
import {getCountries,getCountryCallingCode,parsedPhone,normalizedPhone,changePhoneCountry,phoneInput,type CountryCode} from '@/lib/phone';

import { supabase } from '@/lib/supabase';
import { needsListingLogin } from '@/lib/auth-return';
import { listingError, listingFeedback } from '@/lib/listing-feedback';

const copy = {
  ar: {
    create: "أضف إعلانًا",
    edit: "تعديل الإعلان",
    title: "عنوان الإعلان",
    description: "الوصف",
    category: "القسم",
    property: "العقارات",
    vehicle: "السيارات والآليات",
    other: "أغراض متنوعة",
    purpose: "نوع العرض",
    direction: "ماذا تريد؟",
    offer: "أريد أن أعرض",
    wanted: "أبحث عن",
    transaction: "طريقة الصفقة",
    exchange: "مبادلة",
    installment: "تقسيط",
    donation: "مجاناً / تبرع",
    partnership: "شراكة / استثمار",
    assignment: "تنازل",
    otherTransaction: "أخرى",
    customTransaction: "اكتب نوع الصفقة",
    back: "الرئيسية",
    sale: "للبيع",
    rent: "للإيجار",
    price: "السعر",
    priceType: "طريقة السعر",
    fixed: "سعر ثابت",
    negotiable: "قابل للتفاوض",
    contact: "عند التواصل",
    offers: "تلقي عروض",
    free: "مجاني",
    currency: "العملة",
    location: "الموقع",
    phone: "رقم الهاتف مع رمز الدولة",
    country: "الدولة ورمز الاتصال",
    call: "السماح بالاتصال الهاتفي",
    camera: "التقاط صورة بالكاميرا",
    gallery: "اختيار صور من الجهاز",
    images: "الصور (حتى 12 صورة)",
    video: "فيديو اختياري (حتى 5 دقائق و48 MB) — يظهر بعد موافقة الإدارة",
    videoInvalid: "الفيديو يجب ألا يتجاوز 5 دقائق أو 48 MB.",
    whatsapp: "السماح بواتساب",
    chat: "السماح برسائل RojDeal",
    save: "نشر الإعلان",
    update: "حفظ التعديلات",
    missing: "الحقول الناقصة",
    required: "أكمل العنوان والوصف والموقع وأضف صورة واحدة على الأقل.",
    specifications: "المواصفات",
    subtype: "النوع",
    choose: "اختر",
    requiredSpecification: "أكمل جميع المواصفات الإلزامية.",
    failed: "تعذر حفظ الإعلان.",
  },
  ku: {
    create: "Îlan zêde bike",
    edit: "Îlan biguherîne",
    title: "Sernav",
    description: "Danasîn",
    category: "Beş",
    property: "Emlak",
    vehicle: "Erebe û makîne",
    other: "Tiştên cuda",
    purpose: "Cure",
    direction: "Tu çi dixwazî?",
    offer: "Ez pêşkêş dikim",
    wanted: "Ez digerim",
    transaction: "Cureya danûstandinê",
    exchange: "Guhertin",
    installment: "Bi qist",
    donation: "Belaş / bexş",
    partnership: "Hevkarî",
    assignment: "Devjêberdan",
    otherTransaction: "Din",
    customTransaction: "Cureya danûstandinê binivîse",
    back: "Mal",
    sale: "Firotin",
    rent: "Kirê",
    price: "Biha",
    priceType: "Cureya bihayê",
    fixed: "Sabit",
    negotiable: "Danûstandin",
    contact: "Bi têkiliyê",
    offers: "Pêşniyar",
    free: "Belaş",
    currency: "Pere",
    location: "Cih",
    phone: "Telefon bi koda welat",
    country: "Welat û koda telefonê",
    call: "Destûra telefonê",
    camera: "Bi kamerayê wêne bikişîne",
    gallery: "Wêneyan hilbijêre",
    images: "Wêne (heta 12)",
    video:
      "Vîdyoya vebijarkî (heta 5 deqîqe û 48 MB) — piştî kontrolê xuya dibe",
    videoInvalid: "Vîdyo ji 5 deqîqe an 48 MB zêdetir nabe.",
    whatsapp: "WhatsApp",
    chat: "Peyamên RojDeal",
    save: "Weşandin",
    update: "Tomar bike",
    missing: "Qadên kêm",
    required: "Hemû qadên pêwîst dagire û wêneyek zêde bike.",
    specifications: "Taybetmendî",
    subtype: "Cure",
    choose: "Hilbijêre",
    requiredSpecification: "Hemû taybetmendiyên pêwîst dagire.",
    failed: "Tomarkirin bi ser neket.",
  },
  de: {
    create: "Anzeige aufgeben",
    edit: "Anzeige bearbeiten",
    title: "Titel",
    description: "Beschreibung",
    category: "Kategorie",
    property: "Immobilien",
    vehicle: "Fahrzeuge und Maschinen",
    other: "Verschiedenes",
    purpose: "Angebotsart",
    direction: "Was möchtest du?",
    offer: "Ich biete an",
    wanted: "Ich suche",
    transaction: "Geschäftsart",
    exchange: "Tausch",
    installment: "Ratenzahlung",
    donation: "Kostenlos / Spende",
    partnership: "Partnerschaft / Investition",
    assignment: "Übertragung",
    otherTransaction: "Andere",
    customTransaction: "Geschäftsart eingeben",
    back: "Startseite",
    sale: "Verkauf",
    rent: "Vermietung",
    price: "Preis",
    priceType: "Preisart",
    fixed: "Festpreis",
    negotiable: "Verhandelbar",
    contact: "Auf Anfrage",
    offers: "Angebote",
    free: "Kostenlos",
    currency: "Währung",
    location: "Ort",
    phone: "Telefon mit Ländervorwahl",
    country: "Land und Vorwahl",
    call: "Telefonanrufe erlauben",
    camera: "Foto aufnehmen",
    gallery: "Bilder auswählen",
    images: "Bilder (bis zu 12)",
    video:
      "Optionales Video (max. 5 Minuten und 48 MB) — sichtbar nach Prüfung",
    videoInvalid: "Das Video darf höchstens 5 Minuten und 48 MB groß sein.",
    whatsapp: "WhatsApp erlauben",
    chat: "RojDeal-Nachrichten erlauben",
    save: "Anzeige veröffentlichen",
    update: "Änderungen speichern",
    missing: "Fehlende Pflichtfelder",
    required:
      "Titel, Beschreibung, Ort und mindestens ein Bild sind erforderlich.",
    specifications: "Eigenschaften",
    subtype: "Typ",
    choose: "Auswählen",
    requiredSpecification: "Fülle alle Pflichtangaben aus.",
    failed: "Die Anzeige konnte nicht gespeichert werden.",
  },
  en: {
    create: "Add listing",
    edit: "Edit listing",
    title: "Title",
    description: "Description",
    category: "Category",
    property: "Real estate",
    vehicle: "Vehicles and machinery",
    other: "Miscellaneous",
    purpose: "Purpose",
    direction: "What do you want?",
    offer: "I am offering",
    wanted: "I am looking for",
    transaction: "Transaction type",
    exchange: "Exchange",
    installment: "Installments",
    donation: "Free / donation",
    partnership: "Partnership / investment",
    assignment: "Assignment",
    otherTransaction: "Other",
    customTransaction: "Enter the transaction type",
    back: "Home",
    sale: "For sale",
    rent: "For rent",
    price: "Price",
    priceType: "Price type",
    fixed: "Fixed",
    negotiable: "Negotiable",
    contact: "On request",
    offers: "Offers",
    free: "Free",
    currency: "Currency",
    location: "Location",
    phone: "Phone with country code",
    country: "Country and calling code",
    call: "Allow phone calls",
    camera: "Take a photo",
    gallery: "Choose images",
    images: "Images (up to 12)",
    video: "Optional video (max. 5 minutes and 48 MB) — visible after review",
    videoInvalid: "Video must not exceed 5 minutes or 48 MB.",
    whatsapp: "Allow WhatsApp",
    chat: "Allow RojDeal messages",
    save: "Publish listing",
    update: "Save changes",
    missing: "Missing required fields",
    required:
      "Title, description, location and at least one image are required.",
    specifications: "Specifications",
    subtype: "Type",
    choose: "Choose",
    requiredSpecification: "Complete all required specifications.",
    failed: "The listing could not be saved.",
  },
} as const;
const empty: ListingDraft = {
  title: "",
  description: "",
  category: "property",
  categoryTypeId: null,
  direction: "offer",
  transactionType: "sale",
  customTransaction: "",
  price: null,
  priceType: "fixed",
  currency: "USD",
  locationNodeId: 0,
  phone: "",
  directCall: true,
  whatsapp: false,
  chat: true,
  attributes: {},
};

export function ListingEditor({
  lang,
  listingId,
}: {
  lang: Locale;
  listingId?: string;
}) {
  const t = copy[lang],
    router = useRouter();
  const submitting=useRef(false);
  const videoCheck=useRef<AbortController|null>(null);
  const [videoBusy,setVideoBusy]=useState(false);
  const [geoBusy,setGeoBusy]=useState(false);
  const [country,setCountry]=useState<CountryCode>('SY');
  useEffect(()=>{const ref=videoCheck;return()=>ref.current?.abort();},[]);
  const [savedDraft,setSavedDraft]=useState('');
  const progress = useRef(listingSaveProgress());
  const feedback = listingFeedback[lang];
  const [authReady, setAuthReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loginRequired, setLoginRequired] = useState(false);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    void supabase.auth.getSession().then(({data, error}) => {
      if (!active) return;
      if (error) { setLoadError(true); return; }
      if (!data.session) {
        const next = listingId ? `/${lang}/listings/${listingId}/edit` : `/${lang}/listings/new`;
        router.replace(`/${lang}/auth?next=${encodeURIComponent(next)}`);
        return;
      }
      progress.current.ownerId ??= data.session.user.id;
      setAuthReady(true);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [lang, listingId, router, attempt]);
  const [form, setForm] = useState<ListingDraft>(empty),
    [locations, setLocations] = useState<LocationChoice[]>([]),
    [catalog, setCatalog] = useState<CatalogCategory[]>([]),
    [files, setFiles] = useState<File[]>([]),
    [video, setVideo] = useState<{ file: File; duration: number } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [validationAttempted, setValidationAttempted] = useState(false);
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    setLoadError(false);
    void Promise.all([locationChoices(lang), listingCatalog(), listingId ? rawOwnListing(listingId) : Promise.resolve(null)])
      .then(([nextLocations, nextCatalog, row]) => {
        if (!active) return;
        if (listingId && !row) throw new Error('listing_unavailable');
        setLocations(nextLocations);
        setCatalog(nextCatalog);
        if (row) {
          setForm({
            title: String(row.title ?? ""),
            description: String(row.description ?? ""),
            category: (row.category ?? "property") as ListingDraft["category"],
            categoryTypeId: row.category_type_id
              ? String(row.category_type_id)
              : null,
            direction: (row.listing_direction ??
              "offer") as ListingDraft["direction"],
            transactionType: String(
              (row.attributes as Record<string, unknown> | null)
                ?.transactionType ??
                row.purpose ??
                "sale",
            ) as ListingDraft["transactionType"],
            customTransaction: String(
              (row.attributes as Record<string, unknown> | null)
                ?.customTransaction ?? "",
            ),
            price: row.price == null ? null : Number(row.price),
            budgetMin:row.budget_min==null?null:Number(row.budget_min),
            budgetMax:row.budget_max==null?null:Number(row.budget_max),
            priceType: (row.price_type ?? "fixed") as ListingDraft["priceType"],
            currency: String(row.currency ?? "USD"),
            locationNodeId: Number(row.location_node_id ?? 0),
            latitude:row.latitude==null?null:Number(row.latitude),longitude:row.longitude==null?null:Number(row.longitude),
            phone: String(row.contact_phone ?? ""),
            email: String(row.contact_email ?? ""),
            directCall: Boolean(row.direct_call_override ?? true),
            whatsapp: Boolean(row.whatsapp_enabled),
            chat: Boolean(row.chat_enabled),
            attributes: Object.fromEntries(
              Object.entries(
                (row.attributes as Record<string, string | number | boolean>) ??
                  {},
              ).filter(
                ([key]) =>
                  key !== "transactionType" && key !== "customTransaction",
              ),
            ),
          });
        }
        setLoaded(true);
      })
        .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [authReady, lang, listingId, attempt]);
  const field =
    "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-base leading-6 outline-none focus:border-rojRed";
  const countries=useMemo(()=>{
    const names=new Intl.DisplayNames([lang==='ku'?'en':lang],{type:'region'});
    return getCountries().map(code=>({code,label:names.of(code)||code})).sort((a,b)=>a.label.localeCompare(b.label,lang));
  },[lang]);
  const selectedCountry=parsedPhone(form.phone,country)?.country || country;
  const detectedCode=`+${getCountryCallingCode(selectedCountry)}`;
  const addFiles = (next: File[]) =>
    setFiles((current) =>
      [
        ...current,
        ...next.filter((file) => file.type.startsWith("image/")),
      ].slice(0, currentCategory?.maxImages??12),
    );
  const currentCategory = catalog.find(
    (category) => category.key === form.category,
  );
  const mediaLimits=currentCategory??{maxImages:12,maxVideoSeconds:300,maxVideoBytes:48*1024*1024};
  const videoPolicy=currentCategory?listingVideoPolicy(currentCategory,form.categoryTypeId):'hidden';
  const mediaText={ar:{images:`الصور (حتى ${mediaLimits.maxImages})`,video:`فيديو: حتى ${mediaLimits.maxVideoSeconds} ثانية / ${Math.round(mediaLimits.maxVideoBytes/1024/1024)} MB`,hidden:'رفع الفيديو غير متاح لهذا القسم حالياً.',review:'يخضع الفيديو للمراجعة قبل عرضه.',direct:'يعرض الفيديو وفق صلاحيات النشر الحالية.',invalid:'تحقق من صيغة الفيديو والحجم والمدة الموضحين أعلاه.'},ku:{images:`Wêne (herî zêde ${mediaLimits.maxImages})`,video:`Vîdyo: ${mediaLimits.maxVideoSeconds} çirke / ${Math.round(mediaLimits.maxVideoBytes/1024/1024)} MB`,hidden:'Vîdyo ji bo vê beşê neçalak e.',review:'Vîdyo berî nîşandanê tê kontrol kirin.',direct:'Vîdyo li gorî destûrên weşandinê tê nîşandan.',invalid:'Format, mezinahî û dema vîdyoyê kontrol bike.'},de:{images:`Bilder (bis zu ${mediaLimits.maxImages})`,video:`Video: bis ${mediaLimits.maxVideoSeconds} Sekunden / ${Math.round(mediaLimits.maxVideoBytes/1024/1024)} MB`,hidden:'Video-Uploads sind für diese Kategorie derzeit deaktiviert.',review:'Das Video wird vor der Anzeige geprüft.',direct:'Das Video wird gemäß den aktuellen Veröffentlichungsrechten angezeigt.',invalid:'Videoformat sowie die angegebenen Größen- und Zeitgrenzen prüfen.'},en:{images:`Images (up to ${mediaLimits.maxImages})`,video:`Video: up to ${mediaLimits.maxVideoSeconds} seconds / ${Math.round(mediaLimits.maxVideoBytes/1024/1024)} MB`,hidden:'Video uploads are currently disabled for this category.',review:'Video is reviewed before display.',direct:'Video is displayed according to current publishing permissions.',invalid:'Check the video format and the size and duration limits shown above.'}}[lang];
  const visibleFields = (currentCategory?.fields ?? []).filter(
    (definition) =>
      !definition.categoryTypeId ||
      definition.categoryTypeId === form.categoryTypeId,
  );
  const localized = (values: Record<string, string>) =>
    values[lang] || values.ar || values.en || "";

  const missingRequired = [
    ...(!form.title.trim() ? [t.title] : []),
    ...(!form.description.trim() ? [t.description] : []),
    ...(!form.locationNodeId ? [t.location] : []),
    ...(form.transactionType === "other" && !form.customTransaction.trim()
      ? [t.customTransaction]
      : []),
    ...visibleFields
      .filter((definition) => {
        if (!definition.required) return false;
        const value = form.attributes[definition.key];
        return value == null || String(value).trim() === "";
      })
      .map((definition) => localized(definition.labels) || definition.key),
  ];

  const missingMessage = `${t.missing}: ${missingRequired.join("، ")}`;

  useEffect(() => {
    if (!validationAttempted) return;
    if (missingRequired.length) {
      setError(missingMessage);
    } else {
      setError("");
      setValidationAttempted(false);
    }
  }, [missingMessage, missingRequired.length, validationAttempted]);

  const setAttribute = (key: string, value: string | number | boolean) =>
    setForm((current) => ({
      ...current,
      attributes: { ...current.attributes, [key]: value },
    }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || submitting.current || videoBusy || geoBusy || !loaded || loadError) return;
    setError("");
    if(video&&videoPolicy==='hidden'){setError(mediaText.hidden);return;}
    if (missingRequired.length) {
      setValidationAttempted(true);
      setError(missingMessage);
      return;
    }
    setValidationAttempted(false);
    if([form.price,form.budgetMin,form.budgetMax].some(value=>value!=null&&(!Number.isFinite(value)||value<0)) || (form.direction==='wanted'&&form.budgetMin!=null&&form.budgetMax!=null&&form.budgetMin>form.budgetMax)){
      setError(({ar:'تحقق من السعر والميزانية: أرقام موجبة، والحد الأدنى لا يتجاوز الأعلى.',ku:'Biha û budceyê kontrol bike: nirxên erênî û rêza rast.',de:'Preis und Budget prüfen: nicht negativ; Minimum darf Maximum nicht überschreiten.',en:'Check price and budget: non-negative numbers; minimum must not exceed maximum.'})[lang]);return;
    }
    const phone=normalizedPhone(form.phone,selectedCountry);
    if(phone===null || ((form.directCall||form.whatsapp)&&!phone)){
      setError(({ar:'أدخل رقم هاتف صحيحاً مع اختيار الدولة، أو ألغِ الاتصال وواتساب.',ku:'Hejmarek rast û welatê hilbijêre, an telefon û WhatsAppê neçalak bike.',de:'Gib eine gültige Telefonnummer mit Land ein oder deaktiviere Anrufe und WhatsApp.',en:'Enter a valid phone number and country, or disable calls and WhatsApp.'})[lang]);return;
    }
    const draft={...form,phone};
    submitting.current=true;
    setBusy(true);
    try {
      if (listingId) {
        await updateListing(listingId, draft, files, video, progress.current);
        router.push(`/${lang}/my-listings`);
      } else {
        const id = await createListing(draft, files, video, progress.current);
        router.push(`/${lang}/listings/${id}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof SavedDraftError) setSavedDraft(err.listingId);
      const problem = err instanceof SavedDraftError ? err.problem : err;
      setLoginRequired(needsListingLogin(problem));
      const code=problem instanceof Error?problem.message:'';
      setError(code==='image_limit'?mediaText.images:code==='video_disabled'?mediaText.hidden:code==='invalid_video'?`${mediaText.invalid} ${mediaText.video}`:listingError(problem, lang));
    } finally {
      submitting.current=false;
      setBusy(false);
    }
  };
  if (!authReady || !loaded) return <div className="mx-auto max-w-xl space-y-4 rounded-2xl bg-white p-6 text-center">
    <p role={loadError ? 'alert' : 'status'}>{loadError ? feedback.load : feedback.checking}</p>
    {loadError && <button type="button" className="rounded-xl bg-rojRed px-4 py-3 font-bold text-white" onClick={() => setAttempt(value => value + 1)}>{feedback.retry}</button>}
  </div>;
  return (
    <form
      onSubmit={submit}
      onChangeCapture={() => {
        if (!validationAttempted) setError("");
      }}
      className="mx-auto max-w-4xl space-y-4 pb-20 md:pb-8"
    >
      <fieldset disabled={busy} className="contents">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">{listingId ? t.edit : t.create}</h1>
        <button
          type="button"
          onClick={() => router.push(`/${lang}`)}
          className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-black"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          {t.back}
        </button>
      </div>
      <section className="rounded-2xl bg-white p-4">
        <strong className="mb-3 block">{t.direction}</strong>
        <div className="grid grid-cols-2 gap-2">
          {(["offer", "wanted"] as const).map((direction) => (
            <button
              key={direction}
              type="button"

              onClick={() => setForm({ ...form, direction })}
              className={`rounded-xl border px-3 py-3 font-black ${form.direction === direction ? "border-rojRed bg-rojRed text-white" : "bg-white"}`}
            >
              {t[direction]}
            </button>
          ))}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold">
          <span>{t.category}</span>
          <select
            className={field}

            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value as ListingDraft["category"],
                categoryTypeId: null,
                attributes: {},
              })
            }
          >
            <option value="property">{t.property}</option>
            <option value="vehicle">{t.vehicle}</option>
            <option value="other">{t.other}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold">
          <span>{t.transaction}</span>
          <select
            className={field}

            value={form.transactionType}
            onChange={(e) =>
              setForm({
                ...form,
                transactionType: e.target
                  .value as ListingDraft["transactionType"],
              })
            }
          >
            <option value="sale">{form.direction==='wanted'?({ar:'أبحث للشراء',ku:'Ji bo kirînê',de:'Kaufen',en:'To buy'})[lang]:t.sale}</option>
            <option value="rent">{form.direction==='wanted'?({ar:'أبحث للاستئجار',ku:'Ji bo kirêkirinê',de:'Mieten',en:'To rent'})[lang]:t.rent}</option>
            {form.category==='property'&&<option value="lease">{({ar:'استثمار بالإيجار / ضمان',ku:'Kirêya dirêj',de:'Pacht',en:'Lease'})[lang]}</option>}
            <option value="exchange">{t.exchange}</option>
            {form.category === "vehicle" && (
              <option value="installment">{t.installment}</option>
            )}
            {form.category === "other" && (
              <option value="donation">{t.donation}</option>
            )}
            {form.category === "property" && (
              <option value="partnership">{t.partnership}</option>
            )}
            {form.category === "property" && (
              <option value="assignment">{t.assignment}</option>
            )}
            <option value="other">{t.otherTransaction}</option>
          </select>
        </label>
      </div>
      {Boolean(currentCategory?.types.length || visibleFields.length) && (
        <section className="space-y-4 rounded-2xl bg-white p-4">
          <strong className="block text-lg">{t.specifications}</strong>
          {Boolean(currentCategory?.types.length) && (
            <label className="space-y-1 text-sm font-bold">
              <span>{t.subtype}</span>
              <select
                className={field}
                value={form.categoryTypeId ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    categoryTypeId: event.target.value || null,
                    attributes: {},
                  })
                }
              >
                <option value="">{t.choose}</option>
                {currentCategory?.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {localized(type.names)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFields.map((definition) => {
              const label = localized(definition.labels) || definition.key;
              const help = localized(definition.helpText);
              const value = form.attributes[definition.key];
              if (definition.type === "boolean")
                return (
                  <label
                    key={definition.id}
                    className="flex items-center gap-3 rounded-2xl border p-4 font-bold"
                  >
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(event) =>
                        setAttribute(definition.key, event.target.checked)
                      }
                    />
                    {label}
                  </label>
                );
              if (definition.type === "select")
                return (
                  <label key={definition.id} className="space-y-1 text-sm font-bold">
                    <span>{label}{definition.required ? " *" : ""}</span>
                    <select
                      className={field}
                      required={definition.required}
                      value={String(value ?? "")}
                      onChange={(event) =>
                        setAttribute(definition.key, event.target.value)
                      }
                    >
                      <option value="">{t.choose}</option>
                      {definition.options.map((option) => (
                        <option key={option.key} value={option.key}>
                          {localized(option.labels) || option.key}
                        </option>
                      ))}
                    </select>
                    {help && <small className="text-gray-500">{help}</small>}
                  </label>
                );
              return (
                <label
                  key={definition.id}
                  className={`space-y-1 text-sm font-bold ${definition.type === "long_text" ? "sm:col-span-2" : ""}`}
                >
                  <span>{label}{definition.required ? " *" : ""}</span>
                  {definition.type === "long_text" ? (
                    <textarea
                      className={`${field} min-h-28`}
                      required={definition.required}
                      value={String(value ?? "")}
                      onChange={(event) =>
                        setAttribute(definition.key, event.target.value)
                      }
                    />
                  ) : (
                    <input
                      className={field}
                      required={definition.required}
                      type={
                        definition.type === "number" ||
                        definition.type === "year"
                          ? "number"
                          : definition.type === "date"
                            ? "date"
                            : "text"
                      }
                      value={String(value ?? "")}
                      onChange={(event) =>
                        setAttribute(
                          definition.key,
                          definition.type === "number" ||
                            definition.type === "year"
                            ? event.target.value === ""
                              ? ""
                              : Number(event.target.value)
                            : event.target.value,
                        )
                      }
                    />
                  )}
                  {help && <small className="text-gray-500">{help}</small>}
                </label>
              );
            })}
          </div>
        </section>
      )}
      {form.transactionType === "other" && (
        <input
          className={field}
          required
          maxLength={80}
          placeholder={t.customTransaction}
          value={form.customTransaction}
          onChange={(e) =>
            setForm({ ...form, customTransaction: e.target.value })
          }
        />
      )}
      <input
        className={field}
        placeholder={t.title}
        maxLength={120}
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <textarea
        className={`${field} min-h-36`}
        placeholder={t.description}
        maxLength={5000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm font-bold">
          <span>{t.priceType}</span>
          <select
            className={field}
            value={form.priceType}
            onChange={(e) =>
              setForm({
                ...form,
                priceType: e.target.value as ListingDraft["priceType"],
              })
            }
          >
            {(
              ["fixed", "negotiable", "contact", "offers", "free"] as const
            ).map((v) => (
              <option value={v} key={v}>
                {t[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold">
          <span>{t.price}</span>
          <input
            className={field}
            type="number"
            min="0"
            disabled={
              ["contact", "free"].includes(form.priceType) ||
              form.transactionType === "donation"
            }
            value={form.price ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                price: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label className="space-y-1 text-sm font-bold">
          <span>{t.currency}</span>
          <select
            className={field}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option>USD</option>
            <option>EUR</option>
            <option>SYP</option>
          </select>
        </label>
      </div>
      {form.direction==='wanted'&&<div className="grid gap-3 sm:grid-cols-2">{(['budgetMin','budgetMax'] as const).map((key,index)=><label key={key} className="space-y-1 text-sm font-bold"><span>{({ar:['الميزانية من — اختياري','الميزانية حتى — اختياري'],ku:['Budce ji — vebijarkî','Budce heta — vebijarkî'],de:['Budget ab — optional','Budget bis — optional'],en:['Budget from — optional','Budget up to — optional']})[lang][index]}</span><input type="number" min="0" step="any" className={field} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value===''?null:Number(e.target.value)})}/></label>)}</div>}
      <label className="space-y-1 text-sm font-bold">
        <span>{t.location}</span>
        <select
          className={field}

          value={form.locationNodeId || ""}
          onChange={(e) =>
            setForm({ ...form, locationNodeId: Number(e.target.value),latitude:null,longitude:null })
          }
        >
          <option value="">—</option>
          {locations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="space-y-1 text-sm font-bold">
          <span>{t.country}</span>
          <select
            className={field}
            value={selectedCountry}
            onChange={(e) => {
              const next=e.target.value as CountryCode;
              setCountry(next);setForm({...form,phone:changePhoneCountry(form.phone,selectedCountry,next)});
            }}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label} (+{getCountryCallingCode(country.code)})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold">
          <span>{t.phone}</span>
          <input
            className={field}
            dir="ltr"
            inputMode="tel"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            placeholder={`${detectedCode} …`}
            value={form.phone}
            onChange={(e)=>setForm({...form,phone:phoneInput(e.target.value)})}
            onBlur={()=>{const phone=normalizedPhone(form.phone,selectedCountry);if(phone!==null)setForm({...form,phone});}}
          />
        </label>
      </div>
      <label className="block space-y-1"><span>{({ar:'بريد التواصل — اختياري، سيظهر للزوار',ku:'E-nameya têkiliyê — vebijarkî, ji ziyaretvanan re xuya ye',de:'Kontakt-E-Mail — optional, für Besucher sichtbar',en:'Contact email — optional, visible to visitors'})[lang]}</span><input type="email" maxLength={254} className={field} value={form.email??''} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <section className="space-y-3 rounded-2xl border border-dashed border-rojRed/40 bg-white p-4">
        {listingId&&<ExistingListingMedia id={listingId} lang={lang} onBusy={setBusy} onRemoved={media=>{
          for(const [file,checkpoint] of progress.current.media){
            if(checkpoint.id===media.id||checkpoint.path===media.storage_path){
              progress.current.media.delete(file);
              setFiles(files=>files.filter(f=>f!==file));
              setVideo(video=>video?.file===file?null:video);
            }
          }
        }}/>}
        <strong>{mediaText.images}</strong>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-rojRed px-3 py-3 font-black text-white">
            <Camera className="h-5 w-5" />
            {t.camera}
            <input
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 font-black">
            <FileImage className="h-5 w-5 text-rojRed" />
            {t.gallery}
            <input
              className="hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
            />
          </label>
        </div>
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
              >
                <FilePreview file={file}/>
                <button
                  type="button"
                  disabled={Boolean(progress.current.media.get(file)?.recorded)}
                  aria-label={({ar:'حذف الصورة',ku:'Wêneyê jê bibe',de:'Bild entfernen',en:'Remove image'})[lang]}
                  onClick={() =>
                    setFiles((value) =>
                      value.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="absolute end-1 top-1 rounded-full bg-black/65 p-1 text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <label className="block rounded-2xl border border-dashed border-rojNavy/30 bg-white p-4 font-bold">
        <span>{mediaText.video}</span><p className="mt-2 text-sm">{videoPolicy==='hidden'?mediaText.hidden:videoPolicy==='direct'?mediaText.direct:mediaText.review}</p>
        <span className="mt-3 block rounded-xl border p-3 text-center">{videoBusy?'…':video?.file.name||({ar:'اختيار فيديو من الجهاز',ku:'Vîdyoyê hilbijêre',de:'Video auswählen',en:'Choose a video'})[lang]}</span>
        <input
          className="sr-only"
          type="file"
          disabled={videoPolicy==='hidden'}
          accept="video/mp4,video/quicktime"
          onChange={async(e) => {
            const input=e.currentTarget,file=input.files?.[0];
            videoCheck.current?.abort();setVideo(null);setVideoBusy(false);
            if(!file)return;
            const controller=new AbortController();videoCheck.current=controller;setVideoBusy(true);
            try{const duration=await inspectVideo(file,controller.signal,mediaLimits);if(!controller.signal.aborted){setVideo({file,duration});setError('');}}
            catch{if(!controller.signal.aborted){setError(mediaText.invalid);input.value='';}}
            finally{if(!controller.signal.aborted)setVideoBusy(false);}
          }}
        />
      </label>
      {video&&<button type="button" onClick={()=>{videoCheck.current?.abort();setVideo(null);setVideoBusy(false);}} className="text-sm text-rojRed">{({ar:'إزالة الفيديو المحدد',ku:'Vîdyoya hilbijartî rake',de:'Ausgewähltes Video entfernen',en:'Remove selected video'})[lang]}</button>}
      <GeoLocationFields lang={lang} value={{latitude:form.latitude??null,longitude:form.longitude??null}} onBusy={setGeoBusy} onChange={coordinates=>setForm(form=>({...form,...coordinates}))}/>
      <div className="flex flex-wrap gap-5 rounded-2xl bg-white p-4">
        <label className="flex gap-2 font-bold">
          <input
            type="checkbox"
            checked={form.directCall}
            onChange={(e) => setForm({ ...form, directCall: e.target.checked })}
          />
          {t.call}
        </label>
        <label className="flex gap-2 font-bold">
          <input
            type="checkbox"
            checked={form.chat}
            onChange={(e) => setForm({ ...form, chat: e.target.checked })}
          />
          {t.chat}
        </label>
        <label className="flex gap-2 font-bold">
          <input
            type="checkbox"
            checked={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.checked })}
          />
          {t.whatsapp}
        </label>
      </div>
      {savedDraft && <p role="status" className="rounded-xl bg-amber-50 p-4 font-bold">{feedback.saved}</p>}
      {loginRequired && <a href={`/${lang}/auth`} target="_blank" rel="noopener noreferrer" className="block font-bold text-rojRed underline">{feedback.login}</a>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy || videoBusy || geoBusy || loadError}
        className="w-full rounded-2xl bg-rojRed py-4 font-black text-white disabled:opacity-50"
      >
        {busy ? "…" : listingId ? t.update : t.save}
      </button>
      </fieldset>
    </form>
  );
}
