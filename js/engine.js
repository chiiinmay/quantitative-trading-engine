/**
 * Quantitative Strategy Research & Backtesting Platform
 * Core Mathematical Engines, Strategies, and Statistical Simulators
 */

// ==========================================
// 1. Core Mathematical Vector Functions
// ==========================================

export function calculateSMA(data, period) {
    const smas = new Array(data.length).fill(null);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period - 1) {
            if (i >= period) {
                sum -= data[i - period].close;
            }
            smas[i] = parseFloat((sum / period).toFixed(4));
        }
    }
    return smas;
}

export function calculateEMA(data, period) {
    const emas = new Array(data.length).fill(null);
    if (data.length < period) return emas;
    
    // Seed EMA with first SMA value
    let smaSum = 0;
    for (let i = 0; i < period; i++) {
        smaSum += data[i].close;
    }
    emas[period - 1] = smaSum / period;
    
    const multiplier = 2 / (period + 1);
    for (let i = period; i < data.length; i++) {
        emas[i] = (data[i].close - emas[i - 1]) * multiplier + emas[i - 1];
        emas[i] = parseFloat(emas[i].toFixed(4));
    }
    return emas;
}

export function calculateRSI(data, period) {
    const rsis = new Array(data.length).fill(null);
    if (data.length < period + 1) return rsis;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss (Wilder's standard initialization)
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    rsis[period] = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));

    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const currentGain = diff > 0 ? diff : 0;
        const currentLoss = diff < 0 ? -diff : 0;

        // Wilder's smoothing technique
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

        rsis[i] = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
    }
    return rsis;
}

export function calculateROC(data, period) {
    const rocs = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
        const pastClose = data[i - period].close;
        if (pastClose !== 0) {
            rocs[i] = parseFloat((((data[i].close - pastClose) / pastClose) * 100).toFixed(4));
        } else {
            rocs[i] = 0;
        }
    }
    return rocs;
}

export function calculateATR(data, period = 20) {
    const atrs = new Array(data.length).fill(null);
    if (data.length < 2) return atrs;

    let trSum = 0;
    
    // Seed ATR
    for (let i = 1; i < Math.min(data.length, period + 1); i++) {
        const h = data[i].high;
        const l = data[i].low;
        const pc = data[i - 1].close;
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        trSum += tr;
    }
    
    if (data.length > period) {
        atrs[period] = trSum / period;
        for (let i = period + 1; i < data.length; i++) {
            const h = data[i].high;
            const l = data[i].low;
            const pc = data[i - 1].close;
            const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
            // Smoothed Wilders moving average representation
            atrs[i] = (atrs[i - 1] * (period - 1) + tr) / period;
        }
    }
    return atrs;
}

// ==========================================
// 2. Market Regime & Volatility Analyzer
// ==========================================

export function classifyMarketRegimes(data) {
    const regimes = new Array(data.length).fill(null);
    const atrs = calculateATR(data, 20);
    const ma200 = calculateSMA(data, 200);

    // Calculate historical median ATR as our volatility threshold divider
    const validAtrs = atrs.filter(val => val !== null);
    validAtrs.sort((a, b) => a - b);
    const medianAtr = validAtrs.length > 0 ? validAtrs[Math.floor(validAtrs.length / 2)] : 0.0;

    for (let i = 0; i < data.length; i++) {
        if (atrs[i] === null) continue;

        const isBullish = ma200[i] !== null ? data[i].close >= ma200[i] : true;
        const isHighVol = atrs[i] >= medianAtr;

        if (isBullish && !isHighVol) regimes[i] = 'BULL_LOW_VOL';
        else if (isBullish && isHighVol) regimes[i] = 'BULL_HIGH_VOL';
        else if (!isBullish && !isHighVol) regimes[i] = 'BEAR_LOW_VOL';
        else regimes[i] = 'BEAR_HIGH_VOL';
    }
    return { regimes, medianAtr };
}

// ==========================================
// 3. Core Backtest Engine
// ==========================================

