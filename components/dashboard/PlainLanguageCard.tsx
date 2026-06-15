import type { ScoreBreakdown } from "@/lib/scores/scoreBreakdown";

const regimeExplain: Record<string, string> = {
  避險模式: "目前市場偏防守，資金更謹慎，不太願意承擔風險。",
  通脹壓力偏高: "目前市場主要擔心物價和利率壓力。",
  風險偏好模式: "目前市場比較願意承擔風險，股票和信用資產較受支持。",
  高利率風險偏好環境: "市場願意冒險，但利率和美元壓力仍高。",
  高利率韌性環境: "經濟仍有韌性，但高利率限制估值。",
  再通脹交易: "市場在擔心物價、商品和長期利率重新上升。",
  衰退降息交易: "市場更擔心經濟轉弱，並期待未來降息。",
  "美元/流動性收緊模式": "美元和資金壓力偏高，風險資產容易承壓。",
  "商品/黃金強勢模式": "商品或黃金較強，可能來自周期或避險需求。",
  混合震盪模式: "市場方向不明，暫時不適合單邊押注。",
};

const scoreExplain: Record<string, { high: string; low: string; neutral: string }> = {
  liquidity_score: {
    high: "流動性較寬鬆，市場資金環境比較支持風險資產。",
    low: "流動性偏緊，代表市場資金環境沒有那麼友善。",
    neutral: "流動性信號不明顯，暫時不是主要推動因素。",
  },
  inflation_score: {
    high: "通脹壓力偏高，可能來自核心物價、能源價格或長期利率一起上升。",
    low: "通脹壓力回落，利率壓力相對沒那麼強。",
    neutral: "通脹壓力暫時中性。",
  },
  growth_score: {
    high: "增長仍有支撐，代表經濟數據暫時沒有明顯惡化。",
    low: "增長轉弱，代表經濟和就業數據開始變差。",
    neutral: "增長信號暫時不清楚。",
  },
  risk_appetite_score: {
    high: "風險偏好較強，代表市場比較願意冒險。",
    low: "風險偏好下降，代表市場不太願意冒險。",
    neutral: "風險偏好暫時中性。",
  },
  dollar_score: {
    high: "美元壓力升高，可能和風險偏好轉弱來自同一條資金收緊主線。",
    low: "美元壓力回落，對風險資產和非美資產比較友善。",
    neutral: "美元壓力暫時中性。",
  },
  credit_score: {
    high: "信用市場仍健康，代表企業債和風險資產壓力不大。",
    low: "信用環境轉弱，代表市場對企業債或風險資產變得更謹慎。",
    neutral: "信用環境暫時中性。",
  },
  commodity_score: {
    high: "商品週期改善，代表能源或工業金屬可能在支持週期交易。",
    low: "商品週期轉弱，代表銅和原油沒有確認週期改善；黃金偏強也可能只是避險。",
    neutral: "商品週期暫時中性。",
  },
};

function plainScoreLine(score: ScoreBreakdown): string {
  if (score.score === null || score.key === "china_score") return "中國宏觀數據尚未接入，目前不用作主要判斷。";
  const text = scoreExplain[score.key];
  if (!text) return `${score.nameZh}目前分數是 ${score.score.toFixed(1)}。`;
  if (score.score >= 2) return text.high;
  if (score.score <= -1) return text.low;
  return text.neutral;
}

function topScores(scores: ScoreBreakdown[]) {
  return scores
    .filter((score) => score.score !== null && score.key !== "china_score")
    .sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))
    .slice(0, 2);
}

function dailySignalText(confirmedRegime: string, rawRegimeSignal: string): string | null {
  if (confirmedRegime === rawRegimeSignal) return null;
  return `今日短期信號指向「${rawRegimeSignal}」，但正式狀態仍是「${confirmedRegime}」，還需要更多天數確認。`;
}

const easyWatchItems = [
  "美元是否繼續走強？如果美元和人民幣匯率壓力一起上升，通常代表市場避險情緒仍在。",
  "美債利率是否繼續上升？如果長期利率繼續升，股票和高估值資產可能會受壓。",
  "市場恐慌指數是否升高？如果 VIX 和信用利差一起上升，代表市場壓力增加。",
];

export function PlainLanguageCard({
  confirmedRegime,
  rawRegimeSignal,
  scoreBreakdowns,
}: {
  confirmedRegime: string;
  rawRegimeSignal: string;
  scoreBreakdowns: ScoreBreakdown[];
  watchNext: string[];
}) {
  const signal = dailySignalText(confirmedRegime, rawRegimeSignal);
  const why = topScores(scoreBreakdowns).map(plainScoreLine);
  const watch = easyWatchItems;

  return (
    <div className="dashboard-simple-only mt-4 rounded-lg border border-market-teal/20 bg-market-teal/10 p-4">
      <div className="text-sm font-semibold text-white">簡易解讀</div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">現在是什麼狀態？</div>
          <p className="mt-2 text-sm leading-6 text-slate-200">{regimeExplain[confirmedRegime] ?? "市場狀態較混合，需要觀察更多信號。"}</p>
          {signal ? <p className="mt-2 text-xs leading-5 text-amber-200">{signal}</p> : null}
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">為什麼？</div>
          <ul className="mt-2 space-y-1.5">
            {why.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-teal" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">普通人要留意什麼？</div>
          <ul className="mt-2 space-y-1.5">
            {watch.slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-blue" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
