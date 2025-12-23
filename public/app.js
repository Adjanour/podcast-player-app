//  IndexedDB Setup
const DB_NAME = "PodcastPlayerDB";
const DB_VERSION = 1;
let db = null;

// Initialize IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Podcasts store
      if (!db.objectStoreNames.contains("podcasts")) {
        const podcastStore = db.createObjectStore("podcasts", {
          keyPath: "id",
        });
        podcastStore.createIndex("feedUrl", "feedUrl", { unique: true });
        podcastStore.createIndex("title", "title", { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // Playback positions store
      if (!db.objectStoreNames.contains("positions")) {
        db.createObjectStore("positions", { keyPath: "episodeId" });
      }
    };
  });
}

//  App State
const state = {
  podcasts: [],
  currentPodcast: null,
  currentEpisode: null,
  currentEpisodeIndex: -1,
  theme: "light",
  playbackSpeed: 1.0,
  searchQuery: "",
  filteredEpisodes: [],
};

//  DOM Elements
const elements = {
  feedUrl: document.getElementById("feedUrl"),
  addFeedBtn: document.getElementById("addFeedBtn"),
  podcastList: document.getElementById("podcastList"),
  episodesSection: document.getElementById("episodesSection"),
  episodesList: document.getElementById("episodesList"),
  backBtn: document.getElementById("backBtn"),
  podcastTitle: document.getElementById("podcastTitle"),
  statusMessage: document.getElementById("statusMessage"),
  themeToggle: document.getElementById("themeToggle"),
  audioPlayer: document.getElementById("audioPlayer"),
  audio: document.getElementById("audio"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  playPauseIcon: document.getElementById("playPauseIcon"),
  skipBackBtn: document.getElementById("skipBackBtn"),
  skipForwardBtn: document.getElementById("skipForwardBtn"),
  progressBar: document.getElementById("progressBar"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),
  volumeControl: document.getElementById("volumeControl"),
  playerTitle: document.getElementById("playerTitle"),
  playerPodcast: document.getElementById("playerPodcast"),
  playerArtwork: document.getElementById("playerArtwork"),
  speedControl: document.getElementById("speedControl"),
  searchModal: document.getElementById("searchModal"),
  searchInput: document.getElementById("searchInput"),
  closeSearch: document.getElementById("closeSearch"),
  // New features
  visualizer: document.getElementById("visualizer"),
  sleepTimerBtn: document.getElementById("sleepTimerBtn"),
  sleepTimerModal: document.getElementById("sleepTimerModal"),
  shareBtn: document.getElementById("shareBtn"),
  shareModal: document.getElementById("shareModal"),
};

//  Initialize App
async function init() {
  try {
    // Initialize IndexedDB first
    await initDB();
    console.log("IndexedDB initialized successfully");

    // Load settings
    state.theme = await loadSetting("theme", "light");
    state.playbackSpeed = await loadSetting("playbackSpeed", 1.0);

    // Load podcasts
    await loadPodcastsFromStorage();

    // Setup UI
    setupEventListeners();
    setupKeyboardShortcuts();
    setupNewFeatures();
    applyTheme();
    applyPlaybackSpeed();
    renderPodcastList();
  } catch (error) {
    console.error("Initialization error:", error);
    showStatus("Error initializing app", "error");
  }
}

//  Event Listeners
function setupEventListeners() {
  elements.addFeedBtn.addEventListener("click", handleAddFeed);
  elements.feedUrl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleAddFeed();
  });
  elements.backBtn.addEventListener("click", showPodcastList);
  elements.themeToggle.addEventListener("click", toggleTheme);

  // Quick add buttons
  document.querySelectorAll(".quick-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.feedUrl.value = btn.dataset.feed;
      handleAddFeed();
    });
  });

  // Audio player controls
  elements.playPauseBtn.addEventListener("click", togglePlayPause);
  elements.skipBackBtn.addEventListener("click", () => skipTime(-15));
  elements.skipForwardBtn.addEventListener("click", () => skipTime(15));
  elements.progressBar.addEventListener("input", handleProgressChange);
  elements.volumeControl.addEventListener("input", handleVolumeChange);

  // Audio events
  elements.audio.addEventListener("timeupdate", updateProgress);
  elements.audio.addEventListener("loadedmetadata", updateDuration);
  elements.audio.addEventListener("ended", handleAudioEnded);
  elements.audio.addEventListener("pause", savePlaybackPosition);
  elements.audio.addEventListener("timeupdate", savePlaybackPosition);

  // Speed control
  elements.speedControl.addEventListener("click", cyclePlaybackSpeed);

  // Search
  elements.searchInput.addEventListener("input", handleSearch);
  elements.closeSearch.addEventListener("click", closeSearchModal);
  document
    .getElementById("searchBtn")
    ?.addEventListener("click", openSearchModal);
  document
    .getElementById("playlistBtn")
    ?.addEventListener("click", generatePlaylist);
}

