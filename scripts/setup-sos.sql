-- SOS 공연 관리 테이블 생성
-- Supabase Dashboard > SQL Editor 에서 실행

create table if not exists sos_concerts (
  id          uuid primary key default gen_random_uuid(),
  year        integer not null default extract(year from now())::integer,
  concert_date text,
  school      text,
  concept     text,
  artists     text,
  notes       text,
  status      text not null default '예정',
  created_at  timestamptz not null default now()
);

-- RLS 활성화
alter table sos_concerts enable row level security;

-- 인증된 사용자는 모두 읽기 가능
create policy "authenticated read sos_concerts"
  on sos_concerts for select
  to authenticated
  using (true);

-- 인증된 사용자는 insert/update/delete 가능 (페이지에서 admin 체크)
create policy "authenticated write sos_concerts"
  on sos_concerts for insert
  to authenticated
  with check (true);

create policy "authenticated update sos_concerts"
  on sos_concerts for update
  to authenticated
  using (true);

create policy "authenticated delete sos_concerts"
  on sos_concerts for delete
  to authenticated
  using (true);
