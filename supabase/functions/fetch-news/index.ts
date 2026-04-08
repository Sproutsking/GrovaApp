// =============================================================================
// supabase/functions/fetch-news/index.ts
//
// Supabase Edge Function — fetches live RSS feeds, parses XML, deduplicates
// by url_hash, and upserts into the news_posts table.
//
// Deploy:
//   supabase functions deploy fetch-news --no-verify-jwt
//
// Schedule via Supabase Dashboard:
//   Database → Extensions → enable pg_cron → then:
//
//   select cron.schedule(
//     'fetch-news-every-8-min',
//     '*/8 * * * *',
//     $$
//       select net.http_post(
//         url := '<YOUR_SUPABASE_URL>/functions/v1/fetch-news',
//         headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb
//       )
//     $$
//   );
//
// Or invoke manually:
//   supabase functions invoke fetch-news
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase admin client ────────────────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// ── RSS sources ──────────────────────────────────────────────────────────────
const SOURCES = [
  // Global
  { name: "BBC News",           url: "https://feeds.bbci.co.uk/news/rss.xml",                    category: "global",  region: "uk"            },
  { name: "Reuters",            url: "https://feeds.reuters.com/reuters/topNews",                  category: "global",  region: "us"            },
  { name: "Al Jazeera",         url: "https://www.aljazeera.com/xml/rss/all.xml",                 category: "global",  region: "international" },
  // Africa
  { name: "The Africa Report",  url: "https://www.theafricareport.com/feed/",                     category: "africa",  region: "africa"        },
  { name: "Premium Times",      url: "https://www.premiumtimesng.com/feed",                       category: "africa",  region: "nigeria"       },
  { name: "AllAfrica",          url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", category: "africa", region: "africa"    },
  // Crypto
  { name: "CoinDesk",           url: "https://www.coindesk.com/arc/outboundfeeds/rss/",           category: "crypto",  region: null            },
  { name: "CoinTelegraph",      url: "https://cointelegraph.com/rss",                             category: "crypto",  region: null            },
  { name: "Decrypt",            url: "https://decrypt.co/feed",                                   category: "crypto",  region: null            },
];

// ── Crypto asset tag detection ────────────────────────────────────────────────
const ASSETS = ["BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX","MATIC",
  "DOT","LINK","UNI","ATOM","LTC","BCH","NEAR","APT","ARB","OP","TON","TRX","XLM"];

function extractAsset(text: string): string | null {
  const up = text.toUpperCase();
  return ASSETS.find((a) => up.includes(a)) ?? null;
}

// ── HTML stripping ────────────────────────────────────────────────────────────
function stripHtml(html: string = ""): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

// ── SHA-256 url hash (Web Crypto, available in Deno) ─────────────────────────
async function sha256(text: string): Promise<string> {
  const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Validate image URL ────────────────────────────────────────────────────────
function validImg(url: string | undefined | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t.startsWith("http")) return null;
  const low = t.toLowerCase();
  if (low.includes("pixel.gif") || low.includes("1x1") || low.includes("spacer")) return null;
  return t;
}

// ── Extract image from RSS item (tries every known field) ────────────────────
function extractImage(item: Record<string, unknown>): string | null {
  // media:content
  const mc = item["media:content"] as Record<string,Record<string,string>> | undefined;
  if (mc?.["$"]?.url) return validImg(mc["$"].url);

  // media:thumbnail
  const mt = item["media:thumbnail"] as Record<string,Record<string,string>> | undefined;
  if (mt?.["$"]?.url) return validImg(mt["$"].url);

  // enclosure
  const enc = item["enclosure"] as Record<string,string> | undefined;
  if (enc?.url) return validImg(enc.url);

  // <image> inside description
  const desc = String(item["description"] || item["content:encoded"] || "");
  const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return validImg(imgMatch[1]);

  return null;
}

// ── Minimal XML parser ────────────────────────────────────────────────────────
// Parses <item> blocks from RSS 2.0 and <entry> blocks from Atom feeds.
function parseRSS(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];

  // Try RSS <item> blocks
  const itemRx = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    items.push(extractFields(block));
  }

  // Fallback: Atom <entry> blocks
  if (items.length === 0) {
    const entryRx = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRx.exec(xml)) !== null) {
      const block = m[1];
      const obj = extractFields(block);
      // Atom uses <link href="..."/> instead of <link>url</link>
      if (!obj.link) {
        const hrefM = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        if (hrefM) obj.link = hrefM[1];
      }
      items.push(obj);
    }
  }

  return items;
}

