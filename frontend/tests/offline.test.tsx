import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {OfflineStore,ownerKey} from '../src/offline-store';
import {OfflineClient} from '../src/offline';
const user={id:'user-a',name:'Pessoa A',email:'a@local',theme:'light',tenantId:'tenant-a',tenant:{id:'tenant-a',name:'Finanças A'},offlineUntil:new Date(Date.now()+86400000).toISOString()};
const body={description:'Mercado offline',amount:10000,type:'EXPENSE',accountId:'account',categoryId:'category',date:'2026-10-29',status:'CONFIRMED',items:[{name:'Arroz',amount:3000}]};
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function setup(){
 const factory=new IDBFactory();const store=new OfflineStore('test-'+crypto.randomUUID(),factory);let available=true,loseResponse=false,rejectWrite=false,unauthorized=false;let writes=0;const receipts=new Map<string,any>();const events:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  if(!available)throw new TypeError('Offline');const path=String(input).replace('/api','');
  if(path==='/auth/logout')return json({data:true});
  if(unauthorized)return json({error:{message:'Entre novamente.'}},401);
  if(path==='/me'||path==='/auth/login')return json({data:user});
  if(init?.method==='POST'){
   if(rejectWrite)return json({error:{message:'Conta arquivada.'}},400);
   const key=(init.headers as any)['X-Idempotency-Key'];let result=receipts.get(key);
   if(!result){writes++;result={data:{...JSON.parse(init.body as string),id:'server-'+writes}};receipts.set(key,result);}
   if(loseResponse){loseResponse=false;throw new TypeError('Response lost after commit');}return json(result);
  }
  if(path==='/accounts')return json({data:[{id:'account',name:'Conta A'}]});
  if(path==='/categories')return json({data:[{id:'category',name:'Compras'}]});
  if(path==='/cards'||path==='/investments')return json({data:[]});
  if(path.startsWith('/transactions'))return json({data:[],meta:{total:0}});
  return json({data:{total:0}});
 };
 const client=new OfflineClient(store,fetcher,()=>true,event=>events.push(event));
 return {store,client,factory,fetcher,events,get writes(){return writes;},offline:()=>{available=false;},online:()=>{available=true;},lost:()=>{loseResponse=true;},reject:()=>{rejectWrite=true;},authorize:()=>{unauthorized=false;rejectWrite=false;},expire:()=>{unauthorized=true;}};
}
test('Despesa offline sobrevive a fechar e reabrir; o acesso usa perfil válido sem senha ou token',async()=>{
 const s=setup();await s.client.request('/me');await s.client.prepare();s.offline();
 const queued=await s.client.request('/transactions','POST',body,user.tenantId);assert.equal(queued.offlineQueued,true);assert.equal(s.writes,0);assert.equal((await s.client.pending()).length,1);
 await s.store.close();const reopenedStore=new OfflineStore((s.store as any).name,s.factory);const reopened=new OfflineClient(reopenedStore,s.fetcher,()=>true,()=>{});
 assert.equal((await reopened.request('/me')).data.id,user.id);assert.equal((await reopened.pending())[0].body.items[0].name,'Arroz');assert.equal((await reopened.request('/accounts','GET',undefined,user.tenantId)).data[0].name,'Conta A');
 const saved=await reopenedStore.meta<any>('active');assert.deepEqual(Object.keys(saved).sort(),['email','id','name','offlineUntil','tenant','tenantId','theme']);await reopenedStore.close();
});
test('Resposta perdida depois da gravação é repetida com a mesma chave sem duplicar',async()=>{
 const s=setup();await s.client.request('/me');await s.client.prepare();s.lost();
 assert.equal((await s.client.request('/transactions','POST',body,user.tenantId)).offlineQueued,true);assert.equal(s.writes,1);
 await s.client.sync();assert.equal(s.writes,1);assert.equal((await s.client.pending()).length,0);await s.store.close();
});
test('Sincronizações simultâneas usam a mesma operação e preservam a fila até confirmação',async()=>{
 const s=setup();await s.client.request('/me');s.offline();await s.client.request('/cards/card/purchases','POST',{description:'Compra',amount:10000,installments:2,date:'2026-10-29',categoryId:'category'},user.tenantId);
 s.online();await Promise.all([s.client.sync(),s.client.sync()]);assert.equal(s.writes,1);assert.equal((await s.client.pending()).length,0);await s.store.close();
});
test('Conflito de negócio fica preservado para revisão e pode ser repetido depois',async()=>{
 const s=setup();await s.client.request('/me');s.offline();await s.client.request('/transactions','POST',body,user.tenantId);s.online();s.reject();await s.client.sync();
 const pending=await s.client.pending();assert.equal(pending[0].state,'blocked');assert.equal(pending[0].error,'Conta arquivada.');assert.equal(s.writes,0);s.authorize();await s.client.retry(pending[0].id);assert.equal(s.writes,1);assert.equal((await s.client.pending()).length,0);await s.store.close();
});
test('Validação online não entra na fila e edições offline não fingem estar salvas',async()=>{
 const s=setup();await s.client.request('/me');s.reject();await assert.rejects(s.client.request('/transactions','POST',body,user.tenantId),/arquivada/);assert.equal((await s.client.pending()).length,0);s.offline();await assert.rejects(s.client.request('/transactions/id','PATCH',{amount:1},user.tenantId),/exige conexão/);await s.store.close();
});
test('Sair offline bloqueia reabertura sem apagar pendências; sessão vencida não libera dados',async()=>{
 const s=setup();await s.client.request('/me');s.offline();await s.client.request('/transactions','POST',body,user.tenantId);await s.client.request('/auth/logout','POST');assert.equal((await s.client.request('/me')).data,null);
 assert.equal((await s.store.pending(ownerKey(user))).length,1);s.online();await s.client.request('/auth/login','POST',{email:'a',password:'not-persisted'});assert.equal((await s.client.pending()).length,1);
 s.offline();const expired={...user,offlineUntil:new Date(0).toISOString()};await s.store.setMeta('active',expired);const next=new OfflineClient(s.store,s.fetcher,()=>true,()=>{});assert.equal((await next.request('/me')).data,null);await s.store.close();
});
test('Outra conta não lê cache nem envia pendências pertencentes ao usuário anterior',async()=>{
 const s=setup();await s.client.request('/me');await s.store.cache(ownerKey(user),'/accounts',{data:[{id:'private'}]});s.offline();await s.client.request('/transactions','POST',body,user.tenantId);
 const other={...user,id:'user-b',tenantId:'tenant-b',tenant:{id:'tenant-b',name:'B'}};await s.store.setMeta('active',other);const second=new OfflineClient(s.store,s.fetcher,()=>true,()=>{});
 assert.equal((await second.request('/me')).data.id,'user-b');assert.equal((await second.pending()).length,0);await assert.rejects(second.request('/accounts','GET',undefined,other.tenantId),/ainda não foi baixada/);assert.equal(s.writes,0);await s.store.close();
});
test('Servidor rejeitando a sessão exige login e mantém a operação local',async()=>{
 const s=setup();await s.client.request('/me');s.offline();await s.client.request('/transactions','POST',body,user.tenantId);s.online();s.expire();await s.client.sync();assert.equal(s.writes,0);assert.equal((await s.store.pending(ownerKey(user))).length,1);assert.equal(await s.store.meta('active'),undefined);assert.ok(s.events.includes('aurora:unauthorized'));await s.store.close();
});
test('Consulta de transações offline respeita conta, período, busca e paginação',async()=>{
 const s=setup();await s.client.request('/me');await s.store.cache(ownerKey(user),'/__transactions',{complete:true,rows:[{...body,id:'one'},{...body,id:'two',date:'2026-09-10'},{...body,id:'three',type:'CREDIT_CARD',cardId:'card'}]});s.offline();
 const result=await s.client.request('/transactions?from=2026-10-01&accountId=account&limit=1&page=1','GET',undefined,user.tenantId);assert.equal(result.meta.total,1);assert.equal(result.data[0].id,'one');assert.equal((await s.client.request('/transactions?search=Inexistente','GET',undefined,user.tenantId)).data.length,0);await s.store.close();
});
