import {useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Download,Printer,TrendingUp} from 'lucide-react';
import {CashChart,Donut} from './charts';
import {Empty,Money,Panel,Stat} from './components/common';
import {Button} from './components/ui/button';
import {DataState,useApp,useData} from './context';
import {day,download,monthLabel} from './lib';
import {ReportTabs} from './report-tabs';
import './report-print.css';

type Spending={name:string;color:string;amount:number};
type Category=Spending & {id:string;parentId?:string|null};
type Card=Spending & {id?:string};
type Expense={id:string;description:string;categoryId:string|null;date:string;amount:number;cardId?:string};
type MonthReport={
 month:string;
 income:number;
 expense:number;
 fixed:number;
 commitment:number;
 expensesByCategory:Category[];
 cardSpending:Card[];
 largest:Expense[];
 evolution:{label:string;income:number;expense:number;investments:number;wealth:number}[];
};

function sumAmounts(entries:Spending[]){return entries.reduce((sum,entry)=>sum+entry.amount,0);}
const percent=(part:number,total:number)=>total
 ?(part/total).toLocaleString('pt-BR',{style:'percent',maximumFractionDigits:1})
 :'—';

function summarize(periods:MonthReport[]){
 const categories=new Map<string|null,Category>();
 const cards=new Map<string,Card>();
 let income=0,expense=0,fixed=0;
 for(const period of periods){
  income+=period.income;
  expense+=period.expense;
  fixed+=period.fixed;
  for(const category of period.expensesByCategory){
   categories.set(category.id,{...category,amount:(categories.get(category.id)?.amount??0)+category.amount});
  }
  for(const card of period.cardSpending){
   const key=card.id??card.name;
   cards.set(key,{...card,amount:(cards.get(key)?.amount??0)+card.amount});
  }
 }
 const uncategorized=expense-sumAmounts([...categories.values()]);
 if(uncategorized>0)categories.set(null,{id:'',name:'Sem categoria',color:'#788983',amount:uncategorized});
 const ranked=[...categories.values()].filter(c=>c.amount>0).sort((a,b)=>b.amount-a.amount).map(c=>{
  const parent=c.parentId?categories.get(c.parentId):undefined;
  return {...c,name:parent?`${parent.name} › ${c.name}`:c.name};
 });
 const cardTotals=[...cards.values()].filter(c=>c.amount>0).sort((a,b)=>b.amount-a.amount);
 const largest=periods.flatMap(p=>p.largest).sort((a,b)=>b.amount-a.amount).slice(0,10);
 return {income,expense,fixed,categories,ranked,cardTotals,largest,cardExpense:sumAmounts(cardTotals)};
}

