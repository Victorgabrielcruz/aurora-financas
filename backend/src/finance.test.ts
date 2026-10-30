import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balance,splitInstallments,invoiceDates,invoiceSummary,investmentSummary,addMonths,purchasePlan,dailyOverview} from './finance.js';

test('Visão diária distingue consumo e caixa, incluindo pagamentos e saldo inicial da referência',()=>{
 const date='2025-10-29';
 const accounts=[{initialBalance:100000,referenceDate:date,transactions:[
  {date,type:'INCOME',amount:20000,status:'CONFIRMED'},
  {date,type:'EXPENSE',amount:5000,status:'CONFIRMED'},
  {date,type:'INVOICE_PAYMENT',amount:1000,status:'CONFIRMED'},
  {date,type:'INVESTMENT_IN',amount:2000,status:'CONFIRMED'},
  {date,type:'EXPENSE',amount:99000,status:'PLANNED'},
 ]}];
 const result=dailyOverview(accounts,[{date,amount:30000}],date);
 assert.deepEqual(result,{date,income:20000,cashExpense:5000,cardExpense:30000,expense:35000,result:-15000,openingBalance:100000,closingBalance:112000,cashChange:12000});
 const empty=dailyOverview(accounts,[],'2025-10-30');
 assert.equal(empty.openingBalance,112000);assert.equal(empty.closingBalance,112000);assert.equal(empty.result,0);assert.equal(empty.cashChange,0);
 const past=dailyOverview(accounts,[],'2025-10-28');assert.equal(past.closingBalance,0);
 const future=dailyOverview(accounts,[],'2099-01-01');assert.equal(future.cashChange,0);
});
test('Saldo inclui só movimentações efetivadas a partir da referência',()=>{assert.equal(balance({initialBalance:10000,referenceDate:'2026-01-01',transactions:[{amount:2000,type:'INCOME',date:'2026-01-01',status:'CONFIRMED'},{amount:500,type:'EXPENSE',date:'2026-01-03',status:'CONFIRMED'},{amount:50000,type:'EXPENSE',date:'2025-12-31',status:'CONFIRMED'},{amount:900,type:'EXPENSE',date:'2026-01-03',status:'PLANNED'},{amount:300,type:'EXPENSE',date:'2027-01-03',status:'CONFIRMED'}]},'2026-01-31'),11500);});
test('Parcelamento mantém centavos e soma exata',()=>{assert.deepEqual(splitInstallments(10000,3),[3334,3333,3333]);for(let count=1;count<=48;count++){const values=splitInstallments(123456,count);assert.equal(values.reduce((a,b)=>a+b,0),123456);assert.ok(Math.max(...values)-Math.min(...values)<=1);}});
test('Fechamento inclui próximo ciclo no dia do corte',()=>{assert.deepEqual(invoiceDates('2026-10-24',25,5),{month:'2026-10',closingDate:'2026-10-25',dueDate:'2026-11-05'});assert.deepEqual(invoiceDates('2026-10-25',25,5),{month:'2026-11',closingDate:'2026-11-25',dueDate:'2026-12-05'});assert.equal(invoiceDates('2026-12-26',25,5,1).month,'2027-02');});
test('Dias 29–31 são ajustados ao fim do mês e respeitam corte real',()=>{assert.deepEqual(invoiceDates('2026-02-28',31,10),{month:'2026-03',closingDate:'2026-03-31',dueDate:'2026-04-10'});assert.deepEqual(invoiceDates('2026-02-27',29,30),{month:'2026-02',closingDate:'2026-02-28',dueDate:'2026-03-30'});assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(addMonths('2024-01-31',1),'2024-02-29');});
test('Situações de fatura: aberta, fechada, parcial, paga e vencida',()=>{const i={closingDate:'2026-10-25',dueDate:'2026-11-05',installments:[{amount:10000}],payments:[]};assert.equal(invoiceSummary(i,'2026-10-24').status,'OPEN');assert.equal(invoiceSummary(i,'2026-10-25').status,'CLOSED');assert.equal(invoiceSummary({...i,payments:[{amount:2000}]},'2026-10-26').status,'PARTIAL');assert.equal(invoiceSummary({...i,payments:[{amount:2000},{amount:8000}]},'2026-10-26').status,'PAID');assert.equal(invoiceSummary(i,'2026-11-06').status,'OVERDUE');});
test('Valorização e aporte no mesmo instante não duplicam capital',()=>{const t=new Date();const i={operations:[{position:1,type:'DEPOSIT',amount:10000,costBasis:10000,date:'2026-10-01',createdAt:t},{position:2,type:'DEPOSIT',amount:2000,costBasis:2000,date:'2026-10-02',createdAt:t}],valuations:[{amount:11000,date:'2026-10-02',createdAt:t,operationCount:1}]};const s=investmentSummary(i,'2026-10-02');assert.equal(s.invested,12000);assert.equal(s.current,13000);assert.equal(s.profit,1000);});

test('Compra antiga gera só parcelas restantes, com numeração e centavos originais',()=>{
 const plan=purchasePlan({amount:100001,installments:6,paidInstallments:4,firstInvoiceMonth:'2026-12',date:'2026-05-10'},{closingDay:25,dueDay:5});
 assert.deepEqual(plan,[{number:5,amount:16667,month:'2026-12',closingDate:'2026-12-25',dueDate:'2027-01-05'},{number:6,amount:16666,month:'2027-01',closingDate:'2027-01-25',dueDate:'2027-02-05'}]);
});
test('Fatura explícita respeita mês escolhido mesmo com fechamento no dia 1',()=>{
 const plan=purchasePlan({amount:10000,installments:2,firstInvoiceMonth:'2026-02',date:'2026-01-02'},{closingDay:1,dueDay:10});
 assert.deepEqual(plan.map(p=>[p.month,p.closingDate,p.dueDate]),[['2026-02','2026-02-01','2026-02-10'],['2026-03','2026-03-01','2026-03-10']]);
});
test('Parcelamento sem opções mantém o cálculo automático existente',()=>{
 const plan=purchasePlan({amount:10000,installments:3,date:'2026-10-25'},{closingDay:25,dueDay:5});
 assert.deepEqual(plan.map(p=>[p.number,p.amount,p.month]),[[1,3334,'2026-11'],[2,3333,'2026-12'],[3,3333,'2027-01']]);
});
