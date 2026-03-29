export const SAFE_THRESHOLD = 0.62;
export const MAX_TICKET_LEG_ODDS = 1.6;
export const MIN_MATCH_RECO_ODDS = 1.22;
export const IDEAL_MATCH_RECO_ODDS = 1.34;
export const GOALS_LINES = [1.5, 2.5, 3.5, 4.5];
export const CORNERS_LINES = [8.5, 9.5, 10.5];
export const CARDS_LINES = [3.5, 4.5, 5.5];

export const TICKET_CONFIGS = [
  { key: "safe", target: 5, name: "Cota 5", desc: "Varianta compacta, construita pentru o cota finala in jur de 5.", minOdds: 1.15, maxOdds: 1.38, preferredPicks: [4, 5] },
  { key: "value", target: 10, name: "Cota 10", desc: "Varianta intermediara, cu selectii ceva mai sus ca pret si cota finala in jur de 10.", minOdds: 1.22, maxOdds: 1.5, preferredPicks: [5, 6] },
  { key: "boost", target: 20, name: "Cota 20", desc: "Varianta extinsa, pentru cota mare fara selectii fortate.", minOdds: 1.28, maxOdds: 1.6, preferredPicks: [6, 7] }
];
