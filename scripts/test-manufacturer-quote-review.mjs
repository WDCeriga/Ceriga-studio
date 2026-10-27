import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
process.on('uncaughtException',error=>{console.error(error.message,error.where||'',error.stack?.split('\n').slice(1,4).join('\n'));process.exit(1);});
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema cron;
create table auth.users(id uuid primary key default gen_random_uuid(),email text,email_confirmed_at timestamptz,invited_at timestamptz,encrypted_password text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command)values($1,$2,$3)on conflict(jobname)do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;
grant usage on schema public,auth,storage to authenticated,anon,service_role;grant all on all tables in schema storage to authenticated,service_role;`);
let schema=await fs.readFile('supabase/schema.sql','utf8');schema=schema.slice(0,schema.indexOf('-- Simplified QC reports (20261022010000)')).replace(/create extension if not exists "pgcrypto";/gi,'');await db.exec(schema);

await db.exec(await fs.readFile('supabase/migrations/20261022010000_simplified_quality_control.sql','utf8'));const migration=await fs.readFile('supabase/migrations/20261022040000_manufacturer_quote_review.sql','utf8');await db.exec(migration);await db.exec(migration);await db.exec(`insert into auth.users(id,email)values('22222222-2222-2222-2222-222222222222','factory@example.invalid'),('44444444-4444-4444-4444-444444444444','owner@ceriga.io');insert into public.manufacturer_profiles(user_id,factory_name,onboarding_complete,status,pricing)values('22222222-2222-2222-2222-222222222222','Factory',true,'active','{"preferredCurrency":"EUR"}');`);await db.exec(await fs.readFile('supabase/verify_manufacturer_quote_review_live.sql','utf8'));console.log('PASS: repeatable migration and full quotation review workflow.');await db.close();
