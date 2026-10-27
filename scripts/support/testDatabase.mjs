import fs from 'node:fs/promises';
import {PGlite}from '../../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
/** Fully isolated PostgreSQL semantics. Network/cron delivery are deliberately mocked. */
export async function testDatabase({dataDir}={}){
 const db=new PGlite(dataDir);
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema cron;create schema net;
 create table auth.users(id uuid primary key default gen_random_uuid(),email text,email_confirmed_at timestamptz,invited_at timestamptz,encrypted_password text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid()returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);alter table storage.objects enable row level security;
 create function storage.foldername(text)returns text[]language sql immutable as $$select string_to_array($1,'/')$$;
 create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
 create function cron.schedule(text,text,text)returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values($1,$2,$3)on conflict(jobname)do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;
 create table net._http_response(id bigint primary key,status_code integer,error_msg text,content text);create sequence net.requests;
 create function net.http_get(url text,timeout_milliseconds integer)returns bigint language sql as $$select nextval('net.requests')$$;
 grant usage on schema public,auth,storage to authenticated,anon,service_role;grant all on all tables in schema storage to authenticated,service_role;`);
 const schema=(await fs.readFile('supabase/schema.sql','utf8')).replace(/create extension if not exists "pgcrypto";/gi,'').replace(/create extension if not exists pg_net with schema extensions;/gi,'').replace(/create extension if not exists pg_cron with schema pg_catalog;/gi,'');
 try{await db.exec(schema);}catch(error){await db.close();throw new Error(error.message);}
 return db;
}
export async function asAccount(db,id,email='account@example.invalid'){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,email,role:'authenticated'})]);await db.exec('set role authenticated');
}
