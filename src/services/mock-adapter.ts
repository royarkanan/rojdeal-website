import { Listing, ListingFilterParams } from "@/types/listing";

export const MOCK_LOCATIONS = [
  {
    governorate: "دمشق",
    cities: ["دمشق القديمة", "المزة", "كفرسوسة", "المالكي", "الميدان"],
  },
  {
    governorate: "ريف دمشق",
    cities: ["جرمانا", "صحنايا", "قدسيا", "التل", "النبك"],
  },
  {
    governorate: "حلب",
    cities: ["حلب المدينة", "Kobani", "منبج", "عفرين", "شيوخ (شيغلر)"],
  },
  {
    governorate: "الحسكة",
    cities: ["الحسكة المدينة", "القامشلي", "عامودا", "المالكية", "الدرباسية"],
  },
  { governorate: "الرقة", cities: ["الرقة المدينة", "الطبقة", "تل أبيض"] },
  { governorate: "دير الزور", cities: ["دير الزور", "الميادين", "البوكمال"] },
  {
    governorate: "إدلب",
    cities: ["إدلب المدينة", "أريحا", "سرمدا", "معرة النعمان", "الدانا"],
  },
  {
    governorate: "حماة",
    cities: ["حماة المدينة", "السلمية", "مصياف", "محردة"],
  },
  { governorate: "حمص", cities: ["حمص المدينة", "تدمر", "الرستن", "القصير"] },
  {
    governorate: "اللاذقية",
    cities: ["اللاذقية المدينة", "جبلة", "القرداحة", "الحفة"],
  },
  {
    governorate: "طرطوس",
    cities: ["طرطوس المدينة", "بانياس", "الشيخ بدر - الرمال الذهبية", "صافيتا"],
  },
  { governorate: "درعا", cities: ["درعا المدينة", "ازرع", "نوى", "طفس"] },
  { governorate: "السويداء", cities: ["السويداء المدينة", "شهبا", "صلخد"] },
  { governorate: "القنيطرة", cities: ["القنيطرة", "خان أرنبة"] },
];

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "RD-10492",
    title: "سيارة حمراء فاخرة",
    description:
      "سيارة بحالة الوكالة ممتازة وخالية من الأعطال مع فحص شامل وصيانة دورية.",
    category: "vehicles",
    subType: "سيارة",
    purpose: "sell",
    status: "active",
    price: 700,
    currency: "EUR",
    isPriceContact: false,
    images: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800"],
    location: { governorate: "حلب", city: "حلب" },
    publishedAt: "2026-08-13T14:30:00Z",
    isFeatured: true,
    characteristics: { الموديل: "2024", "ناقل الحركة": "أوتوماتيك" },
    seller: {
      id: "1",
      name: "أحمد السوري",
      accountBadge: null,
      isVerified: true,
      joinedDate: "2025",
    },
  },
  {
    id: "RD-10493",
    title: "شاليه على النهر",
    description: "شاليه عائلي بتشطيبات راقية وموقع هادئ وإطلالة مميزة.",
    category: "real_estate",
    subType: "شاليه",
    purpose: "sell",
    status: "active",
    price: 1552,
    currency: "USD",
    isPriceContact: false,
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    ],
    location: {
      governorate: "حلب",
      city: "Kobani",
      district: "شيوخ (شيغلر) - قرية الجعدة",
    },
    publishedAt: "2026-08-02T11:00:00Z",
    isFeatured: true,
    characteristics: { المساحة: "220 م²", الغرف: "3" },
    seller: {
      id: "2",
      name: "عقارات روج",
      accountBadge: "PRO",
      isVerified: true,
      joinedDate: "2024",
    },
  },
  {
    id: "RD-10494",
    title: "شقة - شاليه عالبحر على الساحل",
    description: "شاليه مميز مباشرة على الشاطئ والرمال الذهبية بتشطيب ممتاز.",
    category: "real_estate",
    subType: "شاليه",
    purpose: "sell",
    status: "active",
    price: 1582,
    currency: "USD",
    isPriceContact: false,
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    ],
    location: {
      governorate: "طرطوس",
      city: "طرطوس",
      district: "الشيخ بدر – الرمال الذهبية",
    },
    publishedAt: "2026-08-02T10:00:00Z",
    isFeatured: false,
    characteristics: { المساحة: "140 م²" },
    seller: {
      id: "3",
      name: "أملاك الساحل",
      accountBadge: "PRO",
      isVerified: true,
      joinedDate: "2024",
    },
  },
  {
    id: "RD-10495",
    title: "شقة – فيلا طابقين",
    description: "فيلا طابقين مستقلة مع مسبح وحديقة خاصة وإطلالة رائعة.",
    category: "real_estate",
    subType: "شقة",
    customSubType: "فيلا طابقين",
    purpose: "sell",
    status: "sold",
    price: 50000,
    currency: "USD",
    isPriceContact: false,
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
    ],
    location: { governorate: "حلب", city: "Kobani", district: "طريق حلب" },
    publishedAt: "2026-07-31T09:15:00Z",
    isFeatured: false,
    characteristics: { المساحة: "450 م²", المسبح: "نعم" },
    seller: {
      id: "4",
      name: "مكتب روج العقاري",
      accountBadge: "PRO",
      isVerified: true,
      joinedDate: "2024",
    },
  },
  {
    id: "RD-10496",
    title: "منزل – فيلا بموقع ممتاز",
    description: "فيلا بموقع استراتيجي هادئ وتشطيب ديلوكس.",
    category: "real_estate",
    subType: "منزل",
    customSubType: "فيلا بموقع ممتاز",
    purpose: "sell",
    status: "reserved",
    price: 18000,
    currency: "USD",
    isPriceContact: false,
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    ],
    location: { governorate: "حلب", city: "Kobani", district: "حلنج" },
    publishedAt: "2026-07-31T08:00:00Z",
    isFeatured: false,
    characteristics: { المساحة: "300 م²" },
    seller: {
      id: "5",
      name: "روج ديل برو",
      accountBadge: "PRO",
      isVerified: true,
      joinedDate: "2024",
    },
  },
];

