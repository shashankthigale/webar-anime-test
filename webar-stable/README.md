# WebAR Image Tracking Experience

A production-quality image-tracking WebAR application using A-Frame and MindAR with advanced smoothing techniques for 8th Wall-like stability and user experience.

## Features

- **Rock-solid image tracking** with minimal jitter and lag using double smoothing
- **One-Euro filtering** for both marker pose and content smoothing
- **Composite recording** of camera feed + AR overlays to downloadable video
- **iOS-compatible** tap-to-start overlay with proper media unlocking
- **Development tuning panel** for real-time parameter adjustment
- **Responsive design** optimized for mobile AR experiences

## Quick Start

### 1. Setup Target Image

1. **Prepare your target image:**
   - Use a high-contrast, detailed image (avoid symmetry/repeating patterns)
   - Ensure flat, matte printing (not glossy)
   - Good even lighting when capturing
   - At least 200x200 pixels

2. **Generate targets.mind file:**
   - Go to [MindAR Image Compiler](https://hiukim.github.io/mindar-js/mindar-image/tools/compile/)
   - Upload your target image
   - Download the generated `targets.mind` file
   - Replace `assets/targets.mind` with your compiled file

3. **Add your overlay video:**
   - Replace `assets/overlay.mp4` with your MP4 video file
   - 16:9 aspect ratio recommended
   - H.264 codec for best compatibility

### 2. Run the Application

```bash
# Using Node.js serve (recommended)
npx serve webar-stable

# Or using Python
cd webar-stable && python -m http.server 8000

# Or using PHP
cd webar-stable && php -S localhost:8000
```

Open `http://localhost:8000` in your browser and allow camera access.

### 3. Mobile Testing

For best results, test on actual mobile devices:

1. **iOS Safari:** Works with MindAR's custom pipeline (no WebXR API exposure)
2. **Android Chrome:** Full WebXR support available
3. **Use HTTPS in production** for camera access on mobile

## Smoothing & Performance

### Double Smoothing Architecture

This app implements a two-layer smoothing system for 8th Wall-like stability:

1. **MindAR Built-in One-Euro Filter** - Smooths the raw marker pose
2. **Content-side One-Euro Filter** - Smooths the placed media node position/rotation

### Tuning Guide

#### MindAR Parameters (`index.html` a-scene attributes)

```html
<a-scene mindar="imageTargetSrc: ./assets/targets.mind; filterMinCF: 0.02; filterBeta: 60; warmupTolerance: 3; missTolerance: 3;">
```

| Parameter | Default | Effect | Tuning |
|-----------|---------|--------|--------|
| `filterMinCF` | 0.02 | Minimum cutoff frequency | **Lower** = more jitter reduction, **higher** = more responsive |
| `filterBeta` | 60 | Speed coefficient | **Higher** = more responsive to fast motion, **lower** = more stable |
| `warmupTolerance` | 3 | Frames before "found" | **Higher** = more stable detection |
| `missTolerance` | 3 | Frames before "lost" | **Higher** = more stable tracking |

#### Content Smoothing Parameters (Dev Panel)

| Parameter | Default | Effect |
|-----------|---------|--------|
| `alphaMin` | 0.12 | Minimum lerp factor (more smoothing) |
| `alphaMax` | 0.22 | Maximum lerp factor (more responsive) |
| `overscan` | 1.02 | Edge wobble masking (1.02-1.03 recommended) |

### One-Euro Filter Tuning Methodology (Casiez)

1. **Step 1:** Set `filterBeta = 0`, adjust `filterMinCF` until jitter is eliminated at slow motions
2. **Step 2:** Increase `filterBeta` until fast motions feel responsive
3. **Step 3:** Fine-tune `alphaMin`/`alphaMax` for content smoothing

## User Interface

### Tap-to-Start Overlay
- **iOS Compatibility:** Unlocks audio/video on user gesture
- **Pointer Events Fix:** Scene receives events only after start
- **Always Clickable:** Start button uses `touch-action: manipulation`

### Recording Controls
- **Composite Recording:** Camera feed + AR overlays
- **Audio Support:** Optional microphone inclusion
- **Format Selection:** WebM (better compression) or MP4
- **Download:** Automatic file generation after recording

### Development Tuning Panel (localhost only)
- **Real-time Adjustment:** All smoothing parameters
- **Persistent Storage:** Settings saved in localStorage
- **Visual Feedback:** Live parameter updates

## Platform Notes

### iOS Safari
- **WebXR Limitation:** Safari doesn't expose WebXR API
- **MindAR Solution:** Uses custom camera + rendering pipeline
- **Media Unlocking:** Requires user gesture for audio/video
- **Testing:** Use actual iOS devices (simulator has limitations)

### Android Chrome
- **Full WebXR:** Native WebXR API support
- **Better Performance:** Hardware acceleration available
- **Camera API:** Standard getUserMedia implementation

### Desktop
- **Limited Support:** Requires compatible webcam
- **Development:** localhost testing works well
- **Production:** HTTPS required for camera access

## Target Image Best Practices

### Image Selection
- ✅ **High contrast, detailed images** (rich features)
- ✅ **Asymmetric designs** (avoid rotational symmetry)
- ✅ **Unique patterns** (avoid repeating elements)
- ❌ **Low contrast or blurry images**
- ❌ **Symmetrical/repeating patterns**

### Printing & Setup
- ✅ **Matte paper** (avoid glossy/reflective surfaces)
- ✅ **Flat printing** (no curves or wrinkles)
- ✅ **Even lighting** (no harsh shadows or glare)
- ✅ **Proper size** (fill significant camera FOV)
- ❌ **Glossy laminates** (cause reflections)
- ❌ **Curved surfaces** (use appropriate tracking mode)

### Testing Checklist
- [ ] Image tracks reliably from multiple angles
- [ ] No false positives on similar images
- [ ] Stable tracking under various lighting conditions
- [ ] Smooth following without jitter or lag
- [ ] Video plays/pauses correctly on detection

## Performance Optimization

### Memory Management
- **Pre-allocated Objects:** THREE.Vector3/Quaternion instances reused
- **Garbage Avoidance:** No per-frame object creation in tick()
- **Canvas Reuse:** Hidden mixer canvas for recording

### Rendering Optimization
- **Lightweight Scene:** Minimal geometry and materials
- **Efficient Textures:** Proper video texture handling
- **Adaptive Smoothing:** Reduces computation during slow motion

### Mobile Performance
- **Target FPS:** 30 FPS for recording, 60 FPS for interaction
- **Video Optimization:** Hardware-decodable codecs
- **Memory Limits:** Monitor and clean up resources

## Development

### Project Structure
```
webar-stable/
├── index.html              # Main application file
├── styles/app.css          # Responsive styling
├── scripts/
│   ├── smoothing.js        # One-Euro filter + smooth-follow component
│   ├── recorder.js         # Composite recording system
│   └── ui.js               # Controls and tuning panel
├── assets/
│   ├── targets.mind        # Compiled target descriptors
│   ├── poster.png          # Target image (placeholder)
│   └── overlay.mp4         # Overlay video (placeholder)
└── README.md               # This file
```

### Key Components

#### smoothing.js
- **OneEuroFilter:** Adaptive cutoff frequency filtering
- **LowPassFilter:** First-order low-pass implementation
- **smooth-follow:** A-Frame component with overscan support

#### recorder.js
- **ARRecorder:** Composite video recording with audio
- **Audio Mixing:** MediaElementSource + optional microphone
- **Canvas Mixing:** Camera feed + WebGL overlay

#### ui.js
- **ARUI:** Complete UI management system
- **Pointer Events:** iOS-compatible event routing
- **Tuning Panel:** Development parameter adjustment

## Troubleshooting

### Common Issues

**Tracking not working:**
- Check target image quality and lighting
- Regenerate `targets.mind` file with proper image
- Test on actual mobile device (not simulator)

**Video not playing:**
- Ensure MP4 format with H.264 codec
- Check file path and server setup
- Verify video dimensions and aspect ratio

**Recording fails:**
- Check browser MediaRecorder support
- Ensure HTTPS for camera access
- Verify canvas and video element availability

**iOS issues:**
- Test on actual device (Safari simulator limited)
- Ensure user gesture before media operations
- Check camera permissions and HTTPS setup

### Browser Support
- **Chrome 88+** (Android/Desktop)
- **Safari 14.5+** (iOS)
- **Firefox 85+** (Desktop - limited camera support)

## License

This project demonstrates WebAR techniques and is intended for educational and development purposes.

## Acknowledgments

- **MindAR:** Image tracking engine ([hiukim.github.io](https://hiukim.github.io/mindar-js/))
- **A-Frame:** Web framework for building AR experiences ([aframe.io](https://aframe.io))
- **One Euro Filter:** Géry Casiez et al. ([direction.bordeaux.inria.fr](https://gery.casiez.net/1euro/))
- **8th Wall:** Target tracking quality inspiration ([8thwall.com](https://www.8thwall.com/))

---

For issues and contributions, please refer to the project documentation and ensure all target image guidelines are followed for optimal tracking performance.
