/*
  Passenger bootstrap (CommonJS)
  - Works with Passenger's default CJS loader
  - Loads environment and dynamically imports the ESM build output
  How to use (server config):
    PassengerStartupFile app.cjs
    PassengerAppRoot /var/www/vhosts/dev.wproducts.de/httpdocs/server
*/

// Load environment from .env if present
try { require('dotenv').config(); } catch (_) {}

(async () => {
  try {
    // Ensure the app is built: `npm run build` in server/
    const mod = await import('./dist/index.js');
    if (mod && mod.default) {
      // In case index exports something, log it (optional)
      console.log('[Passenger] Loaded default export from dist/index.js');
    }
    console.log('[Passenger] Dienstplaner API started via app.cjs');
  } catch (err) {
    console.error('[Passenger] Failed to start Dienstplaner API. Did you run "npm run build"?', err);
    process.exit(1);
  }
})();