export const listingService = {
  getListings: async (params?: ListingFilterParams): Promise<Listing[]> => {
    let list = [...MOCK_LISTINGS];
    // Explicit, server-side fixture for acceptance checks; never used in Supabase mode.
    const fixtureCount=Number(process.env.ROJDEAL_TEST_LISTING_COUNT);
    if(Number.isInteger(fixtureCount)&&fixtureCount>0&&fixtureCount<=200)list=Array.from({length:fixtureCount},(_,i)=>({...MOCK_LISTINGS[i%MOCK_LISTINGS.length],id:`fixture-${i+1}`,images:['/images/placeholders/listing-offer.png']}));
    if(params?.sellerId)list=list.filter(item=>item.seller.id===params.sellerId);
    if (params?.category) {
      list = list.filter((item) => item.category === params.category);
    }
    if (params?.purpose) {
      list = list.filter((item) => item.purpose === params.purpose);
    }
    if (params?.governorate) {
      list = list.filter(
        (item) => item.location.governorate === params.governorate,
      );
    }
    if (params?.query) {
      const q = params.query.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q),
      );
    }
    if (params?.sortBy === "price_asc") {
      list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (params?.sortBy === "price_desc") {
      list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    }
    if(params?.minPrice!=null)list=list.filter(item=>item.price!=null&&item.price>=params.minPrice!);
    if(params?.maxPrice!=null)list=list.filter(item=>item.price!=null&&item.price<=params.maxPrice!);
    if(params?.transactionType)list=list.filter(item=>item.characteristics.transactionType===params.transactionType);
    return params?.page ? list.slice((params.page-1)*24,params.page*24+1) : list;
  },
  getFeaturedListings: async (): Promise<Listing[]> => {
    return MOCK_LISTINGS.filter((item) => item.isFeatured);
  },
  getListingById: async (id: string): Promise<Listing | null> => {
    const listing = MOCK_LISTINGS.find((item) => item.id === id);
    return listing || null;
  },
  getOwnListings: async (): Promise<Listing[]> => [...MOCK_LISTINGS],
  setOwnListingStatus: async (): Promise<void> => undefined,
  requestOwnListingDeletion: async (): Promise<void> => undefined,
};
