// =============================================================================
// supabase/functions/fetch-news/index.ts
//
// Deploy:  supabase functions deploy fetch-news --no-verify-jwt
// Invoke:  supabase functions invoke fetch-news
//
// Schedule (pg_cron — run once in Supabase SQL editor):
//   select cron.schedule(
//     'fetch-news-every-8-min', '*/8 * * * *',
//     $$
//       select net.http_post(
//         url     := '<YOUR_SUPABASE_URL>/functions/v1/fetch-news',
//         headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//       )
//     $$
//   );
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS — REQUIRED so the browser can call this function directly ────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Supabase admin client (service role bypasses RLS) ────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// ── RSS sources ───────────────────────────────────────────────────────────────
const SOURCES = [
  // Global
  { name: "BBC News",           url: "https://feeds.bbci.co.uk/news/rss.xml",                         category: "global", region: "uk"            },
  { name: "Reuters",            url: "https://feeds.reuters.com/reuters/topNews",                       category: "global", region: "us"            },
  { name: "Al Jazeera",         url: "https://www.aljazeera.com/xml/rss/all.xml",                      category: "global", region: "international" },
  // Africa
  { name: "The Africa Report",  url: "https://www.theafricareport.com/feed/",                          category: "africa", region: "africa"        },
  { name: "Premium Times",      url: "https://www.premiumtimesng.com/feed",                            category: "africa", region: "nigeria"       },
  { name: "AllAfrica",          url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", category: "africa", region: "africa"        },
  { name: "Daily Nation Kenya", url: "https://www.nation.africa/rss",                                  category: "africa", region: "kenya"         },
  // Crypto
  { name: "CoinDesk",           url: "https://www.coindesk.com/arc/outboundfeeds/rss/",                category: "crypto", region: null            },
  { name: "CoinTelegraph",      url: "https://cointelegraph.com/rss",                                  category: "crypto", region: null            },
  { name: "Decrypt",            url: "https://decrypt.co/feed",                                        category: "crypto", region: null            },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const ASSETS = ["BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX","MATIC",
  "DOT","LINK","UNI","ATOM","LTC","BCH","NEAR","APT","ARB","OP","TON","TRX","XLM"];

function extractAsset(text: string): string | null {
  const up = text.toUpperCase();
  return ASSETS.find((a) => up.includes(a)) ?? null;
}

function stripHtml(html = ""): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi,   "<").replace(/&gt;/gi,   ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi,  "'")
    .replace(/\s+/g, " ").trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(text.trim().toLowerCase())
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validImg(url?: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t.startsWith("http")) return null;
  const low = t.toLowerCase();
  if (low.includes("pixel.gif") || low.includes("1x1") || low.includes("spacer")) return null;
  return t;
}

// ── XML parser ────────────────────────────────────────────────────────────────
function parseRSS(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const itemRx = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRx.exec(xml)) !== null) items.push(extractFields(m[1]));

  // Fallback: Atom <entry>
  if (!items.length) {
    const entryRx = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRx.exec(xml)) !== null) {
      const obj = extractFields(m[1]);
      if (!obj.link) {
        const h = m[1].match(/<link[^>]+href=["']([^"']+)["']/i);
        if (h) obj.link = h[1];
      }
      items.push(obj);
    }
  }
  return items;
}

function extractFields(block: string): Record<string, string> {
  const field = (tag: string) => {
    const cd = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i").exec(block);
    if (cd) return cd[1].trim();
    const pl = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
    return pl ? pl[1].trim() : "";
  };

  const imgUrl = (() => {
    const mc = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block);  if (mc) return mc[1];
    const mt = /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block); if (mt) return mt[1];
    const en = /<enclosure[^>]+url=["']([^"']+)["']/i.exec(block);       if (en) return en[1];
    const d  = field("description") || field("content:encoded");
    const im = /<img[^>]+src=["']([^"']+)["']/i.exec(d);                 if (im) return im[1];
    return "";
  })();

  return {
    title:       field("title"),
    link:        field("link") || field("guid"),
    description: field("description") || field("summary") || field("content:encoded"),
    pubDate:     field("pubDate") || field("published") || field("updated"),
    image:       imgUrl,
  };
}

