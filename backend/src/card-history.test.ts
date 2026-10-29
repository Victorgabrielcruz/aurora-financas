import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');
const {db}=await import('./db.js');
const {today,addMonths}=await import('./finance.js');

test('Compras antigas parceladas mantêm faturas, limite e patrimônio consistentes',async()=>{
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any)=>app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
 const api=async(method:string,path:string,payload?:any)=>{const r=await raw(method,path,payload);assert.ok(r.statusCode<400,`${method} ${path}: ${r.body}`);return r.json().data;};
 try{
  const registered=await raw('POST','/auth/register',{name:'Histórico',email:'historico@teste.local',password:'senha-historico-teste-123'});
  assert.equal(registered.statusCode,201);
  cookie=(registered.headers['set-cookie'] as string).split(';')[0];
  const date=today(),month=date.slice(0,7),firstMonth=addMonths(`${month}-01`,1).slice(0,7);
  const category=(await api('GET','/categories')).find((c:any)=>c.type==='EXPENSE');
  const account=await api('POST','/accounts',{name:'Conta',institution:'Banco',type:'CHECKING',initialBalance:200000,referenceDate:addMonths(date,-12)});
  const card=await api('POST','/cards',{name:'Parcelados',institution:'Banco',brand:'Visa',limit:40000,closingDay:25,dueDay:5});
  const input={description:'Compra antiga',amount:100001,categoryId:category.id,date:addMonths(date,-4),installments:6,paidInstallments:4,firstInvoiceMonth:firstMonth};
  const before=await api('GET','/dashboard?month='+month);
  const purchase=await api('POST',`/cards/${card.id}/purchases`,input);
  let details=await api('GET','/cards/'+card.id);
  const restored=details.purchases.find((p:any)=>p.id===purchase.id);
  assert.equal(restored.totalInstallments,6);assert.equal(restored.paidInstallments,4);assert.equal(restored.firstInvoiceMonth,firstMonth);
  assert.deepEqual(restored.installments.map((i:any)=>[i.number,i.amount,i.invoice.month]),[[5,16667,firstMonth],[6,16666,addMonths(`${firstMonth}-01`,1).slice(0,7)]]);
  assert.equal(details.used,33333);assert.equal(details.limit-details.used,6667);
  let after=await api('GET','/dashboard?month='+month);
  assert.equal(after.available,before.available);assert.equal(after.expense,before.expense);assert.equal(after.owed,before.owed+33333);assert.equal(after.wealth,before.wealth-33333);
  assert.equal(after.evolution.at(-1).wealth,after.wealth);
  const count=await db.cardPurchase.count();
  for(const invalid of [{paidInstallments:6},{paidInstallments:-1},{paidInstallments:1.5},{firstInvoiceMonth:undefined},{firstInvoiceMonth:'2026-13'},{firstInvoiceMonth:addMonths(input.date,-1).slice(0,7)}]){
   assert.equal((await raw('POST',`/cards/${card.id}/purchases`,{...input,...invalid})).statusCode,400);
  }
  assert.equal(await db.cardPurchase.count(),count);
  assert.equal((await raw('PATCH','/purchases/'+purchase.id,{...input,amount:180000})).statusCode,400);
  await api('PATCH','/purchases/'+purchase.id,{...input,amount:90000});
  details=await api('GET','/cards/'+card.id);
  assert.equal(details.used,30000);assert.equal(details.purchases[0].installments.length,2);
  const first=details.invoices.find((i:any)=>i.month===firstMonth);
  const invoice=await api('GET','/invoices/'+first.id);
  assert.equal(invoice.installments[0].number,5);assert.equal(invoice.installments[0].purchase.installments.length,2);
  await api('POST',`/invoices/${first.id}/payments`,{accountId:account.id,amount:15000,date});
  details=await api('GET','/cards/'+card.id);assert.equal(details.used,15000);
  after=await api('GET','/dashboard?month='+month);
  assert.equal(after.available,before.available-15000);assert.equal(after.expense,before.expense);assert.equal(after.wealth,before.wealth-30000);
  assert.equal(after.evolution.at(-1).wealth,after.wealth);
  assert.equal((await raw('PATCH','/purchases/'+purchase.id,{...input,amount:60000})).statusCode,400);
  const old=await api('POST',`/cards/${card.id}/purchases`,{...input,description:'Antiga sem parcelas pagas',amount:10000,installments:2,paidInstallments:0});
  details=await api('GET','/cards/'+card.id);assert.equal(details.used,25000);
  assert.deepEqual(details.purchases.find((p:any)=>p.id===old.id).installments.map((i:any)=>i.number),[1,2]);
  const automatic=await api('POST',`/cards/${card.id}/purchases`,{description:'Antiga automática',amount:10000,categoryId:category.id,date:addMonths(date,-2),installments:2});
  details=await api('GET','/cards/'+card.id);assert.equal(details.used,35000);
  assert.equal(details.purchases.find((p:any)=>p.id===automatic.id).paidInstallments,0);
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
