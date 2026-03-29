const el = (id) => document.getElementById(id);

const SAFE_THRESHOLD = 0.62;
const MAX_TICKET_LEG_ODDS = 1.6;
const MIN_MATCH_RECO_ODDS = 1.22;
const IDEAL_MATCH_RECO_ODDS = 1.34;
const GOALS_LINES = [1.5, 2.5, 3.5, 4.5];
const CORNERS_LINES = [8.5, 9.5, 10.5];
const CARDS_LINES = [3.5, 4.5, 5.5];
const TICKET_CONFIGS = [
  { key: "safe", target: 5, name: "Cota 5", desc: "Variantă compactă, construită pentru o cotă finală în jur de 5.", minOdds: 1.15, maxOdds: 1.38, preferredPicks: [4, 5] },
  { key: "value", target: 10, name: "Cota 10", desc: "Variantă intermediară, cu selecții ceva mai sus ca preț și cotă finală în jur de 10.", minOdds: 1.22, maxOdds: 1.5, preferredPicks: [5, 6] },
  { key: "boost", target: 20, name: "Cota 20", desc: "Variantă extinsă, pentru cotă mare fără selecții forțate.", minOdds: 1.28, maxOdds: 1.6, preferredPicks: [6, 7] }
];

let UI = { index: null, leagues: [], matches: [], matchByFixtureId: new Map(), matchRecommendations: new Map() };
let HIST = null;
let current = { day: null, leagueId: "all", fixtureId: null, ticketKey: "safe", view: "matches" };

function setStatus(text, ok = true) {
  const statusText = el("statusText");
  const statusDot = el("statusDot");
  if (!statusText || !statusDot) return;
  statusText.textContent = text;
  statusDot.style.background = ok ? "var(--green)" : "var(--red)";
  statusDot.style.boxShadow = ok
    ? "0 0 16px rgba(22,198,106,0.48)"
    : "0 0 16px rgba(190,36,43,0.42)";
}

async function getJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtClock(iso) {
  if (!iso) return "—";
  return String(iso).slice(11, 16) || "—";
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = String(iso).replace(".000Z", "Z");
  return d.replace("T", " ").replace("Z", " UTC");
}

function fmtDayLong(day) {
  if (!day) return "—";
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function pctRounded(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return `${Math.round(Number(x) * 100)}%`;
}

function pct01(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fmtNum(x, digits = 2) {
  if (!Number.isFinite(Number(x))) return "—";
  return Number(x).toFixed(digits);
}

function fmtOdds(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return Number(x).toFixed(2);
}

function monogram(name, maxParts = 2) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, maxParts).map((part) => part[0]).join("").toUpperCase();
}

function badgeHue(name) {
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash) + text.charCodeAt(i);
  return Math.abs(hash) % 360;
}

function oddsFromProb(p) {
  const x = Number(p);
  if (!Number.isFinite(x) || x <= 0) return null;
  return 1 / x;
}

function uniqBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function normalizeBookmakerUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url || url === "#") return "#";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("superbet")) {
      parsed.hostname = "superbet.ro";
    }
    return parsed.toString();
  } catch {
    return url.replace("superbet.com", "superbet.ro");
  }
}

function getHistEntry(fixtureId) {
  return HIST?.byFixtureId?.[String(fixtureId)] || null;
}

function getMatchSummary(fixtureId) {
  return UI.matchByFixtureId.get(String(fixtureId)) || null;
}

function getMatchRecommendation(fixtureId) {
  return UI.matchRecommendations.get(String(fixtureId)) || null;
}

