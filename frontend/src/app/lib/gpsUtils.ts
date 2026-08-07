/**
 * GPS Utilities für DMS <-> Decimal Konvertierung
 */

export function parseDmsToDecimal(dms: string): number | null {
  if (!dms || dms.trim() === '') return null;
  const trimmed = dms.trim();
  const decimalMatch = trimmed.match(/^-?\d+\.?\d*$/);
  if (decimalMatch) { const num = parseFloat(trimmed); return isNaN(num) ? null : num; }
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)["\s]*([NSEW])?/i;
  const match = trimmed.match(dmsRegex);
  if (!match) return null;
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4]?.toUpperCase();
  if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return null;
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') decimal = -decimal;
  return decimal;
}

export function decimalToDms(decimal: number, isLatitude: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const direction = isLatitude ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${degrees}° ${minutes}' ${seconds.toFixed(1)}" ${direction}`;
}
