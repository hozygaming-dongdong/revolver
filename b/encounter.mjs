import { actorAsset, street } from './streets.mjs';

const VS = `
attribute vec3 position;
attribute vec2 texCoord;
attribute vec3 tint;
uniform vec3 eye;
uniform vec2 optics;
uniform float yaw;
uniform float pitch;
varying vec2 uv;
varying vec3 color;
varying vec3 world;
varying float depth;
void main() {
  vec3 d = position - eye;
  float z = sin(yaw)*d.x + cos(yaw)*d.z;
  float x = cos(yaw)*d.x - sin(yaw)*d.z;
  float y = d.y + pitch*z;
  gl_Position = vec4(optics.x*x, optics.y*y, 1.0025*z-.161, z);
  uv = texCoord;
  color = tint;
  world = position;
  depth = z;
}`;
const FS = `
precision mediump float;
uniform sampler2D surface;
uniform vec3 fog;
uniform vec3 lamp;
uniform float actor;
uniform float flash;
varying vec2 uv;
varying vec3 color;
varying vec3 world;
varying float depth;
void main() {
  if (actor > 1.5) {
    float edge = length((uv-.5)*2.);
    gl_FragColor = vec4(.025,.03,.035,.50*(1.-smoothstep(.18,1.,edge)));
    return;
  }
  vec4 texel = texture2D(surface,uv);
  if (texel.a < .08) discard;
  float row = abs(fract((world.z-2.) / 8.8 + .5) -.5);
  float pool = exp(-7.*row) * (1.-smoothstep(2.,10.,abs(world.x)));
  float nearby = (1.-smoothstep(5.,20.,depth))*exp(-.10*world.x*world.x);
  vec3 rgb = pow(texel.rgb,vec3(.74))*color*(.72+pool*.24+nearby*.19);
  rgb += lamp * pool * (actor > .5 ? .053 : .13) + vec3(.55,.28,.095)*flash*nearby;
  float wet = exp(-2.1*abs(abs(world.x)-2.02)) * pool * (1.-smoothstep(.012,.16,world.y));
  rgb += lamp * wet * (.22+texel.r*.30) * (1.-actor);
  gl_FragColor = vec4(mix(rgb, fog, smoothstep(9.,45.,depth)), texel.a);
}`;

const ease = t => t*t*(3-2*t);
const bounded = t => Math.max(0, Math.min(1, t));

