document.addEventListener('DOMContentLoaded', () => {
  const startOverlay = document.getElementById('start-overlay');
  const startButton = document.getElementById('start-button');
  const arScene = document.getElementById('ar-scene');
  const videoPlane = document.getElementById('video-plane');
  const overlayVideo = document.getElementById('overlay-video');
  const marker = document.getElementById('marker');
  let mediaUnlocked = false;

  // === POINTER EVENTS FIX START ===
  startButton.addEventListener('click', async () => {
    // On iOS, video and audio require a user gesture to start.
    // We play and immediately pause the video to "unlock" it.
    try {
      await overlayVideo.play();
      overlayVideo.pause();
      overlayVideo.currentTime = 0;
      mediaUnlocked = true;
    } catch (e) {
      console.error("Video play failed:", e);
    }
    
    startOverlay.style.display = 'none';
    arScene.style.pointerEvents = 'auto';

    // Show dev panel if not on mobile
    if (!/Mobi|Android/i.test(navigator.userAgent)) {
      document.getElementById('dev-panel').style.display = 'block';
    }
  });
  // === POINTER EVENTS FIX END ===

  // Play/pause video on target found/lost
  marker.addEventListener('targetFound', () => {
    if (mediaUnlocked) {
      overlayVideo.play();
    }
  });

  marker.addEventListener('targetLost', () => {
    overlayVideo.pause();
  });
  
  // Dev Tuning Panel
  const tuning = {
    filterMinCF: document.getElementById('filterMinCF'),
    filterBeta: document.getElementById('filterBeta'),
    alphaMin: document.getElementById('alphaMin'),
    alphaMax: document.getElementById('alphaMax'),
    overscan: document.getElementById('overscan'),
    smootherToggle: document.getElementById('smoother-toggle'),
  };
  const resetTuningBtn = document.getElementById('reset-tuning');
  const TUNING_STORAGE_KEY = 'webar-tuning-settings';

  function persistTuning() {
    const settings = {
      filterMinCF: tuning.filterMinCF.value,
      filterBeta: tuning.filterBeta.value,
      alphaMin: tuning.alphaMin.value,
      alphaMax: tuning.alphaMax.value,
      overscan: tuning.overscan.value,
      smootherEnabled: tuning.smootherToggle.checked,
    };
    localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(settings));
    broadcastTuningUpdate(settings);
  }
  
  function loadTuning() {
    const settings = JSON.parse(localStorage.getItem(TUNING_STORAGE_KEY));
    if (settings) {
      tuning.filterMinCF.value = settings.filterMinCF;
      tuning.filterBeta.value = settings.filterBeta;
      tuning.alphaMin.value = settings.alphaMin;
      tuning.alphaMax.value = settings.alphaMax;
      tuning.overscan.value = settings.overscan;
      tuning.smootherToggle.checked = settings.smootherEnabled;
    }
    // Broadcast initial values
    broadcastTuningUpdate(settings || getDefaultTuning());
  }
  
  function resetTuning() {
    const defaultSettings = getDefaultTuning();
    tuning.filterMinCF.value = defaultSettings.filterMinCF;
    tuning.filterBeta.value = defaultSettings.filterBeta;
    tuning.alphaMin.value = defaultSettings.alphaMin;
    tuning.alphaMax.value = defaultSettings.alphaMax;
    tuning.overscan.value = defaultSettings.overscan;
    tuning.smootherToggle.checked = defaultSettings.smootherEnabled;
    
    localStorage.removeItem(TUNING_STORAGE_KEY);
    broadcastTuningUpdate(defaultSettings);
  }

  function getDefaultTuning() {
    return {
      filterMinCF: 0.02,
      filterBeta: 60,
      alphaMin: 0.12,
      alphaMax: 0.22,
      overscan: 1.02,
      smootherEnabled: true
    };
  }

  function broadcastTuningUpdate(settings) {
     const event = new CustomEvent('tuning-updated', { 
       detail: {
         filterMinCF: parseFloat(settings.filterMinCF),
         filterBeta: parseFloat(settings.filterBeta),
         alphaMin: parseFloat(settings.alphaMin),
         alphaMax: parseFloat(settings.alphaMax),
         overscan: parseFloat(settings.overscan),
         smootherEnabled: settings.smootherEnabled,
       } 
     });
     document.dispatchEvent(event);
  }

  Object.values(tuning).forEach(input => {
    input.addEventListener('change', persistTuning);
  });

  resetTuningBtn.addEventListener('click', resetTuning);

  loadTuning();
});
