const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const portal=fs.readFileSync(path.join(__dirname,'../portal.js'),'utf8');
test('lecturer record rendering includes entered location, activity, times and reflection',()=>{
 const source=portal.slice(portal.indexOf('function renderRecords('),portal.indexOf('function reviewForm('));
 const context={recordStatus:()=> 'Diajukan',badge:x=>x,esc:x=>String(x??''),teacher:()=>false,sync:null};vm.createContext(context);vm.runInContext(source,context);
 const html=context.renderRecords('attendance',{attendance:[{id:'a',date:'2026-11-12',room:'Wisma UJI',presence:'Hadir',start:'07:00',end:'14:00',shift:'Pagi',note:'Catatan UJI'}]},[],true);
 for(const expected of ['Wisma UJI','07:00','14:00','Pagi','Catatan UJI'])assert.ok(html.includes(expected),expected);
});
test('clearing physical, diagnosis and implementation fields removes their previous values',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../clinical.html'),'utf8');const start=html.lastIndexOf('function captureCurrentFormsToState('),end=html.indexOf('let autosaveInstalled',start);
 const context={AppSession:{isFinal:false},State:{weekDemo:1,weekAsuhan:1,demografi:{1:{}},asuhan:{1:{fisik:'old',diagnosis:'old',implementasi:'old'}}},document:{querySelectorAll:()=>[],getElementById:()=>({value:''})},saveState(){},saveStateFinalLocalOnly(){}};vm.createContext(context);vm.runInContext(html.slice(start,end),context);context.captureCurrentFormsToState(false);
 for(const key of ['fisik','diagnosis','implementasi'])assert.equal(context.State.asuhan[1][key],'');
});
test('clinical capture timeout reports failure instead of acknowledging unsaved input',async()=>{
 const source=portal.slice(portal.indexOf('async function captureClinical('),portal.indexOf("\nwindow.addEventListener('message'",portal.indexOf('async function captureClinical(')));
 let timeout,removed=0;const context={$:()=>({contentWindow:{postMessage(){}}}),sync:{locked:false},location:{origin:'https://example.test'},window:{addEventListener(){},removeEventListener(){removed++;}},setTimeout:f=>(timeout=f,1),clearTimeout(){}};
 vm.createContext(context);vm.runInContext(source,context);const pending=context.captureClinical();timeout();await assert.rejects(pending,/Formulir belum merespons/);assert.equal(removed,1);
});
test('out-of-range TUG measurement is rejected rather than silently changed to 180 seconds',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../clinical.html'),'utf8'),start=html.indexOf('window.pilihNilaiNumerik ='),end=html.indexOf('function formatInstrumentDisplayScore',start);let saves=0,message='';
 const context={window:{},State:{weekInst:1,instrumen:{1:{tug:{t1:15}}},instrumenRaw:{1:{tug:{}}}},INSTRUMEN:{tug:{items:[{id:'t1',min:1,max:180,unit:'detik'}]}},activeInst:'tug',saveState:()=>saves++,renderActiveInstrumen(){},toast:s=>message=s};vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 context.window.pilihNilaiNumerik('t1','250');assert.equal(context.State.instrumen[1].tug.t1,15);assert.equal(saves,0);assert.match(message,/belum disimpan/);
 context.window.pilihNilaiNumerik('t1','17.5');assert.equal(context.State.instrumen[1].tug.t1,17.5);assert.equal(saves,1);
});
test('read-only protections are reapplied when lecturer changes clinical week or instrument',()=>{
 const bridge=fs.readFileSync(path.join(__dirname,'../clinical-bridge.js'),'utf8'),start=bridge.indexOf('const protectRender='),end=bridge.indexOf('const emit=',start);let protectedCount=0;const button={tagName:'BUTTON',disabled:false},chip={tagName:'SPAN',style:{}};
 const context={initialized:true,locked:true,renderDemografi(){},renderAsuhan(){},renderActiveInstrumen(){},enableReadOnlyMode:()=>protectedCount++,document:{querySelectorAll:()=>[button,chip]}};vm.createContext(context);vm.runInContext(bridge.slice(start,end),context);
 context.renderDemografi();context.renderAsuhan();context.renderActiveInstrumen();assert.equal(protectedCount,3);assert.equal(button.disabled,true);assert.equal(chip.style.pointerEvents,'none');
});
