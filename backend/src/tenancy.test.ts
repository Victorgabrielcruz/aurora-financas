import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {testDatabase} from '../scripts/test-database.mjs';
const cleanup=await testDatabase();
const {createApp}=await import('./app.js');const {db}=await import('./db.js');const {today,addMonths}=await import('./finance.js');

test('Cadastro multi-tenant e isolamento de dados em PostgreSQL',async t=>{
 const app=await createApp(),date=today(),month=date.slice(0,7),password='senha-de-teste-segura';
 function agent(){
  let cookie='';
  return {
   async raw(method:string,path:string,payload?:any,headers:Record<string,string>={}){
    const r=await app.inject({method:method as any,url:'/api'+path,payload,headers:{...(cookie?{cookie}:{}),...headers}});
    const value=r.headers['set-cookie'];if(typeof value==='string')cookie=value.split(';')[0];
    return r;
   },
   async api(method:string,path:string,payload?:any){const r=await this.raw(method,path,payload);assert.ok(r.statusCode<400,`${method} ${path}: ${r.body}`);return r.json().data;},
   cookie:()=>cookie,
  };
 }
 const a=agent(),b=agent(),c=agent();let alice:any,bob:any,fa:any,fb:any;
 async function fixture(client:ReturnType<typeof agent>,suffix:string){
  const account=await client.api('POST','/accounts',{name:`Conta ${suffix}`,institution:'Banco',type:'CHECKING',initialBalance:100000,referenceDate:addMonths(date,-3)});
  const categories=await client.api('GET','/categories');const category=categories.find((v:any)=>v.type==='EXPENSE');
  const transaction=await client.api('POST','/transactions',{accountId:account.id,categoryId:category.id,description:`Despesa ${suffix}`,type:'EXPENSE',amount:1000,date:addMonths(date,-1),status:'CONFIRMED',recurrence:'MONTHLY'});
  const card=await client.api('POST','/cards',{name:`Cartão ${suffix}`,institution:'Banco',brand:'Visa',limit:50000,closingDay:25,dueDay:5,color:'#123456'});
  const purchase=await client.api('POST',`/cards/${card.id}/purchases`,{description:`Compra ${suffix}`,amount:2000,categoryId:category.id,date,installments:2});
  const invoice=(await client.api('GET','/cards/'+card.id)).invoices[0];
  const investment=await client.api('POST','/investments',{name:`Ativo ${suffix}`,class:'CDB',institution:'Banco'});
  await client.api('POST',`/investments/${investment.id}/operations`,{type:'DEPOSIT',amount:1000,accountId:account.id,date});
  return {account,category,transaction,card,purchase,invoice,investment};
 }
 try{
  await t.test('Cadastros criam tenants distintos, categorias próprias e senhas protegidas',async()=>{
   alice=await a.api('POST','/auth/register',{name:'Alice',email:' ALICE@EXEMPLO.COM ',password});
   bob=await b.api('POST','/auth/register',{name:'Bob',email:'bob@exemplo.com',password,tenantName:'Espaço do Bob'});
   assert.notEqual(alice.tenantId,bob.tenantId);assert.equal(bob.tenant.name,'Espaço do Bob');assert.equal(alice.email,'alice@exemplo.com');
   const catsA=await a.api('GET','/categories'),catsB=await b.api('GET','/categories');
   assert.equal(catsA.length,13);assert.equal(catsB.length,13);assert.ok(catsA.every((x:any)=>x.tenantId===alice.tenantId));assert.ok(!catsB.some((x:any)=>catsA.some((y:any)=>x.id===y.id)));
   assert.match(a.cookie(),/^aurora_session=/);
   const stored=await db.user.findUniqueOrThrow({where:{id:alice.id}});assert.notEqual(stored.passwordHash,password);assert.ok(!JSON.stringify(alice).includes('passwordHash'));
   const token=a.cookie().split('=')[1];assert.ok(await db.session.findUnique({where:{id:createHash('sha256').update(token).digest('hex')}}));
  });
  await t.test('E-mail duplicado ou senha fraca não deixam tenants órfãos',async()=>{
   const before=await db.tenant.count();assert.equal((await c.raw('POST','/auth/register',{name:'Outra Alice',email:'Alice@Exemplo.com',password})).statusCode,409);
   assert.equal((await c.raw('POST','/auth/register',{name:'Fraca',email:'fraca@exemplo.com',password:'123'})).statusCode,400);
   assert.equal(await db.tenant.count(),before);assert.equal(await db.user.count(),2);
  });
  await t.test('Login normaliza e-mail e erros não revelam se a conta existe',async()=>{
   const bad=await a.raw('POST','/auth/login',{email:alice.email,password:'uma-senha-incorreta'}),unknown=await a.raw('POST','/auth/login',{email:'desconhecido@exemplo.com',password});
   assert.equal(bad.statusCode,401);assert.equal(bad.body,unknown.body);
   const r=await a.raw('POST','/auth/login',{email:' ALICE@EXEMPLO.COM ',password});assert.equal(r.statusCode,200);assert.match(r.headers['set-cookie'] as string,/HttpOnly/);assert.equal(r.json().data.tenantId,alice.tenantId);
   assert.equal((await a.api('GET','/me')).id,alice.id);assert.equal((await b.api('GET','/me')).id,bob.id);
  });
  await t.test('Todas as listagens, relatórios e exportações usam o tenant da sessão',async()=>{
   fa=await fixture(a,'Alice');fb=await fixture(b,'Bob');
   for(const path of ['/accounts','/categories','/cards','/investments']){
    const results=await a.api('GET',path);assert.ok(results.every((x:any)=>x.tenantId===alice.tenantId),path);
   }
   assert.equal((await a.api('GET',`/transactions?accountId=${fb.account.id}`)).length,0);
   const exported=await a.api('GET','/export');assert.equal(exported.tenant.id,alice.tenantId);
   for(const item of Object.values(fb) as any[])assert.ok(!JSON.stringify(exported).includes(item.id));
   assert.equal((await a.api('GET','/dashboard?month='+month)).accounts.length,1);
   assert.equal((await b.api('GET',`/reports?from=${month}&to=${month}`))[0].accounts[0].id,fb.account.id);
  });
  await t.test('IDs de outro tenant não permitem consultar, editar ou excluir recursos',async()=>{
   const attempts:Array<[string,string,any?]>=[
    ['POST','/cards',{name:'Vínculo inválido',institution:'Banco',brand:'Visa',limit:10000,closingDay:25,dueDay:5,accountId:fb.account.id}],['PATCH',`/cards/${fa.card.id}`,{accountId:fb.account.id}],
    ['PATCH',`/accounts/${fb.account.id}`,{name:'Invadida'}],['DELETE',`/accounts/${fb.account.id}`],['POST',`/accounts/${fb.account.id}/adjust`,{balance:0,note:'Ajuste indevido'}],
    ['PATCH',`/transactions/${fb.transaction.id}/items`,{items:[]}],['PATCH',`/purchases/${fb.purchase.id}/items`,{items:[]}],['PATCH',`/transactions/${fb.transaction.id}`,{amount:1}],['DELETE',`/transactions/${fb.transaction.id}`],
    ['PATCH',`/categories/${fb.category.id}`,{name:'Invadida'}],['DELETE',`/categories/${fb.category.id}`],['PUT',`/categories/${fb.category.id}/budget`,{month,amount:100}],
    ['GET',`/cards/${fb.card.id}`],['PATCH',`/cards/${fb.card.id}`,{name:'Invadido'}],['DELETE',`/cards/${fb.card.id}`],
    ['PATCH',`/purchases/${fb.purchase.id}`,{description:'Invadida',amount:100,categoryId:fa.category.id,date,installments:1}],['DELETE',`/purchases/${fb.purchase.id}`],
    ['GET',`/invoices/${fb.invoice.id}`],['POST',`/invoices/${fb.invoice.id}/payments`,{accountId:fa.account.id,amount:100,date}],
    ['GET',`/investments/${fb.investment.id}`],['PATCH',`/investments/${fb.investment.id}`,{name:'Invadido'}],['DELETE',`/investments/${fb.investment.id}`],
    ['POST',`/investments/${fb.investment.id}/operations`,{type:'DEPOSIT',amount:100,accountId:fa.account.id,date}],['POST',`/investments/${fb.investment.id}/valuations`,{amount:100,date}],
   ];
   for(const [method,path,body] of attempts)assert.equal((await a.raw(method,path,body)).statusCode,404,`${method} ${path}`);
   assert.equal((await b.api('GET','/accounts'))[0].name,'Conta Bob');
  });
  await t.test('Associações entre tenants são recusadas sem movimentações parciais',async()=>{
   const before=await db.transaction.count();
   const attempts:Array<[string,any]>=[
    ['/transfers',{fromId:fa.account.id,toId:fb.account.id,amount:100,date}],
    ['/transactions',{accountId:fa.account.id,categoryId:fb.category.id,description:'Vínculo inválido',amount:100,type:'EXPENSE',date,status:'CONFIRMED'}],
    ['/transactions',{accountId:fb.account.id,categoryId:fa.category.id,description:'Vínculo inválido',amount:100,type:'EXPENSE',date,status:'CONFIRMED'}],
    ['/categories',{name:'Subcategoria inválida',type:'EXPENSE',color:'#123456',parentId:fb.category.id}],
    [`/cards/${fa.card.id}/purchases`,{description:'Vínculo inválido',amount:100,categoryId:fb.category.id,date,installments:1}],
    [`/invoices/${fa.invoice.id}/payments`,{accountId:fb.account.id,amount:100,date}],
    [`/investments/${fa.investment.id}/operations`,{accountId:fb.account.id,type:'DEPOSIT',amount:100,date}],
   ];
   for(const [path,body] of attempts)assert.equal((await a.raw('POST',path,body)).statusCode,404,path);
   assert.equal(await db.transaction.count(),before);
  });
  await t.test('Tenant enviado pelo cliente não altera autorização e a troca de sessão é detectada',async()=>{
   const created=await a.api('POST','/accounts',{name:'Conta extra',institution:'Banco',type:'CASH',initialBalance:0,referenceDate:date,tenantId:bob.tenantId,userId:bob.id});
   assert.equal(created.tenantId,alice.tenantId);assert.equal(created.userId,alice.id);
   await a.api('PATCH','/me',{tenantId:bob.tenantId});assert.equal((await a.api('GET','/me')).tenantId,alice.tenantId);
   assert.equal((await a.raw('GET','/accounts',undefined,{'x-aurora-tenant':bob.tenantId})).statusCode,401);
  });
  await t.test('O próprio PostgreSQL bloqueia vínculos e movimentações de histórico entre tenants',async()=>{
   await assert.rejects(db.creditCard.update({where:{id:fa.card.id},data:{accountId:fb.account.id}}));
   await assert.rejects(db.transaction.create({data:{accountId:fa.account.id,categoryId:fb.category.id,description:'Inválida',amount:100,type:'EXPENSE',date}}));
   await assert.rejects(db.account.update({where:{id:fa.account.id},data:{tenantId:bob.tenantId}}));
   await assert.rejects(db.transaction.update({where:{id:fa.transaction.id},data:{accountId:fb.account.id,categoryId:fb.category.id}}));
   await assert.rejects(db.user.update({where:{id:alice.id},data:{tenantId:bob.tenantId}}));
  });
  await t.test('Recorrências e remoção da demonstração afetam somente o tenant atual',async()=>{
   await a.api('POST','/recurrences/generate');assert.equal((await a.api('GET','/transactions?search=Despesa')).length,2);assert.equal((await b.api('GET','/transactions?search=Despesa')).length,1);
   await c.api('POST','/auth/register',{name:'Carol',email:'carol@exemplo.com',password});const count=await db.account.count();
   await c.api('POST','/demo');assert.ok((await c.api('GET','/dashboard?month='+month)).demo);
   await c.api('DELETE','/demo');assert.equal(await db.account.count(),count);assert.equal((await b.api('GET','/accounts'))[0].id,fb.account.id);
  });
  await t.test('Logout revoga a sessão e sessões vencidas não acessam dados financeiros',async()=>{
   const oldCookie=a.cookie();await a.api('POST','/auth/logout');
   const r=await app.inject({method:'GET',url:'/api/accounts',headers:{cookie:oldCookie}});assert.equal(r.statusCode,401);
   const expired='token-expirado-de-teste';await db.session.create({data:{id:createHash('sha256').update(expired).digest('hex'),userId:alice.id,expiresAt:new Date(0)}});
   assert.equal((await app.inject({method:'GET',url:'/api/me',headers:{cookie:`aurora_session=${expired}`}})).statusCode,401);
   assert.equal((await b.api('GET','/me')).id,bob.id);
  });
 }finally{await app.close();await db.$disconnect();await cleanup();}
});

