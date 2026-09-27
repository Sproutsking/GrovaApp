const event = process.env.npm_lifecycle_event;
process.env.NODE_ENV = process.env.NODE_ENV || (event === "start" ? "development" : "production");

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

if (invalidVars.length || secretLikeClientVars.length) {
  if (invalidVars.length) {
    console.error(`[env-check] Missing or invalid browser configuration: ${invalidVars.join(", ")}`);
  }
  if (secretLikeClientVars.length) {
    console.error(`[env-check] These values would be embedded in public JavaScript; rename them as server-only variables: ${secretLikeClientVars.join(", ")}`);
  }
  console.error("[env-check] CRA reads .env at start/build time. Configure browser values in Vercel Project Settings for each deployment environment.");
  process.exit(1);
}

console.log(`[env-check] Required browser configuration loaded for ${process.env.NODE_ENV}.`);