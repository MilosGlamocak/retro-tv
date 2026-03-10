export const OVERLAY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const OVERLAY_FRAGMENT = `
  uniform float uVolume;
  uniform float uBrightness;
  uniform float uShowVolume;
  uniform float uShowBrightness;
  varying vec2 vUv;

  void drawBar(vec2 uv, float value, vec3 barColor, float show, inout vec4 color) {
    float barX0 = 0.1;
    float barX1 = 0.6;
    float barY0 = 0.17;
    float barY1 = 0.22;
    float bgPad = 0.015;

    if (uv.x > barX0 - bgPad && uv.x < barX1 + bgPad &&
        uv.y > barY0 - bgPad && uv.y < barY1 + bgPad) {
      color.rgb = mix(color.rgb, vec3(0.0), show * 0.85);
      color.a = max(color.a, show * 0.85);
    }

    if (uv.x > barX0 && uv.x < barX1 &&
        uv.y > barY0 && uv.y < barY1) {
      float numSegs = 20.0;
      float segW = (barX1 - barX0) / numSegs;
      float segIndex = floor((uv.x - barX0) / segW);
      float segLocalX = mod(uv.x - barX0, segW) / segW;
      float activeSeg = floor(value * numSegs);
      if (segLocalX < 0.82) {
        if (segIndex < activeSeg) {
          float scan = step(0.5, fract(uv.y * 50.0));
          color.rgb = mix(color.rgb, barColor * (0.65 + scan * 0.35), show);
          color.a = max(color.a, show);
        } else {
          color.rgb = mix(color.rgb, vec3(0.07), show * 0.9);
          color.a = max(color.a, show * 0.9);
        }
      }
    }

    float bt = 0.003;
    bool onBorderX = (uv.x > barX0-bt && uv.x < barX0) || (uv.x > barX1 && uv.x < barX1+bt);
    bool onBorderY = (uv.y > barY0-bt && uv.y < barY0) || (uv.y > barY1 && uv.y < barY1+bt);
    bool inRangeX  = uv.x > barX0-bt && uv.x < barX1+bt;
    bool inRangeY  = uv.y > barY0-bt && uv.y < barY1+bt;
    if ((onBorderX && inRangeY) || (onBorderY && inRangeX)) {
      color.rgb = mix(color.rgb, barColor, show * 0.8);
      color.a = max(color.a, show * 0.8);
    }
  }

  void drawLetters(vec2 p, float ox0, float oy, float ps, int which, float show, inout vec4 color) {
    vec3 labelColor = (which == 0) ? vec3(0.85, 0.95, 0.75) : vec3(0.95, 0.90, 0.65);
    float lit = 0.0;
    float ox = ox0;

    if (which == 0) {
      // V
      if (p.x>ox        && p.x<ox+ps     && p.y>oy+3.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+2.0*ps && p.y>oy+ps     && p.y<oy+3.0*ps) lit=1.0;
      if (p.x>ox+3.0*ps && p.x<ox+4.0*ps && p.y>oy+ps     && p.y<oy+3.0*ps) lit=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy        && p.y<oy+ps)     lit=1.0;
      // O
      ox += 6.0*ps;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     lit=1.0;
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy        && p.y<oy+5.0*ps) lit=1.0;
      // L
      ox += 6.0*ps;
      if (p.x>ox && p.x<ox+ps     && p.y>oy && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox && p.x<ox+5.0*ps && p.y>oy && p.y<oy+ps)     lit=1.0;
    } else {
      // B
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+2.0*ps && p.y<oy+3.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+4.0*ps) lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+ps     && p.y<oy+2.0*ps) lit=1.0;
      // R
      ox += 6.0*ps;
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+2.0*ps && p.y<oy+3.0*ps) lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+4.0*ps) lit=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy+ps     && p.y<oy+2.0*ps) lit=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy        && p.y<oy+ps)     lit=1.0;
      // I
      ox += 6.0*ps;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) lit=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     lit=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy        && p.y<oy+5.0*ps) lit=1.0;
    }

    float l = clamp(lit, 0.0, 1.0) * show;
    color.rgb = mix(color.rgb, labelColor, l);
    color.a = max(color.a, l);
  }

  void main() {
    float showV = uShowVolume;
    float showB = uShowBrightness;
    float show  = max(showV, showB);

    // Ništa aktivno — potpuno transparentno, ne renderuj ništa
    if (show < 0.01) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

    float labelX = 0.1;
    float labelY = 0.18;
    float ps = 0.007;
    vec2 p = vec2(vUv.x, 1.0 - vUv.y);

    if (showV > 0.01) {
      drawLetters(p, labelX, labelY, ps, 0, showV, color);
      drawBar(vUv, uVolume, vec3(0.85, 0.95, 0.75), showV, color);
    }

    if (showB > 0.01) {
      drawLetters(p, labelX, labelY, ps, 1, showB, color);
      drawBar(vUv, uBrightness, vec3(0.95, 0.90, 0.65), showB, color);
    }

    gl_FragColor = color;
  }
`