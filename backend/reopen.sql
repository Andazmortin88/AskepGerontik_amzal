create or replace function public.gerontik_learning_reopen(p_actor uuid,p_roster uuid,p_expected integer,p_operation uuid,p_reason text)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare actor public.gerontik_learning_profiles; student public.gerontik_learning_roster; doc public.gerontik_learning_documents; prior public.gerontik_learning_operations; fp text; result jsonb; saved timestamptz:=clock_timestamp();
begin
 select * into actor from public.gerontik_learning_profiles where auth_user_id=p_actor;
 select * into student from public.gerontik_learning_roster where id=p_roster and active;
 if actor.auth_user_id is null or student.id is null or student.auth_user_id is null or not ('super_admin'=any(actor.roles) or ('lecturer'=any(actor.roles) and exists(select 1 from public.gerontik_learning_assignments where roster_id=p_roster and lecturer_email=actor.email))) then raise exception 'FORBIDDEN';end if;
 if p_operation is null or p_expected is null or p_expected<1 or length(trim(coalesce(p_reason,''))) not between 1 and 3000 then raise exception 'INVALID_REOPEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(student.auth_user_id::text,0));
 fp:=md5(jsonb_build_object('action','reopen','roster',p_roster,'expected',p_expected,'reason',p_reason)::text);
 select * into prior from public.gerontik_learning_operations where owner_id=p_actor and operation_id=p_operation;
 if found then
  if prior.fingerprint<>fp then return jsonb_build_object('status','idempotency_conflict');end if;
  return prior.result;
 end if;
 select * into doc from public.gerontik_learning_documents where owner_id=student.auth_user_id and period=student.period for update;
 if doc.owner_id is null or doc.revision<>p_expected then return jsonb_build_object('status','conflict','revision',coalesce(doc.revision,0));end if;
 if doc.status<>'FINAL' then return jsonb_build_object('status','conflict','revision',doc.revision,'message','Dokumen tidak sedang FINAL.');end if;
 update public.gerontik_learning_documents set status='DRAFT',revision=doc.revision+1,updated_at=saved where owner_id=doc.owner_id and period=doc.period;
 insert into public.gerontik_learning_document_versions(owner_id,period,revision,state,status,created_at) values(doc.owner_id,doc.period,doc.revision+1,doc.state,'DRAFT',saved);
 result:=jsonb_build_object('status','success','revision',doc.revision+1,'documentStatus','DRAFT','updated_at',saved,'reopenedBy',p_actor,'reason',p_reason);
 insert into public.gerontik_learning_operations(owner_id,operation_id,period,fingerprint,result) values(p_actor,p_operation,doc.period,fp,result);
 return result;
end $$;
revoke all on function public.gerontik_learning_reopen(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.gerontik_learning_reopen(uuid,uuid,integer,uuid,text) to service_role;
