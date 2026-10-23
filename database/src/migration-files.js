import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(currentDirectory, '..', 'migrations');
export async function loadMigrations() {
    const names = (await readdir(migrationsDirectory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
    return Promise.all(names.map(async (name) => {
        const sql = await readFile(resolve(migrationsDirectory, name), 'utf8');
        return {
            name,
            sql,
            checksum: createHash('sha256').update(sql).digest('hex'),
        };
    }));
}
