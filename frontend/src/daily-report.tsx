import {useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,TrendingUp,Download,Wallet,ArrowLeftRight} from 'lucide-react';
import {useApp,useData,DataState} from './context';
import {Panel,Empty,Stat,TransactionRows,Money} from './components/common';
import {Button} from './components/ui/button';
import {ReportTabs} from './report-tabs';
import {day,download,today} from './lib';

export type DailyReportData={
 date:string;
 income:number;
 expense:number;
 result:number;
 openingBalance:number;
 closingBalance:number;
 cashChange:number;
 cashExpense:number;
 cardExpense:number;
 entries:{id:string;description:string;type:string;amount:number;date:string;items:unknown;category:{name:string;color:string;icon:string};account:{name:string}}[];
};

export type DailySummaryData=Omit<DailyReportData,'entries'>;
export function DailySummary({data}:{data:DailySummaryData}){
 return <>
  <div className="daily-stats">
   <Stat label="Receitas do dia" value={data.income} icon={ArrowDownLeft} sub="Entradas efetivadas na data"/>
   <Stat label="Total gasto no dia" value={data.expense} icon={ArrowUpRight} color="peach" sub="Despesas em conta e compras no cartão"/>
   <Stat label="Resultado do dia" value={data.result} icon={TrendingUp} color="violet" sub="Receitas menos o total gasto no dia"/>
   <Stat label="Saldo ao final do dia" value={data.closingBalance} icon={Wallet} sub="Saldo das contas após as movimentações"/>
  </div>
  <div className="daily-details">
   <span>Saldo inicial <strong><Money value={data.openingBalance}/></strong></span>
   <span>Gasto em conta <strong><Money value={data.cashExpense}/></strong></span>
   <span>Compras no cartão <strong><Money value={data.cardExpense}/></strong></span>
   <span><ArrowLeftRight size={14}/> Variação nas contas <strong><Money value={data.cashChange}/></strong></span>
  </div>
 </>;
}

export function DailyReportContent({data}:{data:DailyReportData}){
 return <>
  <DailySummary data={data}/>
  <Panel title={`Movimentações de ${day(data.date)}`} subtitle={`${data.entries.length} lançamento(s) · Receitas e despesas efetivadas e compras no cartão.`} action={<Button variant="ghost" size="sm" onClick={()=>download(data,`aurora-relatorio-diario-${data.date}.json`)}><Download size={15}/> Exportar</Button>}>
   {data.entries.length?<TransactionRows data={data.entries}/>:<Empty title="Nenhuma movimentação neste dia" description="Selecione outra data ou registre uma receita, despesa ou compra no cartão."/>}
   <p className="footnote px">Compras no cartão são consideradas integralmente na data da compra. Previsões, transferências, aportes, resgates e pagamentos de fatura não entram neste resultado. O resultado do dia não é o saldo das suas contas. O saldo final inclui pagamentos de fatura, transferências, investimentos e ajustes efetivados até a data; compras no cartão só alteram o banco no pagamento.</p>
  </Panel>
 </>;
}

export default function DailyReport(){
 const {month}=useApp();
 const [selected,setSelected]=useState(()=>today().startsWith(month)?today():`${month}-01`);
 const query=useData(`/reports/daily?date=${selected}`);
 return <>
  <div className="page-heading"><div><div className="eyebrow">UM DIA DE CADA VEZ</div><h1>Relatório diário.</h1><p>Acompanhe suas receitas e despesas de cada dia.</p></div><div className="period-range"><label>Dia<input type="date" value={selected} max={today()} onChange={e=>e.target.value&&setSelected(e.target.value)}/></label></div></div>
  <ReportTabs/>
  <DataState query={query}>{data=><DailyReportContent data={data}/>}</DataState>
 </>;
}
