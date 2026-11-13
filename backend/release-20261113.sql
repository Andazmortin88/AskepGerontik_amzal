-- Applied as learning_weekly_deadlines_pdf_and_reminder_foundation, 2026-11-13.
-- The REVIEW ONLY comments below are preserved source history.
begin;
-- weekly-migration.sql
-- REVIEW ONLY. Not applied to production. Install before the draft API.

create table public.gerontik_weekly_submissions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,
 period text not null,week smallint not null check(week in (1,2)),
 attempt integer not null check(attempt>0),document_revision integer not null,
 status text not null default 'submitted' check(status in ('submitted','revision_requested','approved')),
 snapshot jsonb not null,progress jsonb not null,review_revision integer not null default 0,
 operation_id uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_id,operation_id),unique(owner_id,period,week,attempt)
);
create index on public.gerontik_weekly_submissions(owner_id,period,week,attempt desc);
create table public.gerontik_weekly_reviews (
 id uuid primary key default gen_random_uuid(),submission_id uuid not null references public.gerontik_weekly_submissions(id),
 actor_id uuid not null,operation_id uuid not null,expected_revision integer not null,
 decision text not null check(decision in ('revision_requested','approved')),comment text not null check(length(trim(comment)) between 1 and 3000),
 created_at timestamptz not null default now(),unique(actor_id,operation_id)
);
create table public.gerontik_weekly_reminders (
 id uuid primary key default gen_random_uuid(),roster_id uuid not null references public.gerontik_learning_roster(id),
 actor_id uuid not null,operation_id uuid not null,week smallint not null check(week in (1,2)),
 message text not null check(length(trim(message)) between 1 and 1000),read_at timestamptz,
 created_at timestamptz not null default now(),unique(actor_id,operation_id)
);
alter table public.gerontik_weekly_submissions enable row level security;
alter table public.gerontik_weekly_reviews enable row level security;
alter table public.gerontik_weekly_reminders enable row level security;
revoke all on public.gerontik_weekly_submissions,public.gerontik_weekly_reviews,public.gerontik_weekly_reminders from public,anon,authenticated;
grant all on public.gerontik_weekly_submissions,public.gerontik_weekly_reviews,public.gerontik_weekly_reminders to service_role;

create function public.gerontik_week_payload(p_state jsonb,p_week integer) returns jsonb
language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('clinical',jsonb_build_object(
 'demografi',coalesce(p_state->'clinicalState'->'demografi'->p_week::text,'{}'::jsonb),
 'instrumen',coalesce(p_state->'clinicalState'->'instrumen'->p_week::text,'{}'::jsonb),
 'instrumenRaw',coalesce(p_state->'clinicalState'->'instrumenRaw'->p_week::text,'{}'::jsonb),
 'h2t',coalesce(p_state->'clinicalState'->'h2t'->p_week::text,'{}'::jsonb),
 'asuhan',coalesce(p_state->'clinicalState'->'asuhan'->p_week::text,'{}'::jsonb)),
 'skin',coalesce((select jsonb_agg(x order by x->>'id') from jsonb_array_elements(coalesce(p_state->'skin','[]'::jsonb)) x where x->>'week'=p_week::text),'[]'::jsonb));
$$;

