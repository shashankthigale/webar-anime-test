/**
 * UI Controls for WebAR application.
 * Handles tap-to-start overlay, recording controls, and dev tuning panel.
 *
 * Features:
 * - iOS-compatible tap-to-start overlay with pointer events fix
 * - Recording controls (record/stop, include mic, download)
 * - Dev tuning panel for adjusting smoothing parameters
 * - Video playback control based on target detection
 *
 * @author WebAR Engineer
 */

// === POINTER EVENTS FIX START ===

class ARUI {
  constructor() {
    this.isStarted = false;
    this.recorder = null;
    this.recordingBlob = null;

    // Dev tuning panel state (persisted in localStorage)
    this.tuningParams = {
      filterMinCF: 0.02,
      filterBeta: 60,
      alphaMin: 0.12,
      alphaMax: 0.22,
      overscan: 1.02,
      smoothingEnabled: true
    };

    // Load persisted tuning parameters
    this.loadTuningParams();
  }

  /**
   * Initialize the UI system
   */
  init() {
    this.createStartOverlay();
    this.createControls();
    this.createTuningPanel();
    this.setupEventListeners();
    this.setupTargetListeners();

    // Disable pointer events on scene until started
    this.disableScenePointerEvents();
  }

  /**
   * Create the tap-to-start overlay for iOS compatibility
   * @private
   */
  createStartOverlay() {
    // Remove existing overlay if present
    const existing = document.getElementById('start-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'start-overlay';
    overlay.innerHTML = `
      <div class="start-content">
        <h1>WebAR Experience</h1>
        <p>Tap to start AR experience</p>
        <button id="start-button" class="start-button">Start</button>
      </div>
    `;

    // Style the overlay
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(overlay);

    // Handle start button click
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', () => {
      this.startExperience();
    });

