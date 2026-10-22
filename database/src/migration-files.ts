import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type MigrationFile = {
  name: string
  sql: string
  checksum: string
}

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = resolve(currentDirectory, '..', 'migrations')

export async function loadMigrations(): Promise<MigrationFile[]> {
  const names = (await readdir(migrationsDirectory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort()

  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(resolve(migrationsDirectory, name), 'utf8')
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      }
    }),
  )
}
