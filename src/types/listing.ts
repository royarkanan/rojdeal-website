export type Category = "real_estate" | "vehicles" | "miscellaneous";
export type ListingPurpose = "sell" | "rent" | "wanted";
export type ListingTransactionType =
  | "sale"
  | "rent"
  | "lease"
  | "exchange"
  | "installment"
  | "donation"
  | "partnership"
  | "assignment"
  | "other";
export type ListingStatus =
  "active" | "draft" | "hidden" | "reserved" | "sold" | "removed" | "rejected";
export type ListingPriceType =
  "fixed" | "negotiable" | "contact" | "offers" | "free";

export interface LocationInfo {
  latitude?:number|null;
  longitude?:number|null;
  pathNames?: Record<string,string>;
  governorate: string;
  city: string;
  cityNames?: Record<string, string>;
  district?: string;
}

export interface SellerInfo {
  id: string;
  name: string;
  accountBadge: "PRO" | "GOLD" | null;
  isVerified: boolean;
  joinedDate: string;
  avatarUrl?: string;
}

export interface Listing {
  id: string;
  publicCode?: string;
  characteristicLabels?: Record<string, Record<string,string>>;
  characteristicOptions?: Record<string, Record<string,Record<string,string>>>;
  title: string;
  description: string;
  category: Category;
  subType?: string;
  customSubType?: string;
  categoryNames?: Record<string, string>;
  categoryTypeNames?: Record<string, string>;
  purpose: ListingPurpose;
  status: ListingStatus;
  price: number | null;
  priceType?: ListingPriceType;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  isPriceContact: boolean;
  images: string[];
  videos?: string[];
  location: LocationInfo;
  publishedAt: string;
  isFeatured: boolean;
  characteristics: Record<string, any>;
  viewCount?: number;
  favoriteCount?: number;
  contactPhone?: string;
  contactEmail?: string;
  directCallEnabled?: boolean;
  chatEnabled?: boolean;
  whatsappEnabled?: boolean;
  seller: SellerInfo;
}

export interface ListingFilterParams {
  sellerId?: string;
  /** When set, returns 24 rows plus one next-page sentinel. */
  page?: number;
  category?: Category;
  purpose?: ListingPurpose;
  transactionType?: ListingTransactionType;
  query?: string;
  governorate?: string;
  city?: string;
  locationNodeIds?: number[];
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "newest" | "price_asc" | "price_desc";
}
