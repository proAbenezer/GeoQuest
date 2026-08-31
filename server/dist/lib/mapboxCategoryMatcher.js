const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
let cachedList = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
async function fetchCategoryList() {
    if (cachedList && Date.now() - cacheTimestamp < CACHE_TTL) {
        return cachedList;
    }
    const url = `https://api.mapbox.com/search/searchbox/v1/list/category?access_token=${MAPBOX_TOKEN}&language=en`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Mapbox list/category failed: ${response.status}`);
    }
    const data = await response.json();
    const items = data.listItems || [];
    cachedList = items;
    cacheTimestamp = Date.now();
    return items;
}
export async function matchMapboxCategory(input) {
    if (!input.trim())
        return null;
    const list = await fetchCategoryList();
    const normalizedInput = input.trim().toLowerCase();
    // 1) Exact canonical_id match (rare, but possible if user types exactly)
    const exactCanonical = list.find((item) => item.canonical_id.toLowerCase() === normalizedInput);
    if (exactCanonical) {
        return { canonicalId: exactCanonical.canonical_id, confidence: 'exact' };
    }
    // 2) Exact display-name match (case‑insensitive)
    const exactName = list.find((item) => item.name.toLowerCase() === normalizedInput);
    if (exactName) {
        return { canonicalId: exactName.canonical_id, confidence: 'exact' };
    }
    // 3) Substring match (fuzzy) – e.g., "gyms" → "gym"
    const fuzzy = list.find((item) => item.name.toLowerCase().includes(normalizedInput) || normalizedInput.includes(item.name.toLowerCase()));
    if (fuzzy) {
        return { canonicalId: fuzzy.canonical_id, confidence: 'fuzzy' };
    }
    return null;
}
