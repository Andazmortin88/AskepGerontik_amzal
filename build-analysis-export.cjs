const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=__dirname,e=()=>({value:'student',style:{},append(){},before(){},setAttribute(){},addEventListener(){},querySelectorAll(){return[]}}),ctx={document:{querySelector:e,querySelectorAll(){return[]},createElement:e,body:e()},window:{},console};
vm.runInNewContext(fs.readFileSync(path.join(root,'learning-v6-core.js'),'utf8'),ctx);
const schema=JSON.parse(vm.runInNewContext('JSON.stringify({demography:DEMO_FIELDS,instruments:Object.fromEntries(Object.entries(INSTRUMEN).map(([id,d])=>[id,{title:d.title,items:d.items.map(i=>({id:i.id,q:i.q,opt:i.opt,values:i.opt?.map(o=>o.v),min:i.min,max:i.max,type:i.type,unit:i.unit}))}]))})',ctx));
fs.writeFileSync(path.join(root,'analysis-schema.js'),'(function(root){const schema='+JSON.stringify(schema)+';if(typeof module==="object"&&module.exports)module.exports=schema;else root.GerontikAnalysisSchema=schema;})(globalThis);\n');
// Backend selects only these known demographic/instrument fields before returning data.
fs.writeFileSync(path.join(root,'backend/analysis-schema.ts'),'export const schema='+JSON.stringify(schema)+';\n');
console.log('Analysis dictionary generated from the preserved 17 instruments and 10 demographic fields.');
