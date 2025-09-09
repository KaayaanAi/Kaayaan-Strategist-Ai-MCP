/**
 * Mock market data for testing financial calculations
 */

// Sample 30-day OHLCV data for AAPL-like stock
export const sampleMarketData = [
  { symbol: "AAPL", timestamp: 1704067200000, open: 185.64, high: 186.95, low: 185.01, close: 186.85, volume: 31435200, source: "test" },
  { symbol: "AAPL", timestamp: 1704153600000, open: 187.15, high: 188.44, low: 185.83, close: 185.92, volume: 58973200, source: "test" },
  { symbol: "AAPL", timestamp: 1704240000000, open: 185.92, high: 186.40, low: 182.73, close: 184.25, volume: 54511700, source: "test" },
  { symbol: "AAPL", timestamp: 1704326400000, open: 182.09, high: 182.76, low: 180.17, close: 181.18, volume: 58576800, source: "test" },
  { symbol: "AAPL", timestamp: 1704412800000, open: 181.27, high: 182.86, low: 180.93, close: 182.68, volume: 43618400, source: "test" },
  { symbol: "AAPL", timestamp: 1704672000000, open: 182.15, high: 183.92, low: 180.13, close: 181.91, volume: 70555800, source: "test" },
  { symbol: "AAPL", timestamp: 1704758400000, open: 182.00, high: 185.02, low: 181.50, close: 184.40, volume: 47972100, source: "test" },
  { symbol: "AAPL", timestamp: 1704844800000, open: 184.35, high: 186.40, low: 183.92, close: 185.59, volume: 36418500, source: "test" },
  { symbol: "AAPL", timestamp: 1704931200000, open: 187.42, high: 196.27, low: 187.05, close: 194.50, volume: 80507300, source: "test" },
  { symbol: "AAPL", timestamp: 1705017600000, open: 195.41, high: 196.38, low: 194.34, close: 194.83, volume: 49340000, source: "test" },
  { symbol: "AAPL", timestamp: 1705276800000, open: 195.00, high: 195.33, low: 192.58, close: 193.89, volume: 40714000, source: "test" },
  { symbol: "AAPL", timestamp: 1705363200000, open: 190.98, high: 191.95, low: 188.82, close: 189.27, volume: 46039200, source: "test" },
  { symbol: "AAPL", timestamp: 1705449600000, open: 189.33, high: 191.56, low: 188.54, close: 191.25, volume: 40160400, source: "test" },
  { symbol: "AAPL", timestamp: 1705536000000, open: 190.94, high: 192.20, low: 188.93, close: 191.56, volume: 48116200, source: "test" },
  { symbol: "AAPL", timestamp: 1705622400000, open: 191.56, high: 193.42, low: 190.83, close: 192.53, volume: 41516200, source: "test" },
  { symbol: "AAPL", timestamp: 1705881600000, open: 192.01, high: 195.42, low: 191.725, close: 194.17, volume: 47317500, source: "test" },
  { symbol: "AAPL", timestamp: 1705968000000, open: 194.20, high: 195.99, low: 193.67, close: 195.18, volume: 36843000, source: "test" },
  { symbol: "AAPL", timestamp: 1706054400000, open: 195.09, high: 198.02, low: 194.85, close: 197.57, volume: 59144800, source: "test" },
  { symbol: "AAPL", timestamp: 1706140800000, open: 198.14, high: 199.62, low: 196.16, close: 197.96, volume: 47471900, source: "test" },
  { symbol: "AAPL", timestamp: 1706227200000, open: 198.87, high: 199.50, low: 197.66, close: 198.11, volume: 45165800, source: "test" },
  { symbol: "AAPL", timestamp: 1706486400000, open: 198.00, high: 198.32, low: 194.12, close: 194.27, volume: 54845900, source: "test" },
  { symbol: "AAPL", timestamp: 1706572800000, open: 195.19, high: 195.75, low: 192.33, close: 192.42, volume: 52279700, source: "test" },
  { symbol: "AAPL", timestamp: 1706659200000, open: 193.08, high: 194.72, low: 191.721, close: 194.50, volume: 54203800, source: "test" },
  { symbol: "AAPL", timestamp: 1706745600000, open: 194.31, high: 194.99, low: 186.28, close: 188.85, volume: 82488800, source: "test" },
  { symbol: "AAPL", timestamp: 1706832000000, open: 190.42, high: 191.05, low: 185.83, close: 187.68, volume: 65564300, source: "test" },
  { symbol: "AAPL", timestamp: 1707091200000, open: 186.86, high: 189.84, low: 185.19, close: 189.25, volume: 51814200, source: "test" },
  { symbol: "AAPL", timestamp: 1707177600000, open: 189.43, high: 192.20, low: 188.545, close: 191.04, volume: 64070100, source: "test" },
  { symbol: "AAPL", timestamp: 1707264000000, open: 190.90, high: 196.95, low: 190.825, close: 196.48, volume: 68827400, source: "test" },
  { symbol: "AAPL", timestamp: 1707350400000, open: 195.00, high: 195.509, low: 181.62, close: 182.31, volume: 147712500, source: "test" },
  { symbol: "AAPL", timestamp: 1707436800000, open: 183.98, high: 186.95, low: 182.00, close: 185.04, volume: 102322600, source: "test" }
];

