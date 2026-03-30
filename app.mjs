import {
  el,
  getJson,
  escapeHtml,
  fmtClock,
  fmtTime,
  fmtDateLocal,
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
  buildMatchRecommendationPair,
  getCandidatesForMatch,
  buildTwoWayRows,
  buildConfidenceModel,
  getRiskProfile,
  getRecommendationConfidence,
  buildDisplayedTickets,
  TICKET_CONFIGS
} from "./js/recommendations.mjs";

let UI = { index: null, leagues: [], matches: [], matchByFixtureId: new Map(), matchRecommendations: new Map(), matchRecommendationPairs: new Map() };
let HIST = null;
let current = { day: null, calendarMonth: null, leagueId: "all", fixtureId: null, ticketKey: "safe", view: "matches", leagueQuery: "" };
const EMPTY_LEAGUE_WINDOW_DAYS = 7;

const TEAM_DISPLAY_ALIASES = {
  "ACS Champions FC Arges": "FC Arges",
  "Fotbal Club FCSB": "FCSB",
  "FC CFR 1907 Cluj": "CFR Cluj",
  "Wolverhampton Wanderers": "Wolverhampton"
};

function leagueDisplayName(league) {
  if (!league) return "Liga selectata";
  return league.id === "all"
    ? league.name
    : league.categoryName ? `${formatCategoryName(league.categoryName)} • ${formatLeagueName(league.name)}` : formatLeagueName(league.name);
}

function formatLeagueName(name) {
  const raw = String(name || "").trim();
  const map = {
    "2. Bundesliga": "Bundesliga 2",
    "LaLiga 2": "LaLiga 2",
    "Ligue 2": "Ligue 2",
    "Serie B": "Serie B",
    "Championship": "Championship",
    "Division 1": "Division 1"
  };
  return map[raw] || raw;
}

function formatCategoryName(name) {
  const raw = String(name || "").trim();
  const map = {
    "Turkiye": "Turcia",
    "Turkey": "Turcia"
  };
  return map[raw] || raw;
}

function leagueSortRank(name) {
  const raw = String(name || "").trim();
  const lower = raw.toLowerCase();
  if (/premier league|bundesliga$|serie a$|laliga$|ligue 1$|eredivisie$|primeira liga$|liga portugal$|super lig$|super league$|superliga$|ekstraklasa$|hnl$|prvaliga$|nb i$|1\. liga$|allsvenskan$|eliteserien$|veikkausliiga$|liga profesional$|brasileiro serie a$|chinese super league$|premiership$|mls$/.test(lower)) return 0;
  if (/championship$|bundesliga 2$|2\. bundesliga$|serie b$|laliga 2$|ligue 2$|1\. liga$|i liga$|persha liga$|superettan$|division 1$/.test(lower)) return 1;
  return 2;
}

function displayTeamName(name) {
  const raw = String(name || "").trim();
  return TEAM_DISPLAY_ALIASES[raw] || raw || "?";
}

function getLeagueFutureMatchCount(leagueId) {
  if (!leagueId || leagueId === "all") return UI.matches.length;
  return UI.matches.filter((match) => String(match.tournamentId) === String(leagueId)).length;
}

