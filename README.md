# 🌸 Blossom OS — Clinic SaaS

ระบบจัดการคลินิกความงาม รองรับ Multi-tenant

## Stack
- **Frontend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel

---

## วิธีติดตั้ง (ทำครั้งเดียว)

### 1. Clone และติดตั้ง
```bash
git clone https://github.com/YOUR_USERNAME/blossom-os.git
cd blossom-os
npm install
```

### 2. ตั้งค่า Supabase
1. ไปที่ [supabase.com](https://supabase.com) → เปิดโปรเจค
2. ไปที่ **SQL Editor** → วาง SQL จากไฟล์ `supabase-setup.sql` → รัน
3. ไปที่ **Storage** → สร้าง Bucket ชื่อ `clinic-assets` → เปิด Public

### 3. ตั้งค่า Environment
```bash
cp .env.example .env.local
```
แก้ไข `.env.local` ใส่ค่าจาก Supabase:
- `NEXT_PUBLIC_SUPABASE_URL` → Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Project Settings → API → anon public key

### 4. รันในเครื่อง
```bash
npm run dev
```
เปิด http://localhost:3000

---

## Deploy ขึ้น Vercel

```bash
git add .
git commit -m "initial commit"
git push origin main
```

จากนั้น:
1. ไปที่ [vercel.com](https://vercel.com) → Add New Project
2. เลือก repo `blossom-os`
3. ใส่ Environment Variables เดียวกับ `.env.local`
4. กด Deploy ✅

---

## โครงสร้างโปรเจค
```
blossom-os/
├── app/
│   ├── page.jsx              # หน้าแรก → redirect ไป /admin
│   ├── admin/
│   │   └── page.jsx          # Admin Panel (Login + Dashboard)
│   └── [slug]/
│       └── book/
│           └── page.jsx      # หน้าจองสำหรับลูกค้า
├── lib/
│   └── supabase.js           # Supabase client + helper functions
├── supabase-setup.sql        # SQL สำหรับสร้าง Database
├── .env.example              # Template สำหรับ env vars
└── next.config.js
```

---

## URL หลัก
| URL | คำอธิบาย |
|-----|----------|
| `/admin` | หน้า Login + Dashboard สำหรับ Admin |
| `/blossom/book` | หน้าจองลูกค้าของ Blossom Clinic |
| `/luna/book` | หน้าจองลูกค้าของ Luna Clinic |
