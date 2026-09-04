begin;

create or replace function public.notify_pending_listing_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind::text = 'video'
     and new.review_status::text = 'pending' then

    -- إشعار صاحب الإعلان.
    insert into public.notifications(
      user_id,
      type,
      title,
      body
    )
    values (
      new.owner_id,
      'listing_video_review',
      'listingVideoPending',
      'listingVideoPendingBody'
    );

    -- إشعار مالك المنصة وكل موظف فعّال يملك صلاحية مراجعة الوسائط.
    insert into public.notifications(
      user_id,
      type,
      title,
      body
    )
    select distinct
      recipient.user_id,
      'admin_video_review',
      'adminVideoReviewPending',
      'adminVideoReviewPendingBody'
    from (
      select owner.user_id
      from public.platform_owners as owner

      union

      select assignment.user_id
      from public.staff_assignments as assignment
      join public.staff_roles as role
        on role.id = assignment.role_id
      join public.staff_role_permissions as permission
        on permission.role_id = role.id
      where assignment.is_active
        and role.is_active
        and assignment.starts_at <= now()
        and (
          assignment.expires_at is null
          or assignment.expires_at > now()
        )
        and permission.permission_key = 'media.review'

      union

      select profile.id
      from public.profiles as profile
      left join public.staff_permissions as legacy
        on legacy.user_id = profile.id
      where profile.role::text in ('admin', 'moderator')
        and coalesce(profile.is_suspended, false) = false
        and coalesce(legacy.is_suspended, false) = false
        and (
          profile.role::text = 'admin'
          or coalesce(legacy.can_review_media, false)
        )
    ) as recipient
    where recipient.user_id is not null
      and recipient.user_id <> new.owner_id;

  end if;

  return new;
end;
$$;

commit;
