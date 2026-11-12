// A tiny persistent "database" for the offline app: tables live in memory (single user, small data)
// and every table is saved as one record in a key-value adapter (IndexedDB in the app, a Map in tests).

import { buildSearchKey } from './text.js';

export const SCHEMA_VERSION = 1;
export const TABLES = ['muscles', 'exercises', 'programs', 'sessions', 'bodyWeight', 'foods', 'foodLog'];

export function memoryAdapter() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : undefined;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async clear() {
      map.clear();
    },
  };
}

export function indexedDbAdapter(dbName = 'gymora', storeName = 'kv') {
  let dbPromise;
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const result = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: (key, value) => run('readwrite', (s) => s.put(value, key)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
}

const emptyState = () => ({
  muscles: [], exercises: [], programs: [], sessions: [], bodyWeight: [], foods: [], foodLog: [],
  profile: { heightCm: null, birthDate: null, gender: null },
  goal: {
    activityLevel: null, goalType: 'Maintain', targetWeightKg: null, targetDate: null,
    caloriesOverride: null, proteinOverrideG: null, carbsOverrideG: null, fatOverrideG: null,
  },
  seq: {},
});

export function createStore(adapter, loadSeed) {
  let state = emptyState();
  const dirty = new Set();
  let chain = Promise.resolve();
  let ready;

  function persistNames(names) {
    for (const n of names) {
      if (n === 'singles') chain = chain.then(() => adapter.set('singles', { profile: state.profile, goal: state.goal }));
      else if (n === 'meta') chain = chain.then(() => adapter.set('meta', { version: SCHEMA_VERSION, seq: state.seq }));
      else chain = chain.then(() => adapter.set(`t:${n}`, state[n]));
    }
    return chain;
  }

  async function seed() {
    const { foods, gym } = await loadSeed();
    const now = Date.now();

    gym.muscles.forEach((name) => state.muscles.push({ id: nextId('muscle'), name }));
    const byName = new Map(state.muscles.map((m) => [m.name, m.id]));
    for (const e of gym.exercises) {
      state.exercises.push({
        id: nextId('exercise'),
        name: e.name,
        englishName: e.englishName ?? null,
        description: e.description ?? null,
        muscles: e.muscles.filter((m) => byName.has(m.muscle)).map((m) => ({ muscleId: byName.get(m.muscle), role: m.role })),
      });
    }

    for (const f of foods) {
      const row = {
        id: nextId('food'),
        name: f.name.trim(),
        englishName: f.englishName ?? null,
        brand: f.brand ?? null,
        category: f.category?.trim() ? f.category : 'سایر',
        baseUnit: String(f.baseUnit).toLowerCase() === 'ml' ? 'Milliliter' : 'Gram',
        state: f.state ?? null,
        caloriesPer100: f.calories, proteinPer100: f.protein, carbsPer100: f.carbs, sugarPer100: f.sugar, fatPer100: f.fat,
        notes: f.notes ? f.notes.slice(0, 2000) : null,
        source: f.source ? f.source.slice(0, 500) : null,
        confidence: f.confidence ?? null,
        isCustom: false,
        searchKey: buildSearchKey(f.name.trim(), f.englishName, f.brand),
        createdAt: now,
        updatedAt: now,
        servings: (f.servings ?? []).map((s, i) => ({ id: nextId('serving'), label: s.label.slice(0, 60), amount: s.amount, sortOrder: i })),
      };
      state.foods.push(row);
    }
  }

  function nextId(kind) {
    state.seq[kind] = (state.seq[kind] ?? 0) + 1;
    return state.seq[kind];
  }

  return {
    get state() {
      return state;
    },
    nextId,

    /** Loads (or first-time seeds) the database. Safe to call many times. */
    init() {
      ready ??= (async () => {
        const meta = await adapter.get('meta');
        if (!meta) {
          await seed();
          await persistNames([...TABLES, 'singles', 'meta']);
          return;
        }
        state.seq = meta.seq ?? {};
        for (const t of TABLES) state[t] = (await adapter.get(`t:${t}`)) ?? [];
        const singles = await adapter.get('singles');
        if (singles) {
          state.profile = { ...state.profile, ...singles.profile };
          state.goal = { ...state.goal, ...singles.goal };
        }
      })();
      return ready;
    },

    /** Marks tables as changed and waits until they are safely stored. */
    async save(...names) {
      for (const n of names) dirty.add(n);
      const list = [...dirty, 'meta'];
      dirty.clear();
      await persistNames(list);
    },

    exportData() {
      return {
        app: 'gymora',
        schema: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          ...Object.fromEntries(TABLES.map((t) => [t, state[t]])),
          profile: state.profile,
          goal: state.goal,
          seq: state.seq,
        },
      };
    },

    async importData(file) {
      if (!file || file.app !== 'gymora' || !file.data) throw new Error('این فایل پشتیبان Gymora نیست.');
      if (file.schema > SCHEMA_VERSION) throw new Error('این پشتیبان با نسخه‌ی جدیدتری از اپ ساخته شده؛ اپ را به‌روز کن.');
      const d = file.data;
      for (const t of TABLES) if (!Array.isArray(d[t])) throw new Error(`فایل پشتیبان ناقص است (بخش ${t} پیدا نشد).`);
      const next = emptyState();
      for (const t of TABLES) next[t] = d[t];
      next.profile = { ...next.profile, ...d.profile };
      next.goal = { ...next.goal, ...d.goal };
      next.seq = d.seq ?? {};
      // make sure counters are never below an existing id
      const bump = (kind, rows) => {
        const max = rows.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
        next.seq[kind] = Math.max(next.seq[kind] ?? 0, max);
      };
      bump('muscle', next.muscles); bump('exercise', next.exercises); bump('program', next.programs);
      bump('session', next.sessions); bump('bodyWeight', next.bodyWeight); bump('food', next.foods); bump('foodLog', next.foodLog);
      state = next;
      await persistNames([...TABLES, 'singles', 'meta']);
    },

    async wipe() {
      await adapter.clear();
      state = emptyState();
      ready = undefined;
      await this.init();
    },
  };
}
