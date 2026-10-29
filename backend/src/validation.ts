import {z} from 'zod';
export const money=z.number().int().min(1).max(2_000_000_000);
export const nonnegative=z.number().int().min(0).max(2_000_000_000);
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Data inválida');
export const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const name=z.string().trim().min(1).max(120);
export const expenseItemsSchema=z.array(z.object({name:name.transform(s=>s.replace(/\s+/g,' ')),amount:money})).max(100,'Use até 100 itens por despesa.');
export const compositionSchema=z.object({items:expenseItemsSchema});
export const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const accountSchema=z.object({name,institution:name,type:z.enum(['CHECKING','SAVINGS','CASH','OTHER']),initialBalance:z.number().int().min(-2_000_000_000).max(2_000_000_000),referenceDate:date.refine(s=>s<=new Date().toISOString().slice(0,10),'O saldo inicial não pode ser futuro.'),color:color.default('#0e8063'),icon:z.string().max(30).default('wallet'),active:z.boolean().default(true)});
export const transactionSchema=z.object({description:name,amount:money,items:expenseItemsSchema.default([]),type:z.enum(['INCOME','EXPENSE']),accountId:z.string(),categoryId:z.string(),date,status:z.enum(['PLANNED','CONFIRMED']),note:z.string().max(1000).default(''),fixed:z.boolean().default(false),recurrence:z.enum(['MONTHLY']).nullable().default(null)});
export const categorySchema=z.object({name,type:z.enum(['INCOME','EXPENSE']),color,icon:z.string().max(30).default('tag'),parentId:z.string().nullable().default(null)});
export const cardSchema=z.object({name,institution:name,accountId:z.string().min(1).nullable().default(null),brand:name,lastFour:z.string().regex(/^\d{0,4}$/).default(''),limit:money,closingDay:z.number().int().min(1).max(31),dueDay:z.number().int().min(1).max(31),color:color.default('#174e3c'),active:z.boolean().default(true)});
export const purchaseSchema=z.object({description:name,amount:money,items:expenseItemsSchema.optional(),categoryId:z.string(),date,installments:z.number().int().min(1).max(48),paidInstallments:z.number().int().min(0).max(47).default(0),firstInvoiceMonth:month.optional(),fixed:z.boolean().default(false)}).refine(v=>v.amount>=v.installments,'Valor insuficiente para o número de parcelas').refine(v=>v.paidInstallments<v.installments,'As parcelas já pagas devem ser menores que o total de parcelas.').refine(v=>!v.paidInstallments||!!v.firstInvoiceMonth,'Informe a primeira fatura das parcelas restantes.');
export const investmentSchema=z.object({name,class:z.enum(['Renda fixa','Tesouro Direto','CDB','LCI/LCA','Ações','Fundos imobiliários','ETFs','Criptomoedas','Outros']),institution:name,quantity:z.number().nonnegative().nullable().default(null),note:z.string().max(1000).default(''),active:z.boolean().default(true)});
export function fail(message:string,statusCode=400):never{throw Object.assign(new Error(message),{statusCode});}
