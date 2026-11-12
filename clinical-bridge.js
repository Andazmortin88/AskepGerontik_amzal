(()=>{
 'use strict';let initialized=false,locked=true,delay;
 const emit=()=>{if(initialized&&!locked)parent.postMessage({type:'gerontik:state',state:JSON.parse(JSON.stringify(State))},location.origin);};
 function capture(){if(!initialized||locked)return;captureCurrentFormsToState(false);emit();}
 saveStateFinalLocalOnly=()=>{};
 saveState=()=>{if(!initialized||locked)return;clearTimeout(delay);delay=setTimeout(emit,120);};
 window.saveDraftNow=async()=>{capture();parent.postMessage({type:'gerontik:save'},location.origin);};
 window.syncFinal=async()=>parent.postMessage({type:'gerontik:final'},location.origin);
 window.logoutApp=()=>{capture();toast('Gunakan menu akun pada halaman utama untuk keluar.');};
 window.refreshClassProgress=async()=>{};loadReminders=async()=>{};
 apiPostFinal=async()=>{throw new Error('Formulir ini menggunakan penyimpanan akun pada portal.');};
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==location.origin||parent===window)return;
  if(e.data?.type==='gerontik:capture'){capture();return;}
  if(e.data?.type!=='gerontik:init'||initialized)return;
  const {profile,roster,state}=e.data;if(!profile?.userId||!roster)return;
  locked=e.data.locked===true;initialized=true;
  const user={userId:profile.userId,nama:roster.name,nim:roster.nim||'',program:roster.program||'',kelas:roster.group_name||''};
  resetStateForStudent(user);AppSession.token='';AppSession.role='STUDENT';AppSession.user=user;AppSession.isFinal=locked;suppressCloudSave=true;
  if(state){const owned={...state,ownerUserId:user.userId};applyStudentState(owned,user);}
  State.mahasiswa={nama:user.nama,nim:user.nim,status:user.program,kelas:user.kelas};
  document.getElementById('mhsNama').value=user.nama;document.getElementById('mhsNIM').value=user.nim;document.getElementById('mhsStatus').value=user.program;
  ['mhsNama','mhsNIM','mhsStatus'].forEach(id=>document.getElementById(id).readOnly=true);
  document.getElementById('coverScreen').classList.add('hidden');document.getElementById('adminContainer').style.display='none';document.getElementById('appContainer').style.display='block';
  document.getElementById('readonlyBanner').style.display=locked?'block':'none';document.getElementById('dashboardPrintBtn').style.display='inline-flex';
  const peer=document.querySelector('#peerProgressBody')?.closest('.card');if(peer)peer.style.display='none';
  renderDemografi();renderInstrumen();renderAsuhan();renderStudentDashboard(false);installAutosaveListeners();goToPage('page-demografi');
  if(locked)enableReadOnlyMode();setCloudStatus('ok',locked?'FINAL · Hanya baca':'Penyimpanan terhubung ke portal');
 });
 if(parent!==window)parent.postMessage({type:'gerontik:ready'},location.origin);
 else document.body.innerHTML='<p style="font:16px system-ui;padding:30px">Buka formulir melalui <a href="./?masuk=1">akun Askep Gerontik</a>.</p>';
})();
