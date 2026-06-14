import * as THREE from 'three';

/* GHOST WIRE — Neuromancer × GitS depth field, soft focus on dossier */

const VOID = 0x030206;

const PALETTE = [
  new THREE.Color(0xb8a8e0),
  new THREE.Color(0x98c8f0),
  new THREE.Color(0xc8a8d8),
  new THREE.Color(0xa0b8e8),
  new THREE.Color(0xa8e0f0),
  new THREE.Color(0xb898b8),
];

function paletteAt(t: number): THREE.Color {
  const n = PALETTE.length;
  const x = ((t % 1) + 1) % 1;
  const i = Math.floor(x * n) % n;
  const f = (x * n) % 1;
  return PALETTE[i].clone().lerp(PALETTE[(i + 1) % n], f);
}

type Filament = { line: THREE.Line; phases: number[] };
type WhisperRing = { mesh: THREE.Line; age: number; max: number };
type IceColumn = { line: THREE.Line; x: number; z: number; phase: number; speed: number };
type FilamentPulse = { filIdx: number; t: number; mesh: THREE.Mesh };
type OrbitRing = { line: THREE.Line; tilt: number; speed: number };
type ConstructCube = { mesh: THREE.LineSegments; speed: THREE.Vector3; base: number };
type IceBurst = { lines: THREE.LineSegments; age: number; max: number };
type DataArc = { line: THREE.Line; t0: number; t1: number; phase: number };
type NeuralEdge = { a: number; b: number };

