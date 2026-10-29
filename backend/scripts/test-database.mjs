import {parse} from 'dotenv';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';

export async function testDatabase(){
  const path=fileURLToPath(new URL('../../.env.test.local',import.meta.url));
  const values=existsSync(path)?parse(readFileSync(path)):{};
  const pooled=process.env.TEST_DATABASE_URL??values.DATABASE_URL;
  const direct=process.env.TEST_DATABASE_URL_UNPOOLED??values.DATABASE_URL_UNPOOLED;
  if(!pooled||!direct)throw new Error('Pull a dedicated Neon test branch into .env.test.local or set TEST_DATABASE_URL and TEST_DATABASE_URL_UNPOOLED. Tests never use production defaults.');
  const productionPath=fileURLToPath(new URL('../../.env.local',import.meta.url));
  if(existsSync(productionPath)){
    const production=parse(readFileSync(productionPath));
    if(production.DATABASE_URL&&new URL(production.DATABASE_URL).hostname===new URL(pooled).hostname)throw new Error('Test and production endpoints must be different.');
  }
  const schema='aurora_test_'+randomUUID().replaceAll('-','');
  const scoped=(value)=>{const url=new URL(value);url.searchParams.set('schema',schema);return url.toString();};
  process.env.DATABASE_URL=scoped(pooled);
  process.env.DATABASE_URL_UNPOOLED=scoped(direct);
  process.env.NODE_ENV='test';
  const admin=new PrismaClient({datasourceUrl:direct});
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try{
    // Prisma's migration lock is shared across schemas; parallel test files may queue here.
    for(let attempt=0;attempt<4;attempt++){
      try{
        execFileSync(process.execPath,[fileURLToPath(new URL('../../node_modules/prisma/build/index.js',import.meta.url)),'migrate','deploy'],{
          cwd:fileURLToPath(new URL('../',import.meta.url)),env:process.env,stdio:'pipe',
        });
        break;
      }catch(error){
        if(attempt===3||!String(error.stderr??'').includes('pg_advisory_lock'))throw error;
      }
    }
  }catch(error){await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();throw error;}
  return async()=>{
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  };
}
