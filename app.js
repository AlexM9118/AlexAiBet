const el = (id) => document.getElementById(id);

const SAFE_THRESHOLD = 0.62;
const GOALS_LINES = [1.5, 2.5, 3.5, 4.5];
const CORNERS_LINES = [8.5, 9.5, 10.5];
const CARDS_LINES = [3.5, 4.5, 5.5];

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
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  return r.json();
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = String(iso).replace(".000Z", "Z");
  return d.replace("T", " ").replace("Z", " UTC");
}

function pct01(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return `${(Number(x) * 100).toFixed(1)}%`;
}

function pctRounded(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return `${Math.round(Number(x) * 100)}%`;
}

function oddsFromProb(p) {
  const x = Number(p);
  if (!Number.isFinite(x) || x <= 0) return null;
  return 1 / x;
}

function fmtOdds(x) {
  if (!Number.isFinite(Number(x))) return "—";
  return Number(x).toFixed(2);
}

function uniqBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr || []) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, x);
  }
  return Array.from(m.values());
}

function fmtNum(x, digits = 2) {
  if (!Number.isFinite(Number(x))) return "—";
  return Number(x).toFixed(digits);
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

function fmtDayShort(day) {
  if (!day) return "—";
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(date);
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

function teamMonogram(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function buildSelectionKeyFromPick(pick) {
  return `${String(pick.market)}|${String(pick.sel)}`;
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

function rowsFromFeaturedMarket(featuredMarket, marketKey) {
  if (!featuredMarket?.outcomes?.length) return [];
  return featuredMarket.outcomes.map((outcome) => ({
    label: getOutcomeLabel(marketKey, outcome),
    value: fmtOdds(outcome.price)
  }));
}

function pickDisplayLabel(pick) {
  if (pick.market === "BTTS") {
    return pick.sel === "YES" ? "Ambele marchează" : "BTTS - Nu";
  }

  const m = String(pick.market).match(/^Goals (\d+(?:\.\d+)?)$/);
  if (m) {
    return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${m[1]} goluri`;
  }

  return `${pick.market} ${pick.sel}`;
}

function pickReasonText(pick) {
  if (pick.market === "BTTS") {
    return pick.sel === "YES"
      ? "Profil ofensiv compatibil pentru ambele echipe."
      : "Modelul vede șanse bune să nu marcheze ambele."
  }

  const m = String(pick.market).match(/^Goals (\d+(?:\.\d+)?)$/);
  if (!m) return "Selecție generată de modelul SAFE.";
  return pick.sel === "OVER"
    ? `Linia de ${m[1]} este abordabilă pentru ritmul estimat.`
    : `Modelul vede linia de ${m[1]} drept ridicată pentru acest meci.`;
}

function getRiskProfile(avgP) {
  if (avgP >= 0.74) {
    return { label: "Scăzut", note: "Bilet echilibrat din selecții foarte solide.", tone: "low" };
  }
  if (avgP >= 0.66) {
    return { label: "Controlat", note: "Raport bun risc/recompensă pe piața curentă.", tone: "medium" };
  }
  return { label: "Mediu", note: "Necesită prudență, dar păstrează logică de model.", tone: "high" };
}

function getAnalysisMeta(tabKey) {
  return {
    goals: {
      title: "Total goluri - Peste/Sub",
      positive: "Peste",
      negative: "Sub"
    },
    cards: {
      title: "Cartonașe galbene - Peste/Sub",
      positive: "Peste",
      negative: "Sub"
    },
    corners: {
      title: "Cornere - Peste/Sub",
      positive: "Peste",
      negative: "Sub"
    },
    btts: {
      title: "BTTS - Da/Nu",
      positive: "Da",
      negative: "Nu"
    }
  }[tabKey] || {
    title: "Analiză detaliată",
    positive: "Peste",
    negative: "Sub"
  };
}

function updateAnalysisFrame(tabKey) {
  const meta = getAnalysisMeta(tabKey);
  el("analysisHeadline").textContent = meta.title;
  el("analysisLegend").innerHTML = `
    <span class="legend-item"><i class="legend-dot positive"></i>${escapeHtml(meta.positive)}</span>
    <span class="legend-item"><i class="legend-dot negative"></i>${escapeHtml(meta.negative)}</span>
  `;
}

function renderRows(containerId, rows) {
  const box = el(containerId);
  box.innerHTML = "";
  if (!rows || !rows.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "—";
    box.appendChild(empty);
    return;
  }
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "row";
    if (r.tone) {
      div.dataset.tone = r.tone;
    }

    const key = document.createElement("div");
    key.className = "k";
    key.textContent = r.label;

    const value = document.createElement("div");
    value.className = "v";
    value.textContent = r.value;

    div.appendChild(key);
    div.appendChild(value);
    box.appendChild(div);
  }
}

function renderOtherMarkets(markets, used) {
  const box = el("marketOther");
  const lines = [];

  for (const m of markets || []) {
    if (used?.has(String(m.marketId))) continue;
    const outs = uniqBy(m.outcomes || [], (o) => o.outcomeId)
      .map((o) => `${o.outcomeId}:${fmtOdds(o.price)}`)
      .join(" | ");
    lines.push(`#${m.marketId}  ${outs || "—"}`);
  }

  box.textContent = lines.length ? lines.join("\n") : "—";
}

/* Poisson */
function factorial(n) { let f = 1; for (let i=2;i<=n;i++) f*=i; return f; }
function poissonPMF(k, lambda) { return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k); }
function poissonCDF(k, lambda) { let s=0; for (let i=0;i<=k;i++) s+=poissonPMF(i,lambda); return s; }
function probTotalOver(line, lambdaTotal) {
  const threshold = Math.floor(line) + 1;
  return 1 - poissonCDF(threshold - 1, lambdaTotal);
}
function probBTTS(lh, la) {
  const pH0 = Math.exp(-lh);
  const pA0 = Math.exp(-la);
  const p00 = Math.exp(-(lh+la));
  return 1 - pH0 - pA0 + p00;
}
function safeAvg(a,b){
  const x=Number(a), y=Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (x+y)/2;
}
function estGoals(entry){
  const hs = entry?.homeStats, as = entry?.awayStats;
  if (!hs || !as) return null;
  if ((hs.homeMatches||0) < 1 || (as.awayMatches||0) < 1) return null;
  const lh = safeAvg(hs.homeGF, as.awayGA);
  const la = safeAvg(as.awayGF, hs.homeGA);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  return { lh, la, lt: lh+la };
}
function estCorners(entry){
  const hs = entry?.homeStats, as = entry?.awayStats;
  if (!hs || !as) return null;
  const lh = safeAvg(hs.homeCornersFor, as.awayCornersAgainst);
  const la = safeAvg(as.awayCornersFor, hs.homeCornersAgainst);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  if (lh===0 && la===0) return null;
  return { lt: lh+la };
}
function estCards(entry){
  const hs = entry?.homeStats, as = entry?.awayStats;
  if (!hs || !as) return null;
  const lh = safeAvg(hs.homeYCFor, as.awayYCAgainst);
  const la = safeAvg(as.awayYCFor, hs.homeYCAgainst);
  if (!Number.isFinite(lh) || !Number.isFinite(la)) return null;
  if (lh===0 && la===0) return null;
  return { lt: lh+la };
}

/* UI state */
let UI = { index:null, leagues:[], matches:[], matchByFixtureId:new Map() };
let HIST = null;
let current = { leagueId:null, day:null, fixtureId:null };

function getHistEntry(fixtureId){
  return HIST?.byFixtureId?.[String(fixtureId)] || null;
}

function getMatchSummary(fixtureId) {
  return UI.matchByFixtureId.get(String(fixtureId)) || null;
}

async function loadAll(){
  setStatus("Loading...");
  UI.index = await getJson("./data/ui/index.json");
  const leaguesObj = await getJson("./data/ui/leagues.json");
  const matchesObj = await getJson("./data/ui/matches.json");
  HIST = await getJson("./data/ui/history_stats.json");

  UI.leagues = (leaguesObj.leagues || []).map(l => ({
    id: String(l.id),
    name: l.name || l.id,
    categoryName: l.categoryName || ""
  }));

  UI.matches = (matchesObj.matches || []).map(m => ({
    fixtureId: String(m.fixtureId),
    tournamentId: m.tournamentId != null ? String(m.tournamentId) : null,
    tournamentName: m.tournamentName || "",
    categoryName: m.categoryName || "",
    startTime: m.startTime,
    day: m.day,
    home: m.home || "?",
    away: m.away || "?",
    fixturePath: m.fixturePath || null,
    featuredMarkets: m.featuredMarkets || {},
    selectionIndex: m.selectionIndex || {}
  }));
  UI.matchByFixtureId = new Map(UI.matches.map((m) => [String(m.fixtureId), m]));

  current.leagueId = UI.leagues[0]?.id || null;
  current.day = UI.index.days?.[0] || null;

  setStatus("Ready");
}

function renderLeagueSel(){
  const sel = el("leagueSel");
  sel.innerHTML = "";
  const list = UI.leagues.slice().sort((a,b)=>(a.categoryName+a.name).localeCompare(b.categoryName+b.name));
  for (const l of list){
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.categoryName ? `${l.categoryName} - ${l.name}` : l.name;
    sel.appendChild(opt);
  }
  sel.value = current.leagueId || list[0]?.id;
}

function renderDaySel(){
  const sel = el("daySel");
  sel.innerHTML = "";
  for (const d of (UI.index.days || [])){
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = fmtDayShort(d);
    sel.appendChild(opt);
  }
  sel.value = current.day || UI.index.days?.[0];
}

function filteredMatches(){
  return UI.matches.filter(m => {
    if (current.leagueId && String(m.tournamentId) !== String(current.leagueId)) return false;
    if (current.day && String(m.day) !== String(current.day)) return false;
    return true;
  });
}

function renderMatchesList(){
  const box = el("matchesList");
  box.innerHTML = "";
  const list = filteredMatches();
  el("dayMatchCount").textContent = String(list.length);

  if (!list.length){
    box.innerHTML = `<div class="muted">Nu există meciuri pentru filtrele selectate.</div>`;
    return;
  }

  for (const m of list){
    const div = document.createElement("div");
    div.className = "match-item" + (m.fixtureId === current.fixtureId ? " active":"");
    div.innerHTML = `
      <div class="match-time">${escapeHtml(fmtClock(m.startTime))}</div>
      <div class="match-body">
        <div class="match-team">
          <span class="club-mark">${escapeHtml(teamMonogram(m.home))}</span>
          <span>${escapeHtml(m.home)}</span>
        </div>
        <div class="match-team">
          <span class="club-mark alt">${escapeHtml(teamMonogram(m.away))}</span>
          <span>${escapeHtml(m.away)}</span>
        </div>
      </div>
      <div class="match-arrow">›</div>
    `;
    div.addEventListener("click", async () => {
      current.fixtureId = m.fixtureId;
      renderMatchesList();
      await loadAndRenderMatch();
    });
    box.appendChild(div);
  }

  if (!current.fixtureId && list[0]?.fixtureId){
    current.fixtureId = list[0].fixtureId;
  }
}

function setTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      document.querySelectorAll(".tabpanel").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
      updateAnalysisFrame(btn.dataset.tab);
    });
  });
  updateAnalysisFrame(document.querySelector(".tab.active")?.dataset.tab || "cards");
}

