import {offlineClient} from './offline';
import {clsx,ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
export const cn=(...v:ClassValue[])=>twMerge(clsx(v));
export const brl=(v:number=0)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
export const shortMoney=(v:number)=>Math.abs(v)>=100000?`${(v/100000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`:brl(v);
export const day=(s:string)=>s?new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
export const today=()=>new Date().toISOString().slice(0,10);
export const monthLabel=(s:string)=>new Date(s+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
export const labels:Record<string,string>={INCOME:'Receita',EXPENSE:'Despesa',CREDIT_CARD:'Compra no cartão',TRANSFER_IN:'Transferência recebida',TRANSFER_OUT:'Transferência enviada',INVESTMENT_IN:'Aporte',INVESTMENT_OUT:'Resgate',INVOICE_PAYMENT:'Pagamento de fatura',ADJUSTMENT_IN:'Ajuste positivo',ADJUSTMENT_OUT:'Ajuste negativo',PLANNED:'Previsto',CONFIRMED:'Efetivado',OPEN:'Aberta',CLOSED:'Fechada',PAID:'Paga',PARTIAL:'Parcialmente paga',OVERDUE:'Vencida',DEPOSIT:'Aporte',WITHDRAW:'Resgate',CHECKING:'Conta corrente',SAVINGS:'Poupança',CASH:'Dinheiro físico',OTHER:'Outra'};
export const positive=(type:string)=>['INCOME','TRANSFER_IN','INVESTMENT_OUT','ADJUSTMENT_IN'].includes(type);
export async function request(path:string,method='GET',body?:unknown,tenantId?:string){return offlineClient.request(path,method,body,tenantId);}
export function download(data:unknown,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
