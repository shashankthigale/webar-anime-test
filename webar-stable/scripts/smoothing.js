// A compact One-Euro filter for smoothing signals.
// Reference: http://www.lifl.fr/~casiez/1euro/
// Adapted for position (3D) and rotation (quaternion) smoothing.

class OneEuroFilter {
  constructor(minCutoff, beta) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.x = this.createFilter();
    this.y = this.createFilter();
    this.z = this.createFilter();
    this.quat = this.createFilterQuat();
  }

  createFilter() {
    return {
      x: 0,
      initialized: false,
    };
  }

  createFilterQuat() {
    return {
      x: new THREE.Quaternion(),
      dx: new THREE.Quaternion(),
      initialized: false,
    };
  }
  
  // Computes the smoothing factor alpha
  smoothingFactor(te, cutoff) {
    const r = 2 * Math.PI * cutoff * te;
    return r / (r + 1);
  }
  
  // Calculates the adaptive cutoff frequency
  alpha(rate) {
    return this.smoothingFactor(1.0 / rate, this.minCutoff + this.beta * Math.abs(rate));
  }

  filter(f, value, te) {
    if (!f.initialized) {
      f.x = value;
      f.initialized = true;
      return value;
    }

    const dvalue = (value - f.x) / te;
    const cutoff = this.minCutoff + this.beta * Math.abs(dvalue);
    const alpha = this.smoothingFactor(te, cutoff);
    
    f.x = (1.0 - alpha) * f.x + alpha * value;
    
    return f.x;
  }
  
  filterVec(value, te) {
    const x = this.filter(this.x, value.x, te);
    const y = this.filter(this.y, value.y, te);
    const z = this.filter(this.z, value.z, te);
    return new THREE.Vector3(x, y, z);
  }

  filterQuat(value, te) {
    if (!this.quat.initialized) {
      this.quat.x.copy(value);
      this.quat.dx.set(0, 0, 0, 1);
      this.quat.initialized = true;
      return value;
    }

    // This is a simplified approach for quaternions. A more robust implementation
    // might use logarithmic/exponential maps, but slerp with adaptive alpha works well.
    const dvalue = new THREE.Quaternion().copy(this.quat.x).inverse().multiply(value);
    const angle = 2 * Math.acos(Math.abs(dvalue.w));
    const rate = angle / te;
    
    const cutoff = this.minCutoff + this.beta * rate;
    const alpha = this.smoothingFactor(te, cutoff);

    this.quat.x.slerp(value, alpha);
    return this.quat.x;
  }
}


// === SMOOTHING START ===
AFRAME.registerComponent('smooth-follow', {
  schema: {
    anchor: { type: 'selector' },
    overscan: { type: 'number', default: 1.0 },
    alphaMin: { type: 'number', default: 0.1 },
    alphaMax: { type: 'number', default: 0.2 },
  },

  init: function () {
    this.targetPos = new THREE.Vector3();
    this.targetQuat = new THREE.Quaternion();
    this.targetScale = new THREE.Vector3();
    
    this.smoothGroup = new THREE.Group();
    this.el.sceneEl.object3D.add(this.smoothGroup);
    this.smoothGroup.add(this.el.object3D);
    
    this.snapNextFrame = true;
    this.smootherEnabled = true;

    // The One-Euro filter for camera pose stabilization
    this.filter = new OneEuroFilter(0.02, 60);

    const anchorEl = this.data.anchor;
    anchorEl.addEventListener('targetFound', () => {
      this.snapNextFrame = true;
      this.el.setAttribute('visible', true);
    });

    anchorEl.addEventListener('targetLost', () => {
      this.el.setAttribute('visible', false);
    });

    // Listen for tuning panel updates
    document.addEventListener('tuning-updated', (e) => {
      const { detail } = e;
      this.data.overscan = detail.overscan;
      this.data.alphaMin = detail.alphaMin;
      this.data.alphaMax = detail.alphaMax;
      this.smootherEnabled = detail.smootherEnabled;

      if (this.filter) {
        this.filter.minCutoff = detail.filterMinCF;
        this.filter.beta = detail.filterBeta;
      }
      this.updateOverscan();
    });

    this.updateOverscan();
  },
  
  updateOverscan: function() {
    this.el.object3D.scale.set(this.data.overscan, this.data.overscan, this.data.overscan);
  },

  tick: function (time, timeDelta) {
    if (!this.data.anchor.object3D.visible) {
      return;
    }

    this.data.anchor.object3D.matrixWorld.decompose(this.targetPos, this.targetQuat, this.targetScale);

    if (this.snapNextFrame) {
      this.smoothGroup.position.copy(this.targetPos);
      this.smoothGroup.quaternion.copy(this.targetQuat);
      this.snapNextFrame = false;
      return;
    }

    const te = timeDelta / 1000;
    
    if (this.smootherEnabled) {
      // === One-Euro Filter Smoothing ===
      const smoothedPos = this.filter.filterVec(this.targetPos, te);
      const smoothedQuat = this.filter.filterQuat(this.targetQuat, te);
      
      this.smoothGroup.position.copy(smoothedPos);
      this.smoothGroup.quaternion.copy(smoothedQuat);

    } else {
      // No smoothing, just snap to the target.
      this.smoothGroup.position.copy(this.targetPos);
      this.smoothGroup.quaternion.copy(this.targetQuat);
    }
  }
});
// === SMOOTHING END ===
