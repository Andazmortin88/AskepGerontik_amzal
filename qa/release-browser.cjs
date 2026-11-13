// All identities, clinical states and API responses below are synthetic.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {full}=require('../tests/weekly-fixture.cjs'),progress=require('../progress.js');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(e?'missing':b);});});
const rows=Array.from({length:100},(_,i)=>({id:'roster-'+i,name:'Mahasiswa SIMULASI '+(i+1),nim:'SIM'+(i+1),group_name:'A',group:'A',auth_user_id:i<2?'synthetic-'+i:null}));
let state=full(),revision=7;state.mahasiswa={nama:rows[0].name,nim:rows[0].nim};let submissions=[];
const profile=role=>({userId:role==='teacher'?'synthetic-teacher':'synthetic-0',name:role==='teacher'?'Dosen SIMULASI':rows[0].name,email:role+'@example.test',roles:role==='teacher'?['super_admin','lecturer']:['student']});
async function fixtures(context,role){
 await context.route('https://cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(profile(role).userId)}},access_token:'synthetic-token'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})}})};`}));
 await context.route('**/functions/v1/gerontik-learning-api',async r=>{const {action,payload:p={}}=r.request().postDataJSON();let result={status:'success'};
  if(action==='bootstrap')Object.assign(result,{profile:profile(role),roster:role==='teacher'?rows:[rows[0]],period:'uji-v7'});
  else if(action==='load')Object.assign(result,{document:{owner_id:'synthetic-0',period:'uji-v7',state,revision,status:'DRAFT'},reviews:[],roster:rows[0]});
  else if(action==='save'){state=p.state;revision++;Object.assign(result,{revision,documentStatus:'DRAFT',updated_at:new Date().toISOString(),operationId:p.operationId});}
  else if(action==='weeklyStatus')Object.assign(result,{submissions,reviews:[],reminders:[],schedule:null});
  else if(action==='monitoring')result.students=rows.map((x,i)=>({...x,linked:i<2,revision:i?0:revision,documentStatus:'DRAFT',updatedAt:i?null:new Date().toISOString(),weeks:[1,2].map(w=>({...progress.weekProgress(i?{}:state,w),submission:submissions.find(s=>s.week===w)}))}));
  else if(action==='submitWeek'){const s={id:'submission-'+p.week,week:p.week,attempt:1,document_revision:revision,review_revision:0,status:'submitted',created_at:new Date().toISOString(),due_at:null,is_late:null,snapshot:structuredClone(state)};submissions.push(s);result.submissionId=s.id;}
  else if(action==='loadSubmission')Object.assign(result,{submission:submissions.find(s=>s.id===p.submissionId),student:rows[0]});
  else if(action==='listPdf')result.reports=[];
  else if(action==='reminderChannels')Object.assign(result,{enabled:false,emailConfigured:false,whatsappConfigured:false});
  else if(action==='exportAnalysis')result.records=[1,2].map(week=>({state,week,rosterId:rows[0].id,studentName:rows[0].name,nim:rows[0].nim,period:'SIMULASI',group:'A',source:'saved_latest',revision,status:'DRAFT'}));
  else Object.assign(result,{notifications:[],deliveries:[],contacts:[],reviews:[],reports:[],unread:0});
  await r.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch();const checks=[];
 try{
  const endpoint='https://llwedqqzqotrslshfuad.supabase.co/functions/v1/gerontik-learning-api-candidate';
  for(const [method,headers,expected]of [['POST',{'Content-Type':'application/json'},401],['POST',{'Content-Type':'application/json',Origin:'https://untrusted.example.test'},403],['GET',{},405]]){const r=await fetch(endpoint,{method,headers,...(method==='POST'?{body:JSON.stringify({action:'bootstrap',payload:{}})}:{})});assert.equal(r.status,expected,'Live candidate '+method+' '+JSON.stringify(headers));}
  checks.push('Live candidate denies anonymous/foreign-origin/wrong-method requests');
  for(const width of [1440,1024,768,390,320]){const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await c.route('https://**',r=>r.abort());const p=await c.newPage();await p.goto(base+'/portal.html');await p.locator('.elderly-image').waitFor();await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Landing overflow '+width);assert(await p.evaluate(()=>parseFloat(getComputedStyle(document.body).fontSize)>=20),'Landing font '+width);assert(await p.locator('.elderly-image').evaluate(e=>e.complete&&e.naturalWidth===1536));await p.screenshot({path:path.join(out,'landing-'+width+'.png'),fullPage:true});checks.push('landing '+width);await c.close();}
  for(const role of ['student','teacher']){const c=await browser.newContext({viewport:{width:1440,height:1000}});await fixtures(c,role);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/learning-v6.html');await p.locator('#learningLayout').waitFor({state:'visible'});await p.locator('#nav [data-work]').first().waitFor();await p.waitForTimeout(400);
   assert(await p.locator('#app').innerText().then(x=>x.includes(role==='teacher'?'Ringkasan kelas':'Tugas praktik saya')));
   const menus=await p.locator('#nav [data-work=navigate]').evaluateAll(a=>a.map(e=>e.dataset.page));assert.equal(menus.includes('export-analysis'),role==='teacher');
   if(role==='teacher')assert.equal(await p.locator('tbody tr').count(),100);
   for(const menu of menus){await p.locator('#nav [data-page="'+menu+'"]').click();await p.waitForTimeout(90);assert((await p.locator('#app').innerText()).trim().length>10,'Empty '+role+'/'+menu);}
   await p.locator('#nav [data-page=dashboard]').click();await p.screenshot({path:path.join(out,role+'-desktop.png'),fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,role+'-mobile.png'),fullPage:true});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+' mobile overflow');
   if(role==='student'){
    await p.locator('#nav [data-page=submission]').click();const send=p.locator('[data-work=submit][data-week="1"]');assert(await send.isEnabled(),'Complete week should submit');await send.click();await p.locator('dialog button[type=submit]').click();await p.waitForTimeout(300);assert(await p.locator('[data-work=submit][data-week="1"]').isDisabled());
    await p.locator('#nav [data-page=careplan]').click();const fields=p.locator('[data-care]');assert(await fields.count()>0);assert(await fields.first().isDisabled(),'Submitted week locks inputs');
    const csv=await p.evaluate(s=>{const r=GerontikAnalysisExport.row({state:s,week:1,rosterId:'SIM',period:'SIMULASI',revision:7});return {text:GerontikAnalysisExport.csv([r]),zero:r.barthel_b1_score,columns:GerontikAnalysisExport.columns().length};},state);assert.equal(csv.zero,0);assert.equal(csv.columns,868);fs.writeFileSync(path.join(out,'synthetic-analysis.csv'),csv.text);
    await p.addScriptTag({url:'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js'});await p.addScriptTag({url:base+'/learning-v6-fonts.js'});const pdf=await p.evaluate(async s=>{const def=GerontikSubmissionPdf.definition(s,INSTRUMEN);return await new Promise(resolve=>pdfMake.createPdf(def).getBase64(resolve));},submissions[0]);const bytes=Buffer.from(pdf,'base64');assert(bytes.subarray(0,5).toString()==='%PDF-');assert(bytes.length>20000);fs.writeFileSync(path.join(out,'synthetic-week1.pdf'),bytes);
   }
   assert.deepEqual(errors,[],role+' JS errors');checks.push(role+' all '+menus.length+' menus, desktop/mobile');await c.close();
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks,realGoogleLoginTested:false,realMessagesSent:0},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});