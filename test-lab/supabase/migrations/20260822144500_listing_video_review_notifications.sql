begin;

alter table public.listing_media
add column if not exists review_note text;

create or replace function public.review_listing_video_with_note(
  target_listing uuid,
  approve_video boolean,
  review_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_media uuid;
  target_owner uuid;
  normalized_note text := nullif(trim(coalesce(review_note, '')), '');
begin
  if not public.can_staff('media') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  update public.listing_media
  set review_status = (
        case when approve_video then 'approved' else 'rejected' end
      )::public.review_state,
      review_note = case
        when approve_video then null
        else normalized_note
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where listing_id = target_listing
    and kind::text = 'video'
  returning id, owner_id
  into target_media, target_owner;

  if target_media is null then
    raise exception 'video_not_found';
  end if;

  insert into public.moderation_log(
    moderator_id,
    listing_id,
    media_id,
    action,
    note
  )
  values (
    auth.uid(),
    target_listing,
    target_media,
    case
      when approve_video then 'approve_video'
      else 'reject_video'
    end,
    normalized_note
  );

  insert into public.notifications(
    user_id,
    type,
    title,
    body
  )
  values (
    target_owner,
    'listing_video_review',
    case
      when approve_video then 'listingVideoApproved'
      else 'listingVideoRejected'
    end,
    case
      when approve_video then 'listingVideoApprovedBody'
      when normalized_note is not null then normalized_note
      else 'listingVideoRejectedBody'
    end
  );
end;
$$;

revoke all on function public.review_listing_video_with_note(
  uuid, boolean, text
) from public;

grant execute on function public.review_listing_video_with_note(
  uuid, boolean, text
) to authenticated;

-- توافق النسخ القديمة: تستمر الدالة القديمة بالعمل وتُنشئ الإشعار أيضاً.
create or replace function public.review_listing_video(
  target_listing uuid,
  approve_video boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.review_listing_video_with_note(
    target_listing,
    approve_video,
    null
  );
end;
$$;

revoke all on function public.review_listing_video(
  uuid, boolean
) from public;

grant execute on function public.review_listing_video(
  uuid, boolean
) to authenticated;

create or replace function public.notify_pending_listing_video()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind::text = 'video'
     and new.review_status::text = 'pending' then
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
  end if;

  return new;
end;
$$;

drop trigger if exists listing_video_pending_notification
on public.listing_media;

create trigger listing_video_pending_notification
after insert on public.listing_media
for each row
execute function public.notify_pending_listing_video();

commit;
