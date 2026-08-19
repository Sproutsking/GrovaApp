const { createClient } = require("@supabase/supabase-js");

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const isCrawler = (userAgent = "") => /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot/i.test(userAgent);

const getTarget = (req) => {
  const parts = (req.query.path || "").split("/").filter(Boolean);
  const type = parts[0] || "home";
  const id = parts[1] || "";
  return { type, id };
};

module.exports = async (req, res) => {
  const { type, id } = getTarget(req);
  const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  let title = "Xeevia — Own Your Social";
  let description = "Own your content. Build your network. Engage to Earn.";
  let image = `${origin}/logo512.png`;
  let target = "/";

  if (type === "post" || type === "reel" || type === "story") {
    target = `/${type}/${encodeURIComponent(id)}`;
    if (supabase && id) {
      const { data } = await supabase.from(type === "post" ? "posts" : type === "reel" ? "reels" : "stories").select("*").eq("id", id).maybeSingle();
      if (data) {
        title = data.title || data.caption || data.content?.slice?.(0, 90) || `View this ${type} on Xeevia`;
        description = data.caption || data.content || `Open this ${type} on Xeevia.`;
        image = data.thumbnail_url || data.image_url || data.media_url || image;
      }
    }
  } else if (type === "community") {
    target = `/community/${encodeURIComponent(id)}`;
    if (supabase && id) {
      const { data } = await supabase.from("communities").select("name, description, icon, banner_gradient").eq("id", id).maybeSingle();
      if (data) {
        title = `${data.name} on Xeevia`;
        description = data.description || `Join ${data.name} on Xeevia.`;
        if (/^https?:\/\//i.test(data.icon || "")) image = data.icon;
      }
    }
  } else if (type === "invite") {
    target = `/?invite=${encodeURIComponent(id)}`;
    title = "You are invited to Xeevia";
    description = "Join this Xeevia community and connect with the people inside.";
  } else if (type === "ambassador") {
    target = `/?ref=${encodeURIComponent(id)}`;
    title = "Join Xeevia with my invitation";
    description = "Own your content. Build your network. Engage to Earn.";
  }

  if (!isCrawler(req.headers["user-agent"])) {
    res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
    return res.end();
  }

  const canonical = `${origin}/share/${type}/${encodeURIComponent(id)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:type" content="${type === "post" || type === "reel" || type === "story" ? "article" : "website"}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></body></html>`);
};