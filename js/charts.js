/**
 * Quantitative Strategy Research & Backtesting Platform
 * High-Density Analytical Charting Suite (Lightweight Charts & Chart.js)
 */

let priceChart = null;
let indicatorChart = null;
let candleSeries = null;
let fastLineSeries = null;
let slowLineSeries = null;
let indLineSeries = null;

// Track active Chart.js instances to destroy and clean up canvases between runs
const chartInstances = {
    equity: null,
    oos: null,
    heatmap: null,
    wfo: null,
    mc: null
};

// ==========================================
// 1. TradingView Lightweight Charts Engine
// ==========================================

export function initTradingViewPriceChart(containerId, indicatorContainerId, data, backtestResult, strategyType) {
    // 1. Cleanup existing chart instances
    const container = document.getElementById(containerId);
    const indContainer = document.getElementById(indicatorContainerId);
    
    if (priceChart) {
        priceChart.remove();
        priceChart = null;
    }
    if (indicatorChart) {
        indicatorChart.remove();
        indicatorChart = null;
    }
    
    container.innerHTML = '';
    indContainer.innerHTML = '';

    const chartOptions = {
        layout: {
            background: { type: 'solid', color: '#0b0e14' },
            textColor: '#94a3b8',
        },
        grid: {
            vertLines: { color: '#1e293b' },
            horzLines: { color: '#1e293b' },
        },
        crosshair: {
            mode: 0, // Normal crosshair
        },
        rightPriceScale: {
            borderColor: '#202b3e',
        },
        timeScale: {
            borderColor: '#202b3e',
            timeVisible: true,
            secondsVisible: false,
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
        },
        handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
        }
    };

    // Initialize Main Candlestick Chart
    priceChart = LightweightCharts.createChart(container, {
        ...chartOptions,
        height: container.clientHeight || 340
    });
    
    candleSeries = priceChart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
    });

    // Parse data to TradingView format
    const formattedCandles = data.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
    }));
    candleSeries.setData(formattedCandles);

    // Initialize Indicator subplot chart if required
    const showIndicator = ['RSI_REVERSION', 'MOMENTUM_ROC'].includes(strategyType) || 
                          (strategyType === 'MULTI_FACTOR' && backtestResult.indicatorValues);
                          
    if (showIndicator) {
        indContainer.classList.remove('hidden');
        
        indicatorChart = LightweightCharts.createChart(indContainer, {
            ...chartOptions,
            height: indContainer.clientHeight || 120,
            timeScale: {
                ...chartOptions.timeScale,
                visible: false // Hide time scale on indicator sub-plot
            }
        });

        let lineCol = '#0ea5e9';
        let titleName = 'Indicator';

        if (strategyType === 'RSI_REVERSION') {
            titleName = 'RSI';
            lineCol = '#a855f7'; // Purple for RSI
            
            // Add RSI bounds lines (30/70)
            const rsiScale = indicatorChart.rightPriceScale();
            indicatorChart.rightPriceScale().setOptions({
                autoscale: false,
                scaleMargins: { top: 0.1, bottom: 0.1 }
            });
        } else if (strategyType === 'MOMENTUM_ROC') {
            titleName = 'Momentum (ROC)';
            lineCol = '#eab308'; // Yellow for Momentum
        }

        indLineSeries = indicatorChart.addLineSeries({
            color: lineCol,
            lineWidth: 1.5,
            title: titleName
        });

        // Set indicator values
        const formattedIndData = [];
        for (let i = 0; i < data.length; i++) {
            if (backtestResult.indicatorValues && backtestResult.indicatorValues[i] !== null) {
                formattedIndData.push({
                    time: data[i].time,
                    value: backtestResult.indicatorValues[i]
                });
            }
        }
        indLineSeries.setData(formattedIndData);

        // Sync timescale zoom/scroll between Price and Indicator panes
        let isSyncing = false;
        priceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (isSyncing) return;
            isSyncing = true;
            indicatorChart.timeScale().setVisibleLogicalRange(range);
            isSyncing = false;
        });

        indicatorChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (isSyncing) return;
            isSyncing = true;
            priceChart.timeScale().setVisibleLogicalRange(range);
            isSyncing = false;
        });
    } else {
        indContainer.classList.add('hidden');
    }

    // Overlay Fast/Slow MA lines if crossover strategy is selected
    if (strategyType === 'MA_CROSSOVER' && backtestResult.fastMA && backtestResult.slowMA) {
        fastLineSeries = priceChart.addLineSeries({
            color: '#38bdf8',
            lineWidth: 1.5,
            title: `Fast MA (${backtestResult.fastMA.filter(x=>x!==null).length > 0 ? 'Active' : ''})`
        });
        
        slowLineSeries = priceChart.addLineSeries({
            color: '#f43f5e',
            lineWidth: 1.5,
            title: 'Slow MA'
        });

        const fastData = [];
        const slowData = [];
        for (let i = 0; i < data.length; i++) {
            if (backtestResult.fastMA[i] !== null) {
                fastData.push({ time: data[i].time, value: backtestResult.fastMA[i] });
            }
            if (backtestResult.slowMA[i] !== null) {
                slowData.push({ time: data[i].time, value: backtestResult.slowMA[i] });
            }
        }

        fastLineSeries.setData(fastData);
        slowLineSeries.setData(slowData);
    }

    // Map trade transactions onto exact execution bars as markers
    const markers = [];
    backtestResult.signals.forEach((sig, idx) => {
        if (sig === 1) {
            markers.push({
                time: data[idx].time,
                position: 'belowBar',
                color: '#10b981',
                shape: 'arrowUp',
                text: 'BUY'
            });
        } else if (sig === -1) {
            markers.push({
                time: data[idx].time,
                position: 'aboveBar',
                color: '#ef4444',
                shape: 'arrowDown',
                text: 'EXIT'
            });
        }
    });

    candleSeries.setMarkers(markers);
    priceChart.timeScale().fitContent();

    // Asynchronously resize charts after parent layout calculations settle
    setTimeout(() => {
        if (priceChart && container) {
            priceChart.resize(container.clientWidth || 800, container.clientHeight || 340);
        }
        if (indicatorChart && indContainer) {
            indicatorChart.resize(indContainer.clientWidth || 800, indContainer.clientHeight || 120);
        }
    }, 100);
}

