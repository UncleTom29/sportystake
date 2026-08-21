// Comprehensive sports and league priority ranking system.
// Top leagues in each sport come first in strict order of importance before other leagues are arranged alphabetically.

export const MAJOR_SPORTS_ORDER = [
  "football",
  "soccer",
  "basketball",
  "tennis",
  "american-football",
  "baseball",
  "ice-hockey",
  "mma",
  "cricket",
  "rugby",
  "volleyball",
  "handball",
  "table-tennis",
  "darts",
  "snooker",
  "boxing",
  "esports",
  "golf",
  "motorsport",
];

export function getSportPriority(slug: string): number {
  const norm = slug.toLowerCase();
  const idx = MAJOR_SPORTS_ORDER.indexOf(norm);
  return idx !== -1 ? idx : 99;
}

export interface LeaguePriorityEntry {
  id?: number;
  pattern: RegExp;
  tier: number;
}

export const FOOTBALL_LEAGUE_PRIORITIES: LeaguePriorityEntry[] = [
  // ── UEFA & Global Club Tournaments (Tier 1-9) ──
  { id: 2,   pattern: /^(?:uefa\s+)?champions league/i,                                      tier: 1 },
  { id: 3,   pattern: /^(?:uefa\s+)?europa league/i,                                         tier: 2 },
  { id: 848, pattern: /^(?:uefa\s+)?(?:europa )?conference league/i,                         tier: 3 },
  {          pattern: /^(?:uefa\s+)?super cup/i,                                             tier: 4 },
  { id: 1,   pattern: /fifa world cup|world cup$/i,                                          tier: 5 },
  { id: 4,   pattern: /uefa euro|euro \d{4}/i,                                                tier: 6 },
  {          pattern: /uefa nations league/i,                                                tier: 7 },
  { id: 9,   pattern: /copa am[eé]rica/i,                                                     tier: 8 },
  { id: 6,   pattern: /africa cup of nations|afcon/i,                                         tier: 9 },

  // ── 1. England (Tier 10-19) ──
  { id: 39,  pattern: /^(?:england[.\s-]+)?premier league$/i,                                tier: 10 },
  { id: 40,  pattern: /^(?:england[.\s-]+)?championship$/i,                                  tier: 11 },
  { id: 45,  pattern: /^(?:england[.\s-]+)?fa cup$/i,                                        tier: 12 },
  { id: 48,  pattern: /^(?:england[.\s-]+)?(?:league cup|efl cup|carabao cup)/i,             tier: 13 },
  { id: 41,  pattern: /^(?:england[.\s-]+)?league one/i,                                     tier: 14 },
  { id: 42,  pattern: /^(?:england[.\s-]+)?league two/i,                                     tier: 15 },
  {          pattern: /^england[.\s-]/i,                                                     tier: 19 },

  // ── 2. Spain (Tier 20-29) ──
  { id: 140, pattern: /^(?:spain[.\s-]+)?(?:la\s*liga|primera divisi[oó]n)$/i,               tier: 20 },
  { id: 143, pattern: /^(?:spain[.\s-]+)?copa del rey/i,                                     tier: 21 },
  { id: 141, pattern: /^(?:spain[.\s-]+)?(?:segunda divisi[oó]n|la\s*liga\s*2)/i,            tier: 22 },
  {          pattern: /^(?:spain[.\s-]+)?(?:supercopa|primera federaci[oó]n|primera rfef)/i, tier: 23 },
  {          pattern: /^spain[.\s-]/i,                                                       tier: 29 },

  // ── 3. Germany (Tier 30-39) ──
  { id: 78,  pattern: /^(?:germany[.\s-]+)?bundesliga$/i,                                    tier: 30 },
  { id: 81,  pattern: /^(?:germany[.\s-]+)?dfb[ -]?pokal/i,                                  tier: 31 },
  { id: 79,  pattern: /^(?:germany[.\s-]+)?2\.?\s*bundesliga/i,                              tier: 32 },
  {          pattern: /^(?:germany[.\s-]+)?(?:3\.?\s*liga|supercup)/i,                       tier: 33 },
  {          pattern: /^germany[.\s-]/i,                                                     tier: 39 },

  // ── 4. Italy (Tier 40-49) ──
  { id: 135, pattern: /^(?:italy[.\s-]+)?serie\s+a$/i,                                       tier: 40 },
  { id: 137, pattern: /^(?:italy[.\s-]+)?coppa italia/i,                                     tier: 41 },
  { id: 136, pattern: /^(?:italy[.\s-]+)?serie\s+b/i,                                        tier: 42 },
  {          pattern: /^(?:italy[.\s-]+)?(?:supercoppa|serie\s+c)/i,                          tier: 43 },
  {          pattern: /^italy[.\s-]/i,                                                       tier: 49 },

  // ── 5. France (Tier 50-59) ──
  { id: 61,  pattern: /^(?:france[.\s-]+)?ligue\s*1/i,                                       tier: 50 },
  { id: 66,  pattern: /^(?:france[.\s-]+)?coupe de france/i,                                 tier: 51 },
  { id: 62,  pattern: /^(?:france[.\s-]+)?ligue\s*2/i,                                       tier: 52 },
  {          pattern: /^(?:france[.\s-]+)?(?:troph[eé]e des champions|national)/i,           tier: 53 },
  {          pattern: /^france[.\s-]/i,                                                      tier: 59 },

  // ── 6. Portugal (Tier 60-69) ──
  { id: 94,  pattern: /^(?:portugal[.\s-]+)?(?:primeira liga|liga portugal|liga nos)/i,      tier: 60 },
  { id: 96,  pattern: /^(?:portugal[.\s-]+)?ta[çc]a de portugal/i,                           tier: 61 },
  { id: 95,  pattern: /^(?:portugal[.\s-]+)?(?:liga portugal 2|segunda liga)/i,              tier: 62 },
  {          pattern: /^(?:portugal[.\s-]+)?ta[çc]a da liga/i,                               tier: 63 },
  {          pattern: /^portugal[.\s-]/i,                                                    tier: 69 },

  // ── 7. Scotland (Tier 70-79) ──
  { id: 179, pattern: /^(?:scotland[.\s-]+)?(?:scottish\s+)?premiership/i,                   tier: 70 },
  { id: 180, pattern: /^(?:scotland[.\s-]+)?scottish cup/i,                                  tier: 71 },
  { id: 181, pattern: /^(?:scotland[.\s-]+)?(?:scottish\s+)?league cup/i,                    tier: 72 },
  { id: 182, pattern: /^(?:scotland[.\s-]+)?(?:scottish\s+)?championship/i,                 tier: 73 },
  {          pattern: /^scotland[.\s-]/i,                                                    tier: 79 },

  // ── 8. Netherlands (Tier 80-89) ──
  { id: 88,  pattern: /^(?:netherlands[.\s-]+|holland[.\s-]+)?eredivisie/i,                  tier: 80 },
  { id: 90,  pattern: /^(?:netherlands[.\s-]+|holland[.\s-]+)?knvb beker/i,                  tier: 81 },
  {          pattern: /^(?:netherlands[.\s-]+|holland[.\s-]+)?eerste divisie/i,              tier: 82 },
  {          pattern: /^(?:netherlands|holland)[.\s-]/i,                                     tier: 89 },

  // ── 9. Belgium (Tier 90-99) ──
  { id: 144, pattern: /^(?:belgium[.\s-]+)?(?:jupiler (?:pro )?league|pro league|first division a)/i, tier: 90 },
  { id: 146, pattern: /^(?:belgium[.\s-]+)?(?:belgian cup|beker van belgi[eë])/i,            tier: 91 },
  {          pattern: /^(?:belgium[.\s-]+)?(?:challenger pro league|first division b)/i,     tier: 92 },
  {          pattern: /^belgium[.\s-]/i,                                                     tier: 99 },

  // ── 10. Turkey (Tier 100-109) ──
  { id: 203, pattern: /^(?:turkey[.\s-]+)?s[üu]per lig/i,                                    tier: 100 },
  {          pattern: /^(?:turkey[.\s-]+)?(?:turkish cup|t[üu]rkiye kupas[ıi])/i,             tier: 101 },
  {          pattern: /^(?:turkey[.\s-]+)?1\.?\s*lig/i,                                      tier: 102 },
  {          pattern: /^turkey[.\s-]/i,                                                      tier: 109 },

  // ── 11. Greece (Tier 110-119) ──
  { id: 210, pattern: /^(?:greece[.\s-]+)?super league/i,                                    tier: 110 },
  {          pattern: /^(?:greece[.\s-]+)?greek cup/i,                                       tier: 111 },
  {          pattern: /^greece[.\s-]/i,                                                      tier: 119 },

  // ── 12. Switzerland (Tier 120-129) ──
  { id: 207, pattern: /^(?:switzerland[.\s-]+)?super league/i,                               tier: 120 },
  {          pattern: /^(?:switzerland[.\s-]+)?swiss cup/i,                                  tier: 121 },
  {          pattern: /^(?:switzerland[.\s-]+)?challenge league/i,                           tier: 122 },
  {          pattern: /^switzerland[.\s-]/i,                                                 tier: 129 },

  // ── 13. Austria (Tier 130-139) ──
  { id: 218, pattern: /^(?:austria[.\s-]+)?bundesliga/i,                                     tier: 130 },
  {          pattern: /^(?:austria[.\s-]+)?(?:[öo]fb[ -]?cup|austrian cup)/i,                tier: 131 },
  {          pattern: /^(?:austria[.\s-]+)?2\.?\s*liga/i,                                    tier: 132 },
  {          pattern: /^austria[.\s-]/i,                                                     tier: 139 },

  // ── 14. Denmark (Tier 140-149) ──
  { id: 119, pattern: /^(?:denmark[.\s-]+)?superliga/i,                                      tier: 140 },
  {          pattern: /^(?:denmark[.\s-]+)?(?:dbu pokalen|danish cup)/i,                     tier: 141 },
  {          pattern: /^(?:denmark[.\s-]+)?1\.?\s*division/i,                                tier: 142 },
  {          pattern: /^denmark[.\s-]/i,                                                     tier: 149 },

  // ── 15. Norway (Tier 150-159) ──
  { id: 103, pattern: /^(?:norway[.\s-]+)?eliteserien/i,                                     tier: 150 },
  {          pattern: /^(?:norway[.\s-]+)?(?:nm cup|norwegian cup)/i,                        tier: 151 },
  {          pattern: /^(?:norway[.\s-]+)?(?:1\.?\s*divisjon|obos-ligaen)/i,                 tier: 152 },
  {          pattern: /^norway[.\s-]/i,                                                      tier: 159 },

  // ── 16. Sweden (Tier 160-169) ──
  { id: 113, pattern: /^(?:sweden[.\s-]+)?allsvenskan/i,                                     tier: 160 },
  {          pattern: /^(?:sweden[.\s-]+)?svenska cupen/i,                                   tier: 161 },
  {          pattern: /^(?:sweden[.\s-]+)?superettan/i,                                      tier: 162 },
  {          pattern: /^sweden[.\s-]/i,                                                      tier: 169 },

  // ── 17. Poland (Tier 170-179) ──
  { id: 106, pattern: /^(?:poland[.\s-]+)?ekstraklasa/i,                                     tier: 170 },
  {          pattern: /^(?:poland[.\s-]+)?(?:polish cup|puchar polski)/i,                    tier: 171 },
  {          pattern: /^(?:poland[.\s-]+)?(?:i liga|1\. liga)/i,                             tier: 172 },
  {          pattern: /^poland[.\s-]/i,                                                      tier: 179 },

  // ── 18. Czech Republic (Tier 180-189) ──
  { id: 345, pattern: /^(?:czech(?: republic)?[.\s-]+)?(?:chance liga|first league|1\. liga)/i, tier: 180 },
  {          pattern: /^(?:czech(?: republic)?[.\s-]+)?czech cup/i,                          tier: 181 },
  {          pattern: /^czech[.\s-]/i,                                                       tier: 189 },

  // ── 19. Croatia (Tier 190-199) ──
  {          pattern: /^(?:croatia[.\s-]+)?(?:hnl|1\.?\s*hnl)/i,                             tier: 190 },
  {          pattern: /^(?:croatia[.\s-]+)?croatian cup/i,                                   tier: 191 },
  {          pattern: /^croatia[.\s-]/i,                                                     tier: 199 },

  // ── 20. Ukraine (Tier 200-209) ──
  { id: 199, pattern: /^(?:ukraine[.\s-]+)?premier league/i,                                 tier: 200 },
  {          pattern: /^(?:ukraine[.\s-]+)?ukrainian cup/i,                                  tier: 201 },
  {          pattern: /^ukraine[.\s-]/i,                                                     tier: 209 },

  // ── 21. Russia (Tier 210-219) ──
  { id: 235, pattern: /^(?:russia[.\s-]+)?premier league/i,                                  tier: 210 },
  {          pattern: /^(?:russia[.\s-]+)?russian cup/i,                                     tier: 211 },
  {          pattern: /^russia[.\s-]/i,                                                      tier: 219 },

  // ── 22. Americas Majors (Brazil, Argentina, USA, Mexico) (Tier 220-259) ──
  { id: 13,  pattern: /copa libertadores/i,                                                  tier: 220 },
  { id: 11,  pattern: /copa sudamericana/i,                                                  tier: 221 },
  { id: 71,  pattern: /^(?:brazil[.\s-]+)?(?:brasileir[aã]o|s[eé]rie a)/i,                   tier: 222 },
  { id: 73,  pattern: /^(?:brazil[.\s-]+)?copa do brasil/i,                                  tier: 223 },
  { id: 128, pattern: /^(?:argentina[.\s-]+)?(?:liga profesional|primera divisi[oó]n)/i,     tier: 224 },
  {          pattern: /^(?:argentina[.\s-]+)?copa argentina/i,                               tier: 225 },
  { id: 253, pattern: /^(?:usa[.\s-]+)?(?:mls|major league soccer)/i,                         tier: 230 },
  { id: 847, pattern: /leagues cup/i,                                                         tier: 231 },
  { id: 262, pattern: /^(?:mexico[.\s-]+)?liga mx/i,                                          tier: 232 },
  {          pattern: /^(?:usa|mexico|brazil|argentina)[.\s-]/i,                              tier: 239 },

  // ── 23. Asia & Middle East (Saudi, Japan, Korea, Australia) (Tier 260-279) ──
  { id: 307, pattern: /^(?:saudi(?: arabia)?[.\s-]+)?(?:saudi (?:pro )?league|roshn)/i,      tier: 260 },
  { id: 17,  pattern: /afc champions league/i,                                               tier: 261 },
  { id: 98,  pattern: /^(?:japan[.\s-]+)?j1 league/i,                                        tier: 262 },
  { id: 169, pattern: /^(?:south korea[.\s-]+)?k league 1/i,                                 tier: 263 },
  { id: 188, pattern: /^(?:australia[.\s-]+)?a-league/i,                                     tier: 264 },
  {          pattern: /^(?:saudi|japan|korea|australia)[.\s-]/i,                              tier: 279 },
];