function bar({ label, positive, negative, note = "", emphasized = false }){
  const positiveClamped = Math.max(0, Math.min(1, Number(positive) || 0));
  const negativeClamped = Math.max(0, Math.min(1, Number(negative) || 0));
  const div = document.createElement("div");
  div.className = emphasized ? "bar emphasized" : "bar";
  div.innerHTML = `
    <div class="bar-score bar-score-positive">${pctRounded(positiveClamped)}</div>
    <div class="bar-meter">
      <div class="bar-meter-positive-zone">
        <div class="bar-meter-positive" style="height:${Math.round(positiveClamped * 100)}%"></div>
      </div>
      <div class="bar-meter-negative-zone">
        <div class="bar-meter-negative" style="height:${Math.round(negativeClamped * 100)}%"></div>
      </div>
    </div>
    <div class="bar-score bar-score-negative">${pctRounded(negativeClamped)}</div>
    <div class="bar-label">${escapeHtml(label)}</div>
    <div class="bar-note">${escapeHtml(note)}</div>
  `;
  return div;
}

function renderModelPanels(entry){
  const goalsBox = el("goalsBox");
  const bttsBox = el("bttsBox");
  const cornersBox = el("cornersBox");
  const cardsBox = el("cardsBox");

  goalsBox.innerHTML = "";
  bttsBox.innerHTML = "";
  cornersBox.innerHTML = "";
  cardsBox.innerHTML = "";

  const lookback = HIST?.lookback || 5;
  const goals = estGoals(entry);
  el("modelNote").textContent = goals
    ? `Statistici din ultimele ${lookback} meciuri • λ goluri ${goals.lt.toFixed(2)}`
    : `Statistici din ultimele ${lookback} meciuri • model parțial disponibil`;

  if (goals){
    const goalDistributions = GOALS_LINES.map((line) => {
      const over = probTotalOver(line, goals.lt);
      const under = 1 - over;
      return { line, over, under, confidence: Math.max(over, under) };
    });
    const bestGoalConfidence = Math.max(...goalDistributions.map((item) => item.confidence));

    for (const item of goalDistributions){
      goalsBox.appendChild(bar({
        label: `Peste ${item.line}`,
        positive: item.over,
        negative: item.under,
        note: item.over >= item.under ? "Linie favorabilă" : "Sub ușor favorizat",
        emphasized: item.confidence === bestGoalConfidence
      }));
    }

    const pYes = probBTTS(goals.lh, goals.la);
    const pNo = 1 - pYes;
    bttsBox.appendChild(bar({
      label: "Ambele marchează",
      positive: pYes,
      negative: pNo,
      note: pYes >= pNo ? "Da este favorizat" : "Nu este favorizat",
      emphasized: Math.max(pYes, pNo) >= SAFE_THRESHOLD
    }));
  } else {
    goalsBox.innerHTML = `<div class="muted small">Modelul de goluri nu are suficiente mostre pentru acest meci.</div>`;
    bttsBox.innerHTML = `<div class="muted small">BTTS nu poate fi estimat fără model de goluri.</div>`;
  }

  const corners = estCorners(entry);
  if (corners){
    el("cornersHint").textContent = `Media estimată: ${corners.lt.toFixed(2)} cornere / meci`;
    const cornerDistributions = CORNERS_LINES.map((line) => {
      const over = probTotalOver(line, corners.lt);
      const under = 1 - over;
      return { line, over, under, confidence: Math.max(over, under) };
    });
    const bestCornerConfidence = Math.max(...cornerDistributions.map((item) => item.confidence));

    for (const item of cornerDistributions){
      cornersBox.appendChild(bar({
        label: `Peste ${item.line}`,
        positive: item.over,
        negative: item.under,
        note: item.over >= item.under ? "Ritm susținut" : "Sub ușor favorizat",
        emphasized: item.confidence === bestCornerConfidence
      }));
    }
  } else {
    el("cornersHint").textContent = "Datele de cornere nu sunt suficiente pentru acest meci.";
    cornersBox.innerHTML = `<div class="muted small">Nicio estimare disponibilă.</div>`;
  }

  const cards = estCards(entry);
  if (cards){
    el("cardsHint").textContent = `Media estimată: ${cards.lt.toFixed(2)} cartonașe / meci`;
    const cardsDistributions = CARDS_LINES.map((line) => {
      const over = probTotalOver(line, cards.lt);
      const under = 1 - over;
      return { line, over, under, confidence: Math.max(over, under) };
    });
    const bestCardsConfidence = Math.max(...cardsDistributions.map((item) => item.confidence));

    for (const item of cardsDistributions){
      cardsBox.appendChild(bar({
        label: `Peste ${item.line}`,
        positive: item.over,
        negative: item.under,
        note: item.over >= item.under ? "Tendință agresivă" : "Sub ușor favorizat",
        emphasized: item.confidence === bestCardsConfidence
      }));
    }
  } else {
    el("cardsHint").textContent = "Datele de cartonașe nu sunt suficiente pentru acest meci.";
    cardsBox.innerHTML = `<div class="muted small">Nicio estimare disponibilă.</div>`;
  }
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
      : "Meciul cere prudență, însă există semnale utile pentru analiză.";

  if (!notes.length) {
    notes.push("Nu există suficiente semnale, deci meciul trebuie tratat conservator.");
  }

  return { score, copy, notes: notes.slice(0, 3) };
}

