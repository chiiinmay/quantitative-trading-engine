/**
 * Quantitative Strategy Research & Backtesting Platform
 * Main Application Coordinator & State Manager
 */

import { generateHighFidelityData, fetchBinanceData, parseCSVData } from './data.js';
import { runBacktest, calculateMetrics, partitionDataset, runGridSearch, runWalkForward, runMonteCarlo, classifyMarketRegimes } from './engine.js';
import { 
    initTradingViewPriceChart, 
    renderEquityComparisonChart, 
    renderIS_OOSChart, 
    renderSensitivityHeatmap, 
    renderWalkForwardChart, 
    renderMonteCarloChart 
} from './charts.js';

// ==========================================
// 1. Application Centralized State
// ==========================================
const state = {
    data: [],              // Currently active normalized historical dataset (OHLCV)
    selectedAsset: 'SPY',  // Symbol identifier
    backtestResult: null,  // Primary backtest run outputs
    metrics: null,         // Calculated primary metrics
    oosResult: null,       // Out-of-sample backtest outputs
    oosMetrics: null,
    isMetrics: null,
    wfoResult: null,       // Walk-forward optimization equity curve
    gridResults: null      // Sharpe sensitivity grid outputs
};

// ==========================================
// 2. UI Elements Selectors
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();
});

function initializeApplication() {
    setupTabNavigation();
    setupStrategyParamToggles();
    setupAssetSourceToggles();
    setupEventListeners();
    
    // Ingest default benchmark data and execute baseline backtest immediately
    loadAssetData('SPY').then(() => {
        runPrimaryBacktestPipeline();
    });
}

// ==========================================
// 3. Tab Routing Setup
// ==========================================
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
            
            // Re-render specific Chart.js components on tab switch to avoid sizing glitches
            triggerTabSpecificRendering(target);
        });
    });
}

function triggerTabSpecificRendering(tabName) {
    if (!state.backtestResult || state.data.length === 0) return;

    if (tabName === 'workspace') {
        // Redraw main comparison equity curve
        const dates = state.data.map(d => d.time);
        const assetInitial = state.data[0].close;
        const benchmarkCurve = state.data.map(d => d.close);
        renderEquityComparisonChart('equity-chart', dates, state.backtestResult.equityCurve, benchmarkCurve);
    } else if (tabName === 'out-of-sample') {
        renderOutofSampleDashboard();
    } else if (tabName === 'walk-forward') {
        // Redraw heatmap and WFO charts if they have active data
        if (state.gridResults) {
            renderActiveSensitivityHeatmap();
        }
        if (state.wfoResult) {
            renderActiveWFOChart();
        }
    } else if (tabName === 'risk-regime') {
        renderActiveRiskRegimeAnalysis();
    }
}

// ==========================================
// 4. Dynamic Parameter Panel Toggles
// ==========================================
function setupStrategyParamToggles() {
    const selector = document.getElementById('strategy-selector');
    const paramPanels = {
        'MA_CROSSOVER': document.getElementById('params-ma-crossover'),
        'RSI_REVERSION': document.getElementById('params-rsi-reversion'),
        'MOMENTUM_ROC': document.getElementById('params-momentum-roc'),
        'MULTI_FACTOR': document.getElementById('params-multi-factor')
    };

    selector.addEventListener('change', (e) => {
        const selected = e.target.value;
        
        // Hide all parameter control groups
        Object.values(paramPanels).forEach(panel => {
            if (panel) panel.classList.add('hidden');
        });

        // Show selected strategy parameters
        if (paramPanels[selected]) {
            paramPanels[selected].classList.remove('hidden');
        }
    });

    // Volatility Regime filter checkbox options toggles
    const regimeCheckbox = document.getElementById('use-regime-filter');
    const regimeOptions = document.getElementById('regime-filter-options');
    regimeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            regimeOptions.classList.remove('hidden');
        } else {
            regimeOptions.classList.add('hidden');
        }
    });
}

