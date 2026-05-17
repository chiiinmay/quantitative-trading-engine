/**
 * Quantitative Strategy Research & Backtesting Platform
 * Data Ingestion & Schema Normalization Pipeline
 */

// Seeded pseudo-random generator to ensure exact mathematical reproducibility
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

/**
 * Simulates high-fidelity daily historical market data using Geometric Brownian Motion (GBM)
 * augmented with volatility regimes and structural trends to mimic real stock and crypto behaviors.
 * @param {string} symbol - Asset identifier (SPY, AAPL, TSLA, BTCUSDT)
 * @param {number} length - Number of daily candles to generate (default 1000)
 * @returns {Array} Array of normalized OHLCV objects
 */
export function generateHighFidelityData(symbol, length = 1000) {
    const data = [];
    const rand = createSeededRandom(42); // Locked seed for deterministic series consistency
    
    // Base parameter configurations based on actual asset characteristics (approx. 2022-2026 dynamics)
    let price = 100.0;
    let dailyDrift = 0.0003; // ~7.5% annual return
    let dailyVol = 0.01;     // ~16% annual volatility
    let volumeBase = 100000;
    let isCrypto = false;

    if (symbol === 'SPY') {
        price = 380.0;
        dailyDrift = 0.00035; // Steady benchmark upward drift
        dailyVol = 0.0095;    // Low-volatility index standard (~15% annualized)
        volumeBase = 80000000;
    } else if (symbol === 'AAPL') {
        price = 140.0;
        dailyDrift = 0.00045; // Tech growth drift (~11% annual)
        dailyVol = 0.013;     // Tech growth standard (~20% annualized)
        volumeBase = 50000000;
    } else if (symbol === 'TSLA') {
        price = 220.0;
        dailyDrift = 0.0005;  // High drift
        dailyVol = 0.025;     // High volatility equity (~40% annualized)
        volumeBase = 90000000;
    } else if (symbol === 'BTCUSDT') {
        price = 20000.0;
        dailyDrift = 0.0008;  // High growth rate
        dailyVol = 0.035;     // High crypto volatility (~55% annualized)
        volumeBase = 45000;
        isCrypto = true;
    }

    // Set starting date to approximately 4 calendar years ago
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - (length * 1.4)); // accounting for weekends

    for (let i = 0; i < length; i++) {
        // Increment date, skipping weekends for traditional equities
        do {
            currentDate.setDate(currentDate.getDate() + 1);
        } while (!isCrypto && (currentDate.getDay() === 0 || currentDate.getDay() === 6));

        // Incorporate structural market regimes (volatility clustering & regime shifts)
        let regimeModifier = 1.0;
        let driftModifier = 1.0;
        
        // Volatility regime shock blocks (e.g. panic cycles or expansion periods)
        if (i > 250 && i < 380) {
            regimeModifier = 1.8;  // High Volatility / Bear regime
            driftModifier = -1.5;
        } else if (i > 550 && i < 700) {
            regimeModifier = 0.6;  // Low Volatility / Quiet Bull regime
            driftModifier = 1.3;
        } else if (i > 820 && i < 900) {
            regimeModifier = 1.5;  // High Volatility Spike
            driftModifier = -0.5;
        }

        // Geometric Brownian Motion step
        // dS = S * (mu*dt + sigma*dW)
        const randNormal = (rand() + rand() + rand() + rand() + rand() + rand() - 3) / 1.73; // Box-Muller approximation
        const returns = (dailyDrift * driftModifier) + (dailyVol * regimeModifier * randNormal);
        
        const open = price;
        price = price * Math.exp(returns);
        const close = price;

        // Generate intra-period high and low bounds relative to volatility
        const maxRange = dailyVol * regimeModifier * price * 2.2;
        const upShock = rand() * maxRange;
        const downShock = rand() * maxRange;
        
        const high = Math.max(open, close) + upShock;
        const low = Math.min(open, close) - downShock;

        // Volume modeling correlated with volatility regime
        const volume = Math.floor(volumeBase * (0.5 + rand() * 1.5) * (1 + Math.abs(returns) * 5));

        data.push({
            time: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: volume
        });
    }

    return data;
}

/**
 * Fetches dynamic cryptocurrency historical data directly from the Binance public REST API.
 * Encounters zero CORS limitations in web contexts.
 * @param {string} symbol - Trading pair (e.g., BTCUSDT, ETHUSDT)
 * @param {string} interval - Candle resolution (1d, 1h)
 * @param {number} limit - Maximum candles to retrieve (max 1000)
 * @returns {Promise<Array>} Promise resolving to clean OHLCV array
 */
export async function fetchBinanceData(symbol = 'BTCUSDT', interval = '1d', limit = 1000) {
    const uppercaseSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const url = `https://api.binance.com/api/v3/klines?symbol=${uppercaseSymbol}&interval=${interval}&limit=${limit}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Binance API error: Status code ${response.status}`);
        }
        
        const rawData = await response.json();
        
        // Map raw nested array fields into normalized OHLCV objects
        return rawData.map(item => {
            const openTime = new Date(item[0]);
            const dateStr = interval === '1d' 
                ? openTime.toISOString().split('T')[0]
                : openTime.toISOString().replace('T', ' ').substring(0, 16);

            return {
                time: dateStr,
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: Math.floor(parseFloat(item[5]))
            };
        });
    } catch (error) {
        console.error("Binance data ingestion pipeline failure:", error);
        throw error;
    }
}

/**
 * Browser-side CSV Parser with robust schema-normalization.
 * Automatically handles casing, delimiter inconsistencies, and dates.
 * @param {string} csvText - Raw CSV string contents
 * @returns {Array} Array of normalized OHLCV objects
 */
export function parseCSVData(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) throw new Error("CSV dataset is empty or lacks headers.");

    // Parse headers and normalize spacing/casing
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Identify column mappings dynamically
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('time') || h === 't');
    const openIdx = headers.findIndex(h => h.startsWith('open') || h === 'o');
    const highIdx = headers.findIndex(h => h.startsWith('high') || h === 'h');
    const lowIdx = headers.findIndex(h => h.startsWith('low') || h === 'l');
    const closeIdx = headers.findIndex(h => h.startsWith('close') || h === 'c');
    const volumeIdx = headers.findIndex(h => h.includes('vol') || h === 'v');

    if ([dateIdx, openIdx, highIdx, lowIdx, closeIdx].some(idx => idx === -1)) {
        throw new Error("Unable to identify required CSV columns. Schema must contain Date, Open, High, Low, Close.");
    }

    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = line.split(',');
        if (cells.length < 5) continue; // Skip malformed rows

        try {
            // Normalize Date representation
            const rawDate = cells[dateIdx].trim();
            let normalizedDate;
            const parsedMs = Date.parse(rawDate);
            
            if (isNaN(parsedMs)) {
                // If standard parser fails, try fallback cleaning
                normalizedDate = rawDate.replace(/"/g, '');
            } else {
                normalizedDate = new Date(parsedMs).toISOString().split('T')[0];
            }

            data.push({
                time: normalizedDate,
                open: parseFloat(cells[openIdx]),
                high: parseFloat(cells[highIdx]),
                low: parseFloat(cells[lowIdx]),
                close: parseFloat(cells[closeIdx]),
                volume: volumeIdx !== -1 ? Math.floor(parseFloat(cells[volumeIdx])) || 0 : 0
            });
        } catch (e) {
            console.warn(`Skipping malformed row ${i}: ${line}`, e);
        }
    }

    // Sort chronologically to guarantee correct order for vector signal generation
    return data.sort((a, b) => new Date(a.time) - new Date(b.time));
}
