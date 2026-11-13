(function(root,factory){
 const api=typeof module==='object'&&module.exports?factory(require('./completion.js').INSTRUMENT_SPEC,require('./h2t-schema.js')):factory(root.GerontikCompletion.INSTRUMENT_SPEC,root.GerontikH2TSchema);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.GerontikProgress=api;
})(globalThis,function(SPEC,SCHEMA){
 'use strict';
 const text=v=>typeof v==='string'&&v.trim().length>0;
 function answer(raw,item){if(!['number','string'].includes(typeof raw)||String(raw).trim()==='')return false;const n=Number(raw);return Number.isFinite(n)&&(item.values?item.values.includes(n):n>=item.min&&n<=item.max);}
 function weekProgress(state,week){
  if(![1,2].includes(Number(week)))throw Error('Minggu tidak valid');
  const c=state?.clinicalState||{},missing=[],flags=[],units=[];
  const check=(ok,label,page,extra={})=>{units.push(!!ok);if(!ok)missing.push({label,page,week:Number(week),...extra});};
  let instruments=0,answered=0,totalAnswers=0;
  for(const [id,spec]of Object.entries(SPEC)){let count=0;for(const item of spec.items){const ok=answer(c.instrumen?.[week]?.[id]?.[item.id],item);count+=+ok;answered+=+ok;totalAnswers++;check(ok,spec.title+' / '+item.id,'instruments',{instrument:id,field:item.id});}instruments+=+(count===spec.items.length);}
  const instrumentUnits=units.length,d=c.demografi?.[week]||{},a=c.asuhan?.[week]||{};
  for(const field of ['namaLansia','usia','jenisKelamin','tempatTinggal','riwayatPenyakit'])check(field==='usia'?answer(d[field],{min:1,max:130}):text(d[field]),'Data dasar: '+field,'demography',{field});
  for(const m of SCHEMA)for(const f of m.fields){const v=c.h2t?.[week]?.[m.id]?.[f.id]||{},exception=['Tidak dapat dinilai','Tidak relevan'].includes(v.status),ok=v.status==='Dikaji'?text(v.value):exception&&text(v.note);check(ok,m.title+': '+f.label,'assessment',{module:m.id,field:f.id});if(exception&&ok)flags.push({module:m.id,field:f.id,label:f.label,status:v.status});}
  for(const field of ['diagnosis','implementasi','evaluasi'])check(text(a[field]),'Askep: '+field,'careplan',{field});
  const analyses=Array.isArray(a.analisa)&&a.analisa.length?a.analisa:[{}];
  if(analyses.length>100)check(false,'Analisis melebihi 100 baris; tinjau isian','careplan');
  analyses.slice(0,100).forEach((row,index)=>{const r=row||{};for(const field of ['data','masalah','etiologi'])check(text(r[field]),'Analisis '+(index+1)+': '+field,'careplan',{index,field});});
  const plans=Array.isArray(a.rencana)&&a.rencana.length?a.rencana:[{}];
  if(plans.length>100)check(false,'Rencana melebihi 100 baris; tinjau isian','careplan');
  plans.slice(0,100).forEach((row,index)=>{const r=row||{};for(const field of ['diagnosis','tujuan','tindakan','rasional'])check(text(r[field]),'Rencana '+(index+1)+': '+field,'careplan',{index,field});for(const [field,manual]of [['slki','slkiManual'],['intervensi','sikiManual']])check(text(r[manual])||(Array.isArray(r[field])&&r[field].length>0&&r[field].every(x=>text(x?.kode)||text(x?.nama))),'Rencana '+(index+1)+': '+manual,'careplan',{index,field:manual});});
  const valid=units.filter(Boolean).length,askepUnits=units.slice(instrumentUnits),askepValid=askepUnits.filter(Boolean).length;
  // Floor prevents an incomplete document displaying 100% through rounding.
  return {week:Number(week),instruments,instrumentTotal:Object.keys(SPEC).length,answered,totalAnswers,valid,total:units.length,percent:Math.floor(valid/units.length*100),askepPercent:Math.floor(askepValid/askepUnits.length*100),complete:missing.length===0,missing,flags};
 }
 function portfolioMissing(state){const missing=[1,2].flatMap(w=>weekProgress(state,w).missing.map(x=>'Minggu '+w+': '+x.label));if(!Array.isArray(state?.logs)||state.logs.filter(r=>text(r?.summary)&&text(r?.reflection)).length<10)missing.push('Sepuluh catatan logbook lengkap');for(const w of [1,2])if(!Array.isArray(state?.reflections)||!state.reflections.some(r=>String(r?.week)===String(w)&&text(r?.text)&&text(r?.plan)))missing.push('Refleksi minggu '+w);return missing;}
 function weekSnapshot(state,week){const c=state?.clinicalState||{};return {week:Number(week),clinical:Object.fromEntries(['demografi','instrumen','instrumenRaw','h2t','asuhan'].map(k=>[k,c[k]?.[week]||{}])),skin:(Array.isArray(state?.skin)?state.skin:[]).filter(r=>Number(r?.week)===Number(week))};}
 return {weekProgress,portfolioMissing,weekSnapshot,answer};
});
