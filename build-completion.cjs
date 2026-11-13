const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const root=__dirname;
// Read the preserved V6 definitions; legacy.html now redirects and has no schema.
const element=()=>({value:'student',style:{},append(){},before(){},setAttribute(){},addEventListener(){},querySelector:element,querySelectorAll(){return []}});
const context={document:{querySelector:element,createElement:element,body:element(),querySelectorAll(){return []}},window:{setTimeout,clearTimeout,scrollTo(){}},setTimeout,clearTimeout,Blob,URL,localStorage:{getItem(){throw Error('Build must not read user cache');}},console};
const schema=vm.runInNewContext(fs.readFileSync(path.join(root,'learning-v6-core.js'),'utf8')+';Object.fromEntries(Object.entries(INSTRUMEN).map(([k,v])=>[k,{title:v.title,items:v.items.map(x=>({id:x.id,values:x.opt?.map(y=>y.v),min:x.min,max:x.max,type:x.type}))}]))',context);
const logic=`const INSTRUMENT_SPEC=${JSON.stringify(schema)};
function finalMissing(state){return (typeof module==='object'&&module.exports?require('./progress.js'):root.GerontikProgress).portfolioMissing(state);}
`;
fs.writeFileSync(path.join(root,'backend/completion.ts'),"export {portfolioMissing as finalMissing} from './progress.ts';\n");fs.writeFileSync(path.join(root,'completion.js'),'(function(root){'+logic+';if(typeof module===\'object\'&&module.exports)module.exports={INSTRUMENT_SPEC,finalMissing};else root.GerontikCompletion={INSTRUMENT_SPEC,finalMissing};})(globalThis);');console.log('Completion rules generated from the 17 preserved instrument definitions.');
