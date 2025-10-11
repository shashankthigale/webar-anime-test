/**
 * One-Euro Filter implementation for adaptive smoothing of position and rotation data.
 * Based on the One Euro Filter algorithm by Géry Casiez et al.
 *
 * This implementation provides double smoothing for WebAR tracking:
 * 1. MindAR's built-in One-Euro filter for marker pose
 * 2. Content-side One-Euro filter for placed media nodes
 *
 * Tuning methodology (Casiez):
 * 1. Set beta=0 and find mincutoff that removes jitter at slow motions
 * 2. Increase beta until fast motions feel responsive
 *
 * @author WebAR Engineer
 */

// === SMOOTHING START ===

class OneEuroFilter {
  constructor(mincutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
    this.mincutoff = mincutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    this.lastTime = null;

    // Initialize filters for position (x, y, z) and rotation (quaternion)
    this.xFilter = new LowPassFilter();
    this.yFilter = new LowPassFilter();
    this.zFilter = new LowPassFilter();

    // For rotation smoothing, we'll use angular velocity
    this.lastQuat = null;
    this.angularVelFilter = new LowPassFilter();

    // Pre-allocate vectors to avoid garbage collection
    this.tempVec = new THREE.Vector3();
    this.tempQuat = new THREE.Quaternion();
  }

  /**
   * Reset the filter state - call this when tracking is lost/found
   */
  reset() {
    this.lastTime = null;
    this.xFilter.reset();
    this.yFilter.reset();
    this.zFilter.reset();
    this.angularVelFilter.reset();
    this.lastQuat = null;
  }

  /**
   * Filter a 3D position vector
   * @param {THREE.Vector3} position - Input position
   * @param {number} timestamp - Current timestamp (performance.now())
   * @returns {THREE.Vector3} Filtered position
   */
  filterPosition(position, timestamp) {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return position.clone();
    }

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (deltaTime <= 0) {
      return position.clone();
    }

    // Compute velocity (rate of change)
    const rate = this.computeRate(position, deltaTime);

    // Compute adaptive cutoff frequency
    const cutoff = this.mincutoff + this.beta * rate;

    // Apply low-pass filter to each component
    const filteredX = this.xFilter.filter(position.x, cutoff, deltaTime);
    const filteredY = this.yFilter.filter(position.y, cutoff, deltaTime);
    const filteredZ = this.zFilter.filter(position.z, cutoff, deltaTime);

    return new THREE.Vector3(filteredX, filteredY, filteredZ);
  }

  /**
   * Filter a quaternion rotation with angular velocity handling
   * @param {THREE.Quaternion} quaternion - Input quaternion
   * @param {number} timestamp - Current timestamp
   * @returns {THREE.Quaternion} Filtered quaternion
   */
  filterQuaternion(quaternion, timestamp) {
    if (this.lastTime === null || this.lastQuat === null) {
      this.lastQuat = quaternion.clone();
      return quaternion.clone();
    }

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (deltaTime <= 0) {
      return quaternion.clone();
    }

    // Compute angular velocity (simplified approach)
    // For more accurate angular velocity, we'd need proper quaternion differentiation
    const rate = this.computeAngularRate(quaternion, deltaTime);

    // Adaptive cutoff for rotation
    const cutoff = this.mincutoff + this.beta * rate;

    // For rotation smoothing, we'll use SLERP with adaptive alpha
    const alpha = Math.min(1.0, cutoff * deltaTime);
    this.lastQuat.slerp(quaternion, alpha);

    return this.lastQuat.clone();
  }

  /**
   * Compute the rate of change for position filtering
   * @private
   */
  computeRate(position, deltaTime) {
    if (this.xFilter.lastValue === null) return 0;

    const dx = position.x - this.xFilter.lastValue;
    const dy = position.y - this.yFilter.lastValue;
    const dz = position.z - this.zFilter.lastValue;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance / deltaTime;
  }

  /**
   * Compute angular rate for rotation filtering
   * @private
   */
  computeAngularRate(quaternion, deltaTime) {
    if (this.lastQuat === null) return 0;

    // Simplified angular velocity computation
    // For production use, consider implementing proper quaternion differentiation
    const dot = this.lastQuat.dot(quaternion);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))); // Clamp to avoid NaN
    return angle / deltaTime;
  }

  /**
   * Compute adaptive alpha for lerp/slerp operations
   * This is used by the smooth-follow component
   * @param {number} linearSpeed - Linear velocity magnitude
   * @param {number} angularSpeed - Angular velocity magnitude
   * @param {number} alphaMin - Minimum alpha value
   * @param {number} alphaMax - Maximum alpha value
   * @returns {number} Adaptive alpha clamped between alphaMin and alphaMax
   */
  computeAdaptiveAlpha(linearSpeed, angularSpeed, alphaMin, alphaMax) {
    // Combine linear and angular speeds for overall motion intensity
    const combinedSpeed = Math.sqrt(linearSpeed * linearSpeed + angularSpeed * angularSpeed);

    // Adaptive alpha based on motion speed
    // Higher speeds should result in higher alpha (less smoothing, more responsiveness)
    const adaptiveAlpha = alphaMin + (alphaMax - alphaMin) * Math.min(1.0, combinedSpeed * 2.0);

    return Math.max(alphaMin, Math.min(alphaMax, adaptiveAlpha));
  }
}

