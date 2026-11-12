const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    let message = `خطا در ارتباط با سرور (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response had no JSON body - keep the generic message
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const remoteApi = {
  // ---- Muscles ----
  getMuscles: () => request('/muscles'),
  createMuscle: (data) => request('/muscles', { method: 'POST', body: JSON.stringify(data) }),
  updateMuscle: (id, data) => request(`/muscles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMuscle: (id) => request(`/muscles/${id}`, { method: 'DELETE' }),

  // ---- Exercises ----
  getExercises: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.muscleId) qs.set('muscleId', params.muscleId);
    if (params.search) qs.set('search', params.search);
    const query = qs.toString();
    return request(`/exercises${query ? `?${query}` : ''}`);
  },
  getExercise: (id) => request(`/exercises/${id}`),
  createExercise: (data) => request('/exercises', { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id, data) => request(`/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExercise: (id) => request(`/exercises/${id}`, { method: 'DELETE' }),

  // ---- Programs ----
  getPrograms: () => request('/programs'),
  getProgram: (id) => request(`/programs/${id}`),
  createProgram: (data) => request('/programs', { method: 'POST', body: JSON.stringify(data) }),
  updateProgram: (id, data) => request(`/programs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProgram: (id) => request(`/programs/${id}`, { method: 'DELETE' }),
  updateProgramDay: (programId, dayId, data) =>
    request(`/programs/${programId}/days/${dayId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getProgramDayPrep: (dayId) => request(`/program-days/${dayId}/prep`),

  // ---- Workout sessions ----
  getWorkoutSessions: (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/workout-sessions${qs ? `?${qs}` : ''}`);
  },
  getWorkoutSession: (id) => request(`/workout-sessions/${id}`),
  createWorkoutSession: (data) => request('/workout-sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkoutSession: (id, data) =>
    request(`/workout-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkoutSession: (id) => request(`/workout-sessions/${id}`, { method: 'DELETE' }),

  // ---- Body weight ----
  getBodyWeightLogs: () => request('/body-weight-logs'),
  createBodyWeightLog: (data) => request('/body-weight-logs', { method: 'POST', body: JSON.stringify(data) }),
  updateBodyWeightLog: (id, data) =>
    request(`/body-weight-logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBodyWeightLog: (id) => request(`/body-weight-logs/${id}`, { method: 'DELETE' }),

  // ---- Profile ----
  getUserProfile: () => request('/user-profile'),
  updateUserProfile: (data) => request('/user-profile', { method: 'PUT', body: JSON.stringify(data) }),

  // ---- Foods ----
  getFoods: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category) qs.set('category', params.category);
    if (params.customOnly) qs.set('customOnly', 'true');
    if (params.take) qs.set('take', params.take);
    const query = qs.toString();
    return request(`/foods${query ? `?${query}` : ''}`);
  },
  getFoodCategories: () => request('/foods/categories'),
  getRecentFoods: (take = 15) => request(`/foods/recent?take=${take}`),
  getFood: (id) => request(`/foods/${id}`),
  createFood: (data) => request('/foods', { method: 'POST', body: JSON.stringify(data) }),
  updateFood: (id, data) => request(`/foods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFood: (id) => request(`/foods/${id}`, { method: 'DELETE' }),

  // ---- Food log (diary) ----
  getFoodLog: (date) => request(`/food-log?date=${date}`),
  getFoodLogRange: (from, to) => request(`/food-log/range?from=${from}&to=${to}`),
  createFoodLogEntry: (data) => request('/food-log', { method: 'POST', body: JSON.stringify(data) }),
  updateFoodLogEntry: (id, data) => request(`/food-log/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFoodLogEntry: (id) => request(`/food-log/${id}`, { method: 'DELETE' }),
  copyFoodLog: (data) => request('/food-log/copy', { method: 'POST', body: JSON.stringify(data) }),

  // ---- Nutrition goal & daily targets ----
  getNutritionGoal: () => request('/nutrition/goal'),
  updateNutritionGoal: (data) => request('/nutrition/goal', { method: 'PUT', body: JSON.stringify(data) }),
  getNutritionTargets: (today) => request(`/nutrition/targets${today ? `?today=${today}` : ''}`),
};

// ---- Offline mode (Android app): the same methods, answered by the on-device database ----
// `VITE_DATA_MODE=local` is set only by the app build (.env.app); the normal web build never includes the local engine.
function createLocalApi() {
  let loading;
  const load = () => (loading ??= import('../local/index.js').then((m) => m.getLocalApi()));
  return new Proxy(
    {},
    {
      get: (_, name) => async (...args) => {
        const engine = await load();
        if (typeof engine[name] !== 'function') throw new Error(`متد ${String(name)} در حالت آفلاین وجود ندارد.`);
        return engine[name](...args);
      },
    },
  );
}

export const isLocalMode = import.meta.env.VITE_DATA_MODE === 'local';
export const api = isLocalMode ? createLocalApi() : remoteApi;
