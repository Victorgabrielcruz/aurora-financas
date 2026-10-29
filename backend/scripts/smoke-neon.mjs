import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
import {PrismaClient} from '@prisma/client';

for(const path of ['../../.env.local','../../.env','../.env'])config({path:fileURLToPath(new URL(path,import.meta.url))});
const base=process.env.SMOKE_URL??'http://127.0.0.1:3001';
const db=new PrismaClient();
const email=`neon-smoke-${randomUUID()}@aurora.invalid`;
const password=randomUUID()+'-Aurora';
const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
let cookie='',tenantId,userId;
async function api(method,path,body,status=200){
  const response=await fetch(base+'/api'+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const result=await response.json();
  assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(result)}`);
  const setCookie=response.headers.get('set-cookie');
  if(setCookie)cookie=setCookie.split(';')[0];
  console.log(`PASS HTTP ${response.status} ${method} /api${path}`);
  return result.data;
}
try{
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/id="root"/);
  console.log('PASS HTTP 200 GET / (built React app)');
  assert.equal((await api('GET','/health')).database,'postgresql');
  await api('GET','/accounts',undefined,401);
  const user=await api('POST','/auth/register',{name:'Neon smoke test',email,password},201);
  tenantId=user.tenantId;userId=user.id;
  const account=await api('POST','/accounts',{name:'Neon verification',institution:'Test',type:'CHECKING',initialBalance:10000,referenceDate:date},201);
  const categories=await api('GET','/categories');
  const transaction=await api('POST','/transactions',{accountId:account.id,categoryId:categories.find(c=>c.type==='EXPENSE').id,description:'Neon persistence verification',amount:1234,type:'EXPENSE',date,status:'CONFIRMED'},201);
  assert.equal((await api('GET','/accounts')).find(a=>a.id===account.id).balance,8766);
  const stored=await db.transaction.findUniqueOrThrow({where:{id:transaction.id}});
  assert.equal(stored.amount,1234);
  const connection=await db.$queryRaw`SELECT current_database() AS database, version() AS version`;
  assert.match(connection[0].version,/PostgreSQL/);
  console.log('PASS real Neon PostgreSQL write/read: expense=1234, balance=8766');
  await db.$disconnect();
  assert.equal((await db.transaction.findUniqueOrThrow({where:{id:transaction.id}})).amount,1234);
  console.log('PASS persistence after database reconnect');
  await api('POST','/auth/logout');cookie='';
  await api('POST','/auth/login',{email,password});
  assert.equal((await api('GET','/me')).tenantId,tenantId);
  assert.equal((await api('GET','/dashboard?month='+date.slice(0,7))).available,8766);
  assert.equal((await api('GET','/export')).tenant.id,tenantId);
  console.log('PASS Neon Postgres service end to end');
}finally{
  // Delete only the unique tenant and records created by this run.
  if(tenantId&&userId){
    await db.$transaction(async tx=>{
      await tx.transaction.deleteMany({where:{account:{tenantId}}});
      await tx.account.deleteMany({where:{tenantId}});
      await tx.category.deleteMany({where:{tenantId}});
      await tx.session.deleteMany({where:{userId}});
      await tx.user.delete({where:{id:userId}});
      await tx.tenant.delete({where:{id:tenantId}});
    });
    console.log('PASS test tenant cleaned up');
  }
  await db.$disconnect();
}
