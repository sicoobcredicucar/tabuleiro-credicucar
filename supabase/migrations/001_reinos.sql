-- Supabase PostgreSQL. Apply with the Supabase migration runner, not from the browser.
create type public.access_role as enum ('administrador','performance','usuario');
create table public.access_profiles (user_id uuid primary key references auth.users on delete cascade, role public.access_role not null default 'usuario', active boolean not null default true);
create function public.has_role(allowed public.access_role[]) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from access_profiles where user_id=auth.uid() and active and role=any(allowed)) $$;
revoke all on function public.has_role(public.access_role[]) from public;
grant execute on function public.has_role(public.access_role[]) to authenticated;
create table public.pas(id text primary key, name text not null, city text not null, active boolean not null default true, color text, crest_path text);
create table public.classes(id text primary key, name text not null unique);
create table public.people(id text primary key, user_id uuid unique references auth.users, name text not null, email text not null, active boolean not null default true, competitive boolean not null default true, class_id text references public.classes);
create table public.affiliations(id uuid primary key default gen_random_uuid(), person_id text not null references public.people, pa_id text not null references public.pas, job text not null check(job in ('Gerente de relacionamento','Agente de relacionamento','Gerente de agência')), valid_from date not null, valid_to date, check(valid_to is null or valid_to>=valid_from), unique(person_id,valid_from));
create table public.assets(id uuid primary key default gen_random_uuid(), person_id text not null references public.people, storage_path text not null unique, scale numeric not null default 1 check(scale between .3 and 2), foot numeric not null default 0, hand_x numeric not null default 72, hand_y numeric not null default 32, has_scepter boolean not null default false, created_at timestamptz not null default now());
create table public.seasons(id uuid primary key default gen_random_uuid(), title text not null, starts date not null, ends date not null, status text not null default 'draft' check(status in ('draft','active','closed','archived')), check(ends>=starts));
create table public.indicators(id text primary key, name text not null, unit text not null check(unit in ('quantidade','BRL')));
create table public.campaigns(id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons, title text not null, starts date not null, ends date not null, check(ends>=starts));
create table public.rankings(id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns, title text not null, job text, indicator_id text not null references public.indicators, source text not null default 'individual' check(source in ('individual','pa')), rule_version int not null default 1, houses int not null default 51 check(houses between 2 and 101), version int not null default 0);
create table public.eligibility(ranking_id uuid not null references public.rankings, person_id text not null references public.people, excluded_reason text, primary key(ranking_id,person_id));
create table public.imports(id uuid primary key default gen_random_uuid(), ranking_id uuid not null references public.rankings, competency date not null, author uuid not null default auth.uid() references auth.users, created_at timestamptz not null default now(), status text not null default 'draft' check(status in ('draft','validated','published')), reason text);
create table public.result_revisions(id uuid primary key default gen_random_uuid(), import_id uuid not null references public.imports, person_id text references public.people, pa_id text references public.pas, target numeric(20,4) not null check(target>0), actual numeric(20,4) not null check(actual>=0), check((person_id is null)<>(pa_id is null)));
create unique index result_person_unique on public.result_revisions(import_id,person_id) where person_id is not null;
create unique index result_pa_unique on public.result_revisions(import_id,pa_id) where pa_id is not null;
create table public.publications(id uuid primary key default gen_random_uuid(), ranking_id uuid not null references public.rankings, import_id uuid not null unique references public.imports, version int not null, competency date not null, published_at timestamptz not null default now(), author uuid not null default auth.uid() references auth.users, reason text not null, rule_snapshot jsonb not null, unique(ranking_id,version));
create table public.ranking_entries(publication_id uuid not null references public.publications, participant_id text not null, snapshot jsonb not null, target numeric(20,4) not null check(target>0), actual numeric(20,4) not null check(actual>=0), percentage numeric not null, position bigint not null check(position>0), house int not null check(house>=0), primary key(publication_id,participant_id));
create table public.achievements(publication_id uuid not null, participant_id text not null, milestone int not null check(milestone in (25,50,75,100)), primary key(publication_id,participant_id,milestone), foreign key(publication_id,participant_id) references public.ranking_entries(publication_id,participant_id));
create table public.audit(id bigint generated always as identity primary key, author uuid default auth.uid(), at timestamptz not null default now(), object_type text not null, object_id text, before_value jsonb, after_value jsonb, reason text);
create index publication_history on public.publications(ranking_id,competency,version desc);
create index affiliation_lookup on public.affiliations(person_id,valid_from,valid_to);
create index result_import on public.result_revisions(import_id);
-- All roles come from a protected table; no self-service writes to access_profiles.
alter table public.access_profiles enable row level security;
create policy own_access on public.access_profiles for select to authenticated using(user_id=auth.uid() or public.has_role(array['administrador']::public.access_role[]));
do $$ declare t text; begin
foreach t in array array['pas','classes','people','affiliations','assets'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy read_authenticated on public.%I for select to authenticated using(public.has_role(array[''administrador'',''performance'',''usuario'']::public.access_role[]))',t);
execute format('create policy admin_write on public.%I for all to authenticated using(public.has_role(array[''administrador'']::public.access_role[])) with check(public.has_role(array[''administrador'']::public.access_role[]))',t);
end loop;
foreach t in array array['seasons','indicators','campaigns','rankings','eligibility','imports','result_revisions'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy operational_access on public.%I for all to authenticated using(public.has_role(array[''administrador'',''performance'']::public.access_role[])) with check(public.has_role(array[''administrador'',''performance'']::public.access_role[]))',t);
end loop;
foreach t in array array['publications','ranking_entries','achievements'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy published_read on public.%I for select to authenticated using(public.has_role(array[''administrador'',''performance'',''usuario'']::public.access_role[]))',t);
end loop;
end $$;
alter table public.audit enable row level security;
create policy operational_audit on public.audit for select to authenticated using(public.has_role(array['administrador']::public.access_role[]) or (object_type not in ('access_profiles','people','assets') and public.has_role(array['performance']::public.access_role[])));
-- Immutable audit, publication snapshots and access roles: no direct client writes.
create function public.capture_audit() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into audit(object_type,object_id,before_value,after_value) values(TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'),case when TG_OP='INSERT' then null else to_jsonb(OLD) end,case when TG_OP='DELETE' then null else to_jsonb(NEW) end);return coalesce(NEW,OLD);end $$;
do $$ declare t text; begin foreach t in array array['access_profiles','people','affiliations','assets','pas','rankings','imports','result_revisions'] loop execute format('create trigger audited after insert or update or delete on public.%I for each row execute function public.capture_audit()',t);end loop;end $$;
-- Atomic publication: locks the ranking and checks expected version. No service key needed.
create function public.publish_import(p_import uuid,p_expected_version int,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare imp imports; rk rankings; new_publication_id uuid; invalid_count int;
begin
 if not public.has_role(array['administrador','performance']::public.access_role[]) then raise exception 'Sem permissão'; end if;
 select * into imp from imports where id=p_import for update;
 if not found then raise exception 'Importação inexistente'; end if;
 select * into rk from rankings where id=imp.ranking_id for update;
 if rk.version<>p_expected_version then raise exception 'Conflito de versão'; end if;
 if imp.status='published' then select id into new_publication_id from publications where import_id=p_import; return new_publication_id; end if;
 if imp.status<>'validated' then raise exception 'Importação não validada'; end if;
 if rk.source<>'individual' then raise exception 'Fonte PA exige implementação e validação específica'; end if;
 if rk.version>0 and length(trim(coalesce(p_reason,'')))=0 then raise exception 'Justificativa obrigatória'; end if;
 if not exists(select 1 from campaigns c where c.id=rk.campaign_id and imp.competency between c.starts and c.ends) then raise exception 'Competência fora da campanha'; end if;
 if not exists(select 1 from result_revisions where import_id=p_import) then raise exception 'Sem resultados'; end if;
 if exists(select 1 from result_revisions r where r.import_id=p_import and (r.pa_id is not null or not exists(select 1 from eligibility e join people p on p.id=e.person_id where e.ranking_id=rk.id and e.person_id=r.person_id and e.excluded_reason is null and p.active and p.competitive))) then raise exception 'Participante inelegível'; end if;
 if exists(select 1 from eligibility e join people p on p.id=e.person_id where e.ranking_id=rk.id and e.excluded_reason is null and p.active and p.competitive and not exists(select 1 from result_revisions r where r.import_id=p_import and r.person_id=e.person_id)) then raise exception 'Metas ou resultados ausentes'; end if;
 select count(*) into invalid_count from result_revisions r where r.import_id=p_import and (select count(*) from affiliations a where a.person_id=r.person_id and a.valid_from<=imp.competency and (a.valid_to is null or a.valid_to>=imp.competency) and (rk.job is null or a.job=rk.job))<>1;
 if invalid_count>0 then raise exception 'Vínculo ou atribuição ambígua'; end if;
 insert into publications(ranking_id,import_id,version,competency,reason,rule_snapshot) values(rk.id,p_import,rk.version+1,imp.competency,coalesce(p_reason,''),jsonb_build_object('version',rk.rule_version,'houses',rk.houses,'indicator',rk.indicator_id,'source',rk.source)) returning id into new_publication_id;
 insert into ranking_entries(publication_id,participant_id,snapshot,target,actual,percentage,position,house)
 select new_publication_id,p.id,jsonb_build_object('person',to_jsonb(p),'affiliation',to_jsonb(a),'asset',(select to_jsonb(x) from assets x where x.person_id=p.id order by x.created_at desc limit 1)),r.target,r.actual,r.actual/r.target*100,rank() over(order by r.actual/r.target desc),floor(least(100,greatest(0,r.actual/r.target*100))/100*(rk.houses-1))::int from result_revisions r join people p on p.id=r.person_id join affiliations a on a.person_id=p.id and a.valid_from<=imp.competency and (a.valid_to is null or a.valid_to>=imp.competency) where r.import_id=p_import;
 insert into achievements select new_publication_id,e.participant_id,m from ranking_entries e cross join unnest(array[25,50,75,100]) m where e.publication_id=new_publication_id and e.percentage>=m;
 update rankings set version=version+1 where id=rk.id;
 update imports set status='published' where id=p_import;
 insert into audit(object_type,object_id,after_value,reason) values('publication',new_publication_id::text,jsonb_build_object('version',rk.version+1),p_reason);
 return new_publication_id;
end $$;
revoke all on function public.publish_import(uuid,int,text) from public;
grant execute on function public.publish_import(uuid,int,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('characters','characters',false,5242880,array['image/png','image/webp']);
create policy character_read on storage.objects for select to authenticated using(bucket_id='characters' and public.has_role(array['administrador','performance','usuario']::public.access_role[]));
create policy character_upload on storage.objects for insert to authenticated with check(bucket_id='characters' and public.has_role(array['administrador']::public.access_role[]));
-- No update/delete policy: historical image objects remain immutable.
insert into public.pas(id,name,city) values('PA00','Santa Cruz das Palmeiras','Santa Cruz das Palmeiras'),('PA01','Vargem Grande do Sul','Vargem Grande do Sul'),('PA02','Porto Ferreira','Porto Ferreira'),('PA03','Casa Branca','Casa Branca'),('PA97','Digital','Digital');
insert into public.classes(id,name) values('rei','Rei'),('rainha','Rainha'),('cavaleiro','Cavaleiro'),('arqueira','Arqueira'),('bruxo','Bruxo'),('bruxa','Bruxa'),('mago','Mago'),('campones','Camponês'),('camponesa','Camponesa'),('vassalo','Vassalo');
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.pas,public.classes,public.people,public.affiliations,public.assets,public.seasons,public.indicators,public.campaigns,public.rankings,public.eligibility,public.imports,public.result_revisions to authenticated;
revoke insert,update,delete on public.access_profiles,public.audit,public.publications,public.ranking_entries,public.achievements from authenticated;
