import 'dotenv/config';
import {mkdir,open} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const url=process.env.DATABASE_URL??'file:./aurora.db';
if(!url.startsWith('file:'))throw new Error('Esta versão utiliza SQLite. Configure DATABASE_URL com file:.');
const path=resolve('prisma',url.slice(5));await mkdir(dirname(path),{recursive:true});const file=await open(path,'a');await file.close();
