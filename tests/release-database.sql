-- Integration checks: all fixtures are rolled back inside the exception block.
do $validation$
declare a uuid;b uuid;teacher uuid;r1 uuid:=gen_random_uuid();r2 uuid:=gen_random_uuid();op uuid:=gen_random_uuid();sub1 uuid;sub2 uuid;foreign_sub uuid;pdf_id uuid:=gen_random_uuid();qid uuid;lease uuid:=gen_random_uuid();result jsonb;state_a jsonb:=__STATE__;state_b jsonb;period_name text:='release_validation_20261113';past date:=date_trunc('week',now() at time zone 'Asia/Jakarta')::date-7;future date:=date_trunc('week',now() at time zone 'Asia/Jakarta')::date+7;checks jsonb:='[]';rolled_back boolean:=false;n integer;
begin
 select auth_user_id into a from public.gerontik_learning_profiles where email='lppmbanisaleh@gmail.com';
 select auth_user_id into b from public.gerontik_learning_profiles where email='raffasyaariza@gmail.com';
 select auth_user_id into teacher from public.gerontik_learning_profiles where email='andazmortin@gmail.com';
 if a is null or b is null or teacher is null then raise exception 'VALIDATION_ACCOUNTS_MISSING';end if;
 begin
  -- Downgrade the consenting administrator within this uncommitted test only,
  -- so lecturer assignment checks are exercised rather than bypassed by admin.
  update public.gerontik_learning_profiles set roles=array['lecturer'] where auth_user_id=teacher;
  insert into public.gerontik_learning_roster(id,period,name,nim,auth_user_id,group_name) values(r1,period_name,'SIMULASI A','SIM-A',a,'VALIDATION'),(r2,period_name,'SIMULASI B','SIM-B',b,'VALIDATION');
  insert into public.gerontik_learning_assignments(roster_id,lecturer_email,assigned_by) values(r1,'andazmortin@gmail.com',teacher);
  state_a:=jsonb_set(state_a,'{syntheticOwner}','"A"');state_b:=jsonb_set(state_a,'{syntheticOwner}','"B"');
  result:=public.gerontik_learning_save(a,period_name,state_a,0,op,false);assert result->>'status'='success' and (result->>'revision')::int=1,'INITIAL_SAVE_FAILED';
  result:=public.gerontik_learning_save(a,period_name,state_a,0,op,false);assert result->>'status'='success' and (result->>'revision')::int=1,'SAVE_REPLAY_FAILED';
  result:=public.gerontik_learning_save(a,period_name,state_b,0,gen_random_uuid(),false);assert result->>'status'='conflict','STALE_SAVE_ACCEPTED';
  result:=public.gerontik_learning_save(b,period_name,state_b,0,gen_random_uuid(),false);assert result->>'status'='success','SECOND_OWNER_SAVE_FAILED';
  assert (public.gerontik_learning_load(a,period_name)->'document'->'state'->>'syntheticOwner')='A','OWNER_A_ISOLATION';
  assert (public.gerontik_learning_load(b,period_name)->'document'->'state'->>'syntheticOwner')='B','OWNER_B_ISOLATION';
  checks:=checks||'"save CAS, replay and owner isolation"'::jsonb;
  begin
   perform public.gerontik_set_practice_schedule(teacher,jsonb_build_array(jsonb_build_object('roster_id',r1,'expected_revision',0),jsonb_build_object('roster_id',r2,'expected_revision',0)),past,true,3);
   raise exception 'UNASSIGNED_SCHEDULE_ACCEPTED';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  assert not exists(select 1 from public.gerontik_roster_schedules where roster_id in(r1,r2)),'PARTIAL_SCHEDULE_WRITE';
  result:=public.gerontik_set_practice_schedule(teacher,jsonb_build_array(jsonb_build_object('roster_id',r1,'expected_revision',0)),past,true,3);assert result->>'status'='success','SCHEDULE_SAVE_FAILED';
  checks:=checks||'"assigned schedule authorization and atomicity"'::jsonb;
  op:=gen_random_uuid();result:=public.gerontik_submit_week(a,period_name,1,1,op,'{"complete":true}'::jsonb);assert result->>'status'='success','SUBMISSION_FAILED';sub1:=(result->>'submissionId')::uuid;
  assert (select is_late and due_at=public.gerontik_friday_due(past,1) from public.gerontik_weekly_submissions where id=sub1),'LATE_DEADLINE_NOT_FROZEN';
  result:=public.gerontik_submit_week(a,period_name,1,1,op,'{"complete":true}'::jsonb);assert (result->>'submissionId')::uuid=sub1,'SUBMISSION_REPLAY_FAILED';
  result:=public.gerontik_learning_save(a,period_name,jsonb_set(state_a,'{clinicalState,asuhan,1,evaluasi}','"FORBIDDEN CHANGE"'),1,gen_random_uuid(),false);assert result->>'status'='locked','SUBMITTED_WEEK_EDIT_ACCEPTED';
  state_a:=jsonb_set(state_a,'{clinicalState,asuhan,2,evaluasi}','"SIMULASI WEEK TWO CHANGE"');result:=public.gerontik_learning_save(a,period_name,state_a,1,gen_random_uuid(),false);assert result->>'status'='success' and (result->>'revision')::int=2,'OTHER_WEEK_BLOCKED';
  assert (select snapshot->'clinicalState'->'asuhan'->'2'->>'evaluasi'<>'SIMULASI WEEK TWO CHANGE' from public.gerontik_weekly_submissions where id=sub1),'SNAPSHOT_MUTATED';
  checks:=checks||'"late accepted, frozen snapshot and week-specific lock"'::jsonb;
  result:=public.gerontik_submit_week(b,period_name,1,1,gen_random_uuid(),'{"complete":true}'::jsonb);foreign_sub:=(result->>'submissionId')::uuid;
  begin perform public.gerontik_review_week(teacher,foreign_sub,0,gen_random_uuid(),'approved','SIMULASI');raise exception 'FOREIGN_REVIEW_ACCEPTED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  result:=public.gerontik_review_week(teacher,sub1,0,gen_random_uuid(),'revision_requested','SIMULASI: lengkapi evaluasi.');assert result->>'status'='success','REVIEW_FAILED';
  state_a:=jsonb_set(state_a,'{clinicalState,asuhan,1,evaluasi}','"SIMULASI CORRECTION"');result:=public.gerontik_learning_save(a,period_name,state_a,2,gen_random_uuid(),false);assert result->>'status'='success' and (result->>'revision')::int=3,'REVISION_EDIT_BLOCKED';
  result:=public.gerontik_set_practice_schedule(teacher,jsonb_build_array(jsonb_build_object('roster_id',r1,'expected_revision',1)),future,true,3);assert result->>'status'='success','SCHEDULE_REVISION_FAILED';
  result:=public.gerontik_submit_week(a,period_name,1,3,gen_random_uuid(),'{"complete":true}'::jsonb);sub2:=(result->>'submissionId')::uuid;
  assert (select attempt=2 and not is_late and due_at=public.gerontik_friday_due(future,1) from public.gerontik_weekly_submissions where id=sub2),'RESUBMISSION_METADATA_WRONG';
  assert (select is_late and due_at=public.gerontik_friday_due(past,1) from public.gerontik_weekly_submissions where id=sub1),'HISTORICAL_DEADLINE_REWRITTEN';
  result:=public.gerontik_submit_week(a,period_name,2,3,gen_random_uuid(),'{"complete":true}'::jsonb);assert result->>'status'='success','SECOND_WEEK_SUBMISSION_FAILED';
  checks:=checks||'"lecturer review, revision and historical deadlines"'::jsonb;
  begin insert into public.gerontik_learning_pdf(id,owner_id,period,path,sha256,file_size,document_revision,submission_id) values(pdf_id,b,period_name,'validation/wrong.pdf',repeat('0',64),8,3,sub2);raise exception 'FOREIGN_PDF_ACCEPTED';exception when raise_exception then if sqlerrm<>'PDF_SUBMISSION_MISMATCH' then raise;end if;end;
  insert into public.gerontik_learning_pdf(id,owner_id,period,path,sha256,file_size,document_revision,submission_id) values(pdf_id,a,period_name,'validation/owned.pdf',repeat('0',64),8,3,sub2);
  begin update public.gerontik_learning_pdf set submission_id=sub1,document_revision=1 where id=pdf_id;raise exception 'PDF_REBIND_ACCEPTED';exception when raise_exception then if sqlerrm<>'PDF_BINDING_IMMUTABLE' then raise;end if;end;
  update public.gerontik_learning_pdf set feedback='SIMULASI REVIEW',review_revision=1 where id=pdf_id;
  checks:=checks||'"PDF owner/revision binding and immutable association"'::jsonb;
  result:=public.gerontik_learning_save(b,period_name,state_b,1,gen_random_uuid(),true);assert result->>'status'='success','LEGACY_FINAL_FAILED';
  result:=public.gerontik_learning_save(b,period_name,state_b,2,gen_random_uuid(),false);assert result->>'status'='locked','LEGACY_FINAL_NOT_LOCKED';
  checks:=checks||'"legacy FINAL compatibility"'::jsonb;
  result:=public.gerontik_queue_reminder(teacher,r1,1,'SIMULASI, JANGAN DIKIRIM',array['email','whatsapp'],op);qid:=(result->>'reminderId')::uuid;assert result->>'status'='success','REMINDER_QUEUE_FAILED';
  assert (select count(*)=2 from public.gerontik_reminder_outbox where reminder_id=qid),'OUTBOX_ROWS_MISSING';
  assert (select status='blocked' and error_code='WHATSAPP_OPT_IN_MISSING' from public.gerontik_reminder_outbox where reminder_id=qid and channel='whatsapp'),'WHATSAPP_CONSENT_BYPASSED';
  result:=public.gerontik_queue_reminder(teacher,r1,1,'SIMULASI, JANGAN DIKIRIM',array['email','whatsapp'],op);assert (result->>'reminderId')::uuid=qid,'REMINDER_REPLAY_FAILED';
  select count(*) into n from public.gerontik_claim_reminders(lease);assert n=1,'OUTBOX_CLAIM_FAILED';
  assert not public.gerontik_finish_reminder((select id from public.gerontik_reminder_outbox where reminder_id=qid and channel='email'),gen_random_uuid(),'accepted','SYNTHETIC',null),'STALE_LEASE_ACCEPTED';
  assert public.gerontik_finish_reminder((select id from public.gerontik_reminder_outbox where reminder_id=qid and channel='email'),lease,'accepted','SYNTHETIC',null),'LEASE_ACK_FAILED';
  checks:=checks||'"reminder queue, consent, idempotency and worker leases (no sending)"'::jsonb;
  assert not has_table_privilege('anon','public.gerontik_weekly_submissions','SELECT') and not has_table_privilege('authenticated','public.gerontik_weekly_submissions','SELECT'),'SUBMISSION_DIRECT_ACCESS';
  assert not has_table_privilege('anon','public.gerontik_reminder_outbox','SELECT') and not has_table_privilege('authenticated','public.gerontik_notification_contacts','UPDATE'),'CONTACT_DIRECT_ACCESS';
  assert not has_function_privilege('anon','public.gerontik_submit_week(uuid,text,integer,integer,uuid,jsonb)','EXECUTE'),'PUBLIC_RPC_ACCESS';
  checks:=checks||'"anonymous/authenticated direct-access denial"'::jsonb;
  raise exception using errcode='PZ001',message='ROLLBACK_SYNTHETIC_VALIDATION';
 exception when sqlstate 'PZ001' then rolled_back:=true;
 end;
 assert rolled_back,'FIXTURE_ROLLBACK_NOT_COMPLETED';
 assert not exists(select 1 from public.gerontik_learning_roster where period=period_name),'FIXTURE_ROSTER_REMAINED';
 assert not exists(select 1 from public.gerontik_learning_documents where period=period_name),'FIXTURE_DOCUMENT_REMAINED';
 perform set_config('gerontik.release_validation',jsonb_build_object('passed',true,'checks',checks,'fixtures_rolled_back',true,'messages_sent',0)::text,false);
end $validation$;
select current_setting('gerontik.release_validation')::jsonb as validation;
