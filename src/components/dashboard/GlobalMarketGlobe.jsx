import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import GlobalMarketDataOverlay from "@/components/dashboard/GlobalMarketDataOverlay";
import { mt5Api } from "@/lib/mt5Api";

const CITIES = [
  { name: "New York", lat: 40.71, lon: -74.01, session: "New York Session", time: "08:00–17:00 ET" },
  { name: "London", lat: 51.51, lon: -0.13, session: "London Session", time: "08:00–17:00 GMT" },
  { name: "Tokyo", lat: 35.68, lon: 139.65, session: "Tokyo Session", time: "09:00–18:00 JST" },
  { name: "Singapore", lat: 1.35, lon: 103.82, session: "Singapore Session", time: "09:00–17:00 SGT" },
  { name: "Frankfurt", lat: 50.11, lon: 8.68, session: "Frankfurt Session", time: "08:00–17:00 CET" },
  { name: "Dubai", lat: 25.2, lon: 55.27, session: "Dubai Session", time: "10:00–18:00 GST" },
  { name: "Sydney", lat: -33.87, lon: 151.21, session: "Sydney Session", time: "10:00–17:00 AEST" },
];

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100"];
const ARCS = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [0, 6], [3, 5], [0, 4], [2, 6]];

function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

export default function GlobalMarketGlobe({ connected, navigate }) {
  const mountRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [focus, setFocus] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [data, setData] = useState({
    prices: {}, atr: null, spread: null, rsi: null, emaTrend: "Neutral",
    session: "—", confidence: 0, volume: 0, aiScore: 0, live: false,
  });

  const pausedRef = useRef(false); pausedRef.current = paused;
  const connectedRef = useRef(false); connectedRef.current = connected;

  // ── 3D scene (built once) ──
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = () => mount.clientWidth;
    const H = () => mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 100);
    camera.position.set(0, 0.5, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    mount.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);

    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x0a0000, transparent: true, opacity: 0.92 })
    ));
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 36, 28),
      new THREE.MeshBasicMaterial({ color: 0xcc1818, wireframe: true, transparent: true, opacity: 0.22 })
    ));
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 36, 36),
      new THREE.MeshBasicMaterial({ color: 0xff3838, transparent: true, opacity: 0.07, side: THREE.BackSide, blending: THREE.AdditiveBlending })
    ));

    // City nodes
    const cityMeshes = [];
    CITIES.forEach((c, i) => {
      const v = latLonToVec3(c.lat, c.lon, 1.01);
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xff3838 })
      );
      node.position.copy(v);
      node.userData.cityIndex = i;
      globe.add(node);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xff3838, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending })
      );
      halo.position.copy(v);
      globe.add(halo);
      cityMeshes.push({ node, halo, v });
    });

    // Connection arcs + traveling pulses
    const pulses = [];
    ARCS.forEach(([a, b]) => {
      const va = cityMeshes[a].v, vb = cityMeshes[b].v;
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const len = va.distanceTo(vb);
      mid.normalize().multiplyScalar(1 + len * 0.32);
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
      globe.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        new THREE.LineBasicMaterial({ color: 0x00ff9d, transparent: true, opacity: 0.35 })
      ));
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x00ff9d, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 })
      );
      globe.add(pulse);
      pulses.push({ curve, pulse, t: Math.random(), speed: 0.004 + Math.random() * 0.004 });
    });

    // Orbiting rings
    const rings = [];
    [[1.18, 0xff3838, 0.35], [1.3, 0x00ff9d, 0.28], [1.42, 0xff8c42, 0.22]].forEach(([r, col, op]) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.004, 8, 90),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      ring.rotation.y = Math.random() * Math.PI;
      scene.add(ring);
      rings.push({ mesh: ring, speed: (Math.random() - 0.5) * 0.004 });
    });

    // Particle field
    const pCount = reduceMotion ? 90 : 420;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 1.15 + Math.random() * 0.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pPos[i * 3 + 1] = r * Math.cos(ph);
      pPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xff3838, size: 0.018, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(particles);

    // Radar sweep
    const radar = new THREE.Mesh(
      new THREE.CircleGeometry(1.02, 32, 0, Math.PI / 7),
      new THREE.MeshBasicMaterial({ color: 0xff3838, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    radar.rotation.x = Math.PI / 2;
    scene.add(radar);

    // Interaction (drag to rotate + click cities)
    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onDown = (e) => {
      dragging = true; moved = 0;
      lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      lastY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const dx = x - lastX, dy = y - lastY;
      globe.rotation.y += dx * 0.006;
      globe.rotation.x = Math.max(-0.7, Math.min(0.7, globe.rotation.x + dy * 0.006));
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = x; lastY = y;
    };
    const onUp = (e) => {
      dragging = false;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.changedTouches?.[0]?.clientX ?? e.clientX ?? 0;
      const y = e.changedTouches?.[0]?.clientY ?? e.clientY ?? 0;
      pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(cityMeshes.map((c) => c.node));
      if (hits.length) setSelectedCity(CITIES[hits[0].object.userData.cityIndex]);
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const ro = new ResizeObserver(() => {
      camera.aspect = W() / H(); camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    });
    ro.observe(mount);

    let raf;
    const clock = new THREE.Clock();
    const baseAuto = reduceMotion ? 0 : 0.0016;
    const render = () => {
      raf = requestAnimationFrame(render);
      const t = clock.elapsedTime;
      if (!pausedRef.current) {
        globe.rotation.y += baseAuto;
        rings.forEach((r) => (r.mesh.rotation.z += r.speed));
        particles.rotation.y += 0.0006;
        radar.rotation.z += 0.02;
        cityMeshes.forEach((c, i) => {
          c.halo.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.25);
        });
        pulses.forEach((p) => {
          p.t += p.speed;
          if (p.t > 1) p.t = 0;
          p.pulse.position.copy(p.curve.getPoint(p.t));
        });
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  // ── Live market data feed (no demo / no fabricated values) ──
  useEffect(() => {
    let active = true;
    const fetchLive = async () => {
      try {
        const [scanRes, symRes] = await Promise.all([
          mt5Api.scannerStatus().catch(() => null),
          mt5Api.quotes ? mt5Api.quotes().catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        const ind = scanRes?.data?.scanner?.indicators || scanRes?.data?.indicators || {};
        const prices = {};
        const syms = symRes?.data?.symbols || (Array.isArray(symRes?.data) ? symRes.data : []);
        PAIRS.forEach((p) => {
          const s = syms.find((x) => (x.symbol || "").toUpperCase() === p);
          if (s && s.bid != null) prices[p] = Number(s.bid);
        });
        const atr = ind.atr_14 ?? ind.atr14 ?? null;
        const rsi = ind.rsi_14 ?? ind.rsi ?? null;
        const ema20 = ind.ema_20 ?? ind.ema20 ?? null;
        const ema50 = ind.ema_50 ?? ind.ema50 ?? null;
        const spread = ind.spread != null ? Number(ind.spread) : null;
        const emaTrend = ema20 && ema50 ? (ema20 > ema50 ? "Bullish" : ema20 < ema50 ? "Bearish" : "Neutral") : "Neutral";
        const aiScore = ind.adx ? Math.min(99, Math.round(Math.min(100, ind.adx * 2))) : 0;
        const hasLive = Object.keys(prices).length > 0;
        setData((d) => ({
          prices: hasLive ? prices : d.prices,
          atr: atr ?? d.atr,
          spread: spread ?? d.spread,
          rsi: rsi ?? d.rsi,
          emaTrend,
          session: hasLive ? "LIVE" : "—",
          confidence: aiScore,
          volume: ind.volume ?? 0,
          aiScore,
          live: hasLive,
        }));
      } catch { /* keep last real values */ }
    };
    fetchLive();
    const timer = setInterval(fetchLive, 12000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const status = data.live
    ? { label: "LIVE MARKET DATA", color: "#00ff9d" }
    : { label: "AWAITING LIVE DATA", color: "#ff3838" };

  return (
    <div
      className={`glass rounded-2xl overflow-hidden relative ${focus ? "fixed inset-0 z-[60] m-0 rounded-none" : ""}`}
      style={{ height: focus ? "100vh" : 440 }}
    >
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: "grab" }} />
      <GlobalMarketDataOverlay
        data={data}
        live={data.live}
        status={status}
        pairs={PAIRS}
        onPairClick={() => navigate?.("/ai-scanner")}
        selectedCity={selectedCity}
        onCloseCity={() => setSelectedCity(null)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onToggleFocus={() => setFocus((f) => !f)}
        focus={focus}
      />
    </div>
  );
}