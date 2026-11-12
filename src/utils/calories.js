// Rough energy estimate for a strength workout (MET method): kcal = MET × body weight (kg) × hours.
//
// A tracker can't measure heart rate, so this is an ESTIMATE (usually ±25%). The duration is rebuilt from the
// sets that were logged: time under tension for each set + the rest times from the settings.
// MET 4.5 sits between "light/moderate resistance training" (3.5) and "vigorous" (6.0) in the Compendium of Physical Activities.

export const STRENGTH_MET = 4.5;
const SECONDS_PER_REP = 4; // ~2 s up + ~2 s down
const SET_OVERHEAD_SECONDS = 10; // getting into position / unracking

/**
 * @param {Array<{sets: Array<{reps:number|string}>}>} exercises  in workout order
 * @param {{restBetweenSets:number, restBetweenExercises:number}} rest  seconds
 * @returns {{seconds:number, minutes:number, sets:number}}
 */
export function estimateDuration(exercises, rest) {
  const list = exercises
    .map((e) => (e.sets || []).filter((s) => Number(s.reps) > 0))
    .filter((sets) => sets.length > 0);

  let seconds = 0;
  let setCount = 0;
  list.forEach((sets, i) => {
    sets.forEach((s, j) => {
      seconds += Number(s.reps) * SECONDS_PER_REP + SET_OVERHEAD_SECONDS;
      setCount += 1;
      const isLastSetOfExercise = j === sets.length - 1;
      const isLastExercise = i === list.length - 1;
      if (!isLastSetOfExercise) seconds += rest.restBetweenSets;
      else if (!isLastExercise) seconds += rest.restBetweenExercises;
    });
  });
  return { seconds, minutes: Math.round(seconds / 60), sets: setCount };
}

/** @returns {{kcal:number, minutes:number, sets:number}} kcal is 0 when there is no usable body weight. */
export function estimateWorkoutCalories(exercises, bodyWeightKg, rest) {
  const d = estimateDuration(exercises, rest);
  const kg = Number(bodyWeightKg);
  if (!kg || kg <= 0 || d.sets === 0) return { kcal: 0, minutes: d.minutes, sets: d.sets };
  return { kcal: Math.round((STRENGTH_MET * kg * (d.seconds / 3600)) / 5) * 5, minutes: d.minutes, sets: d.sets };
}

/** Body weight valid for a date: the latest log on/before it, else the earliest log after it, else null. */
export function bodyWeightOn(logs, iso) {
  if (!logs || logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => (a.logDate < b.logDate ? -1 : a.logDate > b.logDate ? 1 : 0));
  let found = null;
  for (const l of sorted) {
    if (l.logDate <= iso) found = l;
  }
  return (found ?? sorted[0]).weightKg;
}