// ==========================================
// 2. Chart.js Custom Theming configuration
// ==========================================

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 11 }
            }
        },
        tooltip: {
            titleFont: { family: 'Fira Code' },
            bodyFont: { family: 'Fira Code' }
        }
    },
    scales: {
        x: {
            grid: { color: '#202b3e' },
            ticks: {
                color: '#64748b',
                font: { family: 'Fira Code', size: 10 }
            }
        },
        y: {
            grid: { color: '#202b3e' },
            ticks: {
                color: '#64748b',
                font: { family: 'Fira Code', size: 10 }
            }
        }
    }
};

// ==========================================
// 3. Render Cumulative Performance (Workspace)
// ==========================================

export function renderEquityComparisonChart(canvasId, dates, strategyCurve, benchmarkCurve) {
    if (chartInstances.equity) {
        chartInstances.equity.destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Normalize curves relative to $100 base to represent percentages
    const startStrat = strategyCurve[0];
    const startBench = benchmarkCurve[0];
    const normalizedStrat = strategyCurve.map(v => (v - startStrat) / startStrat * 100);
    const normalizedBench = benchmarkCurve.map(v => (v - startBench) / startBench * 100);

    chartInstances.equity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Deterministic Systematic Strategy',
                    data: normalizedStrat,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Passive Market Index (Benchmark B&H)',
                    data: normalizedBench,
                    borderColor: '#64748b',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
                    }
                }
            }
        }
    });
}

