export const today = () => new Date().toISOString().slice(0,10);
export function transactionMonth(t:{type:string,date:string,referenceMonth?:string|null}){
 return t.type==='INCOME'&&t.referenceMonth?t.referenceMonth:t.date.slice(0,7);
}
export function addMonths(date:string,n:number) {
 const [y,m,d]=date.split('-').map(Number); const end=new Date(Date.UTC(y,m+n,0)).getUTCDate();
 return new Date(Date.UTC(y,m-1+n,Math.min(d,end))).toISOString().slice(0,10);
}
export function monthDate(month:string,day:number){const [y,m]=month.split('-').map(Number);return `${month}-${String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`;}
export function invoiceDates(date:string,closingDay:number,dueDay:number,offset=0){
 // Compras no dia de fechamento entram na próxima fatura.
 const month=addMonths(date,offset+(date>=monthDate(date.slice(0,7),closingDay)?1:0)).slice(0,7);
 return invoiceMonthDates(month,closingDay,dueDay);
}
export function invoiceMonthDates(month:string,closingDay:number,dueDay:number){
 const closingDate=monthDate(month,closingDay);
 const dueMonth=monthDate(month,dueDay)<=closingDate?addMonths(`${month}-01`,1).slice(0,7):month;
 return {month,closingDate,dueDate:monthDate(dueMonth,dueDay)};
}
export function splitInstallments(amount:number,count:number){return Array.from({length:count},(_,i)=>Math.floor(amount/count)+(i<amount%count?1:0));}
export const signedAmount=(t:{type:string,amount:number})=>['INCOME','TRANSFER_IN','INVESTMENT_OUT','ADJUSTMENT_IN'].includes(t.type)?t.amount:-t.amount;
export function balance(account:{initialBalance:number,referenceDate:string,transactions:Array<{date:string,status:string,type:string,amount:number}>},at=today()){
 if(at<account.referenceDate)return 0;
 return account.initialBalance+account.transactions.filter(t=>t.status==='CONFIRMED'&&t.date>=account.referenceDate&&t.date<=at).reduce((s,t)=>s+signedAmount(t),0);
}
export function invoiceSummary(invoice:any,at=today()){
 const total=invoice.installments.reduce((s:number,x:any)=>s+x.amount,0),paid=invoice.payments.reduce((s:number,x:any)=>s+x.amount,0),remaining=total-paid;
 const status=remaining<=0&&total>0?'PAID':at>invoice.dueDate?'OVERDUE':paid>0?'PARTIAL':at>=invoice.closingDate?'CLOSED':'OPEN';
 return {...invoice,total,paid,remaining,status};
}
export function investmentSummary(investment:any,at=today()){
 const operations=investment.operations.filter((o:any)=>o.date<=at);
 const invested=operations.reduce((s:number,o:any)=>s+(o.type==='DEPOSIT'?o.costBasis:-o.costBasis),0);
 const valuations=investment.valuations.filter((v:any)=>v.date<=at).sort((a:any,b:any)=>b.date.localeCompare(a.date)||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
 const valuation=valuations[0];
 const current=valuation?valuation.amount+operations.filter((o:any)=>o.position>valuation.operationCount).reduce((s:number,o:any)=>s+(o.type==='DEPOSIT'?o.amount:-o.amount),0):operations.reduce((s:number,o:any)=>s+(o.type==='DEPOSIT'?o.amount:-o.amount),0);
 return {...investment,invested,current,profit:current-invested,returnPct:invested>0?(current-invested)/invested*100:0};
}

export function purchasePlan(input:{amount:number,installments:number,paidInstallments?:number,firstInvoiceMonth?:string,date:string},card:{closingDay:number,dueDay:number}){
 const paid=input.paidInstallments??0;
 return splitInstallments(input.amount,input.installments).slice(paid).map((amount,index)=>({
  number:paid+index+1,amount,
  ...(input.firstInvoiceMonth?invoiceMonthDates(addMonths(`${input.firstInvoiceMonth}-01`,index).slice(0,7),card.closingDay,card.dueDay):invoiceDates(input.date,card.closingDay,card.dueDay,index)),
 }));
}
