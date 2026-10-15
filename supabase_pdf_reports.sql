create table public.gerontik_pdf_reports (
 report_id uuid primary key,
 student_user_id uuid not null references public.gerontik_users(user_id),
 period_id uuid references public.gerontik_practicum_periods(period_id),
 version integer not null check(version>0),
 file_name text not null,
 storage_path text not null unique,
 file_size bigint not null check(file_size>0 and file_size<=15728640),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 snapshot_status text not null check(snapshot_status in ('DRAFT','FINAL')),
 review_status text not null default 'PENDING' check(review_status in ('PENDING','REVISION','APPROVED')),
 feedback text not null default '' check(length(feedback)<=10000),
 reviewed_by uuid references public.gerontik_users(user_id),
 reviewed_at timestamptz,
 review_revision integer not null default 0,
 created_at timestamptz not null default now(),
 unique(student_user_id,version)
);
create index gerontik_pdf_reports_created_idx on public.gerontik_pdf_reports(created_at desc);
create table public.gerontik_pdf_report_reviews (
 review_id bigint generated always as identity primary key,
 report_id uuid not null references public.gerontik_pdf_reports(report_id),
 reviewer_user_id uuid not null references public.gerontik_users(user_id),
 review_status text not null check(review_status in ('REVISION','APPROVED')),
 feedback text not null,
 created_at timestamptz not null default now()
);
create index gerontik_pdf_reviews_report_idx on public.gerontik_pdf_report_reviews(report_id,created_at);
alter table public.gerontik_pdf_reports enable row level security;
alter table public.gerontik_pdf_report_reviews enable row level security;
revoke all on public.gerontik_pdf_reports,public.gerontik_pdf_report_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.gerontik_pdf_reports,public.gerontik_pdf_report_reviews to service_role;
grant usage,select on sequence public.gerontik_pdf_report_reviews_review_id_seq to service_role;
create function public.gerontik_pdf_review_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.report_id<>old.report_id or new.student_user_id<>old.student_user_id or new.version<>old.version or new.storage_path<>old.storage_path or new.sha256<>old.sha256 or new.file_size<>old.file_size or new.file_name<>old.file_name or new.created_at<>old.created_at or new.snapshot_status<>old.snapshot_status or new.period_id is distinct from old.period_id then
  raise exception 'Submitted PDF reports are immutable';
 end if;
 if new.reviewed_by is null or new.review_status not in ('REVISION','APPROVED') or length(trim(new.feedback))=0 then raise exception 'Reviewer and feedback are required';end if;
 new.review_revision:=old.review_revision+1;
 new.reviewed_at:=now();
 insert into public.gerontik_pdf_report_reviews(report_id,reviewer_user_id,review_status,feedback) values(new.report_id,new.reviewed_by,new.review_status,new.feedback);
 return new;
end $$;
revoke all on function public.gerontik_pdf_review_audit() from public,anon,authenticated;
grant execute on function public.gerontik_pdf_review_audit() to service_role;
create trigger gerontik_pdf_review_audit before update on public.gerontik_pdf_reports for each row execute function public.gerontik_pdf_review_audit();
