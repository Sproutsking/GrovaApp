const { spawn } = require("child_process");
const command = process.argv[2] || process.env.npm_lifecycle_event;

if (command !== "start" && command !== "build") {
  console.error("Usage: node scripts/verify-client-env.js <start|build>");
  process.exit(2);
}

process.env.NODE_ENV = command === "start" ? "development" : "production";

require("react-scripts/config/env");

const requiredClientVars = ["REACT_APP_SUPABASE_URL", "REACT_APP_SUPABASE_ANON_KEY"];
const invalidVars = requiredClientVars.filter((name) => {
  const value = process.env[name]?.trim();
  if (!value || /example\.supabase\.co|demo-anon-key|your[-_ ]?project|replace[-_ ]?me|changeme|placeholder/i.test(value)) return true;
  if (name === "REACT_APP_SUPABASE_URL") {
    try { return !/^https?:$/.test(new URL(value).protocol); } catch { return true; }
  }
  return value.length < 20;
});

const secretLikeClientVars = Object.keys(process.env).filter((name) =>
  /^REACT_APP_/i.test(name) && /(secret|private|encryption|service[_-]?role)/i.test(name),
);

if (invalidVars.length) {
  if (invalidVars.length) {
    console.error(`[env-check] Missing or invalid browser configuration: ${invalidVars.join(", ")}`);
  }
  console.error("[env-check] CRA reads .env at start/build time. Configure browser values in Vercel Project Settings for each deployment environment.");
  process.exit(1);
}

if (secretLikeClientVars.length) {
  secretLikeClientVars.forEach((name) => { delete process.env[name]; });
  console.warn(`[env-check] Removed server-only values from CRA's browser environment: ${secretLikeClientVars.join(", ")}`);
}

console.log(`[env-check] Required browser configuration loaded for ${process.env.NODE_ENV}.`);

const child = spawn(process.execPath, [require.resolve(`react-scripts/scripts/${command}`)], {
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[env-check] Could not start react-scripts ${command}: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});