function buildConfiguredLeagues(configIds = [], tournamentCatalog = [], liveLeagues = [], matches = []) {
  const liveById = new Map((liveLeagues || []).map((league) => [String(league.id ?? league.tournamentId), league]));
  const catalogById = new Map((tournamentCatalog || []).map((league) => [String(league.tournamentId ?? league.id), league]));
  const matchById = new Map();

  for (const match of matches || []) {
    if (!match?.tournamentId) continue;
    const id = String(match.tournamentId);
    if (!matchById.has(id)) {
      matchById.set(id, {
        id,
        name: match.tournamentName || "",
        categoryName: match.categoryName || ""
      });
    }
  }

  return Array.from(new Set((configIds || []).map(String).filter(Boolean)))
    .map((id) => {
      const live = liveById.get(id);
      const catalog = catalogById.get(id);
      const fromMatch = matchById.get(id);
      return {
        id,
        name: live?.name || live?.tournamentName || fromMatch?.name || catalog?.tournamentName || catalog?.name || `Liga ${id}`,
        categoryName: live?.categoryName || fromMatch?.categoryName || catalog?.categoryName || catalog?.countryName || ""
      };
    })
    .sort((a, b) => {
      const groupCmp = formatCategoryName(a.categoryName || "").localeCompare(formatCategoryName(b.categoryName || ""));
      if (groupCmp !== 0) return groupCmp;
      const rankCmp = leagueSortRank(a.name) - leagueSortRank(b.name);
      if (rankCmp !== 0) return rankCmp;
      return formatLeagueName(a.name).localeCompare(formatLeagueName(b.name));
    });
}

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

function getMatchRecommendationPair(fixtureId) {
  return UI.matchRecommendationPairs.get(String(fixtureId)) || { primary: null, secondary: null };
}

function marketFamilyLabel(recommendation) {
  if (!recommendation) return "N/A";
  if (recommendation.market === "1X2") return "1X2";
  if (recommendation.market === "BTTS") return "Ambele marcheaza";
  if (String(recommendation.market).startsWith("Goals ")) return "Goluri";
  if (String(recommendation.market).startsWith("Corners ")) return "Cornere";
  if (String(recommendation.market).startsWith("Cards ")) return "Cartonase";
  return recommendation.market;
}

function buildVarietyModel(matches) {
  const recommendations = matches.map((match) => getMatchRecommendation(match.fixtureId)).filter(Boolean);
  if (!recommendations.length) return { label: "Fara date", copy: "Momentan nu exista suficiente recomandari pentru a evalua varietatea zilei." };
  const counts = new Map();
  for (const recommendation of recommendations) {
    const family = marketFamilyLabel(recommendation);
    counts.set(family, (counts.get(family) || 0) + 1);
  }
  const families = counts.size;
  const total = recommendations.length || 1;
  const largestShare = Math.max(...counts.values()) / total;
  const label = families >= 4 && largestShare <= 0.55
    ? "Varietate ridicata"
    : families >= 3 && largestShare <= 0.72
      ? "Varietate buna"
      : "Varietate limitata";
  const copy = `${label} • ${families} tipuri de recomandari active. Dominanta maxima: ${Math.round(largestShare * 100)}%.`;
  return { label, copy };
}

function pickDefaultDay(days) {
  const list = Array.from(new Set(days || [])).sort();
  if (!list.length) return null;
  const today = nowLocal().toLocaleDateString("en-CA");
  return list.includes(today) ? today : list.find((day) => day >= today) || list[0];
}

function getAvailableDays() {
  return Array.from(new Set(UI.matches.map((match) => match.day).filter(Boolean))).sort();
}

function monthKeyFromDay(day) {
  return String(day || "").slice(0, 7);
}

function monthDateFromKey(monthKey) {
  return new Date(`${monthKey}-01T12:00:00Z`);
}

