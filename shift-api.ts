import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'Access-Control-Allow-Origin':'https://andazmortin88.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({status:'error',message:'Metode tidak didukung.'},405);try{
 if(Number(req.headers.get('content-length')||0)>16384)return reply({status:'error',message:'Permintaan terlalu besar.'},413);
 const data=await req.json();if(typeof data.token!=='string'||data.token.length>256||typeof data.action!=='string'||JSON.stringify(data.payload||{}).length>8192)return reply({status:'error',message:'Permintaan tidak valid.'},400);
 const {data:result,error}=await db.rpc('gerontik_shift_api',{p_token:data.token,p_action:data.action,p_data:data.payload||{}});
 if(error){console.error('Shift RPC failed',error.code);return reply({status:'error',message:'Layanan jadwal mengalami kendala. Coba kembali.'},500)}
 return reply(result,result?.status==='auth_required'?401:result?.status==='error'?400:200);
 }catch{return reply({status:'error',message:'Permintaan tidak dapat diproses.'},400)}});