// Cryptocurrency sample data (BTC)
export const sampleCryptoData = [
  { symbol: "BTC-USD", timestamp: 1704067200000, open: 42265.12, high: 42856.78, low: 41892.45, close: 42654.89, volume: 845673200, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704153600000, open: 42654.89, high: 43245.67, low: 42156.34, close: 42987.23, volume: 967834500, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704240000000, open: 42987.23, high: 43567.89, low: 42456.78, close: 43234.56, volume: 1234567800, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704326400000, open: 43234.56, high: 44012.34, low: 42856.78, close: 43789.12, volume: 876543200, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704412800000, open: 43789.12, high: 44523.45, low: 43245.67, close: 44156.89, volume: 1098765400, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704672000000, open: 44156.89, high: 45234.56, low: 43876.54, close: 44987.23, volume: 1345678900, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704758400000, open: 44987.23, high: 45567.89, low: 44456.78, close: 45234.56, volume: 987654300, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704844800000, open: 45234.56, high: 46012.34, low: 44876.54, close: 45789.12, volume: 1234567800, source: "test" },
  { symbol: "BTC-USD", timestamp: 1704931200000, open: 45789.12, high: 46523.45, low: 45345.67, close: 46156.89, volume: 876543200, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705017600000, open: 46156.89, high: 47234.56, low: 45876.54, close: 46987.23, volume: 1098765400, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705276800000, open: 46987.23, high: 47567.89, low: 46456.78, close: 47234.56, volume: 1345678900, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705363200000, open: 47234.56, high: 48012.34, low: 46876.54, close: 47789.12, volume: 987654300, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705449600000, open: 47789.12, high: 48523.45, low: 47345.67, close: 48156.89, volume: 1234567800, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705536000000, open: 48156.89, high: 49234.56, low: 47876.54, close: 48987.23, volume: 876543200, source: "test" },
  { symbol: "BTC-USD", timestamp: 1705622400000, open: 48987.23, high: 49567.89, low: 48456.78, close: 49234.56, volume: 1098765400, source: "test" }
];

// ETH sample data
export const sampleEthData = [
  { symbol: "ETH-USD", timestamp: 1704067200000, open: 2623.45, high: 2678.92, low: 2589.34, close: 2654.78, volume: 34567890, source: "test" },
  { symbol: "ETH-USD", timestamp: 1704153600000, open: 2654.78, high: 2712.34, low: 2621.56, close: 2689.23, volume: 45678901, source: "test" },
  { symbol: "ETH-USD", timestamp: 1704240000000, open: 2689.23, high: 2734.56, low: 2651.78, close: 2698.45, volume: 56789012, source: "test" },
  { symbol: "ETH-USD", timestamp: 1704326400000, open: 2698.45, high: 2756.78, low: 2665.23, close: 2723.89, volume: 67890123, source: "test" },
  { symbol: "ETH-USD", timestamp: 1704412800000, open: 2723.89, high: 2789.12, low: 2687.45, close: 2756.34, volume: 78901234, source: "test" }
];

// Sample data for insufficient periods (testing edge cases)
export const insufficientData = [
  { symbol: "TEST", timestamp: 1704067200000, open: 100, high: 105, low: 98, close: 102, volume: 1000, source: "test" },
  { symbol: "TEST", timestamp: 1704153600000, open: 102, high: 108, low: 100, close: 106, volume: 1200, source: "test" },
  { symbol: "TEST", timestamp: 1704240000000, open: 106, high: 110, low: 104, close: 108, volume: 800, source: "test" }
];

