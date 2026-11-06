import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {AppContext} from '../src/context';
import {DollarQuote,InvestmentDetails} from '../src/investments';

const asset={id:'usd',name:'Meus dólares',class:'Dólar',institution:'Corretora',quantity:100,invested:50000,current:60000,profit:10000,returnPct:20,averageRate:5,active:true,operations:[],valuations:[],quote:{rate:6,date:'2026-11-05',source:'Frankfurter',stale:false}};
function render(element:any,hidden=false){
 const client=new QueryClient();client.setQueryData(['tenant','/investments/usd'],asset);
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><AppContext.Provider value={{hidden,user:{tenantId:'tenant'},openForm:()=>{}} as any}><MemoryRouter initialEntries={['/investimentos/usd']}>{element}</MemoryRouter></AppContext.Provider></QueryClientProvider>);
 client.clear();return html;
}
test('Dólar mostra saldo, custo médio, data e indisponibilidade da cotação',()=>{
 const html=render(<DollarQuote investment={asset}/>);
 for(const text of ['100,00','5,00','6,00','05/11/2026','Frankfurter','sem taxas de venda'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(render(<DollarQuote investment={asset}/>,true),/100,00|5,00/);
 assert.match(render(<DollarQuote investment={{...asset,quote:null}}/>),/Cotação indisponível/);
 assert.match(render(<DollarQuote investment={{...asset,quote:{...asset.quote,stale:true}}}/>),/última cotação/);
});
test('Detalhes oferecem compra e venda e mostram valorização automática',()=>{
 const html=render(<Routes><Route path="/investimentos/:id" element={<InvestmentDetails/>}/></Routes>);
 for(const text of ['Comprar ou vender dólares','Atualizar cotação / valores','600,00','500,00','100,00','20%'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/Atualizar valorização|Histórico de valorização/);
 assert.doesNotMatch(render(<Routes><Route path="/investimentos/:id" element={<InvestmentDetails/>}/></Routes>,true),/600,00|500,00|100,00/);
});
