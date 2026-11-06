import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');
const {db}=await import('./db.js');
const {today}=await import('./finance.js');

test('Dólar preserva reais pagos, saldo USD, custo proporcional e patrimônio',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input)=>new Response(JSON.stringify({base:'USD',quote:'BRL',rate:6,date:new URL(String(input)).searchParams.get('date')??today()}));
 const app=await createApp();let cookie='';
 const raw=(method:string,path:string,payload?:any)=>app.inject({method:method as any,url:'/api'+path,payload,headers:cookie?{cookie}:{}});
 const api=async(method:string,path:string,payload?:any)=>{const r=await raw(method,path,payload);assert.ok(r.statusCode<400,r.body);return r.json().data;};
 try{
  const login=await raw('POST','/auth/register',{name:'Dólar teste',email:'dolar@aurora.local',password:'senha-segura-dolar-123'});
  cookie=(login.headers['set-cookie'] as string).split(';')[0];
  const date=today();
  const account=await api('POST','/accounts',{name:'Conta',institution:'Banco',type:'CHECKING',initialBalance:100000,referenceDate:date});
  const input={name:'Dólares',class:'Dólar',institution:'Corretora',quantity:100,initialBalance:50000,referenceDate:date};
  for(const quantity of [0,null,-1])assert.equal((await raw('POST','/investments',{...input,quantity})).statusCode,400);
  assert.equal((await raw('POST','/investments',{...input,initialBalance:0})).statusCode,400);
  const asset=await api('POST','/investments',input);
  let s=await api('GET','/investments/'+asset.id);
  assert.equal(s.quantity,100);assert.equal(s.invested,50000);assert.equal(s.current,60000);assert.equal(s.profit,10000);assert.equal(s.returnPct,20);assert.equal(s.averageRate,5);
  assert.equal((await api('GET','/accounts'))[0].balance,100000);
  const path='/investments/'+asset.id;
  const operation={type:'DEPOSIT',amount:30000,quantity:50,accountId:account.id,date};
  await api('POST',path+'/operations',operation);
  assert.equal((await raw('POST',path+'/operations',{...operation,quantity:undefined})).statusCode,400);
  await api('POST',path+'/operations',{...operation,type:'WITHDRAW',amount:35000,quantity:60});
  s=await api('GET',path);
  assert.equal(s.quantity,90);assert.equal(s.invested,48000);assert.equal(s.current,54000);assert.equal(s.profit,6000);
  assert.equal((await api('GET','/accounts'))[0].balance,105000);
  assert.equal((await raw('POST',path+'/operations',{...operation,type:'WITHDRAW',quantity:91})).statusCode,400);
  assert.equal((await raw('POST',path+'/valuations',{amount:99999,date})).statusCode,400);
  assert.equal((await raw('PATCH',path,{quantity:999})).statusCode,400);
  assert.equal((await raw('PATCH',path,{class:'CDB'})).statusCode,400);
  await api('PATCH',path,{name:'Dólar atualizado'});
  const dashboard=await api('GET','/dashboard?month='+date.slice(0,7));
  assert.equal(dashboard.current,54000);assert.equal(dashboard.invested,48000);assert.equal(dashboard.wealth,159000);assert.equal(dashboard.evolution.at(-1).investments,54000);
  assert.equal((await api('GET','/investments'))[0].quantity,90);
  await api('POST',path+'/operations',{...operation,type:'WITHDRAW',amount:54000,quantity:90});
  s=await api('GET',path);assert.equal(s.quantity,0);assert.equal(s.invested,0);assert.equal(s.current,0);
 }finally{globalThis.fetch=originalFetch;await app.close();await db.$disconnect();await cleanup();}
});
