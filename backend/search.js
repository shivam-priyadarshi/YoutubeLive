// backend/search.js
export default async function handler(req, res) {
  const q = req.query.q || '';
  const pageToken = req.query.pageToken || '';
  const apiKey = process.env.YT_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing API key' });

  try {
    // Search for videos (returns snippet + nextPageToken)
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    if (q) searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '20');
    if (pageToken) searchUrl.searchParams.set('pageToken', pageToken);
    searchUrl.searchParams.set('key', apiKey);

    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();

    // If there are video IDs, fetch details
    const ids = (searchData.items || []).map(it => it.id?.videoId).filter(Boolean).join(',');
    let videosData = { items: [] };
    if (ids) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
      detailsUrl.searchParams.set('id', ids);
      detailsUrl.searchParams.set('key', apiKey);
      const detailsResp = await fetch(detailsUrl);
      videosData = await detailsResp.json();
    }

    res.status(200).json({
      search: searchData,
      videos: videosData
    });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
}
