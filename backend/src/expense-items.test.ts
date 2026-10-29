import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');const {db}=await import('./db.js');const {today,addMonths}=await import('./finance.js');
test('Composição opcional de despesas e relatório de itens',async t=>{
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any)=>app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
 const api=async(method:string,path:string,payload?:any)=>{const r=await raw(method,path,payload);assert.ok(r.statusCode<400,`${method} ${path}: ${r.body}`);return r.json().data;};
 const date=today(),month=date.slice(0,7),old=addMonths(date,-2),range=`/reports/items?from=${old.slice(0,7)}&to=${month}`;
 let account:any,other:any,category:any,incomeCategory:any,expense:any,purchase:any,card:any,income:any;
 try{
  const r=await raw('POST','/auth/register',{name:'Itens',email:'itens@teste.local',password:'senha-itens-teste-123'});assert.equal(r.statusCode,201);cookie=(r.headers['set-cookie'] as string).split(';')[0];
  const categories=await api('GET','/categories');category=categories.find((c:any)=>c.type==='EXPENSE');incomeCategory=categories.find((c:any)=>c.type==='INCOME');
  account=await api('POST','/accounts',{name:'Conta',institution:'Banco',type:'CHECKING',initialBalance:500000,referenceDate:addMonths(date,-12)});
  other=await api('POST','/accounts',{name:'Outra',institution:'Banco',type:'CASH',initialBalance:0,referenceDate:old});
  card=await api('POST','/cards',{name:'Cartão',institution:'Banco',brand:'Visa',limit:200000,closingDay:25,dueDay:5});
  await t.test('Cadastro salva composição de conta e cartão e exclui previstos e receitas do relatório',async()=>{
   expense=await api('POST','/transactions',{accountId:account.id,categoryId:category.id,description:'Mercado',amount:10000,type:'EXPENSE',date,status:'CONFIRMED',items:[{name:'Carne',amount:5000},{name:'Café',amount:1000}]});
   await api('POST','/transactions',{accountId:account.id,categoryId:category.id,description:'Prevista',amount:9000,type:'EXPENSE',date,status:'PLANNED',items:[{name:'Não contar',amount:9000}]});
   income=await api('POST','/transactions',{accountId:account.id,categoryId:incomeCategory.id,description:'Receita',amount:1000,type:'INCOME',date,status:'CONFIRMED'});
   await api('POST','/transfers',{fromId:account.id,toId:other.id,amount:1000,date});
   purchase=await api('POST',`/cards/${card.id}/purchases`,{description:'Mercado no cartão',amount:12000,date:old,categoryId:category.id,installments:3,items:[{name:'Arroz',amount:6000},{name:'Café',amount:2000}]});
   const report=await api('GET',range);assert.equal(report.total,22000);assert.equal(report.detailed,14000);assert.equal(report.undetailed,8000);assert.equal(report.purchases,2);
   assert.deepEqual(report.items.map((i:any)=>[i.name,i.amount]),[['Arroz',6000],['Carne',5000],['Café',3000]]);
   const rows=await api('GET','/transactions');assert.deepEqual(rows.find((row:any)=>row.id===expense.id).items,expense.items);assert.deepEqual(rows.find((row:any)=>row.id===purchase.id).items,purchase.items);
  });
  await t.test('É possível detalhar uma compra de fatura fechada sem mudar saldos ou faturas',async()=>{
   const before=await api('GET','/dashboard?month='+month);
   const updated=await api('PATCH',`/transactions/${expense.id}/items`,{items:[{name:' Arroz ',amount:3000},{name:'cafe',amount:2000}],amount:1});
   assert.equal(updated.amount,10000);assert.equal(updated.items[0].name,'Arroz');
   const changed=await api('PATCH',`/purchases/${purchase.id}/items`,{items:[{name:'ARROZ',amount:5000},{name:'Café',amount:3000}]});assert.equal(changed.amount,12000);
   assert.equal((await raw('PATCH',`/purchases/${purchase.id}`,{description:'Alterada',amount:12000,date:old,categoryId:category.id,installments:3})).statusCode,400);
   const after=await api('GET','/dashboard?month='+month);assert.equal(after.available,before.available);assert.equal(after.expense,before.expense);assert.equal(after.owed,before.owed);
   const details=await api('GET','/cards/'+card.id);const invoice=details.invoices.find((i:any)=>i.closingDate<date);assert.ok(invoice);
   assert.deepEqual((await api('GET','/invoices/'+invoice.id)).installments[0].purchase.items,changed.items);
   await api('POST',`/invoices/${invoice.id}/payments`,{accountId:account.id,amount:1000,date});
   const report=await api('GET',range);assert.equal(report.total,22000);assert.equal(report.detailed,13000);assert.equal(report.undetailed,9000);
   assert.deepEqual(report.items.map((i:any)=>[i.amount,i.purchases]),[[8000,2],[5000,2]]);
   assert.equal((await api('GET',`/reports/items?from=${month}&to=${month}`)).total,10000);
  });
  await t.test('Valores inválidos são rejeitados sem alterar a composição e sem incluir receitas',async()=>{
   const count=await db.transaction.count();
   for(const items of [[{name:'Item',amount:20001}],[{name:'',amount:1}],[{name:'Item',amount:0}],[{name:'Item',amount:-1}],[{name:'Item',amount:1.5}],null,'[]']){
    assert.equal((await raw('PATCH',`/transactions/${expense.id}/items`,{items})).statusCode,400);
    assert.equal((await raw('PATCH',`/purchases/${purchase.id}/items`,{items})).statusCode,400);
   }
   assert.equal((await raw('PATCH',`/transactions/${expense.id}`,{amount:100})).statusCode,400);
   assert.equal((await raw('PATCH',`/transactions/${income.id}/items`,{items:[{name:'Item',amount:1}]})).statusCode,400);
   assert.equal((await raw('POST','/transactions',{accountId:account.id,categoryId:incomeCategory.id,description:'Receita inválida',amount:100,type:'INCOME',date,status:'CONFIRMED',items:[{name:'Item',amount:1}]})).statusCode,400);
   assert.equal(await db.transaction.count(),count);
   assert.equal((await raw('GET',`/reports/items?from=${month}&to=2020-01`)).statusCode,400);
   await api('PATCH',`/purchases/${purchase.id}/items`,{items:[]});
   const cleared=await api('GET',range);assert.equal(cleared.detailed,5000);assert.equal(cleared.undetailed,17000);
  });
  await t.test('Outro usuário não consulta os itens nem altera a composição de despesas alheias',async()=>{
   const originalCookie=cookie;const r=await raw('POST','/auth/register',{name:'Outra pessoa',email:'outros-itens@teste.local',password:'senha-outros-itens-123'});assert.equal(r.statusCode,201);cookie=(r.headers['set-cookie'] as string).split(';')[0];
   assert.equal((await api('GET',range)).total,0);
   for(const path of [`/transactions/${expense.id}/items`,`/purchases/${purchase.id}/items`])assert.equal((await raw('PATCH',path,{items:[{name:'Invadido',amount:1}]})).statusCode,404);
   cookie=originalCookie;
  });
  await t.test('Recorrências preservam a composição e exclusão remove os itens do relatório',async()=>{
   await api('POST','/transactions',{accountId:account.id,categoryId:category.id,description:'Recorrente com itens',amount:2000,type:'EXPENSE',date:old,status:'CONFIRMED',recurrence:'MONTHLY',items:[{name:'Serviço',amount:2000}]});
   await api('POST','/recurrences/generate');
   const rows=await db.transaction.findMany({where:{description:'Recorrente com itens'}});assert.equal(rows.length,3);assert.ok(rows.every(row=>JSON.stringify(row.items)===JSON.stringify([{name:'Serviço',amount:2000}])));
   const before=await api('GET',range);await api('DELETE','/transactions/'+expense.id);const after=await api('GET',range);assert.equal(after.total,before.total-10000);assert.equal(after.detailed,before.detailed-5000);
  });
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