export const OTHER_SPORTS_PRIORITIES: Record<string, LeaguePriorityEntry[]> = {
  basketball: [
    { pattern: /^(?:usa[.\s-]+)?nba\b/i,                                                     tier: 10 },
    { pattern: /^euroleague\b/i,                                                             tier: 20 },
    { pattern: /^eurocup\b/i,                                                                tier: 21 },
    { pattern: /fiba (?:basketball )?champions league/i,                                      tier: 22 },
    { pattern: /^(?:spain[.\s-]+)?(?:liga acb|endesa)/i,                                     tier: 30 },
    { pattern: /^(?:germany[.\s-]+)?(?:bbl|basketball bundesliga)/i,                          tier: 31 },
    { pattern: /^(?:italy[.\s-]+)?(?:serie a|lega basket)/i,                                 tier: 32 },
    { pattern: /^(?:france[.\s-]+)?lnb pro a/i,                                              tier: 33 },
    { pattern: /^(?:turkey[.\s-]+)?(?:bsl|basketbol s[üu]per)/i,                             tier: 34 },
    { pattern: /^(?:greece[.\s-]+)?(?:a1|greek basket league)/i,                             tier: 35 },
    { pattern: /^(?:usa[.\s-]+)?(?:ncaa|march madness)/i,                                     tier: 40 },
    { pattern: /^(?:australia[.\s-]+)?nbl\b/i,                                               tier: 41 },
    { pattern: /fiba world cup/i,                                                            tier: 50 },
  ],
  "american-football": [
    { pattern: /^(?:usa[.\s-]+)?nfl\b/i,                                                     tier: 10 },
    { pattern: /^(?:usa[.\s-]+)?(?:ncaa|college football|cfb|ncaaf)/i,                        tier: 20 },
    { pattern: /^(?:canada[.\s-]+)?cfl\b/i,                                                  tier: 30 },
    { pattern: /^ufl\b/i,                                                                    tier: 40 },
  ],
  baseball: [
    { pattern: /^(?:usa[.\s-]+)?mlb\b/i,                                                     tier: 10 },
    { pattern: /^(?:japan[.\s-]+)?npb\b/i,                                                   tier: 20 },
    { pattern: /^(?:south korea[.\s-]+)?kbo\b/i,                                             tier: 21 },
    { pattern: /^(?:mexico[.\s-]+)?lmb\b/i,                                                  tier: 22 },
    { pattern: /^(?:usa[.\s-]+)?ncaa\b/i,                                                    tier: 30 },
    { pattern: /world baseball classic/i,                                                    tier: 40 },
  ],
  "ice-hockey": [
    { pattern: /^(?:usa[.\s-]+)?nhl\b/i,                                                     tier: 10 },
    { pattern: /^khl\b/i,                                                                    tier: 20 },
    { pattern: /^(?:sweden[.\s-]+)?shl\b/i,                                                  tier: 21 },
    { pattern: /^(?:finland[.\s-]+)?liiga\b/i,                                               tier: 22 },
    { pattern: /^(?:germany[.\s-]+)?del\b/i,                                                 tier: 23 },
    { pattern: /^(?:switzerland[.\s-]+)?(?:national league|nl\b)/i,                          tier: 24 },
    { pattern: /^(?:czech[.\s-]+)?extraliga\b/i,                                             tier: 25 },
    { pattern: /^(?:usa[.\s-]+)?ahl\b/i,                                                     tier: 30 },
    { pattern: /iihf world/i,                                                                tier: 40 },
  ],
  tennis: [
    { pattern: /wimbledon/i,                                                                 tier: 10 },
    { pattern: /us open/i,                                                                   tier: 11 },
    { pattern: /roland garros|french open/i,                                                 tier: 12 },
    { pattern: /australian open/i,                                                           tier: 13 },
    { pattern: /atp finals|wta finals/i,                                                     tier: 20 },
    { pattern: /masters 1000/i,                                                              tier: 21 },
    { pattern: /atp 500|wta 1000/i,                                                          tier: 22 },
    { pattern: /atp 250|wta 500|wta 250/i,                                                   tier: 23 },
    { pattern: /^atp\b|^wta\b/i,                                                             tier: 24 },
    { pattern: /davis cup|billie jean king/i,                                                tier: 30 },
    { pattern: /challenger|itf/i,                                                            tier: 40 },
  ],
  mma: [
    { pattern: /^ufc\b/i,                                                                    tier: 10 },
    { pattern: /^pfl\b/i,                                                                    tier: 20 },
    { pattern: /^bellator\b/i,                                                               tier: 21 },
    { pattern: /^one championship/i,                                                         tier: 22 },
    { pattern: /^boxing\b/i,                                                                 tier: 30 },
  ],
  cricket: [
    { pattern: /^ipl\b|indian premier league/i,                                              tier: 10 },
    { pattern: /icc (?:cricket )?world cup|t20 world cup/i,                                  tier: 20 },
    { pattern: /the ashes|test match/i,                                                      tier: 21 },
    { pattern: /^bbl\b|big bash/i,                                                           tier: 22 },
    { pattern: /^psl\b|pakistan super league/i,                                              tier: 23 },
    { pattern: /the hundred|vitality blast/i,                                                tier: 24 },
  ],
  esports: [
    { pattern: /league of legends|worlds \d{4}|lck|lpl|lec|lcs/i,                            tier: 10 },
    { pattern: /counter-strike|cs2|cs:go|iem|blast|esl pro/i,                                tier: 20 },
    { pattern: /dota 2|the international/i,                                                  tier: 30 },
    { pattern: /valorant|vct|champions/i,                                                    tier: 40 },
  ],
};

