import * as THREE from 'three';

/* v0iid LEDGER — phosphor × cyan × violet experimental field */

const VOID = 0x020406;

const PALETTE = [
  new THREE.Color(0x60ffa0),
  new THREE.Color(0x48ffec),
  new THREE.Color(0xb8a8f8),
  new THREE.Color(0x30c068),
  new THREE.Color(0xffd050),
];

function paletteAt(t: number): THREE.Color {
  const n = PALETTE.length;
  const x = ((t % 1) + 1) % 1;
  const i = Math.floor(x * n) % n;
  const f = (x * n) % 1;
  return PALETTE[i].clone().lerp(PALETTE[(i + 1) % n], f);
}

type IceColumn = { line: THREE.Line; phase: number; speed: number };
type Aurora = { line: THREE.Line; phases: number[] };
type WhisperRing = { mesh: THREE.Line; age: number; max: number };
type ConstructCube = { mesh: THREE.LineSegments; speed: THREE.Vector3; phase: number };
type DataArc = { line: THREE.Line; phase: number; t0: number; t1: number };
type IceBurst = { lines: THREE.LineSegments; age: number; max: number };
type AuroraPulse = { aurIdx: number; t: number; mesh: THREE.Mesh };

export class VoidDimension {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();

  private scroll = 0;
  private targetScroll = 0;
  private scrollVel = 0;
  private smoothScrollVel = 0;
  private mouse = new THREE.Vector2(0, 0);
  private smoothMouse = new THREE.Vector2(0, 0);
  private time = 0;

