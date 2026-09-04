import { supabase } from "@/lib/supabase";
export type WebConversation = {
  id: string;
  listingId: string;
  listingTitle: string;
  counterpart: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};
export type WebMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  read: boolean;
  deleted?:boolean;
  attachments?:{id:string;name:string;url:string|null;kind:string;sizeBytes:number}[];
};
async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("authentication_required");
  return data.user;
}
export async function favoriteIds() {
  const u = await currentUser();
  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", u.id);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.listing_id)));
}
export async function setFavorite(listingId: string, favorite: boolean) {
  const u = await currentUser();
  const q = favorite
    ? supabase
        .from("favorites")
        .upsert({ user_id: u.id, listing_id: listingId })
    : supabase
        .from("favorites")
        .delete()
        .eq("user_id", u.id)
        .eq("listing_id", listingId);
  const { error } = await q;
  if (error) throw error;
}
export async function openConversation(listingId: string, sellerId: string) {
  const u = await currentUser();
  if (!sellerId || sellerId === u.id) throw new Error("invalid_conversation");
  const { data: old, error: lookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", u.id)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (old) return String(old.id);
  const { data, error } = await supabase
    .from("conversations")
    .insert({ listing_id: listingId, buyer_id: u.id, seller_id: sellerId })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}
export async function conversations(): Promise<WebConversation[]> {
  const u = await currentUser();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id,listing_id,buyer_id,seller_id,last_message_at,listing:listings!conversations_listing_id_fkey(title),buyer:profiles!conversations_buyer_id_fkey(display_name),seller:profiles!conversations_seller_id_fkey(display_name,business_name)",
    )
    .or(`buyer_id.eq.${u.id},seller_id.eq.${u.id}`)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => String(r.id));
  const result = ids.length
    ? await supabase
        .from("messages")
        .select("conversation_id,sender_id,body,created_at,read_at,deleted_for_everyone_at")
        .in("conversation_id", ids)
        .is("deleted_for_everyone_at", null)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (result.error) throw result.error;
  return (data ?? []).map((raw) => {
    const row = raw as Record<string, any>,
      seller = row.seller_id === u.id,
      person = (seller ? row.buyer : row.seller) as Record<string, any> | null,
      list = (result.data ?? []).filter((m) => m.conversation_id === row.id);
    return {
      id: String(row.id),
      listingId: String(row.listing_id),
      listingTitle: String((row.listing as any)?.title ?? ""),
      counterpart: String(
        person?.business_name || person?.display_name || "RojDeal",
      ),
      lastMessage: String(list[0]?.body ?? ""),
      lastMessageAt: String(list[0]?.created_at ?? row.last_message_at ?? ""),
      unread: list.filter((m) => m.sender_id !== u.id && m.read_at == null)
        .length,
    };
  });
}
export async function messages(id: string): Promise<WebMessage[]> {
  const u = await currentUser();
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,body,created_at,read_at,deleted_for_everyone_at,message_attachments(id,kind,storage_path,original_name,size_bytes,upload_state,deleted_at)")
    .eq("conversation_id", id)
    .is("deleted_for_everyone_at", null)
    .order("created_at");
  if (error) throw error;
  await supabase.rpc("mark_conversation_read", { target_conversation: id });
  return Promise.all((data??[])
    .filter(r=>!r.deleted_for_everyone_at)
    .map(async r=>({
    id:String(r.id),body:String(r.body??''),mine:r.sender_id===u.id,createdAt:String(r.created_at),read:r.read_at!=null,
    attachments:await Promise.all((r.message_attachments??[]).filter(a=>a.upload_state==='complete'&&a.deleted_at==null).map(async a=>{let url:string|null=null;try{const signed=await supabase.storage.from('chat-attachments').createSignedUrl(a.storage_path,3600);if(!signed.error)url=signed.data?.signedUrl??null;}catch{/* Keep the conversation readable when an attachment cannot load. */}return{id:String(a.id),name:String(a.original_name),kind:String(a.kind),sizeBytes:Number(a.size_bytes??0),url};})),
  })));

}
export async function sendMessage(id: string, body: string) {
  const u = await currentUser(),
    value = body.trim();
  if (!value) return;
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id: u.id, body: value });
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);
}
export async function adminAccess() {
  const u = await currentUser();
  const [profileResult, ownerResult, permissionResult] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", u.id).maybeSingle(),
      supabase.rpc("is_platform_owner"),
      supabase.rpc("get_my_staff_permissions"),
    ]);
  if(profileResult.error)throw profileResult.error;
  if(ownerResult.error)throw ownerResult.error;
  const owner=ownerResult.data;
  const role = String(profileResult.data?.role ?? "user");
  const values = (
    permissionResult.data && typeof permissionResult.data === "object"
      ? permissionResult.data
      : {}
  ) as Record<string, unknown>;
  if (permissionResult.error) throw permissionResult.error;
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === true]),
  ) as Record<string, boolean>;
  const keys = [
    "listings",
    "reports",
    "locations",
    "users",
    "media",
    "staff",
    "support",
    "tiers",
    "audit",
    "platform_content",
  ];
  // Permissions come from the authenticated database RPC, never a UI role guess.
  for (const key of keys) normalized[key] ??= false;
  return {
    allowed:
      owner === true ||
      Object.values(normalized).some(Boolean),
    owner: owner === true,
    role,
    permissions: normalized,
  };
}
