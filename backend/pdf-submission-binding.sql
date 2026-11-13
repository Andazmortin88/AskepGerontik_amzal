-- REVIEW ONLY. Historical PDF rows remain unbound and labeled legacy.
begin;
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