/**
 * Returns the numeric tier priority of a league (lower number = higher priority).
 * Returns 999 if the league is unranked (which will then be sorted alphabetically).
 */
export function getLeaguePriority(
  id?: number,
  name: string = "",
  country?: string,
  sport: string = "football",
): number {
  const cleanName = name.trim();
  const normSport = (sport === "soccer" ? "football" : sport).toLowerCase();

  if (normSport === "football") {
    for (const entry of FOOTBALL_LEAGUE_PRIORITIES) {
      if ((entry.id !== undefined && id !== undefined && entry.id === id) || entry.pattern.test(cleanName)) {
        return entry.tier;
      }
    }
  } else {
    const list = OTHER_SPORTS_PRIORITIES[normSport];
    if (list) {
      for (const entry of list) {
        if ((entry.id !== undefined && id !== undefined && entry.id === id) || entry.pattern.test(cleanName)) {
          return entry.tier;
        }
      }
    }
  }

  return 999;
}

/**
 * Comparator to sort two leagues:
 * 1. Prioritized leagues come first by order of importance (tier asc).
 * 2. Unprioritized / same-tier leagues are sorted alphabetically by name.
 */
export function compareLeagues(
  a: { id?: number; name: string; sport?: string; country?: string },
  b: { id?: number; name: string; sport?: string; country?: string },
): number {
  const sportA = (a.sport ? (a.sport === "soccer" ? "football" : a.sport) : "football").toLowerCase();
  const sportB = (b.sport ? (b.sport === "soccer" ? "football" : b.sport) : "football").toLowerCase();

  if (sportA !== sportB) {
    const spa = getSportPriority(sportA);
    const spb = getSportPriority(sportB);
    if (spa !== spb) return spa - spb;
  }

  const pa = getLeaguePriority(a.id, a.name, a.country, sportA);
  const pb = getLeaguePriority(b.id, b.name, b.country, sportB);

  if (pa !== pb) {
    return pa - pb;
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
