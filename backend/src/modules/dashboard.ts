import {FastifyInstance} from 'fastify';
import {itemReport} from '../expense-items.js';
import {db} from '../db.js';
import {balance,investmentSummary,invoiceSummary,addMonths,today,transactionMonth,dailyOverview} from '../finance.js';
import {date,month,fail} from '../validation.js';
export async function snapshot(tenantId:string,selected:string){
 const [accounts,categories,cards,investments]=await Promise.all([db.account.findMany({where:{tenantId},include:{transactions:{include:{category:true,account:true}}}}),db.category.findMany({where:{tenantId},include:{budgets:true}}),db.creditCard.findMany({where:{tenantId},include:{purchases:{include:{category:true}},invoices:{include:{installments:{include:{purchase:true}},payments:true}}}}),db.investment.findMany({where:{tenantId},include:{operations:true,valuations:true}})]);
 const transactions=accounts.flatMap(a=>a.transactions);const purchases=cards.flatMap(c=>c.purchases);const start=`${selected}-01`;const effective=transactions.filter(t=>t.status==='CONFIRMED'&&transactionMonth(t)===selected&&t.date<=today());// Monthly expenses follow the invoice label (closing month), one installment at a time.
 const cardExpenses=cards.flatMap(c=>c.invoices.flatMap(i=>i.installments.filter(part=>part.purchase.date<=today()).map(part=>({...part.purchase,id:part.id,amount:part.amount,invoiceMonth:i.month,date:i.closingDate,cardId:c.id}))));
 const purchased=cardExpenses.filter(p=>p.invoiceMonth===selected);
 const income=effective.filter(t=>t.type==='INCOME').reduce((s,t)=>s+t.amount,0);const expense=effective.filter(t=>t.type==='EXPENSE').reduce((s,t)=>s+t.amount,0)+purchased.reduce((s,p)=>s+p.amount,0);
 const currentInvestments=investments.map(i=>investmentSummary(i));const invoices=cards.flatMap(c=>c.invoices.map(i=>({...invoiceSummary(i),card:{id:c.id,name:c.name,color:c.color}}))).filter(i=>i.total>0);
 const available=accounts.reduce((s,a)=>s+balance(a),0),invested=currentInvestments.reduce((s,i)=>s+i.invested,0),current=currentInvestments.reduce((s,i)=>s+i.current,0),owed=invoices.reduce((s,i)=>s+i.remaining,0);
 const expensesByCategory=categories.filter(c=>c.type==='EXPENSE').map(c=>({...c,amount:effective.filter(t=>t.type==='EXPENSE'&&t.categoryId===c.id).reduce((s,t)=>s+t.amount,0)+purchased.filter(p=>p.categoryId===c.id).reduce((s,p)=>s+p.amount,0),budget:c.budgets.find(b=>b.month===selected)?.amount??0})).sort((a,b)=>b.amount-a.amount);
 const evolution=Array.from({length:6},(_,n)=>{const from=addMonths(start,n-5),to=addMonths(from,1);const at=[today(),new Date(Date.parse(to)-86400000).toISOString().slice(0,10)].sort()[0];const ts=transactions.filter(t=>t.status==='CONFIRMED'&&transactionMonth(t)===from.slice(0,7)&&t.date<=today());const ps=cardExpenses.filter(p=>p.invoiceMonth===from.slice(0,7));const inc=ts.filter(t=>t.type==='INCOME').reduce((s,t)=>s+t.amount,0),exp=ts.filter(t=>t.type==='EXPENSE').reduce((s,t)=>s+t.amount,0)+ps.reduce((s,p)=>s+p.amount,0);const cash=accounts.reduce((s,a)=>s+balance(a,at),0);const portfolio=investments.reduce((s,i)=>s+investmentSummary(i,at).current,0);const debt=invoices.flatMap(i=>i.installments).filter(i=>i.purchase.date<=at).reduce((s,i)=>s+i.amount,0)-invoices.flatMap(i=>i.payments).filter(p=>p.date<=at).reduce((s,p)=>s+p.amount,0);return {month:from.slice(0,7),label:new Date(`${from}T12:00:00Z`).toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),income:inc,expense:exp,balance:cash,investments:portfolio,wealth:cash+portfolio-debt};});
 const distribution=Object.entries(currentInvestments.reduce((acc:Record<string,number>,i)=>({...acc,[i.class]:(acc[i.class]??0)+i.current}),{})).map(([name,amount])=>({name,amount}));
 const fixed=effective.filter(t=>t.type==='EXPENSE'&&t.fixed).reduce((s,t)=>s+t.amount,0)+purchased.filter(p=>p.fixed).reduce((s,p)=>s+p.amount,0);
 return {month:selected,daily:dailyOverview(accounts,purchases),available,income,expense,result:income-expense,invested,current,owed,wealth:available+current-owed,evolution,expensesByCategory,distribution,invoices:invoices.filter(i=>i.remaining>0).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),accounts:accounts.map(a=>({...a,balance:balance(a),transactions:undefined})),recent:transactions.filter(t=>transactionMonth(t)===selected).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.getTime()-a.createdAt.getTime()).slice(0,5),cardSpending:cards.map(c=>({name:c.name,color:c.color,amount:purchased.filter(p=>p.cardId===c.id).reduce((s,p)=>s+p.amount,0)})),largest:[...effective.filter(t=>t.type==='EXPENSE'),...purchased].sort((a,b)=>b.amount-a.amount).slice(0,8),fixed,variable:expense-fixed,commitment:income>0?owed/income*100:0,demo:accounts.some(a=>a.demo)||cards.some(c=>c.demo)||investments.some(i=>i.demo)};
}
export async function dashboardRoutes(app:FastifyInstance){
 app.get('/api/reports/daily',async(req)=>{
  const selected=date.parse((req.query as any).date??today());
  const dates={equals:selected,lte:today()};
  const [transactions,purchases,accounts]=await Promise.all([
   db.transaction.findMany({where:{account:{tenantId:req.tenantId},type:{in:['INCOME','EXPENSE']},status:'CONFIRMED',date:dates},select:{id:true,description:true,type:true,amount:true,date:true,items:true,category:{select:{name:true,color:true,icon:true}},account:{select:{name:true}}}}),
   db.cardPurchase.findMany({where:{card:{tenantId:req.tenantId},date:dates},select:{id:true,description:true,amount:true,date:true,items:true,category:{select:{name:true,color:true,icon:true}},card:{select:{name:true}}}}),
   db.account.findMany({where:{tenantId:req.tenantId},include:{transactions:true}}),
  ]);
  const entries=[...transactions,...purchases.map(({card,...p})=>({...p,type:'CREDIT_CARD',account:card}))].sort((a,b)=>b.amount-a.amount||a.description.localeCompare(b.description,'pt-BR'));
  return {data:{...dailyOverview(accounts,purchases,selected),entries}};
 });
 app.get('/api/dashboard',async(req)=>({data:await snapshot(req.tenantId,month.parse((req.query as any).month??today().slice(0,7)))}));
 app.get('/api/reports/items',async(req)=>{
  const q=req.query as any;const from=month.parse(q.from??today().slice(0,7)),to=month.parse(q.to??from);
  if(from>to||Number(to.slice(0,4))-Number(from.slice(0,4))>5)fail('Selecione um período válido de até cinco anos.');
  const dates={gte:`${from}-01`,lt:addMonths(`${to}-01`,1),lte:today()};
  const [transactions,purchases]=await Promise.all([
   db.transaction.findMany({where:{account:{tenantId:req.tenantId},type:'EXPENSE',status:'CONFIRMED',date:dates},select:{id:true,amount:true,items:true}}),
   db.cardPurchase.findMany({where:{card:{tenantId:req.tenantId},date:dates},select:{id:true,amount:true,items:true}}),
  ]);
  return {data:{from,to,...itemReport([...transactions,...purchases])}};
 });
 app.get('/api/reports',async(req)=>{const q=req.query as any;const from=month.parse(q.from??today().slice(0,7)),to=month.parse(q.to??from);if(from>to||Number(to.slice(0,4))-Number(from.slice(0,4))>5)throw Object.assign(new Error('Selecione um período válido de até cinco anos.'),{statusCode:400});const months=[];for(let m=from;m<=to;m=addMonths(`${m}-01`,1).slice(0,7))months.push(await snapshot(req.tenantId,m));return {data:months};});
 app.get('/api/export',async(req)=>({data:{exportedAt:new Date().toISOString(),tenant:await db.tenant.findUnique({where:{id:req.tenantId},select:{id:true,name:true}}),user:await db.user.findUnique({where:{id:req.userId},select:{name:true,email:true}}),accounts:await db.account.findMany({where:{tenantId:req.tenantId},include:{transactions:true}}),categories:await db.category.findMany({where:{tenantId:req.tenantId},include:{budgets:true}}),cards:await db.creditCard.findMany({where:{tenantId:req.tenantId},include:{purchases:{include:{installments:true}},invoices:{include:{payments:true}}}}),investments:await db.investment.findMany({where:{tenantId:req.tenantId},include:{operations:true,valuations:true}})}}));
}
