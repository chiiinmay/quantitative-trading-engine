# QSR&B: Systematic Strategy Research & Backtesting Platform
## Quantitative Strategy Research & Portfolio Management Workstation

**Author:** Nagachinmay KN (`chinmaynataraj@gmail.com`)  
**Target Profile:** Quantitative Research & Portfolio Strategies Trainee  
**Target Institution:** D+A Strategies, Dubai (UAE)  
**Live Production Workstation:** [https://quantitative-trading-engine-kohl.vercel.app/](https://quantitative-trading-engine-kohl.vercel.app/)

---

## 1. Executive Overview

**QSR&B** is a high-performance, browser-native quantitative strategy research and backtesting platform built to model, optimize, and validate systematic trading strategies. Designed with a strict focus on institutional-grade validation over naive backtesting loops, this platform isolates systematic alpha from overfitted noise by implementing rolling walk-forward routines, out-of-sample temporal partitions, and non-parametric stochastic tail-risk simulations.

### Core Research Objectives
*   **Vectorized Performance Attribution:** Standardize risk-adjusted return calculations (CAGR, Annualized Volatility, Sharpe, Sortino, Alpha, Beta) using vector-aligned mathematical formulas.
*   **Frictional Integrity:** Eliminate illusory retail trading profits by modeling realistic commission drags and execution slippage bounds.
*   **Temporal Validation:** Protect strategies against parameter decay using chronological training/test segmentation and walk-forward adaptation.
*   **Stochastic Risk Profile:** Assess path-dependent tail risk and ruin probabilities through bootstrapped Monte Carlo simulations rather than Gaussian distributions.

---

## 2. Platform Architecture & Data Ingestion

The platform utilizes a modern, serverless, modular architecture that processes computations entirely on the client-side, ensuring absolute data privacy and security compliance.

```
+---------------------------------------------------------------------------------+
|                                 USER VIEWPORT                                   |
|   [Research Workspace]  [Out-of-Sample]  [Sensitivity & WFO]  [Risk & Regime]   |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+------------------+             +---------------+             +------------------+
|  DATA PIPELINES  |             |  MATH ENGINES |             |  VISUAL STACK    |
|  * Preloaded SPY |             |  * Vector MAs |             |  * TradingView   |
|  * Binance API   |  ========>  |  * Sharpe/DD  |  ========>  |    Lightweight   |
|  * Local CSV     |             |  * WFO Loops  |             |  * Chart.js (2D) |
|    Ingestion     |             |  * Monte Carlo|             |  * Ledger Tables |
+------------------+             +---------------+             +------------------+
```

### Ingestion Pipelines
1.  **Institutional Benchmarks:** Preloaded, vectorized multi-year daily price series for the S&P 500 ETF (SPY), Apple (AAPL), Tesla (TSLA), and Bitcoin (BTC/USDT).
2.  **Live REST Integration:** Direct asynchronous pipeline fetching historical hourly/daily candlestick intervals from the Binance Public API.
3.  **Local CSV Upload:** Resilient client-side CSV parser that dynamically maps, validates, and normalizes arbitrary columns containing `Date`, `Open`, `High`, `Low`, `Close`, and `Volume`.

### Technologies Used
*   **Core Logic:** Vanilla EcmaScript (ES6+) Modules.
*   **Visualization:** TradingView Lightweight Charts (financial candlestick plotting) & Chart.js (heatmaps, equity curves, Monte Carlo bands).
*   **Styling:** Custom Vanilla CSS Grid & Flexbox system tailored to fit high-density financial terminals.
*   **Bundling & Build:** Vite.js for production-optimized bundling.

---

## 3. Core Mathematical Specifications

### 3.1 Compounded Annual Growth Rate (CAGR)
CAGR measures the geometric mean rate of return over a continuous temporal horizon, accounting for compounding effects:

$$\text{CAGR} = \left(\frac{V_f}{V_i}\right)^{\frac{365.25}{D}} - 1$$

Where $V_i$ is the initial capital, $V_f$ is the terminal portfolio equity, and $D$ is the exact calendar day count of the backtest.

### 3.2 Annualized Volatility ($\sigma_{\text{ann}}$)
Represents the standard deviation of daily portfolio returns scaled to an annual horizon:

$$\sigma_{\text{daily}} = \sqrt{\frac{1}{N-2} \sum_{t=1}^{N-1} (R_t - \bar{R})^2}$$

$$\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}$$

### 3.3 Annualized Sharpe Ratio
Evaluates the excess annualized return generated per unit of total portfolio risk:

$$\text{Sharpe} = \frac{\text{CAGR} - R_f}{\sigma_{\text{ann}}}$$

