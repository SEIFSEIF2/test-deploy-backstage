import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

// Build-time migration runner so one-click deploys need no Supabase CLI.
// Uses the Postgres URL injected by the Vercel-Supabase integration; the
// app itself never touches it (runtime stays supabase-js only).
// Writes to supabase_migrations.schema_migrations, same table the CLI
// uses, so `supabase db push` and this script stay interchangeable.

const url =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL

if (!url) {
  console.log('[migrate] no database URL set, skipping')
  process.exit(0)
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url)
    ? undefined
    : { rejectUnauthorized: false }
})

await client.connect()
try {
  await client.query('select pg_advisory_lock(872634)')
  await client.query('create schema if not exists supabase_migrations')
  await client.query(
    `create table if not exists supabase_migrations.schema_migrations
     (version text primary key, statements text[], name text)`
  )

  const { rows } = await client.query(
    'select version from supabase_migrations.schema_migrations'
  )
  const applied = new Set(rows.map((r) => r.version))

  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    const version = file.split('_')[0]
    if (applied.has(version)) continue

    console.log(`[migrate] applying ${file}`)
    const sql = await readFile(join(dir, file), 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, name)
         values ($1, $2)`,
        [version, file.replace(/^\d+_/, '').replace(/\.sql$/, '')]
      )
      await client.query('commit')
    } catch (err) {
      await client.query('rollback')
      throw err
    }
  }

  console.log('[migrate] schema up to date')
} finally {
  await client.end()
}
