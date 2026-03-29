import {
  el,
  getJson,
  escapeHtml,
  fmtClock,
  fmtTime,
  fmtDayLong,
  pctRounded,
  pct01,
  clamp,
  fmtNum,
  fmtOdds
} from "./js/utils.mjs";
import { rowsFromFeaturedMarket, estGoals, estCorners, estCards } from "./js/models.mjs";
import {
  buildMatchRecommendation,
  buildTwoWayRows,
  buildConfidenceModel,
  getRiskProfile,
  buildDisplayedTickets,
  TICKET_CONFIGS
} from "./js/recommendations.mjs";

let UI = { index: null, leagues: [], matches: [], matchByFixtureId: new Map(), matchRecommendations: new Map() };
let HIST = null;
let current = { day: null, leagueId: "all", fixtureId: null, ticketKey: "safe", view: "matches" };

function nowLocal() {
  return new Date();
}

function isFutureMatch(startTime) {
  if (!startTime) return false;
  const kickoff = new Date(startTime);
  if (Number.isNaN(kickoff.getTime())) return false;
  return kickoff.getTime() >= nowLocal().getTime();
}

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
  const today = nowLocal().toLocaleDateString("en-CA");
  return list.includes(today) ? today : list.find((day) => day >= today) || list[0];
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

  UI.matches = (matchesObj.matches || [])
    .map((match) => ({
      fixtureId: String(match.fixtureId),
      tournamentId: match.tournamentId != null ? String(match.tournamentId) : null,
      tournamentName: match.tournamentName || "",
      categoryName: match.categoryName || "",
      startTime: match.startTime,
      day: match.day,
      home: match.home || "?",
      away: match.away || "?",
      featuredMarkets: match.featuredMarkets || {},
      selectionIndex: match.selectionIndex || {}
    }))
    .filter((match) => isFutureMatch(match.startTime));

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
  UI.matchRecommendations = new Map(UI.matches.map((match) => [String(match.fixtureId), buildMatchRecommendation(match, getHistEntry)]));

  current.day = pickDefaultDay(UI.index.days) || UI.matches[0]?.day || null;
  current.leagueId = UI.leagues.some((league) => league.id === current.leagueId) ? current.leagueId : "all";
  setStatus("Ready");
}

