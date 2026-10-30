import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');
const {db}=await import('./db.js');
const {today,addMonths}=await import('./finance.js');

test('Resultado mensal segue cada parcela na fatura e visão diária mostra o saldo bancário',async()=>{
 const app=await createApp();let cookie='';
 const api=async(method:string,path:string,payload?:any)=>{
  const r=await app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
  assert.ok(r.statusCode<400,r.body);return r.json().data;
 };
 try{
  const r=await app.inject({method:'POST',url:'/api/auth/register',payload:{name:'Resumo',email:'resumo@teste.local',password:'senha-resumo-segura-123'}});
  assert.equal(r.statusCode,201);cookie=(r.headers['set-cookie'] as string).split(';')[0];
  const date=today(),month=date.slice(0,7),next=addMonths(`${month}-01`,1).slice(0,7),last=addMonths(`${month}-01`,2).slice(0,7);
  const categories=await api('GET','/categories');const categoryId=categories.find((c:any)=>c.type==='EXPENSE').id;
  const account=await api('POST','/accounts',{name:'Conta',institution:'Teste',type:'CHECKING',initialBalance:100000,referenceDate:date});
  const card=await api('POST','/cards',{name:'Cartão',institution:'Teste',brand:'Visa',limit:200000,closingDay:25,dueDay:5});
  await api('POST',`/cards/${card.id}/purchases`,{description:'Compra parcelada',amount:10001,categoryId,date,installments:2,firstInvoiceMonth:next,fixed:true});
  const current=await api('GET','/dashboard?month='+month);
  assert.equal(current.expense,0);assert.equal(current.result,0);assert.equal(current.available,100000);
  const report=await api('GET',`/reports?from=${next}&to=${last}`);
  assert.deepEqual(report.map((p:any)=>p.expense),[5001,5000]);
  for(const p of report){
   assert.equal(p.result,-p.expense);assert.equal(p.fixed,p.expense);assert.equal(p.variable,0);
   assert.equal(p.expensesByCategory.find((c:any)=>c.id===categoryId).amount,p.expense);
   assert.equal(p.cardSpending[0].amount,p.expense);assert.equal(p.evolution.at(-1).expense,p.expense);
   assert.equal(p.largest[0].amount,p.expense);
  }
  const invoice=report[0].invoices.find((i:any)=>i.month===next);
  await api('POST',`/invoices/${invoice.id}/payments`,{accountId:account.id,amount:1000,date});
  assert.equal((await api('GET','/dashboard?month='+next)).expense,5001);
  const daily=await api('GET','/reports/daily?date='+date);
  assert.equal(daily.cardExpense,10001);assert.equal(daily.cashExpense,0);assert.equal(daily.expense,10001);
  assert.equal(daily.result,-10001);assert.equal(daily.openingBalance,100000);
  assert.equal(daily.closingBalance,99000);assert.equal(daily.cashChange,-1000);
  const dashboard=await api('GET','/dashboard?month='+month);
  const {entries,...summary}=daily;assert.deepEqual(dashboard.daily,summary);
  // Automatic invoice assignment must use the same month as an explicit invoice.
  const previous=addMonths(`${month}-01`,-1).slice(0,7);
  await api('POST',`/cards/${card.id}/purchases`,{description:'Compra após o fechamento',amount:2100,categoryId,date:`${previous}-25`,installments:1});
  assert.equal((await api('GET','/dashboard?month='+previous)).expense,0);
  const automatic=await api('GET','/dashboard?month='+month);
  assert.equal(automatic.expense,2100);assert.equal(automatic.result,-2100);
  assert.equal(automatic.available,99000);
  assert.equal(automatic.evolution.at(-1).expense,2100);
  assert.equal((await api('GET','/dashboard?month='+next)).expense,5001);
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