function extractFields(block: string): Record<string, string> {
  const field = (tag: string): string => {
    // CDATA version
    const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i").exec(block);
    if (cdata) return cdata[1].trim();
    // Plain version
    const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
    if (plain) return plain[1].trim();
    return "";
  };

  const imgUrl = (() => {
    // media:content url attribute
    const mc = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block);
    if (mc) return mc[1];
    // media:thumbnail
    const mt = /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block);
    if (mt) return mt[1];
    // enclosure
    const en = /<enclosure[^>]+url=["']([^"']+)["']/i.exec(block);
    if (en) return en[1];
    // img inside content
    const desc = field("description") || field("content:encoded") || "";
    const im = /<img[^>]+src=["']([^"']+)["']/i.exec(desc);
    if (im) return im[1];
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

// ── Fetch one RSS source ──────────────────────────────────────────────────────
async function fetchSource(source: typeof SOURCES[0]): Promise<{
  name: string;
  items: Array<{
    title: string; description: string | null; image_url: string | null;
    source_name: string; source_url: string; article_url: string;
    category: string; region: string | null; asset_tag: string | null;
    url_hash: string; published_at: string;
  }>;
  error: string | null;
}> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; XeeviaNewsBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const raw = parseRSS(xml);

    const items = await Promise.all(
      raw.map(async (r) => {
        const articleUrl = r.link?.trim() || "";
        if (!articleUrl.startsWith("http")) return null;

        const title = stripHtml(r.title).slice(0, 300);
        if (!title) return null;

        const description = stripHtml(r.description).slice(0, 500) || null;
        const combined    = `${title} ${description || ""}`;

        let published_at: string;
        try {
          published_at = r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString();
        } catch {
          published_at = new Date().toISOString();
        }

        return {
          title,
          description,
          image_url:   validImg(r.image) ?? null,
          source_name: source.name,
          source_url:  source.url,
          article_url: articleUrl,
          category:    source.category,
          region:      source.region ?? null,
          asset_tag:   source.category === "crypto" ? extractAsset(combined) : null,
          url_hash:    await sha256(articleUrl),
          published_at,
        };
      })
    );

    return {
      name:  source.name,
      items: items.filter(Boolean) as NonNullable<typeof items[0]>[],
      error: null,
    };
  } catch (err) {
    return { name: source.name, items: [], error: String(err) };
  }
}

// ── Batch upsert ──────────────────────────────────────────────────────────────
async function batchUpsert(items: ReturnType<typeof fetchSource> extends Promise<infer R> ? R["items"] : never): Promise<number> {
  if (!items.length) return 0;
  let inserted = 0;
  const CHUNK = 50;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("news_posts")
      .upsert(chunk, { onConflict: "url_hash", ignoreDuplicates: true, count: "estimated" });
    if (!error) inserted += count ?? 0;
  }
  return inserted;
}

// ── Purge old articles ────────────────────────────────────────────────────────
async function purgeOld(days = 7) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await supabase.from("news_posts").delete().lt("published_at", cutoff);
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const start = Date.now();
  const results: string[] = [];
  const seen   = new Set<string>();
  const allItems: Awaited<ReturnType<typeof fetchSource>>["items"] = [];

  // Fetch sources 4 at a time
  const CONCURRENCY = 4;
  for (let i = 0; i < SOURCES.length; i += CONCURRENCY) {
    const batch   = SOURCES.slice(i, i + CONCURRENCY);
    const fetched = await Promise.allSettled(batch.map(fetchSource));

    for (const result of fetched) {
      if (result.status !== "fulfilled") continue;
      const { name, items, error } = result.value;

      // Deduplicate across sources
      const unique = items.filter((it) => {
        if (seen.has(it.url_hash)) return false;
        seen.add(it.url_hash);
        return true;
      });

      const inserted = await batchUpsert(unique);
      allItems.push(...unique);

      // Log to news_fetch_log
      await supabase.from("news_fetch_log").insert({
        source_name:       name,
        articles_found:    items.length,
        articles_inserted: inserted,
        error_message:     error,
      });

      results.push(`${name}: found=${items.length}, inserted=${inserted}${error ? ` (err: ${error})` : ""}`);
    }
  }

  await purgeOld(7);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const summary = {
    ok:       true,
    elapsed:  `${elapsed}s`,
    total:    allItems.length,
    sources:  results,
  };

  console.log("[fetch-news]", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});