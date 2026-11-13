const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const root=__dirname;
const html=fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'legacy.html'))?'legacy.html':'index.html'),'utf8');const constants=html.slice(html.indexOf('        const OPT_YN'),html.indexOf('        const SDKI_DATABASE'));
const schema=vm.runInNewContext(constants+';Object.fromEntries(Object.entries(INSTRUMEN).map(([k,v])=>[k,{title:v.title,items:v.items.map(x=>({id:x.id,values:x.opt?.map(y=>y.v),min:x.min,max:x.max,type:x.type}))}]))');
const logic=`const INSTRUMENT_SPEC=${JSON.stringify(schema)};
function finalMissing(state){
 const missing=[],c=state?.clinicalState||{},text=v=>typeof v==='string'&&v.trim().length>0;
 for(const week of [1,2]){
  const d=c.demografi?.[week]||{},a=c.asuhan?.[week]||{};
  for(const key of ['namaLansia','usia','jenisKelamin','tempatTinggal','riwayatPenyakit'])if(!text(String(d[key]??'')))missing.push('Minggu '+week+': data dasar '+key);
  for(const [key,def]of Object.entries(INSTRUMENT_SPEC)){
   const answers=c.instrumen?.[week]?.[key]||{};
   if(def.items.some(item=>{const raw=answers[item.id];if(raw===null||raw===undefined||String(raw).trim()===''||typeof raw==='boolean')return true;const value=Number(raw);return !Number.isFinite(value)||(item.values?!item.values.includes(value):value<item.min||value>item.max);}))missing.push('Minggu '+week+': '+def.title);
  }
  for(const [key,label]of [['fisik','pemeriksaan fisik'],['diagnosis','diagnosis keperawatan'],['implementasi','implementasi']])if(!text(a[key]))missing.push('Minggu '+week+': '+label);
  if(!Array.isArray(a.analisa)||!a.analisa.some(r=>text(r.data)&&text(r.masalah)))missing.push('Minggu '+week+': analisis data');
  if(!Array.isArray(a.rencana)||!a.rencana.some(r=>text(r.diagnosis)&&(text(r.tujuan)||text(r.slkiManual)||Array.isArray(r.slki)&&r.slki.length)&&(text(r.sikiManual)||Array.isArray(r.intervensi)&&r.intervensi.length)))missing.push('Minggu '+week+': rencana asuhan');
 }
 if(!Array.isArray(state?.logs)||state.logs.filter(r=>text(r.summary)&&text(r.reflection)).length<10)missing.push('Sepuluh catatan logbook lengkap');
 for(const week of [1,2])if(!Array.isArray(state?.reflections)||!state.reflections.some(r=>String(r.week)===String(week)&&text(r.text)&&text(r.plan)))missing.push('Refleksi minggu '+week);
 return missing;
}`;
fs.writeFileSync(path.join(root,'backend/completion.ts'),logic+'\nexport {INSTRUMENT_SPEC,finalMissing};\n');fs.writeFileSync(path.join(root,'completion.js'),'(function(root){'+logic+';if(typeof module===\'object\'&&module.exports)module.exports={INSTRUMENT_SPEC,finalMissing};else root.GerontikCompletion={INSTRUMENT_SPEC,finalMissing};})(globalThis);');console.log('Completion rules generated from the 17 preserved instrument definitions.');
