const getOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
};

const encodeId = (value) => encodeURIComponent(String(value || ""));

export const buildShareUrl = (type, id, params = {}) => {
  const origin = getOrigin();
  const routes = {
    post: `/post/${encodeId(id)}`,
    reel: `/reel/${encodeId(id)}`,
    story: `/story/${encodeId(id)}`,
    community: `/community/${encodeId(id)}`,
    invite: `/invite/${encodeId(id)}`,
    // Keep the existing referral contract; the metadata endpoint also accepts
    // this query shape so campaign attribution is not lost.
    ambassador: "/",
    share: `/share/${id}`,
  };
  const path = routes[type] || "/";
  const url = new URL(path, origin || "http://localhost");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  if (type === "ambassador" && id) url.searchParams.set("ref", id);
  return origin ? url.toString() : `${url.pathname}${url.search}`;
};

export const buildContentShareUrl = (contentType, content) => {
  const routeByType = { post: "post", reel: "reel", story: "story" };
  const route = routeByType[contentType] || "post";
  return buildShareUrl(route, content?.id);
};

export const buildPlatformShareUrl = (platform, { url, title = "Check this out on Xeevia!" }) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title.slice(0, 240));
  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    pinterest: `https://www.pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    tumblr: `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  };
  return links[platform] || null;
};

export default { buildShareUrl, buildContentShareUrl, buildPlatformShareUrl };