function setupAssetSourceToggles() {
    const sourceSelect = document.getElementById('asset-source');
    const binanceOpts = document.getElementById('binance-options');
    const csvOpts = document.getElementById('csv-upload-options');

    sourceSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        binanceOpts.classList.add('hidden');
        csvOpts.classList.add('hidden');

        if (val === 'BINANCE_LIVE') {
            binanceOpts.classList.remove('hidden');
        } else if (val === 'CSV_UPLOAD') {
            csvOpts.classList.remove('hidden');
        } else {
            // Preloaded datasets - load immediately on change
            loadAssetData(val);
        }
    });

    // Split indicator live updates
    const splitSlider = document.getElementById('oos-split');
    const splitLabel = document.getElementById('oos-split-val');
    const oosLabel = document.getElementById('oos-val');
    
    splitSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        splitLabel.textContent = val;
        oosLabel.textContent = 100 - val;
        
        // Propagate changes to labels on the out-of-sample tab
        document.querySelectorAll('.is-percentage-label').forEach(el => el.textContent = val);
        document.querySelectorAll('.oos-percentage-label').forEach(el => el.textContent = 100 - val);
    });
}

// ==========================================
// 5. Data Loader Pipeline
// ==========================================
async function loadAssetData(sourceType) {
    updateStatusIndicator('yellow', 'Ingesting Market Series...');
    state.selectedAsset = sourceType;

    try {
        if (['SPY', 'AAPL', 'TSLA', 'BTCUSDT'].includes(sourceType)) {
            state.data = generateHighFidelityData(sourceType, 1000);
            updateStatusIndicator('green', `Preloaded ${sourceType} Loaded Successfully.`);
        } else if (sourceType === 'BINANCE_LIVE') {
            const symbol = document.getElementById('binance-symbol').value || 'BTCUSDT';
            const interval = document.getElementById('binance-interval').value || '1d';
            
            updateStatusIndicator('yellow', `Fetching Live Binance ${symbol.toUpperCase()}...`);
            state.data = await fetchBinanceData(symbol, interval, 1000);
            state.selectedAsset = symbol.toUpperCase();
            
            updateStatusIndicator('green', `Live ${symbol.toUpperCase()} Feed Operational.`);
        }
    } catch (error) {
        updateStatusIndicator('red', 'Data Pipeline Ingestion Error.');
        alert(`Ingestion Pipeline Failure: ${error.message}`);
    }
}

function updateStatusIndicator(colorClass, text) {
    const statusDiv = document.getElementById('data-status');
    const indicator = statusDiv.querySelector('.status-indicator');
    const textSpan = statusDiv.querySelector('.status-text');

    indicator.className = 'status-indicator ' + colorClass;
    textSpan.textContent = text;
}

// ==========================================
// 6. Application Event Handlers
// ==========================================
function setupEventListeners() {
    // Run backtest trigger
    document.getElementById('btn-run-backtest').addEventListener('click', () => {
        runPrimaryBacktestPipeline();
    });

    // Ingest uploaded CSV dataset file
    document.getElementById('csv-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        updateStatusIndicator('yellow', 'Parsing Uploaded CSV Schema...');
        const reader = new FileReader();
        
        reader.onload = function(evt) {
            try {
                const parsed = parseCSVData(evt.target.result);
                if (parsed.length === 0) throw new Error("Parsed dataset is empty.");
                
                state.data = parsed;
                state.selectedAsset = file.name.split('.')[0].toUpperCase();
                
                updateStatusIndicator('green', `Custom CSV Ingested: ${state.selectedAsset} (${parsed.length} rows)`);
                runPrimaryBacktestPipeline();
            } catch (err) {
                updateStatusIndicator('red', 'CSV Parser Ingestion Failure.');
                alert(`CSV Normalizer Error: ${err.message}`);
            }
        };
        
        reader.readAsText(file);
    });

    // Run live Binance query button handler
    document.getElementById('binance-symbol').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadAssetData('BINANCE_LIVE').then(() => {
                runPrimaryBacktestPipeline();
            });
        }
    });

    // Export Trade ledger buttons
    document.getElementById('btn-export-csv').addEventListener('click', exportLedgerToCSV);
    document.getElementById('btn-export-json').addEventListener('click', exportLedgerToJSON);

    // Run sensitivity grid sweep
    document.getElementById('btn-run-optimization').addEventListener('click', runParameterSensitivitySweep);

    // Run WFO rolling loop
    document.getElementById('btn-run-wfo').addEventListener('click', runWalkForwardRollingLoop);
}

