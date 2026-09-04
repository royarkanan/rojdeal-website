import { supabase } from "@/lib/supabase";

export type AdminRow = Record<string, unknown>;
export const ADMIN_PAGE_SIZE=50;

const rows = (value: unknown): AdminRow[] =>
  Array.isArray(value) ? value.map((item) => ({ ...(item as AdminRow) })) : [];

export async function adminUsers(search = "") {
  const { data, error } = await supabase.rpc("list_admin_user_accounts_v2", {
    search_term: search.trim(),
    result_limit: 100,
  });
  if (error) throw error;
  return rows(data);
}

export async function suspendAccount(
  userId: string,
  suspended: boolean,
  reason: string,
) {
  const { error } = await supabase.rpc("set_account_suspension", {
    target_user: userId,
    suspend_account: suspended,
    reason: reason.trim() || null,
  });
  if (error) throw error;
}

export async function setAccountTier(
  email: string,
  tier: "standard" | "pro" | "gold",
) {
  const { error } = await supabase.rpc("set_account_tier_by_email", {
    target_email: email.trim().toLowerCase(),
    new_tier: tier,
    target_location_node: null,
  });
  if (error) throw error;
}

export async function adminListings(search = '', page=0) {
  let query = supabase
    .from("listings")
    .select("id,public_code,title,state,owner_id,created_at,listing_direction,category,owner:profiles!listings_owner_id_fkey(display_name,business_name)");
  const term = search.trim().replace(/[,%()\"\\]/g, ' ');
  if (term) {
    const filters = [`title.ilike.%${term}%`, `public_code.ilike.%${term}%`];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) filters.push(`id.eq.${term}`);
    query = query.or(filters.join(','));
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order('id')
    .range(Math.max(0,page)*ADMIN_PAGE_SIZE,Math.max(0,page)*ADMIN_PAGE_SIZE+ADMIN_PAGE_SIZE);
  if (error) throw error;
  return rows(data);
}

export async function moderateListing(
  listingId: string,
  state: string,
  note: string,
) {
  if (state !== 'published' && note.trim().length < 5) throw new Error('decision_note_required');
  const { error } = await supabase.rpc("moderate_listing", {
    target_listing: listingId,
    new_state: state,
    moderation_note: note.trim() || null,
  });
  if (error) throw error;
}

export async function pendingVideos() {
  const { data, error } = await supabase
    .from("listing_media")
    .select("id,listing_id,storage_path,review_status,created_at")
    .eq("kind", "video")
    .eq("review_status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return rows(data);
}

export async function reviewVideo(
  listingId: string,
  approved: boolean,
  note: string,
) {
  const { error } = await supabase.rpc("review_listing_video_with_note", {
    target_listing: listingId,
    approve_video: approved,
    review_note: note.trim() || null,
  });
  if (error) throw error;
}

export async function safetyReports(state = "open") {
  let query = supabase
    .from("safety_reports")
    .select(
      "id,target_type,target_id,reason_key,details,state,created_at,resolution_note",
    );
  if (state !== "all") query = query.eq("state", state);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return rows(data);
}

export async function resolveSafetyReport(
  reportId: string,
  state: string,
  reason: string,
) {
  const { error } = await supabase.rpc("resolve_safety_report", {
    target_report: reportId,
    new_state: state,
    resolution_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function adminRequests(
  table: "promotion_requests" | "support_requests",
  page=0,
  search='',
) {
  let query = supabase
    .from(table)
    .select();
  const term=search.trim().replace(/[,%()\"\\]/g,' ');
  if(table==='support_requests' && term){
    const filters=[`subject.ilike.%${term}%`,`contact_email.ilike.%${term}%`];
    if(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(term))filters.push(`id.eq.${term}`);
    query=query.or(filters.join(','));
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order('id')
    .range(Math.max(0,page)*ADMIN_PAGE_SIZE,Math.max(0,page)*ADMIN_PAGE_SIZE+ADMIN_PAGE_SIZE);
  if (error) throw error;
  return rows(data);
}

export async function updateRequest(
  table: "promotion_requests" | "support_requests",
  id: string,
  state: string,
  note: string,
) {
  const cleanNote = note.trim();
  if (cleanNote.length < 5) throw new Error("decision_note_required");
  if (table === 'support_requests') {
    const { error } = await supabase.rpc('web_update_support_request', {
      target_request: id,
      next_state: state,
      decision_note: cleanNote,
    });
    if (error) throw error;
    return;
  }
  if (table === "promotion_requests" && state === "approved") {
    const { error } = await supabase.rpc("approve_promotion_request_v2", {
      target_request: id,
      duration_months: null,
      target_manager_email: null,
      target_payment_status: "pending",
      decision_note: cleanNote,
    });
    if (error) throw error;
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(table)
    .update({
      state,
      admin_note: cleanNote,
      handled_by: auth.user?.id ?? null,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function staffAccounts() {
  let result = await supabase.rpc("list_staff_accounts_v2");
  if (result.error?.code === "42883")
    result = await supabase.rpc("list_staff_accounts");
  if (result.error) throw result.error;
  return rows(result.data);
}

export async function staffRoles() {
  const { data, error } = await supabase
    .from("staff_roles")
    .select("id,role_key,names,rank,staff_role_permissions(permission_key)")
    .eq("is_active", true)
    .order("rank");
  if (error) throw error;
  return rows(data);
}

export async function assignStaff(email: string, role: string, note: string) {
  const { error } = await supabase.rpc("assign_scoped_staff_role_by_email", {
    target_email: email.trim().toLowerCase(),
    target_role_key: role,
    assignment_note: note.trim() || null,
  });
  if (error) throw error;
}

export async function assignScopedStaff(email:string,role:string,scope:{marketId?:string|null;locationId?:number|null;categoryId?:string|null;expiresAt?:string|null},note:string){
  const cleanEmail=email.trim().toLowerCase();
  if(!cleanEmail||!role||(!scope.marketId&&!scope.locationId&&!scope.categoryId&&!scope.expiresAt))throw new Error('assignment_scope_required');
  if(scope.locationId!=null&&(!Number.isSafeInteger(scope.locationId)||scope.locationId<1))throw new Error('invalid_assignment_location');
  if(scope.expiresAt&&(!Number.isFinite(Date.parse(scope.expiresAt))||Date.parse(scope.expiresAt)<=Date.now()))throw new Error('invalid_assignment_expiry');
  const matches=(await adminUsers(cleanEmail)).filter(row=>String(row.email??'').toLowerCase()===cleanEmail);
  if(matches.length!==1||!matches[0].id)throw new Error('account_not_found');
  const selectedRole=(await staffRoles()).find(row=>row.role_key===role);
  if(!selectedRole)throw new Error('role_not_found');
  const {data:existing,error:readError}=await supabase.from('staff_assignments').select('market_id,location_node_id,category_id,expires_at,note').eq('user_id',matches[0].id).eq('role_id',selectedRole.id).eq('is_active',true);
  if(readError)throw readError;
  const previous=(existing??[]).find(row=>(row.market_id??null)===(scope.marketId||null)&&(row.location_node_id??null)===(scope.locationId??null)&&(row.category_id??null)===(scope.categoryId||null));
  if(previous){
    const sameExpiry=previous.expires_at?!!scope.expiresAt&&Date.parse(previous.expires_at)===Date.parse(scope.expiresAt):!scope.expiresAt;
    if(sameExpiry&&(previous.note??'').trim()===note.trim())return;
    throw new Error('assignment_already_exists');
  }
  // This creates one additional scoped assignment. It never silently removes
  // or widens existing assignments; the backend checks staff.assign/owner rules.
  const {error}=await supabase.rpc('assign_scoped_staff_role',{target_user:matches[0].id,target_role_key:role,target_market:scope.marketId||null,target_location:scope.locationId??null,target_category:scope.categoryId||null,assignment_expires_at:scope.expiresAt||null,note:note.trim()||null});
  if(error)throw error;
}

export async function removeStaff(assignmentId: string, reason: string) {
  const { error } = await supabase.rpc("remove_staff_assignment", {
    target_assignment: assignmentId,
    removal_note: reason.trim(),
  });
  if (error) throw error;
}

export async function locationProposals() {
  const { data, error } = await supabase.rpc("list_pending_location_proposals");
  if (error) throw error;
  return rows(data);
}

export async function reviewLocation(
  proposalId: string,
  approved: boolean,
  note: string,
) {
  const { error } = await supabase.rpc("review_location_proposal", {
    target_proposal: proposalId,
    approve_proposal: approved,
    review_note: note.trim() || null,
  });
  if (error) throw error;
}

export async function auditLog(search = "") {
  const { data, error } = await supabase.rpc("list_admin_audit_log", {
    search_term: search.trim(),
    page_limit: 300,
  });
  if (error) throw error;
  return rows(data);
}
