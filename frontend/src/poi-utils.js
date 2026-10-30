const CATEGORIES = ["parking", "fuel"];
const DEFAULT_WINDOW_KM = 75;

export function requestedPoiCategories(pois = {}) {
  return new Set((Array.isArray(pois.requested) ? pois.requested : []).filter((item) => CATEGORIES.includes(item)));
}

function allAvailable(pois, display) {
  const requested = requestedPoiCategories(pois);
  return CATEGORIES.flatMap((category) => requested.has(category) && display[category] !== false && Array.isArray(pois[category]) ? pois[category].map((item) => ({ ...item, category })) : []);
}

function reachableRangeKm({ tankCapacity, consumption, fuelLevel, reserve, rangeKm } = {}) {
  if (Number.isFinite(Number(rangeKm))) return Number(rangeKm);
  const tank = Number(tankCapacity);
  const rate = Number(consumption);
  const level = Number(fuelLevel);
  const safety = Number(reserve || 0);
  if (![tank, rate, level, safety].every(Number.isFinite) || tank <= 0 || rate <= 0 || level < 0 || level > tank || safety < 0 || safety >= tank) return null;
  return Math.max(0, (level - safety) * 100 / rate);
}

function intervalItems(items, intervalKm, routeDistanceKm, windowKm = DEFAULT_WINDOW_KM) {
  const interval = Number(intervalKm);
  const distance = Number(routeDistanceKm);
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(distance) || distance <= 0) return { items: [], gaps: [] };
  const targets = [];
  for (let target = interval; target < distance; target += interval) targets.push(target);
  const selected = [];
  const gaps = [];
  for (const target of targets) {
    const candidates = items.filter((item) => Math.abs(Number(item.km_from_start) - target) <= windowKm).sort((a, b) => {
      const targetDelta = Math.abs(Number(a.km_from_start) - target) - Math.abs(Number(b.km_from_start) - target);
      return targetDelta || Number(a.distance_from_route_km ?? Infinity) - Number(b.distance_from_route_km ?? Infinity) || Number(a.price ?? Infinity) - Number(b.price ?? Infinity);
    });
    if (!candidates.length) gaps.push(target);
    else selected.push(...candidates);
  }
  return { items: [...new Map(selected.map((item) => [item.id, item])).values()], gaps };
}

export function selectPoiItems(pois = {}, { display = {}, interval = "all", routeDistanceM, fuelPlan = {} } = {}) {
  const available = allAvailable(pois, display).sort((a, b) => Number(a.km_from_start) - Number(b.km_from_start) || String(a.id).localeCompare(String(b.id)));
  const routeDistanceKm = Number(routeDistanceM) / 1000;
  let selected = available;
  let gaps = [];
  if (interval !== "all") {
    const categories = new Set(available.map((item) => item.category));
    const all = [];
    for (const category of categories) {
      const categoryItems = available.filter((item) => item.category === category);
      const result = interval === "range"
        ? intervalItems(categoryItems, reachableRangeKm(fuelPlan), routeDistanceKm)
        : intervalItems(categoryItems, Number(interval), routeDistanceKm);
      all.push(...result.items);
      gaps.push(...result.gaps.map((km) => ({ category, km })));
    }
    selected = all.sort((a, b) => Number(a.km_from_start) - Number(b.km_from_start));
  }
  return { items: selected, gaps, availableCount: available.length, requested: [...requestedPoiCategories(pois)] };
}

export const POI_INTERVALS = ["all", "250", "500", "750", "range"];