function renderMatchInsightCards(entry, featuredMarkets) {
  const goals = estGoals(entry);
  const corners = estCorners(entry);
  const cards = estCards(entry);

  renderRows("goalsQuickRows", goals ? buildTwoWayRows(GOALS_LINES, goals.lt, "goluri") : []);
  renderRows("cornersQuickRows", corners ? buildTwoWayRows(CORNERS_LINES, corners.lt, "cornere") : []);

  const otherRows = [];
  const bttsOutcomes = featuredMarkets?.btts?.outcomes || [];
  const yes = bttsOutcomes.find((outcome) => outcome.key === "YES");
  const no = bttsOutcomes.find((outcome) => outcome.key === "NO");
  if (yes || no) {
    otherRows.push({
      label: "Ambele marchează",
      value: `Da ${fmtOdds(yes?.price)} • Nu ${fmtOdds(no?.price)}`,
      tone: "accent"
    });
  }

  const ft1x2Outcomes = featuredMarkets?.ft1x2?.outcomes || [];
  const home = ft1x2Outcomes.find((outcome) => outcome.key === "HOME");
  const draw = ft1x2Outcomes.find((outcome) => outcome.key === "DRAW");
  const away = ft1x2Outcomes.find((outcome) => outcome.key === "AWAY");
  if (home || draw || away) {
    otherRows.push({
      label: "1X2",
      value: `1 ${fmtOdds(home?.price)} • X ${fmtOdds(draw?.price)} • 2 ${fmtOdds(away?.price)}`
    });
  }

  if (goals) {
    otherRows.push({
      label: "Model goluri",
      value: `λ total ${goals.lt.toFixed(2)}`
    });
  }
  if (cards) {
    otherRows.push({
      label: "Model cartonașe",
      value: `λ total ${cards.lt.toFixed(2)}`
    });
  }

  renderRows("otherMarketRows", otherRows.slice(0, 4));

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

async function renderRecommendation(day){
  const recTitle = el("recTitle");
  const recSub = el("recSub");
  const recList = el("recList");
  const recSlip = el("recSlip");

  recTitle.textContent = "Bilet combinat din 4 meciuri";
  recSub.textContent = fmtDayLong(day);
  recList.innerHTML = "";
  recSlip.innerHTML = "";

  const list = UI.matches.filter(m => String(m.day) === String(day));
  const picks = [];

  for (const m of list){
    const entry = getHistEntry(m.fixtureId);
    const goals = estGoals(entry);
    if (!goals) continue;

    let bestPick = null;

    const pYes = probBTTS(goals.lh, goals.la);
    const pNo = 1 - pYes;
    const best = Math.max(pYes, pNo);
    if (best >= SAFE_THRESHOLD){
      bestPick = {
        fixtureId: m.fixtureId,
        match: `${m.home} vs ${m.away}`,
        market: "BTTS",
        sel: (pYes>=pNo) ? "YES" : "NO",
        p: best
      };
    }

    for (const L of GOALS_LINES){
      const pOver = probTotalOver(L, goals.lt);
      const pUnder = 1 - pOver;
      const best2 = Math.max(pOver, pUnder);
      if (best2 >= SAFE_THRESHOLD && (!bestPick || best2 > bestPick.p)){
        bestPick = {
          fixtureId: m.fixtureId,
          match: `${m.home} vs ${m.away}`,
          market: `Goals ${L}`,
          sel: (pOver>=pUnder) ? "OVER" : "UNDER",
          p: best2
        };
      }
    }

    if (bestPick) {
      picks.push(bestPick);
    }
  }

  picks.sort((a,b)=>b.p-a.p);
  const top = picks.slice(0, 4);

  el("recCount").textContent = String(top.length);

  if (!top.length){
    recTitle.textContent = "Nicio combinație SAFE";
    recSub.textContent = `${fmtDayLong(day)} • încearcă altă zi`;
    el("recAvgP").textContent = "—";
    el("recFairOdds").textContent = "—";
    el("recBookOdds").textContent = "—";
    el("recRisk").textContent = "—";
    el("recRiskNote").textContent = "Nu există suficiente selecții SAFE.";
    el("recProbNote").textContent = "Rată de succes estimată";
    el("recTotalSub").textContent = "Nicio combinație disponibilă";
    el("recNote").textContent = "Nu există suficiente selecții solide pentru a construi un bilet echilibrat în această zi.";
    el("ticketCtaOdds").textContent = "—";
    el("ticketCta").href = "#";
    el("ticketCta").classList.add("disabled");
    el("ticketCtaNote").textContent = "Cotele sunt orientative și pot varia până la plasarea biletului.";
    return;
  }

  recTitle.textContent = `Bilet combinat din ${top.length} meciuri`;
  recSub.textContent = `${fmtDayLong(day)} • prag SAFE ${pctRounded(SAFE_THRESHOLD)}`;

  const avgP = top.reduce((s,x)=>s+x.p,0) / top.length;
  el("recAvgP").textContent = pct01(avgP);

  // fair combined odds = product(1/p)
  let fair = 1;
  for (const x of top) fair *= oddsFromProb(x.p);
  el("recFairOdds").textContent = fmtOdds(fair);

  let bookCombined = 1;
  let mappedCount = 0;
  let allMapped = true;
  let firstLink = null;
  const detailedTop = [];

  for (const p of top){
    const matchSummary = getMatchSummary(p.fixtureId);
    const link = matchSummary?.fixturePath || null;
    const bookmakerPick = matchSummary?.selectionIndex?.[buildSelectionKeyFromPick(p)] || null;
    const bookOdds = bookmakerPick?.price ?? null;
    const entry = getHistEntry(p.fixtureId);

    if (Number.isFinite(Number(bookOdds))) {
      bookCombined *= Number(bookOdds);
      mappedCount += 1;
    } else {
      allMapped = false;
    }

    detailedTop.push({
      ...p,
      link,
      bookOdds,
      entry,
      matchSummary,
      displayLabel: pickDisplayLabel(p),
      reason: pickReasonText(p)
    });
    if (!firstLink && link) firstLink = link;
  }

  const displayTotal = allMapped && mappedCount === top.length ? bookCombined : fair;
  const risk = getRiskProfile(avgP);

  el("recBookOdds").textContent = fmtOdds(displayTotal);
  el("recTotalSub").textContent = allMapped && mappedCount === top.length
    ? `Cotă Superbet pentru ${top.length} selecții`
    : `Fallback pe cota fair: ${fmtOdds(fair)}`;
  el("recRisk").textContent = risk.label;
  el("recRisk").dataset.risk = risk.tone;
  el("recRiskNote").textContent = risk.note;
  el("recProbNote").textContent = "Rată de succes estimată";
  el("recNote").textContent = allMapped && mappedCount === top.length
    ? "Am selectat piețe cu risc controlat și cotă reală disponibilă în Superbet, bazate pe modelul de goluri și statisticile recente."
    : "Am selectat piețe cu suport statistic bun. Unde nu a fost disponibil mapping-ul bookmaker, am păstrat referința fair din model.";
  el("ticketCtaOdds").textContent = fmtOdds(displayTotal);
  el("ticketCta").href = firstLink || "#";
  el("ticketCta").classList.toggle("disabled", !firstLink);
  el("ticketCtaNote").textContent = firstLink
    ? `Adaugă cele ${top.length} selecții pe bilet. Linkul deschide primul meci disponibil în sursa actuală.`
    : "Nu există momentan un link bookmaker direct pentru acest bilet.";

  for (const [index, pick] of detailedTop.entries()) {
    const matchSummary = pick.matchSummary || {};
    const home = matchSummary.home || pick.match.split(" vs ")[0] || "?";
    const away = matchSummary.away || pick.match.split(" vs ")[1] || "?";
    const competition = matchSummary.tournamentName || "Liga selectată";

    const div = document.createElement("div");
    div.className = "pick";
    div.innerHTML = `
      <div class="pick-index">${index + 1}</div>
      <div class="pick-clubs">
        <div class="club-stack">
          <span class="club-mark">${escapeHtml(teamMonogram(home))}</span>
          <span class="club-mark alt">${escapeHtml(teamMonogram(away))}</span>
        </div>
        <div>
          <div class="pick-title">${escapeHtml(home)} <span>vs</span> ${escapeHtml(away)}</div>
          <div class="pick-meta">${escapeHtml(competition)} • ${escapeHtml(fmtClock(matchSummary.startTime))}</div>
        </div>
      </div>
      <div class="pick-selection">
        <div class="pick-selection-title">${escapeHtml(pick.displayLabel)}</div>
        <div class="pick-selection-copy">${escapeHtml(pick.reason)}</div>
      </div>
      <div class="pick-price">${fmtOdds(pick.bookOdds ?? oddsFromProb(pick.p))}</div>
    `;
    recList.appendChild(div);

    const slip = document.createElement("div");
    slip.className = "slip-card";
    slip.innerHTML = `
      <div class="slip-order">${index + 1}</div>
      <div class="slip-match">${escapeHtml(teamMonogram(home))} <span>vs</span> ${escapeHtml(teamMonogram(away))}</div>
      <div class="slip-copy">${escapeHtml(pick.displayLabel)}</div>
      <div class="slip-odds">${fmtOdds(pick.bookOdds ?? oddsFromProb(pick.p))}</div>
    `;
    recSlip.appendChild(slip);
  }
}

async function loadAndRenderMatch(){
  if (!current.fixtureId) return;

  const m = getMatchSummary(current.fixtureId);
  const fx = await getJson(`./data/ui/match/${current.fixtureId}.json`);
  const featuredMarkets = fx.featuredMarkets || m?.featuredMarkets || {};

  el("matchTitle").textContent = `${fx.home || m?.home || "?"} vs ${fx.away || m?.away || "?"}`;
  el("matchMeta").textContent = `${fx.categoryName || m?.categoryName || "—"} • ${fx.tournamentName || m?.tournamentName || "—"} • ${fmtTime(fx.startTime || m?.startTime)}`;
  const href = fx.fixturePath || "#";
  el("openBookBtn").href = href;
  el("openBookBtn").style.opacity = href === "#" ? "0.5" : "1";

  // odds panels (small)
  const markets = fx.markets || [];
  const used = new Set();
  const rows1x2 = rowsFromFeaturedMarket(featuredMarkets.ft1x2, "ft1x2");
  renderRows("market1x2", rows1x2);
  if (featuredMarkets.ft1x2?.marketId) {
    used.add(String(featuredMarkets.ft1x2.marketId));
  }

  const rowsBtts = rowsFromFeaturedMarket(featuredMarkets.btts, "btts");
  renderRows("marketBtts", rowsBtts);
  if (featuredMarkets.btts?.marketId) {
    used.add(String(featuredMarkets.btts.marketId));
  }

  renderOtherMarkets(markets, used);

  // model panels
  const entry = getHistEntry(current.fixtureId);
  renderModelPanels(entry);
  renderMatchInsightCards(entry, featuredMarkets);

  // history panels on right
  const hs = entry?.homeStats;
  const as = entry?.awayStats;
  if (hs && as){
    renderRows("histHome", [
      { label:`Meciuri acasă (ultimele ${HIST.lookback||5})`, value:String(hs.homeMatches ?? "—") },
      { label:"Goluri marcate", value:fmtNum(hs.homeGF,2) },
      { label:"Goluri primite", value:fmtNum(hs.homeGA,2) },
      { label:"Cornere create", value:fmtNum(hs.homeCornersFor,2) },
      { label:"Cartonașe primite", value:fmtNum(hs.homeYCFor,2) }
    ]);
    renderRows("histAway", [
      { label:`Meciuri în deplasare (ultimele ${HIST.lookback||5})`, value:String(as.awayMatches ?? "—") },
      { label:"Goluri marcate", value:fmtNum(as.awayGF,2) },
      { label:"Goluri primite", value:fmtNum(as.awayGA,2) },
      { label:"Cornere create", value:fmtNum(as.awayCornersFor,2) },
      { label:"Cartonașe primite", value:fmtNum(as.awayYCFor,2) }
    ]);
    el("histHomeNote").textContent = entry.footballDataId ? `Competiție sursă: ${entry.footballDataId}` : "";
    el("histAwayNote").textContent = entry.footballDataId ? `Competiție sursă: ${entry.footballDataId}` : "";
  } else {
    renderRows("histHome", []);
    renderRows("histAway", []);
    el("histHomeNote").textContent = entry?.note || "Nu există statistici istorice suficiente pentru acest meci.";
    el("histAwayNote").textContent = entry?.note || "Nu există statistici istorice suficiente pentru acest meci.";
  }
}

async function init(){
  try{
    await loadAll();

    renderLeagueSel();
    renderDaySel();
    setTabs();

    // initial list
    renderMatchesList();

    // pick first match
    const list = filteredMatches();
    if (!current.fixtureId && list[0]?.fixtureId) current.fixtureId = list[0].fixtureId;
    renderMatchesList();

    await renderRecommendation(current.day);
    await loadAndRenderMatch();

    el("leagueSel").addEventListener("change", async () => {
      current.leagueId = el("leagueSel").value;
      current.fixtureId = null;
      renderMatchesList();
      const list2 = filteredMatches();
      if (list2[0]?.fixtureId) current.fixtureId = list2[0].fixtureId;
      renderMatchesList();
      await loadAndRenderMatch();
    });

    el("daySel").addEventListener("change", async () => {
      current.day = el("daySel").value;
      current.fixtureId = null;
      renderMatchesList();
      const list2 = filteredMatches();
      if (list2[0]?.fixtureId) current.fixtureId = list2[0].fixtureId;
      renderMatchesList();
      await renderRecommendation(current.day);
      await loadAndRenderMatch();
    });

    el("refreshBtn").addEventListener("click", async () => {
      current.fixtureId = null;
      await loadAll();
      renderLeagueSel();
      renderDaySel();
      renderMatchesList();
      const list2 = filteredMatches();
      if (list2[0]?.fixtureId) current.fixtureId = list2[0].fixtureId;
      renderMatchesList();
      await renderRecommendation(current.day);
      await loadAndRenderMatch();
    });

  } catch(e){
    setStatus(e.message || String(e), false);
  }
}

init();
