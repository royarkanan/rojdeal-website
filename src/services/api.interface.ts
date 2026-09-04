import { Listing, ListingFilterParams, ListingStatus } from "@/types/listing";

export interface IListingRepository {
  getListings(params?: ListingFilterParams): Promise<Listing[]>;
  getFeaturedListings(): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | null>;
  getOwnListings(): Promise<Listing[]>;
  setOwnListingStatus(id: string, status: ListingStatus): Promise<void>;
  requestOwnListingDeletion(id: string): Promise<void>;
}