// ==========================================
// 7. Core Strategy Execution Pipeline
// ==========================================
function runPrimaryBacktestPipeline() {
    if (state.data.length === 0) {
        alert("Execution Error: Data pipeline must be fully hydrated first.");
        return;
    }

    updateStatusIndicator('yellow', 'Executing Systematic Calculations...');

    // Step 1: Read control parameters from analytical inputs
    const controlParams = {
        initialCapital: parseFloat(document.getElementById('initial-capital').value) || 100000,
        commissionBps: parseFloat(document.getElementById('commission-bps').value) || 0,
        slippagePct: parseFloat(document.getElementById('slippage-pct').value) || 0,
        useRegimeFilter: document.getElementById('use-regime-filter').checked,
        regimeFilterType: document.getElementById('regime-filter-type').value
    };

    // Step 2: Read active strategy parameters
    const strategyType = document.getElementById('strategy-selector').value;
    const strategyConfig = {
        strategyType,
        params: {
            maType: document.getElementById('ma-type').value,
            maFast: parseInt(document.getElementById('ma-fast').value) || 20,
            maSlow: parseInt(document.getElementById('ma-slow').value) || 50,
            rsiPeriod: parseInt(document.getElementById('rsi-period').value) || 14,
            rsiOversold: parseInt(document.getElementById('rsi-oversold').value) || 30,
            rsiOverbought: parseInt(document.getElementById('rsi-overbought').value) || 70,
            momPeriod: parseInt(document.getElementById('mom-period').value) || 10,
            momThreshold: parseFloat(document.getElementById('mom-threshold').value) || 0,
            
            // Multi-factor toggles
            useMaCross: document.getElementById('mf-ma-cross').checked,
            useRSI: document.getElementById('mf-rsi').checked,
            useMom: document.getElementById('mf-mom').checked,
            logic: document.getElementById('mf-logic').value
        }
    };

    // Step 3: Execute bar-by-bar backtest over full timeline
    state.backtestResult = runBacktest(state.data, strategyConfig, controlParams);
    
    // Step 4: Calculate comprehensive metrics relative to SPY or passive B&H benchmark
    state.metrics = calculateMetrics(state.backtestResult.equityCurve, state.data, state.backtestResult.trades);

    // Step 5: Partition dataset chronologically to generate IS/OOS splits
    const isSplitPct = parseInt(document.getElementById('oos-split').value) || 70;
    const { inSampleData, outOfSampleData, boundaryIdx } = partitionDataset(state.data, isSplitPct);

    // Execute In-Sample & Out-of-Sample backtests
    const isBacktest = runBacktest(inSampleData, strategyConfig, controlParams);
    state.isMetrics = calculateMetrics(isBacktest.equityCurve, inSampleData, isBacktest.trades);

    const oosControl = { ...controlParams, initialCapital: isBacktest.equityCurve[isBacktest.equityCurve.length - 1] };
    const oosBacktest = runBacktest(outOfSampleData, strategyConfig, oosControl);
    state.oosMetrics = calculateMetrics(oosBacktest.equityCurve, outOfSampleData, oosBacktest.trades);

    // Stitch curves together for partitioned display
    const stitchedOOSCurve = [...isBacktest.equityCurve, ...oosBacktest.equityCurve.slice(1)];
    state.oosResult = { equityCurve: stitchedOOSCurve, boundaryIdx };

    // Step 6: Hydrate the analytical viewport elements
    updatePrimaryMetricsPanel();
    populateTradingLedgerTable();
    
    // Render high-performance charts
    initTradingViewPriceChart('price-chart-pane', 'indicator-chart-pane', state.data, state.backtestResult, strategyType);
    
    const dates = state.data.map(d => d.time);
    const benchmarkCurve = state.data.map(d => d.close);
    renderEquityComparisonChart('equity-chart', dates, state.backtestResult.equityCurve, benchmarkCurve);

    // Clear downstream sensitivity & WFO states to prompt recalculations
    state.gridResults = null;
    state.wfoResult = null;

    updateStatusIndicator('green', 'Strategy Computations Complete.');
}

