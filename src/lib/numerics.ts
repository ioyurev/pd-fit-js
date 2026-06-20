/**
 * Единый модуль численных утилит.
 * SSOT для: конечно-разностных шагов, бисекции, допусков.
 */

/** Адаптивный шаг для конечных разностей (центральная схема) */
export function finiteDiffStep(value: number, relEps = 1e-5, minEps = 1e-5): number {
  return Math.max(minEps, Math.abs(value) * relEps);
}

/**
 * Поиск подынтервала с гарантированной сменой знака.
 * Возвращает [a, b] такой что f(a)*f(b) <= 0, или null.
 */
export function findSignChangeBracket(
  f: (x: number) => number,
  left: number,
  right: number,
  slices = 48,
): [number, number] | null {
  let prevX = left;
  let prevF = f(prevX);

  for (let i = 1; i <= slices; i++) {
    const x = left + ((right - left) * i) / slices;
    const fx = f(x);

    if (Number.isFinite(prevF) && Number.isFinite(fx) && prevF * fx <= 0) {
      return [prevX, x];
    }

    prevX = x;
    prevF = fx;
  }

  return null;
}

/**
 * Бисекция на заведомо bracket-интервале [left, right].
 * Предусловие: f(left)*f(right) <= 0.
 */
export function bisectBracketed(
  f: (x: number) => number,
  left: number,
  right: number,
  iterations = 40,
): number {
  let fLeft = f(left);
  let fRight = f(right);

  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight) || fLeft * fRight > 0) {
    return NaN;
  }

  for (let iter = 0; iter < iterations; iter++) {
    const mid = (left + right) / 2;
    const fMid = f(mid);

    if (!Number.isFinite(fMid)) return NaN;
    if (Math.abs(fMid) < 1e-12) return mid;

    if (fLeft * fMid <= 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  return (left + right) / 2;
}

/** Безопасное деление с проверкой на конечность */
export function safeDivide(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) {
    return NaN;
  }
  const result = num / den;
  return Number.isFinite(result) ? result : NaN;
}
