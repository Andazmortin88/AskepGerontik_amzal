-- REVIEW ONLY. Run after weekly-migration.sql. No dates are seeded.
begin;
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
commit;
