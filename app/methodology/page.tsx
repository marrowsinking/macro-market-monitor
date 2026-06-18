const scoreDimensions = [
  {
    title: "Growth / 增長",
    body: "觀察經濟是否仍有基本面支撐，而不是單純看股市漲跌。",
    items: ["PAYEMS 非農就業", "UNRATE 失業率", "ICSA 初請失業金", "JTSJOL 職位空缺"],
  },
  {
    title: "Inflation / 通脹壓力",
    body: "用 group contribution 合成 CPI、PCE、能源與長端利率，避免同源指標重複加分。",
    items: ["Headline Inflation Group", "Core Inflation Group", "Energy Inflation Group", "Market Rate Group"],
  },
  {
    title: "Liquidity / 流動性",
    body: "觀察央行資產負債表、逆回購、短端利率與信用壓力形成的資金條件。",
    items: ["WALCL", "RRPONTSYD", "SOFR", "DGS2", "BAMLH0A0HYM2"],
  },
  {
    title: "Credit / 信用環境",
    body: "觀察企業融資與信用風險定價，主要用高收益債利差追蹤信用壓力。",
    items: ["High Yield Spread", "利差收窄", "利差擴大"],
  },
  {
    title: "NFCI Benchmark / 金融條件基準",
    body: "Chicago Fed NFCI 系列只作 benchmark / diagnostic，不直接進入 official score 或 regime。",
    items: ["NFCI", "ANFCI", "NFCIRISK", "NFCICREDIT", "NFCILEVERAGE"],
  },
  {
    title: "Dollar Pressure / 美元壓力",
    body: "觀察全球美元流動性壓力，不只是美元升跌本身。",
    items: ["DXY", "USDJPY", "USDCNY", "2Y Treasury", "SOFR"],
  },
  {
    title: "Risk Appetite / 風險偏好",
    body: "衡量市場是否願意承擔風險，VIX 與信用利差是核心，股指只作確認。",
    items: ["VIX", "High Yield Spread", "S&P 500", "Nasdaq 100"],
  },
  {
    title: "Commodity Cycle / 商品週期",
    body: "區分 growth-led commodities 與 defensive precious metals，避免把黃金上漲直接當成商品週期健康。",
    items: ["Copper", "Oil", "Gold", "Silver", "Gold/Silver Ratio"],
  },
  {
    title: "China Macro / 中國宏觀",
    body: "中國宏觀數據目前保留為後續擴展維度，未完整接入前不主導 regime 判斷。",
    items: ["China M2", "TSF", "PMI", "PPI", "CSI 300"],
  },
];

const flow = ["Raw Data", "Score", "Daily Signal", "Pending Regime", "Confirmed Regime", "Narrative / Dashboard"];

const calibrationItems = [
  "rolling z-score",
  "rolling percentile",
  "group contribution cap",
  "double-counting control",
  "data freshness",
  "confirmed regime stabilization",
];

const limitations = [
  "目前主要依賴免費數據源。",
  "部分宏觀數據更新頻率較低，CPI / PCE 等月度數據天然有延遲。",
  "目前未完整接入 consensus / surprise 數據。",
  "中國、歐洲、日本數據尚未完整接入。",
  "新聞目前應作為 context，不應直接改變 score。",
  "系統用於觀察與研究，不構成投資建議。",
  "Rule-based score 需要持續校準和回測。",
];

