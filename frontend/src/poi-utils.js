const CATEGORIES = ["parking", "fuel"];
const DEFAULT_WINDOW_KM = 75;
const MAX_INTERVAL_CANDIDATES = 3;

export const POI_INTERVALS = {
  fuel: ["all", "250", "500", "750", "range", "custom"],
  parking: ["all", "100", "250", "500", "custom"],
};

export function requestedPoiCategories(pois = {}) {
  return new Set((Array.isArray(pois.requested) ? pois.requested : []).filter((item) => CATEGORIES.includes(item)));
}

function allAvailable(pois, display) {
  const requested = requestedPoiCategories(pois);
  return CATEGORIES.flatMap((category) => requested.has(category) && display[category] !== false && Array.isArray(pois[category]) ? pois[category].map((item) => ({ ...item, category })) : []);
}

function reachableRangeKm({ tankCapacity, consumption, fuelLevel, reserve, rangeKm } = {}) {
  if (Number.isFinite(Number(rangeKm)) && Number(rangeKm) > 0) return Number(rangeKm);
  const tank = Number(tankCapacity), rate = Number(consumption), level = Number(fuelLevel), safety = Number(reserve || 0);
  if (![tank, rate, level, safety].every(Number.isFinite) || tank <= 0 || rate <= 0 || level < 0 || level > tank || safety < 0 || safety >= tank) return null;
  return Math.max(0, (level - safety) * 100 / rate);
}

function comparablePrice(item) {
  if (Number.isFinite(Number(item?.price))) return Number(item.price);
  const prices = Array.isArray(item?.prices) ? item.prices.map((price) => Number(price?.price)).filter(Number.isFinite) : [];
  return prices.length ? Math.min(...prices) : Infinity;
}

function intervalItems(items, intervalKm, routeDistanceKm, windowKm = DEFAULT_WINDOW_KM) {
  const interval = Number(intervalKm), distance = Number(routeDistanceKm);
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(distance) || distance <= 0) return { items: [], gaps: [] };
  const targets = [];
  for (let target = interval; target <= distance; target += interval) targets.push(target);
  const selected = [], gaps = [];
  for (const target of targets) {
    const candidates = items.filter((item) => Math.abs(Number(item.km_from_start) - target) <= windowKm).sort((a, b) => {
      const targetDelta = Math.abs(Number(a.km_from_start) - target) - Math.abs(Number(b.km_from_start) - target);
      return targetDelta || Number(a.distance_from_route_km ?? Infinity) - Number(b.distance_from_route_km ?? Infinity) || comparablePrice(a) - comparablePrice(b);
    }).slice(0, MAX_INTERVAL_CANDIDATES);
    if (!candidates.length) gaps.push(target); else selected.push(...candidates);
  }
  return { items: [...new Map(selected.map((item) => [item.id, item])).values()], gaps };
}

function intervalFor(category, options) {
  const selected = (options.intervals || {})[category] ?? options.interval ?? "all";
  if (selected !== "custom") return selected;
  const custom = Number((options.customIntervals || {})[category] ?? options.customInterval);
  return Number.isFinite(custom) && custom > 0 ? String(custom) : "all";
}

export function selectPoiItems(pois = {}, options = {}) {
  const { display = {}, routeDistanceM, fuelPlan = {} } = options;
  const available = allAvailable(pois, display).sort((a, b) => Number(a.km_from_start) - Number(b.km_from_start) || String(a.id).localeCompare(String(b.id)));
  const routeDistanceKm = Number(routeDistanceM) / 1000;
  const selected = [], gaps = [];
  for (const category of CATEGORIES) {
    const categoryItems = available.filter((item) => item.category === category);
    if (!categoryItems.length) continue;
    const interval = intervalFor(category, options);
    if (interval === "all") { selected.push(...categoryItems); continue; }
    const result = interval === "range" ? intervalItems(categoryItems, reachableRangeKm(fuelPlan), routeDistanceKm) : intervalItems(categoryItems, Number(interval), routeDistanceKm);
    selected.push(...result.items);
    gaps.push(...result.gaps.map((km) => ({ category, km })));
  }
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, { available: available.filter((item) => item.category === category).length, selected: selected.filter((item) => item.category === category).length }]));
  return { items: selected.sort((a, b) => Number(a.km_from_start) - Number(b.km_from_start) || String(a.id).localeCompare(String(b.id))), gaps, availableCount: available.length, byCategory, requested: [...requestedPoiCategories(pois)] };
}