// Sample data for testing trend analysis
export const bullishTrendData = [
  { symbol: "BULL", timestamp: 1704067200000, open: 100, high: 102, low: 99, close: 101, volume: 1000, source: "test" },
  { symbol: "BULL", timestamp: 1704153600000, open: 101, high: 104, low: 100, close: 103, volume: 1200, source: "test" },
  { symbol: "BULL", timestamp: 1704240000000, open: 103, high: 106, low: 102, close: 105, volume: 800, source: "test" },
  { symbol: "BULL", timestamp: 1704326400000, open: 105, high: 108, low: 104, close: 107, volume: 900, source: "test" },
  { symbol: "BULL", timestamp: 1704412800000, open: 107, high: 110, low: 106, close: 109, volume: 1100, source: "test" },
  { symbol: "BULL", timestamp: 1704672000000, open: 109, high: 112, low: 108, close: 111, volume: 1300, source: "test" },
  { symbol: "BULL", timestamp: 1704758400000, open: 111, high: 114, low: 110, close: 113, volume: 1500, source: "test" },
  { symbol: "BULL", timestamp: 1704844800000, open: 113, high: 116, low: 112, close: 115, volume: 1700, source: "test" },
  { symbol: "BULL", timestamp: 1704931200000, open: 115, high: 118, low: 114, close: 117, volume: 1900, source: "test" },
  { symbol: "BULL", timestamp: 1705017600000, open: 117, high: 120, low: 116, close: 119, volume: 2100, source: "test" },
  { symbol: "BULL", timestamp: 1705276800000, open: 119, high: 122, low: 118, close: 121, volume: 2300, source: "test" },
  { symbol: "BULL", timestamp: 1705363200000, open: 121, high: 124, low: 120, close: 123, volume: 2500, source: "test" },
  { symbol: "BULL", timestamp: 1705449600000, open: 123, high: 126, low: 122, close: 125, volume: 2700, source: "test" },
  { symbol: "BULL", timestamp: 1705536000000, open: 125, high: 128, low: 124, close: 127, volume: 2900, source: "test" },
  { symbol: "BULL", timestamp: 1705622400000, open: 127, high: 130, low: 126, close: 129, volume: 3100, source: "test" }
];

export const bearishTrendData = [
  { symbol: "BEAR", timestamp: 1704067200000, open: 130, high: 131, low: 128, close: 129, volume: 3100, source: "test" },
  { symbol: "BEAR", timestamp: 1704153600000, open: 129, high: 130, low: 126, close: 127, volume: 2900, source: "test" },
  { symbol: "BEAR", timestamp: 1704240000000, open: 127, high: 128, low: 124, close: 125, volume: 2700, source: "test" },
  { symbol: "BEAR", timestamp: 1704326400000, open: 125, high: 126, low: 122, close: 123, volume: 2500, source: "test" },
  { symbol: "BEAR", timestamp: 1704412800000, open: 123, high: 124, low: 120, close: 121, volume: 2300, source: "test" },
  { symbol: "BEAR", timestamp: 1704672000000, open: 121, high: 122, low: 118, close: 119, volume: 2100, source: "test" },
  { symbol: "BEAR", timestamp: 1704758400000, open: 119, high: 120, low: 116, close: 117, volume: 1900, source: "test" },
  { symbol: "BEAR", timestamp: 1704844800000, open: 117, high: 118, low: 114, close: 115, volume: 1700, source: "test" },
  { symbol: "BEAR", timestamp: 1704931200000, open: 115, high: 116, low: 112, close: 113, volume: 1500, source: "test" },
  { symbol: "BEAR", timestamp: 1705017600000, open: 113, high: 114, low: 110, close: 111, volume: 1300, source: "test" },
  { symbol: "BEAR", timestamp: 1705276800000, open: 111, high: 112, low: 108, close: 109, volume: 1100, source: "test" },
  { symbol: "BEAR", timestamp: 1705363200000, open: 109, high: 110, low: 106, close: 107, volume: 900, source: "test" },
  { symbol: "BEAR", timestamp: 1705449600000, open: 107, high: 108, low: 104, close: 105, volume: 800, source: "test" },
  { symbol: "BEAR", timestamp: 1705536000000, open: 105, high: 106, low: 102, close: 103, volume: 1200, source: "test" },
  { symbol: "BEAR", timestamp: 1705622400000, open: 103, high: 104, low: 100, close: 101, volume: 1000, source: "test" }
];

