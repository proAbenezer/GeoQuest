// src/data/continents.ts
//
// ISO2 (alpha-2) country code → continent. Used by the stats dashboard to roll
// "countries visited" up into continents. Grouped per the UN M49 geography
// (the same convention most travel sites use); Turkey/Cyprus/Georgia/Armenia/
// Azerbaijan count as Asia, Russia as Europe, Greenland as North America.
// There is no country→continent data anywhere in the existing dependencies
// (i18n-iso-countries exposes none), so this static map is the source of truth.

export const CONTINENT_BY_ISO2: Record<string, string> = {
  // Africa
  DZ: "Africa", AO: "Africa", BJ: "Africa", BW: "Africa", BF: "Africa",
  BI: "Africa", CM: "Africa", CV: "Africa", CF: "Africa", TD: "Africa",
  KM: "Africa", CG: "Africa", CD: "Africa", CI: "Africa", DJ: "Africa",
  EG: "Africa", GQ: "Africa", ER: "Africa", SZ: "Africa", ET: "Africa",
  GA: "Africa", GM: "Africa", GH: "Africa", GN: "Africa", GW: "Africa",
  KE: "Africa", LS: "Africa", LR: "Africa", LY: "Africa", MG: "Africa",
  MW: "Africa", ML: "Africa", MR: "Africa", MU: "Africa", MA: "Africa",
  MZ: "Africa", NA: "Africa", NE: "Africa", NG: "Africa", RW: "Africa",
  ST: "Africa", SN: "Africa", SC: "Africa", SL: "Africa", SO: "Africa",
  ZA: "Africa", SS: "Africa", SD: "Africa", TZ: "Africa", TG: "Africa",
  TN: "Africa", UG: "Africa", EH: "Africa", ZM: "Africa", ZW: "Africa",
  RE: "Africa", YT: "Africa", SH: "Africa",

  // Asia
  AF: "Asia", AM: "Asia", AZ: "Asia", BH: "Asia", BD: "Asia",
  BT: "Asia", BN: "Asia", KH: "Asia", CN: "Asia", CY: "Asia",
  GE: "Asia", IN: "Asia", ID: "Asia", IR: "Asia", IQ: "Asia",
  IL: "Asia", JP: "Asia", JO: "Asia", KZ: "Asia", KW: "Asia",
  KG: "Asia", LA: "Asia", LB: "Asia", MY: "Asia", MV: "Asia",
  MN: "Asia", MM: "Asia", NP: "Asia", KP: "Asia", OM: "Asia",
  PK: "Asia", PS: "Asia", PH: "Asia", QA: "Asia", SA: "Asia",
  SG: "Asia", KR: "Asia", LK: "Asia", SY: "Asia", TW: "Asia",
  TJ: "Asia", TH: "Asia", TL: "Asia", TR: "Asia", TM: "Asia",
  AE: "Asia", UZ: "Asia", VN: "Asia", YE: "Asia",
  HK: "Asia", MO: "Asia",

  // Europe
  AL: "Europe", AD: "Europe", AT: "Europe", BY: "Europe", BE: "Europe",
  BA: "Europe", BG: "Europe", HR: "Europe", CZ: "Europe", DK: "Europe",
  EE: "Europe", FI: "Europe", FR: "Europe", DE: "Europe", GR: "Europe",
  HU: "Europe", IS: "Europe", IE: "Europe", IT: "Europe", LV: "Europe",
  LI: "Europe", LT: "Europe", LU: "Europe", MT: "Europe", MD: "Europe",
  MC: "Europe", ME: "Europe", NL: "Europe", MK: "Europe", NO: "Europe",
  PL: "Europe", PT: "Europe", RO: "Europe", RU: "Europe", SM: "Europe",
  RS: "Europe", SK: "Europe", SI: "Europe", ES: "Europe", SE: "Europe",
  CH: "Europe", UA: "Europe", GB: "Europe", VA: "Europe", XK: "Europe",
  AX: "Europe", FO: "Europe", GI: "Europe", GG: "Europe", JE: "Europe",
  IM: "Europe", SJ: "Europe",

  // North America
  AG: "North America", BS: "North America", BB: "North America",
  BZ: "North America", CA: "North America", CR: "North America",
  CU: "North America", DM: "North America", DO: "North America",
  SV: "North America", GD: "North America", GT: "North America",
  HT: "North America", HN: "North America", JM: "North America",
  MX: "North America", NI: "North America", PA: "North America",
  KN: "North America", LC: "North America", VC: "North America",
  TT: "North America", US: "North America",
  GL: "North America", BQ: "North America", CW: "North America",
  SX: "North America", GP: "North America", MQ: "North America",
  BL: "North America", MF: "North America", PM: "North America",

  // South America
  AR: "South America", BO: "South America", BR: "South America",
  CL: "South America", CO: "South America", EC: "South America",
  GY: "South America", PY: "South America", PE: "South America",
  SR: "South America", UY: "South America", VE: "South America",
  GF: "South America",

  // Oceania
  AU: "Oceania", FJ: "Oceania", KI: "Oceania", MH: "Oceania",
  FM: "Oceania", NR: "Oceania", NZ: "Oceania", PW: "Oceania",
  PG: "Oceania", WS: "Oceania", SB: "Oceania", TO: "Oceania",
  TV: "Oceania", VU: "Oceania",
  PF: "Oceania", NC: "Oceania", CK: "Oceania", NU: "Oceania",
  TK: "Oceania", WF: "Oceania",

  // Antarctica
  AQ: "Antarctica",
}

export function continentFor(iso2: string): string | null {
  return CONTINENT_BY_ISO2[iso2.toUpperCase()] ?? null
}
