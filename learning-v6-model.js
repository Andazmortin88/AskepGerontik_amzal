(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GerontikV6Model=factory();})(globalThis,()=>{
 const copy=x=>JSON.parse(JSON.stringify(x));
 function normalize(input={},roster={}){const state=copy(input);for(const key of ['logs','attendance','reflections','skin','competency'])if(!Array.isArray(state[key]))state[key]=[];
  const c=state.clinicalState||={};c.mahasiswa={...(c.mahasiswa||{}),nama:roster.name||c.mahasiswa?.nama||'',nim:roster.nim||c.mahasiswa?.nim||'',status:roster.program||c.mahasiswa?.status||'',kelas:roster.group_name||c.mahasiswa?.kelas||''};
  for(const key of ['demografi','instrumen','instrumenRaw','asuhan','h2t']){c[key]||={};for(const week of [1,2])c[key][week]||={};}
  const describe=items=>(items||[]).map(item=>typeof item==='string'?item:[item.kode,item.nama,item.ekspektasi].filter(Boolean).join(' - ')).join('\n');
  for(const week of [1,2])for(const plan of c.asuhan[week].rencana||[]){if(plan.slkiManual===undefined&&plan.slki?.length)plan.slkiManual=describe(plan.slki);if(plan.sikiManual===undefined&&plan.intervensi?.length)plan.sikiManual=describe(plan.intervensi);}
  state.learningVersion=6;state.v6Migration||={legacyPhysical:{}};state.v6Migration.legacyPhysical||={};
  for(const w of [1,2])if(!Object.keys(c.h2t[w]).length&&c.asuhan[w].fisik&&!state.v6Migration.legacyPhysical[w])state.v6Migration.legacyPhysical[w]=c.asuhan[w].fisik;
  return state;
 }
 function mergeNarrative(state,week,generated){const legacy=state.v6Migration?.legacyPhysical?.[week]||'';return [legacy,generated].filter(Boolean).join('\n\n--- Pengkajian terstruktur V6 ---\n\n');}
 function applyReviews(state,reviews=[]){const result=copy(state);for(const key of ['logs','attendance','reflections','competency'])for(const record of result[key]||[]){const rows=reviews.filter(r=>r.detail?.key===key&&r.competency_id===record.id);record.reviews=rows.map(r=>({...r.detail,method:r.detail?.method||record.method,status:r.status,decision:r.status,comment:r.comment,examiner:r.reviewer_name,at:r.created_at,current_valid:r.current_valid}));const current=rows.filter(r=>r.current_valid).at(-1);if(current){record.status=current.status;if(current.detail?.outcome)record.outcome=current.detail.outcome;}}
  return result;
 }
 function saveState(state){const result=copy(state);for(const key of ['logs','attendance','reflections','competency'])for(const record of result[key]||[]){delete record.reviews;delete record.outcome;if(['Terverifikasi','Perlu revisi'].includes(record.status))record.status='Diajukan';}return result;}
 return {normalize,mergeNarrative,applyReviews,saveState};
});