  private dust!: THREE.Points;
  private dustPos!: Float32Array;
  private dustBase!: Float32Array;
  private dustCol!: Float32Array;
  private wireShell!: THREE.Mesh;
  private wireGhost!: THREE.Mesh;
  private wireChroma!: THREE.Mesh;
  private orbitGroup!: THREE.Group;
  private orbitDots: THREE.Mesh[] = [];
  private orbitPaths: THREE.Line[] = [];
  private nodes!: THREE.Points;
  private nodeLines!: THREE.LineSegments;
  private nodePos!: Float32Array;
  private grid!: THREE.Mesh;
  private horizonRing!: THREE.Mesh;
  private scanBeam!: THREE.Mesh;
  private glyphRain!: THREE.Points;
  private glyphPos!: Float32Array;
  private iceColumns: IceColumn[] = [];
  private auroras: Aurora[] = [];
  private citySilhouette!: THREE.LineSegments;
  private helixA!: THREE.Line;
  private helixB!: THREE.Line;
  private helixVertsA!: Float32Array;
  private helixVertsB!: Float32Array;
  private packetPulses: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; speed: number }[] = [];
  private trailDots: THREE.Mesh[] = [];
  private ledgerKnot!: THREE.LineSegments;
  private knotBase!: Float32Array;
  private knotEcho!: THREE.LineSegments;
  private echoRot = 0;
  private echoRotLag = 0;
  private whisperRings: WhisperRing[] = [];
  private ringPool: THREE.Line[] = [];
  private ringTimer = 0;
  private constructs: ConstructCube[] = [];
  private dataArcs: DataArc[] = [];
  private iceBursts: IceBurst[] = [];
  private burstPool: THREE.LineSegments[] = [];
  private burstTimer = 0;
  private pulsePool: THREE.Mesh[] = [];
  private auroraPulses: AuroraPulse[] = [];
  private pulseTimer = 0;
  private smoothFocus = 0;

  private sectionEls: HTMLElement[] = [];
  private progressBar: HTMLElement | null = null;
  private coordDisplay: HTMLElement | null = null;
  private ledgerTicker: HTMLElement | null = null;
  private reducedMotion = false;
  private bootDismissed = false;
  private bootTimers: ReturnType<typeof setTimeout>[] = [];
  private bootInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  private sceneReady = false;
  private visible = !document.hidden;
  private events = new AbortController();

  constructor(canvas: HTMLCanvasElement) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.initDom();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1 : 1.5)
      );
      this.renderer.setClearColor(VOID, 1);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.32;
      this.initScene();
      this.sceneReady = true;
      this.bindEvents();
      this.onResize();
      this.animate();
    } catch (err) {
      console.error('[void] scene init failed — boot UI still runs', err);
      this.bindEvents();
      this.startUiLoop();
    }
  }

  private startUiLoop() {
    const tick = () => {
      if (this.destroyed) return;
      requestAnimationFrame(tick);
      this.scroll += (this.targetScroll - this.scroll) * 0.04;
      this.time += 0.016;
      this.updateUI(this.scroll);
    };
    tick();
  }

  private initDom() {
    this.sectionEls = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
    this.progressBar = document.getElementById('scroll-progress');
    this.coordDisplay = document.getElementById('coord-readout');
    this.ledgerTicker = document.getElementById('ledger-ticker');

    this.syncScrollState();
    this.updateUI(this.scroll);

    if (!this.reducedMotion) this.runBootSequence();
    else this.dismissBoot();
  }

  private syncScrollState() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.targetScroll = max > 0 ? window.scrollY / max : 0;
    this.scroll = this.targetScroll;
    document.documentElement.style.setProperty('--scroll', String(this.targetScroll));
    if (this.progressBar) this.progressBar.style.transform = `scaleX(${this.targetScroll})`;
  }

  private initScene() {
    this.scene.fog = new THREE.FogExp2(VOID, 0.006);
    this.camera.position.set(0, 4, 72);

    this.scene.add(new THREE.AmbientLight(0x204838, 0.62));
    const key = new THREE.PointLight(0x60ffa0, 0.95, 100);
    key.position.set(12, 20, 15);
    this.scene.add(key);
    const fill = new THREE.PointLight(0x48ffec, 0.52, 80);
    fill.position.set(-10, 5, 8);
    this.scene.add(fill);

    this.createDust();
    this.createLedgerKnot();
    this.createKnotEcho();
    this.createWireShell();
    this.createConstructs();
    this.createDataArcs();
    this.createRingPool();
    this.createBurstPool();
    this.createPulsePool();
    this.createHelix();
    this.createAuroras();
    this.createIceColumns();
    this.createCitySilhouette();
    this.createOrbits();
    this.createSparseGraph();
    this.createGrid();
    this.createHorizonRing();
    this.createScanBeam();
    this.createGlyphRain();
    this.createPacketPulses();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.events.abort();
    this.clearBootTimers();
    if (this.sceneReady) this.renderer.dispose();
  }

  private bootLater(fn: () => void, ms: number) {
    this.bootTimers.push(setTimeout(fn, ms));
  }

  private clearBootTimers() {
    for (const t of this.bootTimers) clearTimeout(t);
    this.bootTimers = [];
    if (this.bootInterval) {
      clearInterval(this.bootInterval);
      this.bootInterval = null;
    }
  }

  private runBootSequence() {
    const screen = document.getElementById('boot-screen');
    const terminal = document.getElementById('boot-terminal');
    const cmdEl = document.getElementById('boot-cmd');
    const cursorEl = document.getElementById('boot-cursor');
    const preLines = document.querySelectorAll<HTMLElement>('.boot-pre__line');
    const logs = document.querySelectorAll<HTMLElement>('.boot-log');
    const asciiLines = document.querySelectorAll<HTMLElement>('.boot-ascii__line');
    const accentLine = document.querySelector<HTMLElement>('.boot-ascii__line--accent');
    const footerStatus = document.getElementById('boot-footer-status');
    const layerEl = document.getElementById('boot-layer');
    const linkEl = document.getElementById('boot-link');
    const whisper = document.getElementById('boot-whisper');
    const quote = document.getElementById('boot-quote');
    const command = 'LOAD wired://layer01/v0iid';
    const corruptFrames = ['@#$', '%&!', '<?>', '|\\{', '···'];
    let i = 0;

    screen?.classList.add('boot-screen--burst');
    this.bootLater(() => screen?.classList.remove('boot-screen--burst'), 350);

    this.bootLater(() => preLines[0]?.classList.add('boot-pre__line--in'), 120);
    this.bootLater(() => {
      preLines[1]?.classList.add('boot-pre__line--in');
      if (layerEl) layerEl.textContent = '01';
    }, 260);

    corruptFrames.forEach((frame, idx) => {
      this.bootLater(() => {
        if (!cmdEl) return;
        cmdEl.classList.add('boot-prompt__cmd--corrupt');
        cmdEl.textContent = frame;
      }, 480 + idx * 36);
    });

    const typingStartMs = 480 + corruptFrames.length * 36 + 28;
    const fallbackDismissMs = typingStartMs + command.length * 24 + 1500 + 550;

    this.bootLater(() => {
      if (!cmdEl) {
        this.dismissBoot();
        return;
      }
      cmdEl.textContent = '';
      cmdEl.classList.remove('boot-prompt__cmd--corrupt');

      this.bootInterval = setInterval(() => {
        if (!cmdEl) return;
        cmdEl.textContent = command.slice(0, ++i);
        if (i < command.length) return;

        if (this.bootInterval) clearInterval(this.bootInterval);
        this.bootInterval = null;

        cursorEl?.classList.add('boot-cursor--off');
        terminal?.classList.add('boot-terminal--glitch');
        this.bootLater(() => terminal?.classList.remove('boot-terminal--glitch'), 180);

        if (linkEl) linkEl.textContent = 'sync';
        whisper?.classList.add('boot-whisper--in');

        logs.forEach((log, idx) => {
          this.bootLater(() => {
            log.classList.add('boot-log--in', 'boot-log--glitch');
            this.bootLater(() => log.classList.add('boot-log--ok'), 90);
          }, 110 + idx * 170);
        });

        asciiLines.forEach((line, idx) => {
          this.bootLater(() => {
            line.classList.add('boot-ascii__line--in');
            if (line === accentLine) line.classList.add('boot-ascii__line--chroma');
          }, 780 + idx * 52);
        });

        this.bootLater(() => quote?.classList.add('boot-quote--in'), 1280);
        this.bootLater(() => {
          if (footerStatus) {
            footerStatus.textContent = 'linked';
            footerStatus.classList.add('boot-footer__status--linked');
          }
          if (linkEl) linkEl.textContent = 'up';
          this.bootLater(() => this.dismissBoot(), 420);
        }, 1520);
      }, 24);
    }, typingStartMs);

    this.bootLater(() => this.dismissBoot(), fallbackDismissMs);
  }

  private dismissBoot() {
    if (this.bootDismissed) return;
    this.bootDismissed = true;
    this.clearBootTimers();
    document.documentElement.classList.add('boot-ready');
    const el = document.getElementById('boot-screen');
    el?.classList.add('boot-screen--exit');
    this.bootLater(() => {
      el?.classList.add('boot-screen--hidden');
      this.bootLater(() => el?.remove(), 250);
    }, 320);
  }

  private createDust() {
    const n = 700;
    this.dustPos = new Float32Array(n * 3);
    this.dustCol = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.dustPos[i * 3] = (Math.random() - 0.5) * 140;
      this.dustPos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      this.dustPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      const c = paletteAt(Math.random());
      this.dustCol[i * 3] = c.r;
      this.dustCol[i * 3 + 1] = c.g;
      this.dustCol[i * 3 + 2] = c.b;
    }
    this.dustBase = this.dustPos.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.dustCol, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.dust);
  }

  private createWireShell() {
    const geo = new THREE.IcosahedronGeometry(18, 2);
    this.wireShell = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x2ee86a, wireframe: true, transparent: true, opacity: 0.045 })
    );
    this.wireGhost = new THREE.Mesh(
      geo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x00c8a8, wireframe: true, transparent: true, opacity: 0.025 })
    );
    this.wireChroma = new THREE.Mesh(
      geo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x8878c8, wireframe: true, transparent: true, opacity: 0.018 })
    );
    this.wireGhost.position.set(0.35, -0.15, 0.12);
    this.wireChroma.position.set(-0.3, 0.1, -0.1);
    this.scene.add(this.wireShell, this.wireGhost, this.wireChroma);
  }

  private createLedgerKnot() {
    const geo = new THREE.TorusKnotGeometry(5.5, 1.4, 100, 14, 2, 3);
    const wire = new THREE.WireframeGeometry(geo);
    this.knotBase = (wire.getAttribute('position').array as Float32Array).slice();
    const count = wire.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = paletteAt(i / count + 0.1);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    wire.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.ledgerKnot = new THREE.LineSegments(
      wire,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.14 })
    );
    this.scene.add(this.ledgerKnot);
  }

  private createKnotEcho() {
    const geo = new THREE.TorusKnotGeometry(5.5, 1.4, 100, 14, 2, 3);
    const wire = new THREE.WireframeGeometry(geo);
    this.knotEcho = new THREE.LineSegments(
      wire,
      new THREE.LineBasicMaterial({
        color: 0x00c8a8,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.knotEcho.scale.setScalar(1.18);
    this.scene.add(this.knotEcho);
  }

  private updateKnot(t: number, amp: number) {
    const attr = this.ledgerKnot.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.ledgerKnot.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const cols = colAttr.array as Float32Array;
    const breath = 1 + Math.sin(t * 0.55) * 0.04 * amp;
    const warp = Math.sin(t * 0.35) * 0.12 * amp;
    for (let i = 0; i < this.knotBase.length; i += 3) {
      const bx = this.knotBase[i];
      const by = this.knotBase[i + 1];
      const bz = this.knotBase[i + 2];
      const r = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      const wobble = 1 + Math.sin(t * 0.8 + r * 0.5) * warp;
      arr[i] = bx * breath * wobble;
      arr[i + 1] = by * breath * wobble;
      arr[i + 2] = bz * breath * wobble;
      const c = paletteAt(t * 0.04 + i / this.knotBase.length);
      cols[i] = c.r;
      cols[i + 1] = c.g;
      cols[i + 2] = c.b;
    }
    attr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.ledgerKnot.rotation.y = t * 0.06;
    this.ledgerKnot.rotation.x = Math.sin(t * 0.25) * 0.12;
    (this.ledgerKnot.material as THREE.LineBasicMaterial).opacity = 0.08 + amp * 0.1;

    this.echoRot += 0.018 * amp;
    this.echoRotLag += (this.echoRot - this.echoRotLag) * 0.04;
    this.knotEcho.rotation.copy(this.ledgerKnot.rotation);
    this.knotEcho.rotation.y = this.echoRotLag;
    this.knotEcho.scale.setScalar(1.14 + Math.sin(t * 0.4) * 0.04);
    (this.knotEcho.material as THREE.LineBasicMaterial).opacity = 0.02 + amp * 0.04;
  }

  private createConstructs() {
    [3.2, 4.6, 6].forEach((size, i) => {
      const wire = new THREE.WireframeGeometry(new THREE.BoxGeometry(size, size, size));
      const mesh = new THREE.LineSegments(
        wire,
        new THREE.LineBasicMaterial({
          color: i === 0 ? 0x2ee86a : i === 1 ? 0x00c8a8 : 0x8878c8,
          transparent: true,
          opacity: 0.05,
        })
      );
      mesh.position.set((i - 1) * 14, (Math.random() - 0.5) * 8, -8 - i * 3);
      this.scene.add(mesh);
      this.constructs.push({
        mesh,
        speed: new THREE.Vector3(
          0.08 + Math.random() * 0.06,
          0.05 + Math.random() * 0.04,
          0.03 + Math.random() * 0.03
        ),
        phase: Math.random() * Math.PI * 2,
      });
    });
  }

  private updateConstructs(t: number, amp: number) {
    this.constructs.forEach((c, i) => {
      c.mesh.rotation.x += c.speed.x * 0.012 * amp;
      c.mesh.rotation.y += c.speed.y * 0.015 * amp;
      c.mesh.rotation.z += c.speed.z * 0.01 * amp;
      c.mesh.position.y += Math.sin(t * 0.4 + c.phase) * 0.008;
      (c.mesh.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05 + Math.sin(t + i) * 0.015;
    });
  }

  private createDataArcs() {
    for (let i = 0; i < 5; i++) {
      const segs = 32;
      const verts = new Float32Array(segs * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: i % 2 === 0 ? 0x2ee86a : 0x8878c8,
          transparent: true,
          opacity: 0.06,
        })
      );
      this.scene.add(line);
      this.dataArcs.push({
        line,
        phase: Math.random() * Math.PI * 2,
        t0: Math.random() * 10,
        t1: Math.random() * 10,
      });
    }
  }

  private updateDataArcs(t: number, amp: number) {
    this.dataArcs.forEach((arc) => {
      const attr = arc.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const segs = verts.length / 3;
      const ax = Math.sin(t * 0.28 + arc.phase) * 28;
      const ay = Math.cos(t * 0.22 + arc.phase) * 10;
      const az = Math.sin(t * 0.18) * 8;
      const bx = Math.cos(t * 0.32 + arc.t0) * 32;
      const by = Math.sin(t * 0.38 + arc.t1) * 12 - 4;
      const bz = -12 + Math.cos(t * 0.14) * 6;
      for (let i = 0; i < segs; i++) {
        const p = i / (segs - 1);
        const lift = Math.sin(p * Math.PI) * 5 * amp;
        verts[i * 3] = ax + (bx - ax) * p + Math.sin(p * 10 + t) * 0.6;
        verts[i * 3 + 1] = ay + (by - ay) * p + lift;
        verts[i * 3 + 2] = az + (bz - az) * p;
      }
      attr.needsUpdate = true;
      (arc.line.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.06;
    });
  }

  private createRingPool() {
    for (let i = 0; i < 6; i++) {
      const segs = 64;
      const pts: number[] = [];
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        pts.push(Math.cos(a), 0, Math.sin(a));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x2ee86a, transparent: true, opacity: 0 })
      );
      line.visible = false;
      this.scene.add(line);
      this.ringPool.push(line);
    }
  }

  private spawnWhisperRing() {
    const mesh = this.ringPool.find((r) => !r.visible);
    if (!mesh) return;
    mesh.visible = true;
    mesh.scale.setScalar(1);
    mesh.position.set(0, Math.sin(this.time * 0.3) * 2, 0);
    (mesh.material as THREE.LineBasicMaterial).opacity = 0.12;
    this.whisperRings.push({ mesh, age: 0, max: 3.2 + Math.random() * 1.5 });
  }

  private updateWhisperRings(dt: number, amp: number) {
    this.ringTimer += dt;
    if (this.ringTimer > 2.4 - amp * 0.8) {
      this.ringTimer = 0;
      this.spawnWhisperRing();
    }
    this.whisperRings = this.whisperRings.filter((r) => {
      r.age += dt;
      const f = r.age / r.max;
      r.mesh.scale.setScalar(1 + f * 22);
      const c = paletteAt(f * 0.4 + this.time * 0.02);
      (r.mesh.material as THREE.LineBasicMaterial).color.copy(c);
      (r.mesh.material as THREE.LineBasicMaterial).opacity = 0.08 * (1 - f) * amp;
      if (r.age >= r.max) { r.mesh.visible = false; return false; }
      return true;
    });
  }

  private createBurstPool() {
    for (let i = 0; i < 5; i++) {
      const rays = 10;
      const verts = new Float32Array(rays * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const lines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0x00c8a8, transparent: true, opacity: 0 })
      );
      lines.visible = false;
      this.scene.add(lines);
      this.burstPool.push(lines);
    }
  }

  private spawnIceBurst() {
    const burst = this.burstPool.find((b) => !b.visible);
    if (!burst) return;
    const attr = burst.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = attr.array as Float32Array;
    const rays = v.length / 6;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < rays; i++) {
      const a = baseAngle + (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const tilt = (Math.random() - 0.5) * 0.9;
      const len = 3 + Math.random() * 5;
      v[i * 6] = 0;
      v[i * 6 + 1] = 0;
      v[i * 6 + 2] = 0;
      v[i * 6 + 3] = Math.cos(a) * Math.cos(tilt) * len;
      v[i * 6 + 4] = Math.sin(tilt) * len;
      v[i * 6 + 5] = Math.sin(a) * Math.cos(tilt) * len;
    }
    attr.needsUpdate = true;
    burst.visible = true;
    burst.scale.setScalar(1);
    burst.position.set(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 20 - 5
    );
    (burst.material as THREE.LineBasicMaterial).opacity = 0.18;
    this.iceBursts.push({ lines: burst, age: 0, max: 0.55 + Math.random() * 0.45 });
  }

  private updateIceBursts(dt: number, amp: number) {
    this.burstTimer += dt;
    if (this.burstTimer > 2.2 - amp * 0.7) {
      this.burstTimer = 0;
      this.spawnIceBurst();
    }
    this.iceBursts = this.iceBursts.filter((b) => {
      b.age += dt;
      const f = b.age / b.max;
      b.lines.scale.setScalar(1 + f * 3);
      (b.lines.material as THREE.LineBasicMaterial).opacity = 0.2 * (1 - f) * amp;
      if (b.age >= b.max) { b.lines.visible = false; return false; }
      return true;
    });
  }

  private createPulsePool() {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 5, 5),
        new THREE.MeshBasicMaterial({
          color: 0x2ee86a,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.pulsePool.push(mesh);
    }
  }

  private spawnAuroraPulse() {
    if (this.auroras.length === 0) return;
    const mesh = this.pulsePool.find((m) => !m.visible);
    if (!mesh) return;
    mesh.visible = true;
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.6;
    this.auroraPulses.push({
      aurIdx: Math.floor(Math.random() * this.auroras.length),
      t: 0,
      mesh,
    });
  }

  private updateAuroraPulses(dt: number, amp: number) {
    this.pulseTimer += dt;
    if (this.pulseTimer > 1.6) {
      this.pulseTimer = 0;
      this.spawnAuroraPulse();
    }
    this.auroraPulses = this.auroraPulses.filter((p) => {
      p.t += dt * 0.35;
      if (p.t >= 1) { p.mesh.visible = false; return false; }
      const aur = this.auroras[p.aurIdx];
      const attr = aur.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const idx = Math.floor(p.t * (aur.phases.length - 1));
      p.mesh.position.set(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(p.t * Math.PI) * 0.5 * amp;
      const c = paletteAt(p.t + p.aurIdx * 0.2);
      (p.mesh.material as THREE.MeshBasicMaterial).color.copy(c);
      return true;
    });
  }

  private createHelix() {
    const pts = 80;
    this.helixVertsA = new Float32Array(pts * 3);
    this.helixVertsB = new Float32Array(pts * 3);
    const mk = (v: Float32Array, col: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.07 }));
    };
    this.helixA = mk(this.helixVertsA, 0x2ee86a);
    this.helixB = mk(this.helixVertsB, 0x8878c8);
    this.scene.add(this.helixA, this.helixB);
    this.updateHelix(0, 1);
  }

  private updateHelix(t: number, amp: number) {
    const pts = this.helixVertsA.length / 3;
    const r = 22 + Math.sin(t * 0.3) * 2;
    for (let i = 0; i < pts; i++) {
      const p = i / pts;
      const angle = p * Math.PI * 6 + t * 0.25 * amp;
      const y = (p - 0.5) * 40;
      this.helixVertsA[i * 3] = Math.cos(angle) * r;
      this.helixVertsA[i * 3 + 1] = y;
      this.helixVertsA[i * 3 + 2] = Math.sin(angle) * r * 0.5;
      this.helixVertsB[i * 3] = Math.cos(angle + Math.PI) * r;
      this.helixVertsB[i * 3 + 1] = y;
      this.helixVertsB[i * 3 + 2] = Math.sin(angle + Math.PI) * r * 0.5;
    }
    (this.helixA.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.helixB.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.helixA.material as THREE.LineBasicMaterial).opacity = 0.04 + amp * 0.06;
    (this.helixB.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05;
  }

  private createAuroras() {
    for (let a = 0; a < 5; a++) {
      const count = 40;
      const phases: number[] = [];
      const verts = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) phases.push(Math.random() * Math.PI * 2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1 })
      );
      this.scene.add(line);
      this.auroras.push({ line, phases });
    }
  }

  private updateAuroras(t: number, amp: number) {
    this.auroras.forEach((aur, ai) => {
      const attr = aur.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = aur.line.geometry.getAttribute('color') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const cols = colAttr.array as Float32Array;
      const orbit = (ai / this.auroras.length) * Math.PI * 2;
      for (let i = 0; i < aur.phases.length; i++) {
        const p = i / (aur.phases.length - 1);
        const wave = Math.sin(t * 0.5 + aur.phases[i] + p * 3) * 2 * amp;
        const twist = p * Math.PI * 2 + t * 0.15 * amp + orbit;
        const spread = 28 + ai * 4;
        verts[i * 3] = Math.cos(twist) * spread * (0.5 + p * 0.5) + wave;
        verts[i * 3 + 1] = (p - 0.5) * 30 + wave * 0.5;
        verts[i * 3 + 2] = Math.sin(twist) * spread * 0.35 - 10;
        const c = paletteAt(t * 0.06 + p * 0.3 + ai * 0.15);
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
      }
      attr.needsUpdate = true;
      colAttr.needsUpdate = true;
      (aur.line.material as THREE.LineBasicMaterial).opacity = 0.05 + amp * 0.08;
    });
  }

  private createIceColumns() {
    for (let i = 0; i < 18; i++) {
      const verts = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x1a5c38, transparent: true, opacity: 0.06 })
      );
      line.position.set((Math.random() - 0.5) * 80, 0, -25 - Math.random() * 20);
      this.scene.add(line);
      this.iceColumns.push({ line, phase: Math.random() * 10, speed: 0.3 + Math.random() * 0.4 });
    }
  }

  private updateIceColumns(t: number, amp: number) {
    this.iceColumns.forEach((col) => {
      const attr = col.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const v = attr.array as Float32Array;
      const scroll = ((t * col.speed + col.phase) % 30) - 15;
      const h = 5 + Math.sin(t * 0.4 + col.phase) * 2;
      v[0] = 0; v[1] = scroll; v[2] = 0;
      v[3] = 0; v[4] = scroll + h; v[5] = 0;
      attr.needsUpdate = true;
      (col.line.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05;
    });
  }

  private createCitySilhouette() {
    const verts: number[] = [];
    const cols: number[] = [];
    const blocks = 24;
    for (let i = 0; i <= blocks; i++) {
      const x = (i / blocks - 0.5) * 90;
      const h = 2 + Math.abs(Math.sin(i * 0.7)) * 8 + Math.abs(Math.cos(i * 1.3)) * 5;
      verts.push(x, -16, -35, x, -16 + h, -35);
      const c = paletteAt(i / blocks);
      cols.push(c.r, c.g, c.b, c.r * 0.7, c.g * 0.7, c.b * 0.7);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.citySilhouette = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.08 })
    );
    this.scene.add(this.citySilhouette);
  }

  private createOrbits() {
    this.orbitGroup = new THREE.Group();
    const configs = [
      { rx: 26, ry: 10, rz: 26, speed: 0.35, tilt: 0.3, color: 0x2ee86a },
      { rx: 34, ry: 8, rz: 30, speed: -0.22, tilt: -0.5, color: 0x00c8a8 },
      { rx: 20, ry: 14, rz: 22, speed: 0.5, tilt: 0.8, color: 0xc9a227 },
    ];

    configs.forEach((cfg, idx) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * cfg.rx,
          Math.sin(a) * cfg.ry,
          Math.sin(a) * cfg.rz * 0.4
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(128));
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.06 })
      );
      line.rotation.x = cfg.tilt;
      this.orbitPaths.push(line);
      this.orbitGroup.add(line);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.5 })
      );
      dot.userData = { curve, speed: cfg.speed, phase: idx * 2.1 };
      this.orbitDots.push(dot);
      this.orbitGroup.add(dot);

      const trail = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.2 })
      );
      trail.userData = { parent: dot };
      this.trailDots.push(trail);
      this.orbitGroup.add(trail);
    });
    this.scene.add(this.orbitGroup);
  }

  private createSparseGraph() {
    const count = 36;
    this.nodePos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 10 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      this.nodePos[i * 3] = Math.cos(a) * r;
      this.nodePos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      this.nodePos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.nodePos, 3));
    this.nodes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x2ee86a,
        size: 0.26,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.nodes);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * count * 6), 3));
    this.nodeLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x1a5c38, transparent: true, opacity: 0.04 })
    );
    this.scene.add(this.nodeLines);
  }

  private updateGraphLines() {
    const threshold = 9;
    const segs: number[] = [];
    const n = this.nodePos.length / 3;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = this.nodePos[i * 3] - this.nodePos[j * 3];
        const dy = this.nodePos[i * 3 + 1] - this.nodePos[j * 3 + 1];
        const dz = this.nodePos[i * 3 + 2] - this.nodePos[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < threshold * threshold) {
          segs.push(
            this.nodePos[i * 3], this.nodePos[i * 3 + 1], this.nodePos[i * 3 + 2],
            this.nodePos[j * 3], this.nodePos[j * 3 + 1], this.nodePos[j * 3 + 2]
          );
        }
      }
    }
    const attr = this.nodeLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    (attr.array as Float32Array).fill(0);
    for (let i = 0; i < segs.length; i++) (attr.array as Float32Array)[i] = segs[i];
    attr.needsUpdate = true;
    this.nodeLines.geometry.setDrawRange(0, segs.length / 3);
  }

  private createGrid() {
    this.grid = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 30, 30),
      new THREE.MeshBasicMaterial({ color: 0x1a5c38, wireframe: true, transparent: true, opacity: 0.025 })
    );
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = -16;
    this.scene.add(this.grid);
  }

  private createHorizonRing() {
    this.horizonRing = new THREE.Mesh(
      new THREE.TorusGeometry(42, 0.04, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x2ee86a, transparent: true, opacity: 0.04 })
    );
    this.horizonRing.rotation.x = Math.PI / 2;
    this.horizonRing.position.y = -10;
    this.scene.add(this.horizonRing);
  }

  private createScanBeam() {
    this.scanBeam = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 0.15, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x2ee86a,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.scanBeam.rotation.x = -Math.PI / 2;
    this.scanBeam.position.y = -15.8;
    this.scene.add(this.scanBeam);
  }

  private createGlyphRain() {
    const n = 55;
    this.glyphPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.glyphPos[i * 3] = (Math.random() - 0.5) * 70;
      this.glyphPos[i * 3 + 1] = Math.random() * 60 - 20;
      this.glyphPos[i * 3 + 2] = -20 - Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.glyphPos, 3));
    this.glyphRain = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x00c8a8,
        size: 0.16,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.glyphRain);
  }

  private createPacketPulses() {
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 6, 6),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xc9a227 : 0x8878c8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.scene.add(mesh);
      this.packetPulses.push({
        mesh,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        t: Math.random(),
        speed: 0.15 + Math.random() * 0.2,
      });
    }
    this.packetPulses.forEach((_, i) => this.respawnPacket(i));
  }

  private respawnPacket(i: number) {
    const n = this.nodePos.length / 3;
    const a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    while (b === a) b = Math.floor(Math.random() * n);
    const p = this.packetPulses[i];
    p.from.set(this.nodePos[a * 3], this.nodePos[a * 3 + 1], this.nodePos[a * 3 + 2]);
    p.to.set(this.nodePos[b * 3], this.nodePos[b * 3 + 1], this.nodePos[b * 3 + 2]);
    p.t = 0;
    p.speed = 0.12 + Math.random() * 0.18;
  }

  private bindEvents() {
    const { signal } = this.events;
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (this.destroyed) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.targetScroll = max > 0 ? window.scrollY / max : 0;
      this.scrollVel = window.scrollY - lastY;
      lastY = window.scrollY;
      if (this.progressBar) this.progressBar.style.transform = `scaleX(${this.targetScroll})`;
      document.documentElement.style.setProperty('--scroll', String(this.targetScroll));
    }, { passive: true, signal });
    window.addEventListener('resize', () => this.onResize(), { signal });
    window.addEventListener('mousemove', (e) => {
      if (this.destroyed) return;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--my', `${e.clientY}px`);
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden;
      if (this.visible) this.clock.getDelta();
    }, { signal });
  }

  private onResize() {
    if (!this.sceneReady || this.destroyed) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateCamera(s: number, t: number) {
    const mx = this.smoothMouse.x * 2.5;
    const my = this.smoothMouse.y * 1.5;
    const breath = Math.sin(t * 0.4) * 0.8;
    const z = 68 - s * 18 + breath;
    this.camera.position.set(mx + Math.sin(t * 0.15) * 1.5, 3 + s * 4 + my, z);
    this.camera.lookAt(mx * 0.5, breath * 0.3, 0);
  }

  private updateScene(s: number, t: number, dt: number) {
    if (this.reducedMotion) return;

    const mid = Math.sin(s * Math.PI);
    const amp = 0.65 + mid * 0.35;
    const calm = 1 - this.smoothFocus * 0.45;
    const calmT = t * calm;
    const calmAmp = amp * calm;

    const mx = this.smoothMouse.x * 12;
    const my = this.smoothMouse.y * 6;
    const n = this.dustPos.length / 3;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const bx = this.dustBase[i3];
      const by = this.dustBase[i3 + 1];
      const bz = this.dustBase[i3 + 2];
      this.dustPos[i3] = bx + (mx - bx) * 0.008 + Math.sin(t * 0.2 + i) * 0.15;
      this.dustPos[i3 + 1] = by + (my - by) * 0.006 + Math.cos(t * 0.25 + i * 0.1) * 0.12;
      this.dustPos[i3 + 2] = bz;
    }
    (this.dust.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.dust.rotation.y = t * 0.012;
    (this.dust.material as THREE.PointsMaterial).opacity = 0.16 + mid * 0.14;

    this.updateKnot(calmT, calmAmp);

    const breath = 1 + Math.sin(calmT * 0.5) * 0.02;
    this.wireShell.scale.setScalar(breath);
    this.wireShell.rotation.y = calmT * 0.04;
    this.wireShell.rotation.x = Math.sin(calmT * 0.2) * 0.06;
    (this.wireShell.material as THREE.MeshBasicMaterial).opacity = 0.03 + mid * 0.03;

    this.wireGhost.rotation.copy(this.wireShell.rotation);
    this.wireGhost.scale.copy(this.wireShell.scale);
    this.wireGhost.position.x = 0.3 + Math.sin(calmT * 0.7) * 0.15;

    this.wireChroma.rotation.copy(this.wireShell.rotation);
    this.wireChroma.rotation.y -= 0.02;
    this.wireChroma.scale.copy(this.wireShell.scale);
    this.wireChroma.position.x = -0.25 + Math.cos(calmT * 0.5) * 0.12;

    this.updateConstructs(calmT, calmAmp);
    this.updateHelix(calmT, calmAmp);
    this.updateAuroras(calmT, calmAmp);
    this.updateAuroraPulses(dt, calmAmp);
    this.updateIceColumns(calmT, calmAmp);
    this.updateDataArcs(calmT, calmAmp);
    this.updateWhisperRings(dt, calmAmp);
    this.updateIceBursts(dt, calmAmp);

    this.citySilhouette.position.y = Math.sin(t * 0.2) * 0.2;
    (this.citySilhouette.material as THREE.LineBasicMaterial).opacity = 0.05 + mid * 0.05;

    this.orbitGroup.rotation.y = t * 0.03;
    this.orbitDots.forEach((dot, idx) => {
      const { curve, speed, phase } = dot.userData;
      const u = (t * speed * 0.08 + phase) % 1;
      dot.position.copy(curve.getPoint(u));
      (dot.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(t * 2 + phase) * 0.15;
      const trail = this.trailDots[idx];
      if (trail) {
        trail.position.copy(curve.getPoint((u - 0.04 + 1) % 1));
        (trail.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 3 + phase) * 0.06;
      }
    });

    for (let i = 0; i < this.nodePos.length; i += 3) {
      this.nodePos[i + 1] += Math.sin(t * 0.5 + i) * 0.002;
    }
    (this.nodes.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.nodes.material as THREE.PointsMaterial).opacity = 0.15 + mid * 0.25;
    this.nodeLines.visible = s > 0.08 && s < 0.92;
    if (Math.floor(t * 8) % 5 === 0) this.updateGraphLines();

    (this.grid.material as THREE.MeshBasicMaterial).opacity = 0.02 + s * 0.015;
    this.grid.position.y = -16 + Math.sin(t * 0.3) * 0.3;
    this.horizonRing.rotation.z = t * 0.06;
    (this.horizonRing.material as THREE.MeshBasicMaterial).opacity = 0.025 + (1 - s) * 0.02;

    const sweepAngle = t * 0.45;
    this.scanBeam.rotation.z = sweepAngle;
    (this.scanBeam.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(sweepAngle) * 0.02 + mid * 0.02;

    const glyphAttr = this.glyphRain.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.glyphPos.length; i += 3) {
      this.glyphPos[i + 1] += 0.025 + Math.sin(t + i) * 0.005;
      if (this.glyphPos[i + 1] > 35) {
        this.glyphPos[i + 1] = -25;
        this.glyphPos[i] = (Math.random() - 0.5) * 70;
      }
    }
    glyphAttr.needsUpdate = true;
    (this.glyphRain.material as THREE.PointsMaterial).opacity = 0.06 + mid * 0.08;

    const graphActive = s > 0.08 && s < 0.92;
    this.packetPulses.forEach((pkt, i) => {
      const mat = pkt.mesh.material as THREE.MeshBasicMaterial;
      if (!graphActive) { mat.opacity = 0; return; }
      pkt.t += pkt.speed * 0.008;
      if (pkt.t >= 1) { this.respawnPacket(i); return; }
      pkt.mesh.position.lerpVectors(pkt.from, pkt.to, pkt.t);
      mat.opacity = Math.sin(pkt.t * Math.PI) * 0.45;
    });

    (this.scene.fog as THREE.FogExp2).density = 0.008 + Math.abs(this.smoothScrollVel) * 0.00006;
  }

  private contentFocus(): number {
    let focus = 0;
    for (const el of this.sectionEls) {
      if (el.id !== 'archive' && el.id !== 'enter') continue;
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      focus = Math.max(focus, Math.max(0, 1 - dist * 1.2));
    }
    return focus;
  }

  private updateUI(s: number) {
    const targetFocus = this.contentFocus();
    this.smoothFocus += (targetFocus - this.smoothFocus) * 0.07;

    const hue = Math.floor(this.time * 15 + s * 80) % 360;
    const blur = this.smoothFocus * 4;
    const bloom = (1 - this.smoothFocus) * 0.35 + Math.sin(s * Math.PI) * 0.35;
    document.documentElement.style.setProperty('--hue', String(hue));
    document.documentElement.style.setProperty('--vel', String(Math.min(Math.abs(this.smoothScrollVel) * 0.03, 1)));
    document.documentElement.style.setProperty('--bloom', String(bloom));
    document.documentElement.style.setProperty('--tilt', `${(this.smoothMouse.x * 3).toFixed(2)}deg`);
    document.documentElement.style.setProperty('--focus', String(this.smoothFocus));
    document.documentElement.style.setProperty('--bg-blur', String(blur));
    document.documentElement.style.setProperty('--pulse', String(0.5 + Math.sin(this.time * 1.2) * 0.5));
    document.documentElement.style.setProperty('--parallax', `${(this.smoothMouse.y * 8).toFixed(1)}px`);

    this.sectionEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const v = Math.max(0, 1 - dist * 1.6);
      const ease = v * v * (3 - 2 * v);
      el.style.setProperty('--section-reveal', String(ease));
    });

    if (this.coordDisplay) {
      const seq = Math.floor(s * 4095).toString(16).padStart(3, '0');
      const states = ['idle', 'read', 'sync', 'ice', 'ghost', 'trace', 'ledger'];
      this.coordDisplay.textContent = `blk:0x${seq} · ${states[Math.floor(this.time * 0.4) % states.length]}`;
    }

    if (this.ledgerTicker) {
      const phrases = [
        'ghost trace · ledger sync · ice probe',
        'helix spin · construct run · v0iid read',
        'neural map · data arc · wintermute ping',
        'archive mount · phosphor ok · shell drift',
      ];
      this.ledgerTicker.textContent = phrases[Math.floor(this.time * 0.25) % phrases.length];
    }

    document.querySelectorAll<HTMLElement>('.card').forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.95) return;
      const delay = i * 0.08;
      const v = Math.max(0, Math.min(1, 1 - (rect.top - window.innerHeight * 0.65) / (window.innerHeight * 0.3)));
      const ease = v * v * (3 - 2 * v);
      card.style.setProperty('--card-reveal', String(ease));
      card.style.setProperty('--card-lift', `${(1 - ease) * 16 + delay * 2}px`);
    });
  }

  private animate() {
    if (this.destroyed || !this.sceneReady) return;
    requestAnimationFrame(() => this.animate());
    if (!this.visible) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsedTime();
    this.time = t;
    this.scroll += (this.targetScroll - this.scroll) * 0.04;
    this.smoothScrollVel += (this.scrollVel - this.smoothScrollVel) * 0.12;
    this.scrollVel *= 0.88;
    this.smoothMouse.lerp(this.mouse, 0.04);

    this.updateCamera(this.scroll, t);
    this.updateScene(this.scroll, t, dt);
    this.updateUI(this.scroll);
    this.renderer.render(this.scene, this.camera);
  }
}

