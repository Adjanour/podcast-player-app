// ===== AUDIO VISUALIZER =====
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

// Call this function in your init()
