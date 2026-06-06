-- ============================================================
-- BLOSSOM OS — Supabase Database Setup
-- รันทั้งหมดนี้ใน Supabase → SQL Editor
-- ============================================================

-- 1. คลินิก (Tenant หลัก)
create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'basic' check (plan in ('basic', 'pro')),
  line_token text,
  logo_url text,
  banner_url text,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- 2. ผู้ใช้งาน (Admin / Staff ของคลินิก)
create table if not exists clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  email text unique not null,
  role text default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz default now()
);

-- 3. หัตถการ
create table if not exists treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  name text not null,
  description text,
  price int not null default 0,
  discount_price int,
  duration_min int default 60,
  image_url text,
  tag text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4. การจอง
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,
  treatment_id uuid references treatments(id),
  patient_name text not null,
  phone text not null,
  line_id text,
  booked_date date not null,
  booked_time time not null,
  note text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — กันข้ามคลินิก
-- ============================================================

alter table clinics enable row level security;
alter table treatments enable row level security;
alter table bookings enable row level security;

-- treatments: คลินิกเจ้าของเท่านั้นที่แก้ได้, ทุกคนอ่านได้ (สำหรับหน้าจอง)
create policy "treatments_public_read" on treatments
  for select using (is_active = true);

create policy "treatments_owner_all" on treatments
  for all using (
    clinic_id in (
      select clinic_id from clinic_users where id = auth.uid()
    )
  );

-- bookings: คลินิกเจ้าของเท่านั้นที่ดูได้
create policy "bookings_owner_read" on bookings
  for select using (
    clinic_id in (
      select clinic_id from clinic_users where id = auth.uid()
    )
  );

-- bookings: ทุกคน insert ได้ (ลูกค้าจอง)
create policy "bookings_public_insert" on bookings
  for insert with check (true);

-- bookings: เจ้าของคลินิกอัปเดตสถานะได้
create policy "bookings_owner_update" on bookings
  for update using (
    clinic_id in (
      select clinic_id from clinic_users where id = auth.uid()
    )
  );

-- ============================================================
-- Storage Bucket
-- ============================================================

-- รัน SQL นี้ หรือ สร้างผ่าน Dashboard: Storage → New Bucket → ชื่อ "clinic-assets" → Public: ON
insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict do nothing;

-- Policy: ทุกคนอ่านได้
create policy "public_read" on storage.objects
  for select using (bucket_id = 'clinic-assets');

-- Policy: เจ้าของอัปโหลดได้
create policy "auth_upload" on storage.objects
  for insert with check (bucket_id = 'clinic-assets' and auth.role() = 'authenticated');

-- ============================================================
-- Demo Data — ทดสอบระบบ
-- ============================================================

-- คลินิกตัวอย่าง
insert into clinics (id, name, slug, plan, phone)
values 
  ('11111111-0000-0000-0000-000000000001', 'Blossom Clinic', 'blossom', 'pro', '02-000-0001'),
  ('22222222-0000-0000-0000-000000000002', 'Luna Clinic', 'luna', 'basic', '02-000-0002')
on conflict do nothing;

-- หัตถการตัวอย่าง (Blossom Clinic)
insert into treatments (clinic_id, name, price, discount_price, duration_min, tag)
values
  ('11111111-0000-0000-0000-000000000001', 'Botox ลด Jawline', 8900, 6900, 30, 'Botox'),
  ('11111111-0000-0000-0000-000000000001', 'Filler เติมริมฝีปาก', 12000, 9500, 45, 'Filler'),
  ('11111111-0000-0000-0000-000000000001', 'ร้อยไหม V-Shape', 18000, 15000, 60, 'Thread'),
  ('11111111-0000-0000-0000-000000000001', 'เลเซอร์กระ', 4500, null, 30, 'Laser')
on conflict do nothing;
