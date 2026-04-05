const canvas = document.getElementById("render-layer");

if (canvas) {
  initRenderLayer(canvas);
}

function initRenderLayer(target) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = target.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });

  if (!gl) return;

  const vertexSource = `
    attribute vec3 aPosition;
    attribute float aScale;

    uniform float uTime;
    uniform float uAspect;
    uniform vec2 uPointer;
    uniform float uScroll;
    uniform float uReduced;

    varying float vAlpha;
    varying float vDepth;

    mat3 rotationY(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
      );
    }

    mat3 rotationX(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        1.0, 0.0, 0.0,
        0.0, c, s,
        0.0, -s, c
      );
    }

    void main() {
      vec3 p = aPosition;
      float drift = uReduced > 0.5 ? 0.02 : 0.08;
      p *= rotationY(uTime * drift + uPointer.x * 0.34 + uScroll * 0.22);
      p *= rotationX(sin(uTime * 0.08) * 0.12 + uPointer.y * 0.18);
      p.xy += vec2(uPointer.x, -uPointer.y) * 0.05;
      p.z += 4.7 + sin(uTime * 0.05 + aScale) * 0.12;

      float depth = 1.0 / max(0.9, p.z);
      vec2 clip = vec2((p.x * depth) / max(uAspect, 0.001), p.y * depth) * 1.8;

      gl_Position = vec4(clip, 0.0, 1.0);
      gl_PointSize = (8.0 + aScale * 14.0) * depth * (uReduced > 0.5 ? 0.72 : 1.0);
      vAlpha = (0.16 + aScale * 0.24) * smoothstep(0.18, 1.25, depth);
      vDepth = depth;
    }
  `;

  const fragmentSource = `
    precision mediump float;

    varying float vAlpha;
    varying float vDepth;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float dist = length(uv);
      float core = smoothstep(0.5, 0.06, dist);
      float halo = smoothstep(0.75, 0.18, dist) * 0.24;
      float alpha = (core + halo) * vAlpha;

      vec3 nearColor = vec3(0.81, 0.85, 0.88);
      vec3 farColor = vec3(0.16, 0.19, 0.22);
      vec3 color = mix(farColor, nearColor, clamp(vDepth * 2.2, 0.0, 1.0));

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) return;

  const particleCount = prefersReducedMotion ? 480 : 1100;
  const { positions, scales } = createParticles(particleCount);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const scaleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, scales, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aScale = gl.getAttribLocation(program, "aScale");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uAspect = gl.getUniformLocation(program, "uAspect");
  const uPointer = gl.getUniformLocation(program, "uPointer");
  const uScroll = gl.getUniformLocation(program, "uScroll");
  const uReduced = gl.getUniformLocation(program, "uReduced");

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const scroll = { value: 0, target: 0 };
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

  function resize() {
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));
    target.width = width;
    target.height = height;
    target.style.width = `${window.innerWidth}px`;
    target.style.height = `${window.innerHeight}px`;
    gl.viewport(0, 0, width, height);
  }

  function updateScrollTarget() {
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    scroll.target = window.scrollY / maxScroll;
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.tx = event.clientX / window.innerWidth - 0.5;
      pointer.ty = event.clientY / window.innerHeight - 0.5;
    },
    { passive: true }
  );

  window.addEventListener("scroll", updateScrollTarget, { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  resize();
  updateScrollTarget();

  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
  gl.enableVertexAttribArray(aScale);
  gl.vertexAttribPointer(aScale, 1, gl.FLOAT, false, 0, 0);

  target.classList.add("render-layer--ready");

  function frame(now) {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    scroll.value += (scroll.target - scroll.value) * 0.08;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, now * 0.001);
    gl.uniform1f(uAspect, Math.max(target.width / target.height, 0.001));
    gl.uniform2f(uPointer, pointer.x * 2.0, pointer.y * 2.0);
    gl.uniform1f(uScroll, scroll.value);
    gl.uniform1f(uReduced, prefersReducedMotion ? 1.0 : 0.0);
    gl.drawArrays(gl.POINTS, 0, particleCount);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function createParticles(count) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const goldenAngle = Math.PI * (3.0 - Math.sqrt(5.0));

  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const radius = 0.8 + Math.random() * 1.45;
    const theta = i * goldenAngle;
    const y = 1.0 - 2.0 * t;
    const r = Math.sqrt(Math.max(0.0, 1.0 - y * y));
    const x = Math.cos(theta) * r * radius;
    const z = Math.sin(theta) * r * radius;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y * radius * 0.95;
    positions[i * 3 + 2] = z;
    scales[i] = 0.35 + Math.random() * 1.4;
  }

  return { positions, scales };
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
