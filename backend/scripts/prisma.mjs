import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

for(const path of ['../../.env.local','../../.env','../.env']) {
  config({path:fileURLToPath(new URL(path,import.meta.url))});
}
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../node_modules/prisma/build/index.js',import.meta.url)),...process.argv.slice(2)],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),env:process.env,stdio:'inherit',
});
if(result.error)throw result.error;
process.exit(result.status??1);
