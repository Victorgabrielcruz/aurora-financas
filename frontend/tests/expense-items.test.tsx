import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {AppContext} from '../src/context';
import {CompositionDetails,ExpenseItemsEditor} from '../src/components/expense-items';
import {ItemReportContent} from '../src/item-report';
function render(element:any,hidden=false){return renderToStaticMarkup(<AppContext.Provider value={{hidden,user:{tenantId:'tenant'}} as any}><MemoryRouter>{element}</MemoryRouter></AppContext.Provider>);}
test('Composição vazia não ocupa a transação; valores ficam ocultos quando solicitado',()=>{
 assert.equal(render(<CompositionDetails items={[]}/>),'');
 const html=render(<CompositionDetails items={[{name:'Arroz',amount:3000}]}/>);assert.match(html,/Ver composição/);assert.match(html,/Arroz/);assert.match(html,/30,00/);
 const hidden=render(<CompositionDetails items={[{name:'Arroz',amount:3000}]}/>,true);assert.doesNotMatch(hidden,/30,00/);assert.match(hidden,/••••••/);
});
test('Editor opcional aceita detalhamento parcial e avisa quando o total é excedido',()=>{
 const props={enabled:true,total:10000,onToggle:()=>{},onChange:()=>{}};
 const partial=render(<ExpenseItemsEditor {...props} items={[{name:'Arroz',amount:3000}]}/>);assert.match(partial,/70,00/);assert.doesNotMatch(partial,/role="alert"/);assert.match(partial,/Nome do item 1/);
 const exceeded=render(<ExpenseItemsEditor {...props} items={[{name:'Arroz',amount:12000}]}/>);assert.match(exceeded,/role="alert"/);assert.match(exceeded,/não pode ultrapassar/);
 const disabled=render(<ExpenseItemsEditor {...props} enabled={false} items={[]}/>);assert.doesNotMatch(disabled,/Nome do item/);
});
test('Relatório mostra ranking, participação e estados sem composição ou sem despesas',()=>{
 const data={total:10000,detailed:7000,undetailed:3000,coverage:70,items:[{name:'Carne',amount:5000,purchases:2,percentage:50},{name:'Arroz',amount:2000,purchases:1,percentage:20}]};
 const html=render(<ItemReportContent data={data}/>);assert.match(html,/Carne/);assert.match(html,/Arroz/);assert.match(html,/50%/);assert.match(html,/Não detalhado/);
 assert.match(render(<ItemReportContent data={data} search="Inexistente"/>),/Nenhum item encontrado/);
 assert.match(render(<ItemReportContent data={{...data,detailed:0,coverage:0,undetailed:10000,items:[]}}/>),/ainda não têm composição/);
 assert.match(render(<ItemReportContent data={{total:0,detailed:0,undetailed:0,coverage:0,items:[]}}/>),/Nenhuma despesa neste período/);
});
