const UI_SCHEMA_VERSION = 2;

const FEATURED_MARKET_DEFINITIONS = {
  ft1x2: {
    key: "ft1x2",
    label: "1X2 (FT)",
    marketId: "10137",
    outcomes: [
      { key: "HOME", label: "Home", outcomeId: "10137" },
      { key: "DRAW", label: "Draw", outcomeId: "10138" },
      { key: "AWAY", label: "Away", outcomeId: "10139" }
    ]
  },
  btts: {
    key: "btts",
    label: "BTTS",
    marketId: "104",
    outcomes: [
      { key: "YES", label: "Yes", outcomeId: "104" },
      { key: "NO", label: "No", outcomeId: "105" }
    ]
  }
};

const RECOMMENDATION_MARKET_DEFINITIONS = [
  {
    market: "BTTS",
    selection: "YES",
    label: "BTTS YES",
    marketId: "104",
    outcomeId: "104"
  },
  {
    market: "BTTS",
    selection: "NO",
    label: "BTTS NO",
    marketId: "104",
    outcomeId: "105"
  },
  {
    market: "Goals 1.5",
    selection: "OVER",
    label: "Goals 1.5 OVER",
    marketId: "108",
    outcomeId: "108"
  },
  {
    market: "Goals 1.5",
    selection: "UNDER",
    label: "Goals 1.5 UNDER",
    marketId: "108",
    outcomeId: "109"
  },
  {
    market: "Goals 2.5",
    selection: "OVER",
    label: "Goals 2.5 OVER",
    marketId: "1010",
    outcomeId: "1010"
  },
  {
    market: "Goals 2.5",
    selection: "UNDER",
    label: "Goals 2.5 UNDER",
    marketId: "1010",
    outcomeId: "1011"
  },
  {
    market: "Goals 3.5",
    selection: "OVER",
    label: "Goals 3.5 OVER",
    marketId: "1012",
    outcomeId: "1012"
  },
  {
    market: "Goals 3.5",
    selection: "UNDER",
    label: "Goals 3.5 UNDER",
    marketId: "1012",
    outcomeId: "1013"
  },
  {
    market: "Goals 4.5",
    selection: "OVER",
    label: "Goals 4.5 OVER",
    marketId: "1014",
    outcomeId: "1014"
  },
  {
    market: "Goals 4.5",
    selection: "UNDER",
    label: "Goals 4.5 UNDER",
    marketId: "1014",
    outcomeId: "1015"
  }
];

function buildSelectionKey(market, selection) {
  return `${String(market)}|${String(selection)}`;
}

function indexMarkets(rawMarkets) {
  const marketsById = new Map();

  for (const market of rawMarkets || []) {
    if (!market || market.marketId == null) continue;

    const outcomesById = new Map();
    for (const outcome of market.outcomes || []) {
      if (!outcome || outcome.outcomeId == null) continue;
      outcomesById.set(String(outcome.outcomeId), outcome);
    }

    marketsById.set(String(market.marketId), {
      ...market,
      outcomesById
    });
  }

  return marketsById;
}

function normalizeFeaturedMarket(marketsById, definition) {
  const market = marketsById.get(String(definition.marketId));
  if (!market) return null;

  return {
    key: definition.key,
    label: definition.label,
    marketId: String(definition.marketId),
    bookmakerMarketId: market.bookmakerMarketId ?? null,
    outcomes: definition.outcomes.map((outcomeDef) => {
      const outcome = market.outcomesById.get(String(outcomeDef.outcomeId)) || null;
      return {
        key: outcomeDef.key,
        label: outcomeDef.label,
        outcomeId: String(outcomeDef.outcomeId),
        price: outcome?.price ?? null,
        changedAt: outcome?.changedAt ?? null
      };
    })
  };
}

function buildFeaturedMarkets(rawMarkets) {
  const marketsById = indexMarkets(rawMarkets);
  return {
    ft1x2: normalizeFeaturedMarket(marketsById, FEATURED_MARKET_DEFINITIONS.ft1x2),
    btts: normalizeFeaturedMarket(marketsById, FEATURED_MARKET_DEFINITIONS.btts)
  };
}

function buildSelectionIndex(rawMarkets) {
  const marketsById = indexMarkets(rawMarkets);
  const out = {};

  for (const definition of RECOMMENDATION_MARKET_DEFINITIONS) {
    const market = marketsById.get(String(definition.marketId));
    const outcome = market?.outcomesById.get(String(definition.outcomeId)) || null;

    out[buildSelectionKey(definition.market, definition.selection)] = {
      market: definition.market,
      selection: definition.selection,
      label: definition.label,
      marketId: String(definition.marketId),
      outcomeId: String(definition.outcomeId),
      bookmakerMarketId: market?.bookmakerMarketId ?? null,
      price: outcome?.price ?? null,
      changedAt: outcome?.changedAt ?? null
    };
  }

  return out;
}

module.exports = {
  UI_SCHEMA_VERSION,
  buildFeaturedMarkets,
  buildSelectionIndex,
  buildSelectionKey
};
