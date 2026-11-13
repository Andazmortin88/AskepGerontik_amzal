const fs=require('node:fs'),path=require('node:path'),{full}=require('./tests/weekly-fixture.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
const demo=full();demo.clinicalState.instrumenRaw={1:{},2:{}};demo.clinicalState.mahasiswa={nama:'Mahasiswa Simulasi 001',nim:'SIM001',status:'Profesi Ners',kelas:'Kelompok 1'};delete demo.clinicalState.asuhan[2].evaluasi;demo.clinicalState.h2t[2]={};delete demo.clinicalState.instrumen[2].barthel.b1;
const runtime=`
const DEMO_STATE=${JSON.stringify(demo)};
let demoRole='student',demoSelected=0,ws,docRev=1,attempts=[],reviews=[],reminders=[];
const copy=x=>JSON.parse(JSON.stringify(x)),roster=Array.from({length:100},(_,i)=>({id:'demo-'+i,name:'Mahasiswa Simulasi '+String(i+1).padStart(3,'0'),nim:'SIM'+String(i+1).padStart(3,'0'),group_name:'Kelompok '+(1+Math.floor(i/25)),auth_user_id:i%7===0?null:'owner-'+i}));
db={...empty(),...copy(DEMO_STATE)};State=db.clinicalState;
for(const id of ['monitoring','incomplete','submissions','reminders','submission','feedback'])views[id]=()=>'';
views.archive=()=>'<div class="card"><h1>Periksa PDF & komentar</h1><p>Preview ini menggunakan data simulasi tanpa berkas pasien. Pada draf aplikasi, dosen dapat membuka PDF di halaman ini dan menyimpan komentar untuk setiap berkas.</p></div>';
const baseRender=render;render=function(){baseRender();ws?.afterRender();};
save=function(){docRev++;return true;};clinicalSave=function(){db.clinicalState=State;save();};
async function demoApi(action,p={}){
 const mine=()=>attempts.filter(s=>s.roster===roster[demoSelected].id);
 if(action==='monitoring')return {students:roster.map((r,i)=>{const state=i===demoSelected?db:i%7===0?{}:i%3===0?DEMO_STATE:{};return {id:r.id,name:r.name,nim:r.nim,group:r.group_name,linked:!!r.auth_user_id,updatedAt:i%7===0?null:'2026-11-13T08:30:00Z',weeks:[1,2].map(w=>({...GerontikProgress.weekProgress(state,w),submission:attempts.filter(s=>s.roster===r.id).find(s=>s.week===w)||null}))};})};
 if(action==='weeklyStatus')return {submissions:mine(),reviews:reviews.filter(r=>mine().some(s=>s.id===r.submission_id)),reminders:reminders.filter(r=>r.roster===roster[demoSelected].id)};
 if(action==='submitWeek'){if(demoRole!=='student')throw Error('Hanya mahasiswa');if(!GerontikProgress.weekProgress(db,p.week).complete)throw Error('Belum lengkap');attempts.unshift({id:crypto.randomUUID(),roster:roster[demoSelected].id,week:p.week,attempt:mine().filter(s=>s.week===p.week).length+1,document_revision:docRev,status:'submitted',review_revision:0,created_at:new Date().toISOString(),snapshot:copy(db)});return {status:'success'};}
 if(action==='loadSubmission'){const s=attempts.find(s=>s.id===p.submissionId);if(!s)throw Error('Kiriman simulasi tidak tersedia');return {submission:s,student:roster.find(r=>r.id===s.roster).name,reviews:reviews.filter(r=>r.submission_id===s.id)};}
 if(action==='reviewWeek'){if(demoRole!=='teacher')throw Error('Hanya dosen');const s=attempts.find(s=>s.id===p.submissionId);s.status=p.decision;s.review_revision++;reviews.unshift({submission_id:s.id,decision:p.decision,comment:p.comment,created_at:new Date().toISOString()});return {status:'success'};}
 if(action==='sendReminder'){reminders.unshift({id:crypto.randomUUID(),roster:p.rosterId,week:p.week,message:p.message,created_at:new Date().toISOString()});return {status:'success'};}
 if(action==='readReminder'){reminders.find(r=>r.id===p.reminderId).read_at=new Date().toISOString();return {status:'success'};}
 throw Error('Fitur tidak tersedia pada preview offline');
}
function connectPreview(){ws?.dispose();document.querySelector('#role').value=demoRole;ws=GerontikRoleWorkspace.connect({api:demoApi,profile:()=>({roles:[demoRole==='teacher'?'lecturer':'student']}),roster:()=>roster[demoSelected],state:()=>db,document:()=>({revision:docRev,status:'DRAFT'}),page:()=>page,week:()=>clinicalWeek,module:()=>clinicalModule,render:()=>render(),go:p=>go(p),openWeek:(w,p,m,i)=>{clinicalWeek=w;if(m)clinicalModule=m;if(i)clinicalInstrument=i;go(p);},flush:async()=>{},notice:toast,ask:async({message})=>confirm(message),select:async id=>{demoSelected=roster.findIndex(r=>r.id===id);db={...empty(),...copy(DEMO_STATE)};State=db.clinicalState;}});page='dashboard';render();}
document.querySelector('#previewRole').onchange=e=>{demoRole=e.target.value;connectPreview();};
attempts.push({id:'demo-submission',roster:roster[1].id,week:1,attempt:1,document_revision:1,status:'submitted',review_revision:0,created_at:'2026-11-13T08:30:00Z',snapshot:copy(DEMO_STATE)});
connectPreview();
`;
const html='<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review dashboard Askep Gerontik</title><style>'+read('learning-v6.css')+read('brand-theme.css')+read('role-workspace.css')+'body{font-size:17px}.preview-banner{background:#ffe600;color:#142a5b;padding:16px 28px;font-weight:700;position:sticky;top:0;z-index:100}.preview-banner select{display:inline-block;width:auto;margin:0 12px}header{position:static}</style><body><div class="preview-banner">PREVIEW REVIEW · DATA SIMULASI · BELUM DEPLOY <label for="previewRole">Tampilan</label><select id="previewRole"><option value="student">Mahasiswa</option><option value="teacher">Dosen</option></select></div><header><div class="brand">Askep Gerontik Terintegrasi<small>PRAKTIK PROFESI NERS · UBS</small></div><select id="role" hidden><option value="student">Mahasiswa</option><option value="teacher">Dosen</option></select></header><div class="layout"><aside><nav id="nav" aria-label="Menu dashboard"></nav></aside><main id="app"></main></div><div id="toast" role="status" aria-live="polite"></div>'+['completion.js','h2t-schema.js','progress.js','learning-v6-core.js','role-workspace.js'].map(p=>script(read(p))).join('')+script(runtime)+'</body></html>';
fs.writeFileSync(path.join(__dirname,'review-preview.html'),html);
console.log('Standalone offline review-preview.html created; no production API configured.');
