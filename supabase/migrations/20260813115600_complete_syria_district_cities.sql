create temporary table rojdeal_syria_district_seed (
  region_slug text not null,
  node_slug text not null,
  city_slug text not null,
  names jsonb not null,
  sort_order integer not null
) on commit drop;
insert into rojdeal_syria_district_seed
  (region_slug, node_slug, city_slug, names, sort_order)
values
  -- دمشق
  ('damascus','damascus-city','damascus',
   '{"ar":"مدينة دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}',10),

  -- ريف دمشق
  ('rif-dimashq','rif-dimashq-center','rif-dimashq-center',
   '{"ar":"مركز ريف دمشق","ku":"Navenda Rif Dimashq","en":"Rif Dimashq Center","de":"Zentrum Rif Dimaschq"}',10),
  ('rif-dimashq','douma','douma',
   '{"ar":"دوما","ku":"Dûma","en":"Douma","de":"Douma"}',20),
  ('rif-dimashq','al-tall','al-tall',
   '{"ar":"التل","ku":"Et-Tel","en":"Al-Tall","de":"Al-Tall"}',30),
  ('rif-dimashq','al-qutayfah','al-qutayfah',
   '{"ar":"القطيفة","ku":"Quteyfe","en":"Al-Qutayfah","de":"Al-Qutayfah"}',40),
  ('rif-dimashq','yabroud','yabroud',
   '{"ar":"يبرود","ku":"Yebrûd","en":"Yabroud","de":"Yabroud"}',50),
  ('rif-dimashq','an-nabk','an-nabk',
   '{"ar":"النبك","ku":"Nebk","en":"An-Nabk","de":"An-Nabk"}',60),
  ('rif-dimashq','az-zabadani','az-zabadani',
   '{"ar":"الزبداني","ku":"Zebedanî","en":"Az-Zabadani","de":"Az-Zabadani"}',70),
  ('rif-dimashq','qatana','qatana',
   '{"ar":"قطنا","ku":"Qetena","en":"Qatana","de":"Qatana"}',80),
  ('rif-dimashq','darayya','darayya',
   '{"ar":"داريا","ku":"Darayya","en":"Darayya","de":"Darayya"}',90),
  ('rif-dimashq','qudsaya','qudsaya',
   '{"ar":"قدسيا","ku":"Qudsaya","en":"Qudsaya","de":"Qudsaya"}',100),

  -- حلب
  ('aleppo','aleppo-city','aleppo-city',
   '{"ar":"مدينة حلب","ku":"Heleb","en":"Aleppo City","de":"Stadt Aleppo"}',10),
  ('aleppo','afrin','afrin',
   '{"ar":"عفرين","ku":"Efrîn","en":"Afrin","de":"Afrin"}',20),
  ('aleppo','azaz','azaz',
   '{"ar":"أعزاز","ku":"Ezaz","en":"Azaz","de":"Azaz"}',30),
  ('aleppo','al-bab','al-bab',
   '{"ar":"الباب","ku":"El-Bab","en":"Al-Bab","de":"Al-Bab"}',40),
  ('aleppo','manbij','manbij',
   '{"ar":"منبج","ku":"Minbic","en":"Manbij","de":"Manbidsch"}',50),
  ('aleppo','jarablus','jarablus',
   '{"ar":"جرابلس","ku":"Cerablus","en":"Jarablus","de":"Dscharabulus"}',60),
  ('aleppo','kobani','kobani',
   '{"ar":"كوباني","ku":"Kobanî","en":"Kobani","de":"Kobani"}',70),
  ('aleppo','as-safira','as-safira',
   '{"ar":"السفيرة","ku":"Sefîre","en":"As-Safira","de":"As-Safira"}',80),
  ('aleppo','atarib','atarib',
   '{"ar":"الأتارب","ku":"Etarib","en":"Atarib","de":"Atarib"}',90),

  -- إدلب
  ('idlib','idlib-city','idlib-city',
   '{"ar":"إدلب","ku":"Idlib","en":"Idlib","de":"Idlib"}',10),
  ('idlib','maarrat-al-numan','maarrat-al-numan',
   '{"ar":"معرة النعمان","ku":"Maarret en-Numan","en":"Maarrat al-Numan","de":"Maarrat an-Numan"}',20),
  ('idlib','jisr-ash-shughur','jisr-ash-shughur',
   '{"ar":"جسر الشغور","ku":"Cisr eş-Şuğûr","en":"Jisr ash-Shughur","de":"Dschisr asch-Schughur"}',30),
  ('idlib','ariha','ariha',
   '{"ar":"أريحا","ku":"Erîha","en":"Ariha","de":"Ariha"}',40),
  ('idlib','harem','harem',
   '{"ar":"حارم","ku":"Harim","en":"Harem","de":"Harem"}',50),

  -- حمص
  ('homs','homs-city','homs-city',
   '{"ar":"حمص","ku":"Hims","en":"Homs","de":"Homs"}',10),
  ('homs','ar-rastan','ar-rastan',
   '{"ar":"الرستن","ku":"Resten","en":"Ar-Rastan","de":"Ar-Rastan"}',20),
  ('homs','al-mukharram','al-mukharram',
   '{"ar":"المخرم","ku":"Muxerem","en":"Al-Mukharram","de":"Al-Mukharram"}',30),
  ('homs','al-qusayr','al-qusayr',
   '{"ar":"القصير","ku":"Quseyr","en":"Al-Qusayr","de":"Al-Qusayr"}',40),
  ('homs','talkalakh','talkalakh',
   '{"ar":"تلكلخ","ku":"Telkeleh","en":"Talkalakh","de":"Talkalakh"}',50),
  ('homs','tadmur','tadmur',
   '{"ar":"تدمر","ku":"Tedmur","en":"Tadmur","de":"Palmyra / Tadmur"}',60),

  -- حماة
  ('hama','hama-city','hama-city',
   '{"ar":"حماة","ku":"Hama","en":"Hama","de":"Hama"}',10),
  ('hama','masyaf','masyaf',
   '{"ar":"مصياف","ku":"Mesyaf","en":"Masyaf","de":"Masyaf"}',20),
  ('hama','mahardah','mahardah',
   '{"ar":"محردة","ku":"Mehreda","en":"Mahardah","de":"Mahardah"}',30),
  ('hama','salamiyah','salamiyah',
   '{"ar":"السلمية","ku":"Selemiye","en":"Salamiyah","de":"Salamiyah"}',40),
  ('hama','as-suqaylabiyah','as-suqaylabiyah',
   '{"ar":"السقيلبية","ku":"Suqeylabiye","en":"As-Suqaylabiyah","de":"As-Suqaylabiyah"}',50),

  -- اللاذقية
  ('latakia','latakia-city','latakia-city',
   '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}',10),
  ('latakia','jableh','jableh',
   '{"ar":"جبلة","ku":"Ceble","en":"Jableh","de":"Dschabla"}',20),
  ('latakia','qardaha','qardaha',
   '{"ar":"القرداحة","ku":"Qerdeha","en":"Qardaha","de":"Qardaha"}',30),
  ('latakia','al-haffah','al-haffah',
   '{"ar":"الحفة","ku":"Hefê","en":"Al-Haffah","de":"Al-Haffah"}',40),

  -- طرطوس
  ('tartus','tartus-city','tartus-city',
   '{"ar":"طرطوس","ku":"Tertûs","en":"Tartus","de":"Tartus"}',10),
  ('tartus','baniyas','baniyas',
   '{"ar":"بانياس","ku":"Banyas","en":"Baniyas","de":"Baniyas"}',20),
  ('tartus','safita','safita',
   '{"ar":"صافيتا","ku":"Safita","en":"Safita","de":"Safita"}',30),
  ('tartus','duraykish','duraykish',
   '{"ar":"الدريكيش","ku":"Dreykîş","en":"Duraykish","de":"Duraykish"}',40),
  ('tartus','sheikh-badr','sheikh-badr',
   '{"ar":"الشيخ بدر","ku":"Şêx Bedir","en":"Sheikh Badr","de":"Scheich Badr"}',50),

  -- الرقة
  ('raqqa','raqqa-city','raqqa-city',
   '{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}',10),
  ('raqqa','tabqa','tabqa',
   '{"ar":"الطبقة","ku":"Tebqa","en":"Tabqa","de":"Tabqa"}',20),
  ('raqqa','tell-abyad','tell-abyad',
   '{"ar":"تل أبيض","ku":"Girê Spî","en":"Tell Abyad","de":"Tall Abyad"}',30),

  -- دير الزور
  ('deir-ez-zor','deir-ez-zor-city','deir-ez-zor-city',
   '{"ar":"دير الزور","ku":"Dêrazor","en":"Deir ez-Zor","de":"Deir ez-Zor"}',10),
  ('deir-ez-zor','al-mayadin','al-mayadin',
   '{"ar":"الميادين","ku":"Meyadîn","en":"Al-Mayadin","de":"Al-Mayadin"}',20),
  ('deir-ez-zor','al-bukamal','al-bukamal',
   '{"ar":"البوكمال","ku":"Ebu Kemal","en":"Al-Bukamal","de":"Al-Bukamal"}',30),

  -- الحسكة
  ('hasakah','hasakah-city','hasakah-city',
   '{"ar":"الحسكة","ku":"Hesekê","en":"Hasakah","de":"Al-Hasaka"}',10),
  ('hasakah','qamishli','qamishli',
   '{"ar":"القامشلي","ku":"Qamişlo","en":"Qamishli","de":"Qamischli"}',20),
  ('hasakah','al-malikiyah','al-malikiyah',
   '{"ar":"المالكية","ku":"Dêrik","en":"Al-Malikiyah","de":"Al-Malikiyah"}',30),
  ('hasakah','ras-al-ayn','ras-al-ayn',
   '{"ar":"رأس العين","ku":"Serê Kaniyê","en":"Ras al-Ayn","de":"Ras al-Ain"}',40),

  -- درعا
  ('daraa','daraa-city','daraa-city',
   '{"ar":"درعا","ku":"Dera","en":"Daraa","de":"Daraa"}',10),
  ('daraa','izra','izra',
   '{"ar":"إزرع","ku":"Izra","en":"Izra","de":"Izra"}',20),
  ('daraa','as-sanamayn','as-sanamayn',
   '{"ar":"الصنمين","ku":"Senemeyn","en":"As-Sanamayn","de":"As-Sanamayn"}',30),

  -- السويداء
  ('as-suwayda','as-suwayda-city','as-suwayda-city',
   '{"ar":"السويداء","ku":"Siweyda","en":"As-Suwayda","de":"As-Suwaida"}',10),
  ('as-suwayda','salkhad','salkhad',
   '{"ar":"صلخد","ku":"Selxed","en":"Salkhad","de":"Salkhad"}',20),
  ('as-suwayda','shahba','shahba',
   '{"ar":"شهبا","ku":"Şehba","en":"Shahba","de":"Shahba"}',30),

  -- القنيطرة
  ('quneitra','quneitra-city','quneitra-city',
   '{"ar":"القنيطرة","ku":"Quneitra","en":"Quneitra","de":"Quneitra"}',10),
  ('quneitra','fiq','fiq',
   '{"ar":"فيق","ku":"Fîq","en":"Fiq","de":"Fiq"}',20);
