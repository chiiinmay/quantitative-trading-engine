/**
 * Quantitative Strategy Research & Backtesting Platform
 * Mathematical Engine Validation Runner
 * 
 * Verifies calculation accuracy of Indicators, Risk Metrics, and Drawdown Duration.
 */

import { calculateSMA, calculateEMA, calculateMetrics, runBacktest } from '../js/engine.js';

// Minimal Assertion Runner
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILURE: ${message}`);
        throw new Error(message);
    }
    console.log(`✅ Passed: ${message}`);
}

function runVerificationSuite() {
    console.log("====================================================");
    console.log("   STARTING QUANT ENGINE MATHEMATICAL VERIFICATION  ");
    console.log("====================================================");

    // Test Case 1: Simple Moving Average (SMA) Calculation Accuracy
    // Close values: [10, 12, 14, 16, 18, 20]
    // 3-Period SMA should be: [null, null, (10+12+14)/3, (12+14+16)/3, (14+16+18)/3, (16+18+20)/3]
    // = [null, null, 12, 14, 16, 18]
    const mockData1 = [
        { close: 10 }, { close: 12 }, { close: 14 },
        { close: 16 }, { close: 18 }, { close: 20 }
    ];
    
    const sma3 = calculateSMA(mockData1, 3);
    assert(sma3[0] === null && sma3[1] === null, "SMA pads initial periods with null");
    assert(sma3[2] === 12.0, `SMA index 2 should be 12.0, got ${sma3[2]}`);
    assert(sma3[3] === 14.0, `SMA index 3 should be 14.0, got ${sma3[3]}`);
    assert(sma3[4] === 16.0, `SMA index 4 should be 16.0, got ${sma3[4]}`);
    assert(sma3[5] === 18.0, `SMA index 5 should be 18.0, got ${sma3[5]}`);

    // Test Case 2: Exponential Moving Average (EMA) Calculation Accuracy
    // 3-Period EMA starting SMA seed: (10+12+14)/3 = 12.0
    // Multiplier = 2 / (3 + 1) = 0.5
    // EMA[3] = (16 - EMA[2])*0.5 + EMA[2] = (16 - 12)*0.5 + 12 = 14.0
    // EMA[4] = (18 - EMA[3])*0.5 + EMA[3] = (18 - 14)*0.5 + 14 = 16.0
    // EMA[5] = (20 - EMA[4])*0.5 + EMA[4] = (20 - 16)*0.5 + 16 = 18.0
    const ema3 = calculateEMA(mockData1, 3);
    assert(ema3[0] === null && ema3[1] === null, "EMA pads initial periods with null");
    assert(ema3[2] === 12.0, `EMA seed index 2 should be 12.0, got ${ema3[2]}`);
    assert(ema3[3] === 14.0, `EMA index 3 should be 14.0, got ${ema3[3]}`);
    assert(ema3[4] === 16.0, `EMA index 4 should be 16.0, got ${ema3[4]}`);
    assert(ema3[5] === 18.0, `EMA index 5 should be 18.0, got ${ema3[5]}`);

    // Test Case 3: Maximum Drawdown (MaxDD) & Drawdown Duration Calculations
    // Equity Timeline: [1000, 1200, 900, 800, 1100, 1300]
    // Peak: 1200 at index 1
    // Valley: 800 at index 3
    // Drawdown = (1200 - 800) / 1200 = 400 / 1200 = 33.33%
    // Drawdown duration from index 2 to 3 (2 steps = 2 days under peak)
    const mockEquity = [1000, 1200, 900, 800, 1100, 1300];
    const mockDataTimeline = [
        { time: '2026-01-01', close: 10 },
        { time: '2026-01-02', close: 12 },
        { time: '2026-01-03', close: 9 },
        { time: '2026-01-04', close: 8 },
        { time: '2026-01-05', close: 11 },
        { time: '2026-01-06', close: 13 }
    ];
    const mockTrades = [
        { id: 1, type: 'LONG', entryDate: '2026-01-01', exitDate: '2026-01-04', entryPrice: 10, exitPrice: 8, volume: 100, pnl: -200, returnPct: -20 }
    ];

    const metrics = calculateMetrics(mockEquity, mockDataTimeline, mockTrades, 0.0);
    assert(metrics.maxDrawdown === 33.33, `Maximum Drawdown should be 33.33%, got ${metrics.maxDrawdown}%`);
    assert(metrics.maxDrawdownDuration === 3, `MaxDD Duration should be 3 days, got ${metrics.maxDrawdownDuration}`);

    // Test Case 4: CAGR calculation sanity check
    // Equity grows from 1000 to 1300 over 5 trading days (~7 calendar days)
    // CAGR should be positive and realistic
    assert(metrics.cagr > 0 && metrics.totalReturn === 30.00, `Total Return should be 30%, got ${metrics.totalReturn}%`);

    console.log("====================================================");
    console.log("   ❌ ZERO MATHEMATICAL OR LOGICAL ERRORS DETECTED   ");
    console.log("   SYSTEM ENGINE VALUATION FULLY CONFIRMED & PASSES  ");
    console.log("====================================================");
}

// Check if running in Node directly to execute
if (typeof process !== 'undefined' && process.release && process.release.name === 'node') {
    runVerificationSuite();
} else {
    // Run in browser console context
    runVerificationSuite();
}
export { runVerificationSuite };
