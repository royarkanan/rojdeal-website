-- Resolve the review_note parameter/column ambiguity in the location review RPC.
create or replace function public.review_location_proposal(
  target_proposal uuid,
  approve_proposal boolean,
  review_note text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.location_proposals%rowtype;
  approved_id bigint;
  new_slug text;
  resolved_city bigint;
  attribute_key text;
  normalized_review_note text;
begin
  normalized_review_note := nullif(trim(review_note), '');

  if not public.can_staff('locations') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select *
  into proposal
  from public.location_proposals
  where id = target_proposal and state = 'pending'
  for update;

  if not found then
    raise exception 'proposal_not_found_or_reviewed';
  end if;

  if approve_proposal then
    new_slug := left(
      coalesce(public.normalize_city_name(proposal.proposed_name), 'place'),
      48
    ) || '-' || left(replace(proposal.id::text, '-', ''), 8);

    resolved_city := public.resolve_listing_city(
      proposal.parent_id,
      proposal.latitude,
      proposal.longitude
    );

    insert into public.location_nodes(
      parent_id,
      kind,
      slug,
      names,
      latitude,
      longitude,
      city_id,
      is_active,
      sort_order
    ) values (
      proposal.parent_id,
      proposal.kind,
      new_slug,
      jsonb_build_object(
        'ar', proposal.proposed_name,
        'ku', proposal.proposed_name,
        'en', proposal.proposed_name,
        'de', proposal.proposed_name
      ),
      proposal.latitude,
      proposal.longitude,
      resolved_city,
      true,
      1000
    ) returning id into approved_id;

    update public.location_proposals as location_proposal
    set
      state = 'approved',
      approved_node_id = approved_id,
      review_note = normalized_review_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where location_proposal.id = target_proposal;

    attribute_key := case
      when proposal.kind = 'village' then 'village'
      else 'district'
    end;

    update public.listings as listing
    set
      location_node_id = approved_id,
      attributes =
        (listing.attributes - 'pendingLocationName' - 'pendingLocationKind')
        || jsonb_build_object(attribute_key, proposal.proposed_name)
    where listing.location_proposal_id = target_proposal;
  else
    update public.location_proposals as location_proposal
    set
      state = 'rejected',
      review_note = normalized_review_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where location_proposal.id = target_proposal;

    update public.listings as listing
    set
      attributes =
        listing.attributes - 'pendingLocationName' - 'pendingLocationKind',
      area_label = coalesce(
        (
          select coalesce(node.names->>'ar', node.names->>'en', node.slug)
          from public.location_nodes as node
          where node.id = proposal.parent_id
        ),
        listing.area_label
      )
    where listing.location_proposal_id = target_proposal;
  end if;

  insert into public.admin_audit_log(
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) values (
    auth.uid(),
    case
      when approve_proposal then 'location_approved'
      else 'location_rejected'
    end,
    'location_proposal',
    target_proposal::text,
    jsonb_build_object(
      'approved_node_id', approved_id,
      'note', normalized_review_note
    )
  );

  return approved_id;
end;
$$;
revoke all on function public.review_location_proposal(uuid, boolean, text)
  from public;
grant execute on function public.review_location_proposal(uuid, boolean, text)
  to authenticated;
