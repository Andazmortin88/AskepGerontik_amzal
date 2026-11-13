-- REVIEW ONLY. Not applied to production. Install before the draft API.
begin;
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


commit;