//  Theme Management
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const icon = elements.themeToggle.querySelector(".theme-icon");

  // Toggle between moon and sun icon
  if (state.theme === "dark") {
    icon.innerHTML =
      '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  } else {
    icon.innerHTML =
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  saveSetting("theme", state.theme);
  applyTheme();
}

//  RSS Feed Parsing
async function fetchAndParseFeed(url) {
  try {
    showStatus("Fetching podcast feed...", "success");

    // Check if we're using the local server or need CORS proxy
    const isLocalServer =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    let response;

    if (isLocalServer) {
      // Use local server's RSS proxy (much faster!)
      const proxyUrl = `/api/fetch-feed?url=${encodeURIComponent(url)}`;
      response = await fetch(proxyUrl);
    } else {
      // Fallback to CORS proxy for non-local usage
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      response = await fetch(proxyUrl);
    }

    if (!response.ok) {
      throw new Error("Failed to fetch feed");
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Invalid RSS feed");
    }

    // Parse podcast metadata
    const channel = xmlDoc.querySelector("channel");
    const podcast = {
      id: Date.now().toString(),
      feedUrl: url,
      title: getTextContent(channel, "title"),
      description: getTextContent(channel, "description"),
      author:
        getTextContent(channel, "itunes\\:author") ||
        getTextContent(channel, "author"),
      image: getImageUrl(channel),
      episodes: [],
    };

    // Parse episodes
    const items = xmlDoc.querySelectorAll("item");
    items.forEach((item) => {
      const enclosure = item.querySelector("enclosure");
      if (enclosure && enclosure.getAttribute("type")?.includes("audio")) {
        const episode = {
          id: Date.now().toString() + Math.random(),
          title: getTextContent(item, "title"),
          description: stripHtml(
            getTextContent(item, "description") ||
              getTextContent(item, "itunes\\:summary"),
          ),
          pubDate: getTextContent(item, "pubDate"),
          audioUrl: enclosure.getAttribute("url"),
          duration: getTextContent(item, "itunes\\:duration"),
          image: getImageUrl(item) || podcast.image,
        };
        podcast.episodes.push(episode);
      }
    });

    return podcast;
  } catch (error) {
    console.error("Feed parsing error:", error);
    throw error;
  }
}

function getTextContent(parent, tagName) {
  const element = parent.querySelector(tagName);
  return element ? element.textContent.trim() : "";
}