function formatMonthLabel(monthKey) {
  const date = monthDateFromKey(monthKey);
  if (Number.isNaN(date.getTime())) return "—";
  const label = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getCalendarMonths(days) {
  return Array.from(new Set((days || []).map((day) => monthKeyFromDay(day)).filter(Boolean))).sort();
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
    .filter((match) => {
      if (current.leagueId !== "all") return true;
      return !current.day || String(match.day) === String(current.day);
    })
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
  const leaguesObj = await getJson("./data/ui/leagues.json");
  const tournamentCatalog = await getJson("./data/oddspapi_tournaments.json");
  const tournamentConfig = await getJson("./scripts/oddspapi-tournament-ids.json");
  HIST = await getJson("./data/ui/history_stats.json");

  UI.matches = (matchesObj.matches || [])
    .map((match) => ({
      fixtureId: String(match.fixtureId),
      tournamentId: match.tournamentId != null ? String(match.tournamentId) : null,
      tournamentName: match.tournamentName || "",
      categoryName: match.categoryName || "",
      startTime: match.startTime,
      day: match.day,
      home: displayTeamName(match.home),
      away: displayTeamName(match.away),
      featuredMarkets: match.featuredMarkets || {},
      selectionIndex: match.selectionIndex || {}
    }))
    .filter((match) => isFutureMatch(match.startTime));

  const configuredIds = Array.isArray(tournamentConfig?.tournamentIds) ? tournamentConfig.tournamentIds : [];
  const configuredLeagues = buildConfiguredLeagues(
    configuredIds,
    Array.isArray(tournamentCatalog) ? tournamentCatalog : [],
    Array.isArray(leaguesObj?.leagues) ? leaguesObj.leagues : [],
    UI.matches
  );

  UI.leagues = [
    { id: "all", name: "Toate ligile", categoryName: "" },
    ...configuredLeagues
  ];

  UI.matchByFixtureId = new Map(UI.matches.map((match) => [String(match.fixtureId), match]));
  UI.matchRecommendationPairs = new Map(UI.matches.map((match) => [String(match.fixtureId), buildMatchRecommendationPair(match, getHistEntry)]));
  UI.matchRecommendations = new Map(UI.matches.map((match) => [String(match.fixtureId), getMatchRecommendationPair(match.fixtureId).primary || buildMatchRecommendation(match, getHistEntry)]));

  current.day = pickDefaultDay(UI.index.days) || UI.matches[0]?.day || null;
  current.leagueId = UI.leagues.some((league) => league.id === current.leagueId) ? current.leagueId : "all";
  setStatus("Ready");
}

function renderDaySel() {
  const days = getAvailableDays();
  if (!days.includes(current.day)) current.day = pickDefaultDay(days);
  const months = getCalendarMonths(days);
  if (!months.includes(current.calendarMonth)) current.calendarMonth = monthKeyFromDay(current.day) || months[0] || null;
  el("dayTriggerLabel").textContent = current.day ? fmtDayLong(current.day) : "Alege data";
  el("dayTriggerMeta").textContent = `${days.length} zile cu meciuri viitoare`;
  renderDayCalendar();
}

function closeDayMenu() {
  const shell = el("dayShell");
  const trigger = el("dayTrigger");
  const menu = el("dayMenu");
  shell?.classList.remove("open");
  trigger?.setAttribute("aria-expanded", "false");
  if (menu) menu.hidden = true;
}

function toggleDayMenu(forceOpen = null) {
  const shell = el("dayShell");
  const trigger = el("dayTrigger");
  const menu = el("dayMenu");
  const shouldOpen = forceOpen == null ? !shell?.classList.contains("open") : Boolean(forceOpen);
  shell?.classList.toggle("open", shouldOpen);
  trigger?.setAttribute("aria-expanded", String(shouldOpen));
  if (menu) menu.hidden = !shouldOpen;
}

function renderDayCalendar() {
  const grid = el("dayGrid");
  const monthLabel = el("dayMenuMonth");
  const prevBtn = el("dayPrevMonthBtn");
  const nextBtn = el("dayNextMonthBtn");
  if (!grid || !monthLabel || !prevBtn || !nextBtn) return;

  const days = getAvailableDays();
  const months = getCalendarMonths(days);
  const activeMonth = months.includes(current.calendarMonth) ? current.calendarMonth : (monthKeyFromDay(current.day) || months[0] || null);
  current.calendarMonth = activeMonth;

  grid.innerHTML = "";
  if (!activeMonth) {
    monthLabel.textContent = "Fara date";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  monthLabel.textContent = formatMonthLabel(activeMonth);
  const monthIndex = months.indexOf(activeMonth);
  prevBtn.disabled = monthIndex <= 0;
  nextBtn.disabled = monthIndex === -1 || monthIndex >= months.length - 1;

  const [yearStr, monthStr] = activeMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 12));
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const leadingSlots = (firstOfMonth.getUTCDay() + 6) % 7;
  const availableSet = new Set(days);
  const totalSlots = Math.ceil((leadingSlots + daysInMonth) / 7) * 7;

  for (let slot = 0; slot < totalSlots; slot += 1) {
    const dayNumber = slot - leadingSlots + 1;
    const cell = document.createElement(dayNumber >= 1 && dayNumber <= daysInMonth ? "button" : "div");
    cell.className = "day-cell";

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cell.classList.add("day-cell-empty");
      grid.appendChild(cell);
      continue;
    }

    const day = `${activeMonth}-${String(dayNumber).padStart(2, "0")}`;
    const isAvailable = availableSet.has(day);
    cell.type = "button";
    cell.textContent = String(dayNumber);
    cell.dataset.day = day;
    cell.classList.toggle("is-available", isAvailable);
    cell.classList.toggle("is-selected", day === current.day);
    if (!isAvailable) {
      cell.disabled = true;
    } else {
      cell.addEventListener("click", () => {
        current.day = day;
        current.fixtureId = null;
        closeDayMenu();
        renderDaySel();
        renderMatchesList();
        renderTicketVariants(current.day);
        goBackToMatches();
      });
    }
    grid.appendChild(cell);
  }
}

