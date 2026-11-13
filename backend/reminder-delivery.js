(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GerontikDelivery=api;})(globalThis,()=>{
 'use strict';
 function phone(value){let s=String(value||'').replace(/[\s()-]/g,'');if(s.startsWith('08'))s='+62'+s.slice(1);else if(s.startsWith('62'))s='+'+s;return /^\+[1-9]\d{7,14}$/.test(s)?s:'';}
 function configured(config,channel){return channel==='email'?!!(config.emailKey&&config.emailFrom):!!(config.waToken&&/^\d+$/.test(config.waPhoneId||'')&&/^[a-z0-9_]+$/.test(config.waTemplate||'')&&/^v\d+\.\d+$/.test(config.waVersion||''));}
 async function deliver(job,config,fetcher=fetch){
  if(config.enabled!==true)return {status:'blocked',code:'DELIVERY_DISABLED'};
  if(!['email','whatsapp'].includes(job.channel)||!configured(config,job.channel))return {status:'blocked',code:'PROVIDER_NOT_CONFIGURED'};
  if(job.channel==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.recipient))return {status:'blocked',code:'EMAIL_MISSING'};
  if(job.channel==='whatsapp'&&!phone(job.recipient))return {status:'blocked',code:'WHATSAPP_CONTACT_MISSING'};
  if(job.attempts>1&&Date.now()-Date.parse(job.first_attempt_at)>23*3600000)return {status:'unknown',code:'RETRY_WINDOW_EXPIRED'};
  let url,body,headers={'Content-Type':'application/json'};
  if(job.channel==='email'){
   url='https://api.resend.com/emails';headers.Authorization='Bearer '+config.emailKey;headers['Idempotency-Key']='gerontik-reminder/'+job.id;
   body={from:config.emailFrom,to:[job.recipient],subject:'Pengingat Askep Gerontik — Minggu '+job.week,text:'Halo '+job.student_name+',\n\n'+job.message+'\n\nMinggu praktik: '+job.week+'\nBuka aplikasi: https://andazmortin88.github.io/AskepGerontik_amzal/portal.html\n\nPengingat dari dosen pembimbing. Pengaturan notifikasi tersedia di akun mahasiswa.'};
  }else{
   url='https://graph.facebook.com/'+config.waVersion+'/'+config.waPhoneId+'/messages';headers.Authorization='Bearer '+config.waToken;
   body={messaging_product:'whatsapp',to:phone(job.recipient).slice(1),type:'template',biz_opaque_callback_data:job.id,template:{name:config.waTemplate,language:{code:config.waLanguage||'id'},components:[{type:'body',parameters:[job.student_name,String(job.week),job.message].map(text=>({type:'text',text}))}]}};
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetcher(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal});
   let result;try{result=await response.json();}catch{return {status:job.channel==='email'?'retry':'unknown',code:'UNREADABLE_PROVIDER_RESPONSE'};}
   if(!response.ok){const retry=response.status===429||response.status>=500;return {status:retry?'retry':'failed',code:'PROVIDER_HTTP_'+response.status};}
   const id=job.channel==='email'?result.id:result.messages?.[0]?.id;
   return typeof id==='string'&&id?{status:'accepted',providerId:id}:{status:job.channel==='email'?'retry':'unknown',code:'PROVIDER_ACK_MISSING'};
  }catch{return {status:job.channel==='email'?'retry':'unknown',code:'PROVIDER_OUTCOME_UNCERTAIN'};}finally{clearTimeout(timer);}
 }
 return {phone,configured,deliver};
});
