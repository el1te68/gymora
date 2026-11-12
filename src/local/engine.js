// The offline "backend": same methods and JSON shapes as src/api/client.js, working on the local store.
// Business rules are ports of the C# services in backend/src (comments name the original).

import {
  applyFoodDto, applyFoodToEntry, computePlan, forAmount, per100Of, sumNutrients, validateFood,
} from './calc.js';
import { addDays, isoToDayNumber, localToday } from './num.js';
import { normalize, searchTokens } from './text.js';

const collator = new Intl.Collator('fa');
const byName = (a, b) => collator.compare(a.name, b.name);
const ordinal = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const notFound = (entity, id) => new Error(`${entity} با شناسه‌ی '${id}' پیدا نشد.`);
const blank = (s) => s == null || String(s).trim() === '';
const nz = (v) => (v === undefined || v === '' ? null : v);

export function createEngine(store) {
  const S = () => store.state;
  const ready = () => store.init();
  const out = (v) => structuredClone(v);

  // ======================= Muscles =======================
  const muscleDto = (m) => ({ id: m.id, name: m.name });

  function checkMuscleName(name, exceptId) {
    if (blank(name)) throw new Error('نام عضله الزامی است.');
    if (name.trim().length > 100) throw new Error('نام عضله خیلی طولانی است.');
    if (S().muscles.some((m) => m.name === name.trim() && m.id !== exceptId)) throw new Error('عضله‌ای با این نام قبلاً ثبت شده.');
  }

  // ======================= Exercises =======================
  const exerciseDto = (e) => ({
    id: e.id, name: e.name, englishName: e.englishName, description: e.description,
    muscles: e.muscles.map((em) => ({
      muscleId: em.muscleId, muscleName: S().muscles.find((m) => m.id === em.muscleId)?.name ?? '', role: em.role,
    })),
  });

  function exerciseFields(dto) {
    if (blank(dto.name)) throw new Error('نام حرکت الزامی است.');
    if (dto.name.trim().length > 150 || (dto.englishName?.length ?? 0) > 150) throw new Error('نام حرکت خیلی طولانی است.');
    if ((dto.description?.length ?? 0) > 2000) throw new Error('توضیحات حداکثر ۲۰۰۰ کاراکتر می‌تواند باشد.');
    const seen = new Set();
    const muscles = [];
    for (const m of dto.muscles ?? []) {
      if (!S().muscles.some((x) => x.id === m.muscleId)) throw new Error('عضله‌ی انتخاب‌شده وجود ندارد.');
      if (seen.has(m.muscleId)) continue;
      seen.add(m.muscleId);
      muscles.push({ muscleId: m.muscleId, role: m.role === 'Secondary' ? 'Secondary' : 'Primary' });
    }
    return { name: dto.name.trim(), englishName: nz(dto.englishName), description: nz(dto.description), muscles };
  }

  // ======================= Programs =======================
  const dayOrder = (d) => DAYS.indexOf(d.weekday);

  function validateDays(days) {
    for (const day of days) {
      for (const ex of day.exercises ?? []) {
        if (ex.repMin > ex.repMax) {
          throw new Error(`بازه‌ی تکرار نامعتبر است: حداقل (${ex.repMin}) نمی‌تواند از حداکثر (${ex.repMax}) بیشتر باشد.`);
        }
        if (!(ex.sets > 0)) throw new Error('تعداد ست باید بزرگ‌تر از صفر باشد.');
        if (!S().exercises.some((e) => e.id === ex.exerciseId)) throw new Error('حرکت انتخاب‌شده وجود ندارد.');
      }
    }
  }

  const newProgramExercise = (dto) => ({
    id: store.nextId('programExercise'), exerciseId: dto.exerciseId, order: dto.order, sets: dto.sets, repMin: dto.repMin, repMax: dto.repMax,
  });

  const newDay = (dto) => ({
    id: store.nextId('day'), weekday: dto.weekday, isRestDay: !!dto.isRestDay, title: nz(dto.title),
    exercises: (dto.exercises ?? []).map(newProgramExercise),
  });

  function programDto(p) {
    return {
      id: p.id, name: p.name, startDate: p.startDate,
      days: [...p.days].sort((a, b) => dayOrder(a) - dayOrder(b)).map((d) => ({
        id: d.id, weekday: d.weekday, isRestDay: d.isRestDay, title: d.title,
        exercises: [...d.exercises].sort((a, b) => a.order - b.order).map((pe) => ({
          id: pe.id, exerciseId: pe.exerciseId, exerciseName: S().exercises.find((e) => e.id === pe.exerciseId)?.name ?? '',
          order: pe.order, sets: pe.sets, repMin: pe.repMin, repMax: pe.repMax,
        })),
      })),
    };
  }

  const findProgram = (id) => S().programs.find((p) => p.id === id) ?? (() => { throw notFound('WorkoutProgram', id); })();

  function checkProgramFields(dto) {
    if (blank(dto.name)) throw new Error('نام برنامه الزامی است.');
    if (dto.name.trim().length > 150) throw new Error('نام برنامه خیلی طولانی است.');
    if (!dto.startDate) throw new Error('تاریخ شروع الزامی است.');
  }

  // ======================= Sessions =======================
  function sessionDto(s) {
    return {
      id: s.id, programDayId: s.programDayId, sessionDate: s.sessionDate,
      exerciseLogs: [...s.exerciseLogs].sort((a, b) => a.id - b.id).map((l) => ({
        id: l.id, exerciseId: l.exerciseId, exerciseName: S().exercises.find((e) => e.id === l.exerciseId)?.name ?? '',
        sets: [...l.sets].sort((a, b) => a.setNumber - b.setNumber).map((x) => ({ setNumber: x.setNumber, reps: x.reps, weightKg: x.weightKg })),
      })),
    };
  }

  function newLogs(dtoLogs) {
    return (dtoLogs ?? []).map((l) => {
      if (!S().exercises.some((e) => e.id === l.exerciseId)) throw new Error('حرکت انتخاب‌شده وجود ندارد.');
      return {
        id: store.nextId('exerciseLog'), exerciseId: l.exerciseId,
        sets: (l.sets ?? []).map((x) => ({ setNumber: x.setNumber, reps: x.reps, weightKg: x.weightKg })),
      };
    });
  }

  function checkSessionFields(dto) {
    if (!dto.sessionDate) throw new Error('تاریخ تمرین الزامی است.');
    if (dto.programDayId != null && !S().programs.some((p) => p.days.some((d) => d.id === dto.programDayId))) {
      throw new Error('روز برنامه‌ی انتخاب‌شده وجود ندارد.');
    }
  }

  // ======================= Foods =======================
  const foodDto = (f) => ({
    id: f.id, name: f.name, englishName: f.englishName, brand: f.brand, category: f.category, baseUnit: f.baseUnit, state: f.state,
    caloriesPer100: f.caloriesPer100, proteinPer100: f.proteinPer100, carbsPer100: f.carbsPer100, sugarPer100: f.sugarPer100,
    fatPer100: f.fatPer100, notes: f.notes, source: f.source, confidence: f.confidence, isCustom: f.isCustom,
    servings: [...f.servings].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map((s) => ({ id: s.id, label: s.label, amount: s.amount })),
  });

  const findFood = (id) => S().foods.find((f) => f.id === id) ?? (() => { throw notFound('Food', id); })();

  function setServings(food, dto) {
    food.servings = (dto.servings ?? []).map((s, i) => ({
      id: store.nextId('serving'), label: s.label.trim(), amount: Math.round(s.amount * 100) / 100, sortOrder: i,
    }));
  }

  // ======================= Food log =======================
  const entryDto = (e) => ({
    id: e.id, logDate: e.logDate, mealType: e.mealType, foodId: e.foodId, foodName: e.foodName, foodBrand: e.foodBrand,
    baseUnit: e.baseUnit, quantity: e.quantity, unitLabel: e.unitLabel, unitAmount: e.unitAmount, totalAmount: e.totalAmount,
    calories: e.calories, protein: e.protein, carbs: e.carbs, sugar: e.sugar, fat: e.fat,
  });
  const ofEntry = (e) => ({ calories: e.calories, protein: e.protein, carbs: e.carbs, sugar: e.sugar, fat: e.fat });
  const byCreated = (a, b) => a.createdAt - b.createdAt || a.id - b.id;

  function buildDay(date, entries) {
    const list = [...entries].sort(byCreated);
    const meals = MEALS.map((meal) => {
      const mine = list.filter((e) => e.mealType === meal);
      return { mealType: meal, entries: mine.map(entryDto), totals: sumNutrients(mine.map(ofEntry)) };
    });
    return { date, meals, totals: sumNutrients(list.map(ofEntry)) };
  }

  function loadFoodAndServing(dto) {
    if (!MEALS.includes(dto.mealType)) throw new Error('وعده نامعتبر است.');
    if (!dto.logDate) throw new Error('تاریخ الزامی است.');
    const food = findFood(dto.foodId);
    let serving = null;
    if (dto.servingId != null) {
      serving = food.servings.find((s) => s.id === dto.servingId);
      if (!serving) throw new Error('واحد انتخاب‌شده متعلق به این غذا نیست.');
    }
    return { food, serving };
  }

  // ======================= Goal / targets =======================
  function goalDto(g) {
    return {
      activityLevel: g.activityLevel, goalType: g.goalType, targetWeightKg: g.targetWeightKg, targetDate: g.targetDate,
      caloriesOverride: g.caloriesOverride, proteinOverrideG: g.proteinOverrideG, carbsOverrideG: g.carbsOverrideG, fatOverrideG: g.fatOverrideG,
    };
  }

  // ======================= Public API =======================
  const impl = {
    // ---- Muscles ----
    async getMuscles() {
      return [...S().muscles].sort(byName).map(muscleDto);
    },
    async createMuscle(dto) {
      checkMuscleName(dto.name);
      const m = { id: store.nextId('muscle'), name: dto.name.trim() };
      S().muscles.push(m);
      await store.save('muscles');
      return muscleDto(m);
    },
    async updateMuscle(id, dto) {
      const m = S().muscles.find((x) => x.id === id);
      if (!m) throw notFound('Muscle', id);
      checkMuscleName(dto.name, id);
      m.name = dto.name.trim();
      await store.save('muscles');
      return muscleDto(m);
    },
    async deleteMuscle(id) {
      const i = S().muscles.findIndex((x) => x.id === id);
      if (i < 0) throw notFound('Muscle', id);
      S().muscles.splice(i, 1);
      for (const e of S().exercises) e.muscles = e.muscles.filter((em) => em.muscleId !== id);
      await store.save('muscles', 'exercises');
      return null;
    },

    // ---- Exercises ----
    async getExercises(params = {}) {
      let list = S().exercises;
      if (params.muscleId) list = list.filter((e) => e.muscles.some((em) => em.muscleId === Number(params.muscleId)));
      const term = normalize(params.search);
      if (term) {
        list = list.filter((e) => normalize(e.name).includes(term) || (e.englishName && normalize(e.englishName).includes(term)));
      }
      return [...list].sort(byName).map(exerciseDto);
    },
    async getExercise(id) {
      const e = S().exercises.find((x) => x.id === id);
      if (!e) throw notFound('Exercise', id);
      return exerciseDto(e);
    },
    async createExercise(dto) {
      const f = exerciseFields(dto);
      const e = { id: store.nextId('exercise'), ...f };
      S().exercises.push(e);
      await store.save('exercises');
      return exerciseDto(e);
    },
    async updateExercise(id, dto) {
      const e = S().exercises.find((x) => x.id === id);
      if (!e) throw notFound('Exercise', id);
      Object.assign(e, exerciseFields(dto));
      await store.save('exercises');
      return exerciseDto(e);
    },
    async deleteExercise(id) {
      const i = S().exercises.findIndex((x) => x.id === id);
      if (i < 0) throw notFound('Exercise', id);
      const used =
        S().programs.some((p) => p.days.some((d) => d.exercises.some((pe) => pe.exerciseId === id))) ||
        S().sessions.some((s) => s.exerciseLogs.some((l) => l.exerciseId === id));
      if (used) throw new Error('این حرکت در یک برنامه یا تمرین ثبت‌شده استفاده شده و نمی‌شود حذفش کرد.');
      S().exercises.splice(i, 1);
      await store.save('exercises');
      return null;
    },

    // ---- Programs ----
    async getPrograms() {
      return [...S().programs]
        .sort((a, b) => ordinal(b.startDate, a.startDate) || b.id - a.id)
        .map((p) => ({ id: p.id, name: p.name, startDate: p.startDate }));
    },
    async getProgram(id) {
      return programDto(findProgram(id));
    },
    async createProgram(dto) {
      checkProgramFields(dto);
      validateDays(dto.days ?? []);
      const p = { id: store.nextId('program'), name: dto.name.trim(), startDate: dto.startDate, days: (dto.days ?? []).map(newDay) };
      S().programs.push(p);
      await store.save('programs');
      return programDto(p);
    },
    async updateProgram(id, dto) {
      checkProgramFields(dto);
      validateDays(dto.days ?? []);
      const p = findProgram(id);
      const oldDayIds = new Set(p.days.map((d) => d.id));
      p.name = dto.name.trim();
      p.startDate = dto.startDate;
      p.days = (dto.days ?? []).map(newDay); // full replace, like the server
      let touchedSessions = false;
      for (const s of S().sessions) {
        if (s.programDayId != null && oldDayIds.has(s.programDayId)) { s.programDayId = null; touchedSessions = true; }
      }
      await store.save('programs', ...(touchedSessions ? ['sessions'] : []));
      return programDto(p);
    },
    async deleteProgram(id) {
      const i = S().programs.findIndex((x) => x.id === id);
      if (i < 0) throw notFound('WorkoutProgram', id);
      const dayIds = new Set(S().programs[i].days.map((d) => d.id));
      S().programs.splice(i, 1);
      let touched = false;
      for (const s of S().sessions) if (s.programDayId != null && dayIds.has(s.programDayId)) { s.programDayId = null; touched = true; }
      await store.save('programs', ...(touched ? ['sessions'] : []));
      return null;
    },
    async updateProgramDay(programId, dayId, dto) {
      validateDays([dto]);
      const p = S().programs.find((x) => x.id === programId);
      const day = p?.days.find((d) => d.id === dayId);
      if (!day) throw notFound('ProgramDay', dayId);
      day.weekday = dto.weekday;
      day.isRestDay = !!dto.isRestDay;
      day.title = nz(dto.title);
      day.exercises = (dto.exercises ?? []).map(newProgramExercise);
      await store.save('programs');
      return programDto(p);
    },
    async getProgramDayPrep(dayId) {
      const day = S().programs.flatMap((p) => p.days).find((d) => d.id === dayId);
      if (!day) throw notFound('ProgramDay', dayId);
      const exercises = [...day.exercises].sort((a, b) => a.order - b.order).map((pe) => {
        let last = null;
        for (const s of S().sessions) {
          for (const l of s.exerciseLogs) {
            if (l.exerciseId !== pe.exerciseId) continue;
            if (!last || ordinal(s.sessionDate, last.session.sessionDate) > 0 || (s.sessionDate === last.session.sessionDate && s.id > last.session.id)) {
              last = { session: s, log: l };
            }
          }
        }
        return {
          programExerciseId: pe.id, exerciseId: pe.exerciseId, exerciseName: S().exercises.find((e) => e.id === pe.exerciseId)?.name ?? '',
          targetSets: pe.sets, targetRepMin: pe.repMin, targetRepMax: pe.repMax,
          lastSession: last && {
            date: last.session.sessionDate,
            sets: [...last.log.sets].sort((a, b) => a.setNumber - b.setNumber).map((x) => ({ setNumber: x.setNumber, reps: x.reps, weightKg: x.weightKg })),
          },
        };
      });
      return { dayId: day.id, weekday: day.weekday, title: day.title, exercises };
    },

    // ---- Workout sessions ----
    async getWorkoutSessions(from, to) {
      return S().sessions
        .filter((s) => (!from || s.sessionDate >= from) && (!to || s.sessionDate <= to))
        .sort((a, b) => ordinal(b.sessionDate, a.sessionDate) || b.id - a.id)
        .map(sessionDto);
    },
    async getWorkoutSession(id) {
      const s = S().sessions.find((x) => x.id === id);
      if (!s) throw notFound('WorkoutSession', id);
      return sessionDto(s);
    },
    async createWorkoutSession(dto) {
      checkSessionFields(dto);
      const s = { id: store.nextId('session'), programDayId: dto.programDayId ?? null, sessionDate: dto.sessionDate, exerciseLogs: newLogs(dto.exerciseLogs) };
      S().sessions.push(s);
      await store.save('sessions');
      return sessionDto(s);
    },
    async updateWorkoutSession(id, dto) {
      const s = S().sessions.find((x) => x.id === id);
      if (!s) throw notFound('WorkoutSession', id);
      checkSessionFields(dto);
      s.programDayId = dto.programDayId ?? null;
      s.sessionDate = dto.sessionDate;
      s.exerciseLogs = newLogs(dto.exerciseLogs);
      await store.save('sessions');
      return sessionDto(s);
    },
    async deleteWorkoutSession(id) {
      const i = S().sessions.findIndex((x) => x.id === id);
      if (i < 0) throw notFound('WorkoutSession', id);
      S().sessions.splice(i, 1);
      await store.save('sessions');
      return null;
    },

    // ---- Body weight ----
    async getBodyWeightLogs() {
      return [...S().bodyWeight].sort((a, b) => ordinal(a.logDate, b.logDate)).map((b) => ({ id: b.id, logDate: b.logDate, weightKg: b.weightKg }));
    },
    async createBodyWeightLog(dto) {
      if (!dto.logDate) throw new Error('تاریخ الزامی است.');
      if (!(dto.weightKg > 0)) throw new Error('وزن باید بزرگ‌تر از صفر باشد.');
      if (S().bodyWeight.some((b) => b.logDate === dto.logDate)) throw new Error('برای این تاریخ قبلاً وزن ثبت شده؛ همان را ویرایش یا حذف کن.');
      const b = { id: store.nextId('bodyWeight'), logDate: dto.logDate, weightKg: dto.weightKg };
      S().bodyWeight.push(b);
      await store.save('bodyWeight');
      return { id: b.id, logDate: b.logDate, weightKg: b.weightKg };
    },
    async updateBodyWeightLog(id, dto) {
      const b = S().bodyWeight.find((x) => x.id === id);
      if (!b) throw notFound('BodyWeightLog', id);
      if (!(dto.weightKg > 0)) throw new Error('وزن باید بزرگ‌تر از صفر باشد.');
      if (S().bodyWeight.some((x) => x.logDate === dto.logDate && x.id !== id)) throw new Error('برای این تاریخ قبلاً وزن ثبت شده.');
      b.logDate = dto.logDate;
      b.weightKg = dto.weightKg;
      await store.save('bodyWeight');
      return { id: b.id, logDate: b.logDate, weightKg: b.weightKg };
    },
    async deleteBodyWeightLog(id) {
      const i = S().bodyWeight.findIndex((x) => x.id === id);
      if (i < 0) throw notFound('BodyWeightLog', id);
      S().bodyWeight.splice(i, 1);
      await store.save('bodyWeight');
      return null;
    },

    // ---- Profile ----
    async getUserProfile() {
      return { ...S().profile };
    },
    async updateUserProfile(dto) {
      S().profile = { heightCm: nz(dto.heightCm) ?? null, birthDate: nz(dto.birthDate) ?? null, gender: nz(dto.gender) ?? null };
      await store.save('singles');
      return { ...S().profile };
    },

    // ---- Foods ----
    async getFoods(params = {}) {
      const limit = clamp(params.take ?? 60, 1, 500);
      let list = S().foods;
      if (params.category) list = list.filter((f) => f.category === params.category);
      if (params.customOnly) list = list.filter((f) => f.isCustom);
      const tokens = searchTokens(params.search);
      for (const t of tokens) list = list.filter((f) => f.searchKey.includes(t));

      if (tokens.length === 0) return [...list].sort(byName).slice(0, limit).map(foodDto);

      const candidates = [...list].sort(byName).slice(0, 300);
      const first = tokens[0];
      const all = tokens.join(' ');
      const rank = (f) => {
        const name = normalize(f.name);
        if (name === all) return 0;
        if (name.startsWith(first)) return 1;
        if (name.includes(first)) return 2;
        return 3;
      };
      return candidates
        .map((f) => ({ f, r: rank(f) }))
        .sort((a, b) => a.r - b.r || a.f.name.length - b.f.name.length || ordinal(a.f.name, b.f.name))
        .slice(0, limit)
        .map((x) => foodDto(x.f));
    },
    async getFoodCategories() {
      return [...new Set(S().foods.map((f) => f.category))].sort((a, b) => collator.compare(a, b));
    },
    async getRecentFoods(take = 15) {
      const limit = clamp(take ?? 15, 1, 50);
      const ids = [];
      const recent = S().foodLog
        .filter((e) => e.foodId != null)
        .sort((a, b) => ordinal(b.logDate, a.logDate) || b.id - a.id)
        .slice(0, 400);
      for (const e of recent) {
        if (!ids.includes(e.foodId)) ids.push(e.foodId);
        if (ids.length >= limit) break;
      }
      return ids.map((id) => S().foods.find((f) => f.id === id)).filter(Boolean).map(foodDto);
    },
    async getFood(id) {
      return foodDto(findFood(id));
    },
    async createFood(dto) {
      validateFood(dto);
      const now = Date.now();
      const food = { id: store.nextId('food'), isCustom: true, source: null, confidence: null, createdAt: now, updatedAt: now, servings: [] };
      applyFoodDto(food, dto);
      setServings(food, dto);
      S().foods.push(food);
      await store.save('foods');
      return foodDto(food);
    },
    async updateFood(id, dto) {
      validateFood(dto);
      const food = findFood(id);
      applyFoodDto(food, dto);
      food.updatedAt = Date.now();
      setServings(food, dto);
      await store.save('foods');
      return foodDto(food);
    },
    async deleteFood(id) {
      const i = S().foods.findIndex((f) => f.id === id);
      if (i < 0) throw notFound('Food', id);
      S().foods.splice(i, 1);
      let touched = false;
      for (const e of S().foodLog) if (e.foodId === id) { e.foodId = null; touched = true; }
      await store.save('foods', ...(touched ? ['foodLog'] : []));
      return null;
    },

    // ---- Food log ----
    async getFoodLog(date) {
      return buildDay(date, S().foodLog.filter((e) => e.logDate === date));
    },
    async getFoodLogRange(from, to) {
      if (to < from) throw new Error('تاریخ پایان نباید قبل از تاریخ شروع باشد.');
      if (isoToDayNumber(to) - isoToDayNumber(from) > 400) throw new Error('بازه‌ی تاریخ حداکثر ۴۰۰ روز می‌تواند باشد.');
      const groups = new Map();
      for (const e of S().foodLog) {
        if (e.logDate < from || e.logDate > to) continue;
        if (!groups.has(e.logDate)) groups.set(e.logDate, []);
        groups.get(e.logDate).push(e);
      }
      return [...groups.keys()].sort().map((date) => ({ date, entryCount: groups.get(date).length, totals: sumNutrients(groups.get(date).map(ofEntry)) }));
    },
    async createFoodLogEntry(dto) {
      const { food, serving } = loadFoodAndServing(dto);
      const entry = { id: store.nextId('foodLog'), logDate: dto.logDate, mealType: dto.mealType, createdAt: Date.now() };
      applyFoodToEntry(entry, food, dto.quantity, serving);
      S().foodLog.push(entry);
      await store.save('foodLog');
      return entryDto(entry);
    },
    async updateFoodLogEntry(id, dto) {
      const entry = S().foodLog.find((e) => e.id === id);
      if (!entry) throw notFound('FoodLogEntry', id);
      const { food, serving } = loadFoodAndServing(dto);
      const draft = { ...entry, logDate: dto.logDate, mealType: dto.mealType };
      applyFoodToEntry(draft, food, dto.quantity, serving); // throws before anything is changed
      Object.assign(entry, draft);
      await store.save('foodLog');
      return entryDto(entry);
    },
    async deleteFoodLogEntry(id) {
      const i = S().foodLog.findIndex((e) => e.id === id);
      if (i < 0) throw notFound('FoodLogEntry', id);
      S().foodLog.splice(i, 1);
      await store.save('foodLog');
      return null;
    },
    async copyFoodLog(dto) {
      if (dto.fromDate === dto.toDate && (dto.fromMeal == null || dto.fromMeal === (dto.toMeal ?? dto.fromMeal))) {
        throw new Error('مبدأ و مقصد کپی یکسان است.');
      }
      const source = S().foodLog.filter((e) => e.logDate === dto.fromDate && (dto.fromMeal == null || e.mealType === dto.fromMeal)).sort(byCreated);
      if (source.length === 0) throw new Error('چیزی برای کپی کردن وجود ندارد.');
      const now = Date.now();
      for (const e of source) {
        const { id: _id, createdAt: _c, ...rest } = e;
        S().foodLog.push({
          ...rest, id: store.nextId('foodLog'), logDate: dto.toDate, createdAt: now,
          mealType: dto.fromMeal == null ? e.mealType : dto.toMeal ?? e.mealType,
        });
      }
      await store.save('foodLog');
      return buildDay(dto.toDate, S().foodLog.filter((e) => e.logDate === dto.toDate));
    },

    // ---- Goal & targets ----
    async getNutritionGoal() {
      return goalDto(S().goal);
    },
    async updateNutritionGoal(dto) {
      const tw = dto.targetWeightKg;
      if (tw != null && (tw < 20 || tw > 400)) throw new Error('وزن هدف باید بین ۲۰ تا ۴۰۰ کیلوگرم باشد.');
      if (dto.caloriesOverride != null && (dto.caloriesOverride < 500 || dto.caloriesOverride > 10000)) throw new Error('کالری دلخواه باید بین ۵۰۰ تا ۱۰۰۰۰ باشد.');
      for (const [v, name] of [[dto.proteinOverrideG, 'پروتئین'], [dto.carbsOverrideG, 'کربوهیدرات'], [dto.fatOverrideG, 'چربی']]) {
        if (v != null && (v < 0 || v > 2000)) throw new Error(`مقدار ${name} دلخواه باید بین ۰ تا ۲۰۰۰ گرم باشد.`);
      }
      S().goal = {
        activityLevel: dto.activityLevel ?? null, goalType: dto.goalType ?? 'Maintain', targetWeightKg: tw ?? null, targetDate: dto.targetDate ?? null,
        caloriesOverride: dto.caloriesOverride ?? null, proteinOverrideG: dto.proteinOverrideG ?? null,
        carbsOverrideG: dto.carbsOverrideG ?? null, fatOverrideG: dto.fatOverrideG ?? null,
      };
      await store.save('singles');
      return goalDto(S().goal);
    },
    async getNutritionTargets(today) {
      const goal = S().goal;
      const profile = S().profile;
      const latest = [...S().bodyWeight].sort((a, b) => ordinal(b.logDate, a.logDate))[0];
      const plan = computePlan({
        gender: profile.gender, birthDate: profile.birthDate, heightCm: profile.heightCm, weightKg: latest?.weightKg ?? null,
        activity: goal.activityLevel, goal: goal.goalType, targetWeightKg: goal.targetWeightKg, targetDate: goal.targetDate,
        today: today ?? localToday(),
      });
      const computed = { calories: plan.calories, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG, sugarMaxG: plan.sugarMaxG };
      const effective = {
        calories: goal.caloriesOverride ?? plan.calories, proteinG: goal.proteinOverrideG ?? plan.proteinG,
        carbsG: goal.carbsOverrideG ?? plan.carbsG, fatG: goal.fatOverrideG ?? plan.fatG, sugarMaxG: plan.sugarMaxG,
      };
      return {
        isComplete: plan.isComplete, missing: plan.missing, age: plan.age, weightKg: latest?.weightKg ?? null, bmi: plan.bmi, bmr: plan.bmr,
        tdee: plan.tdee, weeklyChangeKg: plan.weeklyChangeKg, daysToGoal: plan.daysToGoal, projectedDate: plan.projectedDate,
        computed, effective, notes: plan.notes,
      };
    },
  };

  // Every call waits for the database to be ready and returns copies, so React state can never mutate the store.
  const api = {};
  for (const [name, fn] of Object.entries(impl)) {
    api[name] = async (...args) => {
      await ready();
      return out(await fn(...args));
    };
  }
  api.exportData = async () => { await ready(); return out(store.exportData()); };
  api.importData = async (file) => { await ready(); await store.importData(file); };
  api.wipeData = async () => { await ready(); await store.wipe(); };
  return api;
}

// kept for tests / debugging
export { addDays, forAmount, per100Of };
