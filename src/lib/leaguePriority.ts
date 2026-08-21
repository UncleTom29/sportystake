// Comprehensive sports and league priority ranking system.
// Top leagues come first in order of importance before remaining leagues are arranged alphabetically.

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

export const LEAGUE_PRIORITIES: LeaguePriorityEntry[] = [
  // ── FOOTBALL / SOCCER ───────────────────────────────────────────────────────
  // UEFA Premier Club Competitions
  { id: 2,   pattern: /^(?:uefa\s+)?champions league$/i,                          tier: 1 },
  { id: 3,   pattern: /^(?:uefa\s+)?europa league$/i,                             tier: 2 },
  { id: 848, pattern: /^(?:uefa\s+)?(?:europa )?conference league$/i,             tier: 3 },
  {          pattern: /^(?:uefa\s+)?super cup$/i,                                 tier: 4 },

  // Top European Domestic Leagues in Order of Importance
  // 1. England
  { id: 39,  pattern: /^premier league$|^england\s*-\s*premier/i,                 tier: 10 },
  // 2. Spain
  { id: 140, pattern: /^la\s*liga$|^primera divisi[oó]n$|^spain\s*-\s*la\s*liga/i, tier: 11 },
  // 3. Germany
  { id: 78,  pattern: /^bundesliga$|^germany\s*-\s*bundesliga/i,                  tier: 12 },
  // 4. Italy
  { id: 135, pattern: /^serie\s+a$|^italy\s*-\s*serie\s*a/i,                     tier: 13 },
  // 5. France
  { id: 61,  pattern: /^ligue\s*1|^france\s*-\s*ligue\s*1/i,                      tier: 14 },
  // 6. Portugal
  { id: 94,  pattern: /primeira liga|liga portugal|liga nos/i,                    tier: 15 },
  // 7. Scotland
  { id: 179, pattern: /scottish (?:premiership|premier)|premiership.*scotland/i,  tier: 16 },
  // 8. Netherlands
  { id: 88,  pattern: /eredivisie|netherlands\s*-\s*eredivisie/i,                 tier: 17 },
  // 9. Belgium
  { id: 144, pattern: /pro league|jupiler|first division a.*belgium|belgian pro/i, tier: 18 },
  // 10. Turkey
  { id: 203, pattern: /s[üu]per lig|turkey\s*-\s*s[üu]per/i,                     tier: 19 },
  // 11. Greece
  { id: 210, pattern: /super league.*greece|greek.*super/i,                       tier: 20 },
  // 12. Switzerland
  { id: 207, pattern: /super league.*switz|swiss.*super/i,                        tier: 21 },
  // 13. Austria
  { id: 218, pattern: /bundesliga.*austria|austrian.*bundesliga/i,                tier: 22 },
  // 14. Denmark
  { id: 119, pattern: /superliga.*denmark|danish.*superliga/i,                    tier: 23 },
  // 15. Norway
  { id: 103, pattern: /eliteserien|norway\s*-\s*eliteserien/i,                    tier: 24 },
  // 16. Sweden
  { id: 113, pattern: /allsvenskan|sweden\s*-\s*allsvenskan/i,                    tier: 25 },
  // 17. Poland
  { id: 106, pattern: /ekstraklasa|poland\s*-\s*ekstraklasa/i,                    tier: 26 },
  // 18. Czech Republic
  { id: 345, pattern: /czech.*first|chance liga|1\. liga.*czech/i,                tier: 27 },
  // 19. Croatia
  {          pattern: /1\. hnl|hnl.*croatia|croatian.*hnl/i,                      tier: 28 },
  // 20. Ukraine
  { id: 199, pattern: /ukrainian.*premier|ukr.*premier/i,                         tier: 29 },

  // English & Major European Domestic Cups & 2nd Divisions
  { id: 45,  pattern: /^fa cup$/i,                                                tier: 35 },
  { id: 48,  pattern: /efl cup|carabao cup|league cup.*eng/i,                     tier: 36 },
  { id: 40,  pattern: /^championship$|^efl championship/i,                       tier: 37 },
  { id: 143, pattern: /copa del rey/i,                                            tier: 38 },
  { id: 141, pattern: /la liga 2|segunda divisi[oó]n/i,                           tier: 39 },
  { id: 81,  pattern: /dfb[ -]?pokal/i,                                           tier: 40 },
  { id: 79,  pattern: /2\. bundesliga/i,                                          tier: 41 },
  { id: 137, pattern: /coppa italia/i,                                            tier: 42 },
  { id: 136, pattern: /^serie\s+b$/i,                                             tier: 43 },
  { id: 66,  pattern: /coupe de france/i,                                         tier: 44 },
  { id: 62,  pattern: /^ligue\s*2/i,                                              tier: 45 },
  { id: 96,  pattern: /ta[çc]a de portugal/i,                                     tier: 46 },
  { id: 95,  pattern: /liga portugal 2/i,                                         tier: 47 },
  { id: 180, pattern: /scottish cup/i,                                            tier: 48 },
  { id: 181, pattern: /scottish league cup/i,                                     tier: 49 },
  { id: 182, pattern: /scottish championship/i,                                   tier: 50 },
  { id: 41,  pattern: /^league one$|^efl league one/i,                            tier: 51 },
  { id: 42,  pattern: /^league two$|^efl league two/i,                            tier: 52 },

  // Americas Majors
  { id: 13,  pattern: /copa libertadores/i,                                       tier: 55 },
  { id: 11,  pattern: /copa sudamericana/i,                                       tier: 56 },
  { id: 71,  pattern: /brasileir[aã]o|s[eé]rie a.*brazil/i,                       tier: 57 },
  { id: 128, pattern: /liga profesional|primera divisi[oó]n.*arg/i,               tier: 58 },
  { id: 253, pattern: /^mls$|major league soccer/i,                               tier: 59 },
  { id: 847, pattern: /leagues cup/i,                                             tier: 60 },
  { id: 262, pattern: /liga mx/i,                                                 tier: 61 },

  // Asia / Middle East Majors
  { id: 307, pattern: /saudi (?:pro|professional) league|roshn/i,                 tier: 65 },
  { id: 17,  pattern: /afc champions league/i,                                    tier: 66 },
  { id: 98,  pattern: /j1 league|j\.league/i,                                     tier: 67 },
  { id: 169, pattern: /k league 1/i,                                              tier: 68 },

  // Major International Tournaments
  { id: 1,   pattern: /fifa world cup|world cup$/i,                               tier: 70 },
  {          pattern: /world cup.*qualif/i,                                       tier: 71 },
  { id: 4,   pattern: /uefa euro|euro \d{4}/i,                                    tier: 72 },
  {          pattern: /uefa nations league/i,                                     tier: 73 },
  { id: 9,   pattern: /copa am[eé]rica/i,                                         tier: 74 },
  { id: 6,   pattern: /africa cup of nations|afcon/i,                             tier: 75 },
  { id: 7,   pattern: /asian cup/i,                                               tier: 76 },
  { id: 22,  pattern: /gold cup/i,                                                tier: 77 },

  // ── BASKETBALL ─────────────────────────────────────────────────────────────
  { pattern: /^nba$|national basketball association/i,                            tier: 100 },
  { pattern: /^euroleague$|euro league/i,                                         tier: 101 },
  { pattern: /^eurocup$/i,                                                        tier: 102 },
  { pattern: /fiba (?:basketball )?champions league/i,                             tier: 103 },
  { pattern: /liga acb|endesa/i,                                                  tier: 104 },
  { pattern: /bbl.*germany|basketball bundesliga/i,                               tier: 105 },
  { pattern: /serie a.*basket|lega basket/i,                                      tier: 106 },
  { pattern: /lnb pro a/i,                                                        tier: 107 },
  { pattern: /bsl.*turkey|basketbol s[üu]per/i,                                   tier: 108 },
  { pattern: /ncaa.*basket|march madness/i,                                       tier: 109 },
  { pattern: /^nbl$/i,                                                            tier: 110 },
  { pattern: /fiba world cup/i,                                                   tier: 111 },

  // ── AMERICAN FOOTBALL ───────────────────────────────────────────────────────
  { pattern: /^nfl$|national football league/i,                                   tier: 120 },
  { pattern: /ncaa.*football|college football|^cfb$|^ncaaf$/i,                    tier: 121 },
  { pattern: /^cfl$/i,                                                            tier: 122 },
  { pattern: /^ufl$/i,                                                            tier: 123 },

  // ── BASEBALL ───────────────────────────────────────────────────────────────
  { pattern: /^mlb$|major league baseball/i,                                      tier: 130 },
  { pattern: /^npb$|nippon professional/i,                                        tier: 131 },
  { pattern: /^kbo\b/i,                                                           tier: 132 },
  { pattern: /^lmb\b|liga mexicana de b[eé]isbol/i,                               tier: 133 },
  { pattern: /world baseball classic/i,                                           tier: 134 },

  // ── ICE HOCKEY ─────────────────────────────────────────────────────────────
  { pattern: /^nhl$|national hockey league/i,                                     tier: 140 },
  { pattern: /^khl$|kontinental hockey/i,                                         tier: 141 },
  { pattern: /^shl$|swedish hockey/i,                                             tier: 142 },
  { pattern: /^liiga$/i,                                                          tier: 143 },
  { pattern: /^del$|deutsche eishockey/i,                                         tier: 144 },
  { pattern: /national league.*swiss|nl.*switz/i,                                 tier: 145 },
  { pattern: /^ahl$/i,                                                            tier: 146 },
  { pattern: /iihf world/i,                                                       tier: 147 },

  // ── TENNIS ─────────────────────────────────────────────────────────────────
  { pattern: /wimbledon/i,                                                        tier: 150 },
  { pattern: /us open.*tennis|^us open$/i,                                        tier: 151 },
  { pattern: /roland garros|french open/i,                                        tier: 152 },
  { pattern: /australian open/i,                                                  tier: 153 },
  { pattern: /atp finals|wta finals/i,                                            tier: 154 },
  { pattern: /atp masters 1000|masters 1000/i,                                    tier: 155 },
  { pattern: /atp 500|wta 1000/i,                                                 tier: 156 },
  { pattern: /atp 250|wta 500|wta 250/i,                                          tier: 157 },
  { pattern: /^atp\b|^wta\b/i,                                                    tier: 158 },
  { pattern: /davis cup|billie jean king/i,                                       tier: 159 },

  // ── MMA & COMBAT ───────────────────────────────────────────────────────────
  { pattern: /^ufc\b/i,                                                           tier: 170 },
  { pattern: /^pfl\b/i,                                                           tier: 171 },
  { pattern: /^bellator\b/i,                                                      tier: 172 },
  { pattern: /^one championship/i,                                                tier: 173 },
  { pattern: /^boxing\b/i,                                                        tier: 174 },

  // ── CRICKET ────────────────────────────────────────────────────────────────
  { pattern: /^ipl$|indian premier league/i,                                      tier: 180 },
  { pattern: /icc cricket world cup|t20 world cup/i,                              tier: 181 },
  { pattern: /the ashes|test match/i,                                             tier: 182 },
  { pattern: /^bbl$|big bash/i,                                                   tier: 183 },
  { pattern: /^psl$|pakistan super league/i,                                      tier: 184 },

  // ── ESPORTS ────────────────────────────────────────────────────────────────
  { pattern: /league of legends|worlds \d{4}|lck|lpl|lec|lcs/i,                   tier: 190 },
  { pattern: /counter-strike|cs2|cs:go|iem|blast|esl pro/i,                       tier: 191 },
  { pattern: /dota 2|the international/i,                                         tier: 192 },
  { pattern: /valorant|vct|champions/i,                                           tier: 193 },
];

/**
 * Returns the numeric tier priority of a league (lower number = higher priority).
 * Returns 999 if the league is unranked (which will then be sorted alphabetically).
 */
export function getLeaguePriority(id?: number, name: string = ""): number {
  const cleanName = name.trim();
  for (const entry of LEAGUE_PRIORITIES) {
    if ((entry.id !== undefined && id !== undefined && entry.id === id) || entry.pattern.test(cleanName)) {
      return entry.tier;
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
  a: { id?: number; name: string; sport?: string },
  b: { id?: number; name: string; sport?: string },
): number {
  if (a.sport && b.sport && a.sport !== b.sport) {
    const spa = getSportPriority(a.sport);
    const spb = getSportPriority(b.sport);
    if (spa !== spb) return spa - spb;
  }

  const pa = getLeaguePriority(a.id, a.name);
  const pb = getLeaguePriority(b.id, b.name);

  if (pa !== pb) {
    return pa - pb;
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
