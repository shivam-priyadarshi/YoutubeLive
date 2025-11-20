document.addEventListener('DOMContentLoaded', () => {
    // FRONTEND no longer contains any API keys.
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mainContent = document.getElementById('main-content');
    const videoGrid = document.getElementById('video-grid');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const watchPage = document.getElementById('watch-page');
    const backToGridBtn = document.getElementById('back-to-grid-btn');
    const logoBtn = document.getElementById('logo-btn');
    const homeBtn = document.getElementById('home-btn');

    let player=null;
    let nextPageToken = '';
    let isLoading = false;
    let currentSearchQuery = '';
    let isSearching = false;

    // ---------- UI Events ----------
    searchForm.addEventListener('submit', e => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            currentSearchQuery = query;
            isSearching = true;
            nextPageToken = '';
            searchVideos(query, true);
        }
    });

    videoGrid.addEventListener('click', e => {
        const videoCard = e.target.closest('.video-card');
        if (videoCard && videoCard.dataset.videoId) {
            openWatchPage(videoCard.dataset.videoId);
        }
    });

    mainContent.addEventListener('scroll', () => {
        // Infinite scroll: load more when near bottom
        if (isLoading) return;
        // if nextPageToken is empty, you might still want more for trending depending on API behavior
        if (!nextPageToken) return;
        if (mainContent.scrollTop + mainContent.clientHeight >= mainContent.scrollHeight - 150) {
            loadMoreVideos();
        }
    });

    backToGridBtn.addEventListener('click', () => {
        watchPage.classList.add('hidden');
        mainContent.classList.remove('hidden');
        if (player && typeof player.stopVideo === 'function') {
            player.stopVideo();
        }
    });

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
    }
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    });

    function goToHomePage(e) {
        if (e) e.preventDefault();
        if (!watchPage.classList.contains('hidden')) {
            watchPage.classList.add('hidden');
            mainContent.classList.remove('hidden');
            if (player && typeof player.stopVideo === 'function') {
                player.stopVideo();
            }
        }
        isSearching = false;
        currentSearchQuery = '';
        nextPageToken = '';
        searchInput.value = '';
        fetchTrendingVideos(true);
    }

    logoBtn.addEventListener('click', goToHomePage);
    homeBtn.addEventListener('click', goToHomePage);

    // ---------- Data Fetching (calls your backend) ----------
    async function searchVideos(query, isNewSearch = false) {
        if (isLoading) return;
        isLoading = true;
        if (isNewSearch) {
            videoGrid.innerHTML = `<p class="col-span-full text-center text-gray-400">Searching...</p>`;
        }

        let url = `/api/search?q=${encodeURIComponent(query)}`;
        if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
            const data = await resp.json();

            // Expected shape: { search: { nextPageToken, items }, videos: { items } }
            nextPageToken = data.search?.nextPageToken || '';
            const videos = data.videos?.items || [];
            displayVideos(videos, isNewSearch);
        } catch (error) {
            console.error('Failed to fetch search results:', error);
            videoGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Failed to load videos. Check the console.</p>`;
        } finally {
            isLoading = false;
        }
    }

    async function fetchTrendingVideos(isInitialLoad = false) {
        if (isLoading) return;
        isLoading = true;
        if (isInitialLoad) {
            videoGrid.innerHTML = `<p class="col-span-full text-center text-gray-400">Loading popular videos...</p>`;
        }

        // backend should support chart=mostPopular if implemented
        let url = `/api/search?chart=mostPopular&regionCode=IN`;
        if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
            const data = await resp.json();
            // If backend implemented videos.list for chart, it can return same shape
            nextPageToken = data.search?.nextPageToken || data.videos?.nextPageToken || '';
            const videos = data.videos?.items || data.search?.items || [];
            // If videos are from search items (id.videoId), server may have also populated videos; prefer videos.items
            displayVideos(videos, isInitialLoad);
        } catch (error) {
            console.error('Failed to fetch trending videos:', error);
            videoGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Failed to load popular videos. Check the console.</p>`;
        } finally {
            isLoading = false;
        }
    }

    function loadMoreVideos() {
        const loadingIndicator = document.createElement('p');
        loadingIndicator.className = 'col-span-full text-center text-gray-400 loading-indicator';
        loadingIndicator.textContent = 'Loading more videos...';
        videoGrid.appendChild(loadingIndicator);

        if (isSearching) {
            searchVideos(currentSearchQuery);
        } else {
            fetchTrendingVideos();
        }
    }

    // ---------- Rendering ----------
    function displayVideos(videos, clearGrid = false) {
        const loadingIndicator = videoGrid.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();

        if (clearGrid) videoGrid.innerHTML = '';

        if ((!videos || videos.length === 0) && clearGrid) {
            videoGrid.innerHTML = `<p class="col-span-full text-center text-gray-400">No results found.</p>`;
            return;
        }

        // Append cards
        videos.forEach(video => {
            // video could be either:
            // - result of videos.list -> video.id is string, contentDetails exist
            // - result of search.list -> video.id.videoId exists but server ideally maps to details before returning
            let videoId = '';
            let snippet = video.snippet || {};
            let duration = (video.contentDetails && video.contentDetails.duration) || '';

            // handle various shapes
            if (typeof video.id === 'string') {
                videoId = video.id;
            } else if (video.id && typeof video.id === 'object') {
                // search result shape
                videoId = video.id.videoId || video.id;
            } else if (video.videoId) {
                videoId = video.videoId;
            }

            // Fallbacks for thumbnails and titles
            const thumbUrl = (snippet.thumbnails && (snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default?.url)) || 'https://placehold.co/600x400/000000/FFFFFF?text=No+Image';
            const title = snippet.title || 'Untitled video';

            if (!videoId) return; // skip if no id

            const col = document.createElement('div');
            col.className = 'flex flex-col space-y-2 video-card cursor-pointer';
            col.dataset.videoId = videoId;

            col.innerHTML = `
                <div class="video-thumbnail-container relative rounded-md overflow-hidden bg-black">
                    <img src="${thumbUrl}" alt="Video Thumbnail" loading="lazy" style="width:100%;height:auto;display:block;" onerror="this.onerror=null;this.src='https://placehold.co/600x400/000000/FFFFFF?text=Error';">
                    ${duration ? `<span class="video-duration absolute right-2 bottom-2 bg-black/70 text-xs px-2 py-1 rounded text-white">${parseISODuration(duration)}</span>` : ''}
                </div>
                <div class="flex items-start space-x-3 mt-2">
                    <h3 class="font-semibold text-base leading-snug">${escapeHtml(title)}</h3>
                </div>
            `;
            videoGrid.appendChild(col);
        });
    }

    // ---------- Watch page ----------
    async function openWatchPage(videoId) {
    mainContent.classList.add('hidden');
    watchPage.classList.remove('hidden');

    // Use robust loader (creates player or fallback)
    ensurePlayerAndLoad(videoId);

    const videoDetails = await getVideoDetails(videoId);
    if (videoDetails) displayWatchPageDetails(videoDetails);
}


    async function getVideoDetails(videoId) {
        try {
            const resp = await fetch(`/api/video?id=${encodeURIComponent(videoId)}`);
            if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
            const data = await resp.json();

            return {
                video: data.video?.items?.[0] || null,
                comments: data.comments?.items || [],
                channel: data.channel?.items?.[0] || null
            };
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    }

    function displayWatchPageDetails({ video, comments, channel }) {
        if (!video) {
            document.getElementById('watch-title').textContent = 'Video not found';
            document.getElementById('description-body').textContent = '';
            document.getElementById('view-count').textContent = '--';
            return;
        }

        document.getElementById('watch-title').textContent = video.snippet.title || 'Untitled';
        document.getElementById('description-body').textContent = video.snippet.description || '';
        document.getElementById('view-count').textContent = Number(video.statistics?.viewCount || 0).toLocaleString();

        const channelInfoContainer = document.getElementById('channel-info');
        if (channel) {
            channelInfoContainer.innerHTML = `
                <img src="${channel.snippet.thumbnails?.default?.url || 'https://placehold.co/40x40'}" alt="Channel Avatar" class="w-12 h-12 rounded-full">
                <div>
                    <p class="font-bold">${channel.snippet.title}</p>
                    <p class="text-sm text-gray-400">${formatSubscriberCount(channel.statistics?.subscriberCount)}</p>
                </div>
            `;
        } else {
            channelInfoContainer.innerHTML = '';
        }

        const videoStatsContainer = document.getElementById('video-stats');
        videoStatsContainer.innerHTML = `
            <button class="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.562 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
                <span>${formatNumber(video.statistics?.likeCount || 0)}</span>
            </button>
        `;

        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '';
        if (comments && comments.length > 0) {
            comments.forEach(commentThread => {
                const comment = commentThread.snippet?.topLevelComment?.snippet;
                if (!comment) return;
                const block = document.createElement('div');
                block.className = 'flex items-start space-x-3';
                block.innerHTML = `
                    <img src="${comment.authorProfileImageUrl || 'https://placehold.co/40x40'}" alt="User Avatar" class="w-9 h-9 rounded-full">
                    <div class="flex-1">
                        <p class="font-semibold text-sm">${escapeHtml(comment.authorDisplayName)}</p>
                        <p class="text-sm">${escapeHtml(comment.textDisplay)}</p>
                    </div>
                `;
                commentsContainer.appendChild(block);
            });
        } else {
            commentsContainer.innerHTML = '<p class="text-gray-400">No comments found.</p>';
        }
    }

    // ---------- Utilities ----------
    function formatNumber(num) {
        const n = Number(num || 0);
        if (Math.abs(n) > 999) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function formatSubscriberCount(num) {
        const n = Number(num || 0);
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function parseISODuration(isoDuration) {
        if (!isoDuration || typeof isoDuration !== 'string') return '';
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = isoDuration.match(regex);
        if (!matches) return '';
        const hours = matches[1] ? parseInt(matches[1], 10) : 0;
        const minutes = matches[2] ? parseInt(matches[2], 10) : 0;
        const seconds = matches[3] ? parseInt(matches[3], 10) : 0;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // simple HTML escape to avoid accidental injection when showing titles/comments
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ---------- YouTube Iframe API ----------
   // ---------- YouTube Player (robust) ----------                 // already declared near top; reusing same name is fine
let playerReady = false;
let pendingVideoToLoad = null;
let ytApiLoadAttempted = false;
let ytApiFailed = false;

function loadYouTubeApiOnce() {
  if (ytApiLoadAttempted) return;
  ytApiLoadAttempted = true;

  // Add script only if not already present
  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      console.error('YouTube Iframe API failed to load.');
      ytApiFailed = true;
    };
    document.head.appendChild(s);
  }
}

// Called by YouTube API when ready
window.onYouTubeIframeAPIReady = function() {
  try {
    if (player) return; // already created

    player = new YT.Player('watch-player', {
      height: '100%',
      width: '100%',
      videoId: '', // will load later
      playerVars: { playsinline: 1, autoplay: 0, controls: 1 },
      events: {
        onReady: () => {
          playerReady = true;
          console.log('YT Player ready');
          if (pendingVideoToLoad) {
            try { player.loadVideoById(pendingVideoToLoad); }
            catch (err) { console.error('Error loading pending video via API:', err); }
            pendingVideoToLoad = null;
          }
        },
        onError: (e) => {
          console.error('YT Player error', e);
        }
      }
    });
  } catch (err) {
    console.error('Failed to create YT.Player', err);
    ytApiFailed = true;
  }
};

function createIframeFallback(videoId) {
  const host = document.getElementById('watch-player');
  if (!host) return;
  host.innerHTML = `
    <iframe
      width="100%"
      height="100%"
      src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1"
      frameborder="0"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen>
    </iframe>`;
}

function ensurePlayerAndLoad(videoId) {
  loadYouTubeApiOnce();

  const host = document.getElementById('watch-player');
  if (host) host.innerHTML = ''; // clear before player or iframe

  if (ytApiFailed) {
    createIframeFallback(videoId);
    return;
  }

  if (player && playerReady && typeof player.loadVideoById === 'function') {
    try {
      player.loadVideoById(videoId);
      return;
    } catch (err) {
      console.error('player.loadVideoById error, falling back to iframe', err);
      createIframeFallback(videoId);
      return;
    }
  }

  // queue it for when API/player becomes ready
  pendingVideoToLoad = videoId;

  // If YT is present but player not created, attempt to create it now
  if (typeof YT !== 'undefined' && typeof YT.Player === 'function' && !player) {
    try { window.onYouTubeIframeAPIReady(); } catch (err) { /* ignore */ }
  }

  // fallback after delay if not ready
  setTimeout(() => {
    if (!playerReady && pendingVideoToLoad) {
      console.warn('YT API not ready after timeout, using iframe fallback');
      createIframeFallback(pendingVideoToLoad);
      pendingVideoToLoad = null;
    }
  }, 2500);
}


    // ---------- Initial load ----------
    fetchTrendingVideos(true);
});
