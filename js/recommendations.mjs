import {
  SAFE_THRESHOLD,
  MAX_TICKET_LEG_ODDS,
  MIN_MATCH_RECO_ODDS,
  IDEAL_MATCH_RECO_ODDS,
  GOALS_LINES,
  CORNERS_LINES,
  CARDS_LINES,
  TICKET_CONFIGS
} from "./config.mjs";
import { oddsFromProb, pctRounded, fmtOdds } from "./utils.mjs";
import { estGoals, estCorners, estCards, probBTTS, prob1X2, probTotalOver } from "./models.mjs";

function buildSelectionKeyFromPick(pick) {
  return `${String(pick.market)}|${String(pick.sel)}`;
}

function getBookSelection(match, market, sel) {
  if (!match?.selectionIndex) return null;
  return match.selectionIndex[buildSelectionKeyFromPick({ market, sel })] || null;
}

export function pickDisplayLabel(pick) {
  if (pick.market === "1X2") {
    return { HOME: "Victorie gazde", DRAW: "Egal", AWAY: "Victorie oaspeti" }[pick.sel] || "1X2";
  }
  if (pick.market === "BTTS") {
    return pick.sel === "YES" ? "Ambele marcheaza" : "BTTS - Nu";
  }

  const goalsMatch = String(pick.market).match(/^Goals (\d+(?:\.\d+)?)$/);
  if (goalsMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${goalsMatch[1]} goluri`;

  const cornersMatch = String(pick.market).match(/^Corners (\d+(?:\.\d+)?)$/);
  if (cornersMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${cornersMatch[1]} cornere`;

  const cardsMatch = String(pick.market).match(/^Cards (\d+(?:\.\d+)?)$/);
  if (cardsMatch) return `${pick.sel === "OVER" ? "Peste" : "Sub"} ${cardsMatch[1]} cartonase`;

  return `${pick.market} ${pick.sel}`;
}

function pickReasonText(pick) {
  if (pick.market === "1X2") {
    return {
      HOME: "Modelul de goluri favorizeaza echipa gazda.",
      DRAW: "Distributia de scor sugereaza un meci echilibrat.",
      AWAY: "Modelul ofera avantaj echipei oaspete."
    }[pick.sel] || "Selectie generata de modelul SAFE.";
  }
  if (pick.market === "BTTS") {
    return pick.sel === "YES"
      ? "Profil ofensiv compatibil pentru ambele echipe."
      : "Modelul vede sanse bune sa nu marcheze ambele.";
  }

  const market = String(pick.market);
  if (market.startsWith("Goals ")) {
    return pick.sel === "OVER"
      ? "Linia de goluri este sustinuta de ritmul ofensiv estimat."
      : "Modelul vede un total mai controlat de goluri.";
  }
  if (market.startsWith("Corners ")) {
    return pick.sel === "OVER"
      ? "Volumul de cornere proiectat depaseste linia bookmakerului."
      : "Ritmul de joc sugereaza mai putine cornere decat linia afisata.";
  }
  if (market.startsWith("Cards ")) {
    return pick.sel === "OVER"
      ? "Intensitatea estimata a jocului favorizeaza mai multe cartonase."
      : "Modelul anticipeaza un meci mai disciplinat.";
  }
  return "Selectie generata de modelul SAFE.";
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
    startTime: match.startTime,
    tournamentName: match.tournamentName || "",
    categoryName: match.categoryName || "",
    displayLabel: pickDisplayLabel({ market, sel }),
    reason: pickReasonText({ market, sel })
  };
}

export function getCandidatesForMatch(match, getHistEntry, minProbability = 0.58) {
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

export function buildMatchRecommendation(match, getHistEntry) {
  const candidates = getCandidatesForMatch(match, getHistEntry, 0.46)
    .filter((candidate) => Number.isFinite(candidate.bookOdds) && candidate.bookOdds <= MAX_TICKET_LEG_ODDS + 0.15);
  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => {
      const probabilityBoost = candidate.p * 2.6;
      const edgeBoost = Math.max(0, candidate.edge) * 2.1;
      const oddsDistancePenalty = Math.abs(candidate.bookOdds - IDEAL_MATCH_RECO_ODDS) * 0.9;
      const lowOddsPenalty = candidate.bookOdds < MIN_MATCH_RECO_ODDS ? (MIN_MATCH_RECO_ODDS - candidate.bookOdds) * 4.5 : 0;
      const highOddsPenalty = candidate.bookOdds > 1.55 ? (candidate.bookOdds - 1.55) * 1.4 : 0;
      const weakProbPenalty = candidate.p < 0.56 ? (0.56 - candidate.p) * 2.4 : 0;
      const score = probabilityBoost + edgeBoost - oddsDistancePenalty - lowOddsPenalty - highOddsPenalty - weakProbPenalty;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.candidate.p - a.candidate.p || b.candidate.edge - a.candidate.edge);

  return scored[0]?.candidate || candidates[0];
}

export function buildTwoWayRows(lines, lambdaTotal, noun) {
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

export function buildConfidenceModel(entry) {
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
    notes.push(`Cornere estimate in jur de ${corners.lt.toFixed(1)} pe meci.`);
  }
  if (cards) {
    signals.push(Math.max(probTotalOver(4.5, cards.lt), 1 - probTotalOver(4.5, cards.lt)));
    notes.push(`Cartonase estimate in jur de ${cards.lt.toFixed(1)} pe meci.`);
  }

  const score = signals.length ? signals.reduce((sum, value) => sum + value, 0) / signals.length : 0;
  const copy = score >= 0.72
    ? "Selectiile au un profil solid si un raport risc/recompensa bun."
    : score >= 0.62
      ? "Exista suport statistic rezonabil pentru cele mai bune piete."
      : "Meciul cere prudenta, dar pastreaza semnale utile pentru analiza.";

  if (!notes.length) notes.push("Analiza se bazeaza cu prioritate pe pietele pentru care istoricul recent este complet.");
  return { score, copy, notes: notes.slice(0, 3) };
}

export function getRiskProfile(avgP) {
  if (avgP >= 0.74) return { label: "Scazut", note: "Bilet echilibrat din selectii foarte solide." };
  if (avgP >= 0.66) return { label: "Controlat", note: "Raport bun risc/recompensa pe piata curenta." };
  return { label: "Mediu", note: "Necesita prudenta, dar pastreaza logica de model." };
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

function buildTicketForTarget(matches, getHistEntry, config, exclusions = {}) {
  const target = config.target;
  const excludedFixtureIds = exclusions.excludedFixtureIds || new Set();
  const excludedSelectionKeys = exclusions.excludedSelectionKeys || new Set();
  const optionGroups = matches
    .map((match) => {
      if (excludedFixtureIds.has(String(match.fixtureId))) return null;
      const options = getCandidatesForMatch(match, getHistEntry, 0.52)
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

export function buildDisplayedTickets(matches, getHistEntry) {
  const renderedTickets = new Map();
  const usedFixtureIds = new Set();
  const usedSelectionKeys = new Set();

  for (const config of TICKET_CONFIGS) {
    let ticket = buildTicketForTarget(matches, getHistEntry, config, { excludedFixtureIds: usedFixtureIds, excludedSelectionKeys: usedSelectionKeys });
    if (!ticket) {
      ticket = buildTicketForTarget(matches, getHistEntry, config);
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

export { TICKET_CONFIGS };