// Sample data for testing RSI overbought/oversold conditions
export const overboughtRSIData = [
  { symbol: "OVER", timestamp: 1704067200000, open: 100, high: 102, low: 99, close: 101, volume: 1000, source: "test" },
  { symbol: "OVER", timestamp: 1704153600000, open: 101, high: 105, low: 100, close: 104, volume: 1200, source: "test" },
  { symbol: "OVER", timestamp: 1704240000000, open: 104, high: 108, low: 103, close: 107, volume: 800, source: "test" },
  { symbol: "OVER", timestamp: 1704326400000, open: 107, high: 111, low: 106, close: 110, volume: 900, source: "test" },
  { symbol: "OVER", timestamp: 1704412800000, open: 110, high: 114, low: 109, close: 113, volume: 1100, source: "test" },
  { symbol: "OVER", timestamp: 1704672000000, open: 113, high: 117, low: 112, close: 116, volume: 1300, source: "test" },
  { symbol: "OVER", timestamp: 1704758400000, open: 116, high: 120, low: 115, close: 119, volume: 1500, source: "test" },
  { symbol: "OVER", timestamp: 1704844800000, open: 119, high: 123, low: 118, close: 122, volume: 1700, source: "test" },
  { symbol: "OVER", timestamp: 1704931200000, open: 122, high: 126, low: 121, close: 125, volume: 1900, source: "test" },
  { symbol: "OVER", timestamp: 1705017600000, open: 125, high: 129, low: 124, close: 128, volume: 2100, source: "test" },
  { symbol: "OVER", timestamp: 1705276800000, open: 128, high: 132, low: 127, close: 131, volume: 2300, source: "test" },
  { symbol: "OVER", timestamp: 1705363200000, open: 131, high: 135, low: 130, close: 134, volume: 2500, source: "test" },
  { symbol: "OVER", timestamp: 1705449600000, open: 134, high: 138, low: 133, close: 137, volume: 2700, source: "test" },
  { symbol: "OVER", timestamp: 1705536000000, open: 137, high: 141, low: 136, close: 140, volume: 2900, source: "test" },
  { symbol: "OVER", timestamp: 1705622400000, open: 140, high: 144, low: 139, close: 143, volume: 3100, source: "test" }
];

export const oversoldRSIData = [
  { symbol: "UNDER", timestamp: 1704067200000, open: 143, high: 144, low: 139, close: 140, volume: 3100, source: "test" },
  { symbol: "UNDER", timestamp: 1704153600000, open: 140, high: 141, low: 136, close: 137, volume: 2900, source: "test" },
  { symbol: "UNDER", timestamp: 1704240000000, open: 137, high: 138, low: 133, close: 134, volume: 2700, source: "test" },
  { symbol: "UNDER", timestamp: 1704326400000, open: 134, high: 135, low: 130, close: 131, volume: 2500, source: "test" },
  { symbol: "UNDER", timestamp: 1704412800000, open: 131, high: 132, low: 127, close: 128, volume: 2300, source: "test" },
  { symbol: "UNDER", timestamp: 1704672000000, open: 128, high: 129, low: 124, close: 125, volume: 2100, source: "test" },
  { symbol: "UNDER", timestamp: 1704758400000, open: 125, high: 126, low: 121, close: 122, volume: 1900, source: "test" },
  { symbol: "UNDER", timestamp: 1704844800000, open: 122, high: 123, low: 118, close: 119, volume: 1700, source: "test" },
  { symbol: "UNDER", timestamp: 1704931200000, open: 119, high: 120, low: 115, close: 116, volume: 1500, source: "test" },
  { symbol: "UNDER", timestamp: 1705017600000, open: 116, high: 117, low: 112, close: 113, volume: 1300, source: "test" },
  { symbol: "UNDER", timestamp: 1705276800000, open: 113, high: 114, low: 109, close: 110, volume: 1100, source: "test" },
  { symbol: "UNDER", timestamp: 1705363200000, open: 110, high: 111, low: 106, close: 107, volume: 900, source: "test" },
  { symbol: "UNDER", timestamp: 1705449600000, open: 107, high: 108, low: 103, close: 104, volume: 800, source: "test" },
  { symbol: "UNDER", timestamp: 1705536000000, open: 104, high: 105, low: 100, close: 101, volume: 1200, source: "test" },
  { symbol: "UNDER", timestamp: 1705622400000, open: 101, high: 102, low: 97, close: 98, volume: 1000, source: "test" }
];