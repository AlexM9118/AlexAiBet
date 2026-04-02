const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = process.cwd();
const WINDOW_DAYS = 7;
const DISPLAY_ALIASES = {
  "ACS Champions FC Arges": "FC Arges",
  "Fotbal Club FCSB": "FCSB",
  "FC CFR 1907 Cluj": "CFR Cluj",
  "Wolverhampton Wanderers": "Wolverhampton"
};

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function fmtDay(day) {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date(`${day}T12:00:00`));
  } catch {
    return day;
  }
}

function displayTeam(name) {
  const raw = String(name || "").trim();
  return DISPLAY_ALIASES[raw] || raw;
}

function buildRecentDays(windowDays = WINDOW_DAYS) {
  const out = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - offset);
    out.push(date.toLocaleDateString("en-CA"));
  }
  return out;
}

function buildHistoryLookup(historyStats) {
  const byFixtureId = historyStats?.byFixtureId || {};
  return (fixtureId) => byFixtureId[String(fixtureId)] || null;
}

function toUiMatch(match) {
  return {
    fixtureId: String(match.fixtureId),
    tournamentId: match.tournamentId != null ? String(match.tournamentId) : null,
    tournamentName: match.tournamentName || "",
    categoryName: match.categoryName || "",
    startTime: match.startTime,
    day: match.day,
    home: displayTeam(match.home),
    away: displayTeam(match.away),
    featuredMarkets: match.featuredMarkets || {},
    selectionIndex: match.selectionIndex || {}
  };
}

function finiteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseScoreString(value) {
  const match = String(value || "").match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!match) return null;
  return { homeScore: Number(match[1]), awayScore: Number(match[2]) };
}

function normalizeFinishedFixture(entry) {
  if (!entry?.fixtureId) return null;

  let homeScore = finiteNumber(entry.homeScore);
  let awayScore = finiteNumber(entry.awayScore);

  if (homeScore == null) homeScore = finiteNumber(entry.participant1Score);
  if (awayScore == null) awayScore = finiteNumber(entry.participant2Score);

  if (homeScore == null || awayScore == null) {
    const parsed = parseScoreString(entry.score || entry.result);
    if (parsed) {
      homeScore = homeScore ?? parsed.homeScore;
      awayScore = awayScore ?? parsed.awayScore;
    }
  }

  return {
    fixtureId: String(entry.fixtureId),
    statusId: finiteNumber(entry.statusId),
    homeScore,
    awayScore
  };
}

function buildFinishedLookup() {
  const lookup = new Map();
  const files = [
    "data/oddspapi_recent_fixtures.json",
    "data/oddspapi_fixtures_smoke.json"
  ];

  for (const file of files) {
    const payload = readJson(file, []);
    if (!Array.isArray(payload)) continue;
    for (const row of payload) {
      const normalized = normalizeFinishedFixture(row);
      if (!normalized) continue;
      lookup.set(normalized.fixtureId, normalized);
    }
  }

  return lookup;
}

