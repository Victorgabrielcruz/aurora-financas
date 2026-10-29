import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();const {createApp}=await import('./app.js');const {db}=await import('./db.js');const {today}=await import('./finance.js');
test('Sincronização de despesas é autenticada, atômica e idempotente',async t=>{
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any,key?:string,extra:any={})=>app.inject({method:method as any,url:'/api'+path,payload,headers:{...(cookie?{cookie}:{}),...(key?{'x-idempotency-key':key}:{}),...extra}});
 const api=async(method:string,path:string,payload?:any,key?:string)=>{const r=await raw(method,path,payload,key);assert.ok(r.statusCode<400,`${method} ${path}: ${r.body}`);return r.json().data;};
 let account:any,category:any,card:any,user:any;const date=today();
 try{
  const r=await raw('POST','/auth/register',{name:'Offline',email:'offline-sync@teste.local',password:'senha-offline-teste-123'});assert.equal(r.statusCode,201);cookie=(r.headers['set-cookie'] as string).split(';')[0];user=r.json().data;
  account=await api('POST','/accounts',{name:'Conta',institution:'Banco',type:'CHECKING',initialBalance:100000,referenceDate:date});
  category=(await api('GET','/categories')).find((c:any)=>c.type==='EXPENSE');card=await api('POST','/cards',{name:'Cartão',institution:'Banco',brand:'Visa',limit:200000,closingDay:25,dueDay:5});
  const expense={accountId:account.id,categoryId:category.id,description:'Despesa offline',type:'EXPENSE',amount:10000,date,status:'CONFIRMED',items:[{name:'Arroz',amount:3000}]};
  await t.test('Acesso offline recebe somente prazo público, sem senha ou token',async()=>{const me=await api('GET','/me');assert.ok(Date.parse(me.offlineUntil)>Date.now());assert.ok(!JSON.stringify(me).includes('password'));assert.ok(!JSON.stringify(me).includes('aurora_session'));assert.equal((await raw('GET','/accounts',undefined,undefined,{'x-aurora-user':'outra-pessoa'})).statusCode,401);});
  await t.test('Repetir a despesa retorna o mesmo registro e altera o saldo uma única vez',async()=>{
   const key=randomUUID();const first=await api('POST','/transactions',expense,key);const second=await api('POST','/transactions',{...expense},key);assert.equal(first.id,second.id);assert.equal(await db.transaction.count({where:{description:expense.description}}),1);assert.equal((await api('GET','/accounts'))[0].balance,90000);assert.equal(await db.syncReceipt.count({where:{id:key}}),1);
   assert.equal((await raw('POST','/transactions',{...expense,amount:11000},key)).statusCode,409);
  });
  await t.test('Compra parcelada repetida não duplica parcelas ou limite utilizado',async()=>{
   const input={description:'Compra offline',amount:12000,categoryId:category.id,date,installments:3,items:[{name:'Item',amount:12000}]},key=randomUUID();
   const a=await api('POST',`/cards/${card.id}/purchases`,input,key),b=await api('POST',`/cards/${card.id}/purchases`,input,key);assert.equal(a.id,b.id);assert.equal(await db.cardInstallment.count({where:{purchaseId:a.id}}),3);assert.equal((await api('GET','/cards/'+card.id)).used,12000);
  });
  await t.test('Rejeição não grava recibo nem altera finanças; a mesma chave pode tentar após correção',async()=>{
   const key=randomUUID();const count=await db.transaction.count();assert.equal((await raw('POST','/transactions',{...expense,accountId:'ausente'},key)).statusCode,404);assert.equal(await db.syncReceipt.count({where:{id:key}}),0);assert.equal(await db.transaction.count(),count);await api('POST','/transactions',{...expense,description:'Corrigida'},key);
  });
  await t.test('Envios simultâneos do mesmo identificador deixam no máximo uma despesa',async()=>{
   const key=randomUUID();const payload={...expense,description:'Simultânea'};const results=await Promise.all([raw('POST','/transactions',payload,key),raw('POST','/transactions',payload,key)]);assert.ok(results.some(r=>r.statusCode<400));assert.ok(results.every(r=>r.statusCode<400||r.statusCode===409));assert.equal(await db.transaction.count({where:{description:'Simultânea'}}),1);const replay=await api('POST','/transactions',payload,key);assert.ok(replay.id);assert.equal(await db.transaction.count({where:{description:'Simultânea'}}),1);
  });
  await t.test('Outra conta não reaproveita uma operação pertencente ao usuário anterior',async()=>{
   const previous=await db.syncReceipt.findFirstOrThrow({where:{userId:user.id}});const r=await raw('POST','/auth/register',{name:'Outra pessoa',email:'offline-other@teste.local',password:'senha-offline-outro-123'});assert.equal(r.statusCode,201);cookie=(r.headers['set-cookie'] as string).split(';')[0];const count=await db.transaction.count();assert.equal((await raw('POST','/transactions',expense,previous.id)).statusCode,409);assert.equal(await db.transaction.count(),count);
  });
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
