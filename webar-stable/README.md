# Production-Quality Image Tracking WebAR

This project is a complete, production-quality image-tracking WebAR application built with A-Frame and MindAR. It's designed for a rock-solid feel on flat printed targets, comparable to best-in-class commercial solutions like 8th Wall.

It achieves this stability through a **double-smoothing** technique:

1.  **MindAR's Built-in Filter:** The core `mindar-image` system uses a One-Euro filter on the raw marker pose.
2.  **Content-Side Smoother:** A second, adaptive One-Euro filter (`smooth-follow` component) is applied to the visual content (the video plane), further reducing jitter and "swim".

The entire application runs from a static folder with no server-side logic or build tools required.

## Project Structure

```
/
├── index.html              # Main application file
├── README.md               # This file
├── /assets/
│   ├── targets.mind        # Compiled image targets
│   ├── poster.png          # Example target image
│   └── overlay.mp4         # Example video to overlay on the target
├── /scripts/
│   ├── smoothing.js        # One-Euro filter logic and A-Frame component
│   ├── recorder.js         # Composite recording (camera + AR)
│   └── ui.js               # Start overlay, tuning panel, and event handling
└── /styles/
    └── app.css             # UI styling
```

## How to Run

1.  **Serve the folder:** You need a local HTTP server to run this project due to browser security policies for accessing the camera.
    - If you have Node.js, the easiest way is using `serve`:
      ```bash
      npx serve
      ```
    - Alternatively, you can use Python's built-in server:
      ```bash
      # For Python 3
      python -m http.server
      ```
2.  **Access on your phone:** Open the provided URL (e.g., `http://localhost:3000` or `http://localhost:8000`) on your computer. To run it on your phone, connect to the same Wi-Fi network and navigate to your computer's local IP address (e.g., `http://192.168.1.100:3000`).
    - **HTTPS Required for Camera:** Most mobile browsers require a secure `https` connection to access the camera. The `serve` package often provides an `https` URL. If your server doesn't, a tool like `ngrok` can create a secure tunnel to your localhost.

## Creating Your Own Targets

The `assets/targets.mind` file is a compiled database of your image targets. You cannot use image files directly.

1.  **Choose Good Target Images:** See the "Target & Print Best Practices" checklist below. A good target is critical for stable tracking. Use `assets/poster.png` as an example.
2.  **Use the MindAR Compiler:** Go to the official [MindAR Image Targets Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile/).
3.  **Compile:** Upload your target image(s). The compiler will process them and give you a `targets.mind` file to download.
4.  **Replace:** Place the downloaded file into the `/assets` directory, replacing the placeholder.

## Tuning for Stability ("8th Wall-like Feel")

The app's stability comes from careful tuning of its two smoothing filters. A dev tuning panel is available on desktop to adjust these values live.

### 1. MindAR Engine Tuning (`<a-scene mindar-image>`)

These parameters control the first layer of smoothing applied directly to the detected marker pose.

- `filterMinCF` (Min Cutoff Frequency): This is the most important value for reducing jitter. Lower values increase smoothing but can add latency (a "drunken" feel). **Good range: 0.001 to 0.05.**
- `filterBeta`: This value helps reduce lag during _fast motion_. If the tracking feels sluggish when you move the target quickly, increase `filterBeta`. **Good range: 10 to 1000.**

### 2. Content Smoother Tuning (`smooth-follow` component)

This is the second smoothing layer, which gives the content its final, stable appearance. It uses the One-Euro filter algorithm. The tuning recipe, as described by the filter's creator Gery Casiez, is a two-step process:

1.  **Set `beta` to 0** and move the target very slowly. Find the lowest `mincutoff` value that removes all visible jitter.
2.  **Increase `beta`** to reduce lag when you move the target more quickly. Find a value that feels responsive without re-introducing jitter.

- `overscan`: This scales the video plane up slightly (e.g., 1.02 for 2%) to hide sub-pixel wobbling that can occur at the very edges of the frame, making the content appear perfectly locked.

### Target & Print Best Practices Checklist

The quality of your physical target is as important as the code.

- [ ] **High Detail & Contrast:** The image should have many unique feature points. Photos of detailed objects, textured surfaces, or illustrations work well. Avoid logos with large areas of solid color.
- [ ] **Flat & Matte Surface:** Print on non-glossy paper to avoid reflections, which confuse the tracker. Ensure the print is perfectly flat.
- [ ] **No Repeating Patterns:** Avoid symmetry, grids, or repeating textures, as they create ambiguity for the tracker.
- [ ] **Good Lighting:** Use the app in a well-lit environment, but avoid direct, harsh glares on the printed target.
- [ ] **Fill the View:** For best results, the target should take up a significant portion of the camera view when you start tracking.

## Platform Notes

- **iOS (Safari):** Safari on iOS does not support the WebXR standard for AR. MindAR cleverly works around this by using standard web APIs to get camera access and run its own computer vision pipeline. This is why it works on iOS without needing a specific WebXR-compatible browser. For true world-anchored experiences that persist after the target is gone, a more advanced SLAM-based system (outside MindAR's scope) would be required.
- **Performance:** The scene is intentionally minimal to maintain a high FPS. When adding your own 3D models or effects, always test on mid-range Android phones to ensure a smooth experience. Avoid per-frame memory allocation (`new THREE.Vector3()` in `tick()`) to prevent garbage collection stutters.
- **ARCore Anchors:** While this project uses image tracking, it's helpful to understand concepts from world-tracking AR like ARCore. An "anchor" is a point in the real world that the device tracks. The further you are from an anchor, the more potential there is for drift. Similarly, with image targets, keeping the target in view provides a constant, stable "anchor" for your content.
