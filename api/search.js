// api/search.js
const fetch = global.fetch || require('node-fetch');

module.exports = async (req, res) => {
  const q = req.query.q || '';
  const pageToken = req.query.pageToken || '';
  const chart = req.query.chart || '';
  const regionCode = req.query.regionCode || '';
  const apiKey = process.env.YT_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key' });
  }

  try {
    if (chart === 'mostPopular') {
      // videos.list for mostPopular
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'snippet,contentDetails,statistics');
      url.searchParams.set('chart', 'mostPopular');
      if (regionCode) url.searchParams.set('regionCode', regionCode);
      url.searchParams.set('maxResults', '20');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      url.searchParams.set('key', apiKey);

      const r = await fetch(url.toString());
      const data = await r.json();
      return res.status(200).json({ videos: data });
    }

    // default: search.list + videos.list for details
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    if (q) searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '20');
    if (pageToken) searchUrl.searchParams.set('pageToken', pageToken);
    searchUrl.searchParams.set('key', apiKey);

    const searchResp = await fetch(searchUrl.toString());
    const searchData = await searchResp.json();

    const ids = (searchData.items || []).map(it => it.id?.videoId).filter(Boolean).join(',');
    let videosData = { items: [] };
    if (ids) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
      detailsUrl.searchParams.set('id', ids);
      detailsUrl.searchParams.set('key', apiKey);
      const detailsResp = await fetch(detailsUrl.toString());
      videosData = await detailsResp.json();
    }

    res.status(200).json({ search: searchData, videos: videosData });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
};