function getImageUrl(parent) {
  // Try different image tag formats used in RSS/Podcast feeds
  let imageUrl = "";

  // Method 1: iTunes image with href attribute (most common in podcast feeds)
  // Handles: <itunes:image href="..."/>
  const itunesImage = parent.querySelector("itunes\\:image");
  if (itunesImage) {
    imageUrl = itunesImage.getAttribute("href");
  }

  // Method 2: Try without escaped colon (some parsers handle it differently)
  if (!imageUrl) {
    const itunesImageAlt = parent.querySelector("image[href]");
    if (itunesImageAlt) {
      imageUrl = itunesImageAlt.getAttribute("href");
    }
  }

  // Method 3: Standard RSS image URL
  // Handles: <image><url>...</url></image>
  if (!imageUrl) {
    const image = parent.querySelector("image url");
    if (image) imageUrl = image.textContent.trim();
  }

  // Method 4: Direct image tag
  if (!imageUrl) {
    const image = parent.querySelector("image");
    if (image && image.textContent.trim()) {
      imageUrl = image.textContent.trim();
    }
  }

  // Method 5: Media RSS content
  // Handles: <media:content url="..."/>
  if (!imageUrl) {
    const mediaContent = parent.querySelector("media\\:content");
    if (mediaContent) imageUrl = mediaContent.getAttribute("url");
  }

  // Method 6: Find any element with 'image' in the name that has href attribute
  if (!imageUrl) {
    const elements = parent.querySelectorAll("*");
    for (const el of elements) {
      if (el.localName && el.localName.toLowerCase().includes("image")) {
        const href = el.getAttribute("href");
        if (href && href.startsWith("http")) {
          imageUrl = href;
          break;
        }
      }
    }
  }

  return (
    imageUrl ||
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%230071e3"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="60">🎙️</text></svg>'
  );
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

//  Feed Management
async function handleAddFeed() {
  const url = elements.feedUrl.value.trim();
  console.log("Adding feed:", url);

  if (!url) {
    showStatus("Please enter a feed URL", "error");
    return;
  }

  // Check if podcast already exists
  if (state.podcasts.some((p) => p.feedUrl === url)) {
    showStatus("This podcast is already in your library", "error");
    return;
  }

  try {
    console.log("Fetching and parsing feed...");
    const podcast = await fetchAndParseFeed(url);
    console.log("Parsed podcast:", podcast);

    state.podcasts.push(podcast);
    console.log("State podcasts after push:", state.podcasts);

    savePodcastsToStorage();
    console.log("Saved to storage");

    renderPodcastList();
    console.log("Rendered podcast list");

    elements.feedUrl.value = "";
    showStatus(`Added "${podcast.title}" successfully!`, "success");
  } catch (error) {
    console.error("Error adding podcast:", error);
    showStatus(
      "Failed to add podcast. Please check the URL and try again.",
      "error",
    );
  }
}

function removePodcast(podcastId) {
  if (confirm("Are you sure you want to remove this podcast?")) {
    state.podcasts = state.podcasts.filter((p) => p.id !== podcastId);
    savePodcastsToStorage();
    renderPodcastList();
    showStatus("Podcast removed", "success");
  }
}

//  Storage Management
//  IndexedDB Storage Functions
async function savePodcastsToStorage() {
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["podcasts"], "readwrite");
      const store = tx.objectStore("podcasts");

      // Clear existing podcasts
      store.clear();

      // Add all podcasts
      for (const podcast of state.podcasts) {
        store.put(podcast);
      }

      tx.oncomplete = () => {
        console.log(`Saved ${state.podcasts.length} podcasts to IndexedDB`);
        resolve();
      };

      tx.onerror = () => {
        console.error("Storage error:", tx.error);
        showStatus("Failed to save podcasts", "error");
        reject(tx.error);
      };
    } catch (error) {
      console.error("Storage error:", error);
      reject(error);
    }
  });
}

async function loadPodcastsFromStorage() {
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["podcasts"], "readonly");
      const store = tx.objectStore("podcasts");
      const request = store.getAll();

      request.onsuccess = () => {
        state.podcasts = request.result || [];
        console.log(`Loaded ${state.podcasts.length} podcasts from IndexedDB`);
        resolve();
      };

      request.onerror = () => {
        console.error("Storage load error:", request.error);
        showStatus("Error loading podcasts", "error");
        state.podcasts = [];
        reject(request.error);
      };
    } catch (error) {
      console.error("Storage load error:", error);
      state.podcasts = [];
      reject(error);
    }
  });
}

async function saveSetting(key, value) {
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["settings"], "readwrite");
      const store = tx.objectStore("settings");
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error("Error saving setting:", request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error("Error saving setting:", error);
      reject(error);
    }
  });
}

