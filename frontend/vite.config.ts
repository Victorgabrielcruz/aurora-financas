import {defineConfig,Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function offlineAssets():Plugin{return {name:'aurora-offline-assets',generateBundle(_options,bundle){
 const assets=Object.values(bundle).map(file=>'/'+file.fileName).filter(name=>/\.(js|css|woff2|png|svg)$/.test(name)).sort();
 const version=createHash('sha256').update(assets.join('\n')).digest('hex').slice(0,16);
 this.emitFile({type:'asset',fileName:'offline-assets.json',source:JSON.stringify({version,assets})});
 this.emitFile({type:'asset',fileName:'sw.js',source:readFileSync(new URL('./public/sw.js',import.meta.url),'utf8').replaceAll('__AURORA_BUILD__',version)});
}};}
export default defineConfig({plugins:[react(),tailwindcss(),offlineAssets()],server:{proxy:{'/api':'http://127.0.0.1:3001'}},build:{outDir:'dist'}});
