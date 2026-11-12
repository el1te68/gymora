const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export function kgToLb(kg) {
  return kg / KG_PER_LB;
}

export function lbToKg(lb) {
  return lb * KG_PER_LB;
}

export function cmToFeetInches(cm) {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return { feet, inches: Math.round(inches * 10) / 10 };
}

export function feetInchesToCm(feet, inches) {
  const totalInches = Number(feet || 0) * 12 + Number(inches || 0);
  return totalInches * CM_PER_INCH;
}

export function roundTo(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
