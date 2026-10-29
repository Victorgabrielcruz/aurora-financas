import type {QueryClient} from '@tanstack/react-query';
const scheduled=new WeakMap<QueryClient,ReturnType<typeof setTimeout>>();
// One background refresh per save, even when persistence and sync notify together.
export function refreshAppData(client:QueryClient){
 if(scheduled.has(client))return;
 scheduled.set(client,setTimeout(()=>{
  scheduled.delete(client);
  void client.invalidateQueries({predicate:query=>query.queryKey[0]!=='/me'}).catch(()=>{});
 },75));
}