// ==========================================
// 4. Render Partitioned IS / OOS Chart
// ==========================================

export function renderIS_OOSChart(canvasId, data, boundaryIdx, strategyCurve, benchmarkCurve) {
    if (chartInstances.oos) {
        chartInstances.oos.destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    const dates = data.map(d => d.time);

    const startStrat = strategyCurve[0];
    const startBench = benchmarkCurve[0];
    const normalizedStrat = strategyCurve.map(v => (v - startStrat) / startStrat * 100);
    const normalizedBench = benchmarkCurve.map(v => (v - startBench) / startBench * 100);

    // Create partitioned segments (In-Sample / Out-of-Sample)
    const isCurve = normalizedStrat.map((v, i) => i <= boundaryIdx ? v : null);
    const oosCurve = normalizedStrat.map((v, i) => i >= boundaryIdx ? v : null);

    chartInstances.oos = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'In-Sample Parameter Training (IS)',
                    data: isCurve,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.04)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Out-of-Sample Parameter Validation (OOS)',
                    data: oosCurve,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.04)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Benchmark Index (B&H)',
                    data: normalizedBench,
                    borderColor: '#64748b',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
                    }
                }
            },
            plugins: {
                ...chartDefaults.plugins,
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: dates[boundaryIdx],
                            xMax: dates[boundaryIdx],
                            borderColor: '#a855f7',
                            borderWidth: 1.5,
                            borderDash: [6, 6],
                            label: {
                                content: 'Validation Boundary',
                                display: true,
                                position: 'top',
                                color: '#a855f7',
                                font: { family: 'Fira Code', size: 9 }
                            }
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// 5. Render Parameter sensitivity Heatmap
// ==========================================

export function renderSensitivityHeatmap(canvasId, gridResults, xRange, yRange, paramNameX, paramNameY) {
    if (chartInstances.heatmap) {
        chartInstances.heatmap.destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Map grid coordinates to bubble values to render natively on vanilla Chart.js
    const bubbleData = gridResults.map(r => {
        // Map Sharpe value into color gradient (Red -> Grey -> Cyan)
        const sharpe = r.sharpe;
        let color = 'rgba(239, 68, 68, 0.7)'; // Red default for negative
        
        if (sharpe >= 0.0 && sharpe < 1.0) {
            color = 'rgba(148, 163, 184, 0.5)'; // Slate for low Sharpe
        } else if (sharpe >= 1.0 && sharpe < 1.8) {
            color = 'rgba(14, 165, 233, 0.7)'; // Light cyan for moderate Sharpe
        } else if (sharpe >= 1.8) {
            color = 'rgba(16, 185, 129, 0.8)'; // Emerald/Green for excellent Sharpe
        }

        return {
            x: r.x,
            y: r.y,
            r: Math.max(4, Math.min(22, 6 + (sharpe * 5))), // Scale radius based on Sharpe
            sharpe: sharpe,
            color: color
        };
    });

    const xLabel = paramNameX === 'fast_ma' ? 'Fast MA Period' : 'RSI Period';
    const yLabel = paramNameY === 'slow_ma' ? 'Slow MA Period' : 'RSI Oversold Level';

    chartInstances.heatmap = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Sensitivity Grid Point (Radius = Sharpe Ratio)',
                data: bubbleData,
                backgroundColor: bubbleData.map(b => b.color),
                borderColor: 'rgba(32, 43, 62, 0.6)',
                borderWidth: 1
            }]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const p = context.raw;
                            return `[${xLabel}: ${p.x}, ${yLabel}: ${p.y}] Sharpe: ${p.sharpe.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ...chartDefaults.scales.x,
                    title: { display: true, text: xLabel, color: '#94a3b8', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    ...chartDefaults.scales.y,
                    title: { display: true, text: yLabel, color: '#94a3b8', font: { family: 'Inter', size: 10 } }
                }
            }
        }
    });
}

// ==========================================
// 6. Render Walk-Forward Equity Timeline
// ==========================================

export function renderWalkForwardChart(canvasId, dates, wfoCurve, staticCurve) {
    if (chartInstances.wfo) {
        chartInstances.wfo.destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const startWFO = wfoCurve[0];
    const startStatic = staticCurve[0];
    const normalizedWFO = wfoCurve.map(v => (v - startWFO) / startWFO * 100);
    const normalizedStatic = staticCurve.map(v => (v - startStatic) / startStatic * 100);

    chartInstances.wfo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Walk-Forward Rolling Equity (Regime Adaptive)',
                    data: normalizedWFO,
                    borderColor: '#a855f7', // Purple
                    backgroundColor: 'rgba(168, 85, 247, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Static Optimized Parameter Baseline',
                    data: normalizedStatic,
                    borderColor: '#64748b',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
                    }
                }
            }
        }
    });
}

// ==========================================
// 7. Render Forward Equity Distribution Bands (Monte Carlo)
// ==========================================

export function renderMonteCarloChart(canvasId, mcResults, initialCapital) {
    if (chartInstances.mc) {
        chartInstances.mc.destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    const horizon = mcResults.paths[0].length;
    const labels = Array.from({ length: horizon }, (_, i) => `Day ${i}`);

    // Extract percentiles
    const p5 = mcResults.paths.map(() => initialCapital); // Initialize template
    const p25 = mcResults.paths.map(() => initialCapital);
    const p50 = mcResults.paths.map(() => initialCapital);
    const p75 = mcResults.paths.map(() => initialCapital);
    const p95 = mcResults.paths.map(() => initialCapital);

    // Compute percentile limits day-by-day
    for (let d = 0; d < horizon; d++) {
        const dayVals = mcResults.paths.map(path => path[d]);
        dayVals.sort((a, b) => a - b);
        p5[d] = (dayVals[Math.floor(mcResults.paths.length * 0.05)] - initialCapital) / initialCapital * 100;
        p25[d] = (dayVals[Math.floor(mcResults.paths.length * 0.25)] - initialCapital) / initialCapital * 100;
        p50[d] = (dayVals[Math.floor(mcResults.paths.length * 0.50)] - initialCapital) / initialCapital * 100;
        p75[d] = (dayVals[Math.floor(mcResults.paths.length * 0.75)] - initialCapital) / initialCapital * 100;
        p95[d] = (dayVals[Math.floor(mcResults.paths.length * 0.95)] - initialCapital) / initialCapital * 100;
    }

    // Select 3 sample paths to plot as underlying lines
    const samplePath1 = mcResults.paths[0].map(v => (v - initialCapital) / initialCapital * 100);
    const samplePath2 = mcResults.paths[14].map(v => (v - initialCapital) / initialCapital * 100);
    const samplePath3 = mcResults.paths[29].map(v => (v - initialCapital) / initialCapital * 100);

    chartInstances.mc = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '95th Percentile Bound',
                    data: p95,
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1.5
                },
                {
                    label: '75th Percentile Line',
                    data: p75,
                    borderColor: 'rgba(14, 165, 233, 0.3)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                },
                {
                    label: '50th Percentile Median Projection',
                    data: p50,
                    borderColor: '#0ea5e9', // Blue
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2
                },
                {
                    label: '25th Percentile Line',
                    data: p25,
                    borderColor: 'rgba(239, 68, 68, 0.2)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                },
                {
                    label: '5th Percentile Bound',
                    data: p5,
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1.5
                },
                {
                    label: 'Stochastic Path 1',
                    data: samplePath1,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Stochastic Path 2',
                    data: samplePath2,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Stochastic Path 3',
                    data: samplePath3,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    ticks: {
                        ...chartDefaults.scales.y.ticks,
                        callback: (value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`
                    }
                }
            }
        }
    });
}
