import { describe, expect, it } from 'vitest'
import { loadMigrations } from './migration-files.js'

describe('migration files', () => {
  it('loads ordered, non-empty migrations with stable checksums', async () => {
    const migrations = await loadMigrations()

    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations.map(({ name }) => name)).toEqual(
      [...migrations.map(({ name }) => name)].sort(),
    )

    for (const migration of migrations) {
      expect(migration.sql.trim().length).toBeGreaterThan(100)
      expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/)
    }
  })
})