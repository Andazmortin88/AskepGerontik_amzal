 'use strict';
 const DAY=86400000,WIB=7*3600000;
 function parse(start){if(typeof start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(start))throw Error('Pilih tanggal Senin mulai praktik.');const t=Date.parse(start+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==start||new Date(t).getUTCDay()!==1)throw Error('Tanggal mulai praktik harus hari Senin.');return t;}
 function deadlines(schedule){if(!schedule?.enabled||!schedule.start_date)return [null,null];const t=parse(schedule.start_date);return [1,2].map(w=>new Date(t+(w===1?5:12)*DAY-WIB-1).toISOString());}
 function activity(row,now=Date.now()){
  const schedule=row.schedule;if(!schedule?.enabled||!schedule.start_date)return {active:false,inactive:false,days:0};
  const start=parse(schedule.start_date),today=Math.floor((now+WIB)/DAY)*DAY;
  if(today<start)return {active:false,inactive:false,days:0};
  if(Array.isArray(row.weeks)&&row.weeks.length&&row.weeks.every(w=>['submitted','approved'].includes(w.submission?.status)))return {active:true,inactive:false,days:0};
  const last=Date.parse(row.updatedAt),lastDay=Number.isFinite(last)?Math.floor((last+WIB)/DAY)*DAY:null;
  const begin=lastDay!==null&&lastDay>=start?lastDay+DAY:start,end=Math.min(today,start+12*DAY);let days=0;
  for(let t=begin;t<end;t+=DAY){const d=new Date(t).getUTCDay();if(d>=1&&d<=5)days++;}
  const threshold=Number(schedule.inactive_days)||3;return {active:true,inactive:days>=threshold,days,threshold};
 }
 function matches(row,filter='all',now=Date.now()){
  if(filter==='not_started')return row.weeks.every(w=>w.valid===0);
  if(filter==='inactive')return activity(row,now).inactive;
  if(filter==='late')return row.weeks.some(w=>w.submission?.is_late===true);
  if(filter==='overdue')return row.weeks.some((w,i)=>{const due=deadlines(row.schedule)[i];return due&&now>Date.parse(due)&&(!w.submission||w.submission.status==='revision_requested');});
  return true;
 }
 function deadlineLabel(value){return value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'full',timeStyle:'short'})+' WIB':'Jadwal belum ditetapkan';}

export {deadlines,activity,matches,deadlineLabel};