# SYSTEMATIC STRATEGY VALIDATION AND RISK-ADJUSTED PERFORMANCE ATTRIBUTION
## Quantitative Strategy Research & Backtesting Framework

**Candidate Profile:** Quantitative Research & Portfolio Strategies Trainee
**Target Institution:** D+A Strategies, Dubai (UAE)
**Document Classification:** Academic Research Note & System Specifications

---

## 1. Executive Summary

This research note details the mathematical framework, architectural specifications, and empirical validation methodologies of the **Quantitative Strategy Research & Backtesting Platform**. Designed as a robust research environment for systematic equities and digital asset portfolios, the platform prioritizes analytical rigor, execution friction modeling, and temporal validation over naive backtesting loops.

By implementing strict **out-of-sample chronological partitioning**, **rolling walk-forward optimizations (WFO)**, and **bootstrapped Monte Carlo tail-risk simulations**, this framework addresses the three primary structural failure modes of systematic strategies: parameter overfitting, data leakage, and regimes instability.

---

## 2. Core Mathematical Specifications

All statistical, risk, and attribution metrics are calculated via vector-aligned array manipulations on closed-interval, chronological series.

### 2.1 Compounded Annual Growth Rate (CAGR)
CAGR measures the geometric mean rate of return over a continuous temporal horizon, accounting for compounding effects:

$$\text{CAGR} = \left(\frac{V_f}{V_i}\right)^{\frac{365.25}{D}} - 1$$

Where:
*   $V_i$ = Initial portfolio equity ($100,000.00 base)
*   $V_f$ = Terminal portfolio equity (cash balance + active asset valuations at final bar)
*   $D$ = Exact chronological calendar days between the initial and terminal price bars [$t_0$ to $t_{N-1}$]

### 2.2 Portfolio Daily Return Vector
The vector of daily portfolio returns $R_t$ is computed sequentially to prevent look-ahead bias:

$$R_t = \frac{E_t - E_{t-1}}{E_{t-1}}, \quad t \in [1, N-1]$$

Where $E_t$ represents the total portfolio valuation at trading bar $t$.

### 2.3 Annualized Volatility
Annualized Volatility ($\sigma_{\text{ann}}$) represents the standard deviation of daily portfolio returns scaled to an annual horizon:

$$\bar{R} = \frac{1}{N-1}\sum_{t=1}^{N-1} R_t$$

$$\sigma_{\text{daily}} = \sqrt{\frac{1}{N-2} \sum_{t=1}^{N-1} (R_t - \bar{R})^2}$$

$$\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}$$

### 2.4 Annualized Sharpe Ratio
The Sharpe Ratio evaluates the annualized return generated per unit of total portfolio risk:

$$\text{Sharpe} = \frac{\text{CAGR} - R_f}{\sigma_{\text{ann}}}$$

Where $R_f$ is the risk-free rate (assumed at a static baseline of $2.0\%$ representing overnight sovereign yields).

### 2.5 Annualized Sortino Ratio & Downside Deviation
The Sortino Ratio isolates downside volatility to evaluate returns relative to harmful downside tail-risk, substituting total standard deviation with downside semi-deviation:

$$\delta_{\text{daily}} = \sqrt{\frac{1}{N-1} \sum_{t=1}^{N-1} \min(R_t, 0)^2}$$

$$\delta_{\text{ann}} = \delta_{\text{daily}} \times \sqrt{252}$$

$$\text{Sortino} = \frac{\text{CAGR} - R_f}{\delta_{\text{ann}}}$$

### 2.6 Beta ($\beta$) and Jensen's Alpha ($\alpha$)
Attributing risk-relative excess returns against a passive benchmark index (Buy-and-Hold):

$$\beta = \frac{\text{Covariance}(R_p, R_m)}{\text{Variance}(R_m)}$$

$$\alpha = \text{CAGR}_p - \left[ R_f + \beta \times (\text{CAGR}_m - R_f) \right]$$

Where:
*   $R_p$ = Portfolio daily returns vector
*   $R_m$ = Benchmark market daily returns vector
*   $\text{CAGR}_p$, $\text{CAGR}_m$ = Compounded growth rates of the portfolio and market benchmark respectively.

