export const CRT_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const CRT_FRAGMENT = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uFlicker;
  uniform bool uUseVideo;
  uniform float uBrightness;
  varying vec2 vUv;

  vec2 curveUV(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
  }

  float noise(vec2 uv, float t) {
    return fract(sin(dot(uv * t, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 curvedUV = curveUV(vUv);

    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec4 color;

    if (uUseVideo) {
      float aberration = 0.003;
      float r = texture2D(uTexture, curvedUV + vec2(aberration, 0.0)).r;
      float g = texture2D(uTexture, curvedUV).g;
      float b = texture2D(uTexture, curvedUV - vec2(aberration, 0.0)).b;
      float grey = r * 0.299 + g * 0.587 + b * 0.114;
      color = vec4(grey * 0.85, grey * 0.95, grey * 0.75, 1.0);
    } else {
      float n = noise(curvedUV, uTime * 10.0);
      float n2 = noise(curvedUV * 1.5, uTime * 7.3 + 1.0);
      float staticNoise = mix(n, n2, 0.5);
      float roll = sin(curvedUV.y * 3.0 + uTime * 2.0) * 0.01;
      float noiseRoll = noise(vec2(curvedUV.x + roll, curvedUV.y), uTime * 8.0);
      color = vec4(vec3(mix(staticNoise, noiseRoll, 0.3)), 1.0);
    }

    float bScale = 0.2 + uBrightness * 1.4;
    color.rgb *= bScale;

    float scanline = sin(curvedUV.y * 800.0) * 0.04;
    color.rgb -= scanline;
    color.rgb *= uFlicker;

    vec2 vigUV = curvedUV * (1.0 - curvedUV.yx);
    float vignette = pow(vigUV.x * vigUV.y * 15.0, 0.3);
    color.rgb *= vignette;

    gl_FragColor = color;
  }
`