export function runBacktest(data, strategyConfig, controlParams) {
    const { strategyType, params } = strategyConfig;
    const { initialCapital, commissionBps, slippagePct, useRegimeFilter, regimeFilterType } = controlParams;

    const length = data.length;
    let cash = initialCapital;
    let shares = 0;
    let equity = initialCapital;

    // Output tracking vectors
    const equityCurve = new Array(length).fill(initialCapital);
    const cashTimeline = new Array(length).fill(initialCapital);
    const trades = [];
    const signals = new Array(length).fill(0); // 1 = Buy, -1 = Sell/Exit, 0 = Hold

    // Precalculate Strategy Indicators
    let fastMA = [], slowMA = [], rsi = [], roc = [];
    let maType = params.maType || 'SMA';

    if (strategyType === 'MA_CROSSOVER' || (strategyType === 'MULTI_FACTOR' && params.useMaCross)) {
        fastMA = maType === 'EMA' ? calculateEMA(data, params.maFast) : calculateSMA(data, params.maFast);
        slowMA = maType === 'EMA' ? calculateEMA(data, params.maSlow) : calculateSMA(data, params.maSlow);
    }
    if (strategyType === 'RSI_REVERSION' || (strategyType === 'MULTI_FACTOR' && params.useRSI)) {
        rsi = calculateRSI(data, params.rsiPeriod);
    }
    if (strategyType === 'MOMENTUM_ROC' || (strategyType === 'MULTI_FACTOR' && params.useMom)) {
        roc = calculateROC(data, params.momPeriod);
    }

    // Volatility Regime Classification
    const { regimes } = classifyMarketRegimes(data);

    let activeTrade = null;

    // Bar-by-bar simulation loop to prevent look-ahead bias
    for (let i = 1; i < length; i++) {
        const price = data[i].close;
        const prevPrice = data[i - 1].close;
        let signal = 0;

        // Generate systematic signals based on deterministic rules
        if (strategyType === 'MA_CROSSOVER') {
            const fCurrent = fastMA[i], fPrev = fastMA[i - 1];
            const sCurrent = slowMA[i], sPrev = slowMA[i - 1];

            if (fCurrent !== null && sCurrent !== null && fPrev !== null && sPrev !== null) {
                if (fPrev <= sPrev && fCurrent > sCurrent) {
                    signal = 1; // Bullish crossover
                } else if (fPrev >= sPrev && fCurrent < sCurrent) {
                    signal = -1; // Bearish crossover
                }
            }
        } else if (strategyType === 'RSI_REVERSION') {
            const rCurrent = rsi[i], rPrev = rsi[i - 1];
            if (rCurrent !== null && rPrev !== null) {
                if (rPrev <= params.rsiOversold && rCurrent > params.rsiOversold) {
                    signal = 1; // Rebounded from oversold boundary
                } else if (rPrev >= params.rsiOverbought && rCurrent < params.rsiOverbought) {
                    signal = -1; // Collapsed from overbought boundary
                }
            }
        } else if (strategyType === 'MOMENTUM_ROC') {
            const rocCurrent = roc[i], rocPrev = roc[i - 1];
            if (rocCurrent !== null && rocPrev !== null) {
                if (rocPrev <= params.momThreshold && rocCurrent > params.momThreshold) {
                    signal = 1; // Transited above positive momentum threshold
                } else if (rocPrev >= params.momThreshold && rocCurrent < params.momThreshold) {
                    signal = -1; // Receded below momentum threshold
                }
            }
        } else if (strategyType === 'MULTI_FACTOR') {
            // Evaluates multi-factor logical signal combinations
            const conditions = [];

            if (params.useMaCross && fastMA[i] !== null && slowMA[i] !== null) {
                conditions.push(fastMA[i] > slowMA[i] ? 1 : -1);
            }
            if (params.useRSI && rsi[i] !== null) {
                if (rsi[i] < params.rsiOversold) conditions.push(1);
                else if (rsi[i] > params.rsiOverbought) conditions.push(-1);
                else conditions.push(0);
            }
            if (params.useMom && roc[i] !== null) {
                conditions.push(roc[i] > params.momThreshold ? 1 : -1);
            }

            if (conditions.length > 0) {
                if (params.logic === 'AND') {
                    if (conditions.every(c => c === 1)) signal = 1;
                    else if (conditions.every(c => c === -1)) signal = -1;
                } else { // OR Logic gate
                    if (conditions.some(c => c === 1)) signal = 1;
                    else if (conditions.some(c => c === -1)) signal = -1;
                }
            }
        }

        signals[i] = signal;

        // Apply dynamic volatility regime filter if checked
        if (useRegimeFilter && signal === 1 && regimes[i] !== null) {
            const currentRegime = regimes[i];
            if (regimeFilterType === 'LOW_VOL' && (currentRegime.includes('HIGH_VOL'))) {
                signal = 0; // Block buy in High Volatility regime
            } else if (regimeFilterType === 'HIGH_VOL' && (currentRegime.includes('LOW_VOL'))) {
                signal = 0; // Block buy in Low Volatility regime
            }
        }

        // Execution logic with commissions and slippage
        if (signal === 1 && shares === 0) {
            // Execute Buy order
            const slipCost = price * (slippagePct / 100);
            const entryPrice = price + slipCost; // Slippage increases buy execution price
            
            const commCost = cash * (commissionBps / 10000);
            const investable = cash - commCost;
            
            shares = investable / entryPrice;
            cash = 0;
            
            activeTrade = {
                id: trades.length + 1,
                symbol: data[i].symbol || 'Asset',
                type: 'LONG',
                entryDate: data[i].time,
                entryPrice: parseFloat(entryPrice.toFixed(4)),
                volume: parseFloat(shares.toFixed(4)),
                commissionPaid: parseFloat(commCost.toFixed(2))
            };
        } else if (signal === -1 && shares > 0) {
            // Execute Sell / Exit order
            const slipCost = price * (slippagePct / 100);
            const exitPrice = price - slipCost; // Slippage reduces exit execution price
            
            const grossProceeds = shares * exitPrice;
            const commCost = grossProceeds * (commissionBps / 10000);
            
            cash = grossProceeds - commCost;
            shares = 0;

            if (activeTrade) {
                activeTrade.exitDate = data[i].time;
                activeTrade.exitPrice = parseFloat(exitPrice.toFixed(4));
                activeTrade.commissionPaid = parseFloat((activeTrade.commissionPaid + commCost).toFixed(2));
                
                const grossPnL = cash - (activeTrade.volume * activeTrade.entryPrice);
                activeTrade.pnl = parseFloat(grossPnL.toFixed(2));
                activeTrade.returnPct = parseFloat((((exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100).toFixed(2));
                
                trades.push(activeTrade);
                activeTrade = null;
            }
        }

        // Equity Valuation step
        equity = shares > 0 ? (shares * price) : cash;
        equityCurve[i] = parseFloat(equity.toFixed(2));
        cashTimeline[i] = parseFloat(cash.toFixed(2));
    }

    // Force close active trade on final bar to finalize transaction ledger values
    if (shares > 0 && activeTrade) {
        const finalPrice = data[length - 1].close;
        const exitPrice = finalPrice - (finalPrice * (slippagePct / 100));
        const grossProceeds = shares * exitPrice;
        const commCost = grossProceeds * (commissionBps / 10000);
        cash = grossProceeds - commCost;
        shares = 0;
        
        activeTrade.exitDate = data[length - 1].time;
        activeTrade.exitPrice = parseFloat(exitPrice.toFixed(4));
        activeTrade.commissionPaid = parseFloat((activeTrade.commissionPaid + commCost).toFixed(2));
        const grossPnL = cash - (activeTrade.volume * activeTrade.entryPrice);
        activeTrade.pnl = parseFloat(grossPnL.toFixed(2));
        activeTrade.returnPct = parseFloat((((exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100).toFixed(2));
        
        trades.push(activeTrade);
    }
    
    equityCurve[length - 1] = parseFloat(cash.toFixed(2));
    cashTimeline[length - 1] = parseFloat(cash.toFixed(2));

    return {
        equityCurve,
        cashTimeline,
        trades,
        signals,
        fastMA,
        slowMA,
        indicatorValues: strategyType === 'RSI_REVERSION' ? rsi : (strategyType === 'MOMENTUM_ROC' ? roc : null)
    };
}

// ==========================================
// 4. Analytical Performance Metrics Calculator
// ==========================================

export function calculateMetrics(equityCurve, data, trades, rfRate = 2.0) {
    const length = equityCurve.length;
    if (length < 2) return null;

    const initialEquity = equityCurve[0];
    const finalEquity = equityCurve[length - 1];

    // Compute CAGR
    const dateStart = new Date(data[0].time);
    const dateEnd = new Date(data[length - 1].time);
    const timeDiff = Math.abs(dateEnd - dateStart);
    const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const years = days / 365.25;

    const totalReturn = (finalEquity - initialEquity) / initialEquity;
    const cagr = years > 0 ? (Math.pow(finalEquity / initialEquity, 1 / years) - 1) : totalReturn;

    // Daily returns vector calculation
    const dailyReturns = [];
    let negativeReturnsSum = 0;
    let negativeReturnsCount = 0;

    for (let i = 1; i < length; i++) {
        const dailyRet = (equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1];
        dailyReturns.push(dailyRet);
        if (dailyRet < 0) {
            negativeReturnsSum += Math.pow(dailyRet, 2);
            negativeReturnsCount++;
        }
    }

    // Annualized Volatility
    const meanDailyRet = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
    const varDailyRet = dailyReturns.reduce((sum, val) => sum + Math.pow(val - meanDailyRet, 2), 0) / (dailyReturns.length - 1);
    const dailyVol = Math.sqrt(varDailyRet);
    const annVol = dailyVol * Math.sqrt(252);

    // Annualized Downside Deviation (Sortino)
    const dailyDownsideDev = negativeReturnsCount > 0 ? Math.sqrt(negativeReturnsSum / dailyReturns.length) : 0.0;
    const annDownsideDev = dailyDownsideDev * Math.sqrt(252);

    // Sharpe and Sortino ratios
    const rfDaily = rfRate / 100;
    const excessReturn = cagr - rfDaily;
    const sharpe = annVol > 0 ? excessReturn / annVol : 0.0;
    const sortino = annDownsideDev > 0 ? excessReturn / annDownsideDev : 0.0;

    // Maximum Drawdown Curve
    let peak = initialEquity;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    
    // Drawdown duration tracking
    let currentDrawdownDuration = 0;
    let maxDrawdownDuration = 0;

    for (let i = 0; i < length; i++) {
        if (equityCurve[i] > peak) {
            peak = equityCurve[i];
            currentDrawdownDuration = 0;
        } else {
            currentDrawdown = (peak - equityCurve[i]) / peak;
            maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
            currentDrawdownDuration++;
            maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
        }
    }

    // Trade stats
    const winTrades = trades.filter(t => t.pnl > 0);
    const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0.0;
    
    const grossProfits = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLosses = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : (grossProfits > 0 ? Infinity : 0.0);

    // Benchmark Buy & Hold returns
    const assetInitial = data[0].close;
    const assetFinal = data[length - 1].close;
    const benchmarkReturn = (assetFinal - assetInitial) / assetInitial;
    const benchmarkCAGR = years > 0 ? (Math.pow(assetFinal / assetInitial, 1 / years) - 1) : benchmarkReturn;

    // Benchmark daily returns
    const benchDailyReturns = [];
    for (let i = 1; i < length; i++) {
        benchDailyReturns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }
    const meanBenchRet = benchDailyReturns.reduce((sum, val) => sum + val, 0) / benchDailyReturns.length;
    const varBenchRet = benchDailyReturns.reduce((sum, val) => sum + Math.pow(val - meanBenchRet, 2), 0) / (benchDailyReturns.length - 1);
    
    // Calculate Beta (Covariance / Variance)
    let covarianceSum = 0;
    for (let i = 0; i < dailyReturns.length; i++) {
        covarianceSum += (dailyReturns[i] - meanDailyRet) * (benchDailyReturns[i] - meanBenchRet);
    }
    const covariance = covarianceSum / (dailyReturns.length - 1);
    const beta = varBenchRet > 0 ? covariance / varBenchRet : 1.0;

    // Calculate Alpha (Jensen's Alpha definition)
    const alpha = cagr - (rfDaily + beta * (benchmarkCAGR - rfDaily));

    return {
        totalReturn: parseFloat((totalReturn * 100).toFixed(2)),
        cagr: parseFloat((cagr * 100).toFixed(2)),
        annVol: parseFloat((annVol * 100).toFixed(2)),
        sharpe: parseFloat(sharpe.toFixed(2)),
        sortino: parseFloat(sortino.toFixed(2)),
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        maxDrawdownDuration,
        winRate: parseFloat(winRate.toFixed(2)),
        profitFactor: profitFactor === Infinity ? 'Infinity' : parseFloat(profitFactor.toFixed(2)),
        benchmarkReturn: parseFloat((benchmarkReturn * 100).toFixed(2)),
        benchmarkCAGR: parseFloat((benchmarkCAGR * 100).toFixed(2)),
        alpha: parseFloat((alpha * 100).toFixed(2)),
        beta: parseFloat(beta.toFixed(2))
    };
}

// ==========================================
// 5. In-Sample / Out-of-Sample Partitioning
// ==========================================

export function partitionDataset(data, isPct = 70) {
    const boundaryIdx = Math.floor(data.length * (isPct / 100));
    const inSampleData = data.slice(0, boundaryIdx);
    const outOfSampleData = data.slice(boundaryIdx);
    
    return { inSampleData, outOfSampleData, boundaryIdx };
}

// ==========================================
// 6. Parameter Sweep Grid Optimizer (Sensitivity)
// ==========================================

export function runGridSearch(data, paramNameX, paramNameY, strategyType, controlParams) {
    const results = [];
    
    // Define parameter coordinates to sweep
    let xRange = [];
    let yRange = [];

    if (paramNameX === 'fast_ma') {
        xRange = [5, 10, 15, 20, 25, 30, 35, 40, 45];
    } else if (paramNameX === 'rsi_period') {
        xRange = [5, 8, 10, 12, 14, 16, 18, 20, 24];
    }

    if (paramNameY === 'slow_ma') {
        yRange = [30, 50, 70, 90, 110, 130, 150, 170, 190];
    } else if (paramNameY === 'rsi_oversold') {
        yRange = [15, 20, 25, 30, 35, 40, 45];
    }

    for (let xVal of xRange) {
        for (let yVal of yRange) {
            // Construct strategy configuration
            const strategyConfig = {
                strategyType,
                params: {
                    maType: 'SMA',
                    maFast: paramNameX === 'fast_ma' ? xVal : 20,
                    maSlow: paramNameY === 'slow_ma' ? yVal : 50,
                    rsiPeriod: paramNameX === 'rsi_period' ? xVal : 14,
                    rsiOversold: paramNameY === 'rsi_oversold' ? yVal : 30,
                    rsiOverbought: paramNameY === 'rsi_oversold' ? (100 - yVal) : 70, // Symm threshold
                    momPeriod: 10,
                    momThreshold: 0
                }
            };

            const backtestResult = runBacktest(data, strategyConfig, controlParams);
            const metrics = calculateMetrics(backtestResult.equityCurve, data, backtestResult.trades);
            
            results.push({
                x: xVal,
                y: yVal,
                sharpe: metrics ? metrics.sharpe : 0.0,
                return: metrics ? metrics.cagr : 0.0
            });
        }
    }

    return { results, xRange, yRange };
}

// ==========================================
// 7. Rolling Walk-Forward Optimization (WFO)
// ==========================================

export function runWalkForward(data, trainDays = 252, testDays = 63, strategyType, controlParams) {
    const length = data.length;
    const wfoEquityCurve = new Array(length).fill(controlParams.initialCapital);
    
    let currentCash = controlParams.initialCapital;
    let currentShares = 0;
    
    // We start WFO after the first training block completes
    let wfoStartIdx = trainDays;
    
    // Pre-copy data up to training block for the equity curve representation
    for (let i = 0; i < wfoStartIdx; i++) {
        wfoEquityCurve[i] = controlParams.initialCapital;
    }

    const optimizationParams = strategyType === 'MA_CROSSOVER' 
        ? { x: 'fast_ma', y: 'slow_ma' }
        : { x: 'rsi_period', y: 'rsi_oversold' };

    // Rolling windows iteration loop
    for (let start = 0; start < length - trainDays; start += testDays) {
        const endTrain = start + trainDays;
        const endTest = Math.min(endTrain + testDays, length);
        if (endTrain >= length) break;

        const trainingData = data.slice(start, endTrain);
        const testingData = data.slice(endTrain, endTest);
        
        if (testingData.length === 0) break;

        // Step 1: Optimize parameters in-sample over training slice
        const { results } = runGridSearch(trainingData, optimizationParams.x, optimizationParams.y, strategyType, controlParams);
        
        // Find parameter coordinates maximizing the Sharpe Ratio
        let bestRun = results[0];
        for (let run of results) {
            if (run.sharpe > bestRun.sharpe) {
                bestRun = run;
            }
        }

        // Step 2: Deploy optimized parameters out-of-sample over testing block
        const testStrategyConfig = {
            strategyType,
            params: {
                maType: 'SMA',
                maFast: optimizationParams.x === 'fast_ma' ? bestRun.x : 20,
                maSlow: optimizationParams.y === 'slow_ma' ? bestRun.y : 50,
                rsiPeriod: optimizationParams.x === 'rsi_period' ? bestRun.x : 14,
                rsiOversold: optimizationParams.y === 'rsi_oversold' ? bestRun.y : 30,
                rsiOverbought: optimizationParams.y === 'rsi_oversold' ? (100 - bestRun.y) : 70,
                momPeriod: 10,
                momThreshold: 0
            }
        };

        const testControlParams = {
            ...controlParams,
            initialCapital: currentCash
        };

        const outOfSampleBacktest = runBacktest(testingData, testStrategyConfig, testControlParams);
        
        // Stitch the OOS segment outcomes into the continuous WFO curve
        for (let i = 0; i < testingData.length; i++) {
            const overallIdx = endTrain + i;
            wfoEquityCurve[overallIdx] = outOfSampleBacktest.equityCurve[i];
        }

        // Carry forward ending capital bounds
        const lastIdx = outOfSampleBacktest.equityCurve.length - 1;
        currentCash = outOfSampleBacktest.equityCurve[lastIdx];
    }

    return wfoEquityCurve;
}

// Seeded pseudo-random generator to isolate path reproducibility
function createSeededRandom(seed) {
    let m = 0x80000000; // 2**31
    let a = 1103515245;
    let c = 12345;
    let state = seed ? seed : Math.floor(Math.random() * (m - 1));

    return function() {
        state = (a * state + c) % m;
        return state / (m - 1);
    };
}

// ==========================================
// 8. Stochastic Risk Simulation (Monte Carlo)
// ==========================================

export function runMonteCarlo(trades, initialCapital, horizonDays = 252, simulations = 100) {
    const paths = [];
    const returnSeries = trades.map(t => t.returnPct / 100);

    // Fallback if strategy produced insufficient trades to bootstrap return distribution
    if (returnSeries.length < 3) {
        // Hydrate with low-probability micro variance to prevent program crash
        for (let i = 0; i < 5; i++) returnSeries.push((Math.random() - 0.48) * 0.05);
    }

    // Trade frequency modeling: calculate daily trading rate
    // e.g. average completed trades per day
    const dailyTradeRate = Math.max(0.01, trades.length / horizonDays);

    const rand = createSeededRandom(99);

    for (let sim = 0; sim < simulations; sim++) {
        const path = new Array(horizonDays).fill(initialCapital);
        let equity = initialCapital;

        for (let day = 1; day < horizonDays; day++) {
            // Roll dice: did a trade occur on this simulated trading day?
            if (rand() <= dailyTradeRate) {
                // Bootstrapping: sample historical return with replacement
                const sampleIdx = Math.floor(rand() * returnSeries.length);
                const tradeReturn = returnSeries[sampleIdx];
                
                // Account for fractional position sizes or drawdowns
                equity = equity * (1 + tradeReturn);
            }
            path[day] = parseFloat(equity.toFixed(2));
        }
        paths.push(path);
    }

    // Analyze path distributions percentiles at the terminal horizon boundary
    const terminalValues = paths.map(path => path[horizonDays - 1]);
    terminalValues.sort((a, b) => a - b);

    const p5 = terminalValues[Math.floor(simulations * 0.05)];
    const p25 = terminalValues[Math.floor(simulations * 0.25)];
    const p50 = terminalValues[Math.floor(simulations * 0.50)]; // Median projection
    const p75 = terminalValues[Math.floor(simulations * 0.75)];
    const p95 = terminalValues[Math.floor(simulations * 0.95)];

    // Calculate Risk of Ruin: Probability of any path experiencing a max drawdown > 25%
    let ruinCount = 0;
    for (let sim = 0; sim < simulations; sim++) {
        let peak = initialCapital;
        let breached = false;
        
        for (let day = 0; day < horizonDays; day++) {
            const eqVal = paths[sim][day];
            if (eqVal > peak) peak = eqVal;
            const dd = (peak - eqVal) / peak;
            if (dd >= 0.25) {
                breached = true;
                break;
            }
        }
        if (breached) ruinCount++;
    }

    const ruinProbability = (ruinCount / simulations) * 100;

    return {
        paths,
        p5: parseFloat(((p5 - initialCapital) / initialCapital * 100).toFixed(2)),
        p25: parseFloat(((p25 - initialCapital) / initialCapital * 100).toFixed(2)),
        p50: parseFloat(((p50 - initialCapital) / initialCapital * 100).toFixed(2)),
        p75: parseFloat(((p75 - initialCapital) / initialCapital * 100).toFixed(2)),
        p95: parseFloat(((p95 - initialCapital) / initialCapital * 100).toFixed(2)),
        ruinProbability: parseFloat(ruinProbability.toFixed(2))
    };
}
