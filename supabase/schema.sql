-- =====================================================================
-- معرض التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي: قاعدة البيانات المركزية والصلاحيات.
-- يُلصق هذا الملف كاملًا في Supabase ← SQL Editor ← Run. آمن لإعادة التشغيل.
--
-- الأدوار:
--   admin       مديرة النظام: تعدّل كل البيانات، وتمنح الصلاحيات وتلغيها.
--   editor      مستخدم مصرّح له بالإضافة والتعديل.
--   supervisor  اطلاع فقط (المشرفة والمستخدمون)، دون تعديل أو حذف.
-- المشاهدة متاحة للجميع دون تسجيل دخول (انظر «المشاهدة العامة» أدناه)؛ التعديل لمن يملك الدور.
--   pending     حساب جديد بانتظار منح صلاحية: لا يرى شيئًا.
--   revoked     صلاحية ملغاة: لا يرى شيئًا.
-- الصلاحيات مفروضة هنا بسياسات RLS ودوال تتحقق من الدور، لا في واجهة الموقع وحدها.
-- =====================================================================

-- ---------- الملفات الشخصية والأدوار ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'pending' check (role in ('pending', 'admin', 'editor', 'supervisor', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'none')
$$;
create or replace function public.can_read() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'editor', 'supervisor')
$$;
create or replace function public.can_edit() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'editor')
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
$$;

-- كل حساب جديد يبدأ «بانتظار الصلاحية»
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- المستخدم يرى ملفه، والمديرة ترى الجميع. لا تعديل مباشر: تغيير الدور عبر set_user_role فقط
drop policy if exists "profiles: own or admin" on public.profiles;
create policy "profiles: own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function public.set_user_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if new_role not in ('pending', 'admin', 'editor', 'supervisor', 'revoked') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  update public.profiles set role = new_role, updated_at = now() where id = target;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end
$$;

-- ---------- بيانات المعرض: مستند واحد بإصدار يمنع الكتابة فوق تعديلات الآخرين ----------
create table if not exists public.app_state (
  id text primary key default 'main' check (id = 'main'),
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_state enable row level security;
drop policy if exists "app_state: read by allowed roles" on public.app_state;
create policy "app_state: read by allowed roles" on public.app_state
  for select to authenticated using (public.can_read());
revoke all on public.app_state from anon, authenticated;
grant select on public.app_state to authenticated;

-- سجل الإصدارات السابقة: لا يضيع تعديل حتى لو حُفظ فوقه (للمديرة فقط)
create table if not exists public.app_state_history (
  id bigserial primary key,
  version bigint not null,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid
);
alter table public.app_state_history enable row level security;
drop policy if exists "history: admin only" on public.app_state_history;
create policy "history: admin only" on public.app_state_history
  for select to authenticated using (public.is_admin());
revoke all on public.app_state_history from anon, authenticated;
grant select on public.app_state_history to authenticated;

-- الحفظ: للمديرة والمحررين فقط، وبشرط أن يكون الإصدار المرسل هو الأحدث (وإلا: conflict)
create or replace function public.save_state(p_data jsonb, p_version bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v bigint;
  old_data jsonb;
begin
  if not public.can_edit() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select data into old_data from public.app_state where id = 'main' and version = p_version for update;
  if not found then
    if not exists (select 1 from public.app_state where id = 'main') then
      raise exception 'not_initialized' using errcode = 'P0002';
    end if;
    raise exception 'conflict' using errcode = '40001';
  end if;
  insert into public.app_state_history (version, data, saved_by) values (p_version, old_data, auth.uid());
  update public.app_state
     set data = p_data, version = version + 1, updated_at = now(), updated_by = auth.uid()
   where id = 'main'
  returning version into v;
  return v;
end
$$;

-- التهيئة الأولى (نقل البيانات الحالية): للمديرة فقط، ومرة واحدة كي لا تتكرر البيانات
create or replace function public.init_state(p_data jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.app_state (id, data, version, updated_by) values ('main', p_data, 1, auth.uid())
  on conflict (id) do nothing;
  if not found then
    raise exception 'already_initialized' using errcode = '23505';
  end if;
  return 1;
end
$$;

-- ---------- بيانات الملفات المرفقة (المحتوى نفسه في التخزين الخاص أدناه) ----------
create table if not exists public.files (
  id text primary key,
  name text not null,
  type text not null default '',
  size bigint not null default 0,
  added_at timestamptz not null default now(),
  path text not null,
  uploaded_by uuid default auth.uid()
);
alter table public.files enable row level security;
drop policy if exists "files: read" on public.files;
create policy "files: read" on public.files for select to authenticated using (public.can_read());
drop policy if exists "files: insert" on public.files;
create policy "files: insert" on public.files for insert to authenticated with check (public.can_edit());
drop policy if exists "files: delete" on public.files;
create policy "files: delete" on public.files for delete to authenticated using (public.can_edit());
revoke all on public.files from anon, authenticated;
grant select, insert, delete on public.files to authenticated;

-- ---------- التخزين الخاص للملفات: لا روابط عامة، والوصول بتسجيل الدخول والدور ----------
insert into storage.buckets (id, name, public) values ('exhibit-files', 'exhibit-files', false)
on conflict (id) do update set public = false;

drop policy if exists "exhibit-files: read" on storage.objects;
create policy "exhibit-files: read" on storage.objects for select to authenticated
  using (bucket_id = 'exhibit-files' and public.can_read());
drop policy if exists "exhibit-files: insert" on storage.objects;
create policy "exhibit-files: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'exhibit-files' and public.can_edit());
drop policy if exists "exhibit-files: update" on storage.objects;
create policy "exhibit-files: update" on storage.objects for update to authenticated
  using (bucket_id = 'exhibit-files' and public.can_edit()) with check (bucket_id = 'exhibit-files' and public.can_edit());
drop policy if exists "exhibit-files: delete" on storage.objects;
create policy "exhibit-files: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'exhibit-files' and public.can_edit());

-- ---------- المشاهدة العامة (قرار مديرة النظام 2026-10-25) ----------
-- بيانات المعرض وملفاته تُقرأ دون تسجيل دخول. الكتابة تبقى عبر الدوال والسياسات أعلاه فقط.
drop policy if exists "app_state: public read" on public.app_state;
create policy "app_state: public read" on public.app_state for select to anon, authenticated using (true);
grant select on public.app_state to anon;
drop policy if exists "files: public read" on public.files;
create policy "files: public read" on public.files for select to anon, authenticated using (true);
grant select on public.files to anon;
drop policy if exists "exhibit-files: public read" on storage.objects;
create policy "exhibit-files: public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'exhibit-files');

-- ---------- صلاحيات تنفيذ الدوال: للمستخدمين المسجلين فقط ----------
revoke execute on function public.my_role(), public.can_read(), public.can_edit(), public.is_admin(),
  public.set_user_role(uuid, text), public.save_state(jsonb, bigint), public.init_state(jsonb) from public, anon;
grant execute on function public.my_role(), public.can_read(), public.can_edit(), public.is_admin(),
  public.set_user_role(uuid, text), public.save_state(jsonb, bigint), public.init_state(jsonb) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- التحديث الفوري بين الأجهزة ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state') then
    alter publication supabase_realtime add table public.app_state;
  end if;
end
$$;
