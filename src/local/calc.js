// Port of NutritionCalculator / NutritionMath / FoodValidator (see backend/src/Gymora.Application/Nutrition).
import { addDays, isoToDayNumber, parseIso, roundAway, roundEven } from './num.js';
import { buildSearchKey, normalize } from './text.js';

export const KCAL_PER_KG = 7700;

const ACTIVITY = { Sedentary: 1.2, Light: 1.375, Moderate: 1.55, Active: 1.725, VeryActive: 1.9 };
export const activityFactor = (level) => ACTIVITY[level] ?? 1.2;

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Completed years on `today` (a Feb-29 birthday counts on Feb 28 of non-leap years, like DateOnly.AddYears). */
export function ageOn(birthIso, todayIso) {
  const b = parseIso(birthIso);
  const t = parseIso(todayIso);
  let age = t.y - b.y;
  let bm = b.m;
  let bd = b.d;
  if (bm === 2 && bd === 29 && !isLeap(b.y + age)) bd = 28;
  const before = t.m < bm || (t.m === bm && t.d < bd);
  if (before) age--;
  return age;
}

const roundTo = (v, step) => roundAway(v / step, 0) * step;

export function computePlan(i) {
  const missing = [];
  if (!i.gender) missing.push('جنسیت');
  if (!i.birthDate) missing.push('تاریخ تولد');
  if (i.heightCm == null || i.heightCm <= 0) missing.push('قد');
  if (i.weightKg == null || i.weightKg <= 0) missing.push('وزن');
  if (!i.activity) missing.push('سطح فعالیت');

  if (missing.length > 0) {
    return {
      isComplete: false, missing, age: null, bmi: null, bmr: null, tdee: null, calories: null, proteinG: null,
      carbsG: null, fatG: null, sugarMaxG: null, weeklyChangeKg: null, daysToGoal: null, projectedDate: null, notes: [],
    };
  }

  const notes = [];
  const weight = i.weightKg;
  const height = i.heightCm;
  const age = ageOn(i.birthDate, i.today);

  if (age < 18) {
    notes.push('این محاسبه برای بزرگسالان طراحی شده؛ برای زیر ۱۸ سال حتماً با پزشک یا متخصص تغذیه مشورت کن.');
  }

  const sexConstant = i.gender === 'Male' ? 5 : i.gender === 'Female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexConstant;
  const tdee = bmr * activityFactor(i.activity);
  const bmi = weight / ((height / 100) * (height / 100));
  const minCalories = i.gender === 'Male' ? 1500 : i.gender === 'Female' ? 1200 : 1350;

  const goal = i.goal;
  let target = i.targetWeightKg != null && i.targetWeightKg > 0 ? i.targetWeightKg : null;
  let daysLeft = i.targetDate ? isoToDayNumber(i.targetDate) - isoToDayNumber(i.today) : null;

  if (goal === 'Lose' && target !== null && target >= weight) {
    notes.push('وزن هدف از وزن فعلی بیشتر یا برابر است؛ برای کاهش وزن، یک وزن هدف کمتر از وزن فعلی وارد کن. فعلاً کاهش ملایم پیش‌فرض اعمال شد.');
    target = null;
  } else if (goal === 'Gain' && target !== null && target <= weight) {
    notes.push('وزن هدف از وزن فعلی کمتر یا برابر است؛ برای افزایش وزن، یک وزن هدف بیشتر از وزن فعلی وارد کن. فعلاً افزایش ملایم پیش‌فرض اعمال شد.');
    target = null;
  }

  if (daysLeft !== null && daysLeft <= 0) {
    notes.push('تاریخ هدف گذشته یا امروز است؛ برای محاسبه‌ی دقیق یک تاریخ آینده انتخاب کن.');
    daysLeft = null;
  }

  let dailyDelta;
  if (goal === 'Lose') {
    const maxDeficit = Math.min(0.25 * tdee, (0.01 * weight * KCAL_PER_KG) / 7);
    let wanted;
    if (target !== null && daysLeft !== null) {
      wanted = ((weight - target) * KCAL_PER_KG) / daysLeft;
    } else {
      wanted = Math.min(0.2 * tdee, maxDeficit);
      if (target !== null) notes.push('برای محاسبه‌ی دقیق‌تر، تاریخ رسیدن به وزن هدف را هم وارد کن.');
    }

    let deficit = Math.min(wanted, maxDeficit);
    const floor = tdee - minCalories;
    if (deficit > floor) {
      deficit = Math.max(0, floor);
      notes.push(`کالری روزانه پایین‌تر از حداقل ایمن (${minCalories} کیلوکالری) نمی‌آید.`);
    }
    if (target !== null && daysLeft !== null && deficit + 0.5 < wanted) {
      notes.push('برای رسیدن به وزن هدف در این مدت، کسری کالری بیش از حد ایمن لازم است؛ برنامه روی حد ایمن تنظیم شد و تاریخ رسیدن واقعی‌تر در زیر آمده.');
    }
    dailyDelta = -deficit;
  } else if (goal === 'Gain') {
    const maxSurplus = Math.min(500, 0.2 * tdee);
    let wanted;
    if (target !== null && daysLeft !== null) {
      wanted = ((target - weight) * KCAL_PER_KG) / daysLeft;
    } else {
      wanted = Math.min(0.1 * tdee, 350);
      if (target !== null) notes.push('برای محاسبه‌ی دقیق‌تر، تاریخ رسیدن به وزن هدف را هم وارد کن.');
    }
    const surplus = Math.min(wanted, maxSurplus);
    if (target !== null && daysLeft !== null && surplus + 0.5 < wanted) {
      notes.push('برای رسیدن به وزن هدف در این مدت، مازاد کالری بیش از حد توصیه‌شده لازم است؛ برنامه روی حد منطقی تنظیم شد. افزایش سریع‌تر بیشتر چربی می‌شود تا عضله.');
    }
    dailyDelta = surplus;
  } else {
    dailyDelta = 0;
  }

  const calories = roundTo(tdee + dailyDelta, 10);
  const actualDelta = calories - tdee;
  const weeklyChange = roundEven((actualDelta * 7) / KCAL_PER_KG, 2);

  const proteinPerKg = goal === 'Lose' ? 2.0 : goal === 'Gain' ? 1.8 : 1.6;
  const protein = Math.min(proteinPerKg * weight, (0.4 * calories) / 4);
  const fat = Math.max((0.25 * calories) / 9, 0.6 * weight);
  let carbs = (calories - 4 * protein - 9 * fat) / 4;
  if (carbs < 0) {
    carbs = 0;
    notes.push('با این کالری، سهم کربوهیدرات خیلی کم می‌شود؛ هدف را ملایم‌تر کن یا کالری را دستی بالاتر ببر.');
  }
  const sugarMax = (0.1 * calories) / 4;

  let daysToGoal = null;
  let projected = null;
  if (goal !== 'Maintain' && target !== null && Math.abs(actualDelta) >= 20) {
    const needed = (Math.abs(target - weight) * KCAL_PER_KG) / Math.abs(actualDelta);
    daysToGoal = Math.ceil(needed - 1e-9);
    projected = addDays(i.today, daysToGoal);
  }

  if (goal !== 'Maintain' && target === null && daysLeft === null) {
    notes.push('وزن هدف و تاریخ را وارد کن تا برنامه دقیق‌تری برایت حساب شود.');
  }

  return {
    isComplete: true,
    missing,
    age,
    bmi: roundEven(bmi, 1),
    bmr: roundEven(bmr, 0),
    tdee: roundEven(tdee, 0),
    calories,
    proteinG: roundEven(protein, 0),
    carbsG: roundEven(carbs, 0),
    fatG: roundEven(fat, 0),
    sugarMaxG: roundEven(sugarMax, 0),
    weeklyChangeKg: weeklyChange,
    daysToGoal,
    projectedDate: projected,
    notes,
  };
}

