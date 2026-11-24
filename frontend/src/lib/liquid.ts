/**
 * The hero's sculpture, live: a soft form of satin silver, drawn by a fragment shader as a sphere
 * pushed out of round by slow waves, so its outline swells and settles while it turns, and the
 * studio's lights slide over its surface. No library: one triangle over the canvas and a raymarch.
 */

const VERTEX = `
attribute vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }
`

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 size;
uniform float time;

mat3 turn;
float T;

mat3 aboutY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 aboutX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

float smax(float a, float b, float k) {
  float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

// a sphere a little wider than tall, its surface lifted and pressed by three slow waves; where the
// waves line up, a lobe is softly held inside a still ellipsoid, so it never reaches the canvas's
// edge (checked over minutes of motion: at most 93% of the way)
float form(vec3 p) {
  vec3 q = turn * p;
  float d = length(q * vec3(0.92, 1.04, 0.96)) - 1.0;
  float w1 = sin(q.x * 2.0 + T * 0.61) * sin(q.y * 1.8 - T * 0.47 + 0.8) * sin(q.z * 2.2 + T * 0.39 + 1.9);
  float w2 = sin(q.x * 3.4 - T * 0.83 + 1.3) * sin(q.y * 3.0 + T * 0.57) * sin(q.z * 2.8 - T * 0.71 + 2.4);
  float w3 = sin(q.y * 2.6 + q.x * 1.3 + T * 0.52);
  d += 0.26 * w1 + 0.09 * w2 + 0.04 * w3;
  float bound = (length(p / vec3(1.25, 1.06, 1.2)) - 1.0) * 1.06;
  return smax(d, bound, 0.25) * 0.5;
}

vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.0015;
  return normalize(k.xyy * form(p + k.xyy * h) + k.yyx * form(p + k.yyx * h) + k.yxy * form(p + k.yxy * h) + k.xxx * form(p + k.xxx * h));
}