const roadmap = [
  "Inflation surprise",
  "Rolling z-score / percentile contribution",
  "Group contribution cap",
  "Double-counting control",
  "Market breadth",
  "Sector / ETF signals",
  "News context layer",
  "Regime history / transition timeline",
  "AI narrative as optional enhancement",
  "More global data: China / Europe / Japan / Korea",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-market-teal" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-lg border border-market-teal/20 bg-gradient-to-br from-market-teal/12 via-white/[0.03] to-market-blue/10 p-6">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-market-teal">Methodology / 方法論</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">半結構化 Macro Regime Framework</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            本系統不是黑箱 AI，也不是單純把所有指標加總成一個分數。它是一個半結構化的 macro regime framework，
            將市場狀態拆成增長、通脹壓力、流動性、信用環境、美元壓力、風險偏好、商品週期與中國宏觀等多個維度。
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            每個維度先獨立計分，再共同判斷目前的 macro regime。系統的目標不是預測市場，而是幫助使用者理解目前主要市場狀態、
            支持因素、矛盾信號、是否足以構成正式 regime 切換，以及下一步應觀察哪些指標。
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="理論基礎：為什麼使用多維度 Regime？">
          <p>
            傳統單一分數容易把不同經濟機制混在一起。現代宏觀市場同時受增長、通脹、流動性、美元、信用、風險偏好與商品等多條主線影響，
            真實市場也很少所有信號同向。
          </p>
          <BulletList items={["識別主要支持因素", "識別矛盾信號", "保留中性因子", "追蹤潛在轉折"]} />
          <p>
            本系統的設計更接近 macro factor attribution，而不是單純技術分析。它的概念與機構常用的 macro factor investing、
            financial conditions analysis、regime switching framework 有相似之處，但本項目採用 rule-based 與 rolling statistics
            的工程化方法，並不複製任何機構模型。
          </p>
        </Section>

        <Section title="Growth × Inflation：高層宏觀框架">
          <p>
            Growth 和 Inflation 是宏觀 regime 的兩個核心維度，很多資產的表現可被理解為對「增長」與「通脹」變化的反應。
          </p>
          <p>
            但現代市場不能只靠 Growth × Inflation，還需要加入 Liquidity、Dollar Pressure、Credit Conditions、Risk Appetite
            與 Commodity Cycle。Growth × Inflation 是本系統的上層宏觀坐標之一，但不是唯一判斷依據。
          </p>
        </Section>
      </div>

      <Section title="Daily Signal 與 Confirmed Regime">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <p>
              金融市場不是線性狀態，會在不同 regime 間切換。但每日市場數據很嘈雜，不能因一天 VIX、DXY、股指或信用利差變化，
              就立即改變正式 regime。
            </p>
            <BulletList
              items={[
                "dailySignal：每日即時信號，可以比較敏感。",
                "confirmedRegime：已確認宏觀狀態，需要多日確認。",
                "pendingRegime：潛在切換狀態，用來顯示確認進度。",
                "confirmedRegime 用來降低單日噪音，避免 regime 每天亂跳。",
              ]}
            />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              {flow.map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="rounded-full border border-market-teal/30 bg-market-teal/10 px-3 py-1 text-market-teal">{item}</span>
                  {index < flow.length - 1 ? <span className="text-slate-600">→</span> : null}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              例如「風險偏好模式確認中 1 / 3」、「確認中 2 / 3」，連續確認後才正式切換為 confirmedRegime。
            </p>
          </div>
        </div>
      </Section>

      <section className="panel rounded-lg p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Score Definition / 分數維度</h2>
            <p className="mt-2 text-sm text-slate-500">每個 score 先獨立描述一條宏觀機制，再共同進入 regime 判斷。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scoreDimensions.map((score) => (
            <div key={score.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">{score.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{score.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {score.items.map((item) => (
                  <span key={item} className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-slate-400">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Liquidity / 流動性">
          <p>
            流動性不是單純「市場有沒有錢」，而是央行資產負債表、逆回購、短端融資利率、funding conditions 與 credit stress 的綜合觀察。
          </p>
          <p>
            Fed Balance Sheet 上升通常代表流動性支持增加；Reverse Repo 下降可能代表閒置流動性釋放；SOFR / 2Y 美債上升可能代表短端資金成本上升；
            信用利差惡化會反映融資壓力。這些指標是流動性條件的觀察窗口，不是對股市漲跌的機械預測。
          </p>
        </Section>

        <Section title="Inflation / 通脹壓力">
          <p>
            通脹相關指標應避免重複加分。CPI、Core CPI、PCE、Core PCE 代表相近的通脹現象，因此更適合先在 group level 合成，
            再進入 inflation_score。
          </p>
          <BulletList
            items={[
              "Headline Inflation Group：CPI、PCE",
              "Core Inflation Group：Core CPI、Core PCE",
              "Energy Inflation Group：WTI Oil",
              "Market Rate Group：10Y Treasury Yield",
            ]}
          />
          <p>未來可加入 YoY、3-month annualized、surprise vs consensus、breakeven inflation 與 inflation expectations。</p>
        </Section>

        <Section title="Risk Appetite / 風險偏好">
          <p>
            風險偏好不是簡單看 S&P 500 或 Nasdaq 漲跌，而是看市場是否願意承擔風險。VIX 與信用利差應是核心信號，股指是 confirmation signal，
            不應過度主導。
          </p>
          <p>
            risk_appetite_score 與 dollar_score 可能高度相關，因此系統需要避免因美元走強導致股市下跌時，把同一條壓力重複計入兩次。
          </p>
        </Section>

        <Section title="Dollar Pressure / 美元壓力">
          <p>
            美元壓力不是單純看美元升跌，而是觀察全球美元流動性壓力。目前使用 DXY、USDJPY、USDCNY、2Y Treasury Yield、SOFR 與 High Yield Spread。
          </p>
          <p>
            美元走強常反映全球資金偏向美元；USDJPY / USDCNY 上升可反映非美貨幣壓力。USDCNY 目前作為人民幣壓力 proxy，因 Yahoo 的 CNH 長歷史資料不足。高美元壓力可能壓制商品、新興市場與風險資產，
            但 dollar_score 不等於投資建議，只是壓力觀察指標。
          </p>
        </Section>

        <Section title="Credit / 信用環境">
          <p>
            信用環境用來觀察市場對企業融資與信用風險的定價。目前主要使用 BAMLH0A0HYM2：High Yield Spread。
          </p>
          <p>
            利差收窄通常代表信用環境改善；利差擴大通常代表信用壓力上升。信用環境與風險偏好、流動性高度相關，但仍值得獨立觀察。
          </p>
        </Section>

        <Section title="NFCI Benchmark / 金融條件基準">
          <p>
            Chicago Fed NFCI、ANFCI、NFCIRISK、NFCICREDIT 與 NFCILEVERAGE 目前只作 debug benchmark 和 promotion audit，不直接參與 official Dashboard score、
            confirmed regime 或 alerts。
          </p>
          <p>
            NFCI 數值越高，代表金融條件相對平均水平越緊；NFCI 越低或為負，代表金融條件越寬鬆。因此對照方向需要反轉：
            liquidity_score 應對照 -NFCI，credit_score 應對照 -NFCICREDIT，risk_appetite_score 應對照 -NFCIRISK。
          </p>
        </Section>

        <Section title="Commodity Cycle / 商品週期">
          <p>
            商品週期不應把黃金、白銀、銅、原油全部視為同一類信號。銅和原油更能反映工業需求與 growth-led commodity cycle。
          </p>
          <p>
            黃金上升不一定代表商品週期健康，可能代表避險、通脹擔憂、實質利率下降或地緣風險。金銀比上升通常偏防守，不應直接推高 commodity_score。
            如果 Gold 上升但 Copper / Oil 沒有確認，應被視為 defensive signal 或 conflicting signal。
          </p>
        </Section>
      </div>

      <Section title="為什麼不能直接照搬歷史理論？">
        <p>
          歷史理論提供框架，但不應提供固定參數。現代市場受到央行資產負債表、財政赤字與期限溢價、全球美元流動性、ETF 與被動資金、
          AI / 科技股集中度、地緣政治、期權市場與波動率交易、高頻資金流等因素影響。
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-white">現代化校準方法</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {calibrationItems.map((item) => (
                <span key={item} className="rounded-full border border-market-blue/25 bg-market-blue/10 px-3 py-1 text-xs text-market-blue">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Z-score 的正確用法</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Z-score 可以衡量某個指標相對近期歷史是否異常：Z = (current value - rolling mean) / rolling standard deviation。
              但不同數據頻率應使用不同窗口，不應對所有指標一律使用 30 日 z-score。
            </p>
            <BulletList items={["高頻市場數據：30 / 60 / 120 日", "利率與信用：60 / 120 / 252 日", "月度宏觀數據：YoY、3-month annualized、surprise"]} />
          </div>
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="模型限制">
          <BulletList items={limitations} />
        </Section>

        <Section title="未來改進方向">
          <div className="grid gap-2 sm:grid-cols-2">
            {roadmap.map((item, index) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                <span className="mr-2 text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            AI narrative 應該只是輔助表達，不應成為核心判斷來源。核心判斷仍應來自可檢查的數據、分組貢獻、去重控制與 confirmed regime 機制。
          </p>
        </Section>
      </div>
    </div>
  );
}
