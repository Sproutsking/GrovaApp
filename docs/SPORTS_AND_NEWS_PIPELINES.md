# Sports and News Media Pipelines

These are intentionally separate systems.

## News

`HomeView` loads `NewsTab`. `NewsTab` owns the news feed and uses `NewsVideoStrip` for news YouTube videos. Its channel list, Atom/RSS fetching, player lifecycle, and fullscreen presentation live under `src/components/Home/`. Sports code does not import or alter this pipeline.

## Sports

`HomeView` renders `SportsView` only when the Sports tab is selected. `SportsView` loads sports sessions through `sportsDataService` from Supabase `live_sessions`, listens for realtime changes, and normalizes live/scheduled matches. Sports YouTube and stream URLs are handled by `sportsYoutubeService` and rendered only inside the Sports Live Match detail view.

Flow:

1. Supabase `live_sessions` provides live or scheduled sports records.
2. `sportsDataService` filters sports records and normalizes teams, scores, status, and stream URLs.
3. `SportsView` presents Live Score, Live Match, and Fixtures cards.
4. Selecting Live Match uses `sportsYoutubeService` for the embedded player URL.
5. Selecting Fixtures applies date-window and league filters.
6. Supabase realtime refreshes SportsView when a session changes.

The News and Sports pipelines do not share fetchers, state, player components, or channel configuration. A future sports provider should write normalized records into `live_sessions` or a dedicated sports table; it should not be added to the News fetcher.