create function public.gerontik_submit_week(p_owner uuid,p_period text,p_week integer,p_expected integer,p_operation uuid,p_progress jsonb) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare doc public.gerontik_learning_documents; prior public.gerontik_weekly_submissions; last_submission public.gerontik_weekly_submissions; saved public.gerontik_weekly_submissions;
begin
 if p_week not in (1,2) or p_operation is null or p_expected is null or p_progress->>'complete' is distinct from 'true' then raise exception 'INVALID_SUBMISSION';end if;
 if not exists(select 1 from public.gerontik_learning_roster where auth_user_id=p_owner and period=p_period and active) then raise exception 'NOT_ENROLLED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into prior from public.gerontik_weekly_submissions where owner_id=p_owner and operation_id=p_operation;
 if found then
  if prior.period<>p_period or prior.week<>p_week or prior.document_revision<>p_expected then return jsonb_build_object('status','idempotency_conflict');end if;
  return jsonb_build_object('status','success','submissionId',prior.id);
 end if;
 select * into doc from public.gerontik_learning_documents where owner_id=p_owner and period=p_period for update;
 if doc.revision is distinct from p_expected then return jsonb_build_object('status','conflict');end if;
 if doc.status='FINAL' then return jsonb_build_object('status','locked');end if;
 select * into last_submission from public.gerontik_weekly_submissions where owner_id=p_owner and period=p_period and week=p_week order by attempt desc limit 1;
 if last_submission.status in ('submitted','approved') then return jsonb_build_object('status','locked');end if;
 insert into public.gerontik_weekly_submissions(owner_id,period,week,attempt,document_revision,snapshot,progress,operation_id)
 values(p_owner,p_period,p_week,coalesce(last_submission.attempt,0)+1,doc.revision,doc.state,p_progress,p_operation) returning * into saved;
 return jsonb_build_object('status','success','submissionId',saved.id);
end $$;

create function public.gerontik_review_week(p_actor uuid,p_submission uuid,p_expected integer,p_operation uuid,p_decision text,p_comment text) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare s public.gerontik_weekly_submissions; prior public.gerontik_weekly_reviews;
begin
 if p_decision not in ('revision_requested','approved') or length(trim(p_comment)) not between 1 and 3000 or p_operation is null then raise exception 'INVALID_REVIEW';end if;
 select * into s from public.gerontik_weekly_submissions where id=p_submission;
 if not found then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from public.gerontik_learning_profiles p where p.auth_user_id=p_actor and (
 'super_admin'=any(p.roles) or ('lecturer'=any(p.roles) and exists(select 1 from public.gerontik_learning_assignments a join public.gerontik_learning_roster r on r.id=a.roster_id where a.lecturer_email=p.email and r.auth_user_id=s.owner_id and r.period=s.period and r.active)))) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(s.owner_id::text,0));
 select * into prior from public.gerontik_weekly_reviews where actor_id=p_actor and operation_id=p_operation;
 if found then
  if prior.submission_id<>p_submission or prior.expected_revision<>p_expected or prior.decision<>p_decision or prior.comment<>trim(p_comment) then return jsonb_build_object('status','idempotency_conflict');end if;
  return jsonb_build_object('status','success');
 end if;
 select * into s from public.gerontik_weekly_submissions where id=p_submission for update;
 if s.review_revision<>p_expected or s.status<>'submitted' then return jsonb_build_object('status','conflict');end if;
 insert into public.gerontik_weekly_reviews(submission_id,actor_id,operation_id,expected_revision,decision,comment) values(s.id,p_actor,p_operation,p_expected,p_decision,trim(p_comment));
 update public.gerontik_weekly_submissions set status=p_decision,review_revision=review_revision+1,updated_at=now() where id=s.id;
 return jsonb_build_object('status','success');