function pickDefaultDay(days) {
  const list = Array.from(new Set(days || [])).sort();
  if (!list.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return list.includes(today) ? today : list.find((day) => day >= today) || list[0];
}

function buildSelectionKeyFromPick(pick) {
  return `${String(pick.market)}|${String(pick.sel)}`;
}

function getBookSelection(match, market, sel) {
  if (!match?.selectionIndex) return null;
  return match.selectionIndex[buildSelectionKeyFromPick({ market, sel })] || null;
}

function pickDisplayLabel(pick) {
  if (pick.market === "1X2") {
    return { HOME: "Victorie gazde", DRAW: "Egal", AWAY: "Victorie oaspeți" }[pick.sel] || "1X2";
  }
  if (pick.market === "BTTS") {
    return pick.sel === "YES" ? "Ambele marchează" : "BTTS - Nu";
  }

  const goalsMatch = String(pick.market).match(/^Goals (\d+(?:\.\d+)?)$/);
  if (goalsMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${goalsMatch[1]} goluri`;

  const cornersMatch = String(pick.market).match(/^Corners (\d+(?:\.\d+)?)$/);
  if (cornersMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${cornersMatch[1]} cornere`;

  const cardsMatch = String(pick.market).match(/^Cards (\d+(?:\.\d+)?)$/);
  if (cardsMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${cardsMatch[1]} cartonașe`;

  return `${pick.market} ${pick.sel}`;
}

function pickReasonText(pick) {
  if (pick.market === "1X2") {
    return {
      HOME: "Modelul de goluri favorizează echipa gazdă.",
      DRAW: "Distribuția de scor sugerează un meci echilibrat.",
      AWAY: "Modelul oferă avantaj echipei oaspete."
    }[pick.sel] || "Selecție generată de modelul SAFE.";
  }
  if (pick.market === "BTTS") {
    return pick.sel === "YES"
      ? "Profil ofensiv compatibil pentru ambele echipe."
      : "Modelul vede șanse bune să nu marcheze ambele.";
  }

  const market = String(pick.market);
  if (market.startsWith("Goals ")) {
    return pick.sel === "OVER"
      ? "Linia de goluri este susținută de ritmul ofensiv estimat."
      : "Modelul vede un total mai controlat de goluri.";
  }
  if (market.startsWith("Corners ")) {
    return pick.sel === "OVER"
      ? "Volumul de cornere proiectat depășește linia bookmakerului."
      : "Ritmul de joc sugerează mai puține cornere decât linia afișată.";
  }
  if (market.startsWith("Cards ")) {
    return pick.sel === "OVER"
      ? "Intensitatea estimată a jocului favorizează mai multe cartonașe."
      : "Modelul anticipează un meci mai disciplinat.";
  }
  return "Selecție generată de modelul SAFE.";
}

function rowsFromFeaturedMarket(featuredMarket, marketKey) {
  if (!featuredMarket?.outcomes?.length) return [];
  return featuredMarket.outcomes.map((outcome) => ({
    label: getOutcomeLabel(marketKey, outcome),
    value: fmtOdds(outcome.price)
  }));
}

function getOutcomeLabel(marketKey, outcome) {
  const key = String(outcome?.key || "").toUpperCase();
  if (marketKey === "ft1x2") {
    return { HOME: "1", DRAW: "X", AWAY: "2" }[key] || outcome?.label || key || "—";
  }
  if (marketKey === "btts") {
    return { YES: "Da", NO: "Nu" }[key] || outcome?.label || key || "—";
  }
  return outcome?.label || key || "—";
}

function renderRows(containerId, rows) {
  const box = el(containerId);
  if (!box) return;
  box.innerHTML = "";
  if (!rows?.length) {
    box.innerHTML = `<div class="muted">—</div>`;
    return;
  }
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "row";
    if (row.tone) div.dataset.tone = row.tone;
    div.innerHTML = `<div class="k">${escapeHtml(row.label)}</div><div class="v">${escapeHtml(row.value)}</div>`;
    box.appendChild(div);
  }
}

function setCardVisibility(cardId, rows, fallbackTextId = null, fallbackText = "") {
  const card = el(cardId);
  if (!card) return;
  const visible = Boolean(rows?.length);
  card.hidden = !visible;
  if (fallbackTextId && el(fallbackTextId)) {
    el(fallbackTextId).textContent = visible ? fallbackText : "";
  }
}

function factorial(n) {
  let value = 1;
  for (let i = 2; i <= n; i += 1) value *= i;
  return value;
}

function poissonPMF(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function poissonCDF(k, lambda) {
  let sum = 0;
  for (let i = 0; i <= k; i += 1) sum += poissonPMF(i, lambda);
  return sum;
}

function probTotalOver(line, lambdaTotal) {
  const threshold = Math.floor(line) + 1;
  return 1 - poissonCDF(threshold - 1, lambdaTotal);
}

function probBTTS(lh, la) {
  const pH0 = Math.exp(-lh);
  const pA0 = Math.exp(-la);
  const p00 = Math.exp(-(lh + la));
  return 1 - pH0 - pA0 + p00;
}

function prob1X2(lh, la, maxGoals = 7) {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= maxGoals; h += 1) {
    const pH = poissonPMF(h, lh);
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = pH * poissonPMF(a, la);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away || 1;
  return { home: home / total, draw: draw / total, away: away / total };
}

function safeAvg(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (x + y) / 2;
}

function estGoals(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;
  if (!hs || !as) return null;
  if ((hs.homeMatches || 0) < 1 || (as.awayMatches || 0) < 1) return null;
  const lh = safeAvg(hs.homeGF, as.awayGA);
  const la = safeAvg(as.awayGF, hs.homeGA);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  return { lh, la, lt: lh + la };
}

function estCorners(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;
  if (!hs || !as) return null;
  const lh = safeAvg(hs.homeCornersFor, as.awayCornersAgainst);
  const la = safeAvg(as.awayCornersFor, hs.homeCornersAgainst);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  if (lh === 0 && la === 0) return null;
  return { lt: lh + la };
}

function estCards(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;
  if (!hs || !as) return null;
  const lh = safeAvg(hs.homeYCFor, as.awayYCAgainst);
  const la = safeAvg(as.awayYCFor, hs.homeYCAgainst);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  if (lh === 0 && la === 0) return null;
  return { lt: lh + la };
}

function buildCandidate(match, market, sel, probability) {
  const bookSelection = getBookSelection(match, market, sel);
  const bookOdds = Number(bookSelection?.price);
  if (!Number.isFinite(bookOdds) || bookOdds <= 1) return null;
  return {
    fixtureId: String(match.fixtureId),
    match: `${match.home} vs ${match.away}`,
    home: match.home,
    away: match.away,
    market,
    sel,
    p: Number(probability),
    bookOdds,
    fairOdds: oddsFromProb(probability),
    edge: Number(probability) - (1 / bookOdds),
    fixturePath: normalizeBookmakerUrl(match.fixturePath || null),
    startTime: match.startTime,
    tournamentName: match.tournamentName || "",
    categoryName: match.categoryName || "",
    displayLabel: pickDisplayLabel({ market, sel }),
    reason: pickReasonText({ market, sel })
  };
}

function getCandidatesForMatch(match, minProbability = 0.58) {
  const entry = getHistEntry(match.fixtureId);
  const candidates = [];
  if (!entry) return candidates;

  const goals = estGoals(entry);
  if (goals) {
    const oneXTwo = prob1X2(goals.lh, goals.la);
    const best1x2 = [
      { sel: "HOME", probability: oneXTwo.home },
      { sel: "DRAW", probability: oneXTwo.draw },
      { sel: "AWAY", probability: oneXTwo.away }
    ].sort((a, b) => b.probability - a.probability)[0];
    const oneXTwoSelection = match.featuredMarkets?.ft1x2?.outcomes?.find((outcome) => outcome.key === best1x2.sel);
    if (Number.isFinite(Number(oneXTwoSelection?.price))) {
      candidates.push({
        fixtureId: String(match.fixtureId),
        match: `${match.home} vs ${match.away}`,
        home: match.home,
        away: match.away,
        market: "1X2",
        sel: best1x2.sel,
        p: best1x2.probability,
        bookOdds: Number(oneXTwoSelection.price),
        fairOdds: oddsFromProb(best1x2.probability),
        edge: Number(best1x2.probability) - (1 / Number(oneXTwoSelection.price)),
        fixturePath: normalizeBookmakerUrl(match.fixturePath || null),
        startTime: match.startTime,
        tournamentName: match.tournamentName || "",
        categoryName: match.categoryName || "",
        displayLabel: pickDisplayLabel({ market: "1X2", sel: best1x2.sel }),
        reason: pickReasonText({ market: "1X2", sel: best1x2.sel })
      });
    }

    const pYes = probBTTS(goals.lh, goals.la);
    const pNo = 1 - pYes;
    candidates.push(buildCandidate(match, "BTTS", pYes >= pNo ? "YES" : "NO", Math.max(pYes, pNo)));
    for (const line of GOALS_LINES) {
      const pOver = probTotalOver(line, goals.lt);
      const pUnder = 1 - pOver;
      candidates.push(buildCandidate(match, `Goals ${line}`, pOver >= pUnder ? "OVER" : "UNDER", Math.max(pOver, pUnder)));
    }
  }

  const corners = estCorners(entry);
  if (corners) {
    for (const line of CORNERS_LINES) {
      const pOver = probTotalOver(line, corners.lt);
      const pUnder = 1 - pOver;
      candidates.push(buildCandidate(match, `Corners ${line}`, pOver >= pUnder ? "OVER" : "UNDER", Math.max(pOver, pUnder)));
    }
  }

  const cards = estCards(entry);
  if (cards) {
    for (const line of CARDS_LINES) {
      const pOver = probTotalOver(line, cards.lt);
      const pUnder = 1 - pOver;
      candidates.push(buildCandidate(match, `Cards ${line}`, pOver >= pUnder ? "OVER" : "UNDER", Math.max(pOver, pUnder)));
    }
  }

  return candidates
    .filter(Boolean)
    .filter((candidate) => candidate.p >= minProbability)
    .sort((a, b) => (b.p - a.p) || (b.edge - a.edge) || (a.bookOdds - b.bookOdds));
}

function buildMatchRecommendation(match) {
  const preferred = getCandidatesForMatch(match, 0.58)
    .filter((candidate) => candidate.bookOdds >= MIN_MATCH_RECO_ODDS);
  if (preferred.length) {
    return preferred.sort((a, b) => {
      const aOddsDistance = Math.abs(a.bookOdds - IDEAL_MATCH_RECO_ODDS);
      const bOddsDistance = Math.abs(b.bookOdds - IDEAL_MATCH_RECO_ODDS);
      return aOddsDistance - bOddsDistance || (b.p - a.p) || (b.edge - a.edge);
    })[0];
  }

  return getCandidatesForMatch(match, 0.62)
    .filter((candidate) => candidate.bookOdds >= MIN_MATCH_RECO_ODDS)
    .sort((a, b) => b.p - a.p || b.edge - a.edge)[0] || null;
}

function filteredMatches() {
  return UI.matches
    .filter((match) => !current.day || String(match.day) === String(current.day))
    .filter((match) => current.leagueId === "all" || String(match.tournamentId) === String(current.leagueId))
    .sort((a, b) => (
      String(a.startTime || "").localeCompare(String(b.startTime || "")) ||
      String(a.tournamentName || "").localeCompare(String(b.tournamentName || "")) ||
      String(a.home || "").localeCompare(String(b.home || ""))
    ));
}

async function loadAll() {
  setStatus("Loading...");
  UI.index = await getJson("./data/ui/index.json");
  const matchesObj = await getJson("./data/ui/matches.json");
  HIST = await getJson("./data/ui/history_stats.json");

  UI.matches = (matchesObj.matches || []).map((match) => ({
    fixtureId: String(match.fixtureId),
    tournamentId: match.tournamentId != null ? String(match.tournamentId) : null,
    tournamentName: match.tournamentName || "",
    categoryName: match.categoryName || "",
    startTime: match.startTime,
    day: match.day,
    home: match.home || "?",
    away: match.away || "?",
    fixturePath: match.fixturePath || null,
    featuredMarkets: match.featuredMarkets || {},
    selectionIndex: match.selectionIndex || {}
  }));

  UI.leagues = [
    { id: "all", name: "Toate ligile", categoryName: "" },
    ...Array.from(new Map(
      UI.matches
        .filter((match) => match.tournamentId && match.tournamentName)
        .map((match) => [String(match.tournamentId), {
          id: String(match.tournamentId),
          name: match.tournamentName,
          categoryName: match.categoryName || ""
        }])
    ).values()).sort((a, b) => `${a.categoryName} ${a.name}`.localeCompare(`${b.categoryName} ${b.name}`))
  ];

  UI.matchByFixtureId = new Map(UI.matches.map((match) => [String(match.fixtureId), match]));
  UI.matchRecommendations = new Map(UI.matches.map((match) => [String(match.fixtureId), buildMatchRecommendation(match)]));

  current.day = pickDefaultDay(UI.index.days) || UI.matches[0]?.day || null;
  current.leagueId = UI.leagues.some((league) => league.id === current.leagueId) ? current.leagueId : "all";
  setStatus("Ready");
}

function renderDaySel() {
  const input = el("daySel");
  const days = Array.from(new Set(UI.index.days || [])).sort();
  input.min = days[0] || "";
  input.max = days[days.length - 1] || "";
  if (!days.includes(current.day)) current.day = pickDefaultDay(days);
  input.value = current.day || "";
}

function renderLeagueSel() {
  const select = el("leagueSel");
  select.innerHTML = "";
  for (const league of UI.leagues) {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = league.id === "all"
      ? league.name
      : league.categoryName ? `${league.categoryName} • ${league.name}` : league.name;
    select.appendChild(option);
  }
  select.value = current.leagueId || "all";
}

function renderMatchesList() {
  const box = el("matchesList");
  const list = filteredMatches();
  box.innerHTML = "";

  el("dayMatchCount").textContent = String(list.length);
  el("dayHelper").textContent = list.length
    ? `${fmtDayLong(current.day)} • ${list.length} meciuri disponibile`
    : `${fmtDayLong(current.day)} • fără meciuri pentru filtrul curent`;

  const league = UI.leagues.find((item) => item.id === current.leagueId);
  const leagueLabel = current.leagueId === "all"
    ? "Toate ligile"
    : league?.categoryName ? `${league.categoryName} • ${league.name}` : league?.name || "Liga selectată";

  el("matchesSubtitle").textContent = list.length
    ? `${fmtDayLong(current.day)} • ${leagueLabel}`
    : `${fmtDayLong(current.day)} • nicio partidă în filtrul curent`;

  if (!list.length) {
    box.innerHTML = `<div class="reco-empty">Nu există meciuri pentru combinația de dată și ligă selectată.</div>`;
    return;
  }

  for (const match of list) {
    const recommendation = getMatchRecommendation(match.fixtureId);
    const successPct = recommendation ? clamp(Math.round(recommendation.p * 100), 0, 100) : 0;
    const dangerPct = 100 - successPct;
    const row = document.createElement("article");
    row.className = "match-row";
    row.innerHTML = `
      <div class="match-main">
        <div class="match-time">${escapeHtml(fmtClock(match.startTime))}</div>
        <div class="match-clubs">
          <div class="match-name">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</div>
          <div class="match-link">Click pentru analiza completă a meciului</div>
        </div>
      </div>
      <div class="league-chip">
        <span class="league-badge" style="--badge-hue:${badgeHue(`${match.categoryName} ${match.tournamentName}`)}">${escapeHtml(monogram(match.tournamentName, 1))}</span>
        <span>${escapeHtml(match.categoryName)} • ${escapeHtml(match.tournamentName)}</span>
      </div>
      ${
        recommendation ? `
          <div class="reco-pill">
            <div class="reco-copy">
              <div class="reco-label">Best bet</div>
              <div class="reco-pick">${escapeHtml(recommendation.displayLabel)}</div>
              <div class="reco-meter" aria-label="${escapeHtml(`${successPct}% șansă estimată`)}}">
                <div class="reco-meter-bar">
                  <span class="reco-meter-safe" style="width:${successPct}%"></span>
                  <span class="reco-meter-risk" style="width:${dangerPct}%"></span>
                </div>
                <div class="reco-meter-label">${escapeHtml(`${successPct}% șansă estimată`)}</div>
              </div>
            </div>
            <div class="reco-odds">${fmtOdds(recommendation.bookOdds)}</div>
          </div>
        ` : `
          <div class="reco-empty">Meciul rămâne în listă, dar momentan nu are un pariu suficient de puternic pentru a fi recomandat.</div>
        `
      }
    `;
    row.addEventListener("click", async () => {
      await openMatchDetail(match.fixtureId);
    });
    box.appendChild(row);
  }
}

function setView(viewKey) {
  current.view = viewKey;
  const matchesVisible = current.view === "matches";
  const ticketsVisible = current.view === "tickets";
  const detailVisible = current.view === "detail";

  el("matchesView").hidden = !matchesVisible;
  el("ticketsView").hidden = !ticketsVisible;
  el("detailView").hidden = !detailVisible;

  el("viewMatchesBtn").classList.toggle("active", matchesVisible || detailVisible);
  el("viewTicketsBtn").classList.toggle("active", ticketsVisible);
}

async function openMatchDetail(fixtureId) {
  current.fixtureId = fixtureId;
  setView("detail");
  await loadAndRenderMatch();
}

function goBackToMatches() {
  setView("matches");
}

function buildTwoWayRows(lines, lambdaTotal, noun) {
  return lines.map((line) => {
    const pOver = probTotalOver(line, lambdaTotal);
    const pUnder = 1 - pOver;
    const best = Math.max(pOver, pUnder);
    const side = pOver >= pUnder ? "Peste" : "Sub";
    return {
      label: `${side} ${line} ${noun}`,
      value: `${pctRounded(best)} • ${fmtOdds(oddsFromProb(best))}`,
      tone: best >= SAFE_THRESHOLD ? "accent" : side === "Sub" ? "warning" : ""
    };
  });
}

function buildConfidenceModel(entry) {
  const goals = estGoals(entry);
  const corners = estCorners(entry);
  const cards = estCards(entry);
  const signals = [];
  const notes = [];

  if (goals) {
    const pYes = probBTTS(goals.lh, goals.la);
    signals.push(Math.max(pYes, 1 - pYes));
    if (goals.lt >= 2.6) notes.push("Volum ofensiv bun conform modelului de goluri.");
    if (goals.lt <= 2.2) notes.push("Profil de meci mai disciplinat pe total goluri.");
  }
  if (corners) {
    signals.push(Math.max(probTotalOver(8.5, corners.lt), 1 - probTotalOver(8.5, corners.lt)));
    notes.push(`Cornere estimate în jur de ${corners.lt.toFixed(1)} pe meci.`);
  }
  if (cards) {
    signals.push(Math.max(probTotalOver(4.5, cards.lt), 1 - probTotalOver(4.5, cards.lt)));
    notes.push(`Cartonașe estimate în jur de ${cards.lt.toFixed(1)} pe meci.`);
  }

  const score = signals.length ? signals.reduce((sum, value) => sum + value, 0) / signals.length : 0;
  const copy = score >= 0.72
    ? "Selecțiile au un profil solid și un raport risc/recompensă bun."
    : score >= 0.62
      ? "Există suport statistic rezonabil pentru cele mai bune piețe."
      : "Meciul cere prudență, dar păstrează semnale utile pentru analiză.";

  if (!notes.length) notes.push("Analiza se bazează cu prioritate pe piețele pentru care istoricul recent este complet.");
  return { score, copy, notes: notes.slice(0, 3) };
}

function getRiskProfile(avgP) {
  if (avgP >= 0.74) return { label: "Scăzut", note: "Bilet echilibrat din selecții foarte solide." };
  if (avgP >= 0.66) return { label: "Controlat", note: "Raport bun risc/recompensă pe piața curentă." };
  return { label: "Mediu", note: "Necesită prudență, dar păstrează logică de model." };
}

function renderTicketVariants(day) {
  const tabs = el("ticketTabs");
  const viewer = el("ticketViewer");
  tabs.innerHTML = "";
  viewer.innerHTML = "";

  const matches = filteredMatches();
  const recommendations = matches.map((match) => getMatchRecommendation(match.fixtureId)).filter(Boolean);

  el("recSub").textContent = `${fmtDayLong(day)} • ${recommendations.length} selecții disponibile pentru bilete`;

  if (!recommendations.length) {
    viewer.innerHTML = `<div class="ticket-empty">Nu există suficiente recomandări solide pentru a construi bilete în filtrul curent.</div>`;
    return;
  }

  const renderedTickets = buildDisplayedTickets(matches);
  for (const config of TICKET_CONFIGS) {
    const button = document.createElement("button");
    button.className = "ticket-pill";
    button.type = "button";
    button.textContent = config.name;
    button.classList.toggle("active", current.ticketKey === config.key);
    button.addEventListener("click", () => {
      current.ticketKey = config.key;
      renderTicketVariants(day);
    });
    tabs.appendChild(button);
  }

  if (!TICKET_CONFIGS.some((config) => config.key === current.ticketKey)) {
    current.ticketKey = TICKET_CONFIGS[0].key;
  }

  const config = TICKET_CONFIGS.find((item) => item.key === current.ticketKey) || TICKET_CONFIGS[0];
  const ticket = renderedTickets.get(config.key);
  const article = document.createElement("article");
  article.className = "ticket-card";
  article.dataset.tone = config.key;

  if (!ticket) {
    article.innerHTML = `
      <div class="ticket-card-head">
        <div class="ticket-card-copy">
          <div class="ticket-kicker">Bilet țintă</div>
          <div class="ticket-name">${escapeHtml(config.name)}</div>
          <div class="ticket-desc">${escapeHtml(config.desc)}</div>
        </div>
        <div class="ticket-target">
          <span class="ticket-target-label">Țintă</span>
          <span class="ticket-target-value">${fmtOdds(config.target)}</span>
        </div>
      </div>
      <div class="ticket-empty">Nu am găsit o combinație suficient de solidă pentru această țintă în filtrul curent.</div>
    `;
    viewer.appendChild(article);
    return;
  }

  const risk = getRiskProfile(ticket.avgP);
  const firstLink = ticket.picks.find((pick) => pick.fixturePath)?.fixturePath || "#";
  const picksMarkup = ticket.picks.map((pick) => `
    <div class="ticket-pick">
      <div class="ticket-pick-main">
        <div class="ticket-pick-match">${escapeHtml(pick.home)} vs ${escapeHtml(pick.away)}</div>
        <div class="ticket-pick-bet">${escapeHtml(pick.displayLabel)} • ${escapeHtml(pctRounded(pick.p))} estimat</div>
      </div>
      <div class="ticket-pick-odds">${fmtOdds(pick.bookOdds)}</div>
    </div>
  `).join("");

  article.innerHTML = `
    <div class="ticket-card-head">
      <div class="ticket-card-copy">
        <div class="ticket-kicker">Bilet țintă</div>
        <div class="ticket-name">${escapeHtml(config.name)}</div>
        <div class="ticket-desc">${escapeHtml(config.desc)}</div>
      </div>
      <div class="ticket-target">
        <span class="ticket-target-label">Țintă / obținut</span>
        <span class="ticket-target-value">${fmtOdds(ticket.totalOdds)}</span>
      </div>
    </div>

    <div class="ticket-stats">
      <article class="ticket-stat total-stat">
        <div class="stat-label">Țintă</div>
        <div class="stat-value">${fmtOdds(config.target)}</div>
        <div class="stat-copy">Apropiere ${pctRounded(Math.max(0, 1 - ticket.closeness))}</div>
      </article>
      <article class="ticket-stat">
        <div class="stat-label">Prob. medie</div>
        <div class="stat-value">${pctRounded(ticket.avgP)}</div>
        <div class="stat-copy">${escapeHtml(risk.label)} • selecții sub ${fmtOdds(MAX_TICKET_LEG_ODDS)}</div>
      </article>
      <article class="ticket-stat">
        <div class="stat-label">Prob. bilet</div>
        <div class="stat-value">${pctRounded(ticket.combinedProbability)}</div>
        <div class="stat-copy">${escapeHtml(risk.note)}</div>
      </article>
    </div>

    <div class="ticket-picks">${picksMarkup}</div>

    <a class="ticket-cta ${firstLink === "#" ? "disabled" : ""}" href="${escapeHtml(firstLink)}" target="_blank" rel="noreferrer">
      <span>Deschide primul meci din bilet</span>
      <strong>${fmtOdds(ticket.totalOdds)}</strong>
      <span class="ticket-cta-arrow">→</span>
    </a>
    <div class="ticket-cta-note">${firstLink === "#" ? "Nu există momentan link bookmaker pentru selecțiile acestui bilet." : "Linkul folosește domeniul Superbet.ro și deschide primul eveniment disponibil din combinație."}</div>
  `;
  viewer.appendChild(article);
}

function evaluateTicket(picks, config) {
  if (!picks.length) return null;
  const target = config.target;
  const totalOdds = picks.reduce((product, pick) => product * pick.bookOdds, 1);
  const combinedProbability = picks.reduce((product, pick) => product * pick.p, 1);
  const avgP = picks.reduce((sum, pick) => sum + pick.p, 0) / picks.length;
  const closeness = Math.abs(totalOdds - target) / target;
  const inTargetWindow = totalOdds >= target * 0.82 && totalOdds <= target * 1.18;
  const preferredMin = config.preferredPicks?.[0] ?? 2;
  const preferredMax = config.preferredPicks?.[1] ?? 7;
  const preferredRangePenalty = picks.length < preferredMin
    ? (preferredMin - picks.length) * 0.3
    : picks.length > preferredMax
      ? (picks.length - preferredMax) * 0.22
      : 0;
  const oddsPenalty = picks.reduce((sum, pick) => {
    if (pick.bookOdds < config.minOdds) return sum + (config.minOdds - pick.bookOdds) * 1.8;
    if (pick.bookOdds > config.maxOdds) return sum + (pick.bookOdds - config.maxOdds) * 2.2;
    return sum;
  }, 0);
  const score = closeness * 12 + (1 - avgP) * 2.4 + (1 - combinedProbability) * 0.8 + preferredRangePenalty + oddsPenalty - (inTargetWindow ? 0.6 : 0);
  return { picks: picks.slice(), target, totalOdds, combinedProbability, avgP, closeness, score };
}

function isBetterTicket(candidate, currentBest) {
  if (!candidate) return false;
  if (!currentBest) return true;
  if (candidate.score !== currentBest.score) return candidate.score < currentBest.score;
  if (candidate.combinedProbability !== currentBest.combinedProbability) return candidate.combinedProbability > currentBest.combinedProbability;
  if (candidate.avgP !== currentBest.avgP) return candidate.avgP > currentBest.avgP;
  return candidate.totalOdds < currentBest.totalOdds;
}

function buildTicketForTarget(matches, config, exclusions = {}) {
  const target = config.target;
  const excludedFixtureIds = exclusions.excludedFixtureIds || new Set();
  const excludedSelectionKeys = exclusions.excludedSelectionKeys || new Set();
  const optionGroups = matches
    .map((match) => {
      if (excludedFixtureIds.has(String(match.fixtureId))) return null;
      const options = getCandidatesForMatch(match, 0.52)
        .filter((pick) => Number.isFinite(pick.bookOdds) && pick.bookOdds >= config.minOdds && pick.bookOdds <= Math.min(config.maxOdds, MAX_TICKET_LEG_ODDS))
        .filter((pick) => !excludedSelectionKeys.has(`${pick.fixtureId}|${pick.market}|${pick.sel}`))
        .slice(0, 6);
      return options.length ? { fixtureId: match.fixtureId, options, rank: options[0].p + Math.max(0, options[0].edge) + (options[0].bookOdds / 10) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 16);

  let best = null;
  const maxPicks = config.preferredPicks?.[1] ?? (target >= 20 ? 7 : target >= 10 ? 6 : 5);
  const minPicks = Math.max(2, (config.preferredPicks?.[0] ?? (target >= 20 ? 3 : 2)) - 1);

  function visit(groupIndex, picks, totalOdds) {
    if (picks.length >= minPicks) {
      const evaluated = evaluateTicket(picks, config);
      if (isBetterTicket(evaluated, best)) best = evaluated;
    }
    if (groupIndex >= optionGroups.length || picks.length >= maxPicks) return;

    visit(groupIndex + 1, picks, totalOdds);
    for (const nextPick of optionGroups[groupIndex].options) {
      const nextOdds = totalOdds * nextPick.bookOdds;
      if (nextOdds > target * 2.2) continue;
      picks.push(nextPick);
      visit(groupIndex + 1, picks, nextOdds);
      picks.pop();
    }
  }

  visit(0, [], 1);
  return best;
}

function buildDisplayedTickets(matches) {
  const renderedTickets = new Map();
  const usedFixtureIds = new Set();
  const usedSelectionKeys = new Set();

  for (const config of TICKET_CONFIGS) {
    let ticket = buildTicketForTarget(matches, config, { excludedFixtureIds: usedFixtureIds, excludedSelectionKeys: usedSelectionKeys });
    if (!ticket) {
      ticket = buildTicketForTarget(matches, config);
    }
    renderedTickets.set(config.key, ticket);
    if (!ticket) continue;
    for (const pick of ticket.picks) {
      usedFixtureIds.add(String(pick.fixtureId));
      usedSelectionKeys.add(`${pick.fixtureId}|${pick.market}|${pick.sel}`);
    }
  }

  return renderedTickets;
}

function renderConfidence(entry) {
  const confidence = buildConfidenceModel(entry);
  el("confidenceScore").textContent = pct01(confidence.score);
  el("confidenceCopy").textContent = confidence.copy;
  const list = el("confidenceList");
  list.innerHTML = "";
  for (const note of confidence.notes) {
    const li = document.createElement("li");
    li.textContent = note;
    list.appendChild(li);
  }
}

function renderPrimaryPick(match, recommendation) {
  if (!recommendation) {
    el("primaryPick").textContent = "Fără recomandare principală";
    el("primaryPickMeta").textContent = "Meciul rămâne disponibil pentru consultare, dar nu forțăm o selecție fără suport bun.";
    el("primaryPickNote").textContent = "Poți verifica 1X2 și BTTS sau reveni la lista principală pentru alte meciuri.";
    return;
  }
  el("primaryPick").textContent = recommendation.displayLabel;
  el("primaryPickMeta").textContent = `${fmtOdds(recommendation.bookOdds)} cotă • ${pctRounded(recommendation.p)} șansă estimată`;
  el("primaryPickNote").textContent = recommendation.reason || `${match.home} vs ${match.away}`;
}

function renderDetailHistory(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;

  if (hs) {
    renderRows("histHome", [
      { label: `Meciuri acasă (ultimele ${HIST.lookback || 5})`, value: String(hs.homeMatches ?? "—") },
      { label: "Goluri marcate", value: fmtNum(hs.homeGF, 2) },
      { label: "Goluri primite", value: fmtNum(hs.homeGA, 2) },
      { label: "Cornere create", value: fmtNum(hs.homeCornersFor, 2) },
      { label: "Cartonașe primite", value: fmtNum(hs.homeYCFor, 2) }
    ]);
    el("histHomeNote").textContent = entry.footballDataId ? `Competiție sursă: ${entry.footballDataId}` : "";
  } else {
    renderRows("histHome", []);
    el("histHomeNote").textContent = "Istoricul gazdelor nu este disponibil pentru acest meci.";
  }

  if (as) {
    renderRows("histAway", [
      { label: `Meciuri în deplasare (ultimele ${HIST.lookback || 5})`, value: String(as.awayMatches ?? "—") },
      { label: "Goluri marcate", value: fmtNum(as.awayGF, 2) },
      { label: "Goluri primite", value: fmtNum(as.awayGA, 2) },
      { label: "Cornere create", value: fmtNum(as.awayCornersFor, 2) },
      { label: "Cartonașe primite", value: fmtNum(as.awayYCFor, 2) }
    ]);
    el("histAwayNote").textContent = entry.footballDataId ? `Competiție sursă: ${entry.footballDataId}` : "";
  } else {
    renderRows("histAway", []);
    el("histAwayNote").textContent = "Istoricul oaspeților nu este disponibil pentru acest meci.";
  }
}

async function loadAndRenderMatch() {
  if (!current.fixtureId) return;

  const summary = getMatchSummary(current.fixtureId);
  const fixture = await getJson(`./data/ui/match/${current.fixtureId}.json`);
  const featuredMarkets = fixture.featuredMarkets || summary?.featuredMarkets || {};
  const entry = getHistEntry(current.fixtureId);
  const recommendation = getMatchRecommendation(current.fixtureId);

  el("matchTitle").textContent = `${fixture.home || summary?.home || "?"} vs ${fixture.away || summary?.away || "?"}`;
  el("matchMeta").textContent = `${fixture.categoryName || summary?.categoryName || "—"} • ${fixture.tournamentName || summary?.tournamentName || "—"} • ${fmtTime(fixture.startTime || summary?.startTime)}`;

  const href = normalizeBookmakerUrl(fixture.fixturePath || summary?.fixturePath || "#");
  el("openBookBtn").href = href;
  el("openBookBtn").style.opacity = href === "#" ? "0.5" : "1";

  renderPrimaryPick(summary, recommendation);
  renderRows("market1x2", rowsFromFeaturedMarket(featuredMarkets.ft1x2, "ft1x2"));
  renderRows("marketBtts", rowsFromFeaturedMarket(featuredMarkets.btts, "btts"));

  const goals = estGoals(entry);
  const corners = estCorners(entry);
  const cards = estCards(entry);

  const goalsRows = goals ? buildTwoWayRows(GOALS_LINES, goals.lt, "goluri") : [];
  const cornersRows = corners ? buildTwoWayRows(CORNERS_LINES, corners.lt, "cornere") : [];
  const cardsRows = cards ? buildTwoWayRows(CARDS_LINES, cards.lt, "cartonașe") : [];

  renderRows("goalsQuickRows", goalsRows);
  renderRows("cornersQuickRows", cornersRows);
  renderRows("cardsQuickRows", cardsRows);

  setCardVisibility("goalsCard", goalsRows);
  setCardVisibility("cornersCard", cornersRows, "cornersHint", corners ? `Media estimată ${corners.lt.toFixed(2)} / meci` : "");
  setCardVisibility("cardsCard", cardsRows, "cardsHint", cards ? `Media estimată ${cards.lt.toFixed(2)} / meci` : "");

  renderConfidence(entry);
  renderDetailHistory(entry);
}

async function refreshDataAndRender() {
  current.fixtureId = null;
  await loadAll();
  renderDaySel();
  renderLeagueSel();
  renderMatchesList();
  renderTicketVariants(current.day);
  setView("matches");
}

async function init() {
  try {
    await loadAll();
    renderDaySel();
    renderLeagueSel();
    renderMatchesList();
    renderTicketVariants(current.day);
    setView("matches");

    document.querySelector(".brand-lockup")?.addEventListener("click", (event) => {
      event.preventDefault();
      goBackToMatches();
    });

    el("viewMatchesBtn").addEventListener("click", () => goBackToMatches());
    el("viewTicketsBtn").addEventListener("click", () => setView("tickets"));
    el("backToMatchesBtn").addEventListener("click", () => goBackToMatches());

    el("daySel").addEventListener("change", async () => {
      current.day = el("daySel").value;
      current.fixtureId = null;
      renderMatchesList();
      renderTicketVariants(current.day);
      goBackToMatches();
    });

    el("leagueSel").addEventListener("change", async () => {
      current.leagueId = el("leagueSel").value;
      current.fixtureId = null;
      renderMatchesList();
      renderTicketVariants(current.day);
      goBackToMatches();
    });

    el("refreshBtn").addEventListener("click", async () => {
      await refreshDataAndRender();
    });
  } catch (error) {
    setStatus(error.message || String(error), false);
  }
}

init();
