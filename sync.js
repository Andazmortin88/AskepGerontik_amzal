(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GerontikSync=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 class SyncDocument{
  constructor({key,storage,api,onStatus=()=>{},uuid=()=>crypto.randomUUID()}){Object.assign(this,{key,storage,api,onStatus,uuid});this.revision=0;this.state={};this.dirty=false;this.pending=null;this.running=null;this.closed=false;this.loaded=false;this.conflict=false;this.locked=false;this.edit=0;this.cache=null;try{this.cache=JSON.parse(storage.getItem(key));}catch{} }
  persist(){this.storage.setItem(this.key,JSON.stringify({revision:this.revision,state:this.state,dirty:this.dirty,pending:this.pending,pendingEdit:this.pendingEdit,edit:this.edit}));}
  async initialize(){
   const c=this.cache;
   if(c?.pending){try{const ack=await this.api('save',c.pending);if(this.closed)return;c.revision=ack.revision;c.pending=null;c.dirty=c.edit!==c.pendingEdit;this.storage.setItem(this.key,JSON.stringify(c));}catch(e){if(this.closed)return;if(e.status===409){this.conflict=true;this.localConflict=copy(c.state);this.onStatus('Antrean lokal bertentangan dengan versi server. Salinan lokal dipertahankan.');}else{this.onStatus('Pengiriman sebelumnya belum selesai. Muat ulang setelah koneksi pulih.');throw e;}}}
   const r=await this.api('load',{});if(this.closed)return;
   const doc=r.document;this.revision=doc?.revision||0;this.locked=doc?.status==='FINAL';this.state=copy(doc?.state||{});
   if(c?.dirty){if(c.revision===this.revision&&!this.locked){this.state=copy(c.state);this.dirty=true;this.edit=c.edit||1;}else{this.conflict=true;this.localConflict=copy(c.state);this.onStatus('Konflik versi: salinan lokal dipertahankan. Unduh salinan sebelum memilih versi server.');}}
   this.loaded=true;if(!this.conflict)this.persist();return r;
  }
  change(state){if(!this.loaded||this.closed||this.locked||this.conflict||this.pending?.finalize)throw new Error('Dokumen belum dapat diedit.');this.state=copy(state);this.dirty=true;this.edit++;this.persist();this.onStatus('Perubahan tersimpan di perangkat; menunggu server.');}
  async flush(finalize=false){
   if(this.closed||!this.loaded||this.conflict)throw new Error('Dokumen belum siap atau memiliki konflik.');
   if(this.running){await this.running;if(this.closed)return;if(this.dirty||finalize)return this.flush(finalize);return;}
   if(this.locked)return;if(!this.dirty&&!finalize&&!this.pending)return;
   this.running=this.run(finalize);try{return await this.running;}finally{this.running=null;}
  }
  async run(finalize){
   let needsFinal=finalize;do{
    if(!this.pending){this.pending={operationId:this.uuid(),expectedRevision:this.revision,state:copy(this.state),finalize};this.pendingEdit=this.edit;}
    this.persistPending();this.onStatus('Menyimpan ke server…');
    try{const ack=await this.api('save',this.pending);if(this.closed)return;
     this.revision=ack.revision;this.locked=ack.documentStatus==='FINAL';if(this.locked)needsFinal=false;this.dirty=this.edit!==this.pendingEdit;this.pending=null;this.persist();this.onStatus(this.dirty?'Ada perubahan berikutnya yang menunggu.':'Tersimpan di server · '+new Date(ack.updated_at||Date.now()).toLocaleTimeString('id-ID'));
    }catch(e){if(this.closed)return;if(e.status===409){this.conflict=true;this.localConflict=copy(this.state);this.onStatus('Konflik versi. Salinan lokal tetap tersedia.');}else this.onStatus('Belum tersimpan di server. Perubahan lokal dipertahankan.');throw e;}
   }while((this.dirty||needsFinal)&&!this.closed&&!this.locked);
  }
  persistPending(){this.storage.setItem(this.key,JSON.stringify({revision:this.revision,state:this.state,dirty:this.dirty,pending:this.pending,pendingEdit:this.pendingEdit,edit:this.edit}));}
  close(){this.closed=true;this.loaded=false;}
 }
 return {SyncDocument};
});