end $$;
revoke all on function public.gerontik_week_payload(jsonb,integer),public.gerontik_submit_week(uuid,text,integer,integer,uuid,jsonb),public.gerontik_review_week(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.gerontik_week_payload(jsonb,integer),public.gerontik_submit_week(uuid,text,integer,integer,uuid,jsonb),public.gerontik_review_week(uuid,uuid,integer,uuid,text,text) to service_role;


-- REVIEW ONLY. Apply after weekly-review.sql in the same release transaction.
CREATE OR REPLACE FUNCTION public.gerontik_learning_save(p_owner uuid, p_period text, p_state jsonb, p_expected integer, p_operation uuid, p_final boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare current_doc public.gerontik_learning_documents; prior public.gerontik_learning_operations; fp text; result jsonb; next_revision integer; locked_week integer; saved_at timestamptz:=clock_timestamp();
begin
 if p_state is null or jsonb_typeof(p_state) is distinct from 'object' or octet_length(p_state::text)>3000000 or p_expected is null or p_expected<0 or p_operation is null then raise exception 'INVALID_DOCUMENT'; end if;
 if not exists(select 1 from public.gerontik_learning_roster where auth_user_id=p_owner and period=p_period and active) then raise exception 'NOT_ENROLLED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 fp:=md5(jsonb_build_object('period',p_period,'state',p_state,'expected',p_expected,'final',p_final)::text);
 select * into prior from public.gerontik_learning_operations where owner_id=p_owner and operation_id=p_operation;
 if found then
  if prior.fingerprint<>fp then return jsonb_build_object('status','idempotency_conflict'); end if;
  return prior.result;
 end if;
 select * into current_doc from public.gerontik_learning_documents where owner_id=p_owner and period=p_period for update;
 if coalesce(current_doc.revision,0)<>p_expected then return jsonb_build_object('status','conflict','revision',coalesce(current_doc.revision,0)); end if;
 if current_doc.status='FINAL' then return jsonb_build_object('status','locked','revision',current_doc.revision); end if;
 for locked_week in select distinct on (week) week from public.gerontik_weekly_submissions s
 where s.owner_id=p_owner and s.period=p_period
 and s.attempt=(select max(s2.attempt) from public.gerontik_weekly_submissions s2 where s2.owner_id=s.owner_id and s2.period=s.period and s2.week=s.week)
 and s.status in ('submitted','approved')
 loop
  if public.gerontik_week_payload(current_doc.state,locked_week) is distinct from public.gerontik_week_payload(p_state,locked_week) then return jsonb_build_object('status','locked','revision',current_doc.revision,'week',locked_week);end if;
 end loop;
 next_revision:=coalesce(current_doc.revision,0)+1;
 insert into public.gerontik_learning_documents(owner_id,period,state,revision,status,updated_at)
 values(p_owner,p_period,p_state,next_revision,case when p_final then 'FINAL' else 'DRAFT' end,saved_at)
 on conflict(owner_id,period) do update set state=excluded.state,revision=excluded.revision,status=excluded.status,updated_at=excluded.updated_at;
 insert into public.gerontik_learning_document_versions(owner_id,period,revision,state,status,created_at)
 values(p_owner,p_period,next_revision,p_state,case when p_final then 'FINAL' else 'DRAFT' end,saved_at);
 result:=jsonb_build_object('status','success','revision',next_revision,'documentStatus',case when p_final then 'FINAL' else 'DRAFT' end,'updated_at',saved_at,'operationId',p_operation);
 insert into public.gerontik_learning_operations(owner_id,operation_id,period,fingerprint,result) values(p_owner,p_operation,p_period,fp,result);
 -- Current state always persists; bounded full snapshots retain the latest 20,
 -- first revision of each UTC day, FINAL and all review-referenced snapshots.
 delete from public.gerontik_learning_document_versions v where v.owner_id=p_owner and v.period=p_period
 and v.revision<=next_revision-20 and v.revision>1 and v.status<>'FINAL'
 and v.revision not in (select min(k.revision) from public.gerontik_learning_document_versions k where k.owner_id=p_owner and k.period=p_period group by (k.created_at at time zone 'UTC')::date)
 and not exists(select 1 from public.gerontik_learning_reviews rv join public.gerontik_learning_roster rr on rr.id=rv.roster_id where rr.auth_user_id=p_owner and rr.period=p_period and rv.document_revision=v.revision);
 delete from public.gerontik_learning_operations where owner_id=p_owner and created_at<now()-interval '7 days';
 return result;
end $function$
;
revoke all on function public.gerontik_learning_save(uuid,text,jsonb,integer,uuid,boolean) from public,anon,authenticated;
grant execute on function public.gerontik_learning_save(uuid,text,jsonb,integer,uuid,boolean) to service_role;

-- reminder-delivery.sql
-- REVIEW/STAGING ONLY. Run after weekly-migration.sql. No production execution yet.

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

-- friday-deadlines.sql
-- REVIEW ONLY. Run after weekly-migration.sql. No dates are seeded.

create table public.gerontik_roster_schedules (
 roster_id uuid primary key references public.gerontik_learning_roster(id),
 start_date date not null check(extract(isodow from start_date)=1),
 enabled boolean not null default true,inactive_days integer not null default 3 check(inactive_days between 1 and 10),
 revision integer not null default 1,updated_by uuid not null,updated_at timestamptz not null default now()
);
alter table public.gerontik_roster_schedules enable row level security;
revoke all on public.gerontik_roster_schedules from public,anon,authenticated;
grant all on public.gerontik_roster_schedules to service_role;
alter table public.gerontik_weekly_submissions add column due_at timestamptz,add column is_late boolean,add column schedule_revision integer;

create function public.gerontik_friday_due(p_start date,p_week integer) returns timestamptz
language sql immutable set search_path=pg_catalog,public as $$
 select case when p_week in(1,2) then ((p_start+(case when p_week=1 then 4 else 11 end))+time '23:59:59.999') at time zone 'Asia/Jakarta' else null end;
$$;

create function public.gerontik_set_practice_schedule(p_actor uuid,p_targets jsonb,p_start date,p_enabled boolean,p_inactive integer) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare actor public.gerontik_learning_profiles;r public.gerontik_learning_roster;item record;current_revision integer;
begin
 if p_start is null or extract(isodow from p_start)<>1 or p_enabled is null or p_inactive not between 1 and 10 or p_targets is null or jsonb_typeof(p_targets)<>'array' or jsonb_array_length(p_targets) not between 1 and 1000 then raise exception 'INVALID_SCHEDULE';end if;
 select * into actor from public.gerontik_learning_profiles where auth_user_id=p_actor;
 if actor.auth_user_id is null or not('super_admin'=any(actor.roles) or 'lecturer'=any(actor.roles)) then raise exception 'FORBIDDEN';end if;
 -- Lock and validate every target before changing any schedule.
 for item in select * from jsonb_to_recordset(p_targets) as x(roster_id uuid,expected_revision integer) order by roster_id loop
  select * into r from public.gerontik_learning_roster where id=item.roster_id and active;
  if r.id is null or not('super_admin'=any(actor.roles) or exists(select 1 from public.gerontik_learning_assignments where roster_id=r.id and lecturer_email=actor.email)) then raise exception 'FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(r.auth_user_id,r.id)::text,0));
  select revision into current_revision from public.gerontik_roster_schedules where roster_id=r.id for update;
  if coalesce(current_revision,0) is distinct from item.expected_revision then return jsonb_build_object('status','conflict');end if;
 end loop;
 insert into public.gerontik_roster_schedules(roster_id,start_date,enabled,inactive_days,updated_by)
 select x.roster_id,p_start,p_enabled,p_inactive,p_actor from jsonb_to_recordset(p_targets) as x(roster_id uuid,expected_revision integer)
 on conflict(roster_id) do update set start_date=excluded.start_date,enabled=excluded.enabled,inactive_days=excluded.inactive_days,revision=gerontik_roster_schedules.revision+1,updated_by=p_actor,updated_at=now();
 return jsonb_build_object('status','success');
end $$;
revoke all on function public.gerontik_friday_due(date,integer),public.gerontik_set_practice_schedule(uuid,jsonb,date,boolean,integer) from public,anon,authenticated;
grant execute on function public.gerontik_friday_due(date,integer),public.gerontik_set_practice_schedule(uuid,jsonb,date,boolean,integer) to service_role;
-- Replacement submit function freezes the deadline using the server clock.

create or replace function public.gerontik_submit_week(p_owner uuid,p_period text,p_week integer,p_expected integer,p_operation uuid,p_progress jsonb) returns jsonb
language plpgsql set search_path=pg_catalog,public as $$
declare doc public.gerontik_learning_documents; prior public.gerontik_weekly_submissions; last_submission public.gerontik_weekly_submissions; saved public.gerontik_weekly_submissions; schedule public.gerontik_roster_schedules; deadline timestamptz; received timestamptz;
begin
 if p_week not in (1,2) or p_operation is null or p_expected is null or p_progress->>'complete' is distinct from 'true' then raise exception 'INVALID_SUBMISSION';end if;
 if not exists(select 1 from public.gerontik_learning_roster where auth_user_id=p_owner and period=p_period and active) then raise exception 'NOT_ENROLLED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select * into prior from public.gerontik_weekly_submissions where owner_id=p_owner and operation_id=p_operation;
 if found then
  if prior.period<>p_period or prior.week<>p_week or prior.document_revision<>p_expected then return jsonb_build_object('status','idempotency_conflict');end if;
  return jsonb_build_object('status','success','submissionId',prior.id);
 end if;
 select * into doc from public.gerontik_learning_documents where owner_id=p_owner and period=p_period for update;
 if doc.revision is distinct from p_expected then return jsonb_build_object('status','conflict');end if;
 if doc.status='FINAL' then return jsonb_build_object('status','locked');end if;
 select * into last_submission from public.gerontik_weekly_submissions where owner_id=p_owner and period=p_period and week=p_week order by attempt desc limit 1;
 if last_submission.status in ('submitted','approved') then return jsonb_build_object('status','locked');end if;
 select s.* into schedule from public.gerontik_roster_schedules s join public.gerontik_learning_roster r on r.id=s.roster_id where r.auth_user_id=p_owner and r.period=p_period and r.active order by s.updated_at desc limit 1;
 deadline:=case when schedule.enabled then public.gerontik_friday_due(schedule.start_date,p_week) else null end;
 received:=clock_timestamp();
 insert into public.gerontik_weekly_submissions(owner_id,period,week,attempt,document_revision,snapshot,progress,operation_id,created_at,due_at,is_late,schedule_revision)
 values(p_owner,p_period,p_week,coalesce(last_submission.attempt,0)+1,doc.revision,doc.state,p_progress,p_operation,received,deadline,case when deadline is not null then received>deadline else null end,schedule.revision) returning * into saved;
 return jsonb_build_object('status','success','submissionId',saved.id,'isLate',saved.is_late,'dueAt',saved.due_at);
end $$;

revoke all on function public.gerontik_submit_week(uuid,text,integer,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gerontik_submit_week(uuid,text,integer,integer,uuid,jsonb) to service_role;

-- pdf-submission-binding.sql
-- REVIEW ONLY. Historical PDF rows remain unbound and labeled legacy.

alter table public.gerontik_learning_pdf add column submission_id uuid references public.gerontik_weekly_submissions(id);
create index on public.gerontik_learning_pdf(submission_id);
create function public.gerontik_check_pdf_submission() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.submission_id is not null and not exists(select 1 from public.gerontik_weekly_submissions s where s.id=new.submission_id and s.owner_id=new.owner_id and s.period=new.period and s.document_revision=new.document_revision) then raise exception 'PDF_SUBMISSION_MISMATCH';end if;
 if tg_op='UPDATE' and (old.submission_id is distinct from new.submission_id or old.document_revision is distinct from new.document_revision or old.owner_id is distinct from new.owner_id or old.period is distinct from new.period) then raise exception 'PDF_BINDING_IMMUTABLE';end if;
 return new;
end $$;
create trigger gerontik_pdf_submission_guard before insert or update on public.gerontik_learning_pdf for each row execute function public.gerontik_check_pdf_submission();
revoke all on function public.gerontik_check_pdf_submission() from public,anon,authenticated;
grant execute on function public.gerontik_check_pdf_submission() to service_role;

commit;