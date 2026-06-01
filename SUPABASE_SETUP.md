# Supabase Setup Guide

## 1. Create a free Supabase project
Go to https://supabase.com → New project → pick a name and region.

## 2. Create the scenes table
Go to **SQL Editor** in your Supabase dashboard and run:

```sql
create table scenes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on every save
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger scenes_updated_at
before update on scenes
for each row execute function update_updated_at();
```

## 3. Create the videos storage bucket
Go to **Storage** → New bucket:
- Name: `videos`
- Public bucket: ✅ YES (so video URLs work without auth tokens)

Then go to **Storage → Policies** and add this policy for the `videos` bucket:

```sql
-- Allow anyone to upload (you can restrict this later with auth)
create policy "allow uploads"
on storage.objects for insert
with check (bucket_id = 'videos');

-- Allow anyone to read
create policy "allow reads"
on storage.objects for select
using (bucket_id = 'videos');
```

## 4. Get your keys
Go to **Settings → API**:
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5. Add keys to your project
Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
MISTRAL_API_KEY=your_existing_key_here
```

## 6. Run it
```bash
npm run dev
```

Go to `/creator`, configure your scene, hit **Save** — it writes to Supabase.
The stage at `/` loads the latest saved scene automatically.