function SpendingSummary({periods,from,to}:{periods:MonthReport[];from:string;to:string}){
 const {hidden}=useApp();
 const latest=periods.at(-1);
 if(!latest)return <Empty/>;
 const {income,expense,fixed,categories,ranked,cardTotals,largest,cardExpense}=summarize(periods);
 const lead=ranked[0];
 const evolution=periods.length===1?latest.evolution:periods.map(p=>({...p.evolution.at(-1),label:monthLabel(p.month)}));
 const periodLabel=from===to?monthLabel(from):`${monthLabel(from)} a ${monthLabel(to)}`;
 return <>
  <div className="spending-toolbar">
   <p><strong>Período analisado</strong> {periodLabel}</p>
   <div className="flex-actions spending-controls">
    <Button variant="outline" onClick={()=>download(periods,`aurora-relatorio-${from}-${to}.json`)}><Download size={15}/> Exportar JSON</Button>
    <Button onClick={()=>window.print()}><Printer size={16}/> Exportar PDF</Button>
   </div>
  </div>
  <div className="three-stats">
   <Stat label="Receitas no período" value={income} icon={ArrowDownLeft}/>
   <Stat label="Total gasto no período" value={expense} icon={ArrowUpRight} color="peach"/>
   <Stat label="Resultado no período" value={income-expense} icon={TrendingUp} color="violet" sub="Receitas menos despesas"/>
  </div>
  <Panel title="Despesas por categoria" subtitle="Categorias em ordem de impacto no total gasto." className="spending-section">
   {lead?<div className="spending-highlight">
    <strong>{lead.name}</strong> foi a categoria com maior gasto, com <strong><Money value={lead.amount}/></strong> ({percent(lead.amount,expense)} do total).
   </div>:<Empty title="Sem despesas neste período" description="Seus gastos por categoria aparecem aqui quando você registra despesas."/>}
   {lead&&<div className="table-scroll"><table>
    <thead><tr><th scope="col">Categoria</th><th scope="col" className="number">Total gasto</th><th scope="col" className="number">% do total</th></tr></thead>
    <tbody>{ranked.map(c=><tr key={c.id}>
     <td><span className="spending-category"><i className="dot" style={{background:c.color}}/>{c.name}</span></td>
     <td className="number"><Money value={c.amount}/></td>
     <td className="number">{percent(c.amount,expense)}</td>
    </tr>)}</tbody>
   </table></div>}
  </Panel>
  <div className="report-grid spending-section">
   <Panel title="Como você gastou">
    <div className="report-list">
     <div><span>Despesas em conta</span><strong><Money value={expense-cardExpense}/></strong></div>
     <div><span>Parcelas no cartão</span><strong><Money value={cardExpense}/></strong></div>
     <div><span>Despesas fixas</span><strong><Money value={fixed}/></strong></div>
     <div><span>Despesas variáveis</span><strong><Money value={expense-fixed}/></strong></div>
    </div>
   </Panel>
   <Panel title="Gastos por cartão" subtitle="Parcelas das faturas do período.">
    {cardTotals.length?<div className="report-list">{cardTotals.map(c=><div key={c.id??c.name}>
     <span className="dot" style={{background:c.color}}/><span>{c.name}</span><strong><Money value={c.amount}/></strong>
    </div>)}</div>:<Empty title="Sem parcelas no período" description="As parcelas aparecem no mês da respectiva fatura."/>}
    {latest.income>0&&<p className="footnote px">Faturas em aberto equivalem a {percent(latest.commitment,100)} da renda de {monthLabel(latest.month)}.</p>}
   </Panel>
  </div>
  <Panel title="Maiores despesas do período" subtitle="Até 10 lançamentos, incluindo parcelas de cartão." className="spending-section">
   {largest.length?<div className="table-scroll"><table>
    <thead><tr><th scope="col">Descrição</th><th scope="col">Categoria</th><th scope="col">Data</th><th scope="col" className="number">Valor</th></tr></thead>
    <tbody>{largest.map(t=><tr key={t.id}>
     <td>{t.description}{t.cardId&&<small className="spending-entry-type">Parcela no cartão</small>}</td>
     <td>{categories.get(t.categoryId)?.name??'Sem categoria'}</td>
     <td className="nowrap">{day(t.date)}</td>
     <td className="number"><Money value={t.amount}/></td>
    </tr>)}</tbody>
   </table></div>:<Empty title="Sem lançamentos para destacar" description="As maiores despesas aparecem aqui após o registro."/>}
  </Panel>
  <Panel title="Resumo mês a mês" className="spending-section">
   <div className="table-scroll"><table>
    <thead><tr><th scope="col">Mês</th><th scope="col" className="number">Receitas</th><th scope="col" className="number">Despesas</th><th scope="col" className="number">Resultado</th></tr></thead>
    <tbody>{periods.map(p=><tr key={p.month}>
     <td>{monthLabel(p.month)}</td><td className="number"><Money value={p.income}/></td>
     <td className="number"><Money value={p.expense}/></td><td className="number"><Money value={p.income-p.expense}/></td>
    </tr>)}</tbody>
   </table></div>
  </Panel>
  {!hidden&&<div className="report-grid spending-controls">
   <Panel title="Receitas × despesas" subtitle={periods.length===1?'Últimos seis meses até o mês selecionado':'Comparativo mensal do período'}><CashChart data={evolution}/></Panel>
   <Panel title="Distribuição dos gastos"><Donut data={ranked} total={expense}/></Panel>
   <Panel title="Evolução do patrimônio" subtitle="Saldos + investimentos − obrigações de cartão"><CashChart data={evolution} mode="wealth"/></Panel>
   <Panel title="Evolução dos investimentos"><CashChart data={evolution} mode="investments"/></Panel>
  </div>}
  <p className="spending-method">O relatório soma despesas em conta efetivadas e parcelas pelo mês da fatura. A data exibida para parcelas é a do fechamento da fatura. Pagamentos de fatura e transferências ficam fora desse total.</p>
 </>;
}

export default function Reports(){
 const {month}=useApp();
 const [range,setRange]=useState<{from:string;to:string}>();
 const {from,to}=range??{from:month,to:month};
 const query=useData(`/reports?from=${from}&to=${to}`);
 return <article className="spending-report">
  <div className="page-heading">
   <div><div className="eyebrow">AURORA FINANÇAS</div><h1>Relatório de gastos</h1><p>Veja quanto você gastou e quais categorias mais pesaram no período.</p></div>
   <div className="period-range spending-controls">
    <label>De<input type="month" value={from} onChange={e=>{const value=e.target.value;if(value)setRange({from:value,to:value>to?value:to});}}/></label>
    <span>—</span>
    <label>Até<input type="month" value={to} onChange={e=>{const value=e.target.value;if(value)setRange({from:value<from?value:from,to:value});}}/></label>
   </div>
  </div>
  <div className="spending-controls"><ReportTabs/></div>
  <DataState query={query}>{periods=><SpendingSummary periods={periods} from={from} to={to}/>}</DataState>
 </article>;
}
