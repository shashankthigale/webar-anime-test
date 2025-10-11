document.addEventListener('DOMContentLoaded', () => {
  let mediaRecorder;
  let recordedChunks = [];
  let audioStream = null;
  let audioContext = null;
  let mixedStream = null;

  const recordButton = document.getElementById('record-button');
  const micCheckbox = document.getElementById('mic-checkbox');
  const downloadLink = document.getElementById('download-link');
  const sceneEl = document.getElementById('ar-scene');
  const mixCanvas = document.getElementById('mix-canvas');
  const overlayVideo = document.getElementById('overlay-video');
  const ctx = mixCanvas.getContext('2d');

  let cameraVideo = null;

  function findCameraVideo() {
    const videos = document.querySelectorAll('video');
    for (let video of videos) {
      if (video.srcObject && video.id !== 'overlay-video') {
        return video;
      }
    }
    return null;
  }

  function startRecording() {
    cameraVideo = findCameraVideo();
    if (!cameraVideo) {
      console.error("MindAR camera stream not found.");
      return;
    }
    
    // Set canvas size to match camera video
    mixCanvas.width = cameraVideo.videoWidth;
    mixCanvas.height = cameraVideo.videoHeight;

    const arCanvas = sceneEl.canvas;
    
    const draw = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        ctx.drawImage(cameraVideo, 0, 0, mixCanvas.width, mixCanvas.height);
        ctx.drawImage(arCanvas, 0, 0, mixCanvas.width, mixCanvas.height);
        requestAnimationFrame(draw);
      }
    };
    draw();
    
    const canvasStream = mixCanvas.captureStream(30);
    const videoStream = canvasStream.getVideoTracks()[0];

    setupAudio().then(() => {
        const tracks = [videoStream];
        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => tracks.push(track));
        }

        mixedStream = new MediaStream(tracks);
        
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
        mediaRecorder = new MediaRecorder(mixedStream, { mimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = `ar-recording.${mimeType.split('/')[1]}`;
            downloadLink.style.display = 'block';
            recordedChunks = [];
            stopAllTracks();
        };

        mediaRecorder.start();
        recordButton.textContent = 'Stop';
    });
  }

  async function setupAudio() {
    if (!micCheckbox.checked && !overlayVideo.muted) {
        audioContext = new AudioContext();
        const videoSource = audioContext.createMediaElementSource(overlayVideo);
        const dest = audioContext.createMediaStreamDestination();
        videoSource.connect(dest);
        audioStream = dest.stream;
    } else if (micCheckbox.checked) {
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new AudioContext();
            const dest = audioContext.createMediaStreamDestination();

            if (!overlayVideo.muted) {
                const videoSource = audioContext.createMediaElementSource(overlayVideo);
                videoSource.connect(dest);
            }

            const micSource = audioContext.createMediaStreamSource(micStream);
            micSource.connect(dest);
            audioStream = dest.stream;

        } catch(err) {
            console.error("Error accessing microphone:", err);
            audioStream = null;
        }
    } else {
        audioStream = null;
    }
  }

  function stopRecording() {
    mediaRecorder.stop();
    recordButton.textContent = 'Record';
  }
  
  function stopAllTracks() {
    if (mixedStream) {
        mixedStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    mixedStream = null;
    audioStream = null;
  }

  recordButton.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      startRecording();
    } else {
      stopRecording();
    }
  });
});