async function loadSetting(key, defaultValue) {
  if (!db) return defaultValue;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(["settings"], "readonly");
      const store = tx.objectStore("settings");
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };

      request.onerror = () => {
        console.error("Error loading setting:", request.error);
        resolve(defaultValue);
      };
    } catch (error) {
      console.error("Error loading setting:", error);
      resolve(defaultValue);
    }
  });
}

//  UI Rendering
function renderPodcastList() {
  if (state.podcasts.length === 0) {
    elements.podcastList.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">
                No podcasts yet. Add one using the form above!
            </p>
        `;
    return;
  }

  elements.podcastList.innerHTML = state.podcasts
    .map(
      (podcast) => `
        <div class="podcast-card" onclick="showEpisodes('${podcast.id}')">
            <button class="remove-podcast" onclick="event.stopPropagation(); removePodcast('${podcast.id}')">×</button>
            <img src="${escapeHtml(podcast.image)}" alt="${escapeHtml(podcast.title)}" class="podcast-artwork" loading="lazy" >
            <h3 class="podcast-name">${escapeHtml(podcast.title)}</h3>
            <p class="podcast-author">${escapeHtml(podcast.author || "Unknown")}</p>
            <p class="podcast-description">${escapeHtml(podcast.description)}</p>
        </div>
    `,
    )
    .join("");
}

function showEpisodes(podcastId) {
  const podcast = state.podcasts.find((p) => p.id === podcastId);
  if (!podcast) return;

  state.currentPodcast = podcast;
  elements.podcastTitle.textContent = podcast.title;

  renderEpisodes();

  // Show episodes section
  elements.podcastList.parentElement.style.display = "none";
  document.querySelector(".add-feed").style.display = "none";
  elements.episodesSection.style.display = "block";
}

function renderEpisodes() {
  if (!state.currentPodcast) return;

  const filteredEpisodes = filterEpisodes(state.currentPodcast.episodes);

  if (filteredEpisodes.length === 0) {
    elements.episodesList.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No episodes found</p>';
    return;
  }

  elements.episodesList.innerHTML = filteredEpisodes
    .map((episode) => {
      const index = state.currentPodcast.episodes.indexOf(episode);
      return `
        <div class="episode-card">
            <img src="${escapeHtml(episode.image)}" alt="${escapeHtml(episode.title)}" class="episode-artwork" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23007aff%22/></svg>'">
            <div class="episode-content">
                <h3 class="episode-title">${escapeHtml(episode.title)}</h3>
                <p class="episode-date">${formatDate(episode.pubDate)}</p>
                <p class="episode-description">${escapeHtml(episode.description)}</p>
                <div class="episode-actions">
                    <button class="btn-play" onclick='playEpisodeByIndex(${index})'>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-download" onclick='downloadEpisodeByIndex(${index})'>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            </div>
        </div>
    `;
    })
    .join("");
}

function showPodcastList() {
  elements.episodesSection.style.display = "none";
  elements.podcastList.parentElement.style.display = "block";
  document.querySelector(".add-feed").style.display = "block";
  state.currentPodcast = null;
}

//  Audio Player
function playEpisodeByIndex(index) {
  if (!state.currentPodcast) return;
  const episode = state.currentPodcast.episodes[index];
  if (!episode) return;

  state.currentEpisodeIndex = index;
  playEpisode(episode, state.currentPodcast);
}

async function playEpisode(episode, podcast) {
  state.currentEpisode = episode;

  elements.audio.src = episode.audioUrl;
  elements.playerTitle.textContent = episode.title;
  elements.playerPodcast.textContent = podcast.title;
  elements.playerArtwork.src = episode.image;

  elements.audioPlayer.style.display = "grid";

  // Load saved playback position
  const savedPosition = await loadPlaybackPosition(episode.id);
  if (savedPosition && savedPosition.time < savedPosition.duration - 10) {
    elements.audio.currentTime = savedPosition.time;
    showStatus(`Resuming from ${formatTime(savedPosition.time)}`, "success");
  }

  elements.audio.play();
  // Set to pause icon
  elements.playPauseIcon.innerHTML =
    '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
}

function togglePlayPause() {
  if (elements.audio.paused) {
    elements.audio.play();
    // Change to pause icon
    elements.playPauseIcon.innerHTML =
      '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
  } else {
    elements.audio.pause();
    // Change to play icon
    elements.playPauseIcon.innerHTML =
      '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  }
}

function skipTime(seconds) {
  elements.audio.currentTime += seconds;
}

function handleProgressChange(e) {
  const time = (e.target.value / 100) * elements.audio.duration;
  elements.audio.currentTime = time;
}

function handleVolumeChange(e) {
  elements.audio.volume = e.target.value / 100;
}

function updateProgress() {
  const current = elements.audio.currentTime;
  const duration = elements.audio.duration;

  if (duration) {
    const percentage = (current / duration) * 100;
    elements.progressBar.value = percentage;
    elements.currentTime.textContent = formatTime(current);
  }
}

function updateDuration() {
  elements.duration.textContent = formatTime(elements.audio.duration);
}

function handleAudioEnded() {
  // Reset to play icon
  elements.playPauseIcon.innerHTML =
    '<polygon points="5 3 19 12 5 21 5 3"></polygon>';

  // Auto-play next episode
  playNextEpisode();
}

function playNextEpisode() {
  if (!state.currentPodcast || state.currentEpisodeIndex === -1) return;

  const nextIndex = state.currentEpisodeIndex + 1;
  if (nextIndex < state.currentPodcast.episodes.length) {
    playEpisodeByIndex(nextIndex);
    showStatus("Playing next episode...", "success");
  }
}

//  Download Functionality
function downloadEpisodeByIndex(index) {
  if (!state.currentPodcast) return;
  const episode = state.currentPodcast.episodes[index];
  if (!episode) return;

  downloadEpisode(episode.audioUrl, episode.title);
}

async function downloadEpisode(url, title) {
  const isLocalServer =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocalServer) {
    // Use backend API to download to Podcasts folder
    try {
      showStatus("Starting download to Podcasts folder...", "success");

      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
      const response = await fetch(downloadUrl);

      if (response.ok) {
        const data = await response.json();
        showStatus(`Downloading "${title}" to Podcasts folder...`, "success");
        console.log("Download started:", data);
      } else {
        throw new Error("Download request failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      showStatus("Download failed. Check console for details.", "error");
    }
  } else {
    // Fallback to browser download for non-local usage
    showStatus("Download started...", "success");

    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(title)}.mp3`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      showStatus("Download initiated! Check your downloads folder.", "success");
    }, 500);
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