function renderLeagueSel() {
  const select = el("leagueSel");
  const menu = el("leagueMenuOptions");
  select.innerHTML = "";
  menu.innerHTML = "";

  const query = String(current.leagueQuery || "").trim().toLowerCase();
  const visibleLeagues = UI.leagues.filter((league) => {
    if (!query) return true;
    const haystack = `${formatCategoryName(league.categoryName || "")} ${formatLeagueName(league.name)} ${league.id === "all" ? "toate ligile" : ""}`.toLowerCase();
    return haystack.includes(query);
  });

  let currentGroup = null;
  for (const league of visibleLeagues) {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = leagueDisplayName(league);
    select.appendChild(option);

    const groupName = league.id === "all" ? "General" : (formatCategoryName(league.categoryName) || "Altele");
    if (groupName !== currentGroup) {
      currentGroup = groupName;
      const header = document.createElement("div");
      header.className = "league-group-label";
      header.textContent = groupName;
      menu.appendChild(header);
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "league-option";
    item.setAttribute("role", "option");
    item.dataset.leagueId = league.id;
    item.setAttribute("aria-selected", String(league.id === current.leagueId));
    item.classList.toggle("active", league.id === current.leagueId);
    const matchCount = getLeagueFutureMatchCount(league.id);
    const meta = league.id === "all"
      ? `${UI.leagues.length - 1} ligi configurate`
      : matchCount
        ? `${matchCount} meciuri viitoare`
        : `Fara meciuri in urmatoarele ${EMPTY_LEAGUE_WINDOW_DAYS} zile`;
    item.innerHTML = `
      <span class="league-option-copy">
        <span class="league-option-title">${escapeHtml(league.id === "all" ? league.name : formatLeagueName(league.name))}</span>
        <span class="league-option-subtitle">${escapeHtml(league.id === "all" ? "Toate ligile configurate in produs" : `${formatCategoryName(league.categoryName)} • ${meta}`)}</span>
      </span>
    `;
    item.addEventListener("click", () => {
      current.leagueId = league.id;
      select.value = league.id;
      closeLeagueMenu();
      renderLeagueSel();
      renderMatchesList();
      renderTicketVariants(current.day);
      goBackToMatches();
    });
    menu.appendChild(item);
  }

  if (!visibleLeagues.length) {
    const empty = document.createElement("div");
    empty.className = "league-empty";
    empty.textContent = "Nicio competitie nu corespunde cautarii.";
    menu.appendChild(empty);
  }

  select.value = current.leagueId || "all";
  updateLeagueTrigger();
}

function updateLeagueTrigger() {
  const league = UI.leagues.find((item) => item.id === current.leagueId) || UI.leagues[0];
  const label = leagueDisplayName(league);
  const matchCount = getLeagueFutureMatchCount(current.leagueId);
  const meta = current.leagueId === "all"
    ? `${UI.leagues.length - 1} ligi disponibile`
    : matchCount
      ? `${matchCount} meciuri viitoare`
      : `Fara meciuri in urmatoarele ${EMPTY_LEAGUE_WINDOW_DAYS} zile`;
  el("leagueTriggerLabel").textContent = label;
  el("leagueTriggerMeta").textContent = meta;
}

function closeLeagueMenu() {
  const shell = el("leagueShell");
  const trigger = el("leagueTrigger");
  const menu = el("leagueMenu");
  shell?.classList.remove("open");
  trigger?.setAttribute("aria-expanded", "false");
  if (menu) menu.hidden = true;
}

function toggleLeagueMenu(forceOpen = null) {
  const shell = el("leagueShell");
  const trigger = el("leagueTrigger");
  const menu = el("leagueMenu");
  const shouldOpen = forceOpen == null ? !shell?.classList.contains("open") : Boolean(forceOpen);
  shell?.classList.toggle("open", shouldOpen);
  trigger?.setAttribute("aria-expanded", String(shouldOpen));
  if (menu) menu.hidden = !shouldOpen;
  if (shouldOpen && menu) {
    const search = el("leagueSearchInput");
    if (search) {
      search.value = current.leagueQuery || "";
      setTimeout(() => search.focus(), 0);
    }
    const activeItem = menu.querySelector('.league-option.active');
    activeItem?.scrollIntoView({ block: "nearest" });
  }
}

function renderMatchesList() {
  const box = el("matchesList");
  const list = filteredMatches();
  box.innerHTML = "";

  el("dayMatchCount").textContent = String(list.length);
  el("dayHelper").textContent = current.leagueId === "all"
    ? (list.length
      ? `${fmtDayLong(current.day)} • ${list.length} meciuri in lista`
      : `${fmtDayLong(current.day)} • fara meciuri in filtrul curent`)
    : (list.length
      ? `${list.length} meciuri viitoare in liga selectata`
      : `Nu exista meciuri in urmatoarele ${EMPTY_LEAGUE_WINDOW_DAYS} zile pentru aceasta liga.`);

  const league = UI.leagues.find((item) => item.id === current.leagueId);
  const leagueLabel = current.leagueId === "all"
    ? "Toate ligile"
    : leagueDisplayName(league);

  el("matchesSubtitle").textContent = current.leagueId === "all"
    ? (list.length
      ? `${fmtDayLong(current.day)} • ${leagueLabel}`
      : `${fmtDayLong(current.day)} • niciun meci in filtrul curent`)
    : (list.length
      ? `${leagueLabel} • toate meciurile viitoare`
      : `${leagueLabel} • fara meciuri in urmatoarele ${EMPTY_LEAGUE_WINDOW_DAYS} zile`);
  const variety = buildVarietyModel(list);
  el("varietySubtitle").textContent = variety.copy;

  if (!list.length) {
    box.innerHTML = `<div class="reco-empty">${
      current.leagueId === "all"
        ? "Nu exista meciuri pentru combinatia de data si liga selectata."
        : `Nu exista meciuri in urmatoarele ${EMPTY_LEAGUE_WINDOW_DAYS} zile pentru aceasta liga.`
    }</div>`;
    return;
  }

  for (const match of list) {
    const recommendationPair = getMatchRecommendationPair(match.fixtureId);
    const recommendation = recommendationPair?.primary || null;
    const secondaryRecommendation = recommendationPair?.secondary || null;
    const confidence = recommendation?.confidence || getRecommendationConfidence(recommendation);
    const successPct = recommendation ? clamp(Math.round(recommendation.p * 100), 0, 100) : 0;
    const dangerPct = 100 - successPct;
    const secondarySuccessPct = secondaryRecommendation ? clamp(Math.round(secondaryRecommendation.p * 100), 0, 100) : 0;
    const secondaryDangerPct = 100 - secondarySuccessPct;
    const row = document.createElement("article");
    row.className = "match-row";
    row.innerHTML = `
      <div class="match-main">
        <div class="match-time">${escapeHtml(fmtClock(match.startTime))}</div>
        <div class="match-clubs">
          <div class="match-name">${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</div>
          <div class="match-date">${escapeHtml(fmtDateLocal(match.startTime))}</div>
          <div class="match-link">Deschide analiza meciului</div>
        </div>
      </div>
      <div class="league-chip">${escapeHtml(formatCategoryName(match.categoryName))} • ${escapeHtml(formatLeagueName(match.tournamentName))}</div>
      ${
        recommendation ? `
          <div class="reco-stack">
            <div class="reco-pill">
              <div class="reco-copy">
                <div class="reco-label">Best bet • ${escapeHtml(confidence.label)}</div>
                <div class="reco-pick">${escapeHtml(recommendation.displayLabel)}</div>
                <div class="reco-meter" aria-label="${escapeHtml(`${successPct}% sansa estimata`)}}">
                  <div class="reco-meter-bar">
                    <span class="reco-meter-safe" style="width:${successPct}%"></span>
                    <span class="reco-meter-risk" style="width:${dangerPct}%"></span>
                  </div>
                  <div class="reco-meter-label">${escapeHtml(`${successPct}% reusita estimata`)}</div>
                </div>
              </div>
              <div class="reco-odds">${fmtOdds(recommendation.bookOdds)}</div>
            </div>
            ${
              secondaryRecommendation ? `
                <div class="reco-pill reco-pill-secondary">
                  <div class="reco-copy">
                    <div class="reco-label reco-label-secondary">Plan B • alternativa</div>
                    <div class="reco-pick reco-pick-secondary">${escapeHtml(secondaryRecommendation.displayLabel)}</div>
                    <div class="reco-meter reco-meter-secondary" aria-label="${escapeHtml(`${secondarySuccessPct}% sansa estimata`)}}">
                      <div class="reco-meter-bar reco-meter-bar-secondary">
                        <span class="reco-meter-safe" style="width:${secondarySuccessPct}%"></span>
                        <span class="reco-meter-risk" style="width:${secondaryDangerPct}%"></span>
                      </div>
                      <div class="reco-meter-label reco-meter-label-secondary">${escapeHtml(`${secondarySuccessPct}% reusita estimata`)}</div>
                    </div>
                  </div>
                  <div class="reco-odds reco-odds-secondary">${fmtOdds(secondaryRecommendation.bookOdds)}</div>
                </div>
              ` : ``
            }
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

function renderExplainability(match, recommendation) {
  const explainRows = [];
  const altRows = [];

  if (recommendation) {
    explainRows.push({ label: "Piata aleasa", value: `${recommendation.displayLabel} • ${marketFamilyLabel(recommendation)}` });
    explainRows.push({ label: "Cota / probabilitate", value: `${fmtOdds(recommendation.bookOdds)} • ${pctRounded(recommendation.p)}` });
    explainRows.push({ label: "Sursa principala", value: recommendation.source === "history" ? "Istoric + cote curente" : "Structura cotelor curente" });
    if (Number.isFinite(recommendation.marketProbability)) {
      explainRows.push({ label: "Prob. piata", value: pctRounded(recommendation.marketProbability) });
    }
  }

  const alternatives = getCandidatesForMatch(match, getHistEntry, 0.52)
    .filter((candidate) => !recommendation || `${candidate.market}|${candidate.sel}` !== `${recommendation.market}|${recommendation.sel}`)
    .slice(0, 3);

  for (const candidate of alternatives) {
    altRows.push({
      label: candidate.displayLabel,
      value: `${fmtOdds(candidate.bookOdds)} • ${pctRounded(candidate.p)}`
    });
  }

  renderRows("explainRows", explainRows);
  renderRows("altPickRows", altRows);
}

function renderPrimaryPick(match, recommendation) {
  if (!recommendation) {
    el("primaryPick").textContent = "Fara recomandare principala";
    el("primaryPickMeta").textContent = "Meciul ramane disponibil pentru consultare, dar nu fortam o selectie fara suport bun.";
    el("primaryPickNote").textContent = "Poti verifica 1X2 si Ambele marcheaza sau reveni la lista principala pentru alte meciuri.";
    return;
  }
  const confidence = recommendation.confidence || getRecommendationConfidence(recommendation);
  el("primaryPick").textContent = recommendation.displayLabel;
  el("primaryPickMeta").textContent = `${fmtOdds(recommendation.bookOdds)} cota • ${pctRounded(recommendation.p)} sansa estimata • Incredere ${confidence.label}`;
  el("primaryPickNote").textContent = recommendation.reason || `${match.home} vs ${match.away}`;
}

function renderDetailHistory(entry) {
  const hs = entry?.homeStats;
  const as = entry?.awayStats;
  const sourceNote = entry?.footballDataId ? `Competitie sursa: ${entry.footballDataId}` : "Date istorice partiale pentru acest meci.";
  const formatHistoryValue = (value, digits = 2) => Number.isFinite(Number(value)) ? fmtNum(value, digits) : "—";
  const hasCornersData = (stats, side) => {
    if (!stats) return false;
    return side === "home"
      ? [stats.homeCornersFor, stats.homeCornersAgainst, stats.awayCornersFor, stats.awayCornersAgainst].some((v) => Number(v) > 0)
      : [stats.awayCornersFor, stats.awayCornersAgainst, stats.homeCornersFor, stats.homeCornersAgainst].some((v) => Number(v) > 0);
  };
  const hasCardsData = (stats, side) => {
    if (!stats) return false;
    return side === "home"
      ? [stats.homeYCFor, stats.homeYCAgainst, stats.awayYCFor, stats.awayYCAgainst].some((v) => Number(v) > 0)
      : [stats.awayYCFor, stats.awayYCAgainst, stats.homeYCFor, stats.homeYCAgainst].some((v) => Number(v) > 0);
  };
  const renderHistoryLine = (containerId, stats, side) => {
    const box = el(containerId);
    if (!box) return;
    if (!stats) {
      box.innerHTML = "";
      return;
    }
    const goalsFor = side === "home" ? stats.homeGF : stats.awayGF;
    const goalsAgainst = side === "home" ? stats.homeGA : stats.awayGA;
    const cornersFor = side === "home" ? stats.homeCornersFor : stats.awayCornersFor;
    const cardsFor = side === "home" ? stats.homeYCFor : stats.awayYCFor;
    const cornersValue = hasCornersData(stats, side) ? formatHistoryValue(cornersFor, 2) : "—";
    const cardsValue = hasCardsData(stats, side) ? formatHistoryValue(cardsFor, 2) : "—";

    box.innerHTML = `
        <div class="history-inline ${side === "home" ? "history-inline-home" : "history-inline-away"}">
        <div class="history-inline-cell">
          <span class="history-inline-k">Goluri marcate</span>
          <span class="history-inline-v">${escapeHtml(formatHistoryValue(goalsFor, 2))}</span>
        </div>
        <div class="history-inline-cell">
          <span class="history-inline-k">Goluri primite</span>
          <span class="history-inline-v">${escapeHtml(formatHistoryValue(goalsAgainst, 2))}</span>
        </div>
        <div class="history-inline-cell">
          <span class="history-inline-k">Cornere</span>
          <span class="history-inline-v">${escapeHtml(cornersValue)}</span>
        </div>
        <div class="history-inline-cell">
          <span class="history-inline-k">Cartonase</span>
          <span class="history-inline-v">${escapeHtml(cardsValue)}</span>
        </div>
      </div>
    `;
  };

  if (hs) {
    renderHistoryLine("histHome", hs, "home");
    el("histHomeNote").textContent = as ? sourceNote : `${sourceNote} • Forma gazdelor este disponibila, dar lipseste istoricul complet al oaspetilor.`;
  } else {
    renderHistoryLine("histHome", null, "home");
    el("histHomeNote").textContent = as
      ? "Forma gazdelor nu are inca suficient istoric valid in sursa curenta."
      : "Istoricul este partial pentru ambele echipe in sursa curenta.";
  }

  if (as) {
    renderHistoryLine("histAway", as, "away");
    el("histAwayNote").textContent = hs ? sourceNote : `${sourceNote} • Forma oaspetilor este disponibila, dar lipseste istoricul complet al gazdelor.`;
  } else {
    renderHistoryLine("histAway", null, "away");
    el("histAwayNote").textContent = hs
      ? "Forma oaspetilor nu are inca suficient istoric valid in sursa curenta."
      : "Istoricul este partial pentru ambele echipe in sursa curenta.";
  }
}

async function loadAndRenderMatch() {
  if (!current.fixtureId) return;

  const summary = getMatchSummary(current.fixtureId);
  const fixture = await getJson(`./data/ui/match/${current.fixtureId}.json`);
  const featuredMarkets = fixture.featuredMarkets || summary?.featuredMarkets || {};
  const entry = getHistEntry(current.fixtureId);
  const recommendation = getMatchRecommendation(current.fixtureId);
  const home = displayTeamName(fixture.home || summary?.home || "?");
  const away = displayTeamName(fixture.away || summary?.away || "?");

  el("matchTitle").textContent = `${home} vs ${away}`;
  el("matchMeta").textContent = `${formatCategoryName(fixture.categoryName || summary?.categoryName || "—")} • ${formatLeagueName(fixture.tournamentName || summary?.tournamentName || "—")} • ${fmtTime(fixture.startTime || summary?.startTime)}`;

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
  renderExplainability(summary || { fixtureId: current.fixtureId }, recommendation);
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
  closeDayMenu();
  closeLeagueMenu();
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

    el("dayTrigger").addEventListener("click", (event) => {
      event.stopPropagation();
      closeLeagueMenu();
      toggleDayMenu();
    });

    el("dayPrevMonthBtn").addEventListener("click", (event) => {
      event.stopPropagation();
      const months = getCalendarMonths(getAvailableDays());
      const idx = months.indexOf(current.calendarMonth);
      if (idx > 0) {
        current.calendarMonth = months[idx - 1];
        renderDayCalendar();
      }
    });

    el("dayNextMonthBtn").addEventListener("click", (event) => {
      event.stopPropagation();
      const months = getCalendarMonths(getAvailableDays());
      const idx = months.indexOf(current.calendarMonth);
      if (idx !== -1 && idx < months.length - 1) {
        current.calendarMonth = months[idx + 1];
        renderDayCalendar();
      }
    });

    el("leagueSel").addEventListener("change", async () => {
      current.leagueId = el("leagueSel").value;
      current.fixtureId = null;
      renderLeagueSel();
      renderMatchesList();
      renderTicketVariants(current.day);
      goBackToMatches();
    });

    el("leagueTrigger").addEventListener("click", (event) => {
      event.stopPropagation();
      closeDayMenu();
      toggleLeagueMenu();
    });

    el("leagueSearchInput")?.addEventListener("input", (event) => {
      current.leagueQuery = event.target.value || "";
      renderLeagueSel();
    });

    document.addEventListener("click", (event) => {
      const dayShell = el("dayShell");
      const shell = el("leagueShell");
      if (dayShell && !dayShell.contains(event.target)) {
        closeDayMenu();
      }
      if (shell && !shell.contains(event.target)) {
        closeLeagueMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDayMenu();
        closeLeagueMenu();
      }
    });

    el("refreshBtn").addEventListener("click", async () => {
      await refreshDataAndRender();
    });
  } catch (error) {
    setStatus(error.message || String(error), false);
  }
}

init();
