begin;

do $setup$
declare
  owner_id uuid;
  base_url constant text := 'https://cmnpemygbrxccajocxgl.supabase.co/functions/v1/legal';
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('Royarkanan@gmail.com')
  order by created_at
  limit 1;

  insert into public.legal_operator_settings (
    id, legal_name, business_name, postal_address, country_code,
    contact_email, contact_phone, responsible_person,
    registration_details, tax_details, is_published, updated_by, updated_at
  ) values (
    true, 'Royar Kanan', 'RojDeal',
    'Am Flugplatz 68A, 12487 Berlin, Deutschland', 'DE',
    'Royarkanan@gmail.com', '', 'Royar Kanan',
    'Nicht im Handelsregister eingetragen.',
    'Keine Umsatzsteuer-Identifikationsnummer angegeben.',
    true, owner_id, now()
  )
  on conflict (id) do update set
    legal_name = excluded.legal_name,
    business_name = excluded.business_name,
    postal_address = excluded.postal_address,
    country_code = excluded.country_code,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    responsible_person = excluded.responsible_person,
    registration_details = excluded.registration_details,
    tax_details = excluded.tax_details,
    is_published = excluded.is_published,
    updated_by = excluded.updated_by,
    updated_at = now();

  update public.legal_documents
  set is_active = false, updated_by = owner_id, updated_at = now()
  where document_type in (
    'privacy', 'terms', 'community_rules', 'payment_terms',
    'account_deletion', 'impressum', 'cookie_policy', 'ad_privacy'
  ) and language in ('de', 'en', 'ar', 'ku');

  insert into public.legal_documents (
    document_type, version, language, title, content, public_url,
    effective_at, is_active, requires_acceptance, created_by, updated_by
  ) values
  ('impressum','1.0','de','Impressum',$doc$
Angaben gemäß § 5 DDG

RojDeal
Inhaber und Diensteanbieter: Royar Kanan
Am Flugplatz 68A
12487 Berlin
Deutschland

Kontakt: Royarkanan@gmail.com

Verantwortlich für eigene redaktionelle Inhalte: Royar Kanan, Anschrift wie oben.

RojDeal ist eine digitale Kleinanzeigen- und Kommunikationsplattform. Verträge über angebotene Waren oder Leistungen kommen ausschließlich zwischen den jeweiligen Nutzerinnen und Nutzern zustande.

Stand: 25. August 2026
$doc$,base_url||'?type=impressum&lang=de',now(),true,false,owner_id,owner_id),
  ('impressum','1.0','en','Legal notice',$doc$
RojDeal
Owner and service provider: Royar Kanan
Am Flugplatz 68A, 12487 Berlin, Germany
Contact: Royarkanan@gmail.com

Responsible for RojDeal's own editorial content: Royar Kanan, address as above.

RojDeal is a digital classifieds and communication platform. Contracts for advertised goods or services are concluded solely between the respective users.

Effective: 25 August 2026
$doc$,base_url||'?type=impressum&lang=en',now(),true,false,owner_id,owner_id),
  ('impressum','1.0','ar','بيانات المشغّل (Impressum)',$doc$
RojDeal
المالك ومقدّم الخدمة: Royar Kanan
Am Flugplatz 68A, 12487 Berlin, Germany
البريد الإلكتروني: Royarkanan@gmail.com

المسؤول عن المحتوى التحريري الخاص بالمنصة: Royar Kanan، على العنوان المذكور أعلاه.

RojDeal منصة للإعلانات المبوبة والتواصل. أي عقد لشراء سلعة أو خدمة يتم حصراً بين المستخدمين المعنيين.

ساري من: 25 آب/أغسطس 2026
$doc$,base_url||'?type=impressum&lang=ar',now(),true,false,owner_id,owner_id),
  ('impressum','1.0','ku','Agahiyên xebitîner (Impressum)',$doc$
RojDeal
Xwedî û pêşkêşkarê xizmetê: Royar Kanan
Am Flugplatz 68A, 12487 Berlin, Germany
E-name: Royarkanan@gmail.com

Kesê berpirsiyar ji naveroka edîtorî ya RojDeal: Royar Kanan, li navnîşana jorîn.

RojDeal platformek ragihandin û reklamên biçûk e. Peymanên kirîn an xizmetê tenê di navbera bikarhêneran de tên çêkirin.

Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=impressum&lang=ku',now(),true,false,owner_id,owner_id),

  ('privacy','1.0','de','Datenschutzerklärung',$doc$
1. Verantwortlicher
Royar Kanan, RojDeal, Am Flugplatz 68A, 12487 Berlin, Deutschland. Kontakt: Royarkanan@gmail.com.

2. Verarbeitete Daten
Je nach Nutzung verarbeitet RojDeal Konto- und Profildaten, Kontaktdaten, Anzeigeninhalte, Fotos und Videos, Such- und Interaktionsdaten, Favoriten, Meldungen, Chatnachrichten und Anhänge, technische Geräte- und Protokolldaten sowie Standortdaten nur nach Ihrer Freigabe. Bei optionalen Konto-Upgrades werden Zahlungsart, Betrag, Referenz und Prüfstatus verarbeitet; vollständige Karten- oder PayPal-Zugangsdaten erhält RojDeal nicht.

3. Zwecke und Rechtsgrundlagen
Die Verarbeitung erfolgt zur Bereitstellung von Konto, Marktplatz, Suche, Chat, Moderation, Sicherheit, Missbrauchsprävention, Support und gesetzlichen Pflichten. Rechtsgrundlagen sind insbesondere Vertragserfüllung und vorvertragliche Maßnahmen (Art. 6 Abs. 1 lit. b DSGVO), berechtigte Interessen an sicherem und zuverlässigem Betrieb (lit. f), Einwilligung für optionale Berechtigungen (lit. a) und rechtliche Pflichten (lit. c).

4. Empfänger und Infrastruktur
Für Hosting, Datenbank, Authentifizierung, Speicherung und technische Zustellung wird Supabase eingesetzt. Apple und Google können im Rahmen ihrer Betriebssystem-, Store- oder Anmeldedienste eigene Daten verarbeiten. Daten werden nur weitergegeben, soweit dies für den Dienst, die Sicherheit, gesetzliche Pflichten oder mit Ihrer Einwilligung erforderlich ist. Bei Übermittlungen außerhalb des EWR werden geeignete Garantien eingesetzt.

5. Speicherdauer
Daten werden nur solange gespeichert, wie sie für den jeweiligen Zweck, die Kontonutzung, Sicherheit, Streitklärung oder gesetzliche Aufbewahrung erforderlich sind. Protokolle werden begrenzt aufbewahrt. Bei einer Kontolöschung beginnt grundsätzlich eine siebentägige Widerrufsfrist; danach werden Konto und zugeordnete Inhalte gelöscht oder anonymisiert, soweit keine gesetzliche Pflicht oder dokumentierte rechtliche Sperre entgegensteht.

6. Rechte
Sie haben nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf einer Einwilligung. Anfragen: Royarkanan@gmail.com. Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere bei der Berliner Beauftragten für Datenschutz und Informationsfreiheit.

7. Berechtigungen, Minderjährige und Sicherheit
Kamera, Fotos, Dateien und Standort werden nur für von Ihnen ausgelöste Funktionen und nach Gerätefreigabe genutzt. RojDeal ist nicht für Kinder unter 16 Jahren bestimmt. Technische und organisatorische Maßnahmen schützen Daten; ein absoluter Schutz kann jedoch nicht garantiert werden.

8. Änderungen
Wesentliche Änderungen werden in der App angezeigt und, soweit erforderlich, erneut zur Zustimmung vorgelegt.

Stand: 25. August 2026
$doc$,base_url||'?type=privacy&lang=de',now(),true,true,owner_id,owner_id),
  ('privacy','1.0','en','Privacy Policy',$doc$
Controller: Royar Kanan, RojDeal, Am Flugplatz 68A, 12487 Berlin, Germany; Royarkanan@gmail.com.

Depending on use, RojDeal processes account and profile data, contact details, listings, photos and videos, searches and interactions, favourites, reports, chats and attachments, technical logs, and location only when you permit it. For optional account upgrades, RojDeal processes payment method, amount, reference and review status, but not full card or PayPal credentials.

Data is used to provide accounts, marketplace search, chat, moderation, security, fraud prevention, support and legal compliance. Legal bases include contract performance, legitimate interests in a secure service, consent for optional permissions, and legal obligations.

Supabase provides hosting, database, authentication and storage. Apple and Google may process data for their operating-system, store or sign-in services. Transfers outside the EEA use appropriate safeguards where required.

Data is retained only as needed for service, security, disputes and law. Account deletion normally includes a seven-day cancellation period, followed by deletion or anonymisation unless a legal duty or documented legal hold applies.

You may request access, correction, deletion, restriction, portability or object to processing, and may withdraw consent. Contact Royarkanan@gmail.com. You may complain to a competent data protection authority. Camera, photos, files and location are used only for user-initiated features after permission. RojDeal is not intended for children under 16.

Material changes are shown in the app and, where required, require renewed acceptance. Effective: 25 August 2026.
$doc$,base_url||'?type=privacy&lang=en',now(),true,true,owner_id,owner_id),
  ('privacy','1.0','ar','سياسة الخصوصية',$doc$
المتحكم بالبيانات: Royar Kanan، RojDeal، Am Flugplatz 68A, 12487 Berlin, Germany. التواصل: Royarkanan@gmail.com.

بحسب طريقة الاستخدام، نعالج بيانات الحساب والملف الشخصي والتواصل، الإعلانات والصور والفيديو، البحث والتفاعل والمفضلة والبلاغات، رسائل الدردشة ومرفقاتها، السجلات التقنية، والموقع فقط بعد موافقتك. في ترقيات الحساب الاختيارية نعالج طريقة الدفع والمبلغ والمرجع وحالة المراجعة، ولا نحصل على بيانات البطاقة الكاملة أو كلمة مرور PayPal.

نستخدم البيانات لتشغيل الحساب والسوق والبحث والدردشة والإشراف والأمان ومنع الإساءة والدعم والالتزامات القانونية. الأسس القانونية تشمل تنفيذ العقد، المصلحة المشروعة في تشغيل آمن، الموافقة للميزات الاختيارية، والالتزام القانوني.

نستخدم Supabase للاستضافة وقاعدة البيانات وتسجيل الدخول والتخزين. وقد تعالج Apple وGoogle بيانات ضمن خدمات النظام أو المتجر أو تسجيل الدخول الخاصة بهما. أي نقل خارج المنطقة الاقتصادية الأوروبية يخضع للضمانات المناسبة عند الحاجة.

نحتفظ بالبيانات فقط للمدة اللازمة للخدمة والأمان وتسوية النزاعات والقانون. طلب حذف الحساب يتضمن عادة مهلة تراجع سبعة أيام، ثم تُحذف البيانات أو تُجعل مجهولة ما لم يوجد واجب قانوني أو حجز قانوني موثّق.

لك حقوق الوصول والتصحيح والحذف والتقييد ونقل البيانات والاعتراض وسحب الموافقة. راسل Royarkanan@gmail.com، ويمكنك الشكوى لدى سلطة حماية البيانات المختصة. الكاميرا والصور والملفات والموقع تُستخدم فقط لميزة طلبتها وبعد إذنك. التطبيق غير مخصص لمن هم دون 16 عاماً.

نعرض التغييرات الجوهرية داخل التطبيق ونطلب موافقة جديدة عند اللزوم. سارية من 25 آب/أغسطس 2026.
$doc$,base_url||'?type=privacy&lang=ar',now(),true,true,owner_id,owner_id),
  ('privacy','1.0','ku','Polîtîkaya taybetiyê',$doc$
Kontrolkerê daneyan: Royar Kanan, RojDeal, Am Flugplatz 68A, 12487 Berlin, Germany. Têkilî: Royarkanan@gmail.com.

Li gorî bikaranînê, RojDeal daneyên hesab û profîlê, têkilî, reklam, wêne û vîdyo, lêgerîn û çalakî, bijarte, rapor, peyam û pêvek, tomarên teknîkî û tenê bi destûra we cihê we hildigire. Ji bo bilindkirina hesabê, awayê dayînê, nirx, referans û rewşa kontrolê tên tomarkirin; daneyên tevahî yên kart an şîfreya PayPal nayên standin.

Daneyan ji bo hesab, bazar, lêgerîn, sohbet, çavdêrî, ewlehî, pêşîlêgirtina xerabkariyê, piştgirî û erkên qanûnî bi kar tînin. Bingehên qanûnî peyman, berjewendiya rewa, razîbûn û erkên qanûnî ne.

Supabase ji bo hosting, databês, nasname û depokirinê tê bikaranîn. Apple û Google dikarin ji bo xizmetên xwe yên pergal, firoşgeh an têketinê daneyan bixebitînin. Veguheztina derveyî EEA bi parastinên pêwîst tê kirin.

Daneyên tenê heta dema pêwîst têne parastin. Piştî daxwaza jêbirina hesabê, bi gelemperî heft roj ji bo betalkirinê hene; paşê daneyên tên jêbirin an bê-nav kirin, heke erka qanûnî an sekinandina qanûnî tune be.

Mafên we gihîştin, rastkirin, jêbirin, sînordarkirin, veguheztin, nerazîbûn û paşvekişandina razîbûnê ne. Bi Royarkanan@gmail.com re têkilî daynin. Kamera, wêne, pel û cih tenê bi destûra we têne bikaranîn. RojDeal ne ji bo zarokên di bin 16 salî de ye.

Guherînên girîng di sepanê de têne nîşandan. Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=privacy&lang=ku',now(),true,true,owner_id,owner_id),

  ('terms','1.0','de','Nutzungsbedingungen',$doc$
1. Geltung und Betreiber
Diese Bedingungen gelten für RojDeal, betrieben von Royar Kanan, Am Flugplatz 68A, 12487 Berlin, Deutschland.

2. Rolle der Plattform
RojDeal stellt technische Funktionen für Kleinanzeigen, Suche und Kommunikation bereit. RojDeal ist grundsätzlich weder Verkäufer noch Käufer und wird nicht Partei eines zwischen Nutzern geschlossenen Vertrags. Nutzer prüfen Angebot, Gegenpartei, Eigentum, Zustand, Preis, Lieferung und rechtliche Zulässigkeit selbst.

3. Konto
Angaben müssen richtig und aktuell sein. Zugangsdaten dürfen nicht weitergegeben werden. Nutzer müssen mindestens 16 Jahre alt sein oder die nach ihrem Recht erforderliche Zustimmung besitzen. Ein Konto darf nicht zur Umgehung einer Sperre genutzt werden.

4. Anzeigen und Inhalte
Es dürfen nur rechtmäßige, wahrheitsgemäße und ausreichend beschriebene Angebote veröffentlicht werden. Verboten sind insbesondere rechtswidrige oder gestohlene Waren, Waffen und gefährliche Gegenstände, Drogen, Fälschungen, diskriminierende oder sexuelle Inhalte, Betrug, Spam, Schadsoftware und die Verletzung fremder Rechte. Hochgeladene Inhalte bleiben beim Nutzer; er räumt RojDeal die für Betrieb, Anzeige, Moderation und Sicherung erforderlichen, nicht ausschließlichen Nutzungsrechte ein.

5. Kommunikation und Sicherheit
Keine Vorauszahlung ohne Prüfung; sensible Zahlungs-, Ausweis- oder Zugangsdaten gehören nicht in den Chat. Verdächtige Inhalte sind zu melden. Nutzer können andere Nutzer blockieren.

6. Moderation
RojDeal darf Inhalte prüfen, einschränken, entfernen, Konten begrenzen oder sperren und Beweise sichern, wenn Regeln, Rechte Dritter, Sicherheit oder Gesetz dies erfordern. Entscheidungen können über den Support beanstandet werden.

7. Verfügbarkeit und Haftung
Eine jederzeit fehlerfreie Verfügbarkeit wird nicht garantiert. Für Vorsatz und grobe Fahrlässigkeit sowie Verletzung von Leben, Körper oder Gesundheit gilt die gesetzliche Haftung. Bei leichter Fahrlässigkeit haftet RojDeal nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren typischen Schaden. Zwingende Verbraucherrechte bleiben unberührt.

8. Beendigung und Änderungen
Nutzer können ihr Konto in der App löschen lassen. RojDeal kann den Dienst oder Funktionen mit angemessener Information ändern. Wesentliche Änderungen dieser Bedingungen werden angezeigt und, soweit erforderlich, erneut akzeptiert.

9. Recht
Es gilt deutsches Recht unter Wahrung zwingender Verbraucherschutzregeln des gewöhnlichen Aufenthaltsstaates. Gesetzliche Gerichtsstände bleiben unberührt.

Stand: 25. August 2026
$doc$,base_url||'?type=terms&lang=de',now(),true,true,owner_id,owner_id),
  ('terms','1.0','en','Terms of Use',$doc$
RojDeal is operated by Royar Kanan, Am Flugplatz 68A, 12487 Berlin, Germany. It provides technical classifieds, search and communication tools. RojDeal is normally neither buyer nor seller and is not a party to user transactions. Users must verify offers, counterparties, ownership, condition, price, delivery and legality.

Account information must be accurate and access credentials protected. Users must be at least 16 or have required legal consent. Listings must be lawful, truthful and adequately described. Illegal or stolen goods, weapons, dangerous items, drugs, counterfeits, discriminatory or sexual content, fraud, spam, malware and infringements are prohibited. Users retain ownership of uploads and grant RojDeal a non-exclusive licence necessary to host, display, moderate, secure and operate them.

Do not prepay without verification or share sensitive payment, identity or access data in chat. Report suspicious content and use blocking tools. RojDeal may review, restrict or remove content, limit or suspend accounts and preserve evidence where required for rules, safety, third-party rights or law.

Continuous error-free availability is not guaranteed. Mandatory liability remains unaffected; otherwise liability is limited under applicable law. Users may request account deletion in the app. Material changes are notified and may require renewed acceptance. German law applies while mandatory consumer protections and statutory venues remain unaffected.

Effective: 25 August 2026
$doc$,base_url||'?type=terms&lang=en',now(),true,true,owner_id,owner_id),
  ('terms','1.0','ar','شروط الاستخدام',$doc$
يشغّل Royar Kanan منصة RojDeal من العنوان Am Flugplatz 68A, 12487 Berlin, Germany. توفّر المنصة أدوات تقنية للإعلانات والبحث والتواصل، وليست عادة بائعاً أو مشترياً ولا طرفاً في عقود المستخدمين. على المستخدم التحقق من الإعلان والطرف الآخر والملكية والحالة والسعر والتسليم والمشروعية.

يجب أن تكون بيانات الحساب صحيحة وأن تبقى معلومات الدخول سرية. يجب ألا يقل العمر عن 16 سنة أو تتوفر الموافقة القانونية اللازمة. يجب أن تكون الإعلانات قانونية وصادقة وواضحة. يُحظر نشر السلع غير القانونية أو المسروقة، الأسلحة والمواد الخطرة، المخدرات، التقليد، المحتوى التمييزي أو الجنسي، الاحتيال، الرسائل المزعجة، البرمجيات الضارة، أو انتهاك حقوق الغير. تبقى ملكية المحتوى للمستخدم ويمنح RojDeal ترخيصاً غير حصري بالقدر اللازم للاستضافة والعرض والإشراف والأمان.

لا تدفع مسبقاً دون تحقق ولا ترسل بيانات دفع أو هوية أو دخول حساسة في الدردشة. أبلغ عن المحتوى المشبوه واستخدم الحظر. يجوز للمنصة فحص المحتوى أو تقييده أو حذفه وتقييد الحسابات أو تعليقها وحفظ الأدلة عند الحاجة للقواعد أو الأمان أو القانون.

لا نضمن توفراً متواصلاً خالياً من الأخطاء، وتبقى المسؤولية الإلزامية وحقوق المستهلك محفوظة. يمكن طلب حذف الحساب داخل التطبيق. تُعرض التغييرات الجوهرية وقد تتطلب موافقة جديدة. يطبق القانون الألماني مع بقاء حماية المستهلك ومكان التقاضي الإلزامي دون مساس.

سارية من 25 آب/أغسطس 2026.
$doc$,base_url||'?type=terms&lang=ar',now(),true,true,owner_id,owner_id),
  ('terms','1.0','ku','Mercên bikaranînê',$doc$
RojDeal ji aliyê Royar Kanan, Am Flugplatz 68A, 12487 Berlin, Germany ve tê xebitandin. Ew alavên teknîkî ji bo reklam, lêgerîn û têkiliyê dide. RojDeal bi gelemperî ne kiryar e ne firoşkar û ne aliyek peymana bikarhêneran e. Bikarhêner divê reklam, kesê din, xwedîtî, rewş, nirx, radestkirin û qanûnîbûnê kontrol bikin.

Agahiyên hesabê divê rast bin û agahiyên têketinê bêne parastin. Temen divê herî kêm 16 be an destûra qanûnî hebe. Reklam divê qanûnî û rast be. Malên neqanûnî an dizî, çek, tiştên xeternak, narkotîk, sexte, naveroka cudakar an cinsî, xapandin, spam, malware û binpêkirina mafan qedexe ne. Xwedîtiya naverokê ya bikarhêner e; destûra ne-taybet ji bo host, nîşandan, çavdêrî û ewlehiyê dide RojDeal.

Bê kontrol pêşdane mekin û daneyên hestiyar ên drav, nasname an têketinê di sohbetê de neşînin. Naveroka gumanbar ragihînin û blokkirinê bi kar bînin. RojDeal dikare naverokê kontrol, sînor an jê bibe û hesaban bisekinîne.

Hebûna bêkêmasî her dem nayê garantîkirin. Mafên mecbûrî yên xerîdar diparêzin. Hesab dikare di sepanê de were jêbirin. Guherînên girîng têne nîşandan. Qanûna Almanyayê bi parastina mecbûrî ya xerîdar tê sepandin. Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=terms&lang=ku',now(),true,true,owner_id,owner_id),

  ('community_rules','1.0','de','Community-Regeln',$doc$
Behandle andere respektvoll. Erlaubt sind nur rechtmäßige, ehrliche und sichere Anzeigen und Nachrichten. Verboten sind Hass, Belästigung, Drohungen, sexualisierte Ausbeutung, Gewaltverherrlichung, Betrug, Identitätstäuschung, Spam, manipulierte Bewertungen, gefährliche oder illegale Waren, Fälschungen und die Veröffentlichung personenbezogener Daten anderer ohne Erlaubnis.

Verwende für jedes Angebot passende Kategorie, Ort, Preis, Beschreibung und eigene oder lizenzierte Medien. Keine Doppelanzeigen oder irreführenden Schlüsselwörter. Bezahle nicht ungeprüft im Voraus, teile keine Passwörter oder Bestätigungscodes und verlagere verdächtige Gespräche nicht aus der Plattform.

Melde Verstöße und blockiere missbräuchliche Nutzer. RojDeal kann Inhalte entfernen, Reichweite begrenzen, Funktionen sperren, Konten suspendieren und bei Gefahr oder Rechtspflicht Informationen sichern oder zuständigen Stellen übermitteln. Wiederholte oder schwere Verstöße können zur dauerhaften Sperre führen.

Stand: 25. August 2026
$doc$,base_url||'?type=community_rules&lang=de',now(),true,true,owner_id,owner_id),
  ('community_rules','1.0','en','Community Rules',$doc$
Treat others respectfully. Only lawful, honest and safe listings and messages are allowed. Hate, harassment, threats, sexual exploitation, glorified violence, fraud, impersonation, spam, review manipulation, dangerous or illegal goods, counterfeits, and publishing another person's data without permission are prohibited.

Use accurate categories, location, price and description, and only media you own or may use. No duplicate listings or misleading keywords. Do not prepay without verification or share passwords and verification codes.

Report violations and block abusive users. RojDeal may remove content, reduce visibility, restrict features, suspend accounts and preserve or disclose information where danger or law requires it. Repeated or serious violations may result in permanent suspension. Effective: 25 August 2026.
$doc$,base_url||'?type=community_rules&lang=en',now(),true,true,owner_id,owner_id),
  ('community_rules','1.0','ar','قواعد المجتمع',$doc$
عامل الآخرين باحترام. يسمح فقط بالإعلانات والرسائل القانونية والصادقة والآمنة. يُحظر خطاب الكراهية والتحرش والتهديد والاستغلال الجنسي وتمجيد العنف والاحتيال وانتحال الهوية والرسائل المزعجة والتلاعب بالتقييمات والسلع الخطرة أو غير القانونية والتقليد ونشر بيانات الآخرين دون إذن.

استخدم تصنيفاً وموقعاً وسعراً ووصفاً صحيحاً، ووسائط تملكها أو يسمح لك باستخدامها. لا تنشر إعلانات مكررة أو كلمات مضللة. لا تدفع مسبقاً دون تحقق ولا تشارك كلمات المرور أو رموز التأكيد.

أبلغ عن المخالفات واحظر المستخدم المسيء. يجوز لـRojDeal حذف المحتوى أو تقليل ظهوره أو تقييد الميزات أو تعليق الحساب، وحفظ المعلومات أو تسليمها عند وجود خطر أو واجب قانوني. المخالفات الجسيمة أو المتكررة قد تؤدي إلى حظر دائم. سارية من 25 آب/أغسطس 2026.
$doc$,base_url||'?type=community_rules&lang=ar',now(),true,true,owner_id,owner_id),
  ('community_rules','1.0','ku','Rêzikên civakê',$doc$
Bi rêz tevbigere. Tenê reklam û peyamên qanûnî, rast û ewle tên pejirandin. Nefret, acizkirin, tehdîd, îstîsmara cinsî, şîdet, xapandin, xwe wek kesek din nîşandan, spam, malên xeternak an neqanûnî, sexte û belavkirina daneyên kesên din bê destûr qedexe ne.

Kategorî, cih, nirx û ravekirina rast bi kar bîne û tenê medyaya ku mafê te heye bar bike. Reklamên dubare û peyvên xapînok qedexe ne. Bê kontrol pêşdane neke û şîfre an kodên piştrastkirinê parve neke.

Binpêkirinan ragihîne û bikarhênerê xerab blok bike. RojDeal dikare naverokê jê bibe, dîtinê sînor bike, taybetmendiyan bigire û hesab bisekinîne. Binpêkirina giran an dubare dikare bibe sedema girtina daîmî. Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=community_rules&lang=ku',now(),true,true,owner_id,owner_id),

  ('account_deletion','1.0','de','Kontolöschung',$doc$
Sie können die vollständige Löschung Ihres RojDeal-Kontos in der App unter Konto/Einstellungen/Konto löschen anstoßen. Nach Bestätigung werden aktive Anzeigen verborgen und es beginnt eine siebentägige Widerrufsfrist. Innerhalb dieser Frist können Sie den Antrag in der App zurücknehmen. Danach werden das Authentifizierungskonto und zugeordnete Profildaten, Anzeigen, Medien und sonstige nutzerbezogene Inhalte gelöscht oder anonymisiert.

Bestimmte Daten dürfen nur weiter gespeichert werden, wenn eine gesetzliche Aufbewahrungspflicht, die Abwehr oder Durchsetzung von Ansprüchen, Betrugsprävention oder eine dokumentierte rechtliche Sperre dies verlangt. Solche Daten werden gesperrt und nicht für gewöhnliche Produktzwecke verwendet.

Außerhalb der App können Sie die Löschung über diese Seite anfordern oder von der im Konto verwendeten E-Mail-Adresse an Royarkanan@gmail.com schreiben. Geben Sie den Betreff „RojDeal Kontolöschung“ an. Zur Sicherheit muss Ihre Identität bestätigt werden. Die Bearbeitung wird bestätigt.
$doc$,base_url||'?type=account_deletion&lang=de',now(),true,false,owner_id,owner_id),
  ('account_deletion','1.0','en','Account deletion',$doc$
Start full account deletion in the app under Account/Settings/Delete account. After confirmation, active listings are hidden and a seven-day cancellation period begins. You may cancel in the app during that period. Afterwards, the authentication account and associated profile, listings, media and user-linked content are deleted or anonymised.

Data is retained only where required by law, legal claims, fraud prevention or a documented legal hold, and is blocked from ordinary product use.

Outside the app, request deletion through this page or email Royarkanan@gmail.com from the address used for the account with subject “RojDeal account deletion”. Identity verification is required for security, and completion will be confirmed.
$doc$,base_url||'?type=account_deletion&lang=en',now(),true,false,owner_id,owner_id),
  ('account_deletion','1.0','ar','حذف الحساب',$doc$
يمكن بدء حذف حساب RojDeal كاملاً من داخل التطبيق عبر الحساب/الإعدادات/حذف الحساب. بعد التأكيد تُخفى الإعلانات النشطة وتبدأ مهلة تراجع مدتها سبعة أيام، ويمكن إلغاء الطلب خلالها من التطبيق. بعد المهلة يُحذف أو يُجعل مجهولاً حساب تسجيل الدخول والملف الشخصي والإعلانات والوسائط والمحتوى المرتبط بالمستخدم.

لا نحتفظ بأي بيانات بعدها إلا إذا تطلب القانون أو المطالبات القانونية أو منع الاحتيال أو حجز قانوني موثّق ذلك، وتكون هذه البيانات محجوبة عن الاستخدام العادي.

لطلب الحذف خارج التطبيق استخدم هذه الصفحة أو أرسل من بريد الحساب إلى Royarkanan@gmail.com بعنوان «حذف حساب RojDeal». يجب التحقق من الهوية لحماية الحساب، وسيتم تأكيد إتمام الطلب.
$doc$,base_url||'?type=account_deletion&lang=ar',now(),true,false,owner_id,owner_id),
  ('account_deletion','1.0','ku','Jêbirina hesabê',$doc$
Di sepanê de ji Hesab/Mîheng/Jêbirina hesabê dest bi jêbirina tevahî bike. Piştî piştrastkirinê reklamên çalak tên veşartin û dema betalkirinê ya heft rojan dest pê dike. Di vê demê de dikarî daxwazê betal bikî. Paşê hesabê têketinê, profîl, reklam, medya û naveroka girêdayî tên jêbirin an bê-nav kirin.

Daneyên tenê ji ber erka qanûnî, doz, pêşîlêgirtina xapandinê an sekinandina qanûnî têne parastin û ji bikaranîna asayî tên girtin.

Ji derveyî sepanê, daxwazê ji vê rûpelê an ji e-nameya hesabê bi sernavê “RojDeal account deletion” ji Royarkanan@gmail.com re bişîne. Ji bo ewlehiyê divê nasname were piştrastkirin.
$doc$,base_url||'?type=account_deletion&lang=ku',now(),true,false,owner_id,owner_id),

  ('payment_terms','1.0','de','Zahlungs- und Upgrade-Bedingungen',$doc$
Diese Bedingungen gelten nur, wenn RojDeal kostenpflichtige Konto-Upgrades oder Werbeleistungen anbietet. Der Kauf und die Bezahlung von Waren oder Dienstleistungen aus Kleinanzeigen erfolgen direkt zwischen den jeweiligen Nutzern und werden von RojDeal nicht abgewickelt.

Verfügbare Upgrade-Zahlungsarten werden vor der Bestellung angezeigt. Zum Start können dies Barzahlung oder PayPal mit manueller Prüfung sein. Ein Upgrade wird erst nach bestätigtem Zahlungseingang und erfolgreicher Prüfung aktiviert. Übermittelte Zahlungsreferenzen müssen richtig sein; gefälschte Nachweise führen zur Ablehnung und können eine Kontosperre auslösen.

Preis, Leistungsumfang, Laufzeit und etwaige Steuern werden vor dem Absenden des Antrags angezeigt. Ohne ausdrückliche Angabe entsteht kein automatisch verlängerndes Abonnement. Ist eine Leistung technisch nicht aktivierbar oder wird ein Antrag abgelehnt, wird eine bereits erhaltene Zahlung auf demselben oder einem vereinbarten Weg zurückerstattet.

Gesetzliche Verbraucherrechte bleiben unberührt. Bei digitaler Leistung kann ein Widerrufsrecht nach den gesetzlichen Voraussetzungen vorzeitig erlöschen, wenn der Nutzer ausdrücklich den sofortigen Beginn verlangt und den Verlust des Widerrufsrechts bestätigt. Dies wird, falls einschlägig, vor der Aktivierung gesondert abgefragt.

Support: Royarkanan@gmail.com. Stand: 25. August 2026.
$doc$,base_url||'?type=payment_terms&lang=de',now(),true,false,owner_id,owner_id),
  ('payment_terms','1.0','en','Payment and Upgrade Terms',$doc$
These terms apply only when RojDeal offers paid account upgrades or advertising services. Purchases and payments for goods or services in classifieds take place directly between users and are not processed by RojDeal.

Available upgrade payment methods are shown before ordering and may initially include cash or PayPal with manual review. An upgrade is activated only after payment and review are confirmed. False payment evidence may lead to rejection and account restriction.

Price, scope, duration and applicable taxes are shown before submission. No automatically renewing subscription exists unless explicitly stated. If activation is impossible or a request is rejected, received funds are refunded through the same or an agreed method. Mandatory consumer rights remain unaffected. Where legally applicable, separate consent is requested before immediate digital performance and any resulting loss of a withdrawal right. Support: Royarkanan@gmail.com. Effective: 25 August 2026.
$doc$,base_url||'?type=payment_terms&lang=en',now(),true,false,owner_id,owner_id),
  ('payment_terms','1.0','ar','شروط الدفع والترقية',$doc$
تطبق هذه الشروط فقط عندما تقدم RojDeal ترقية مدفوعة للحساب أو خدمة إعلانية. شراء ودفع السلع أو الخدمات المنشورة في الإعلانات يتم مباشرة بين المستخدمين ولا تعالجه RojDeal.

تظهر طرق دفع الترقية المتاحة قبل الطلب، وقد تشمل عند البداية الدفع النقدي أو PayPal مع مراجعة يدوية. لا تُفعّل الترقية إلا بعد تأكيد وصول الدفع وإتمام المراجعة. إثبات الدفع الكاذب يؤدي إلى رفض الطلب وقد يؤدي إلى تقييد الحساب.

يظهر السعر والنطاق والمدة والضرائب المطبقة قبل الإرسال. لا يوجد اشتراك يتجدد تلقائياً إلا إذا ذُكر ذلك صراحة. إذا تعذر التفعيل أو رُفض الطلب، يُعاد المبلغ المستلم بالطريقة نفسها أو بطريقة متفق عليها. تبقى حقوق المستهلك القانونية محفوظة، وتُطلب موافقة منفصلة عند بدء خدمة رقمية فوراً إذا كان لذلك أثر على حق التراجع. الدعم: Royarkanan@gmail.com. سارية من 25 آب/أغسطس 2026.
$doc$,base_url||'?type=payment_terms&lang=ar',now(),true,false,owner_id,owner_id),
  ('payment_terms','1.0','ku','Mercên dayîn û bilindkirinê',$doc$
Ev merc tenê dema ku RojDeal bilindkirina hesabê an xizmeta reklamê ya bi pere pêşkêş dike derbasdar in. Kirîn û dayîna mal an xizmetên di reklaman de rasterast di navbera bikarhêneran de ye û RojDeal wan naxebitîne.

Awayên dayînê berî daxwazê tên nîşandan û di destpêkê de dikarin cash an PayPal bi kontrola destî bin. Bilindkirin tenê piştî piştrastkirina dayînê û kontrolê çalak dibe. Belgeya sexte dikare bibe sedema redkirin û sînordarkirina hesabê.

Nirx, naverok, dem û bac berî şandinê tên nîşandan. Heke bi eşkere neyê gotin, abonetiya xweber nûbû tune ye. Heke çalakkirin ne gengaz be an daxwaz were redkirin, pere bi heman rê an rêya lihevkirî tê vegerandin. Mafên mecbûrî yên xerîdar diparêzin. Piştgirî: Royarkanan@gmail.com. Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=payment_terms&lang=ku',now(),true,false,owner_id,owner_id),

  ('cookie_policy','1.0','de','Cookie- und lokale Speicher-Richtlinie',$doc$
Die native RojDeal-App verwendet keine klassischen Browser-Cookies. Sie kann jedoch sichere lokale Gerätespeicher für Sitzung, Sprache, Einstellungen und Zwischenspeicherung nutzen. Die öffentliche RojDeal-Webdarstellung und rechtliche Seiten verwenden nur technisch notwendige Funktionen, soweit dies für Sicherheit, Darstellung und Sitzungsbetrieb erforderlich ist.

Optionale Analyse-, Werbe- oder Marketing-Cookies werden nicht ohne eine erforderliche Einwilligung gesetzt. Bei einer späteren Web-Erweiterung wird eine Auswahlmöglichkeit bereitgestellt, bevor nicht notwendige Technologien aktiviert werden. Nutzer können lokale App-Daten über Geräte- oder App-Einstellungen löschen; dies kann eine erneute Anmeldung erforderlich machen.

Stand: 25. August 2026.
$doc$,base_url||'?type=cookie_policy&lang=de',now(),true,false,owner_id,owner_id),
  ('cookie_policy','1.0','en','Cookie and Local Storage Policy',$doc$
The native RojDeal app does not use traditional browser cookies, but may use secure local device storage for sessions, language, settings and caching. Public RojDeal web and legal pages use only technically necessary functions for security, display and session operation.

Optional analytics, advertising or marketing cookies are not placed without required consent. If future web features introduce non-essential technologies, a choice will be provided before activation. Users can clear local app data through device or app settings, which may require signing in again. Effective: 25 August 2026.
$doc$,base_url||'?type=cookie_policy&lang=en',now(),true,false,owner_id,owner_id),
  ('cookie_policy','1.0','ar','سياسة ملفات الارتباط والتخزين المحلي',$doc$
لا يستخدم تطبيق RojDeal الأصلي ملفات ارتباط المتصفح التقليدية، لكنه قد يستخدم تخزيناً محلياً آمناً للجلسة واللغة والإعدادات والتخزين المؤقت. تستخدم صفحات RojDeal العامة والقانونية على الويب الوظائف الضرورية تقنياً فقط للأمان والعرض والجلسة.

لا تُفعّل ملفات التحليل أو الإعلان أو التسويق الاختيارية دون الموافقة المطلوبة. إذا أضيفت مستقبلاً تقنيات ويب غير ضرورية، سيظهر خيار قبل تفعيلها. يمكن حذف بيانات التطبيق المحلية من إعدادات الجهاز أو التطبيق، وقد يتطلب ذلك تسجيل الدخول مجدداً. سارية من 25 آب/أغسطس 2026.
$doc$,base_url||'?type=cookie_policy&lang=ar',now(),true,false,owner_id,owner_id),
  ('cookie_policy','1.0','ku','Polîtîkaya cookie û depokirina herêmî',$doc$
Sepana RojDeal cookieyên kevneşopî yên browserê bi kar nayîne, lê dikare ji bo session, ziman, mîheng û cache depokirina ewle ya amûrê bi kar bîne. Rûpelên giştî û qanûnî yên webê tenê karên teknîkî yên pêwîst ji bo ewlehî û nîşandanê bi kar tînin.

Cookieyên analîz, reklam an marketingê bê razîbûna pêwîst nayên çalakkirin. Heke di paşerojê de teknîkên ne-pêwîst bêne zêdekirin, berî çalakkirinê hilbijartin tê dayîn. Daneyên herêmî ji mîhengên amûr an sepanê dikarin werin jêbirin. Ji 25 Tebax 2026 ve derbasdar e.
$doc$,base_url||'?type=cookie_policy&lang=ku',now(),true,false,owner_id,owner_id),

  ('ad_privacy','1.0','de','Datenschutz bei Werbung',$doc$
RojDeal kann eigene oder direkt gebuchte Anzeigen innerhalb der Plattform anzeigen und aggregierte Kennzahlen wie Einblendungen und Interaktionen erfassen. Diese Daten dienen Auslieferung, Abrechnung, Betrugsprävention und Reichweitenmessung. Zum Start findet kein app-übergreifendes Tracking durch RojDeal statt und es werden keine personenbezogenen Daten an Werbenetzwerke für verhaltensbasierte Werbung verkauft.

Anzeigenkunden erhalten grundsätzlich nur zusammengefasste Statistiken, nicht private Chatdaten oder genaue Standortverläufe. Standort kann auf Wunsch zur lokalen Suche oder zur Anzeige regional relevanter Inhalte verwendet werden. Eine spätere Einführung von Drittanbieter-Tracking oder personalisierter Werbung erfordert eine Aktualisierung dieser Erklärung, der Store-Angaben und gegebenenfalls Ihre vorherige Einwilligung.
$doc$,base_url||'?type=ad_privacy&lang=de',now(),true,false,owner_id,owner_id),
  ('ad_privacy','1.0','en','Advertising Privacy',$doc$
RojDeal may display its own or directly booked ads and measure aggregate impressions and interactions for delivery, billing, fraud prevention and reach reporting. At launch RojDeal does not perform cross-app tracking and does not sell personal data to ad networks for behavioural advertising.

Advertisers normally receive aggregate statistics, not private chats or precise location history. Optional location may support local search or regional content. Future third-party tracking or personalised advertising requires an updated notice, updated store disclosures and consent where required.
$doc$,base_url||'?type=ad_privacy&lang=en',now(),true,false,owner_id,owner_id),
  ('ad_privacy','1.0','ar','خصوصية الإعلانات',$doc$
قد تعرض RojDeal إعلانات خاصة بها أو محجوزة مباشرة وتقيس بشكل مجمّع مرات الظهور والتفاعل للتسليم والفوترة ومنع الاحتيال وقياس الوصول. عند الإطلاق لا تقوم RojDeal بالتتبع عبر التطبيقات ولا تبيع البيانات الشخصية لشبكات إعلانية من أجل الإعلانات السلوكية.

يحصل المعلن عادة على إحصاءات مجمّعة فقط، وليس على الدردشات الخاصة أو سجل الموقع الدقيق. يمكن استخدام الموقع الاختياري للبحث المحلي أو المحتوى الإقليمي. أي تتبع خارجي أو إعلان مخصص مستقبلاً يتطلب تحديث هذه السياسة وتصريحات المتجر والحصول على الموافقة عند الحاجة.
$doc$,base_url||'?type=ad_privacy&lang=ar',now(),true,false,owner_id,owner_id),
  ('ad_privacy','1.0','ku','Taybetiya reklaman',$doc$
RojDeal dikare reklamên xwe an reklamên rasterast nîşan bide û hejmarên giştî yên dîtin û têkiliyê ji bo belavkirin, hesab, pêşîlêgirtina xapandinê û pîvana gihîştinê tomar bike. Di destpêkê de RojDeal di nav sepanan de şopandinê nake û daneyên kesane ji bo reklamên reftarî nafiroşe.

Reklamker tenê statistikên giştî werdigirin, ne sohbetên taybet an dîroka cihê hûrgulî. Cihê bi destûr dikare ji bo lêgerîna herêmî were bikaranîn. Şopandin an reklamên kesane yên paşerojê hewceyê nûkirina vê daxuyaniyê û razîbûnê ne.
$doc$,base_url||'?type=ad_privacy&lang=ku',now(),true,false,owner_id,owner_id)
  on conflict (document_type, version, language) do update set
    title = excluded.title,
    content = excluded.content,
    public_url = excluded.public_url,
    effective_at = excluded.effective_at,
    is_active = excluded.is_active,
    requires_acceptance = excluded.requires_acceptance,
    updated_by = excluded.updated_by,
    updated_at = now();
end
$setup$;

commit;
