-- REVIEW/STAGING ONLY. Run after weekly-migration.sql. No production execution yet.
begin;
alter table public.gerontik_weekly_reminders add column channels text[] not null default '{}';
create table public.gerontik_notification_contacts (
 owner_id uuid primary key,email_enabled boolean not null default true,
 whatsapp_phone text not null default '',whatsapp_opt_in boolean not null default false,
 consent_at timestamptz,updated_at timestamptz not null default now(),
 check(whatsapp_phone='' or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
 check(not whatsapp_opt_in or (whatsapp_phone<>'' and consent_at is not null))
);
create table public.gerontik_reminder_outbox (
 id uuid primary key default gen_random_uuid(),reminder_id uuid not null references public.gerontik_weekly_reminders(id),
 owner_id uuid,channel text not null check(channel in ('email','whatsapp')),
 recipient text not null default '',student_name text not null,week integer not null check(week in (1,2)),message text not null,
 status text not null check(status in ('queued','processing','retry','accepted','blocked','failed','unknown')),
 attempts integer not null default 0,provider_id text,error_code text,
 lease_token uuid,lease_until timestamptz,first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(reminder_id,channel)
);
create index on public.gerontik_reminder_outbox(status,next_attempt_at);
alter table public.gerontik_notification_contacts enable row level security;
alter table public.gerontik_reminder_outbox enable row level security;
revoke all on public.gerontik_notification_contacts,public.gerontik_reminder_outbox from public,anon,authenticated;
grant all on public.gerontik_notification_contacts,public.gerontik_reminder_outbox to service_role;

create function public.gerontik_queue_reminder(p_actor uuid,p_roster uuid,p_week integer,p_message text,p_channels text[],p_operation uuid) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare actor public.gerontik_learning_profiles;r public.gerontik_learning_roster;prior public.gerontik_weekly_reminders;
 contact public.gerontik_notification_contacts;rid uuid;channel text;channels text[];dest text;reason text;
begin
 select * into actor from public.gerontik_learning_profiles where auth_user_id=p_actor;
 select * into r from public.gerontik_learning_roster where id=p_roster and active;
 if actor.auth_user_id is null or r.id is null or not('super_admin'=any(actor.roles) or ('lecturer'=any(actor.roles) and exists(select 1 from public.gerontik_learning_assignments where roster_id=r.id and lecturer_email=actor.email))) then raise exception 'FORBIDDEN';end if;
 if p_week is null or p_week not in(1,2) or p_operation is null or length(trim(coalesce(p_message,''))) not between 1 and 1000 or p_channels is null or not(p_channels <@ array['email','whatsapp']::text[]) then raise exception 'INVALID_REMINDER';end if;
 select coalesce(array_agg(distinct x order by x),'{}'::text[]) into channels from unnest(p_channels) x;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,7));
 select * into prior from public.gerontik_weekly_reminders where actor_id=p_actor and operation_id=p_operation;
 if found then
  if prior.roster_id<>r.id or prior.week<>p_week or prior.message<>trim(p_message) or prior.channels<>channels then return jsonb_build_object('status','idempotency_conflict');end if;
  return jsonb_build_object('status','success','reminderId',prior.id);
 end if;
 if exists(select 1 from public.gerontik_weekly_reminders where roster_id=r.id and actor_id=p_actor and created_at>now()-interval '60 seconds') then return jsonb_build_object('status','rate_limited');end if;
 insert into public.gerontik_weekly_reminders(roster_id,actor_id,operation_id,week,message,channels) values(r.id,p_actor,p_operation,p_week,trim(p_message),channels) returning id into rid;
 select * into contact from public.gerontik_notification_contacts where owner_id=r.auth_user_id;
 foreach channel in array channels loop
  reason:=null;dest:='';
  if channel='email' then
   dest:=coalesce((select p.email from public.gerontik_learning_profiles p where p.auth_user_id=r.auth_user_id),r.email,'');
   if coalesce(contact.email_enabled,true)=false then reason:='EMAIL_DISABLED_BY_STUDENT';elsif dest='' then reason:='EMAIL_MISSING';end if;
  else
   dest:=coalesce(contact.whatsapp_phone,'');
   if coalesce(contact.whatsapp_opt_in,false)=false then reason:='WHATSAPP_OPT_IN_MISSING';elsif dest='' then reason:='WHATSAPP_CONTACT_MISSING';end if;
  end if;
  insert into public.gerontik_reminder_outbox(reminder_id,owner_id,channel,recipient,student_name,week,message,status,error_code)
  values(rid,r.auth_user_id,channel,dest,r.name,p_week,trim(p_message),case when reason is null then 'queued' else 'blocked' end,reason);
 end loop;
 return jsonb_build_object('status','success','reminderId',rid);
end $$;

create function public.gerontik_claim_reminders(p_lease uuid) returns setof public.gerontik_reminder_outbox
language plpgsql set search_path=pg_catalog,public as $$
begin
 if p_lease is null then raise exception 'INVALID_LEASE';end if;
 -- WhatsApp has no application idempotency key: ambiguous sends require review.
 update public.gerontik_reminder_outbox set status=case when channel='email' and first_attempt_at>now()-interval '23 hours' then 'retry' else 'unknown' end,error_code='WORKER_LEASE_EXPIRED',updated_at=now() where status='processing' and lease_until<now();
 return query with jobs as(select id from public.gerontik_reminder_outbox where status in('queued','retry') and attempts<6 and next_attempt_at<=now() order by created_at for update skip locked limit 5)
 update public.gerontik_reminder_outbox o set status='processing',attempts=o.attempts+1,lease_token=p_lease,lease_until=now()+interval '3 minutes',first_attempt_at=coalesce(o.first_attempt_at,now()),updated_at=now() from jobs where o.id=jobs.id returning o.*;
end $$;

create function public.gerontik_finish_reminder(p_id uuid,p_lease uuid,p_status text,p_provider text,p_code text) returns boolean
language plpgsql set search_path=pg_catalog,public as $$
declare affected integer;
begin
 if p_status not in('retry','accepted','blocked','failed','unknown') then raise exception 'INVALID_DELIVERY_STATUS';end if;
 update public.gerontik_reminder_outbox set status=case when p_status='retry' and attempts>=6 then 'failed' else p_status end,provider_id=p_provider,error_code=p_code,lease_token=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,power(2,attempts)::integer*30)),updated_at=now() where id=p_id and lease_token=p_lease and status='processing';
 get diagnostics affected=row_count;return affected=1;
end $$;
revoke all on function public.gerontik_queue_reminder(uuid,uuid,integer,text,text[],uuid),public.gerontik_claim_reminders(uuid),public.gerontik_finish_reminder(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.gerontik_queue_reminder(uuid,uuid,integer,text,text[],uuid),public.gerontik_claim_reminders(uuid),public.gerontik_finish_reminder(uuid,uuid,text,text,text) to service_role;
commit;