//  Utility Functions
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;

  setTimeout(() => {
    elements.statusMessage.className = "status-message";
  }, 5000);
}

function formatDate(dateString) {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

//  Playback Speed Control
function cyclePlaybackSpeed() {
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const currentIndex = speeds.indexOf(state.playbackSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  state.playbackSpeed = speeds[nextIndex];

  applyPlaybackSpeed();
  saveSetting("playbackSpeed", state.playbackSpeed);
}

function applyPlaybackSpeed() {
  elements.audio.playbackRate = state.playbackSpeed;
  elements.speedControl.textContent = `${state.playbackSpeed}x`;
}

//  Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Don't trigger shortcuts if user is typing in an input
    if (e.target.tagName === "INPUT") return;

    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlayPause();
        break;
      case "arrowleft":
      case "j":
        e.preventDefault();
        skipTime(-15);
        break;
      case "arrowright":
      case "l":
        e.preventDefault();
        skipTime(15);
        break;
      case "f":
        e.preventDefault();
        openSearchModal();
        break;
      case "escape":
        e.preventDefault();
        closeSearchModal();
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
      case "n":
        e.preventDefault();
        playNextEpisode();
        break;
    }
  });
}

function toggleMute() {
  elements.audio.muted = !elements.audio.muted;
  showStatus(elements.audio.muted ? "Muted" : "Unmuted", "success");
}

//  Search Functionality
function openSearchModal() {
  if (!state.currentPodcast) {
    showStatus("Open a podcast first to search episodes", "error");
    return;
  }
  elements.searchModal.style.display = "block";
  elements.searchInput.focus();
}

