/**
 * Composite recording system for WebAR applications.
 * Records camera feed + AR overlays to a downloadable video file.
 *
 * Features:
 * - Mixes MindAR camera video with A-Frame WebGL canvas
 * - Optional microphone audio inclusion
 * - Multiple format support (MP4/WebM)
 * - Clean resource management
 *
 * @author WebAR Engineer
 */

class ARRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.mixCanvas = null;
    this.canvasContext = null;
    this.cameraVideo = null;
    this.webglCanvas = null;
    this.animationFrame = null;
    this.recordedChunks = [];
    this.destinationStream = null;

    // Pre-allocate for performance
    this.tempCanvas = document.createElement('canvas');
    this.tempContext = this.tempCanvas.getContext('2d');
  }

  /**
   * Initialize the recorder by finding required elements
   * @param {Object} options - Configuration options
   * @param {string} options.webglCanvasSelector - CSS selector for A-Frame canvas
   * @param {string} options.mixCanvasId - ID for the mixing canvas
   * @param {number} options.fps - Target recording FPS (default: 30)
   */
  init(options = {}) {
    const {
      webglCanvasSelector = 'canvas[aframe-injected]',
      mixCanvasId = 'mix-canvas',
      fps = 30
    } = options;

    // Find the WebGL canvas (A-Frame)
    this.webglCanvas = document.querySelector(webglCanvasSelector);
    if (!this.webglCanvas) {
      throw new Error('WebGL canvas not found. Make sure A-Frame is loaded.');
    }

    // Find MindAR's camera video element
    this.cameraVideo = this.findCameraVideo();
    if (!this.cameraVideo) {
      throw new Error('Camera video element not found. Make sure MindAR is initialized.');
    }

    // Create mixing canvas
    this.mixCanvas = document.createElement('canvas');
    this.mixCanvas.id = mixCanvasId;
    this.mixCanvas.style.display = 'none';
    document.body.appendChild(this.mixCanvas);
    this.canvasContext = this.mixCanvas.getContext('2d');

    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }

  /**
   * Find MindAR's hidden camera video element
   * @private
   */
  findCameraVideo() {
    // MindAR creates a video element with srcObject (camera stream)
    const videos = document.querySelectorAll('video');

    for (let video of videos) {
      if (video.srcObject && video.srcObject.getVideoTracks) {
        // Check if this looks like a camera stream
        const tracks = video.srcObject.getVideoTracks();
        if (tracks.length > 0 && tracks[0].kind === 'video') {
          return video;
        }
      }
    }

    return null;
  }

  /**
   * Start recording with optional microphone audio
   * @param {Object} options - Recording options
   * @param {boolean} options.includeMic - Whether to include microphone audio
   * @param {string} options.format - Recording format ('mp4' or 'webm')
   */
  async startRecording(options = {}) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    const { includeMic = false, format = 'webm' } = options;

    try {
      // Set up audio context and mixing
      await this.setupAudioMixing(includeMic);

      // Set up video mixing
      this.setupVideoMixing();

      // Determine MIME type based on format and browser support
      const mimeType = this.getSupportedMimeType(format);

      // Create MediaRecorder
      const mixStream = this.createMixStream();
      this.mediaRecorder = new MediaRecorder(mixStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps for decent quality
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.cleanup();
      };

      // Start recording
      this.recordedChunks = [];
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      // Start the mixing animation loop
      this.startMixingLoop();

      console.log(`Recording started with format: ${mimeType}`);

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Set up audio mixing with overlay video and optional microphone
   * @private
   */
  async setupAudioMixing(includeMic) {
    const overlayVideo = document.getElementById('overlay-video');
    if (!overlayVideo) {
      throw new Error('Overlay video element not found');
    }

    // Create audio context
    this.audioContext = new AudioContext();

    // Create media element source for overlay video
    const videoSource = this.audioContext.createMediaElementSource(overlayVideo);

    let micSource = null;
    if (includeMic) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        micSource = this.audioContext.createMediaStreamSource(micStream);
      } catch (error) {
        console.warn('Could not access microphone:', error);
      }
    }

    // Create destination stream
    const destination = this.audioContext.createMediaStreamDestination();

    // Connect sources to destination
    videoSource.connect(destination);

    if (micSource) {
      // Mix microphone with 70% video / 30% mic for balanced audio
      const videoGain = this.audioContext.createGain();
      const micGain = this.audioContext.createGain();

      videoGain.gain.value = 0.7;
      micGain.gain.value = 0.3;

      videoSource.connect(videoGain);
      micSource.connect(micGain);

      videoGain.connect(destination);
      micGain.connect(destination);
    } else {
      videoSource.connect(destination);
    }

    this.destinationStream = destination.stream;
  }

  /**
   * Set up video mixing canvas dimensions and scaling
   * @private
   */
  setupVideoMixing() {
    // Set mix canvas size to match camera video
    const videoRect = this.cameraVideo.getBoundingClientRect();
    this.mixCanvas.width = videoRect.width;
    this.mixCanvas.height = videoRect.height;
  }

  /**
   * Create the mixed media stream for recording
   * @private
   */
  createMixStream() {
    // Get the mix canvas stream
    const canvasStream = this.mixCanvas.captureStream(this.targetFPS);

    // Combine with audio stream
    const tracks = [
      ...canvasStream.getVideoTracks(),
      ...this.destinationStream.getAudioTracks()
    ];

    return new MediaStream(tracks);
  }

  /**
   * Get the best supported MIME type for the requested format
   * @private
   */
  getSupportedMimeType(format) {
    const types = format === 'mp4'
      ? ['video/mp4;codecs=h264', 'video/mp4']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return format === 'mp4' ? 'video/mp4' : 'video/webm';
  }

  /**
   * Start the animation loop that mixes camera and AR overlay
   * @private
   */
  startMixingLoop() {
    const loop = (timestamp) => {
      if (!this.isRecording) return;

      this.mixFrame();
      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
  }

  /**
   * Mix a single frame: camera feed + WebGL overlay
   * @private
   */
  mixFrame() {
    if (!this.canvasContext || !this.cameraVideo || !this.webglCanvas) {
      return;
    }

    const ctx = this.canvasContext;
    const { width, height } = this.mixCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw camera feed first (background)
    try {
      ctx.drawImage(this.cameraVideo, 0, 0, width, height);
    } catch (error) {
      // Camera might not be ready yet
      console.warn('Camera not ready for mixing:', error);
    }

    // Draw WebGL overlay on top
    try {
      ctx.drawImage(this.webglCanvas, 0, 0, width, height);
    } catch (error) {
      // WebGL canvas might not be ready
      console.warn('WebGL canvas not ready for mixing:', error);
    }
  }

  /**
   * Stop recording and return the recorded blob
   * @returns {Promise<Blob>} The recorded video blob
   */
  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      this.isRecording = false;

      // Stop the mixing animation loop
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      // Set up one-time event handler for when recording stops
      const onStop = () => {
        try {
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder.mimeType
          });

          resolve(blob);
        } catch (error) {
          reject(error);
        }

        // Clean up
        this.mediaRecorder.removeEventListener('onstop', onStop);
      };

      this.mediaRecorder.addEventListener('stop', onStop);
      this.mediaRecorder.stop();
    });
  }

  /**
   * Clean up all resources
   * @private
   */
  cleanup() {
    // Stop animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Remove mix canvas
    if (this.mixCanvas && this.mixCanvas.parentNode) {
      this.mixCanvas.parentNode.removeChild(this.mixCanvas);
      this.mixCanvas = null;
      this.canvasContext = null;
    }

    // Reset state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.destinationStream = null;
    this.isRecording = false;
  }

  /**
   * Get current recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      canRecord: !!(this.cameraVideo && this.webglCanvas),
      supportedFormats: this.getSupportedFormats()
    };
  }

  /**
   * Get list of supported recording formats
   * @private
   */
  getSupportedFormats() {
    const formats = [];

    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
        MediaRecorder.isTypeSupported('video/webm')) {
      formats.push('webm');
    }

    if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ||
        MediaRecorder.isTypeSupported('video/mp4')) {
      formats.push('mp4');
    }

    return formats;
  }
}

/**
 * Global recorder instance
 */
let arRecorder = null;

/**
 * Initialize the global recorder instance
 */
function initRecorder(options = {}) {
  if (!arRecorder) {
    arRecorder = new ARRecorder();
    arRecorder.init(options);
  }
  return arRecorder;
}

/**
 * Get the global recorder instance
 */
function getRecorder() {
  return arRecorder;
}
