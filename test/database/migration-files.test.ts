import { describe, expect, it } from 'vitest'
import { loadMigrations } from '../../database/src/migration-files.js'

describe('migration files', () => {
  it('loads ordered, non-empty migrations with stable checksums', async () => {
    const migrations = await loadMigrations()

    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations.map(({ name }) => name)).toEqual([...migrations.map(({ name }) => name)].sort())

    for (const migration of migrations) {
      expect(migration.sql.trim().length).toBeGreaterThan(100)
      expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('defines the order and shipment integrity rules used by read-only monitoring', async () => {
    const migrations = await loadMigrations()
    const foundation = migrations.find((migration) => migration.name === '001_flowline_foundation.sql')

    expect(foundation?.sql).toContain('CREATE TABLE flowline.orders')
    expect(foundation?.sql).toContain("'Delivered'")
    expect(foundation?.sql).toContain('CREATE TABLE flowline.shipments')
    expect(foundation?.sql).toContain("status <> 'DELIVERED' OR actual_delivery_at IS NOT NULL")
    expect(foundation?.sql).toContain('CREATE INDEX shipments_order_idx')
  })
})