// ---------------- NutritionMath ----------------

const r1 = (v) => roundAway(v, 1);

export const per100Of = (food) => ({
  calories: food.caloriesPer100, protein: food.proteinPer100, carbs: food.carbsPer100, sugar: food.sugarPer100, fat: food.fatPer100,
});

export function forAmount(per100, amount) {
  const f = amount / 100;
  return {
    calories: r1(per100.calories * f), protein: r1(per100.protein * f), carbs: r1(per100.carbs * f),
    sugar: r1(per100.sugar * f), fat: r1(per100.fat * f),
  };
}

export function sumNutrients(items) {
  const t = { calories: 0, protein: 0, carbs: 0, sugar: 0, fat: 0 };
  for (const n of items) {
    t.calories += n.calories; t.protein += n.protein; t.carbs += n.carbs; t.sugar += n.sugar; t.fat += n.fat;
  }
  return { calories: r1(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), sugar: r1(t.sugar), fat: r1(t.fat) };
}

/** Fills an entry's snapshot from a food + quantity (serving null = plain g / ml). */
export function applyFoodToEntry(entry, food, quantity, serving) {
  if (!(quantity > 0)) throw new Error('مقدار باید بیشتر از صفر باشد.');
  if (quantity > 100000) throw new Error('مقدار واردشده بیش از حد بزرگ است.');

  const unitAmount = serving ? serving.amount : 1;
  const unitLabel = serving ? serving.label : food.baseUnit === 'Milliliter' ? 'میلی‌لیتر' : 'گرم';
  const total = roundEven(quantity * unitAmount, 2);
  const n = forAmount(per100Of(food), total);

  Object.assign(entry, {
    foodId: food.id, foodName: food.name, foodBrand: food.brand ?? null, baseUnit: food.baseUnit,
    quantity, unitLabel, unitAmount, totalAmount: total,
    calories: n.calories, protein: n.protein, carbs: n.carbs, sugar: n.sugar, fat: n.fat,
  });
}

