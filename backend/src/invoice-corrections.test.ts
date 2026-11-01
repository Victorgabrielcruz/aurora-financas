import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');
const {db}=await import('./db.js');
const {today,addMonths}=await import('./finance.js');

test('Correções na fatura recalculam parcelas e limite, preservando pagamentos',async()=>{
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any)=>app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
 const api=async(method:string,path:string,payload?:any)=>{const r=await raw(method,path,payload);assert.ok(r.statusCode<400,`${method} ${path}: ${r.body}`);return r.json().data;};
 try{
  const registered=await raw('POST','/auth/register',{name:'Correções',email:'correcoes@teste.local',password:'senha-correcoes-teste-123'});
  assert.equal(registered.statusCode,201);cookie=(registered.headers['set-cookie'] as string).split(';')[0];
  const date=today(),oldDate=addMonths(date,-3),month=oldDate.slice(0,7);
  const category=(await api('GET','/categories')).find((c:any)=>c.type==='EXPENSE');
  const account=await api('POST','/accounts',{name:'Conta',institution:'Banco',type:'CHECKING',initialBalance:200000,referenceDate:oldDate});
  const card=await api('POST','/cards',{name:'Cartão',institution:'Banco',brand:'Visa',limit:100000,closingDay:28,dueDay:5});
  const input={description:'Compra errada',amount:9000,categoryId:category.id,date:month+'-01',installments:3,firstInvoiceMonth:month};
  const purchase=await api('POST',`/cards/${card.id}/purchases`,input);
  let details=await api('GET','/cards/'+card.id);
  const first=details.invoices.find((i:any)=>i.month===month);
  let invoice=await api('GET','/invoices/'+first.id);
  assert.equal(invoice.installments[0].purchase.editable,true);
  assert.equal(invoice.installments[0].purchase.totalInstallments,3);
  assert.equal(invoice.installments[0].purchase.firstInvoiceMonth,month);
  await api('PATCH','/purchases/'+purchase.id,{...input,description:'Compra corrigida',amount:6000});
  invoice=await api('GET','/invoices/'+first.id);
  assert.equal(invoice.total,2000);assert.equal(invoice.installments[0].purchase.description,'Compra corrigida');
  assert.equal((await api('GET','/cards/'+card.id)).used,6000);
  await api('DELETE','/purchases/'+purchase.id);
  invoice=await api('GET','/invoices/'+first.id);assert.equal(invoice.total,0);assert.equal(invoice.installments.length,0);
  assert.equal((await api('GET','/cards/'+card.id)).used,0);
  const paidPurchase=await api('POST',`/cards/${card.id}/purchases`,input);
  await api('POST',`/invoices/${first.id}/payments`,{accountId:account.id,amount:1000,date});
  invoice=await api('GET','/invoices/'+first.id);assert.equal(invoice.installments[0].purchase.editable,false);
  details=await api('GET','/cards/'+card.id);
  const later=details.invoices.find((i:any)=>i.month!==month&&i.total>0);
  assert.equal((await api('GET','/invoices/'+later.id)).installments[0].purchase.editable,false);
  assert.equal((await raw('DELETE','/purchases/'+paidPurchase.id)).statusCode,400);
  assert.equal((await raw('PATCH','/purchases/'+paidPurchase.id,{...input,amount:3000})).statusCode,400);
  const otherInput={...input,firstInvoiceMonth:addMonths(date,1).slice(0,7)};
  const other=await api('POST',`/cards/${card.id}/purchases`,otherInput);
  assert.equal((await raw('PATCH','/purchases/'+other.id,input)).statusCode,400);
  invoice=await api('GET','/invoices/'+first.id);assert.equal(invoice.total,3000);assert.equal(invoice.paid,1000);
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