// ── Article type ──────────────────────────────────────────────────────────────
interface Article {
  title: string;
  description: string | null;
  image_url: string | null;
  source_name: string;
  source_url: string;
  article_url: string;
  category: string;
  region: string | null;
  asset_tag: string | null;
  url_hash: string;
  published_at: string;
}

// ── Fetch one RSS source ──────────────────────────────────────────────────────
async function fetchSource(source: typeof SOURCES[0]): Promise<{
  name: string; items: Article[]; error: string | null;
}> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; XeeviaNewsBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = parseRSS(await res.text());

    const items = (await Promise.all(
      raw.map(async (r): Promise<Article | null> => {
        const articleUrl = r.link?.trim() || "";
        if (!articleUrl.startsWith("http")) return null;

        const title = stripHtml(r.title).slice(0, 300);
        if (!title) return null;

        const description = stripHtml(r.description).slice(0, 500) || null;

        let published_at: string;
        try { published_at = r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString(); }
        catch { published_at = new Date().toISOString(); }

        return {
          title,
          description,
          image_url:   validImg(r.image),
          source_name: source.name,
          source_url:  source.url,
          article_url: articleUrl,
          category:    source.category,
          region:      source.region ?? null,
          asset_tag:   source.category === "crypto"
            ? extractAsset(`${title} ${description ?? ""}`)
            : null,
          url_hash:    await sha256(articleUrl),
          published_at,
        };
      })
    )).filter((x): x is Article => x !== null);

    return { name: source.name, items, error: null };
  } catch (err) {
    return { name: source.name, items: [], error: String(err) };
  }
}

// ── Batch upsert ──────────────────────────────────────────────────────────────
async function batchUpsert(items: Article[]): Promise<number> {
  if (!items.length) return 0;
  let inserted = 0;
  for (let i = 0; i < items.length; i += 50) {
    const { error, count } = await supabase
      .from("news_posts")
      .upsert(items.slice(i, i + 50), {
        onConflict: "url_hash", ignoreDuplicates: true, count: "estimated",
      });
    if (error) console.error("[fetch-news] upsert:", error.message);
    else inserted += count ?? 0;
  }
  return inserted;
}

async function purgeOld(days = 7) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await supabase.from("news_posts").delete().lt("published_at", cutoff);
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Browser preflight — must return 200 with CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  const start    = Date.now();
  const results: string[] = [];
  const seen     = new Set<string>();
  const allItems: Article[] = [];

  for (let i = 0; i < SOURCES.length; i += 4) {
    const fetched = await Promise.allSettled(
      SOURCES.slice(i, i + 4).map(fetchSource)
    );

    for (const r of fetched) {
      if (r.status !== "fulfilled") continue;
      const { name, items, error } = r.value;

      const unique = items.filter((it) => {
        if (seen.has(it.url_hash)) return false;
        seen.add(it.url_hash);
        return true;
      });

      const inserted = await batchUpsert(unique);
      allItems.push(...unique);

      await supabase.from("news_fetch_log").insert({
        source_name:       name,
        articles_found:    items.length,
        articles_inserted: inserted,
        error_message:     error,
      });

      results.push(
        `${name}: found=${items.length} inserted=${inserted}` +
        (error ? ` ERR:${error}` : "")
      );
    }
  }

  await purgeOld(7);

  const body = {
    ok:      true,
    elapsed: `${((Date.now() - start) / 1000).toFixed(1)}s`,
    total:   allItems.length,
    sources: results,
  };

  console.log("[fetch-news]", JSON.stringify(body));

  return new Response(JSON.stringify(body), {
    status:  200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});