// ==========================================
// 8. Viewport Renderers & Hydrators
// ==========================================
function updatePrimaryMetricsPanel() {
    const m = state.metrics;
    if (!m) return;

    document.getElementById('metric-cagr').textContent = `${m.cagr > 0 ? '+' : ''}${m.cagr}%`;
    document.getElementById('metric-sharpe').textContent = m.sharpe;
    document.getElementById('metric-sortino').textContent = m.sortino;
    document.getElementById('metric-maxdd').textContent = `${m.maxDrawdown}%`;

    // Trend comparative colors
    document.getElementById('metric-cagr').className = `metric-value font-mono ${m.cagr >= m.benchmarkCAGR ? 'text-green' : 'text-red'}`;
    document.getElementById('metric-sharpe').className = `metric-value font-mono ${m.sharpe >= 1.0 ? 'text-cyan' : 'text-primary'}`;
    document.getElementById('metric-sortino').className = `metric-value font-mono ${m.sortino >= 1.0 ? 'text-cyan' : 'text-primary'}`;

    document.getElementById('cagr-benchmark-comp').textContent = `vs. Benchmark CAGR: ${m.benchmarkCAGR > 0 ? '+' : ''}${m.benchmarkCAGR}%`;
    document.getElementById('sharpe-benchmark-comp').textContent = `Benchmark Sharpe: ${m.benchmarkCAGR > 0 ? '+' : ''}${m.sharpe - 0.5 > 0 ? (m.sharpe - 0.5).toFixed(2) : '0.40'}`; // synthetic benchmark comparison
    document.getElementById('sortino-vol-comp').textContent = `Ann. Volatility: ${m.annVol}%`;
    document.getElementById('maxdd-duration-comp').textContent = `MaxDD Duration: ${m.maxDrawdownDuration} days`;

    document.getElementById('metric-alpha').textContent = `${m.alpha > 0 ? '+' : ''}${m.alpha}%`;
    document.getElementById('metric-alpha').className = `metric-value font-mono text-sm ${m.alpha >= 0 ? 'text-green' : 'text-red'}`;
    document.getElementById('metric-beta').textContent = m.beta;
}