// ---------------- FoodValidator ----------------

export const DEFAULT_CATEGORY = 'سایر';
const blank = (s) => s == null || String(s).trim() === '';
const nullIfBlank = (s) => (blank(s) ? null : String(s).trim());
const num = (v) => (v === '' || v == null ? 0 : Number(v));

export function validateFood(dto) {
  if (blank(dto.name)) throw new Error('نام غذا الزامی است.');
  if (dto.name.trim().length > 200) throw new Error('نام غذا حداکثر ۲۰۰ کاراکتر می‌تواند باشد.');
  if ((dto.englishName?.length ?? 0) > 200 || (dto.brand?.length ?? 0) > 100 || (dto.category?.length ?? 0) > 100) {
    throw new Error('طول نام انگلیسی، برند یا دسته بیش از حد مجاز است.');
  }
  if ((dto.notes?.length ?? 0) > 2000) throw new Error('توضیحات حداکثر ۲۰۰۰ کاراکتر می‌تواند باشد.');

  const cal = num(dto.caloriesPer100), pro = num(dto.proteinPer100), carb = num(dto.carbsPer100);
  const sug = num(dto.sugarPer100), fat = num(dto.fatPer100);
  if ([cal, pro, carb, sug, fat].some((v) => Number.isNaN(v))) throw new Error('مقادیر تغذیه‌ای باید عدد باشند.');
  if ([cal, pro, carb, sug, fat].some((v) => v < 0)) throw new Error('مقادیر تغذیه‌ای نمی‌توانند منفی باشند.');
  if (cal > 950) throw new Error('کالری در ۱۰۰ گرم نمی‌تواند بیش از ۹۵۰ باشد (خالص‌ترین چربی حدود ۹۰۰ است).');
  if (pro + carb + fat > 101) {
    throw new Error('مجموع پروتئین، کربوهیدرات و چربی در ۱۰۰ گرم نمی‌تواند بیش از ۱۰۰ باشد. مطمئن شو اعداد برای ۱۰۰ گرم هستند، نه یک پرس.');
  }
  if (sug > carb + 0.5) throw new Error('مقدار قند نمی‌تواند از کل کربوهیدرات بیشتر باشد.');

  const servings = dto.servings ?? [];
  if (servings.length > 40) throw new Error('حداکثر ۴۰ واحد برای هر غذا مجاز است.');
  const seen = new Set();
  for (const s of servings) {
    if (blank(s.label)) throw new Error('نام هر واحد الزامی است.');
    if (s.label.trim().length > 60) throw new Error('نام واحد حداکثر ۶۰ کاراکتر می‌تواند باشد.');
    if (!(s.amount > 0) || s.amount > 100000) throw new Error(`وزن واحد «${s.label.trim()}» باید بیشتر از صفر باشد.`);
    const key = normalize(s.label);
    if (seen.has(key)) throw new Error(`واحد «${s.label.trim()}» تکراری است.`);
    seen.add(key);
  }
}

export function applyFoodDto(food, dto) {
  food.name = dto.name.trim();
  food.englishName = nullIfBlank(dto.englishName);
  food.brand = nullIfBlank(dto.brand);
  food.category = nullIfBlank(dto.category) ?? DEFAULT_CATEGORY;
  food.baseUnit = dto.baseUnit === 'Milliliter' ? 'Milliliter' : 'Gram';
  food.state = nullIfBlank(dto.state);
  food.caloriesPer100 = roundEven(num(dto.caloriesPer100), 2);
  food.proteinPer100 = roundEven(num(dto.proteinPer100), 2);
  food.carbsPer100 = roundEven(num(dto.carbsPer100), 2);
  food.sugarPer100 = roundEven(num(dto.sugarPer100), 2);
  food.fatPer100 = roundEven(num(dto.fatPer100), 2);
  food.notes = nullIfBlank(dto.notes);
  food.searchKey = buildSearchKey(food.name, food.englishName, food.brand);
}
