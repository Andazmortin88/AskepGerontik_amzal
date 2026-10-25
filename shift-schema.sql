create table public.gerontik_shift_plans(
 plan_id uuid primary key default gen_random_uuid(),period_id uuid not null references public.gerontik_practicum_periods(period_id),
 title text not null,start_date date check(start_date is null or extract(isodow from start_date)=1),
 status text not null default 'DRAFT' check(status in('DRAFT','PUBLISHED')),version integer not null default 0,
 published_at timestamptz,created_at timestamptz not null default now()
);
create table public.gerontik_shift_groups(
 plan_id uuid not null references public.gerontik_shift_plans(plan_id),group_no integer not null check(group_no between 1 and 4),
 supervisor_name text not null,supervisor_user_id uuid references public.gerontik_users(user_id),primary key(plan_id,group_no)
);
create table public.gerontik_shift_members(
 plan_id uuid not null,user_id uuid not null references public.gerontik_users(user_id),group_no integer not null,seq integer not null,
 primary key(plan_id,user_id),unique(plan_id,group_no,seq),foreign key(plan_id,group_no) references public.gerontik_shift_groups(plan_id,group_no)
);
create table public.gerontik_shift_slots(
 plan_id uuid not null,user_id uuid not null,day_index integer not null check(day_index between 0 and 9),
 wisma text not null check(wisma in('A','B','C','D')),shift text not null check(shift in('Pagi','Siang')),revision integer not null default 0,
 primary key(plan_id,user_id,day_index),foreign key(plan_id,user_id) references public.gerontik_shift_members(plan_id,user_id)
);
create table public.gerontik_shift_swaps(
 swap_id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.gerontik_shift_plans(plan_id),
 day_index integer not null check(day_index between 0 and 9),requester uuid not null,substitute uuid not null,reason text not null check(length(trim(reason)) between 1 and 500),
 status text not null default 'WAIT_PEER' check(status in('WAIT_PEER','WAIT_ADMIN','APPROVED','REJECTED','CANCELLED','STALE')),
 old_a text not null,old_b text not null,wisma text not null,revision_a integer not null,revision_b integer not null,
 created_at timestamptz not null default now(),accepted_at timestamptz,decided_at timestamptz,decided_by uuid references public.gerontik_users(user_id),
 check(requester<>substitute),foreign key(plan_id,requester) references public.gerontik_shift_members(plan_id,user_id),foreign key(plan_id,substitute) references public.gerontik_shift_members(plan_id,user_id)
);
create index gerontik_shift_swaps_plan_idx on public.gerontik_shift_swaps(plan_id,day_index,status);
create table public.gerontik_shift_notifications(
 notification_id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.gerontik_shift_plans(plan_id),
 title text not null,body jsonb not null,recipients uuid[],created_at timestamptz not null default now()
);
create index gerontik_shift_notifications_plan_idx on public.gerontik_shift_notifications(plan_id,created_at desc);
create table public.gerontik_shift_reads(
 notification_id uuid not null references public.gerontik_shift_notifications(notification_id),user_id uuid not null references public.gerontik_users(user_id),read_at timestamptz not null default now(),primary key(notification_id,user_id)
);
do $$ declare t text;begin foreach t in array array['gerontik_shift_plans','gerontik_shift_groups','gerontik_shift_members','gerontik_shift_slots','gerontik_shift_swaps','gerontik_shift_notifications','gerontik_shift_reads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;end $$;

create function public.gerontik_shift_api(p_token text,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u public.gerontik_users%rowtype;p public.gerontik_shift_plans%rowtype;r public.gerontik_shift_swaps%rowtype;
 a public.gerontik_shift_slots%rowtype;b public.gerontik_shift_slots%rowtype;pid uuid;target uuid;sid uuid;d integer;why text;staff boolean;admin boolean;mine boolean;answer jsonb;newdate date;actorname text;
begin
 select x.* into u from public.gerontik_sessions s join public.gerontik_users x on x.user_id=s.user_id
 where s.token=p_token and s.expires_at>now() and x.active limit 1;
 if u.user_id is null then return jsonb_build_object('status','auth_required','message','Sesi berakhir. Silakan login kembali.');end if;
 admin:=u.role='ADMIN';staff:=u.role in('ADMIN','INSTRUCTOR');actorname:=u.full_name;
 if coalesce(p_data->>'planId','')<>'' then pid:=(p_data->>'planId')::uuid;else
  select x.plan_id into pid from public.gerontik_shift_plans x where admin
   or exists(select 1 from public.gerontik_shift_groups g where g.plan_id=x.plan_id and g.supervisor_user_id=u.user_id and staff)
   or exists(select 1 from public.gerontik_shift_members m where m.plan_id=x.plan_id and m.user_id=u.user_id and x.status='PUBLISHED')
  order by x.created_at desc limit 1;
 end if;
 select * into p from public.gerontik_shift_plans where plan_id=pid;
 mine:=exists(select 1 from public.gerontik_shift_members m where m.plan_id=pid and m.user_id=u.user_id);
 if p.plan_id is null or not(admin or mine and p.status='PUBLISHED' or staff and exists(select 1 from public.gerontik_shift_groups g where g.plan_id=pid and g.supervisor_user_id=u.user_id)) then
  if p_action='load' then return jsonb_build_object('status','success','plan',null,'userId',u.user_id,'role',u.role);end if;
  return jsonb_build_object('status','error','message','Jadwal tidak tersedia untuk akun ini.');
 end if;
 if p_action='load' then
  select jsonb_build_object('status','success','userId',u.user_id,'role',u.role,'plan',to_jsonb(p),
   'groups',coalesce((select jsonb_agg(to_jsonb(g) order by group_no) from public.gerontik_shift_groups g where g.plan_id=pid),'[]'),
   'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',x.full_name,'group_no',m.group_no,'seq',m.seq) order by m.group_no,m.seq) from public.gerontik_shift_members m join public.gerontik_users x on x.user_id=m.user_id where m.plan_id=pid),'[]'),
   'slots',coalesce((select jsonb_agg(to_jsonb(s) order by day_index,user_id) from public.gerontik_shift_slots s where s.plan_id=pid),'[]'),
   'requests',coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc) from public.gerontik_shift_swaps s where s.plan_id=pid and(admin or u.user_id in(s.requester,s.substitute) or staff and exists(select 1 from public.gerontik_shift_members m join public.gerontik_shift_groups g using(plan_id,group_no) where m.plan_id=pid and m.user_id=s.requester and g.supervisor_user_id=u.user_id))),'[]'),
   'notifications',coalesce((select jsonb_agg(item order by created_at desc) from(select n.created_at,jsonb_build_object('id',n.notification_id,'title',n.title,'body',n.body,'global',n.recipients is null,'created_at',n.created_at,'read',exists(select 1 from public.gerontik_shift_reads z where z.notification_id=n.notification_id and z.user_id=u.user_id)) item from public.gerontik_shift_notifications n where n.plan_id=pid and(n.recipients is null or u.user_id=any(n.recipients) or admin or staff and exists(select 1 from public.gerontik_shift_members m join public.gerontik_shift_groups g using(plan_id,group_no) where m.plan_id=pid and m.user_id=any(n.recipients) and g.supervisor_user_id=u.user_id)) order by n.created_at desc limit 200) q),'[]')
  ) into answer;return answer;
 end if;
 -- Every mutation locks the plan first, so overlapping requests cannot race an approval.
 select * into p from public.gerontik_shift_plans where plan_id=pid for update;
 if p_action='read' then
  insert into public.gerontik_shift_reads(notification_id,user_id) select n.notification_id,u.user_id from public.gerontik_shift_notifications n where n.plan_id=pid and(n.recipients is null or u.user_id=any(n.recipients) or admin or staff and exists(select 1 from public.gerontik_shift_members m join public.gerontik_shift_groups g using(plan_id,group_no) where m.plan_id=pid and m.user_id=any(n.recipients) and g.supervisor_user_id=u.user_id)) on conflict do nothing;
  return jsonb_build_object('status','success');
 end if;
 if p_action='date' then
  if not admin then return jsonb_build_object('status','error','message','Tanggal mulai hanya dapat ditetapkan admin.');end if;
  newdate:=(p_data->>'startDate')::date;
  if newdate is null or extract(isodow from newdate)<>1 or newdate<(now() at time zone 'Asia/Jakarta')::date then return jsonb_build_object('status','error','message','Pilih tanggal Senin yang belum berlalu.');end if;
  if p.start_date is not null then return jsonb_build_object('status','error','message','Tanggal mulai sudah ditetapkan. Hubungi admin untuk pengaturan periode baru.');end if;
  update public.gerontik_shift_plans set start_date=newdate,version=version+1 where plan_id=pid;
  insert into public.gerontik_shift_notifications(plan_id,title,body) values(pid,'Tanggal praktik ditetapkan',jsonb_build_object('text','Praktik dua minggu Senin–Jumat dimulai pada '||to_char(newdate,'DD-MM-YYYY')||'.','approvedBy',actorname));
  return jsonb_build_object('status','success');
 end if;
 if p.status<>'PUBLISHED' then return jsonb_build_object('status','error','message','Jadwal belum diterbitkan.');end if;
 if p_action='request' then
  if u.role<>'STUDENT' or not mine then return jsonb_build_object('status','error','message','Pengajuan hanya dapat dibuat mahasiswa yang terdaftar.');end if;
  target:=(p_data->>'targetId')::uuid;d:=(p_data->>'day')::integer;why:=trim(p_data->>'reason');sid:=(p_data->>'requestId')::uuid;
  if target is null or sid is null or d is null or d not between 0 and 9 or coalesce(length(why),0) not between 1 and 500 or target=u.user_id then return jsonb_build_object('status','error','message','Lengkapi mahasiswa pengganti, hari, dan alasan (maksimal 500 karakter).');end if;
  select * into r from public.gerontik_shift_swaps where swap_id=sid;
  if found then if r.requester=u.user_id and r.plan_id=pid then return jsonb_build_object('status','success');else return jsonb_build_object('status','error','message','ID pengajuan tidak valid.');end if;end if;
  select * into a from public.gerontik_shift_slots where plan_id=pid and day_index=d and user_id=u.user_id;
  select * into b from public.gerontik_shift_slots where plan_id=pid and day_index=d and user_id=target;
  if a.user_id is null or b.user_id is null or a.wisma<>b.wisma or a.shift=b.shift or not exists(select 1 from public.gerontik_users where user_id=target and active) then return jsonb_build_object('status','error','message','Pengganti harus aktif, pada hari dan wisma yang sama, dengan shift berlawanan.');end if;
  if p.start_date is not null and p.start_date+(d/5)*7+(d%5)<(now() at time zone 'Asia/Jakarta')::date then return jsonb_build_object('status','error','message','Hari dinas sudah berlalu.');end if;
  if exists(select 1 from public.gerontik_shift_swaps s where s.plan_id=pid and s.day_index=d and s.status in('WAIT_PEER','WAIT_ADMIN') and(u.user_id in(s.requester,s.substitute) or target in(s.requester,s.substitute))) then return jsonb_build_object('status','error','message','Salah satu mahasiswa memiliki pengajuan aktif pada hari ini.');end if;
  insert into public.gerontik_shift_swaps(swap_id,plan_id,day_index,requester,substitute,reason,old_a,old_b,wisma,revision_a,revision_b) values(sid,pid,d,u.user_id,target,why,a.shift,b.shift,a.wisma,a.revision,b.revision);
  insert into public.gerontik_shift_notifications(plan_id,title,body,recipients) values(pid,'Permintaan tukar jadwal',jsonb_build_object('text',u.full_name||' mengajukan tukar shift. Jadwal belum berubah.','day',d,'wisma',a.wisma,'swapId',sid),array[u.user_id,target]);
  return jsonb_build_object('status','success');
 end if;
 if p_action in('accept','reject','cancel','approve') then
  sid:=(p_data->>'requestId')::uuid;select * into r from public.gerontik_shift_swaps where swap_id=sid and plan_id=pid for update;
  if r.swap_id is null then return jsonb_build_object('status','error','message','Pengajuan tidak ditemukan.');end if;
  if r.status not in('WAIT_PEER','WAIT_ADMIN') then return jsonb_build_object('status','error','message','Pengajuan sudah diproses. Muat ulang jadwal.');end if;
  if p_action='accept' and r.status='WAIT_PEER' and r.substitute=u.user_id and u.role='STUDENT' then
   update public.gerontik_shift_swaps set status='WAIT_ADMIN',accepted_at=now() where swap_id=sid;
   insert into public.gerontik_shift_notifications(plan_id,title,body,recipients) values(pid,'Pengganti menyetujui',jsonb_build_object('text',u.full_name||' menyetujui pengajuan. Menunggu pengesahan dosen/admin.','day',r.day_index,'swapId',sid),array[r.requester,r.substitute]);
  elsif p_action='cancel' and r.requester=u.user_id and u.role='STUDENT' then
   update public.gerontik_shift_swaps set status='CANCELLED',decided_at=now(),decided_by=u.user_id where swap_id=sid;
   insert into public.gerontik_shift_notifications(plan_id,title,body,recipients) values(pid,'Pengajuan dibatalkan',jsonb_build_object('text','Pengaju membatalkan permintaan. Jadwal tidak berubah.','day',r.day_index,'swapId',sid),array[r.requester,r.substitute]);
  else
   if not(r.status='WAIT_PEER' and r.substitute=u.user_id and u.role='STUDENT' and p_action='reject' or r.status='WAIT_ADMIN' and staff and(admin or exists(select 1 from public.gerontik_shift_members m join public.gerontik_shift_groups g using(plan_id,group_no) where m.plan_id=pid and m.user_id=r.requester and g.supervisor_user_id=u.user_id))) then return jsonb_build_object('status','error','message','Akun ini tidak berhak memproses pengajuan pada tahap tersebut.');end if;
   if p_action='reject' then
    update public.gerontik_shift_swaps set status='REJECTED',decided_at=now(),decided_by=u.user_id where swap_id=sid;
    insert into public.gerontik_shift_notifications(plan_id,title,body,recipients) values(pid,'Pengajuan ditolak',jsonb_build_object('text','Pengajuan tidak disetujui. Jadwal tidak berubah.','day',r.day_index,'swapId',sid),array[r.requester,r.substitute]);
   elsif p_action='approve' and r.status='WAIT_ADMIN' then
    select * into a from public.gerontik_shift_slots where plan_id=pid and day_index=r.day_index and user_id=r.requester;
    select * into b from public.gerontik_shift_slots where plan_id=pid and day_index=r.day_index and user_id=r.substitute;
    if a.revision<>r.revision_a or b.revision<>r.revision_b or a.wisma<>r.wisma or b.wisma<>r.wisma or a.shift<>r.old_a or b.shift<>r.old_b or p.start_date is not null and p.start_date+(r.day_index/5)*7+(r.day_index%5)<(now() at time zone 'Asia/Jakarta')::date then
     update public.gerontik_shift_swaps set status='STALE',decided_at=now(),decided_by=u.user_id where swap_id=sid;
     return jsonb_build_object('status','error','message','Penempatan sudah berubah atau hari telah berlalu. Ajukan kembali bila diperlukan.');
    end if;
    update public.gerontik_shift_slots set shift=case when user_id=r.requester then r.old_b else r.old_a end,revision=revision+1 where plan_id=pid and day_index=r.day_index and user_id in(r.requester,r.substitute);
    update public.gerontik_shift_swaps set status='APPROVED',decided_at=now(),decided_by=u.user_id where swap_id=sid;
    update public.gerontik_shift_plans set version=version+1 where plan_id=pid returning version into d;
    insert into public.gerontik_shift_notifications(plan_id,title,body) values(pid,'Perubahan jadwal disetujui · v'||d,jsonb_build_object('day',r.day_index,'wisma',r.wisma,'swapId',sid,'version',d,'approvedBy',actorname,'changes',jsonb_build_array(jsonb_build_object('name',(select full_name from public.gerontik_users where user_id=r.requester),'group',(select group_no from public.gerontik_shift_members where plan_id=pid and user_id=r.requester),'from',r.old_a,'to',r.old_b),jsonb_build_object('name',(select full_name from public.gerontik_users where user_id=r.substitute),'group',(select group_no from public.gerontik_shift_members where plan_id=pid and user_id=r.substitute),'from',r.old_b,'to',r.old_a))));
   else return jsonb_build_object('status','error','message','Aksi tidak tersedia pada tahap ini.');end if;
  end if;
  return jsonb_build_object('status','success');
 end if;
 return jsonb_build_object('status','error','message','Permintaan tidak dikenal.');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('status','error','message','Format permintaan tidak valid.');
end $$;
revoke all on function public.gerontik_shift_api(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.gerontik_shift_api(text,text,jsonb) to service_role;
