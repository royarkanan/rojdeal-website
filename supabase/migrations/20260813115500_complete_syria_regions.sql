insert into public.regions (slug, names, sort_order) values
  ('damascus', '{"ar":"دمشق","ku":"Şam","en":"Damascus","de":"Damaskus"}', 10),
  ('rif-dimashq', '{"ar":"ريف دمشق","ku":"Gundê Şamê","en":"Rif Dimashq","de":"Rif Dimaschq"}', 20),
  ('aleppo', '{"ar":"حلب","ku":"Heleb","en":"Aleppo","de":"Aleppo"}', 30),
  ('hasakah', '{"ar":"الحسكة","ku":"Hesekê","en":"Al-Hasakah","de":"Al-Hasaka"}', 40),
  ('raqqa', '{"ar":"الرقة","ku":"Reqayê","en":"Raqqa","de":"Raqqa"}', 50),
  ('deir-ez-zor', '{"ar":"دير الزور","ku":"Dêrazor","en":"Deir ez-Zor","de":"Deir ez-Zor"}', 60),
  ('idlib', '{"ar":"إدلب","ku":"Idlib","en":"Idlib","de":"Idlib"}', 70),
  ('hama', '{"ar":"حماة","ku":"Hama","en":"Hama","de":"Hama"}', 80),
  ('homs', '{"ar":"حمص","ku":"Hims","en":"Homs","de":"Homs"}', 90),
  ('latakia', '{"ar":"اللاذقية","ku":"Lazqiyê","en":"Latakia","de":"Latakia"}', 100),
  ('tartus', '{"ar":"طرطوس","ku":"Tertûs","en":"Tartus","de":"Tartus"}', 110),
  ('daraa', '{"ar":"درعا","ku":"Dera","en":"Daraa","de":"Daraa"}', 120),
  ('as-suwayda', '{"ar":"السويداء","ku":"Siweyda","en":"As-Suwayda","de":"As-Suwaida"}', 130),
  ('quneitra', '{"ar":"القنيطرة","ku":"Quneitra","en":"Quneitra","de":"Quneitra"}', 140)
on conflict (slug) do update set
  names = excluded.names,
  sort_order = excluded.sort_order;
