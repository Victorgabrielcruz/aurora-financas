import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '../generated/sqlite-client/index.js';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('Migração multi-tenant preserva usuários, sessões, saldos e histórico existentes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'aurora-migration-'));
 const client=new PrismaClient({datasourceUrl:`file:${join(directory,'legacy.db')}`});
 async function migration(name:string){
  const sql=readFileSync(resolve('prisma/sqlite/migrations',name,'migration.sql'),'utf8').replace(/^--.*$/gm,'');
  for(const statement of sql.split(/;\s*(?:\r?\n|$)/).map(x=>x.trim()).filter(Boolean)){
   if(statement.startsWith('PRAGMA'))await client.$queryRawUnsafe(statement);else await client.$executeRawUnsafe(statement);
  }
 }
 try{
  for(const name of ['202610280001_init','202610280002_investment_order','202610280003_constraints'])await migration(name);
  await client.$executeRawUnsafe(`INSERT INTO "User" ("id","name","email","passwordHash") VALUES ('legacy-user','Usuário existente','legacy@exemplo.com','hash-existente')`);
  await client.$executeRawUnsafe(`INSERT INTO "Session" ("id","userId","expiresAt") VALUES ('legacy-session','legacy-user',9999999999999)`);
  await client.$executeRawUnsafe(`INSERT INTO "Account" ("id","userId","name","institution","type","initialBalance","referenceDate") VALUES ('legacy-account','legacy-user','Minha conta','Banco','CHECKING',100000,'2026-01-01')`);
  await client.$executeRawUnsafe(`INSERT INTO "Category" ("id","userId","name","type","color") VALUES ('legacy-category','legacy-user','Moradia','EXPENSE','#123456')`);
  await client.$executeRawUnsafe(`INSERT INTO "Transaction" ("id","accountId","categoryId","description","amount","type","date") VALUES ('legacy-expense','legacy-account','legacy-category','Aluguel',10000,'EXPENSE','2026-01-02')`);
  await client.$executeRawUnsafe(`INSERT INTO "CreditCard" ("id","userId","name","institution","brand","limit","closingDay","dueDay","color") VALUES ('legacy-card','legacy-user','Cartão','Banco','Visa',100000,25,5,'#123456')`);
  await client.$executeRawUnsafe(`INSERT INTO "Investment" ("id","userId","name","class","institution") VALUES ('legacy-investment','legacy-user','CDB','CDB','Banco')`);
  await client.$disconnect();
  const cli=resolve('../node_modules/prisma/build/index.js');
  const env={...process.env,DATABASE_URL:`file:${join(directory,'legacy.db')}`};
  for(const name of ['202610280001_init','202610280002_investment_order','202610280003_constraints']){
   execFileSync(process.execPath,[cli,'migrate','resolve','--schema','prisma/sqlite/schema.prisma','--applied',name],{env,stdio:'pipe'});
  }
  execFileSync(process.execPath,[cli,'migrate','deploy','--schema','prisma/sqlite/schema.prisma'],{env,stdio:'pipe'});
  const user=await client.user.findUniqueOrThrow({where:{id:'legacy-user'},include:{tenant:true}});
  assert.equal(user.tenantId,'tenant_legacy-user');assert.equal(user.passwordHash,'hash-existente');assert.equal(user.tenant.name,'Finanças de Usuário existente');
  for(const delegate of [client.account,client.category,client.creditCard,client.investment] as any[])assert.equal((await delegate.findMany())[0].tenantId,user.tenantId);
  assert.equal((await client.account.findUniqueOrThrow({where:{id:'legacy-account'}})).initialBalance,100000);
  assert.equal((await client.transaction.findUniqueOrThrow({where:{id:'legacy-expense'}})).amount,10000);
  assert.deepEqual((await client.transaction.findUniqueOrThrow({where:{id:'legacy-expense'}})).items,[]);
  await client.transaction.update({where:{id:'legacy-expense'},data:{items:[{name:'Aluguel',amount:10000}]}});
  assert.deepEqual((await client.transaction.findUniqueOrThrow({where:{id:'legacy-expense'}})).items,[{name:'Aluguel',amount:10000}]);
  assert.equal((await client.creditCard.findUniqueOrThrow({where:{id:'legacy-card'}})).accountId,null);
  await client.creditCard.update({where:{id:'legacy-card'},data:{accountId:'legacy-account'}});
  assert.equal((await client.creditCard.findUniqueOrThrow({where:{id:'legacy-card'}})).accountId,'legacy-account');
  assert.equal(await client.transaction.count(),1);
  assert.ok(await client.session.findUnique({where:{id:'legacy-session'}}));
  assert.deepEqual(await client.$queryRawUnsafe('PRAGMA foreign_key_check'),[]);
  await assert.rejects(client.account.update({where:{id:'legacy-account'},data:{type:'INVALID'}}));
  await assert.rejects(client.transaction.update({where:{id:'legacy-expense'},data:{amount:-1}}));
 }finally{await client.$disconnect();rmSync(directory,{recursive:true,force:true});}
});