-- إنشاء/تحديث المدن
insert into public.cities (
  region_id,
  slug,
  names,
  is_active,
  is_main_city,
  sort_order
)
select
  region.id,
  seed.city_slug,
  seed.names,
  true,
  true,
  seed.sort_order
from rojdeal_syria_district_seed seed
join public.regions region
  on region.slug = seed.region_slug
on conflict (slug) do update set
  region_id = excluded.region_id,
  names = excluded.names,
  is_active = true,
  is_main_city = true,
  sort_order = excluded.sort_order;
-- إنشاء/تحديث المستوى الثاني في شجرة المواقع
insert into public.location_nodes (
  parent_id,
  kind,
  slug,
  names,
  city_id,
  sort_order,
  is_active
)
select
  governorate.id,
  'district',
  seed.node_slug,
  seed.names,
  city.id,
  seed.sort_order,
  true
from rojdeal_syria_district_seed seed
join public.location_nodes governorate
  on governorate.slug = seed.region_slug
 and governorate.kind = 'governorate'
join public.cities city
  on city.slug = seed.city_slug
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  kind = 'district',
  names = excluded.names,
  city_id = excluded.city_id,
  sort_order = excluded.sort_order,
  is_active = true;
-- تصحيح أسماء المناطق كما في مرجع التقسيمات الإدارية،
-- مع إبقاء أسماء المدن في public.cities كما هي.
update public.location_nodes
set names = '{"ar":"جبل سمعان","ku":"Cebel Semaan","en":"Jabal Semaan","de":"Dschabal Semaan"}'::jsonb
where slug = 'aleppo-city'
  and kind = 'district';
update public.location_nodes
set names = '{"ar":"الثورة (الطبقة)","ku":"Eş-Şewra (Tebqa)","en":"Ath-Thawrah (Tabqa)","de":"Ath-Thawrah (Tabqa)"}'::jsonb
where slug = 'tabqa'
  and kind = 'district';
-- ربط أي إعلان قديم ليس لديه location_node_id بعقدة مدينته
update public.listings listing
set location_node_id = node.id
from public.location_nodes node
where listing.location_node_id is null
  and node.kind = 'district'
  and node.city_id = listing.city_id;