function evaluatePick(pick, finished, kickOff) {
  if (!pick) {
    return {
      outcome: "missing",
      resultLabel: "Fara recomandare",
      resultShort: "—"
    };
  }

  if (!finished) {
    const kickoffTime = new Date(kickOff || "");
    const startedLongAgo = Number.isFinite(kickoffTime.getTime()) && kickoffTime.getTime() < (Date.now() - (4 * 60 * 60 * 1000));
    return {
      outcome: startedLongAgo ? "pending" : "pending",
      resultLabel: startedLongAgo ? "Scor final indisponibil" : "In asteptare",
      resultShort: "—"
    };
  }

  if (finished.statusId === 2 && finished.homeScore != null && finished.awayScore != null) {
    const homeScore = finished.homeScore;
    const awayScore = finished.awayScore;
    const totalGoals = homeScore + awayScore;
    const scoreline = `${homeScore}-${awayScore}`;

    if (pick.market === "1X2") {
      const won =
        (pick.sel === "HOME" && homeScore > awayScore) ||
        (pick.sel === "DRAW" && homeScore === awayScore) ||
        (pick.sel === "AWAY" && homeScore < awayScore);
      return { outcome: won ? "win" : "loss", resultLabel: won ? "Corect" : "Gresit", resultShort: scoreline };
    }

    if (pick.market === "Double Chance") {
      const won =
        (pick.sel === "1X" && homeScore >= awayScore) ||
        (pick.sel === "12" && homeScore !== awayScore) ||
        (pick.sel === "X2" && homeScore <= awayScore);
      return { outcome: won ? "win" : "loss", resultLabel: won ? "Corect" : "Gresit", resultShort: scoreline };
    }

    if (pick.market === "BTTS") {
      const yes = homeScore > 0 && awayScore > 0;
      const won = (pick.sel === "YES" && yes) || (pick.sel === "NO" && !yes);
      return { outcome: won ? "win" : "loss", resultLabel: won ? "Corect" : "Gresit", resultShort: scoreline };
    }

    const goalsMatch = String(pick.market).match(/^Goals (\d+(?:\.\d+)?)$/);
    if (goalsMatch) {
      const line = Number(goalsMatch[1]);
      const won = pick.sel === "OVER" ? totalGoals > line : totalGoals < line;
      return { outcome: won ? "win" : "loss", resultLabel: won ? "Corect" : "Gresit", resultShort: scoreline };
    }

    return {
      outcome: "ungraded",
      resultLabel: "Piata neevaluata",
      resultShort: scoreline
    };
  }

  return {
    outcome: "pending",
    resultLabel: "In asteptare",
    resultShort: "—"
  };
}

function summarise(items) {
  const summary = {
    total: items.length,
    wins: 0,
    losses: 0,
    pending: 0,
    ungraded: 0,
    missing: 0
  };

  for (const item of items) {
    if (item.outcome === "win") summary.wins += 1;
    else if (item.outcome === "loss") summary.losses += 1;
    else if (item.outcome === "missing") summary.missing += 1;
    else if (item.outcome === "ungraded") summary.ungraded += 1;
    else summary.pending += 1;
  }

  return summary;
}

async function main() {
  const matchesPayload = readJson("data/ui/matches.json", { matches: [] });
  const historyStats = readJson("data/ui/history_stats.json", { byFixtureId: {} });
  const finishedLookup = buildFinishedLookup();
  const getHistEntry = buildHistoryLookup(historyStats);
  const { buildMatchRecommendationPair } = await import(pathToFileURL(path.join(ROOT, "js", "recommendations.mjs")).href);

  const today = new Date().toLocaleDateString("en-CA");
  const recentDays = buildRecentDays(WINDOW_DAYS);
  const archiveDays = recentDays.filter((day) => day <= today);
  const itemsByDay = {};
  const summaryByDay = {};

  const matches = Array.isArray(matchesPayload?.matches) ? matchesPayload.matches : [];

  for (const day of archiveDays) {
    const items = matches
      .filter((match) => String(match.day) === day)
      .map((match) => toUiMatch(match))
      .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
      .map((match) => {
        const pair = buildMatchRecommendationPair(match, getHistEntry) || { primary: null };
        const primary = pair.primary || null;
        const finished = finishedLookup.get(String(match.fixtureId)) || null;
        const verdict = evaluatePick(primary, finished, match.startTime);

        return {
          fixtureId: String(match.fixtureId),
          match: `${match.home} vs ${match.away}`,
          home: match.home,
          away: match.away,
          league: [match.categoryName, match.tournamentName].filter(Boolean).join(" • "),
          kickOff: match.startTime,
          pick: primary?.displayLabel || "Fara recomandare",
          odds: finiteNumber(primary?.bookOdds),
          confidence: finiteNumber(primary?.confidence?.score),
          confidenceLabel: primary?.confidence?.label || null,
          source: primary?.source || null,
          outcome: verdict.outcome,
          resultLabel: verdict.resultLabel,
          resultShort: verdict.resultShort
        };
      });

    itemsByDay[day] = items;
    summaryByDay[day] = summarise(items);
  }

  const out = {
    generatedAtUTC: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    days: archiveDays,
    itemsByDay,
    summaryByDay
  };

  fs.writeFileSync(path.join(ROOT, "data", "ui", "history_archive_index.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`Saved data/ui/history_archive_index.json days=${archiveDays.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