### 2.7 Maximum Drawdown (MaxDD) & Drawdown Duration
Maximum Drawdown defines the worst peak-to-trough paper loss experienced by the equity curve:

$$DD_t = \frac{\max_{\tau \le t} E_\tau - E_t}{\max_{\tau \le t} E_\tau}$$

$$\text{MaxDD} = \max_{t \in [0, N-1]} DD_t$$

Drawdown Duration tracks the number of consecutive daily bars during which portfolio equity remains strictly below its historical peak, capturing the temporal psychological pain of strategy recovery.

---

## 3. Systematic Strategy & Friction Modeling

The platform evaluates four core strategy classes using a strictly deterministic signal generation framework:

1.  **Moving Average Crossover**: Trend-following logic relying on exponential or simple moving averages.
    $$\text{Signal}_t = \begin{cases} 1 & \text{if } MA_{\text{fast}, t-1} \le MA_{\text{slow}, t-1} \text{ and } MA_{\text{fast}, t} > MA_{\text{slow}, t} \\ -1 & \text{if } MA_{\text{fast}, t-1} \ge MA_{\text{slow}, t-1} \text{ and } MA_{\text{fast}, t} < MA_{\text{slow}, t} \end{cases}$$
2.  **RSI Mean Reversion**: Mean-reverting oscillator identifying exhaustion extremes.
    $$\text{Signal}_t = \begin{cases} 1 & \text{if } RSI_{t-1} \le \text{Oversold} \text{ and } RSI_t > \text{Oversold} \\ -1 & \text{if } RSI_{t-1} \ge \text{Overbought} \text{ and } RSI_t < \text{Overbought} \end{cases}$$
3.  **Momentum (Rate of Change)**: Directional momentum based on temporal price rates.
4.  **Multi-Factor Combinator**: Synthesizes moving averages, RSI, and Momentum signals using conditional **AND** / **OR** logic gates.

### 3.1 Realistic Frictional Constraints
Retail backtests frequently generate illusory "alpha" due to zero friction assumptions. This framework models transaction costs at the execution interface:
*   **Commissions Drag**: Modeled in basis points (bps):
    $$\text{Transaction Fee} = \text{Trade Value} \times \frac{\text{Commission (bps)}}{10,000}$$
*   **Execution Slippage Drag**: Modeled as a flat percentage deviation from the daily close, reflecting liquidity limits and order book spread depth:
    $$\text{Buy Execution Price} = P_t \times (1 + \text{Slippage Pct})$$
    $$\text{Sell Execution Price} = P_t \times (1 - \text{Slippage Pct})$$

---

## 4. Advanced Validation Methodologies

### 4.1 Chronological In-Sample / Out-of-Sample Partitioning
To eliminate selection bias and over-optimistic parameter backfitting, datasets are divided chronologically (default $70\%$ In-Sample training, $30\%$ Out-of-Sample validation):

```
Chronological Price Series:
|========================= IN-SAMPLE (70%) =========================|======== OUT-OF-SAMPLE (30%) ========|
[t_0]                                                     [Boundary Index]                      [t_N-1]
           Parameter Grid Sweep & Search (IS)                              No-Touch Validation Run (OOS)
```

Strategies are optimized exclusively on the In-Sample block. The selected parameter coordinates are then evaluated on the "no-touch" Out-of-Sample block to measure strategy robustness and assess **parameter decay** (performance degradation in unseen market environments).

### 4.2 Rolling Walk-Forward Optimization (WFO)
WFO replaces static optimization with a rolling, adaptive approach, mirroring realistic asset management:

```
Window 1:  |--- Train (252d) ---|-- Test (63d) --|
Window 2:         |--- Train (252d) ---|-- Test (63d) --|
Window 3:                |--- Train (252d) ---|-- Test (63d) --|
Continuous OOS:                 [====== Adaptive Walk-Forward Equity Curve ======]
```