function closeSearchModal() {
  elements.searchModal.style.display = "none";
  elements.searchInput.value = "";
  state.searchQuery = "";
  renderEpisodes();
}

function handleSearch(e) {
  state.searchQuery = e.target.value.toLowerCase();
  renderEpisodes();
}

function filterEpisodes(episodes) {
  if (!state.searchQuery) return episodes;

  return episodes.filter(
    (episode) =>
      episode.title.toLowerCase().includes(state.searchQuery) ||
      episode.description.toLowerCase().includes(state.searchQuery),
  );
}

//  Playback Position Memory
async function savePlaybackPosition() {
  if (!db || !state.currentEpisode || !elements.audio.currentTime) return;

  const position = {
    episodeId: state.currentEpisode.id,
    time: elements.audio.currentTime,
    duration: elements.audio.duration,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(['positions'], 'readwrite');
      const store = tx.objectStore('positions');
      const request = store.put(position);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Error saving playback position:', request.error);
        resolve(); // Don't reject, just log
      };
    } catch (error) {
      console.error('Error saving playback position:', error);
      resolve(); // Don't reject, just log
    }
  });
}

async function loadPlaybackPosition(episodeId) {
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(['positions'], 'readonly');
      const store = tx.objectStore('positions');
      const request = store.get(episodeId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Error loading playback position:', request.error);
        resolve(null);
      };
    } catch (error) {
      console.error('Error loading playback position:', error);
      resolve(null);
    }
  });
}

