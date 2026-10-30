import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');
const {db}=await import('./db.js');
const {today,addMonths}=await import('./finance.js');

test('Receitas usam o mês de referência nos relatórios e preservam a data do saldo',async()=>{
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any)=>app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
 const api=async(method:string,path:string,payload?:any)=>{const r=await raw(method,path,payload);assert.ok(r.statusCode<400,r.body);return r.json().data;};
 const date=today(),current=date.slice(0,7),next=addMonths(`${current}-01`,1).slice(0,7);
 try{
  const login=await raw('POST','/auth/register',{name:'Receita Teste',email:'receita@aurora.local',password:'senha-segura-receita-123'});
  cookie=(login.headers['set-cookie'] as string).split(';')[0];
  const categories=await api('GET','/categories');
  const categoryId=categories.find((c:any)=>c.type==='INCOME').id;
  const expenseCategory=categories.find((c:any)=>c.type==='EXPENSE').id;
  const account=await api('POST','/accounts',{name:'Conta salário',institution:'Banco',type:'CHECKING',initialBalance:0,referenceDate:addMonths(date,-12)});
  const input={accountId:account.id,categoryId,description:'Salário antecipado',type:'INCOME',amount:300000,date,status:'CONFIRMED'};
  const salary=await api('POST','/transactions',{...input,referenceMonth:next});
  assert.equal(salary.referenceMonth,next);assert.equal(salary.date,date);
  assert.equal((await api('GET','/accounts'))[0].balance,300000);
  assert.equal((await api('GET','/dashboard?month='+current)).income,0);
  const dashboard=await api('GET','/dashboard?month='+next);
  assert.equal(dashboard.income,300000);assert.equal(dashboard.result,300000);
  assert.equal(dashboard.evolution.at(-1).income,300000);
  assert.equal(dashboard.recent[0].id,salary.id);
  assert.equal((await api('GET','/transactions?month='+current)).length,0);
  assert.equal((await api('GET','/transactions?month='+next))[0].id,salary.id);
  // Explicit date filters still describe receipt dates, even with a reference-month filter.
  assert.equal((await api('GET',`/transactions?month=${next}&from=${next}-01`)).length,0);
  assert.equal((await api('GET',`/transactions?from=${current}-01&to=${date}`))[0].id,salary.id);
  assert.equal((await api('GET',`/reports?from=${current}&to=${next}`)).at(-1).income,300000);
  assert.equal((await api('GET','/reports/daily?date='+date)).income,300000);
  await api('PATCH','/transactions/'+salary.id,{referenceMonth:current});
  assert.equal((await api('GET','/dashboard?month='+current)).income,300000);
  assert.equal((await api('GET','/dashboard?month='+next)).income,0);
  assert.equal((await api('GET','/accounts'))[0].balance,300000);
  const legacy=await api('POST','/transactions',{...input,description:'Sem referência',amount:1000});
  assert.equal(legacy.referenceMonth,null);
  await api('PATCH','/transactions/'+legacy.id,{referenceMonth:next});
  await api('PATCH','/transactions/'+legacy.id,{note:'Preserva o mês'});
  assert.equal((await api('GET','/transactions?month='+next))[0].referenceMonth,next);
  await api('PATCH','/transactions/'+legacy.id,{referenceMonth:null});
  assert.equal((await api('GET','/dashboard?month='+current)).income,301000);
  for(const referenceMonth of ['2026-13','2026-00','2026-1','invalid'])assert.equal((await raw('PATCH','/transactions/'+salary.id,{referenceMonth})).statusCode,400);
  await api('PATCH','/transactions/'+salary.id,{type:'EXPENSE',categoryId:expenseCategory});
  assert.equal((await api('GET','/transactions?month='+current)).find((t:any)=>t.id===salary.id).referenceMonth,null);
  const recurringDate=addMonths(date,-2),recurringMonth=addMonths(`${current}-01`,-1).slice(0,7);
  await api('POST','/transactions',{...input,description:'Salário recorrente',amount:5000,date:recurringDate,referenceMonth:recurringMonth,recurrence:'MONTHLY'});
  await api('POST','/recurrences/generate');await api('POST','/recurrences/generate');
  const occurrences=await db.transaction.findMany({where:{description:'Salário recorrente'},orderBy:{date:'asc'}});
  assert.equal(occurrences.length,3);
  assert.deepEqual(occurrences.map(t=>t.referenceMonth),[recurringMonth,current,next]);
  assert.deepEqual(occurrences.map(t=>t.status),['CONFIRMED','PLANNED','PLANNED']);
 }finally{await app.close();await db.$disconnect();await cleanup();}
});
