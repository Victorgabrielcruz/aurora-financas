import {expenseItemsSchema,fail} from './validation.js';
export type ExpenseItem={name:string,amount:number};
export function readItems(value:unknown):ExpenseItem[]{const result=expenseItemsSchema.safeParse(value);return result.success?result.data:[];}
export function validateItems(value:unknown,amount:number,type='EXPENSE'){
 const items=readItems(value);
 if(items.length&&type!=='EXPENSE')fail('A composição está disponível apenas para despesas.');
 if(items.reduce((sum,item)=>sum+item.amount,0)>amount)fail('A soma dos itens não pode ultrapassar o valor da despesa.');
 return items;
}
export function itemReport(expenses:Array<{id:string,amount:number,items:unknown}>){
 const groups=new Map<string,{name:string,amount:number,purchases:number}>();let total=0,detailed=0;
 for(const expense of expenses){
  total+=expense.amount;const seen=new Set<string>();
  for(const item of readItems(expense.items)){
   const key=item.name.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
   const group=groups.get(key)??{name:item.name,amount:0,purchases:0};
   group.amount+=item.amount;detailed+=item.amount;
   if(!seen.has(key)){group.purchases++;seen.add(key);}
   groups.set(key,group);
  }
 }
 return {total,detailed,undetailed:total-detailed,coverage:total?detailed/total*100:0,purchases:expenses.length,items:[...groups.values()].sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name,'pt-BR')).map(item=>({...item,percentage:total?item.amount/total*100:0}))};
}
