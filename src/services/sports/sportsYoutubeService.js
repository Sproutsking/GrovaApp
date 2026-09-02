// Sports-only YouTube helpers. News uses NewsVideoStrip and does not import this module.

const getVideoId = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || null;
    }
    return null;
  } catch {
    return null;
  }
};

const getEmbedUrl = (url) => {
  const videoId = getVideoId(url);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0` : url || "";
};

const sportsYoutubeService = { getVideoId, getEmbedUrl };

export default sportsYoutubeService;