// the studio the satin reflects: a dark floor, a pale ceiling, a big softbox up on the left, a
// strip light on the right, and a thin ring of light whose reflection runs over the lobes as
// curved lines, after the reference's
float studio(vec3 d) {
  float ring = 1.0 - smoothstep(0.0, 0.04, abs(d.y - 0.42));
  float g = mix(0.26, 0.82, smoothstep(-0.7, 0.9, d.y));
  g += 0.55 * smoothstep(0.25, 0.95, dot(d, normalize(vec3(-0.55, 0.65, 0.55))));
  g += 0.3 * smoothstep(0.55, 0.98, dot(d, normalize(vec3(0.85, 0.15, 0.3))));
  g -= 0.12 * exp(-d.y * d.y * 20.0);
  g += 0.38 * ring;
  return g;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * size) / size.y * 2.0;
  T = time;
  turn = aboutX(0.28 + 0.18 * sin(T * 0.21)) * aboutY(T * 0.17);
  vec3 eye = vec3(0.0, 0.0, 4.2);
  vec3 ray = normalize(vec3(uv * 0.28, -1.0));

  // only march inside the sphere that bounds the form
  float b = dot(eye, ray);
  float h = b * b - dot(eye, eye) + 2.56;
  if (h < 0.0) { gl_FragColor = vec4(0.0); return; }
  float t = -b - sqrt(h);
  float far = -b + sqrt(h);
  float nearest = 1e9;
  float nearestT = t;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    float d = form(eye + ray * t);
    if (d < nearest) { nearest = d; nearestT = t; }
    if (d < 0.0008) { hit = true; break; }
    t += d;
    if (t > far) break;
  }
  // a soft edge one pixel wide, from how close the ray came
  float footprint = nearestT * 0.56 / size.y;
  float alpha = hit ? 1.0 : clamp(1.0 - nearest / 0.5 / footprint, 0.0, 1.0);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  vec3 p = eye + ray * (hit ? t : nearestT);
  vec3 n = normalAt(p);
  vec3 r = reflect(ray, n);
  vec3 key = normalize(vec3(-0.5, 0.7, 0.6));
  float wrap = clamp(dot(n, key) * 0.5 + 0.5, 0.0, 1.0);
  float hollow = mix(0.6, 1.0, clamp(form(p + n * 0.2) / 0.1, 0.0, 1.0));
  float rim = pow(1.0 - clamp(dot(n, -ray), 0.0, 1.0), 3.0);
  float shine = pow(clamp(dot(r, key), 0.0, 1.0), 24.0);

  float g = 0.6 * (0.3 + 0.7 * wrap) * 0.45 + studio(r) * 0.6;
  g += rim * 0.12;
  g *= hollow;
  g *= mix(0.78, 1.0, smoothstep(-1.0, 0.4, n.y));
  g += shine * 0.22;
  vec3 color = vec3(g) * vec3(0.995, 1.0, 1.01);
  gl_FragColor = vec4(color * alpha, alpha);
}
`

export type Liquid = {
  /** While verdicts load the form moves faster, easing into and out of it. */
  setBusy(busy: boolean): void
  stop(): void
}

/**
 * Starts drawing the form on `canvas`: every frame while it is on screen, or one still frame for
 * reduced motion. Null where WebGL can't draw it; `onLost` if the context is lost later.
 */
export function startLiquid(canvas: HTMLCanvasElement, onLost: () => void): Liquid | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (!gl) return null
  const program = link(gl)
  if (!program) return null
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const corner = gl.getAttribLocation(program, 'corner')
  gl.enableVertexAttribArray(corner)
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
  const sizeAt = gl.getUniformLocation(program, 'size')
  const timeAt = gl.getUniformLocation(program, 'time')

  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  let time = 4 // a moment where the form sits well, for the still frame
  let speed = 1
  let target = 1
  let last = 0
  let raf = 0
  let onScreen = true
  let stopped = false
  // a slow phone draws it at fewer pixels: each run of 30 frames that came slower than 30 a
  // second takes a quarter off the canvas's resolution, down to half
  let quality = 1
  let frames = 0
  let spent = 0

  const draw = () => {
    if (!canvas.width || !canvas.height) return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(sizeAt, canvas.width, canvas.height)
    gl.uniform1f(timeAt, time)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  const frame = (now: number) => {
    raf = 0
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
    last = now
    speed += (target - speed) * Math.min(1, dt * 2.5)
    time += dt * speed * 1.3
    if (dt) {
      frames += 1
      spent += dt
      if (frames === 30) {
        if (spent / frames > 1 / 30 && quality > 0.5) {
          quality -= 0.25
          resize()
        }
        frames = 0
        spent = 0
      }
    }
    draw()
    play()
  }
  const play = () => {
    if (!raf && !stopped && onScreen && !reduce.matches) raf = requestAnimationFrame(frame)
  }
  const pause = () => {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }

  // the canvas drawn at up to one and a half times its CSS size: the satin needs no more
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * quality
    const width = Math.round(canvas.clientWidth * ratio)
    const height = Math.round(canvas.clientHeight * ratio)
    if (width === canvas.width && height === canvas.height) return
    canvas.width = width
    canvas.height = height
    draw()
  }
  const sized = new ResizeObserver(resize)
  sized.observe(canvas)
  const seen = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    if (onScreen) play()
    else pause()
  })
  seen.observe(canvas)
  const motion = () => {
    if (reduce.matches) {
      pause()
      draw()
    } else play()
  }
  reduce.addEventListener('change', motion)
  const lost = (e: Event) => {
    e.preventDefault()
    stop()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', lost)

  function stop() {
    stopped = true
    pause()
    sized.disconnect()
    seen.disconnect()
    reduce.removeEventListener('change', motion)
    canvas.removeEventListener('webglcontextlost', lost)
  }

  resize()
  draw()
  play()
  return {
    setBusy(busy) {
      target = busy ? 2.6 : 1
    },
    stop,
  }
}

function link(gl: WebGLRenderingContext) {
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('hero form:', gl.getShaderInfoLog(shader))
      return null
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}