*(Where risk-free rate $R_f$ is set at a static institutional baseline of $2.0\%$)*

### 3.4 Annualized Sortino Ratio & Downside Semi-Deviation
Isolates downside return volatility to measure performance relative to harmful negative price fluctuations:

$$\delta_{\text{daily}} = \sqrt{\frac{1}{N-1} \sum_{t=1}^{N-1} \min(R_t, 0)^2}$$

$$\delta_{\text{ann}} = \delta_{\text{daily}} \times \sqrt{252}$$

$$\text{Sortino} = \frac{\text{CAGR} - R_f}{\delta_{\text{ann}}}$$

### 3.5 Jensen's Alpha ($\alpha$) & Covariance Beta ($\beta$)
Attributes risk-relative excess returns against a passive benchmark index (Buy-and-Hold):

$$\beta = \frac{\text{Covariance}(R_p, R_m)}{\text{Variance}(R_m)}$$

$$\alpha = \text{CAGR}_p - \left[ R_f + \beta \times (\text{CAGR}_m - R_f) \right]$$

Where $R_p$ is the portfolio return vector and $R_m$ is the benchmark market return vector.

---

## 4. Advanced Model Validation Framework

The workstation protects quantitative strategies against parameter overfitting and selection bias using three core methods:

### 4.1 Chronological In-Sample / Out-of-Sample Splits
Strategies are optimized exclusively on the **In-Sample** window (first 70% of historical data). Optimal parameter configurations are then frozen and deployed to the **Out-of-Sample** window (remaining 30% of unseen data) to measure **parameter decay**—the performance degradation experienced in novel market environments.

### 4.2 Rolling Walk-Forward Optimization (WFO)
Replaces static optimization with an adaptive sliding window model, mirroring realistic portfolio management:
*   A **Training Window** (e.g. 252 days) is swept to optimize parameter sets (maximizing Sharpe).
*   The optimal parameters are deployed forward over a subsequent **Test Window** (e.g. 63 days).
*   The windows slide forward continuously, and the test segments are stitched together to form a **Walk-Forward Rolling Equity Curve** that demonstrates parameter persistence across changing market regimes.

### 4.3 Resampling Bootstrap Monte Carlo Risk Engine
To capture path-dependent risk without assuming a normal return distribution, the simulator:
1.  Extracts the exact completed trade returns vector $\{r_1, r_2, \dots, r_M\}$.
2.  Generates 100+ randomized forward return paths over a 252-day horizon using resampling with replacement.
3.  Calculates the **Probability of Ruin** as the exact percentage of simulated paths experiencing a peak-to-trough drawdown exceeding a critical $25\%$ threshold.
4.  Plots 5th, 25th, 50th (median), 75th, and 95th percentile forward equity bands.

---

## 5. Volatility & Trend Market Regimes

Daily price action is dynamically classified into one of four distinct market quadrants based on the 200-day Simple Moving Average (SMA) and the 20-day Average True Range (ATR) relative to its median historical baseline:

1.  **BULL_LOW_VOL:** Price $\ge$ 200-day SMA, and 20-day ATR $<$ Median ATR.
2.  **BULL_HIGH_VOL:** Price $\ge$ 200-day SMA, and 20-day ATR $\ge$ Median ATR.
3.  **BEAR_LOW_VOL:** Price $<$ 200-day SMA, and 20-day ATR $<$ Median ATR.
4.  **BEAR_HIGH_VOL:** Price $<$ 200-day SMA, and 20-day ATR $\ge$ Median ATR.

Strategies can be dynamically filtered to execute signals only during specific quadrants. For example, restricting trend-following strategies to **BULL_LOW_VOL** environments significantly reduces whipsawing losses in volatile bear markets.

---

## 6. Structural Limitations & Future Extensions

### Core Limitations
*   **Daily OHLCV Sampling:** Portfolio calculations assume execution fills at the daily close, ignoring intra-day price microstructures, order-book spreads, and borrow fees.
*   **Infinite Liquidity Assumption:** Large order executions are assumed to have zero market impact (no slippage decay on high-volume transactions).
*   **Single-Asset Constraints:** Capital is deployed to a single asset, omitting multi-asset portfolio covariance and beta-neutral hedging.

### Future Work
*   **Statistical Significance Testing:** Incorporating p-value checks on factor persistence across market regimes to verify that alpha is not a product of random path variance.
*   **Barra-Style Factor Decomposition:** Decomposing returns into systematic risk premiums (value, size, momentum, quality) to isolate true idiosyncratic alpha.

---
*Developed as a systematic research and backtesting benchmark showcase.*