export class Section9Scene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 260);
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();

  private scroll = 0;
  private targetScroll = 0;
  private scrollVel = 0;
  private smoothScrollVel = 0;
  private mouse = new THREE.Vector2(0, 0);
  private smoothMouse = new THREE.Vector2(0, 0);
  private smoothFocus = 0;
  private time = 0;

  private knot!: THREE.LineSegments;
  private knotBase!: Float32Array;
  private ghostEcho!: THREE.LineSegments;
  private echoRot = 0;
  private echoRotLag = 0;
  private helixA!: THREE.Line;
  private helixB!: THREE.Line;
  private helixVertsA!: Float32Array;
  private helixVertsB!: Float32Array;
  private filaments: Filament[] = [];
  private iceColumns: IceColumn[] = [];
  private orbitRings: OrbitRing[] = [];
  private pulsePool: THREE.Mesh[] = [];
  private filamentPulses: FilamentPulse[] = [];
  private pulseTimer = 0;
  private particles!: THREE.Points;
  private particlePos!: Float32Array;
  private particleCol!: Float32Array;
  private grid!: THREE.LineSegments;
  private gridVerts!: Float32Array;
  private gridSegs = 28;
  private ringPool: THREE.Line[] = [];
  private whisperRings: WhisperRing[] = [];
  private ringTimer = 0;
  private constructs: ConstructCube[] = [];
  private shellWire!: THREE.LineSegments;
  private shellBase!: Float32Array;
  private neuralLines!: THREE.LineSegments;
  private neuralVerts!: Float32Array;
  private neuralNodes: THREE.Vector3[] = [];
  private neuralBase: THREE.Vector3[] = [];
  private neuralEdges: NeuralEdge[] = [];
  private dataArcs: DataArc[] = [];
  private iceBursts: IceBurst[] = [];
  private burstPool: THREE.LineSegments[] = [];
  private burstTimer = 0;
  private particleBase!: Float32Array;

  private sectionEls: HTMLElement[] = [];
  private progressBar: HTMLElement | null = null;
  private syncReadout: HTMLElement | null = null;
  private depthReadout: HTMLElement | null = null;
  private bootStatus: HTMLElement | null = null;
  private reducedMotion = false;
  private lastScrollY = 0;
  private bootTimers: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;
  private sceneReady = false;
  private visible = !document.hidden;
  private events = new AbortController();
  private bootDismissed = false;
  private revealedSections = new Set<string>();
  private sectionActive = new Map<string, boolean>();
  private static readonly STICKY_SECTIONS = new Set(['dossier', 'clearance']);

  private hudStates = [
    'ICE:probe', 'SHELL:sync', 'GHOST:active', 'MATRIX:cycle',
    'CHIBA:night', 'HELIX:spin', 'CONSTRUCT:run', 'WINTERMUTE:trace',
  ];

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
      this.renderer.toneMappingExposure = 1.14;
      this.initScene();
      this.sceneReady = true;
      this.bindEvents();
      this.onResize();
      this.animate();
    } catch (err) {
      console.error('[ghost-wire] scene init failed — boot UI still runs', err);
      this.bindEvents();
      this.startUiLoop();
    }
  }

  private initDom() {
    this.sectionEls = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
    this.progressBar = document.getElementById('scroll-progress');
    this.syncReadout = document.getElementById('sync-readout');
    this.depthReadout = document.getElementById('depth-readout');
    this.bootStatus = document.getElementById('boot-status');
    this.lastScrollY = window.scrollY;

    this.syncScrollState();
    this.updateUI(this.scroll);

    if (!this.reducedMotion) this.runBoot();
    else this.dismissBoot();
  }

  private syncScrollState() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.targetScroll = max > 0 ? window.scrollY / max : 0;
    this.scroll = this.targetScroll;
    document.documentElement.style.setProperty('--scroll', String(this.targetScroll));
    if (this.progressBar) this.progressBar.style.transform = `scaleX(${this.targetScroll})`;
  }

  private sectionIsActive(id: string, v: number): boolean {
    if (Section9Scene.STICKY_SECTIONS.has(id)) {
      if (v > 0.45) this.revealedSections.add(id);
      return this.revealedSections.has(id);
    }
    const was = this.sectionActive.get(id) ?? false;
    const next = was ? v > 0.38 : v > 0.58;
    this.sectionActive.set(id, next);
    return next;
  }

  private initScene() {
    this.scene.fog = new THREE.FogExp2(VOID, 0.005);
    this.camera.position.set(0, 2.5, 20);

    this.scene.add(new THREE.AmbientLight(0x705890, 0.58));
    const key = new THREE.PointLight(0xc8a8e8, 0.78, 80);
    key.position.set(6, 10, 8);
    this.scene.add(key);

    this.createKnot();
    this.createGhostEcho();
    this.createHelix();
    this.createFilaments();
    this.createIceColumns();
    this.createOrbitRings();
    this.createPulsePool();
    this.createParticles();
    this.createConstructs();
    this.createShellWire();
    this.createNeuralWeb();
    this.createDataArcs();
    this.createBurstPool();
    this.createGrid();
    this.createRingPool();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.events.abort();
    for (const t of this.bootTimers) clearTimeout(t);
    this.bootTimers = [];
    if (this.sceneReady) this.renderer.dispose();
  }

  private bootLater(fn: () => void, ms: number) {
    this.bootTimers.push(setTimeout(fn, ms));
  }

  private startUiLoop() {
    const tick = () => {
      if (this.destroyed) return;
      requestAnimationFrame(tick);
      this.scroll += (this.targetScroll - this.scroll) * 0.06;
      this.time += 0.016;
      this.smoothFocus += (this.contentFocus() - this.smoothFocus) * 0.08;
      this.updateUI(this.scroll);
    };
    tick();
  }

  private runBoot() {
    ['routing through Chiba...', 'Section 9 handshake', 'ice pattern match', 'ghost online'].forEach((m, i) =>
      this.bootLater(() => { if (this.bootStatus) this.bootStatus.textContent = m; }, 180 + i * 240)
    );
    this.bootLater(() => this.dismissBoot(), 1200);
  }

  private dismissBoot() {
    if (this.bootDismissed) return;
    this.bootDismissed = true;
    document.documentElement.classList.add('boot-ready');
    document.getElementById('boot-screen')?.classList.add('boot-screen--hidden');
    this.bootLater(() => document.getElementById('boot-screen')?.remove(), 500);
  }

  private createKnot() {
    const geo = new THREE.TorusKnotGeometry(3.2, 0.85, 120, 16, 2, 3);
    const wire = new THREE.WireframeGeometry(geo);
    this.knotBase = (wire.getAttribute('position').array as Float32Array).slice();

    const count = wire.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = paletteAt(i / count);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    wire.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.knot = new THREE.LineSegments(
      wire,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
      })
    );
    this.scene.add(this.knot);
  }

  private createGhostEcho() {
    const geo = new THREE.TorusKnotGeometry(3.2, 0.85, 120, 16, 2, 3);
    const wire = new THREE.WireframeGeometry(geo);
    this.ghostEcho = new THREE.LineSegments(
      wire,
      new THREE.LineBasicMaterial({
        color: 0x8878a8,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.ghostEcho.scale.setScalar(1.14);
    this.scene.add(this.ghostEcho);
  }

  private createHelix() {
    const pts = 90;
    this.helixVertsA = new Float32Array(pts * 3);
    this.helixVertsB = new Float32Array(pts * 3);

    const mk = (verts: Float32Array, offset: number) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      return new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: offset === 0 ? 0x7890a8 : 0x9888a8,
          transparent: true,
          opacity: 0.1,
        })
      );
    };

    this.helixA = mk(this.helixVertsA, 0);
    this.helixB = mk(this.helixVertsB, Math.PI);
    this.scene.add(this.helixA, this.helixB);
    this.updateHelix(0, 1);
  }

  private updateHelix(t: number, amp: number) {
    const pts = this.helixVertsA.length / 3;
    const r = 7.5 + Math.sin(t * 0.4) * 0.5;
    for (let i = 0; i < pts; i++) {
      const p = i / pts;
      const angle = p * Math.PI * 7 + t * 0.35 * amp;
      const y = (p - 0.5) * 22;
      this.helixVertsA[i * 3] = Math.cos(angle) * r;
      this.helixVertsA[i * 3 + 1] = y;
      this.helixVertsA[i * 3 + 2] = Math.sin(angle) * r - 4;
      this.helixVertsB[i * 3] = Math.cos(angle + Math.PI) * r;
      this.helixVertsB[i * 3 + 1] = y;
      this.helixVertsB[i * 3 + 2] = Math.sin(angle + Math.PI) * r - 4;
    }
    (this.helixA.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.helixB.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.helixA.material as THREE.LineBasicMaterial).opacity = 0.05 + amp * 0.09;
    (this.helixB.material as THREE.LineBasicMaterial).opacity = 0.04 + amp * 0.08;
  }

  private createIceColumns() {
    for (let i = 0; i < 22; i++) {
      const verts = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x6888a0,
          transparent: true,
          opacity: 0.07,
        })
      );
      const x = (Math.random() - 0.5) * 48;
      const z = (Math.random() - 0.5) * 48 - 8;
      line.position.set(x, 0, z);
      this.scene.add(line);
      this.iceColumns.push({
        line,
        x,
        z,
        phase: Math.random() * 10,
        speed: 0.35 + Math.random() * 0.5,
      });
    }
  }

  private createOrbitRings() {
    const specs = [
      { r: 11, tilt: 0.5, speed: 0.06 },
      { r: 14, tilt: 1.1, speed: -0.04 },
      { r: 17, tilt: 0.2, speed: 0.03 },
    ];
    specs.forEach(({ r, tilt, speed }) => {
      const pts: number[] = [];
      const segs = 56;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x8070a0, transparent: true, opacity: 0.06 })
      );
      line.rotation.x = tilt;
      line.position.y = -1;
      this.scene.add(line);
      this.orbitRings.push({ line, tilt, speed });
    });
  }

  private createPulsePool() {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 5, 5),
        new THREE.MeshBasicMaterial({
          color: 0xa890c0,
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

  private spawnFilamentPulse() {
    if (this.filaments.length === 0) return;
    const mesh = this.pulsePool.find((m) => !m.visible);
    if (!mesh) return;
    mesh.visible = true;
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
    this.filamentPulses.push({
      filIdx: Math.floor(Math.random() * this.filaments.length),
      t: 0,
      mesh,
    });
  }

  private createFilaments() {
    for (let a = 0; a < 5; a++) {
      const pts = 48;
      const phases: number[] = [];
      for (let i = 0; i < pts; i++) phases.push(Math.random() * Math.PI * 2);

      const verts = new Float32Array(pts * 3);
      const cols = new Float32Array(pts * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.14,
        })
      );
      this.scene.add(line);
      this.filaments.push({ line, phases });
    }
  }

  private createParticles() {
    const n = 160;
    this.particlePos = new Float32Array(n * 3);
    this.particleCol = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      this.particlePos[i * 3] = (Math.random() - 0.5) * 55;
      this.particlePos[i * 3 + 1] = (Math.random() - 0.5) * 28;
      this.particlePos[i * 3 + 2] = (Math.random() - 0.5) * 55 - 6;
      const c = paletteAt(Math.random());
      this.particleCol[i * 3] = c.r;
      this.particleCol[i * 3 + 1] = c.g;
      this.particleCol[i * 3 + 2] = c.b;
    }
    this.particleBase = this.particlePos.slice();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleCol, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.14,
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    this.scene.add(this.particles);
  }

  private createGrid() {
    const s = this.gridSegs;
    const span = 60;
    const verts: number[] = [];
    const cols: number[] = [];
    for (let x = 0; x < s; x++) {
      for (let z = 0; z < s; z++) {
        const px = (x / s - 0.5) * span;
        const pz = (z / s - 0.5) * span - 8;
        if (x < s - 1) {
          const px2 = ((x + 1) / s - 0.5) * span;
          verts.push(px, 0, pz, px2, 0, pz);
          const c = paletteAt((x + z) / (s * 2));
          cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (z < s - 1) {
          const pz2 = ((z + 1) / s - 0.5) * span - 8;
          verts.push(px, 0, pz, px, 0, pz2);
          const c = paletteAt((x + z) / (s * 2) + 0.3);
          cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
    }
    this.gridVerts = new Float32Array(verts);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.gridVerts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.grid = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.05 })
    );
    this.grid.position.y = -7;
    this.scene.add(this.grid);
  }

  private createRingPool() {
    for (let i = 0; i < 4; i++) {
      const pts: number[] = [];
      const segs = 48;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        pts.push(Math.cos(a) * 2, 0, Math.sin(a) * 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x8878a8, transparent: true, opacity: 0 })
      );
      line.visible = false;
      line.position.y = -6.5;
      this.scene.add(line);
      this.ringPool.push(line);
    }
  }

  private spawnRing() {
    const line = this.ringPool.find((r) => !r.visible);
    if (!line) return;
    line.visible = true;
    line.scale.setScalar(1);
    (line.material as THREE.LineBasicMaterial).opacity = 0.12;
    this.whisperRings.push({ mesh: line, age: 0, max: 3.5 + Math.random() });
  }

  private createConstructs() {
    [2.2, 3.4, 4.8].forEach((size, i) => {
      const geo = new THREE.BoxGeometry(size, size, size);
      const wire = new THREE.WireframeGeometry(geo);
      const mesh = new THREE.LineSegments(
        wire,
        new THREE.LineBasicMaterial({
          color: 0x7888a0,
          transparent: true,
          opacity: 0.07,
        })
      );
      mesh.position.set(6 + i * 0.5, 1 - i, -3);
      this.scene.add(mesh);
      this.constructs.push({
        mesh,
        base: size,
        speed: new THREE.Vector3(
          0.015 + i * 0.008,
          0.012 + i * 0.006,
          0.01 + i * 0.005
        ),
      });
    });
  }

  private createShellWire() {
    const pts = [
      0, 3.2, 0, 0, 2.6, 0,
      0, 2.8, 0, -1.8, 1.8, 0,
      -1.8, 1.8, 0, -2.2, 0.2, 0,
      0, 2.8, 0, 1.8, 1.8, 0,
      1.8, 1.8, 0, 2.2, 0.2, 0,
      0, 2.6, 0, 0, 0.5, 0,
      0, 0.5, 0, -1.1, -2.2, 0,
      0, 0.5, 0, 1.1, -2.2, 0,
      -1.1, -2.2, 0, -1.2, -4.2, 0,
      1.1, -2.2, 0, 1.2, -4.2, 0,
      0, 3.0, 0, -0.5, 3.1, 0,
      0, 3.0, 0, 0.5, 3.1, 0,
    ];
    this.shellBase = new Float32Array(pts);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.shellBase.slice(), 3));
    this.shellWire = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x9088b0, transparent: true, opacity: 0.1 })
    );
    this.shellWire.position.set(-7, -1, -2);
    this.scene.add(this.shellWire);
  }

  private createNeuralWeb() {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      this.neuralNodes.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * 9,
        (Math.random() - 0.5) * 8,
        Math.sin(phi) * Math.sin(theta) * 9 - 5
      ));
    }
    const edges: number[] = [];
    const seen = new Set<string>();
    this.neuralNodes.forEach((a, i) => {
      const near: { j: number; d: number }[] = [];
      this.neuralNodes.forEach((b, j) => {
        if (i === j) return;
        const d = a.distanceTo(b);
        if (d < 7) near.push({ j, d });
      });
      near.sort((x, y) => x.d - y.d);
      near.slice(0, 2).forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        this.neuralEdges.push({ a: i, b: j });
        const b = this.neuralNodes[j];
        edges.push(a.x, a.y, a.z, b.x, b.y, b.z);
      });
    });
    this.neuralBase = this.neuralNodes.map((n) => n.clone());
    this.neuralVerts = new Float32Array(edges);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.neuralVerts, 3));
    this.neuralLines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x7088a8, transparent: true, opacity: 0.06 })
    );
    this.scene.add(this.neuralLines);
  }

  private createDataArcs() {
    for (let i = 0; i < 6; i++) {
      const verts = new Float32Array(32 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x8898b0, transparent: true, opacity: 0.08 })
      );
      this.scene.add(line);
      this.dataArcs.push({ line, t0: Math.random() * 10, t1: Math.random() * 10, phase: i * 0.7 });
    }
  }

  private createBurstPool() {
    for (let i = 0; i < 5; i++) {
      const rays = 8;
      const verts = new Float32Array(rays * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const lines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          color: 0xa888c0,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
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
      const a = baseAngle + (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const tilt = (Math.random() - 0.5) * 0.8;
      const len = 2 + Math.random() * 3;
      v[i * 6] = 0;
      v[i * 6 + 1] = 0;
      v[i * 6 + 2] = 0;
      v[i * 6 + 3] = Math.cos(a) * Math.cos(tilt) * len;
      v[i * 6 + 4] = Math.sin(tilt) * len;
      v[i * 6 + 5] = Math.sin(a) * Math.cos(tilt) * len;
    }
    attr.needsUpdate = true;
    burst.visible = true;
    burst.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      -4
    );
    (burst.material as THREE.LineBasicMaterial).opacity = 0.2;
    this.iceBursts.push({ lines: burst, age: 0, max: 0.6 + Math.random() * 0.4 });
  }

  private bindEvents() {
    const { signal } = this.events;
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (this.destroyed) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.targetScroll = max > 0 ? window.scrollY / max : 0;
      this.scrollVel = window.scrollY - lastY;
      this.lastScrollY = window.scrollY;
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

  private contentFocus(): number {
    let focus = 0;
    for (const el of this.sectionEls) {
      if (el.id !== 'dossier' && el.id !== 'clearance') continue;
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      focus = Math.max(focus, Math.max(0, 1 - dist * 1.15));
    }
    return focus;
  }

  private updateKnot(t: number, amp: number) {
    const attr = this.knot.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.knot.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const cols = colAttr.array as Float32Array;
    const breathe = 1 + Math.sin(t * 0.5) * 0.04 * amp;
    const warp = 0.12 * amp;

    for (let i = 0; i < this.knotBase.length; i += 3) {
      const bx = this.knotBase[i];
      const by = this.knotBase[i + 1];
      const bz = this.knotBase[i + 2];
      const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      const w = Math.sin(t * 0.8 + i * 0.06) * warp;
      arr[i] = (bx + (bx / len) * w) * breathe;
      arr[i + 1] = (by + (by / len) * w) * breathe;
      arr[i + 2] = (bz + (bz / len) * w) * breathe;

      const c = paletteAt(t * 0.04 + i / this.knotBase.length);
      cols[i] = c.r;
      cols[i + 1] = c.g;
      cols[i + 2] = c.b;
    }
    attr.needsUpdate = true;
    colAttr.needsUpdate = true;

    this.knot.rotation.y = t * 0.08 * amp;
    this.knot.rotation.x = Math.sin(t * 0.2) * 0.12 * amp;
    (this.knot.material as THREE.LineBasicMaterial).opacity = 0.12 + amp * 0.14;

    this.echoRot += 0.006 * amp;
    this.echoRotLag += (this.echoRot - this.echoRotLag) * 0.04;
    this.ghostEcho.rotation.set(
      Math.sin(t * 0.15) * 0.1,
      this.echoRotLag,
      Math.cos(t * 0.12) * 0.08
    );
    this.ghostEcho.position.set(
      Math.sin(t * 0.2) * 0.3,
      Math.cos(t * 0.25) * 0.2,
      Math.sin(t * 0.18) * 0.25
    );
    (this.ghostEcho.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05;
  }

  private updateIceColumns(t: number, amp: number) {
    this.iceColumns.forEach((col) => {
      const attr = col.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const v = attr.array as Float32Array;
      const scroll = ((t * col.speed + col.phase) % 24) - 12;
      const h = 4 + Math.sin(t * 0.5 + col.phase) * 1.5;
      v[0] = 0; v[1] = scroll; v[2] = 0;
      v[3] = 0; v[4] = scroll + h; v[5] = 0;
      attr.needsUpdate = true;
      (col.line.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.06;
    });
  }

  private updateOrbitRings(t: number, amp: number) {
    this.orbitRings.forEach((ring, i) => {
      ring.line.rotation.y = t * ring.speed * amp;
      ring.line.rotation.z = ring.tilt + Math.sin(t * 0.3 + i) * 0.08;
      (ring.line.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05;
    });
  }

  private updateFilamentPulses(dt: number, amp: number) {
    this.pulseTimer += dt;
    if (this.pulseTimer > 0.55 - amp * 0.2) {
      this.pulseTimer = 0;
      this.spawnFilamentPulse();
    }
    this.filamentPulses = this.filamentPulses.filter((p) => {
      p.t += dt * (0.35 + amp * 0.25);
      if (p.t >= 1) { p.mesh.visible = false; return false; }
      const fil = this.filaments[p.filIdx];
      if (!fil) { p.mesh.visible = false; return false; }
      const attr = fil.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const idx = Math.floor(p.t * (verts.length / 3 - 1));
      p.mesh.position.set(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - Math.abs(p.t - 0.5) * 1.8);
      return true;
    });
  }

  private updateFilaments(t: number, amp: number) {
    this.filaments.forEach((fil, ai) => {
      const attr = fil.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = fil.line.geometry.getAttribute('color') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const cols = colAttr.array as Float32Array;
      const orbit = (ai / this.filaments.length) * Math.PI * 2;
      const spread = 8 + ai * 2;

      for (let i = 0; i < fil.phases.length; i++) {
        const p = i / (fil.phases.length - 1);
        const wave = Math.sin(t * 0.45 + fil.phases[i] + p * 3) * 1.2 * amp;
        const twist = p * Math.PI * 2.5 + t * 0.18 * amp + orbit;
        verts[i * 3] = Math.cos(twist) * spread * (0.4 + p * 0.6) + wave;
        verts[i * 3 + 1] = (p - 0.5) * 16 + wave * 0.6;
        verts[i * 3 + 2] = Math.sin(twist) * spread * (0.4 + p * 0.6) - 5;
        const c = paletteAt(t * 0.05 + p * 0.4 + ai * 0.1);
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
      }
      attr.needsUpdate = true;
      colAttr.needsUpdate = true;
      (fil.line.material as THREE.LineBasicMaterial).opacity = 0.06 + amp * 0.1;
    });
  }

  private updateParticles(t: number, amp: number) {
    const n = this.particlePos.length / 3;
    const mx = this.smoothMouse.x * 8;
    const my = this.smoothMouse.y * 4;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const bx = this.particleBase[i3];
      const by = this.particleBase[i3 + 1];
      const bz = this.particleBase[i3 + 2];
      const dx = mx - bx;
      const dy = my - by;
      const pull = 0.012 * amp;
      this.particlePos[i3] = bx + dx * pull + Math.cos(t * 0.25 + i * 0.15) * 0.4;
      this.particlePos[i3 + 1] = by + dy * pull + Math.sin(t * 0.3 + i * 0.2) * 0.35;
      this.particlePos[i3 + 2] = bz + Math.sin(t * 0.2 + i * 0.1) * 0.25;
    }
    (this.particles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 0.15 + amp * 0.22;
  }

  private updateConstructs(t: number, amp: number) {
    this.constructs.forEach((c, i) => {
      c.mesh.rotation.x = t * c.speed.x * amp;
      c.mesh.rotation.y = t * c.speed.y * amp * (i % 2 === 0 ? 1 : -1);
      c.mesh.rotation.z = t * c.speed.z * amp;
      const pulse = 1 + Math.sin(t * 0.6 + i) * 0.06 * amp;
      c.mesh.scale.setScalar(pulse);
      (c.mesh.material as THREE.LineBasicMaterial).opacity = 0.04 + amp * 0.06;
    });
  }

  private updateShellWire(t: number, amp: number) {
    const attr = this.shellWire.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const sway = 0.15 * amp;
    for (let i = 0; i < this.shellBase.length; i += 3) {
      const bx = this.shellBase[i];
      const by = this.shellBase[i + 1];
      const bz = this.shellBase[i + 2];
      arr[i] = bx + Math.sin(t * 0.5 + by * 0.3) * sway;
      arr[i + 1] = by + Math.cos(t * 0.4 + bx * 0.2) * sway * 0.5;
      arr[i + 2] = bz;
    }
    attr.needsUpdate = true;
    this.shellWire.rotation.y = Math.sin(t * 0.15) * 0.12;
    (this.shellWire.material as THREE.LineBasicMaterial).opacity = 0.05 + amp * 0.08;
  }

  private updateNeuralWeb(t: number, amp: number) {
    this.neuralBase.forEach((base, i) => {
      const n = this.neuralNodes[i];
      n.set(
        base.x + Math.sin(t * 0.45 + i * 0.6) * 0.35 * amp,
        base.y + Math.cos(t * 0.5 + i * 0.4) * 0.3 * amp,
        base.z + Math.sin(t * 0.35 + i * 0.5) * 0.25 * amp
      );
    });
    this.neuralEdges.forEach((e, ei) => {
      const a = this.neuralNodes[e.a];
      const b = this.neuralNodes[e.b];
      const o = ei * 6;
      this.neuralVerts[o] = a.x;
      this.neuralVerts[o + 1] = a.y;
      this.neuralVerts[o + 2] = a.z;
      this.neuralVerts[o + 3] = b.x;
      this.neuralVerts[o + 4] = b.y;
      this.neuralVerts[o + 5] = b.z;
    });
    (this.neuralLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.neuralLines.material as THREE.LineBasicMaterial).opacity = 0.03 + amp * 0.05;
  }

  private updateDataArcs(t: number, amp: number) {
    this.dataArcs.forEach((arc) => {
      const attr = arc.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const verts = attr.array as Float32Array;
      const segs = verts.length / 3;
      const ax = Math.sin(t * 0.3 + arc.phase) * 12;
      const ay = Math.cos(t * 0.25 + arc.phase) * 6;
      const az = -5 + Math.sin(t * 0.2) * 3;
      const bx = Math.cos(t * 0.35 + arc.t0) * 14;
      const by = Math.sin(t * 0.4 + arc.t1) * 8 - 2;
      const bz = -8 + Math.cos(t * 0.15) * 4;
      for (let i = 0; i < segs; i++) {
        const p = i / (segs - 1);
        const lift = Math.sin(p * Math.PI) * 3 * amp;
        verts[i * 3] = ax + (bx - ax) * p + Math.sin(p * 8 + t) * 0.4;
        verts[i * 3 + 1] = ay + (by - ay) * p + lift;
        verts[i * 3 + 2] = az + (bz - az) * p;
      }
      attr.needsUpdate = true;
      (arc.line.material as THREE.LineBasicMaterial).opacity = 0.04 + amp * 0.07;
    });
  }

  private updateIceBursts(dt: number, amp: number) {
    this.burstTimer += dt;
    if (this.burstTimer > 1.8 - amp * 0.6) {
      this.burstTimer = 0;
      this.spawnIceBurst();
    }
    this.iceBursts = this.iceBursts.filter((b) => {
      b.age += dt;
      const f = b.age / b.max;
      b.lines.scale.setScalar(1 + f * 2.5);
      (b.lines.material as THREE.LineBasicMaterial).opacity = 0.22 * (1 - f) * amp;
      if (b.age >= b.max) { b.lines.visible = false; return false; }
      return true;
    });
  }

  private updateGrid(t: number, amp: number) {
    const sgs = this.gridSegs;
    const span = 60;
    let vi = 0;
    for (let x = 0; x < sgs; x++) {
      for (let z = 0; z < sgs; z++) {
        const px = (x / sgs - 0.5) * span;
        const pz = (z / sgs - 0.5) * span - 8;
        const wave = Math.sin(px * 0.12 + t * 0.5) * Math.cos(pz * 0.1 - t * 0.4) * 0.8 * amp;
        if (x < sgs - 1) {
          const px2 = ((x + 1) / sgs - 0.5) * span;
          const y2 = Math.sin(px2 * 0.12 + t * 0.5) * Math.cos(pz * 0.1 - t * 0.4) * 0.8 * amp;
          this.gridVerts[vi++] = px;
          this.gridVerts[vi++] = wave;
          this.gridVerts[vi++] = pz;
          this.gridVerts[vi++] = px2;
          this.gridVerts[vi++] = y2;
          this.gridVerts[vi++] = pz;
        }
        if (z < sgs - 1) {
          const pz2 = ((z + 1) / sgs - 0.5) * span - 8;
          const y2 = Math.sin(px * 0.12 + t * 0.5) * Math.cos(pz2 * 0.1 - t * 0.4) * 0.8 * amp;
          this.gridVerts[vi++] = px;
          this.gridVerts[vi++] = wave;
          this.gridVerts[vi++] = pz;
          this.gridVerts[vi++] = px;
          this.gridVerts[vi++] = y2;
          this.gridVerts[vi++] = pz2;
        }
      }
    }
    (this.grid.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.grid.material as THREE.LineBasicMaterial).opacity = 0.025 + amp * 0.04;
  }

  private updateRings(dt: number, amp: number) {
    this.ringTimer += dt;
    if (this.ringTimer > 2.2 - amp * 0.8) {
      this.ringTimer = 0;
      this.spawnRing();
    }
    this.whisperRings = this.whisperRings.filter((r) => {
      r.age += dt;
      const f = r.age / r.max;
      r.mesh.scale.setScalar(1 + f * 14);
      const c = paletteAt(f * 0.5);
      (r.mesh.material as THREE.LineBasicMaterial).color.copy(c);
      (r.mesh.material as THREE.LineBasicMaterial).opacity = 0.1 * (1 - f) * amp;
      if (r.age >= r.max) { r.mesh.visible = false; return false; }
      return true;
    });
  }

  private updateCamera(s: number, focus: number, dt: number) {
    const mx = this.smoothMouse.x;
    const my = this.smoothMouse.y;
    const orbit = this.time * 0.06 * (1 - focus * 0.5) + s * Math.PI * 0.35;
    const radius = 20 - s * 4 - focus * 3;
    const height = 2.5 + my * 1.2 + s * 1.5;

    this.camera.position.x = Math.sin(orbit) * radius + mx * 2;
    this.camera.position.z = Math.cos(orbit) * radius;
    this.camera.position.y = height;
    this.camera.lookAt(mx, my * 0.4, -3);

    const targetFov = 48 + s * 6 - focus * 4;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(dt * 2, 1);
    this.camera.updateProjectionMatrix();
  }

  private updateScene(s: number, t: number, dt: number, focus: number) {
    if (this.reducedMotion) return;

    const amp = (1 - focus * 0.55) * (0.65 + Math.sin(s * Math.PI) * 0.35);
    const calmT = t * (1 - focus * 0.45);

    this.updateKnot(calmT, amp);
    this.updateHelix(calmT, amp);
    this.updateFilaments(calmT, amp);
    this.updateIceColumns(calmT, amp);
    this.updateOrbitRings(calmT, amp);
    this.updateFilamentPulses(dt, amp);
    this.updateParticles(calmT, amp);
    this.updateConstructs(calmT, amp);
    this.updateShellWire(calmT, amp);
    this.updateNeuralWeb(calmT, amp);
    this.updateDataArcs(calmT, amp);
    this.updateIceBursts(dt, amp);
    this.updateGrid(calmT, amp);
    this.updateRings(dt, amp);

    (this.scene.fog as THREE.FogExp2).density = 0.007 + focus * 0.002;
  }

  private updateUI(s: number) {
    const targetFocus = this.contentFocus();
    this.smoothFocus += (targetFocus - this.smoothFocus) * 0.07;

    const hue = Math.floor(this.time * 12 + s * 60) % 360;
    const blur = this.smoothFocus * 4;
    const bloom = (1 - this.smoothFocus) * 0.4;

    document.documentElement.style.setProperty('--parallax', `${(this.smoothMouse.y * 6).toFixed(1)}px`);
    document.documentElement.style.setProperty('--dive', String(s));
    document.documentElement.style.setProperty('--vel', String(Math.min(Math.abs(this.smoothScrollVel) * 0.02, 1)));
    document.documentElement.style.setProperty('--hue', String(hue));
    document.documentElement.style.setProperty('--bloom', String(bloom));
    document.documentElement.style.setProperty('--focus', String(this.smoothFocus));
    document.documentElement.style.setProperty('--bg-blur', String(blur));
    document.documentElement.style.setProperty('--pulse', String(0.5 + Math.sin(this.time * 1.2) * 0.5));
    document.documentElement.style.setProperty('--scan', String(this.smoothFocus));
    document.documentElement.style.setProperty('--tilt', `${(this.smoothMouse.x * 4).toFixed(2)}deg`);

    this.sectionEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const v = Math.max(0, 1 - dist * 1.25);
      el.style.setProperty('--reveal', String(v));
      el.classList.toggle('is-active', this.sectionIsActive(el.id, v));

      const isSticky = Section9Scene.STICKY_SECTIONS.has(el.id);
      const ease = v * v * (3 - 2 * v);
      el.style.setProperty('--section-reveal', isSticky ? '1' : String(ease));

      if (!isSticky) {
        el.querySelectorAll<HTMLElement>('.stat-block, .clearance-card, .vector-tag, .sector-tag, .quote').forEach((child, i) => {
          const stagger = i * 0.06;
          const cv = Math.max(0, Math.min(1, (v - stagger) / (1 - stagger)));
          const ce = cv * cv * (3 - 2 * cv);
          child.style.setProperty('--child-reveal', String(ce));
          child.style.setProperty('--child-shift', `${(1 - ce) * (i % 2 === 0 ? -10 : 10)}px`);
        });
      }
    });

    const hudFrame = document.querySelector('.hud-frame');
    if (hudFrame) {
      (hudFrame as HTMLElement).style.opacity = String(0.35 + (1 - this.smoothFocus) * 0.35);
    }

    if (this.syncReadout) {
      const state = this.smoothFocus > 0.5
        ? 'FOCUS:shell'
        : this.hudStates[Math.floor(this.time * 0.35) % this.hudStates.length];
      this.syncReadout.textContent = state;
    }
    if (this.depthReadout) {
      this.depthReadout.textContent = this.smoothFocus > 0.35
        ? `ICE:${Math.floor(this.smoothFocus * 100).toString().padStart(3, '0')}`
        : `NET:${hue.toString().padStart(3, '0')}`;
    }
  }

  private animate() {
    if (this.destroyed || !this.sceneReady) return;
    requestAnimationFrame(() => this.animate());
    if (!this.visible) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time = this.clock.getElapsedTime();
    this.scroll += (this.targetScroll - this.scroll) * 0.06;
    this.smoothMouse.lerp(this.mouse, 0.06);
    this.smoothScrollVel += (this.scrollVel - this.smoothScrollVel) * 0.14;
    this.scrollVel *= 0.85;

    this.updateCamera(this.scroll, this.smoothFocus, dt);
    this.updateScene(this.scroll, this.time, dt, this.smoothFocus);
    this.updateUI(this.scroll);
    this.renderer.render(this.scene, this.camera);
  }
}