/**
 * Simple first-order low-pass filter
 */
class LowPassFilter {
  constructor() {
    this.lastValue = null;
    this.hatxprev = null;
  }

  reset() {
    this.lastValue = null;
    this.hatxprev = null;
  }

  filter(value, cutoff, deltaTime) {
    if (this.lastValue === null) {
      this.lastValue = value;
      return value;
    }

    const RC = 1.0 / (cutoff * 2 * Math.PI);
    const alpha = RC / (RC + deltaTime);

    this.lastValue = alpha * value + (1 - alpha) * this.lastValue;
    return this.lastValue;
  }
}

/**
 * A-Frame component for smooth following of tracked markers with overscan
 * Provides double smoothing: MindAR's built-in filter + content-side One-Euro filter
 */
AFRAME.registerComponent('smooth-follow', {
  schema: {
    anchor: {type: 'selector', default: null},
    overscan: {type: 'number', default: 1.02},
    alphaMin: {type: 'number', default: 0.12},
    alphaMax: {type: 'number', default: 0.22}
  },

  init: function() {
    this.smoothGroup = new THREE.Group();
    this.filter = new OneEuroFilter();
    this.snapNextFrame = true;
    this.isVisible = false;

    // Pre-allocate objects to avoid garbage collection
    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.targetScale = new THREE.Vector3();
    this.tempMatrix = new THREE.Matrix4();
    this.tempPosition = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3();

    // Get reference to the video plane
    this.videoPlane = this.el.querySelector('#video-plane') || this.el;

    // Set up event listeners on the anchor
    if (this.data.anchor) {
      this.data.anchor.addEventListener('targetFound', this.onTargetFound.bind(this));
      this.data.anchor.addEventListener('targetLost', this.onTargetLost.bind(this));
    }

    // Add smoothGroup to scene (not to anchor to avoid double transformation)
    this.el.sceneEl.object3D.add(this.smoothGroup);

    // Move the video plane under smoothGroup
    this.smoothGroup.add(this.videoPlane.object3D);
  },

  onTargetFound: function() {
    this.isVisible = true;
    this.snapNextFrame = true;
    this.filter.reset();

    // Show the video plane
    if (this.videoPlane) {
      this.videoPlane.object3D.visible = true;
    }
  },

  onTargetLost: function() {
    this.isVisible = false;

    // Hide the video plane
    if (this.videoPlane) {
      this.videoPlane.object3D.visible = false;
    }
  },

  tick: function(time, deltaTime) {
    if (!this.data.anchor || !this.isVisible) {
      return;
    }

    // Get target transform from anchor
    this.data.anchor.object3D.updateMatrixWorld();
    this.tempMatrix.copy(this.data.anchor.object3D.matrixWorld);

    // Decompose to position, rotation, scale
    this.tempMatrix.decompose(this.targetPosition, this.targetQuaternion, this.targetScale);

    if (this.snapNextFrame) {
      // Snap to target position on first frame after target found
      this.smoothGroup.position.copy(this.targetPosition);
      this.smoothGroup.quaternion.copy(this.targetQuaternion);
      this.smoothGroup.scale.copy(this.targetScale);

      // Apply overscan to scale
      this.smoothGroup.scale.multiplyScalar(this.data.overscan);

      this.snapNextFrame = false;
    } else {
      // Compute adaptive alpha based on motion
      const linearSpeed = this.computeLinearSpeed(deltaTime);
      const angularSpeed = this.computeAngularSpeed(deltaTime);
      const adaptiveAlpha = this.filter.computeAdaptiveAlpha(
        linearSpeed,
        angularSpeed,
        this.data.alphaMin,
        this.data.alphaMax
      );

      // Apply smoothing with adaptive alpha
      this.smoothGroup.position.lerp(this.targetPosition, adaptiveAlpha);
      this.smoothGroup.quaternion.slerp(this.targetQuaternion, adaptiveAlpha);

      // Apply overscan to scale (only once, not smoothed)
      this.tempScale.copy(this.targetScale).multiplyScalar(this.data.overscan);
      this.smoothGroup.scale.lerp(this.tempScale, adaptiveAlpha);
    }
  },

  computeLinearSpeed: function(deltaTime) {
    if (deltaTime <= 0) return 0;

    const distance = this.targetPosition.distanceTo(this.smoothGroup.position);
    return distance / deltaTime;
  },

  computeAngularSpeed: function(deltaTime) {
    if (deltaTime <= 0) return 0;

    // Simplified angular speed computation
    const dot = this.smoothGroup.quaternion.dot(this.targetQuaternion);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    return angle / deltaTime;
  },

  remove: function() {
    // Clean up event listeners
    if (this.data.anchor) {
      this.data.anchor.removeEventListener('targetFound', this.onTargetFound.bind(this));
      this.data.anchor.removeEventListener('targetLost', this.onTargetLost.bind(this));
    }

    // Remove smoothGroup from scene
    if (this.smoothGroup && this.smoothGroup.parent) {
      this.smoothGroup.parent.remove(this.smoothGroup);
    }
  }
});

// === SMOOTHING END ===
