// Simple Supabase Edge Function example for /content
// Expects environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set — function will return an explanatory error when called');
} else {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

async function handler(req, res) {
  try {
    const { category, offset = 0, limit = 20 } = req.query || {};
    if (!category) return res.status(400).json({ error: 'category required' });
    if (!supabase) return res.status(500).json({ error: 'Supabase env vars not configured on this server' });

    // Fetch mappings
    const { data: mappings, error: mapErr } = await supabase
      .from('culture_content')
      .select('content_type, content_id, created_at, featured, engagement_boost')
      .eq('category_id', category)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (mapErr) return res.status(500).json({ error: mapErr.message });

    const postIds = [];
    const reelIds = [];
    const storyIds = [];

    mappings.forEach(m => {
      if (m.content_type === 'post') postIds.push(m.content_id);
      else if (m.content_type === 'reel') reelIds.push(m.content_id);
      else if (m.content_type === 'story') storyIds.push(m.content_id);
    });

    const [postsR, reelsR, storiesR] = await Promise.all([
      postIds.length ? supabase.from('posts').select('*').in('id', postIds) : Promise.resolve({ data: [] }),
      reelIds.length ? supabase.from('reels').select('*').in('id', reelIds) : Promise.resolve({ data: [] }),
      storyIds.length ? supabase.from('stories').select('*').in('id', storyIds) : Promise.resolve({ data: [] }),
    ]);

    const result = {
      posts: postsR.data || [],
      reels: reelsR.data || [],
      stories: storiesR.data || [],
    };

    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

module.exports = handler;

// Development helper: run a simple HTTP server when executed directly
if (require.main === module) {
  const http = require('http');
  const port = process.env.PORT || 8787;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}:${port}`);
      req.query = Object.fromEntries(url.searchParams.entries());
      handler(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  server.listen(port, () => console.log(`getCultureContent dev server listening on http://localhost:${port}`));
}