function renderDaySel() {
  const input = el("daySel");
  const days = Array.from(new Set(UI.matches.map((match) => match.day).filter(Boolean))).sort();
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
    : `${fmtDayLong(current.day)} • fara meciuri pentru filtrul curent`;

  const league = UI.leagues.find((item) => item.id === current.leagueId);
  const leagueLabel = current.leagueId === "all"
    ? "Toate ligile"
    : league?.categoryName ? `${league.categoryName} • ${league.name}` : league?.name || "Liga selectata";

  el("matchesSubtitle").textContent = list.length
    ? `${fmtDayLong(current.day)} • ${leagueLabel}`
    : `${fmtDayLong(current.day)} • nicio partida in filtrul curent`;

  if (!list.length) {
    box.innerHTML = `<div class="reco-empty">Nu exista meciuri pentru combinatia de data si liga selectata.</div>`;
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
          <div class="match-link">Click pentru analiza completa a meciului</div>
        </div>
      </div>
      <div class="league-chip">${escapeHtml(match.categoryName)} • ${escapeHtml(match.tournamentName)}</div>
      ${
        recommendation ? `
          <div class="reco-pill">
            <div class="reco-copy">
              <div class="reco-label">Best bet</div>
              <div class="reco-pick">${escapeHtml(recommendation.displayLabel)}</div>
              <div class="reco-meter" aria-label="${escapeHtml(`${successPct}% sansa estimata`)}}">
                <div class="reco-meter-bar">
                  <span class="reco-meter-safe" style="width:${successPct}%"></span>
                  <span class="reco-meter-risk" style="width:${dangerPct}%"></span>
                </div>
                <div class="reco-meter-label">${escapeHtml(`${successPct}% sansa estimata`)}</div>
              </div>
            </div>
            <div class="reco-odds">${fmtOdds(recommendation.bookOdds)}</div>
          </div>
        ` : `
          <div class="reco-empty">Momentan lipsesc suficiente date pentru o recomandare de incredere.</div>
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
    el("primaryPick").textContent = "Fara recomandare principala";
    el("primaryPickMeta").textContent = "Meciul ramane disponibil pentru consultare, dar nu fortam o selectie fara suport bun.";
    el("primaryPickNote").textContent = "Poti verifica 1X2 si BTTS sau reveni la lista principala pentru alte meciuri.";
    return;
  }
  el("primaryPick").textContent = recommendation.displayLabel;
  el("primaryPickMeta").textContent = `${fmtOdds(recommendation.bookOdds)} cota • ${pctRounded(recommendation.p)} sansa estimata`;
  el("primaryPickNote").textContent = recommendation.reason || `${match.home} vs ${match.away}`;
}

function renderDetailHistory(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;

  if (hs) {
    renderRows("histHome", [
      { label: `Meciuri acasa (ultimele ${HIST.lookback || 5})`, value: String(hs.homeMatches ?? "—") },
      { label: "Goluri marcate", value: fmtNum(hs.homeGF, 2) },
      { label: "Goluri primite", value: fmtNum(hs.homeGA, 2) },
      { label: "Cornere create", value: fmtNum(hs.homeCornersFor, 2) },
      { label: "Cartonase primite", value: fmtNum(hs.homeYCFor, 2) }
    ]);
    el("histHomeNote").textContent = entry.footballDataId ? `Competitie sursa: ${entry.footballDataId}` : "";
  } else {
    renderRows("histHome", []);
    el("histHomeNote").textContent = "Istoricul gazdelor nu este disponibil pentru acest meci.";
  }

  if (as) {
    renderRows("histAway", [
      { label: `Meciuri in deplasare (ultimele ${HIST.lookback || 5})`, value: String(as.awayMatches ?? "—") },
      { label: "Goluri marcate", value: fmtNum(as.awayGF, 2) },
      { label: "Goluri primite", value: fmtNum(as.awayGA, 2) },
      { label: "Cornere create", value: fmtNum(as.awayCornersFor, 2) },
      { label: "Cartonase primite", value: fmtNum(as.awayYCFor, 2) }
    ]);
    el("histAwayNote").textContent = entry.footballDataId ? `Competitie sursa: ${entry.footballDataId}` : "";
  } else {
    renderRows("histAway", []);
    el("histAwayNote").textContent = "Istoricul oaspetilor nu este disponibil pentru acest meci.";
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

  renderPrimaryPick(summary, recommendation);
  renderRows("market1x2", rowsFromFeaturedMarket(featuredMarkets.ft1x2, "ft1x2", fmtOdds));
  renderRows("marketBtts", rowsFromFeaturedMarket(featuredMarkets.btts, "btts", fmtOdds));

  const goals = estGoals(entry);
  const corners = estCorners(entry);
  const cards = estCards(entry);

  const goalsRows = goals ? buildTwoWayRows([1.5, 2.5, 3.5, 4.5], goals.lt, "goluri") : [];
  const cornersRows = corners ? buildTwoWayRows([8.5, 9.5, 10.5], corners.lt, "cornere") : [];
  const cardsRows = cards ? buildTwoWayRows([3.5, 4.5, 5.5], cards.lt, "cartonase") : [];

  renderRows("goalsQuickRows", goalsRows);
  renderRows("cornersQuickRows", cornersRows);
  renderRows("cardsQuickRows", cardsRows);

  setCardVisibility("goalsCard", goalsRows);
  setCardVisibility("cornersCard", cornersRows, "cornersHint", corners ? `Media estimata ${corners.lt.toFixed(2)} / meci` : "");
  setCardVisibility("cardsCard", cardsRows, "cardsHint", cards ? `Media estimata ${cards.lt.toFixed(2)} / meci` : "");

  renderConfidence(entry);
  renderDetailHistory(entry);
}

function renderTicketVariants(day) {
  const tabs = el("ticketTabs");
  const viewer = el("ticketViewer");
  tabs.innerHTML = "";
  viewer.innerHTML = "";

  const matches = filteredMatches();
  const recommendations = matches.map((match) => getMatchRecommendation(match.fixtureId)).filter(Boolean);

  el("recSub").textContent = `${fmtDayLong(day)} • ${recommendations.length} selectii disponibile pentru bilete`;

  if (!recommendations.length) {
    viewer.innerHTML = `<div class="ticket-empty">Nu exista suficiente recomandari solide pentru a construi bilete in filtrul curent.</div>`;
    return;
  }

  const renderedTickets = buildDisplayedTickets(matches, getHistEntry);
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
          <div class="ticket-kicker">Bilet tinta</div>
          <div class="ticket-name">${escapeHtml(config.name)}</div>
          <div class="ticket-desc">${escapeHtml(config.desc)}</div>
        </div>
        <div class="ticket-target">
          <span class="ticket-target-label">Tinta</span>
          <span class="ticket-target-value">${fmtOdds(config.target)}</span>
        </div>
      </div>
      <div class="ticket-empty">Nu am gasit o combinatie suficient de solida pentru aceasta tinta in filtrul curent.</div>
    `;
    viewer.appendChild(article);
    return;
  }

  const risk = getRiskProfile(ticket.avgP);
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
        <div class="ticket-kicker">Bilet tinta</div>
        <div class="ticket-name">${escapeHtml(config.name)}</div>
        <div class="ticket-desc">${escapeHtml(config.desc)}</div>
      </div>
      <div class="ticket-target">
        <span class="ticket-target-label">Tinta / obtinut</span>
        <span class="ticket-target-value">${fmtOdds(ticket.totalOdds)}</span>
      </div>
    </div>

    <div class="ticket-stats">
      <article class="ticket-stat total-stat">
        <div class="stat-label">Tinta</div>
        <div class="stat-value">${fmtOdds(config.target)}</div>
        <div class="stat-copy">Apropiere ${pctRounded(Math.max(0, 1 - ticket.closeness))}</div>
      </article>
      <article class="ticket-stat">
        <div class="stat-label">Prob. medie</div>
        <div class="stat-value">${pctRounded(ticket.avgP)}</div>
        <div class="stat-copy">${escapeHtml(risk.label)} • selectii sub 1.60</div>
      </article>
      <article class="ticket-stat">
        <div class="stat-label">Prob. bilet</div>
        <div class="stat-value">${pctRounded(ticket.combinedProbability)}</div>
        <div class="stat-copy">${escapeHtml(risk.note)}</div>
      </article>
    </div>

    <div class="ticket-picks">${picksMarkup}</div>
    <div class="ticket-cta-note">Biletul este afisat informativ, pe baza cotelor si selectiilor disponibile in sursa de date curenta.</div>
  `;
  viewer.appendChild(article);
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

    el("dayShell").addEventListener("click", () => {
      const input = el("daySel");
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
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
