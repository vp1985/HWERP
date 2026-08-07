/**
 * Berechnet die Entfernung zwischen zwei GPS-Koordinaten in km (Haversine-Formel).
 * Luftlinie, kein Routing.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Erdradius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Schätzt die Fahrzeit in Stunden basierend auf der Strecke in km.
 * Durchschnitt: 70 km/h, auf 0.25 h gerundet (= 15 min).
 */
export function estimateTravelHours(km: number): number {
  const raw = km / 70;
  return Math.round(raw / 0.25) * 0.25;
}
