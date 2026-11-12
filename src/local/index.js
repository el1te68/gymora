// Entry point of the offline backend used by the mobile app (VITE_DATA_MODE=local).
import { createEngine } from './engine.js';
import { createStore, indexedDbAdapter } from './store.js';

const loadSeed = async () => {
  const [foods, gym] = await Promise.all([import('./seed/foods.json'), import('./seed/gym.json')]);
  return { foods: foods.default, gym: gym.default };
};

let engine;

export function getLocalApi() {
  engine ??= createEngine(createStore(indexedDbAdapter(), loadSeed));
  return engine;
}
