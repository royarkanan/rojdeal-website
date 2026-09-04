# ربط RojDeal بالدومين — بعد اجتياز بوابات النشر

لم يُنشر هذا المشروع ولم تُغيّر DNS أو Supabase. إعدادات Cloudflare أضيفت للكود فقط. لا تستخدم بناء mock على الموقع العام. لا توافق على اشتراك مدفوع تلقائياً؛ راجع حدود الخطة وحجم Worker عند النشر.

## ما أضيف

- OpenNext Cloudflare 1.20.5 وWrangler 4.125.0 مثبتان بإصدار محدد، مع Next.js 15.5.24 الحالي؛ دون ترقية إطار التطبيق.
- open-next.config.ts وwrangler.jsonc: Worker ديناميكي، أصول ثابتة وSELF binding. لا توجد أوامر إنشاء مخازن R2 أو نقل الدومين.
- صور Cloudflare تُعرض مباشرة من مصادرها بدلاً من خدمة تحسين صور مدفوعة. أذونات المخزن ومراجعة الفيديو تظل مسؤولية Supabase.
- Node 24 هو خيار .nvmrc. Node 22.13+ ضمن سلسلة22 مقبول أيضاً؛ إصدار22.12 الموجود على الماك أقدم من متطلبات اعتماديات التطوير.

## قبل أي رفع

1. اعمل على نسخة اختبار منفصلة واحتفظ بمشروع الماك الأصلي.
2. أكمل متطلبات PRELAUNCH-STATUS.md، خصوصاً صلاحيات الدعم والحذف والصفحات القانونية.
3. استخدم إعدادات Supabase العامة لنفس مشروع التطبيق، ولا تستخدم service_role أو sb_secret في NEXT_PUBLIC أو المتصفح. المفاتيح السرية غير مطلوبة لبناء الواجهة.
4. إعدادات البناء المطلوبة:
   - NEXT_PUBLIC_DATA_SOURCE=supabase
   - NEXT_PUBLIC_SUPABASE_URL=عنوان مشروعك HTTPS
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=مفتاح anon/public فقط
   - NEXT_PUBLIC_SITE_URL=https://rojdeal.app
   - NEXT_PUBLIC_SUPPORT_EMAIL=support@rojdeal.app
5. لا تحفظ ملف البيئة في Git ولا ترفعه للمحادثة. بادئة NEXT_PUBLIC تعني أن القيمة تدخل حزمة المتصفح؛ تغييراتها تحتاج إعادة بناء.

## الفحص والبناء دون نشر

```sh
npm ci
npm run typecheck
npm run lint
npm run test
npm run preflight
npm run cf:build
```

preflight يتحقق من شكل الإعدادات ولا يتأكد من صلاحيات المستخدم أو وصول البريد. cf:build يبني فقط ولا يربط الدومين.

للتجربة المحلية ببيانات غير حقيقية فقط:

```sh
NEXT_PUBLIC_DATA_SOURCE=mock npm run build
npm run test:smoke
```

بعدها أعد البناء ببيانات الإنتاج الصحيحة قبل النشر. يمكن معاينة Worker محلياً بالأمر npm run cf:preview بعد cf:build؛ هذا لا يختبر OAuth والبريد على الدومين النهائي.

## النشر: خطوة خارجية ينفّذها صاحب الحساب بعد الموافقة

- تسجيل دخول Wrangler لحساب Cloudflare الصحيح، والتحقق من خطة الحساب وحدوده، خطوات تتم على جهازك؛ لا تشارك رموز الدخول.
- npm run cf:deploy ينفّذ preflight ثم البناء ثم النشر، ولذلك **لا تشغّله أثناء الفحص فقط**.
- workers_dev=false متعمد في الإعداد الحالي؛ النشر وحده لا يعني أن rojdeal.app مرتبط. اربط Custom Domain باسم rojdeal.app بالـWorker rojdeal-web من لوحة Cloudflare بعد نجاح الرفع، واختبر HTTPS.
- لا تحذف سجلات MX/TXT الخاصة بالبريد عند إعداد الموقع. لا تغيّر أسماء خوادم الدومين لمجرد رفع Worker.
- اختبر كل مسار ديناميكي، تحميل الصور، البحث والدخول بحساب عادي وحساب موظف. واجهة static export لا تكفي لهذا المشروع.
- اضبط Site URL وRedirect URLs في Supabase للدومين النهائي، ثم جرّب Google واستعادة كلمة المرور. التحويل إلى Outlook يستقبل البريد فقط؛ الإرسال باسم الدومين يحتاج SMTP/خدمة إرسال مُعتمدة ومضبوطة داخل Supabase.
- تحدّث روابط الموقع والخصوصية والحذف في المتجر بعد اعتماد الروابط العامة، لا قبل ذلك.

المراجع الرسمية المستخدمة لاختيار المحوّل:

- https://opennext.js.org/cloudflare/get-started
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/

لا توجد خدمة دفع أو منصة إعلانات أو صناديق بريد موظفين مفعّلة ضمن هذه الحزمة.
