export function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function labelByDays(days) {
  if (days <= 1) return '1D';
  if (days <= 2) return '2D';
  if (days <= 3) return '3D';
  if (days <= 8) return '7D';
  if (days <= 18) return '14D';
  if (days <= 40) return '30D';
  return `${days}D`;
}

export function parseDeribitDateToken(token) {
  const m = token?.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monMap = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = monMap[m[2]];
  const year = 2000 + parseInt(m[3], 10);
  if (month === undefined) return null;
  return new Date(Date.UTC(year, month, day, 8, 0, 0));
}
