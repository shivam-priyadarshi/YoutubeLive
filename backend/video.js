// backend/video.js
export default async function handler(req, res) {
  const videoId = req.query.id;
  const apiKey = process.env.YT_API_KEY;
  if (!videoId) return res.status(400).json({ error: 'Missing video id' });
  if (!apiKey) return res.status(500).json({ error: 'Missing API key' });

  try {
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
    const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=20&key=${apiKey}`;

    const [vResp, cResp] = await Promise.all([fetch(videoUrl), fetch(commentsUrl)]);
    const videoData = await vResp.json();
    const commentsData = await cResp.json();

    const channelId = videoData.items?.[0]?.snippet?.channelId;
    let channelData = null;
    if (channelId) {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
      const chResp = await fetch(channelUrl);
      channelData = await chResp.json();
    }

    res.status(200).json({ video: videoData, comments: commentsData, channel: channelData });
  } catch (err) {
    console.error('video details error', err);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
}
