import {FastifyInstance} from 'fastify';
import {db} from '../db.js';
import {today,addMonths} from '../finance.js';
import {fail} from '../validation.js';
import {writePurchase} from './cards.js';
export async function demoRoutes(app:FastifyInstance){
 app.post('/api/demo',async(req)=>db.$transaction(async tx=>{
 const userId=req.userId,tenantId=req.tenantId;if(await tx.account.count({where:{tenantId}})||await tx.creditCard.count({where:{tenantId}})||await tx.investment.count({where:{tenantId}}))fail('A demonstração só pode ser carregada em uma conta vazia.');
 const categories=await tx.category.findMany({where:{tenantId}});const cat=(n:string)=>categories.find(c=>c.name===n)!.id;
 const base=today().slice(0,7)+'-01',referenceDate=addMonths(base,-5);
 const a=await tx.account.create({data:{userId,tenantId,name:'Conta principal',institution:'Nubank',type:'CHECKING',initialBalance:450000,referenceDate,color:'#8250be',demo:true}});
 await tx.account.create({data:{userId,tenantId,name:'Reserva do dia a dia',institution:'Inter',type:'SAVINGS',initialBalance:215000,referenceDate,color:'#ed8b4c',demo:true}});
 await tx.account.create({data:{userId,tenantId,name:'Carteira',institution:'Dinheiro em espécie',type:'CASH',initialBalance:35000,referenceDate,color:'#629887',demo:true}});
 const transactions=[];for(let n=-5;n<=0;n++){const d=addMonths(base,n);const data=[{description:'Salário mensal',amount:720000+n*12000,type:'INCOME',categoryId:cat('Salário'),fixed:true},{description:'Aluguel do apartamento',amount:185000,type:'EXPENSE',categoryId:cat('Moradia'),fixed:true},{description:'Supermercado',amount:68990+n*900,type:'EXPENSE',categoryId:cat('Supermercado'),fixed:false},{description:'Restaurante e café',amount:35400-n*1300,type:'EXPENSE',categoryId:cat('Alimentação'),fixed:false},{description:'Transporte do mês',amount:22800,type:'EXPENSE',categoryId:cat('Transporte'),fixed:false},{description:'Projeto freelance',amount:125000+n*5000,type:'INCOME',categoryId:cat('Renda extra'),fixed:false},{description:'Academia',amount:15900,type:'EXPENSE',categoryId:cat('Saúde'),fixed:true}];for(let j=0;j<data.length;j++){const date=d.slice(0,8)+String(Math.min(j+1,Number(today().slice(8)))).padStart(2,'0');transactions.push({...data[j],accountId:a.id,date});}} await tx.transaction.createMany({data:transactions});
 const card=await tx.creditCard.create({data:{userId,tenantId,name:'Meu Nubank',institution:'Nubank',brand:'Mastercard',lastFour:'4829',limit:1500000,closingDay:25,dueDay:5,color:'#7850a5',demo:true}});
 await writePurchase(tx,card,{description:'Notebook • trabalho',amount:359000,date:today(),categoryId:cat('Compras'),installments:6,fixed:false});
 await writePurchase(tx,card,{description:'Jantar de sexta',amount:18990,date:today(),categoryId:cat('Alimentação'),installments:1,fixed:false});
 const investment=await tx.investment.create({data:{userId,tenantId,name:'CDB Reserva de futuro',class:'CDB',institution:'Banco Inter',demo:true}});
 const t=await tx.transaction.create({data:{accountId:a.id,description:'Aporte • CDB Reserva de futuro',amount:1200000,type:'INVESTMENT_IN',date:referenceDate}});
 await tx.investmentOperation.create({data:{investmentId:investment.id,transactionId:t.id,type:'DEPOSIT',amount:1200000,costBasis:1200000,position:1,date:referenceDate}});
 await tx.investmentValuation.create({data:{investmentId:investment.id,amount:1286700,operationCount:1,date:today()}});
 return {data:true};
 },{timeout:30000}));
 app.delete('/api/demo',async(req)=>db.$transaction(async tx=>{
 const userId=req.userId,tenantId=req.tenantId;const cards=await tx.creditCard.findMany({where:{tenantId,demo:true}}),investments=await tx.investment.findMany({where:{tenantId,demo:true}}),accounts=await tx.account.findMany({where:{tenantId,demo:true}});const cardIds=cards.map(c=>c.id),investmentIds=investments.map(i=>i.id),accountIds=accounts.map(a=>a.id);
 // Não remover uma conta de demonstração com vínculos a um cartão/ativo real.
 const linked=await tx.transaction.findMany({where:{accountId:{in:accountIds}},include:{invoicePayment:{include:{invoice:{include:{card:true}}}},investmentOperation:{include:{investment:true}}}});
 if(linked.some(t=>t.invoicePayment&&!t.invoicePayment.invoice.card.demo||t.investmentOperation&&!t.investmentOperation.investment.demo))fail('Há vínculos com registros reais. Arquive as contas de demonstração para preservar o histórico.');
 const groups=linked.flatMap(t=>t.groupId?[t.groupId]:[]);if(groups.length&&await tx.transaction.count({where:{groupId:{in:groups},account:{demo:false}}}))fail('Há transferências com contas reais. Preserve o histórico arquivando as contas de demonstração.');
 if(await tx.creditCard.count({where:{accountId:{in:accountIds},demo:false}}))fail('Há cartões reais vinculados às contas de demonstração. Remova o vínculo antes de apagar a demonstração.');
 const payments=await tx.invoicePayment.findMany({where:{invoice:{cardId:{in:cardIds}}}});const ops=await tx.investmentOperation.findMany({where:{investmentId:{in:investmentIds}}});
 await tx.invoicePayment.deleteMany({where:{invoice:{cardId:{in:cardIds}}}});await tx.cardInstallment.deleteMany({where:{purchase:{cardId:{in:cardIds}}}});await tx.cardPurchase.deleteMany({where:{cardId:{in:cardIds}}});await tx.creditCardInvoice.deleteMany({where:{cardId:{in:cardIds}}});await tx.creditCard.deleteMany({where:{id:{in:cardIds}}});
 await tx.investmentOperation.deleteMany({where:{investmentId:{in:investmentIds}}});await tx.investmentValuation.deleteMany({where:{investmentId:{in:investmentIds}}});await tx.investment.deleteMany({where:{id:{in:investmentIds}}});
 await tx.transaction.deleteMany({where:{OR:[{accountId:{in:accountIds}},{id:{in:[...payments.map(p=>p.transactionId),...ops.flatMap(o=>o.transactionId?[o.transactionId]:[])]}}]}});await tx.account.deleteMany({where:{id:{in:accountIds}}});return {data:true};
 }));
}