1.  **In-Sample training slice**: A 252-day sliding window optimizes parameter sets.
2.  **Out-of-Sample test segment**: The best-performing parameters (maximizing Sharpe) are deployed forward over a 63-day test block.
3.  **Rolling progression**: The window slides forward by 63 days, and the process repeats.
4.  **Equity Stitches**: The sequential out-of-sample segments are stitched together to form a continuous **Walk-Forward Equity Curve**, testing strategy persistence across changing market regimes.

### 4.3 Stochastic Risk Engine (Monte Carlo Bootstrapping)
Rather than assuming a normal distribution of returns, the Monte Carlo simulator uses **resampling bootstrap methodologies**:
1.  **Extracts Completed Trade Returns**: Obtains the exact return percentages $\{r_1, r_2, \dots, r_M\}$ from the historical ledger.
2.  **Models Daily Trade Frequency**: Establishes a daily trading rate $\lambda = \frac{M}{H}$ where $H$ is the historical series length.
3.  **Generates 100+ Randomized Paths**: Simulates 252-day forward horizons. For each day, a trade event is determined by $\lambda$. If triggered, a trade return is drawn with replacement from the historical returns vector.
4.  **Determines Percentile-Based Equity Bands**: Computes the 5th, 25th, 50th (median), 75th, and 95th percentile terminal bounds.
5.  **Calculates Probability of Ruin**: Estimates the exact percentage of simulated paths experiencing a peak-to-trough drawdown exceeding $25\%$:
    $$\text{Probability of Ruin} = \frac{\sum_{s=1}^{S} \mathbb{I}(\text{MaxDD}_s \ge 25\%)}{S}$$

---

## 5. Market Regime Analysis & Key Findings

### 5.1 Trend and Volatility Quadrant Classification
Assets are dynamically categorized daily into one of four regimes:
1.  **BULL_LOW_VOL**: Close price $\ge$ 200-day SMA, and 20-day ATR $<$ Median historical ATR.
2.  **BULL_HIGH_VOL**: Close price $\ge$ 200-day SMA, and 20-day ATR $\ge$ Median ATR.
3.  **BEAR_LOW_VOL**: Close price $<$ 200-day SMA, and 20-day ATR $<$ Median ATR.
4.  **BEAR_HIGH_VOL**: Close price $<$ 200-day SMA, and 20-day ATR $\ge$ Median ATR.

### 5.2 Empirical Observations
*   **Trend-Following Strategies (MA Crossover)** exhibit high **signal robustness** and strategy persistence in **BULL_LOW_VOL** quadrants, benefiting from steady directional trends.
*   In **BEAR_HIGH_VOL** regimes, trend strategies suffer from **"whipsawing"** and excessive slippage. Applying a volatility regime filter to restrict new long entries during high-volatility bear environments significantly reduces maximum drawdowns and improves Sharpe ratios.
*   **Mean-Reverting Models (RSI Reversion)** perform exceptionally well in **BULL_HIGH_VOL** and **BEAR_LOW_VOL** regimes, capitalizing on sideways range-bound oscillations. However, they face significant tail-risk in strong trending markets ("undulating trends"), highlighting the need for dynamic factor blending.

---

## 6. Structural Limitations & Future Research

While mathematically rigorous, the framework operates under specific constraints:
1.  **Data Resolution Limits**: The platform currently uses daily OHLCV series. Intra-day execution anomalies, microsecond price slippage, and high-frequency order-book dynamics are not modeled.
2.  **Liquidity Assumptions**: Order fills assume infinite liquidity at the slippage-adjusted close, ignoring market impact models where large orders push price spreads.
3.  **Single-Asset Focus**: Portfolios are modeled on single-asset allocations. Multi-asset covariance, dynamic beta-neutral hedging, and cross-asset factor allocations are deferred to future versions.
4.  **Future Extensions**:
    *   **Statistical Significance Testing**: Implementing p-value tests on factor persistence across market regimes to verify that strategy outperformance is not a product of random path variance.
    *   **Factor Decomposition (Barra-Style)**: Decomposing returns into macro risk factors (e.g., Value, Size, Quality, Momentum) to isolate true benchmark-relative excess returns.

---
*End of Specifications Report.*
