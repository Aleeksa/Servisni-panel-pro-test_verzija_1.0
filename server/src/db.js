import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.join(__dirname, '..', 'data', 'db.json');

const emptyDb = {
  tasks: [],
  meta: {
    createdAt: new Date().toISOString(),
    app: 'ServisPanel Pro'
  }
};

async function ensureDb() {
  try {
    await fs.access(dbFile);
  } catch {
    await fs.mkdir(path.dirname(dbFile), { recursive: true });
    await fs.writeFile(dbFile, JSON.stringify(emptyDb, null, 2), 'utf8');
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(dbFile, 'utf8');
  try {
    const data = JSON.parse(raw);
    return { ...emptyDb, ...data, tasks: Array.isArray(data.tasks) ? data.tasks : [] };
  } catch {
    await fs.writeFile(dbFile, JSON.stringify(emptyDb, null, 2), 'utf8');
    return emptyDb;
  }
}

export async function writeDb(data) {
  await ensureDb();
  const tmp = `${dbFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, dbFile);
}

export async function listTasks() {
  const db = await readDb();
  return db.tasks.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function createTask(payload, userEmail) {
  const db = await readDb();
  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    title: '',
    client: '',
    contact: '',
    phone: '',
    assignee: '',
    category: 'podrska',
    description: '',
    notes: '',
    priority: 'srednji',
    status: 'novo',
    paymentStatus: 'nije-placeno',
    price: '',
    paidAmount: '',
    tags: '',
    link: '',
    dueDate: '',
    ...sanitizeTask(payload),
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
    updatedBy: userEmail
  };
  db.tasks.unshift(task);
  await writeDb(db);
  return task;
}

export async function updateTask(id, payload, userEmail) {
  const db = await readDb();
  const index = db.tasks.findIndex(task => task.id === id);
  if (index === -1) return null;
  db.tasks[index] = {
    ...db.tasks[index],
    ...sanitizeTask(payload),
    id,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail
  };
  await writeDb(db);
  return db.tasks[index];
}

export async function deleteTask(id) {
  const db = await readDb();
  const before = db.tasks.length;
  db.tasks = db.tasks.filter(task => task.id !== id);
  await writeDb(db);
  return db.tasks.length !== before;
}

export async function clearAllTasks() {
  const db = await readDb();
  db.tasks = [];
  db.meta.clearedAt = new Date().toISOString();
  await writeDb(db);
  return true;
}

function sanitizeTask(input = {}) {
  const allowed = [
    'title', 'client', 'contact', 'phone', 'assignee', 'category', 'description',
    'notes', 'priority', 'status', 'paymentStatus', 'price', 'paidAmount', 'tags',
    'link', 'dueDate'
  ];
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = typeof input[key] === 'string' ? input[key].slice(0, 5000) : String(input[key] ?? '').slice(0, 5000);
    }
  }
  return out;
}