export function encounter() {
  const canvas = document.createElement('canvas');
  canvas.className = 'encounter-view';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) return null;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const attributes = ['position', 'texCoord', 'tint'].map(name => gl.getAttribLocation(program, name));
  attributes.forEach(index => gl.enableVertexAttribArray(index));
  const uniforms = Object.fromEntries(['eye','optics','yaw','pitch','fog','lamp','actor','flash'].map(name => [name, gl.getUniformLocation(program, name)]));
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const smoother = gl.getExtension('EXT_texture_filter_anisotropic');
  const textures = new Map();
  function texture(key, file) {
    if (textures.has(key)) return textures.get(key);
    const object = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, object);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array(file ? [68,74,75,255] : [255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const item = { object, aspect: .72 };
    if (file) {
      const image = new Image();
      item.ready = new Promise(resolve => {
        image.onload = () => {
          gl.bindTexture(gl.TEXTURE_2D, object);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          const w = image.naturalWidth, h = image.naturalHeight;
          if ((key === 'ground' || key === 'metal') && (w & (w-1)) === 0 && (h & (h-1)) === 0) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            if (smoother) gl.texParameterf(gl.TEXTURE_2D, smoother.TEXTURE_MAX_ANISOTROPY_EXT,
              Math.min(4, gl.getParameter(smoother.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
          }
          item.aspect = image.naturalWidth / image.naturalHeight;
          resolve(true);
        };
        image.onerror = () => resolve(false);
      });
      image.src = `./assets/${file}.png`;
    } else item.ready = Promise.resolve(true);
    textures.set(key, item);
    return item;
  }
  texture('solid');
  texture('ground', 'wet-road');
  texture('metal', 'metal-panel');
  const preload = stage => {
    const asset = actorAsset(stage);
    return Promise.all([textures.get('ground').ready, textures.get('metal').ready, texture(asset, asset).ready]).then(results => results.every(Boolean));
  };

  const buffers = Object.fromEntries(['ground','metal','solid','actor'].map(key => [key, gl.createBuffer()]));
  const spriteData = new Float32Array(6*8);
  let view, key, frame, last = -Infinity, start = 0, duration = 0, finish, step, beat = -1, reduced = false, reaction = '', reactedAt = 0;
  let advanceAt = -Infinity, advanceDuration = 1, focusAt = null;
  function draw(key, amount, tex) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[key]);
    gl.vertexAttribPointer(attributes[0],3,gl.FLOAT,false,32,0);
    gl.vertexAttribPointer(attributes[1],2,gl.FLOAT,false,32,12);
    gl.vertexAttribPointer(attributes[2],3,gl.FLOAT,false,32,20);
    gl.bindTexture(gl.TEXTURE_2D, tex.object);
    gl.drawArrays(gl.TRIANGLES, 0, amount);
  }
  function sprite(tex, x, y, z, h, lean) {
    const half = tex.aspect*h*.5;
    const coords = [x-half,y,0,0, x+half,y,1,0, x+half+lean,y+h,1,1, x-half,y,0,0, x+half+lean,y+h,1,1, x-half+lean,y+h,0,1];
    for (let i=0;i<6;i++) spriteData.set([coords[4*i],coords[4*i+1],z,coords[4*i+2],coords[4*i+3],1.19,1.15,1.10],i*8);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.actor);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, spriteData);
    draw('actor', 6, tex);
  }
  function contactShadow(x, z, height) {
    const dx = height*.31, dz = height*.34;
    const points = [x-dx,z-dz,0,0, x+dx,z-dz,1,0, x+dx,z+dz,1,1, x-dx,z-dz,0,0, x+dx,z+dz,1,1, x-dx,z+dz,0,1];
    for (let i=0;i<6;i++) spriteData.set([points[4*i],.032,points[4*i+1],points[4*i+2],points[4*i+3],1,1,1],i*8);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.actor);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,spriteData);
    gl.uniform1f(uniforms.actor, 2);
    gl.depthMask(false);
    draw('actor', 6, textures.get('solid'));
    gl.depthMask(true);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.actor);
  gl.bufferData(gl.ARRAY_BUFFER, spriteData.byteLength, gl.DYNAMIC_DRAW);

  function paint(now) {
    frame = requestAnimationFrame(paint);
    if (now-last < 27 || !canvas.isConnected) return;
    last = now;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio, 1.65);
    const w = Math.round(width*ratio), h = Math.round(height*ratio);
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h); }
    const t = duration ? bounded((now-start)/duration) : 0;
    const trail = ease(t), stride = t*3.5;
    const amplitude = !reduced && t > 0 && t < 1 ? Math.sin(Math.PI*t)*.061 : 0;
    const rx = (now-reactedAt)/1000;
    const impact = reaction === 'hit' ? Math.max(0,1-rx*6) : 0;
    const strike = reaction === 'empty' ? ease(bounded(rx/.53)) : 0;
    const collapse = reaction === 'hit' ? ease(bounded(rx/.58)) : 0;
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(uniforms.fog, view.fog);
    gl.uniform3fv(uniforms.lamp, view.lamp);
    gl.uniform3f(uniforms.eye, .27-.15*trail+Math.sin(stride*Math.PI)*amplitude, 1.54+Math.sin(stride*2*Math.PI)*amplitude,
      view.distance*trail + Math.sin(stride*2*Math.PI)*amplitude*2.1 - .17*impact);
    gl.uniform2f(uniforms.optics, 1.62*h/w, 1.62);
    gl.uniform1f(uniforms.yaw, (1-trail)*(view.alley ? -.10 : .022)+amplitude*.37);
    gl.uniform1f(uniforms.pitch,.025+amplitude*.37+impact*.03);
    gl.uniform1f(uniforms.flash, impact);
    gl.uniform1f(uniforms.actor, 0);
    for (const material of ['ground','metal','solid']) draw(material, view.batches[material].length/8, textures.get(material));
    const tex = textures.get(view.actor);
    const stepFromCover = view.alley ? -1.48 + 1.71*ease(bounded((t-.33)/.66)) : .09;
    const actorTime = focusAt ?? now;
    const advance = bounded((actorTime-advanceAt)/advanceDuration);
    const footfall = reduced ? 0 : Math.sin(Math.PI*advance);
    const idle = reduced ? 0 : Math.sin(actorTime/440)*.036;
    const actorX = stepFromCover + idle + footfall*.10 + collapse*.55;
    const actorZ = Math.max(view.distance+1.05, view.actorZ-ease(advance)*.74-strike*3.3);
    contactShadow(actorX, actorZ, view.height);
    gl.uniform1f(uniforms.actor, 1);
    sprite(tex, actorX, .025 + footfall*.07, actorZ, view.height*(1-.73*collapse+(reduced ? 0 : .012*Math.sin(actorTime/340))), collapse*.72 - idle - footfall*.13);
    if (t > 0 && t < 1) {
      canvas.parentElement.style.setProperty('--footfall', `${(amplitude*Math.sin(stride*Math.PI)*67).toFixed(2)}px`);
      const index = Math.floor(stride);
      if (index > beat) { beat = index; step?.(index); }
    }
    if (finish && t >= 1) {
      canvas.parentElement.style.removeProperty('--footfall');
      finish(); finish = undefined; step = undefined;
    }
  }
  return {
    preload,
    mount(parent, stage, route) {
      const next = `${stage}-${route}`;
      if (next !== key) {
        key = next; view = street(stage, route);
        duration = 0; reaction = ''; beat = -1; advanceAt = -Infinity; focusAt = null;
        for (const [name, geometry] of Object.entries(view.batches)) {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry), gl.STATIC_DRAW);
        }
      }
      parent.prepend(canvas);
      if (!frame) frame = requestAnimationFrame(paint);
    },
    walk(short, footstep) {
      reduced = short; step = footstep; beat = -1;
      start = performance.now(); duration = reduced ? 630 : 1850;
      return new Promise(resolve => { finish = resolve; });
    },
    advance(ms) { advanceAt = performance.now(); advanceDuration = ms; },
    focus() { focusAt = performance.now(); },
    react(hit) { focusAt = null; reaction = hit ? 'hit' : 'empty'; reactedAt = performance.now(); },
    hide() {
      cancelAnimationFrame(frame); frame = null; key = null;
      canvas.remove();
      finish?.(); finish = undefined;
    },
  };
}
