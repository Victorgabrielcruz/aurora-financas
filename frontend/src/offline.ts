import {OfflineStore,OfflineUser,PendingExpense,ownerKey} from './offline-store';
export type OfflineState={connected:boolean,syncing:boolean,preparing:boolean,pending:number,blocked:number,preparedAt:number|null,storageError:string|null};
const INITIAL:OfflineState={connected:true,syncing:false,preparing:false,pending:0,blocked:0,preparedAt:null,storageError:null};
class HttpError extends Error{constructor(message:string,public status:number,public code?:string){super(message);}}
class ConnectionError extends Error{}
const canQueue=(path:string,method:string,body:any)=>method==='POST'&&(path==='/transactions'&&body?.type==='EXPENSE'||/^\/cards\/[^/]+\/purchases$/.test(path));
const unavailable=(error:unknown)=>error instanceof ConnectionError||error instanceof HttpError&&error.status>=500;
export class OfflineClient{
 private profile:OfflineUser|null=null;
 private listeners=new Set<()=>void>();
 private state:OfflineState={...INITIAL};
 private running?:Promise<void>;
 private warming?:Promise<void>;
 constructor(public store=new OfflineStore(),private fetcher:typeof fetch=(...args)=>fetch(...args),private online=()=>typeof navigator==='undefined'||navigator.onLine,private emit:(name:string)=>void=name=>{if(typeof window!=='undefined')window.dispatchEvent(new Event(name));}){}
 subscribe=(callback:()=>void)=>{this.listeners.add(callback);return ()=>{this.listeners.delete(callback);};};
 getSnapshot=()=>this.state;
 private update(patch:Partial<OfflineState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private async local<T>(action:()=>Promise<T>):Promise<T|undefined>{try{return await action();}catch(error){this.update({storageError:(error as Error).message});return undefined;}}
 private async active(){if(!this.profile)this.profile=await this.local(()=>this.store.meta<OfflineUser>('active'))??null;return this.profile;}
 private valid(user:OfflineUser|null):user is OfflineUser{return !!user&&Date.parse(user.offlineUntil)>Date.now();}
 private async remember(user:any){
  if(!user?.id||!user.tenantId)return;
  const previous=this.profile?ownerKey(this.profile):null;
  this.profile={id:user.id,name:user.name,email:user.email,theme:user.theme,tenantId:user.tenantId,tenant:user.tenant,offlineUntil:user.offlineUntil};
  await this.local(()=>this.store.setMeta('active',this.profile));await this.refreshStatus();if(previous!==ownerKey(this.profile))this.emit('aurora:identity-changed');
 }
 private async requireLogin(){const previous=this.profile;this.profile=null;await this.local(()=>this.store.deleteMeta('active'));this.update({pending:0,blocked:0,preparedAt:null});this.emit('aurora:unauthorized');if(previous)this.emit('aurora:identity-changed');}
 private async send(path:string,method='GET',body?:unknown,user?:OfflineUser|null,key?:string){
  if(!this.online())throw new ConnectionError('Sem conexão.');
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);let response:Response;
  try{response=await this.fetcher('/api'+path,{method,credentials:'same-origin',signal:abort.signal,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(user?{'X-Aurora-Tenant':user.tenantId,'X-Aurora-User':user.id}:{}),...(key?{'X-Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new ConnectionError('Servidor indisponível.');}finally{clearTimeout(timer);}
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new HttpError(result?.error?.message??'Não foi possível concluir.',response.status,result?.error?.code);
  if(!result)throw new ConnectionError('Resposta inválida do servidor.');
  const restored=!this.state.connected;this.update({connected:true});if(restored)this.emit('aurora:connection-restored');return result;
 }
 private async finishLogout(){if(!await this.local(()=>this.store.meta<boolean>('logoutPending')))return true;try{await this.send('/auth/logout','POST');await this.store.deleteMeta('logoutPending');return true;}catch{this.update({connected:false});return false;}}
 async request(path:string,method='GET',body?:any,tenantId?:string):Promise<any>{
  if(path==='/auth/logout'){
   this.profile=null;await this.store.setMeta('logoutPending',true);await this.store.deleteMeta('active');this.update({pending:0,blocked:0,preparedAt:null});this.emit('aurora:identity-changed');await this.finishLogout();return {data:true};
  }
  if(path.startsWith('/auth/')){
   if(!await this.finishLogout())throw new Error('Conecte-se ao servidor para entrar em uma conta.');
   const result=await this.send(path,method,body);if(result.data?.id)await this.remember(result.data);return result;
  }
  if(path==='/me'&&method==='GET'){
   if(!await this.finishLogout())return {data:null};
   const user=await this.active();
   try{const result=await this.send(path,'GET',undefined,user);await this.remember(result.data);return result;}
   catch(error){if(unavailable(error)){this.update({connected:false});if(this.valid(user)){await this.refreshStatus();return {data:user,offline:true};}return {data:null};}if(error instanceof HttpError&&error.status===401){await this.requireLogin();return {data:null};}throw error;}
  }
  const user=await this.active();
  if(!this.valid(user)){await this.requireLogin();throw new Error('Entre novamente com internet para renovar seu acesso. As pendências continuam guardadas neste aparelho.');}
  if(tenantId&&tenantId!==user.tenantId)throw new Error('A sessão mudou. Entre novamente.');
  if(method==='GET'){
   try{if(!this.state.connected)throw new ConnectionError('Servidor indisponível.');const result=await this.send(path,method,body,user);await this.local(()=>this.store.cache(ownerKey(user),path,result));return result;}
   catch(error){
    if(error instanceof HttpError&&error.status===401){await this.requireLogin();throw error;}
    if(!unavailable(error))throw error;
    this.update({connected:false});const cached=await this.offlineRead(user,path);if(cached)return {...cached,offline:true};
    throw new Error('Esta consulta ainda não foi baixada para este aparelho. Abra-a com internet ou use Atualizar dados offline nas configurações.');
   }
  }
  if(canQueue(path,method,body)){
   const expense:PendingExpense={id:crypto.randomUUID(),owner:ownerKey(user),userId:user.id,tenantId:user.tenantId,path,body:structuredClone(body),createdAt:Date.now(),state:'pending'};
   // Commit locally before sending: a lost response is retried with this same ID.
   await this.store.enqueue(expense);await this.refreshStatus();this.emit('aurora:outbox-changed');
   if(!this.state.connected)return {data:{...body,id:expense.id},offlineQueued:true};
   try{const result=await this.send(path,method,body,user,expense.id);await this.local(()=>this.accept(expense,result));return result;}
   catch(error){
    if(error instanceof HttpError&&error.status===401){await this.requireLogin();throw new Error('Sua sessão precisa ser renovada. A despesa foi preservada para sincronizar após entrar novamente.');}
    if(unavailable(error)||error instanceof HttpError&&error.code==='CONCURRENT_WRITE'){this.update({connected:!unavailable(error)});return {data:{...body,id:expense.id},offlineQueued:true};}
    await this.store.remove(expense.id);await this.refreshStatus();throw error;
   }
  }
  try{return await this.send(path,method,body,user);}catch(error){if(error instanceof HttpError&&error.status===401)await this.requireLogin();if(unavailable(error)){this.update({connected:false});throw new Error('Esta ação exige conexão. Offline, você pode consultar dados baixados e cadastrar despesas na conta ou no cartão.');}throw error;}
 }
 private async offlineRead(user:OfflineUser,path:string){
  const owner=ownerKey(user);
  if(path.split('?')[0]==='/transactions'){
   const all=await this.local(()=>this.store.cached(owner,'/__transactions'));
   if(all?.data&&all.data.complete!==false){const q=new URLSearchParams(path.split('?')[1]);let rows=all.data.rows as any[];
    rows=rows.filter(t=>(!q.get('search')||t.description.includes(q.get('search')))&&(!q.get('type')||t.type===q.get('type'))&&(!q.get('accountId')||!t.cardId&&t.accountId===q.get('accountId'))&&(!q.get('categoryId')||t.categoryId===q.get('categoryId'))&&(!q.get('status')||t.status===q.get('status'))&&(!q.get('from')||t.date>=q.get('from')!)&&(!q.get('to')||t.date<=q.get('to')!)&&(!q.has('min')||t.amount>=Number(q.get('min')))&&(!q.has('max')||t.amount<=Number(q.get('max'))));
    const page=Math.max(1,Number(q.get('page')??1)),limit=Math.min(100,Math.max(1,Number(q.get('limit')??20)));return {data:rows.slice((page-1)*limit,page*limit),meta:{page,limit,total:rows.length}};
   }
  }
  return (await this.local(()=>this.store.cached(owner,path)))?.data;
 }
 private async accept(expense:PendingExpense,result:any){
  // Retain an acknowledged row locally before removing its durable outbox entry.
  const all=await this.store.cached(expense.owner,'/__transactions');
  {const accounts=(await this.store.cached(expense.owner,'/accounts'))?.data?.data??[];const categories=(await this.store.cached(expense.owner,'/categories'))?.data?.data??[];const cards=(await this.store.cached(expense.owner,'/cards'))?.data?.data??[];const cardId=expense.path.match(/^\/cards\/([^/]+)\/purchases$/)?.[1];
   const row={...expense.body,...result.data,...(cardId?{type:'CREDIT_CARD',status:'CONFIRMED',cardId,account:{name:cards.find((c:any)=>c.id===cardId)?.name??'Cartão'},installments:[],totalInstallments:expense.body.installments,paidInstallments:expense.body.paidInstallments??0}:{account:accounts.find((a:any)=>a.id===expense.body.accountId)}),category:categories.find((c:any)=>c.id===expense.body.categoryId),_offlineAcceptedAt:Date.now()};
   const rows=[row,...(all?.data?.rows??[]).filter((r:any)=>r.id!==row.id)].sort((a,b)=>b.date.localeCompare(a.date));await this.store.cache(expense.owner,'/__transactions',{rows,complete:all?.data?.complete??false});
  }
  await this.store.remove(expense.id);await this.refreshStatus();this.emit('aurora:synced');this.emit('aurora:outbox-changed');
 }
 async refreshStatus(){const user=await this.active();if(!user)return;const rows=await this.local(()=>this.store.pending(ownerKey(user)))??[];const preparedAt=await this.local(()=>this.store.meta<number>('prepared:'+ownerKey(user)))??null;this.update({pending:rows.filter(row=>row.state==='pending').length,blocked:rows.filter(row=>row.state==='blocked').length,preparedAt});}
 async pending(){const user=await this.active();return user?this.store.pending(ownerKey(user)):[];}
 private async verify(user:OfflineUser){const result=await this.send('/me','GET',undefined,user);if(result.data.id!==user.id||result.data.tenantId!==user.tenantId){await this.requireLogin();throw new HttpError('A sessão mudou. Entre novamente.',401);}await this.remember(result.data);}
 async sync(){
  if(this.running)return this.running;
  const run=async()=>{const user=await this.active();if(!this.valid(user)||!this.online())return;const rows=await this.local(()=>this.store.pending(ownerKey(user)))??[];if(!rows.some(row=>row.state==='pending'))return;
   this.update({syncing:true});let changed=false;
   try{await this.verify(user);for(const row of rows.filter(r=>r.state==='pending')){
    try{const result=await this.send(row.path,'POST',row.body,user,row.id);await this.accept(row,result);changed=true;}
    catch(error){if(error instanceof HttpError&&error.status===401){await this.requireLogin();break;}if(unavailable(error)||error instanceof HttpError&&error.code==='CONCURRENT_WRITE'){this.update({connected:!unavailable(error)});break;}if(!(error instanceof HttpError))throw error;await this.store.enqueue({...row,state:'blocked',error:error.message});}
   }}catch(error){if(error instanceof HttpError&&error.status===401)await this.requireLogin();else if(unavailable(error))this.update({connected:false});else this.update({storageError:(error as Error).message});}
   finally{this.update({syncing:false});await this.refreshStatus();}
   if(changed)await this.prepare();
  };
  this.running=(async()=>{if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request('aurora-offline-sync',{ifAvailable:true},async lock=>{if(lock)await run();});else await run();})().catch(error=>this.update({storageError:(error as Error).message})).finally(()=>{this.running=undefined;});return this.running;
 }
 forgetMemory(){this.profile=null;}
 markDisconnected(){this.update({connected:false});}
 async retry(id:string){const rows=await this.pending();const row=rows.find(r=>r.id===id);if(!row)throw new Error('Pendência não encontrada.');await this.store.enqueue({...row,state:'pending',error:undefined});await this.refreshStatus();await this.sync();}
 async discard(id:string){const row=(await this.pending()).find(r=>r.id===id);if(!row)return;const remove=async()=>{await this.store.remove(id);await this.refreshStatus();this.emit('aurora:outbox-changed');};if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request('aurora-offline-sync',{ifAvailable:true},async lock=>{if(!lock)throw new Error('Aguarde a sincronização terminar antes de descartar.');await remove();});else await remove();}
 async prepare(){
  if(this.warming)return this.warming;
  this.warming=(async()=>{const user=await this.active();if(!this.valid(user)||!this.online())return;const started=Date.now();this.update({preparing:true});
   try{
    await this.verify(user);const month=new Date().toISOString().slice(0,7);const owner=ownerKey(user);
    const get=async(path:string)=>{const result=await this.send(path,'GET',undefined,user);await this.store.cache(owner,path,result);return result.data;};
    const [accounts,categories,cards,investments]=await Promise.all(['/accounts','/categories','/cards','/investments'].map(get));
    void accounts;void categories;
    const first=await this.send('/transactions?limit=100&page=1','GET',undefined,user);const rows=[...first.data];
    for(let page=2;rows.length<first.meta.total;page++){const next=await this.send(`/transactions?limit=100&page=${page}`,'GET',undefined,user);if(!next.data.length)break;rows.push(...next.data);}
    const tasks=[()=>get('/dashboard?month='+month),()=>get(`/reports?from=${month}&to=${month}`),()=>get(`/reports/items?from=${month}&to=${month}`),...cards.map((card:any)=>async()=>{await get('/cards/'+card.id);for(const invoice of card.invoices)await get('/invoices/'+invoice.id);}),...investments.map((investment:any)=>()=>get('/investments/'+investment.id))];
    const workers=Array.from({length:Math.min(3,tasks.length)},async()=>{while(tasks.length){const task=tasks.shift();if(task)await task();}});await Promise.all(workers);
    const accepted=(await this.store.cached(owner,'/__transactions'))?.data?.rows?.filter((r:any)=>r._offlineAcceptedAt>=started)??[];const merged=[...new Map([...rows,...accepted].map((row:any)=>[row.id,row])).values()].sort((a:any,b:any)=>b.date.localeCompare(a.date));if(merged.length<first.meta.total)throw new Error('O histórico mudou durante o download. Atualize novamente.');await this.store.cache(owner,'/__transactions',{rows:merged,complete:true});await this.store.setMeta('prepared:'+owner,Date.now());await this.refreshStatus();this.update({storageError:null});
   }catch(error){if(error instanceof HttpError&&error.status===401)await this.requireLogin();else if(unavailable(error))this.update({connected:false});else this.update({storageError:'Não foi possível preparar todos os dados offline. Tente novamente nas configurações.'});}
   finally{this.update({preparing:false});}
  })().finally(()=>{this.warming=undefined;});return this.warming;
 }
}
export const offlineClient=new OfflineClient();
