# Together x

ระบบจัดการโปรเจกต์/ทีมภายในบริษัท ตามสเปก: Next.js + Supabase + Cloudflare

## สิ่งที่มีให้แล้ว (ทำงานได้จริง)

| Module | สถานะ |
|---|---|
| Auth (จำ Username, บังคับใส่ Password ใหม่ทุกครั้ง) | ✅ `app/login` |
| RBAC 6 roles + Supabase RLS ครบทุกตาราง | ✅ `supabase/schema.sql` |
| Kanban 14 ขั้นตอน + Smart Visibility + Real-time | ✅ `app/kanban` |
| Quest Dashboard (มอบหมาย/อัปเดตสถานะ/แนบ GitHub) | ✅ `app/quests` |
| Super Admin: Global Override + Profit Pool + จัดการ Role | ✅ `app/admin` |
| Together Board + Kudos | ✅ `app/culture` |
| Storage buckets (contracts_and_docs / artworks_and_assets) + RLS | ✅ `supabase/schema.sql` |

## สิ่งที่ยังเป็นโครงเริ่มต้น (ต่อยอดได้ตามต้องการ)

- **Poll (โหวตสถานที่เที่ยว)** — ตารางและ RLS พร้อมแล้ว (`polls`, `poll_votes`) แต่ยังไม่มีหน้า UI
- **Showcase / Hall of Fame gallery** — ตารางพร้อมแล้ว (`showcase_items`) แต่ยังไม่มีหน้าแกลเลอรี
- **Dynamic Matchmaking (จับคู่ Skills กับ Requirement อัตโนมัติ)** — ตอนนี้ Admin เห็น Skills ของพนักงานได้ในหน้า `/admin` แต่ยังไม่มีอัลกอริทึมแนะนำอัตโนมัติ
- **Kanban แบบลาก-วาง (drag & drop)** — ตอนนี้ใช้ปุ่ม "ถัดไป / ย้อนกลับ" แทนเพื่อความเร็วในการส่งมอบ ต่อยอดด้วย `@dnd-kit/core` ได้ทันที
- **แยก Column ยอดขาย/มูลค่าโปรเจกต์ไม่ให้ Coder เห็น** — มีคำแนะนำให้สร้าง VIEW ไว้ท้ายไฟล์ `schema.sql` แล้ว (RLS เป็น row-level ไม่ใช่ column-level)

บอกได้เลยว่าอยากให้ต่อส่วนไหนก่อน จะขยายให้ทันที

---

## 1. ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. ไปที่ **SQL Editor** → วางไฟล์ `supabase/schema.sql` ทั้งหมด → กด Run
   - จะได้ตาราง, enum, RLS policies, storage buckets, และ realtime publication ครบ
3. ไปที่ **Authentication → Providers** → เปิด Email/Password (ปิด "Confirm email" ไว้ก่อนถ้าต้องการทดสอบเร็ว ๆ)
4. สร้างผู้ใช้คนแรกให้เป็น Super Admin:
   - ไปที่ **Authentication → Users → Add user** สร้าง 1 บัญชี
   - กลับไปที่ **Table Editor → users** แล้วแก้ `role` ของบัญชีนั้นเป็น `super_admin` (trigger จะสร้าง row ให้อัตโนมัติตอนสมัคร)
5. คัดลอก `Project URL` และ `anon public` key จาก **Project Settings → API**

## 2. รันโปรเจกต์บนเครื่อง (local dev)

```bash
npm install
cp .env.example .env.local
# แก้ .env.local ใส่ URL และ anon key จากขั้นตอนที่แล้ว
npm run dev
```

เปิด http://localhost:3000

## 3. Deploy ขึ้น Cloudflare Pages

**วิธีที่ 1 — ผ่าน Dashboard (ง่ายที่สุด)**

1. Push โค้ดนี้ขึ้น GitHub/GitLab repo
2. ไปที่ Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
3. เลือก repo นี้ ตั้งค่า Build:
   - Framework preset: `Next.js`
   - Build command: `npx @cloudflare/next-on-pages`
   - Build output directory: `.vercel/output/static`
4. ใส่ Environment Variables (ให้ตรงกับ `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. กด Save and Deploy

**วิธีที่ 2 — จาก command line**

```bash
npm install -g wrangler
wrangler login
npm run pages:deploy
```

## 4. Cloudflare Access (จำกัดสิทธิ์เว็บทดสอบ) — ตามสเปกข้อ 4

ถ้าต้องการล็อกเว็บ staging ให้เห็นเฉพาะทีมภายใน:
Cloudflare Dashboard → **Zero Trust → Access → Applications → Add an application**
→ เลือกโดเมนที่ Pages สร้างให้ → ตั้ง policy ให้อนุญาตเฉพาะอีเมลโดเมนบริษัท

## โครงสร้างไฟล์

```
supabase/schema.sql       ← รันบน Supabase SQL editor ก่อนทุกอย่าง
lib/supabaseClient.js     ← Supabase client + role/pipeline constants
contexts/AuthContext.jsx  ← session, profile, hasRole(), signIn/signOut
app/login/                ← หน้า Login
app/dashboard/            ← Layout (sidebar ตาม role) + หน้าแรก (Quest summary)
app/kanban/                ← Pipeline Board 14 ขั้นตอน
app/quests/                ← Quest list + มอบหมายงาน
app/culture/                ← Together Board + Kudos
app/admin/                  ← Super Admin only
```

## หมายเหตุด้านความปลอดภัย

- Role ทุกอย่างถูกบังคับจริงที่ชั้น **Postgres RLS** ไม่ใช่แค่ซ่อนปุ่มใน UI — ต่อให้ user เปิด DevTools แก้ request ตรง ๆ ก็ยังโดน Supabase ปฏิเสธ
- อย่าใส่ Service Role Key ไว้ฝั่ง Frontend เด็ดขาด — โค้ดชุดนี้ใช้แค่ `anon` key ซึ่งปลอดภัยเพราะพึ่ง RLS ทั้งหมด
