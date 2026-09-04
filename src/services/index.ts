import { IListingRepository } from "./api.interface";
import { listingService as mockService } from "./mock-adapter";
import { SupabaseListingAdapter } from "./supabase-adapter";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE || "supabase";
const hasValidSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co"
);

if (!['supabase', 'mock'].includes(dataSource)) throw new Error('Invalid NEXT_PUBLIC_DATA_SOURCE');
if (dataSource === 'supabase' && (!hasValidSupabase || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error('Supabase configuration is missing. Set URL and public anon key, or explicitly select mock for local testing.');
}
export const listingService: IListingRepository = dataSource === 'mock'
  ? (mockService as unknown as IListingRepository)
  : new SupabaseListingAdapter();
