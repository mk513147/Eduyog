// Supported external video providers. The only way a video URL becomes an
// iframe source is through parseVideoUrl, which yields an embed URL built from
// a fixed host and a strictly matched video id.

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;

// Returns { provider, id, embedUrl } for a supported URL, otherwise null.
function parseVideoUrl(raw) {
  if (typeof raw !== 'string') return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    let id = null;
    if (host === 'youtu.be') {
      if (segments.length === 1) id = segments[0];
    } else if (segments.length === 1 && segments[0] === 'watch') {
      id = url.searchParams.get('v');
    } else if (segments.length === 2 && segments[0] === 'embed') {
      id = segments[1];
    }
    if (id && YOUTUBE_ID.test(id)) {
      return { provider: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    let id = null;
    if (host === 'player.vimeo.com') {
      if (segments.length === 2 && segments[0] === 'video') id = segments[1];
    } else if (segments.length === 1) {
      id = segments[0];
    }
    if (id && VIMEO_ID.test(id)) {
      return { provider: 'vimeo', id, embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    return null;
  }

  return null;
}

module.exports = { parseVideoUrl };