//  Playlist Generation
function generatePlaylist() {
  if (!state.currentPodcast || !state.currentPodcast.episodes.length) {
    showStatus("No episodes to create playlist", "error");
    return;
  }

  // Create M3U playlist
  let m3u = "#EXTM3U\n";
  m3u += `#PLAYLIST:${state.currentPodcast.title}\n\n`;

  state.currentPodcast.episodes.forEach((episode) => {
    m3u += `#EXTINF:-1,${episode.title}\n`;
    m3u += `${episode.audioUrl}\n\n`;
  });

  // Download playlist file
  const blob = new Blob([m3u], { type: "audio/x-mpegurl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(state.currentPodcast.title)}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus("Playlist downloaded!", "success");
}

//  ===== AUDIO VISUALIZER =====
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

function setupAudioVisualizer() {
  if (!elements.audio || audioContext) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(elements.audio);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function draw() {
      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        // Create gradient
        const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
        gradient.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--accent-hover').trim());

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    }

    draw();
    console.log('Audio visualizer initialized');
  } catch (error) {
    console.error('Error setting up audio visualizer:', error);
  }
}

//  SLEEP TIMER
let sleepTimer = null;
let sleepTimerEndTime = null;

function openSleepTimerModal() {
  document.getElementById('sleepTimerModal').style.display = 'flex';
}

function closeSleepTimerModal() {
  document.getElementById('sleepTimerModal').style.display = 'none';
}

function startSleepTimer(minutes) {
  if (sleepTimer) clearInterval(sleepTimer);

  sleepTimerEndTime = Date.now() + (minutes * 60 * 1000);

  document.querySelector('.sleep-timer-options').style.display = 'none';
  document.getElementById('timerDisplay').style.display = 'block';
  document.getElementById('sleepTimerBtn').classList.add('active');

  updateSleepTimerDisplay();

  sleepTimer = setInterval(() => {
    const remaining = sleepTimerEndTime - Date.now();

    if (remaining <= 0) {
      clearSleepTimer();
      fadeOutAndPause();
    } else {
      updateSleepTimerDisplay();
    }
  }, 1000);

  closeSleepTimerModal();
  showStatus(`Sleep timer set for ${minutes} minutes`, 'success');
}

function updateSleepTimerDisplay() {
  const remaining = Math.max(0, sleepTimerEndTime - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  document.getElementById('timerCountdown').textContent =
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function clearSleepTimer() {
  if (sleepTimer) {
    clearInterval(sleepTimer);
    sleepTimer = null;
    sleepTimerEndTime = null;
  }

  document.querySelector('.sleep-timer-options').style.display = 'grid';
  document.getElementById('timerDisplay').style.display = 'none';
  document.getElementById('sleepTimerBtn').classList.remove('active');
  closeSleepTimerModal();

  showStatus('Sleep timer canceled', 'success');
}

function fadeOutAndPause() {
  let volume = elements.audio.volume;
  const fadeInterval = setInterval(() => {
    volume -= 0.05;
    if (volume <= 0) {
      clearInterval(fadeInterval);
      elements.audio.pause();
      elements.audio.volume = 1.0; // Reset volume
      showStatus('Sleep timer ended - playback paused', 'success');
    } else {
      elements.audio.volume = volume;
    }
  }, 200);
}

//  SOCIAL SHARING
function openShareModal() {
  if (!state.currentEpisode || !state.currentPodcast) {
    showStatus('No episode currently playing', 'error');
    return;
  }

  const currentTime = formatTime(elements.audio.currentTime);
  const sharePreview = document.getElementById('sharePreview');

  sharePreview.innerHTML = `
    <div class="share-card">
      <img src="${state.currentEpisode.image}" alt="Episode artwork" class="share-card-image" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%23007aff%22/></svg>'">
      <div class="share-card-info">
        <div class="share-card-title">${escapeHtml(state.currentEpisode.title)}</div>
        <div class="share-card-podcast">${escapeHtml(state.currentPodcast.title)}</div>
        <div class="share-card-timestamp">Currently at ${currentTime}</div>
      </div>
    </div>
  `;

  document.getElementById('shareModal').style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('shareModal').style.display = 'none';
}

function copyShareLink() {
  const shareText = `🎙️ I'm listening to "${state.currentEpisode.title}" from ${state.currentPodcast.title} at ${formatTime(elements.audio.currentTime)}`;

  navigator.clipboard.writeText(shareText).then(() => {
    showStatus('Share text copied to clipboard!', 'success');
  }).catch(() => {
    showStatus('Failed to copy to clipboard', 'error');
  });
}

function shareToTwitter() {
  const text = `🎙️ Currently listening to "${state.currentEpisode.title}" from ${state.currentPodcast.title} at ${formatTime(elements.audio.currentTime)}`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

//  SETUP EVENT LISTENERS FOR NEW FEATURES
function setupNewFeatures() {
  // Sleep Timer
  const sleepTimerBtn = document.getElementById('sleepTimerBtn');
  const closeSleepTimer = document.getElementById('closeSleepTimer');
  const cancelTimer = document.getElementById('cancelTimer');
  const timerButtons = document.querySelectorAll('.timer-btn');

  if (sleepTimerBtn) sleepTimerBtn.addEventListener('click', openSleepTimerModal);
  if (closeSleepTimer) closeSleepTimer.addEventListener('click', closeSleepTimerModal);
  if (cancelTimer) cancelTimer.addEventListener('click', clearSleepTimer);

  timerButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes);
      startSleepTimer(minutes);
    });
  });

  // Share
  const shareBtn = document.getElementById('shareBtn');
  const closeShare = document.getElementById('closeShare');
  const copyShareLink_btn = document.getElementById('copyShareLink');
  const shareTwitterBtn = document.getElementById('shareTwitter');

  if (shareBtn) shareBtn.addEventListener('click', openShareModal);
  if (closeShare) closeShare.addEventListener('click', closeShareModal);
  if (copyShareLink_btn) copyShareLink_btn.addEventListener('click', copyShareLink);
  if (shareTwitterBtn) shareTwitterBtn.addEventListener('click', shareToTwitter);

  // Close modals on outside click
  document.getElementById('sleepTimerModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'sleepTimerModal') closeSleepTimerModal();
  });

  document.getElementById('shareModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'shareModal') closeShareModal();
  });

  // Setup visualizer when audio starts playing
  elements.audio.addEventListener('play', () => {
    if (!audioContext) setupAudioVisualizer();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  });
}

//  Start App
init();