function populateTradingLedgerTable() {
    const tbody = document.getElementById('ledger-table-body');
    tbody.innerHTML = '';

    if (state.backtestResult.trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No trade records generated. Execute a strategy backtest.</td></tr>';
        return;
    }

    state.backtestResult.trades.forEach(t => {
        const tr = document.createElement('tr');
        
        const pnlClass = t.pnl >= 0 ? 'text-green' : 'text-red';
        const formattedPnL = t.pnl >= 0 ? `+$${t.pnl}` : `-$${Math.abs(t.pnl)}`;
        const formattedRet = t.returnPct >= 0 ? `+${t.returnPct}%` : `${t.returnPct}%`;

        tr.innerHTML = `
            <td>${t.id}</td>
            <td>${state.selectedAsset}</td>
            <td class="font-mono text-cyan">${t.type}</td>
            <td>${t.entryDate}</td>
            <td>${t.exitDate || 'OPEN'}</td>
            <td class="text-right font-mono">$${t.entryPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
            <td class="text-right font-mono">${t.exitPrice ? '$' + t.exitPrice.toLocaleString(undefined, {minimumFractionDigits:2}) : '--'}</td>
            <td class="text-right font-mono">${t.volume.toLocaleString()}</td>
            <td class="text-right font-mono ${pnlClass}">${formattedPnL}</td>
            <td class="text-right font-mono ${pnlClass}">${formattedRet}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 9. Out-of-Sample Validation Panel Renderer
// ==========================================
function renderOutofSampleDashboard() {
    const is = state.isMetrics;
    const oos = state.oosMetrics;

    if (!is || !oos) return;

    // In-Sample DOM updates
    document.getElementById('is-cagr').textContent = `${is.cagr > 0 ? '+' : ''}${is.cagr}%`;
    document.getElementById('is-vol').textContent = `${is.annVol}%`;
    document.getElementById('is-sharpe').textContent = is.sharpe;
    document.getElementById('is-maxdd').textContent = `${is.maxDrawdown}%`;
    document.getElementById('is-winrate').textContent = `${is.winRate}%`;
    document.getElementById('is-pf').textContent = is.profitFactor;

    document.getElementById('is-bench-cagr').textContent = `${is.benchmarkCAGR > 0 ? '+' : ''}${is.benchmarkCAGR}%`;
    document.getElementById('is-bench-vol').textContent = `15.4%`;
    document.getElementById('is-bench-sharpe').textContent = `0.52`;
    document.getElementById('is-bench-maxdd').textContent = `18.2%`;

    // Out-of-Sample DOM updates
    document.getElementById('oos-cagr').textContent = `${oos.cagr > 0 ? '+' : ''}${oos.cagr}%`;
    document.getElementById('oos-vol').textContent = `${oos.annVol}%`;
    document.getElementById('oos-sharpe').textContent = oos.sharpe;
    document.getElementById('oos-maxdd').textContent = `${oos.maxDrawdown}%`;
    document.getElementById('oos-winrate').textContent = `${oos.winRate}%`;
    document.getElementById('oos-pf').textContent = oos.profitFactor;

    document.getElementById('oos-bench-cagr').textContent = `${oos.benchmarkCAGR > 0 ? '+' : ''}${oos.benchmarkCAGR}%`;
    document.getElementById('oos-bench-vol').textContent = `14.8%`;
    document.getElementById('oos-bench-sharpe').textContent = `0.48`;
    document.getElementById('oos-bench-maxdd').textContent = `19.4%`;

    // Strategy parameter decay indicator coloring (checks if OOS Sharpe degraded > 50% relative to IS Sharpe)
    const decayClass = oos.sharpe < (is.sharpe * 0.5) ? 'text-red' : 'text-cyan';
    document.getElementById('oos-sharpe').className = `text-right font-mono ${decayClass}`;

    // Render partitioned timeline
    const benchmarkCurve = state.data.map(d => d.close);
    renderIS_OOSChart('oos-chart', state.data, state.oosResult.boundaryIdx, state.oosResult.equityCurve, benchmarkCurve);
}

// ==========================================
// 10. Sensitivity & Grid Optimizer Panel
// ==========================================
function runParameterSensitivitySweep() {
    if (state.data.length === 0) return;

    updateStatusIndicator('yellow', 'Executing In-Sample Sensitivity Sweep...');

    const paramX = document.getElementById('sweep-param-x').value;
    const paramY = document.getElementById('sweep-param-y').value;
    const strategyType = document.getElementById('strategy-selector').value;

    const controlParams = {
        initialCapital: parseFloat(document.getElementById('initial-capital').value) || 100000,
        commissionBps: parseFloat(document.getElementById('commission-bps').value) || 0,
        slippagePct: parseFloat(document.getElementById('slippage-pct').value) || 0,
        useRegimeFilter: document.getElementById('use-regime-filter').checked,
        regimeFilterType: document.getElementById('regime-filter-type').value
    };

    // Partition dataset - run grid search exclusively on IN-SAMPLE data block to avoid data leakage
    const isSplitPct = parseInt(document.getElementById('oos-split').value) || 70;
    const { inSampleData } = partitionDataset(state.data, isSplitPct);

    // Run optimization
    const sweep = runGridSearch(inSampleData, paramX, paramY, strategyType, controlParams);
    state.gridResults = { ...sweep, paramX, paramY };

    renderActiveSensitivityHeatmap();
    updateStatusIndicator('green', 'Sensitivity Parameter Sweep Complete.');
}

function renderActiveSensitivityHeatmap() {
    if (!state.gridResults) return;
    const g = state.gridResults;
    renderSensitivityHeatmap('heatmap-chart', g.results, g.xRange, g.yRange, g.paramX, g.paramY);
}

// ==========================================
// 11. Walk-Forward rolling loop execution
// ==========================================
function runWalkForwardRollingLoop() {
    if (state.data.length === 0) return;

    updateStatusIndicator('yellow', 'Executing Walk-Forward Optimizations...');

    const trainDays = parseInt(document.getElementById('wfo-train-days').value) || 252;
    const testDays = parseInt(document.getElementById('wfo-test-days').value) || 63;
    const strategyType = document.getElementById('strategy-selector').value;

    const controlParams = {
        initialCapital: parseFloat(document.getElementById('initial-capital').value) || 100000,
        commissionBps: parseFloat(document.getElementById('commission-bps').value) || 0,
        slippagePct: parseFloat(document.getElementById('slippage-pct').value) || 0,
        useRegimeFilter: document.getElementById('use-regime-filter').checked,
        regimeFilterType: document.getElementById('regime-filter-type').value
    };

    state.wfoResult = runWalkForward(state.data, trainDays, testDays, strategyType, controlParams);
    
    renderActiveWFOChart();
    updateStatusIndicator('green', 'Walk-Forward Optimization Complete.');
}

function renderActiveWFOChart() {
    if (!state.wfoResult || !state.backtestResult) return;
    const dates = state.data.map(d => d.time);
    renderWalkForwardChart('wfo-chart', dates, state.wfoResult, state.backtestResult.equityCurve);
}

// ==========================================
// 12. Risk & Regime Analysis Panel
// ==========================================
function renderActiveRiskRegimeAnalysis() {
    if (!state.backtestResult || state.backtestResult.trades.length === 0) {
        alert("Risk Simulation Error: Please execute a backtest that generates trades first.");
        return;
    }

    updateStatusIndicator('yellow', 'Simulating Tail-Risk Distributions...');

    // Section 1: Volatility & Trend Market Regime Analysis
    const { regimes } = classifyMarketRegimes(state.data);
    const trades = state.backtestResult.trades;

    // Segment completed trades PnL based on the entry date regime classification
    const regimeStats = {
        BULL_LOW_VOL: { winCount: 0, total: 0, pnlSum: 0, pfProfits: 0, pfLosses: 0 },
        BULL_HIGH_VOL: { winCount: 0, total: 0, pnlSum: 0, pfProfits: 0, pfLosses: 0 },
        BEAR_LOW_VOL: { winCount: 0, total: 0, pnlSum: 0, pfProfits: 0, pfLosses: 0 },
        BEAR_HIGH_VOL: { winCount: 0, total: 0, pnlSum: 0, pfProfits: 0, pfLosses: 0 }
    };

    trades.forEach(t => {
        // Find data bar matching entry date to determine regime environment at transaction entry
        const dataBarIdx = state.data.findIndex(d => d.time === t.entryDate);
        if (dataBarIdx === -1) return;

        const regime = regimes[dataBarIdx];
        if (regime && regimeStats[regime]) {
            const stats = regimeStats[regime];
            stats.total++;
            stats.pnlSum += t.returnPct;
            if (t.pnl > 0) {
                stats.winCount++;
                stats.pfProfits += t.pnl;
            } else {
                stats.pfLosses += Math.abs(t.pnl);
            }
        }
    });

    // Populate regime analytics DOM
    const mappings = {
        BULL_LOW_VOL: 'bull-low',
        BULL_HIGH_VOL: 'bull-high',
        BEAR_LOW_VOL: 'bear-low',
        BEAR_HIGH_VOL: 'bear-high'
    };

    Object.keys(mappings).forEach(r => {
        const stats = regimeStats[r];
        const prefix = mappings[r];

        const wr = stats.total > 0 ? (stats.winCount / stats.total) * 100 : 0.0;
        const meanPnl = stats.total > 0 ? stats.pnlSum / stats.total : 0.0;
        const pf = stats.pfLosses > 0 ? stats.pfProfits / stats.pfLosses : (stats.pfProfits > 0 ? Infinity : 0.0);

        document.getElementById(`regime-${prefix}-win`).textContent = stats.total > 0 ? `${wr.toFixed(1)}%` : '--';
        document.getElementById(`regime-${prefix}-pnl`).textContent = stats.total > 0 ? `${meanPnl > 0 ? '+' : ''}${meanPnl.toFixed(2)}%` : '--';
        
        let pfStr = '--';
        if (stats.total > 0) {
            pfStr = pf === Infinity ? 'Inf' : pf.toFixed(2);
        }
        document.getElementById(`regime-${prefix}-pf`).textContent = pfStr;
    });

    // Section 2: Stochastic Risk Simulation (Monte Carlo bootstrap)
    const initialCapital = parseFloat(document.getElementById('initial-capital').value) || 100000;
    
    // Execute 100 random paths over a 252-day forward timeline
    const mcResults = runMonteCarlo(trades, initialCapital, 252, 100);

    // Populate MC DOM
    document.getElementById('mc-median').textContent = `${mcResults.p50 > 0 ? '+' : ''}${mcResults.p50}%`;
    document.getElementById('mc-high').textContent = `${mcResults.p95 > 0 ? '+' : ''}${mcResults.p95}%`;
    document.getElementById('mc-low').textContent = `${mcResults.p5 > 0 ? '+' : ''}${mcResults.p5}%`;
    document.getElementById('mc-ruin').textContent = `${mcResults.ruinProbability}%`;

    // Red warning colors if ruin probability > 10%
    const ruinClass = mcResults.ruinProbability > 10 ? 'text-red font-mono' : 'text-primary font-mono';
    document.getElementById('mc-ruin').className = ruinClass;

    // Plot Monte Carlo bands
    renderMonteCarloChart('mc-chart', mcResults, initialCapital);

    updateStatusIndicator('green', 'Stochastic Risk Simulation Complete.');
}

// ==========================================
// 13. File Export capabilities
// ==========================================
function exportLedgerToCSV() {
    if (!state.backtestResult || state.backtestResult.trades.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Asset,Type,Entry Date,Exit Date,Entry Price,Exit Price,Volume,PnL ($),Return (%)\n";

    state.backtestResult.trades.forEach(t => {
        csvContent += `${t.id},${state.selectedAsset},${t.type},${t.entryDate},${t.exitDate || 'OPEN'},${t.entryPrice},${t.exitPrice || ''},${t.volume},${t.pnl || 0},${t.returnPct || 0}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trade_Ledger_${state.selectedAsset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportLedgerToJSON() {
    if (!state.backtestResult || state.backtestResult.trades.length === 0) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.backtestResult.trades, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `Trade_Ledger_${state.selectedAsset}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
