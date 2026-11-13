// Draft worker: do not deploy or schedule until staging and provider setup pass.
import {createClient} from 'npm:@supabase/supabase-js@2.117.1';
import './reminder-delivery.js';
const engine=(globalThis as any).GerontikDelivery;
const env=(name:string)=>Deno.env.get(name)||'';
const config={enabled:env('REMINDER_SEND_ENABLED')==='true',emailKey:env('RESEND_API_KEY'),emailFrom:env('REMINDER_EMAIL_FROM'),waToken:env('WHATSAPP_ACCESS_TOKEN'),waPhoneId:env('WHATSAPP_PHONE_NUMBER_ID'),waTemplate:env('WHATSAPP_REMINDER_TEMPLATE'),waVersion:env('WHATSAPP_GRAPH_VERSION'),waLanguage:env('WHATSAPP_TEMPLATE_LANGUAGE')||'id'};
async function authorized(req:Request){const expected=env('REMINDER_WORKER_TOKEN'),provided=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(expected.length<32||provided.length>4096)return false;const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(provided)));let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;}
Deno.serve(async req=>{
 const reply=(status:number,body:any)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST'||!await authorized(req))return reply(401,{status:'unauthorized'});
 if(!config.enabled)return reply(503,{status:'disabled'});
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}}),lease=crypto.randomUUID();
 const {data:jobs,error}=await db.rpc('gerontik_claim_reminders',{p_lease:lease});if(error)return reply(503,{status:'claim_failed'});
 let processed=0;
 for(const job of jobs||[]){
  // Recheck opt-outs and changed WhatsApp destinations immediately before sending.
  const {data:contact,error:contactError}=job.owner_id?await db.from('gerontik_notification_contacts').select('*').eq('owner_id',job.owner_id).maybeSingle():{data:null,error:null};
  let result;if(contactError)result={status:'retry',code:'CONTACT_LOOKUP_FAILED'};
  else if(job.channel==='email'&&contact?.email_enabled===false)result={status:'blocked',code:'EMAIL_DISABLED_BY_STUDENT'};
  else if(job.channel==='whatsapp'&&(!contact?.whatsapp_opt_in||contact.whatsapp_phone!==job.recipient))result={status:'blocked',code:'WHATSAPP_OPT_IN_CHANGED'};
  else result=await engine.deliver(job,config);
  const {data:done,error:finishError}=await db.rpc('gerontik_finish_reminder',{p_id:job.id,p_lease:lease,p_status:result.status,p_provider:result.providerId||null,p_code:result.code||null});
  if(finishError||!done)return reply(503,{status:'acknowledgment_failed',processed});processed++;
 }
 return reply(200,{status:'success',processed});
});
