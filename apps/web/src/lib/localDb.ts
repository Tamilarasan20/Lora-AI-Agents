import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), '.local-db.json');

const readDb = (): Record<string, any> => {
  if (!fs.existsSync(dbPath)) {
    return {};
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
};

const writeDb = (data: Record<string, any>) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
};

export const localDb = {
  get: (id: string) => {
    const db = readDb();
    return db[id] || null;
  },
  insert: (data: any) => {
    const db = readDb();
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newRecord = { id, ...data };
    db[id] = newRecord;
    writeDb(db);
    return { data: newRecord, error: null };
  },
  update: (id: string, updates: any) => {
    const db = readDb();
    if (!db[id]) {
      return { data: null, error: new Error('Record not found') };
    }
    db[id] = { ...db[id], ...updates };
    writeDb(db);
    return { data: db[id], error: null };
  },
  getAll: () => {
    return readDb();
  }
};
