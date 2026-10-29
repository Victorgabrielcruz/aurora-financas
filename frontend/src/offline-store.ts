export type OfflineUser={id:string,name:string,email:string,theme:string,tenantId:string,tenant:{id:string,name:string},offlineUntil:string};
export type PendingExpense={id:string,owner:string,userId:string,tenantId:string,path:string,body:any,createdAt:number,state:'pending'|'blocked',error?:string};
export const ownerKey=(user:OfflineUser)=>`${user.id}:${user.tenantId}`;
export const canonicalPath=(path:string)=>{const [base,search='']=path.split('?');const params=new URLSearchParams(search);params.sort();return base+(params.size?'?'+params:'');};
export class OfflineStore{
 private database?:Promise<IDBDatabase>;
 constructor(private name='aurora-offline-v1',private factory?:IDBFactory){}
 private open(){
  if(!this.database)this.database=new Promise<IDBDatabase>((resolve,reject)=>{
   const factory=this.factory??globalThis.indexedDB;if(!factory){reject(new Error('O armazenamento offline não está disponível neste navegador.'));return;}
   const request=factory.open(this.name,1);
   request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('meta');db.createObjectStore('responses',{keyPath:'key'}).createIndex('owner','owner');db.createObjectStore('outbox',{keyPath:'id'}).createIndex('owner','owner');};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=undefined;};resolve(db);};
   request.onerror=()=>{this.database=undefined;reject(request.error);};request.onblocked=()=>reject(new Error('Feche outras abas do Aurora para atualizar o armazenamento offline.'));
  });return this.database;
 }
 private async operation<T>(name:string,mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await this.open();return new Promise<T>((resolve,reject)=>{const transaction=db.transaction(name,mode);const request=action(transaction.objectStore(name));let result:T;request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error??request.error);transaction.onabort=()=>reject(transaction.error??new Error('Não foi possível salvar os dados neste aparelho.'));});
 }
 async meta<T>(key:string){return this.operation<T|undefined>('meta','readonly',s=>s.get(key));}
 async setMeta(key:string,value:unknown){await this.operation('meta','readwrite',s=>s.put(value,key));}
 async deleteMeta(key:string){await this.operation('meta','readwrite',s=>s.delete(key));}
 async cached(owner:string,path:string){return this.operation<{data:any,savedAt:number}|undefined>('responses','readonly',s=>s.get(owner+'|'+canonicalPath(path)));}
 async cache(owner:string,path:string,data:any){await this.operation('responses','readwrite',s=>s.put({key:owner+'|'+canonicalPath(path),owner,path:canonicalPath(path),data,savedAt:Date.now()}));}
 async enqueue(expense:PendingExpense){await this.operation('outbox','readwrite',s=>s.put(expense));}
 async pending(owner:string){const rows=await this.operation<PendingExpense[]>('outbox','readonly',s=>s.index('owner').getAll(owner));return rows.sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));}
 async remove(id:string){await this.operation('outbox','readwrite',s=>s.delete(id));}
 async close(){if(this.database)(await this.database).close();this.database=undefined;}
}