    // Ensure button is always clickable (iOS fix)
    startButton.style.touchAction = 'manipulation';
  }

  /**
   * Start the AR experience after user gesture
   * @private
   */
  async startExperience() {
    try {
      // Unlock audio/video on iOS
      await this.unlockMedia();

      // Hide start overlay
      const overlay = document.getElementById('start-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }

      // Re-enable pointer events on scene
      this.enableScenePointerEvents();

      this.isStarted = true;

      // Initialize recorder
      this.initRecorder();

      // Start MindAR scene (this starts the camera and begins tracking)
      await this.startMindAR();

      console.log('AR experience started');
    } catch (error) {
      console.error('Failed to start AR experience:', error);
    }
  }

  /**
   * Start the MindAR scene and camera
   * @private
   */
  async startMindAR() {
    console.log('🎥 Attempting to start MindAR...');

    // Wait for MindAR library to be fully loaded
    let attempts = 0;
    while (typeof window.MINDAR === 'undefined' && attempts < 50) {
      console.log('⏳ Waiting for MindAR library to load...');
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window.MINDAR === 'undefined') {
      const errorMsg = '❌ MindAR library failed to load. Please check your internet connection and refresh the page.';
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ MindAR library is available');

    // First, check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = '❌ Camera API not supported by this browser. Please use a modern browser like Chrome, Firefox, or Safari.';
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    // Test camera access before starting MindAR
    try {
      console.log('🔍 Testing camera access...');
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      // Immediately stop the test stream
      testStream.getTracks().forEach(track => track.stop());
      console.log('✅ Camera access test successful');
    } catch (testError) {
      console.error('❌ Camera access test failed:', testError);
      if (testError.name === 'NotAllowedError') {
        const errorMsg = '🚫 Camera access denied. Please allow camera permissions in your browser settings and refresh the page.';
        console.error(errorMsg);
        alert(errorMsg);
        throw testError;
      } else if (testError.name === 'NotFoundError') {
        const errorMsg = '📷 No camera found. Please check your camera connection.';
        console.error(errorMsg);
        alert(errorMsg);
        throw testError;
      }
    }

    const scene = document.querySelector('a-scene[mindar]');
    if (!scene) {
      const errorMsg = '❌ MindAR scene not found. Check if A-Frame and MindAR loaded properly.';
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ MindAR scene found, attempting to start...');

    // Check if MindAR is properly initialized
    if (!scene.mindar) {
      const errorMsg = '❌ MindAR not initialized on scene. Check CDN links and loading order.';
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log('🚀 Calling scene.mindar.start()...');

      // Start MindAR (this will request camera permissions)
      await scene.mindar.start();

      console.log('✅ MindAR started successfully');
    } catch (error) {
      console.error('❌ Failed to start MindAR. Full error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      // More specific error handling
      if (error.name === 'NotAllowedError' || error.message?.includes('NotAllowedError')) {
        const errorMsg = '🚫 Camera access denied. Please allow camera permissions in your browser and refresh the page.';
        console.error(errorMsg);
        alert(errorMsg);
      } else if (error.name === 'NotFoundError' || error.message?.includes('NotFoundError')) {
        const errorMsg = '📷 No camera found. Please check your camera connection and try again.';
        console.error(errorMsg);
        alert(errorMsg);
      } else if (error.name === 'NotSupportedError' || error.message?.includes('NotSupportedError')) {
        const errorMsg = '⚠️ Camera not supported by this browser. Try a different browser or device.';
        console.error(errorMsg);
        alert(errorMsg);
      } else if (error.message?.includes('targets.mind')) {
        const errorMsg = '🎯 Target file issue. Please check that targets.mind is properly generated from your image.';
        console.error(errorMsg);
        alert(errorMsg);
      } else {
        const errorMsg = `⚠️ AR experience failed to start. Error: ${error.message || 'Unknown error'}. Please check camera permissions and try again.`;
        console.error(errorMsg);
        alert(errorMsg);
      }

      throw error;
    }
  }

  /**
   * Unlock audio/video playback on iOS (requires user gesture)
   * @private
   */
  async unlockMedia() {
    const overlayVideo = document.getElementById('overlay-video');
    if (overlayVideo) {
      try {
        // Attempt to play video to unlock media
        await overlayVideo.play();
        overlayVideo.pause();
        overlayVideo.currentTime = 0;
      } catch (error) {
        console.warn('Could not unlock overlay video:', error);
      }
    }

    // Create and immediately suspend audio context to unlock audio
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    }
  }

  /**
   * Disable pointer events on the A-Frame scene
   * @private
   */
  disableScenePointerEvents() {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.style.pointerEvents = 'none';
    }
  }

  /**
   * Re-enable pointer events on the A-Frame scene
   * @private
   */
  enableScenePointerEvents() {
    const scene = document.querySelector('a-scene');
    if (scene) {
      scene.style.pointerEvents = 'auto';
    }
  }

  /**
   * Create recording and tuning controls
   * @private
   */
  createControls() {
    // Remove existing controls if present
    const existing = document.getElementById('ar-controls');
    if (existing) existing.remove();

    const controls = document.createElement('div');
    controls.id = 'ar-controls';
    controls.innerHTML = `
      <div class="control-group">
        <button id="record-button" class="control-button">Record</button>
        <label class="checkbox-label">
          <input type="checkbox" id="include-mic"> Include Mic
        </label>
      </div>
      <div class="control-group">
        <select id="record-format">
          <option value="webm">WebM</option>
          <option value="mp4">MP4</option>
        </select>
        <a id="download-link" class="download-link" style="display:none;">Download</a>
      </div>
    `;

    controls.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      padding: 15px;
      border-radius: 10px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 1000;
    `;

    document.body.appendChild(controls);

    // Set up recording event listeners
    this.setupRecordingControls();
  }

  /**
   * Set up recording control event listeners
   * @private
   */
  setupRecordingControls() {
    const recordButton = document.getElementById('record-button');
    const includeMicCheckbox = document.getElementById('include-mic');
    const formatSelect = document.getElementById('record-format');
    const downloadLink = document.getElementById('download-link');

    recordButton.addEventListener('click', async () => {
      if (!this.recorder) {
        console.error('Recorder not initialized');
        return;
      }

      try {
        if (this.recorder.getState().isRecording) {
          // Stop recording
          recordButton.textContent = 'Record';
          recordButton.classList.remove('recording');

          this.recordingBlob = await this.recorder.stopRecording();

          // Show download link
          downloadLink.href = URL.createObjectURL(this.recordingBlob);
          downloadLink.download = `webar-recording-${Date.now()}.${formatSelect.value}`;
          downloadLink.style.display = 'inline-block';

          console.log('Recording stopped');
        } else {
          // Start recording
          recordButton.textContent = 'Stop Recording';
          recordButton.classList.add('recording');

          await this.recorder.startRecording({
            includeMic: includeMicCheckbox.checked,
            format: formatSelect.value
          });

          // Hide download link
          downloadLink.style.display = 'none';

          console.log('Recording started');
        }
      } catch (error) {
        console.error('Recording failed:', error);
        recordButton.textContent = 'Record';
        recordButton.classList.remove('recording');
      }
    });

    // Add recording indicator styles
    const style = document.createElement('style');
    style.textContent = `
      .recording {
        background: #ff4444 !important;
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }

      .download-link {
        display: inline-block;
        margin-left: 10px;
        padding: 8px 12px;
        background: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-size: 12px;
      }

      .checkbox-label {
        margin-left: 10px;
        cursor: pointer;
      }

      .checkbox-label input {
        margin-right: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the dev tuning panel
   * @private
   */
  createTuningPanel() {
    // Only create in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      this.createDevTuningPanel();
    }
  }

  /**
   * Create the development tuning panel
   * @private
   */
  createDevTuningPanel() {
    const panel = document.createElement('div');
    panel.id = 'tuning-panel';
    panel.innerHTML = `
      <div class="tuning-header">
        <h3>Dev Tuning Panel</h3>
        <button id="toggle-smoothing">Toggle Smoothing</button>
        <button id="reset-tuning">Reset</button>
      </div>
      <div class="tuning-group">
        <label>MindAR Filter Min CF: <input type="number" id="filter-mincf" step="0.001" min="0.001" max="1.0"></label>
        <input type="range" id="filter-mincf-slider" min="0.001" max="1.0" step="0.001">
      </div>
      <div class="tuning-group">
        <label>MindAR Filter Beta: <input type="number" id="filter-beta" step="1" min="0" max="200"></label>
        <input type="range" id="filter-beta-slider" min="0" max="200" step="1">
      </div>
      <div class="tuning-group">
        <label>Content Alpha Min: <input type="number" id="alpha-min" step="0.01" min="0.01" max="1.0"></label>
        <input type="range" id="alpha-min-slider" min="0.01" max="1.0" step="0.01">
      </div>
      <div class="tuning-group">
        <label>Content Alpha Max: <input type="number" id="alpha-max" step="0.01" min="0.01" max="1.0"></label>
        <input type="range" id="alpha-max-slider" min="0.01" max="1.0" step="0.01">
      </div>
      <div class="tuning-group">
        <label>Overscan: <input type="number" id="overscan" step="0.001" min="1.0" max="1.1"></label>
        <input type="range" id="overscan-slider" min="1.0" max="1.1" step="0.001">
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      padding: 15px;
      border-radius: 10px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      max-width: 250px;
      z-index: 1000;
    `;

    document.body.appendChild(panel);

    this.setupTuningControls();
  }

  /**
   * Set up tuning control event listeners
   * @private
   */
  setupTuningControls() {
    const inputs = [
      { id: 'filter-mincf', slider: 'filter-mincf-slider', param: 'filterMinCF' },
      { id: 'filter-beta', slider: 'filter-beta-slider', param: 'filterBeta' },
      { id: 'alpha-min', slider: 'alpha-min-slider', param: 'alphaMin' },
      { id: 'alpha-max', slider: 'alpha-max-slider', param: 'alphaMax' },
      { id: 'overscan', slider: 'overscan-slider', param: 'overscan' }
    ];

    inputs.forEach(({ id, slider, param }) => {
      const input = document.getElementById(id);
      const sliderInput = document.getElementById(slider);

      if (input && sliderInput) {
        // Set initial values
        input.value = this.tuningParams[param];
        sliderInput.value = this.tuningParams[param];

        // Handle input changes
        const updateValue = () => {
          const value = parseFloat(input.value);
          this.tuningParams[param] = value;
          sliderInput.value = value;
          this.saveTuningParams();
          this.applyTuningParams();
        };

        input.addEventListener('input', updateValue);
        sliderInput.addEventListener('input', () => {
          input.value = sliderInput.value;
          updateValue();
        });
      }
    });

    // Toggle smoothing button
    const toggleButton = document.getElementById('toggle-smoothing');
    toggleButton.addEventListener('click', () => {
      this.tuningParams.smoothingEnabled = !this.tuningParams.smoothingEnabled;
      this.applyTuningParams();
      toggleButton.textContent = this.tuningParams.smoothingEnabled ? 'Disable Smoothing' : 'Enable Smoothing';
    });

    // Reset button
    const resetButton = document.getElementById('reset-tuning');
    resetButton.addEventListener('click', () => {
      this.resetTuningParams();
    });

    // Set initial button state
    toggleButton.textContent = this.tuningParams.smoothingEnabled ? 'Disable Smoothing' : 'Enable Smoothing';
  }

  /**
   * Set up video playback control based on target detection
   * @private
   */
  setupTargetListeners() {
    const overlayVideo = document.getElementById('overlay-video');
    if (!overlayVideo) return;

    // Listen for target events on the marker entity
    const marker = document.querySelector('[mindar-image-target]');
    if (marker) {
      marker.addEventListener('targetFound', () => {
        overlayVideo.play().catch(console.error);
      });

      marker.addEventListener('targetLost', () => {
        overlayVideo.pause();
      });
    }
  }

  /**
   * Initialize the recorder
   * @private
   */
  initRecorder() {
    try {
      this.recorder = getRecorder();
      if (!this.recorder) {
        initRecorder();
        this.recorder = getRecorder();
      }
    } catch (error) {
      console.error('Failed to initialize recorder:', error);
    }
  }

  /**
   * Apply tuning parameters to the scene
   * @private
   */
  applyTuningParams() {
    // Update MindAR scene parameters
    const scene = document.querySelector('a-scene[mindar]');
    if (scene) {
      scene.setAttribute('mindar', {
        filterMinCF: this.tuningParams.filterMinCF,
        filterBeta: this.tuningParams.filterBeta
      });
    }

    // Update smooth-follow component
    const smoothFollowEntities = document.querySelectorAll('[smooth-follow]');
    smoothFollowEntities.forEach(entity => {
      entity.setAttribute('smooth-follow', {
        alphaMin: this.tuningParams.alphaMin,
        alphaMax: this.tuningParams.alphaMax,
        overscan: this.tuningParams.overscan
      });
    });
  }

  /**
   * Save tuning parameters to localStorage
   * @private
   */
  saveTuningParams() {
    try {
      localStorage.setItem('webar-tuning-params', JSON.stringify(this.tuningParams));
    } catch (error) {
      console.warn('Could not save tuning params:', error);
    }
  }

  /**
   * Load tuning parameters from localStorage
   * @private
   */
  loadTuningParams() {
    try {
      const saved = localStorage.getItem('webar-tuning-params');
      if (saved) {
        this.tuningParams = { ...this.tuningParams, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Could not load tuning params:', error);
    }
  }

  /**
   * Reset tuning parameters to defaults
   * @private
   */
  resetTuningParams() {
    this.tuningParams = {
      filterMinCF: 0.02,
      filterBeta: 60,
      alphaMin: 0.12,
      alphaMax: 0.22,
      overscan: 1.02,
      smoothingEnabled: true
    };

    this.saveTuningParams();
    this.applyTuningParams();

    // Update UI controls
    this.setupTuningControls();
  }
}

// === POINTER EVENTS FIX END ===

/**
 * Global UI instance
 */
let arUI = null;

/**
 * Initialize the global UI system
 */
function initUI() {
  if (!arUI) {
    arUI = new ARUI();
    arUI.init();
  }
  return arUI;
}

/**
 * Get the global UI instance
 */
function getUI() {
  return arUI;
}
