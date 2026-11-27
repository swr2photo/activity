"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * อะตอมจำลองตามหลักฟิสิกส์ (Canvas 2D)
 *
 * - อิเล็กตรอนโคจรด้วยแรงสู่ศูนย์กลางแบบผกผันกำลังสอง (F ∝ 1/r²) อินทิเกรตแบบ velocity-Verlet
 *   → วงโคจรรีตามกฎของเคปเลอร์ วิ่งเร็วขึ้นเมื่อเข้าใกล้นิวเคลียส (กฎข้อ 2: กวาดพื้นที่เท่ากันในเวลาเท่ากัน)
 * - ระนาบวงโคจรเอียงใน 3 มิติ (inclination / node / argument of periapsis) + มุมมองแบบ perspective
 *   วัตถุที่อยู่หลังนิวเคลียสถูกบัง/หรี่ลงตามความลึก
 * - นิวเคลียสประกอบจากโปรตอน/นิวตรอนทรงกลมแรเงาตามทิศแสง สั่นเล็กน้อยแบบความร้อน
 * - มุมกล้องตามตำแหน่งเมาส์ด้วยสปริงหน่วง (damped spring) ไม่กระตุก
 * - หยุดวาดเมื่อเลื่อนพ้นจอ/สลับแท็บ และแสดงภาพนิ่งเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว
 */

type Vec3 = [number, number, number];

type Electron = {
  a: number; // semi-major axis
  e: number; // eccentricity
  inc: number;
  node: number;
  argp: number;
  // สถานะในระนาบวงโคจร
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Vec3[];
  hue: number;
};

type Nucleon = { p: Vec3; proton: boolean; phase: number; freq: number };

const GM = 1.6; // ค่าคงที่แรงดึงดูด (หน่วยจำลอง) → คาบ ~3–6 วินาที
const DT = 1 / 240; // ขั้นเวลาคงที่ของการอินทิเกรต (เสถียรกว่า dt ตามเฟรม)
const CAM_DIST = 3.4;
const TRAIL_LEN = 34;

const rotX = ([x, y, z]: Vec3, a: number): Vec3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z]: Vec3, a: number): Vec3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z]: Vec3, a: number): Vec3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

/** จุดในระนาบวงโคจร → พิกัด 3D ตามธาตุวงโคจร (ω, i, Ω) */
const orbitTo3D = (el: Electron, x: number, y: number): Vec3 => rotZ(rotX(rotZ([x, y, 0], el.argp), el.inc), el.node);

function makeElectron(a: number, e: number, inc: number, node: number, argp: number, hue: number, phase: number): Electron {
  // เริ่มที่จุดใกล้สุด (periapsis) ด้วยความเร็วตามสมการ vis-viva แล้วเดินเวลาไปตาม phase
  const rp = a * (1 - e);
  const vp = Math.sqrt((GM * (1 + e)) / (a * (1 - e)));
  const el: Electron = { a, e, inc, node, argp, x: rp, y: 0, vx: 0, vy: vp, trail: [], hue };
  const period = 2 * Math.PI * Math.sqrt((a * a * a) / GM);
  const steps = Math.floor((phase * period) / DT);
  for (let i = 0; i < steps; i++) step(el);
  return el;
}

/** velocity-Verlet หนึ่งขั้น สำหรับแรงสู่ศูนย์กลาง a = -GM r̂ / r² */
function step(el: Electron) {
  const r2 = el.x * el.x + el.y * el.y;
  const r3 = r2 * Math.sqrt(r2);
  const ax = (-GM * el.x) / r3;
  const ay = (-GM * el.y) / r3;
  el.x += el.vx * DT + 0.5 * ax * DT * DT;
  el.y += el.vy * DT + 0.5 * ay * DT * DT;
  const nr2 = el.x * el.x + el.y * el.y;
  const nr3 = nr2 * Math.sqrt(nr2);
  const nax = (-GM * el.x) / nr3;
  const nay = (-GM * el.y) / nr3;
  el.vx += 0.5 * (ax + nax) * DT;
  el.vy += 0.5 * (ay + nay) * DT;
}

function makeNucleus(): Nucleon[] {
  // กระจายนิวคลีออนบนทรงกลมด้วย Fibonacci sphere + 1 ตัวกลาง ให้ดูแน่นเป็นก้อน
  const n = 13;
  const out: Nucleon[] = [{ p: [0, 0, 0], proton: true, phase: 0, freq: 7 }];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const R = 0.12;
    out.push({
      p: [Math.cos(th) * r * R, y * R, Math.sin(th) * r * R],
      proton: i % 2 === 0,
      phase: i * 1.7,
      freq: 6 + (i % 5),
    });
  }
  return out;
}

export default function PhysicsAtom({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2);

    const electrons: Electron[] = [
      makeElectron(0.7, 0.42, 1.15, 0.2, 0.4, 195, 0.0),
      makeElectron(0.86, 0.3, 0.55, 2.3, 1.7, 165, 0.35),
      makeElectron(0.98, 0.48, 1.65, 4.1, 2.9, 210, 0.7),
    ];
    const nucleus = makeNucleus();

    // ทางโคจรเชิงวิเคราะห์ (ไว้วาดเส้นวงรีจาง ๆ)
    const orbitPaths: Vec3[][] = electrons.map((el) => {
      const pts: Vec3[] = [];
      for (let k = 0; k <= 72; k++) {
        const th = (k / 72) * Math.PI * 2;
        const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(th));
        pts.push(orbitTo3D(el, r * Math.cos(th), r * Math.sin(th)));
      }
      return pts;
    });

    let w = 0;
    let h = 0;
    let scale = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(w, h) * 0.44;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // กล้อง: yaw หมุนช้า ๆ + เอียงตามเมาส์ด้วยสปริงหน่วง
    const cam = { yaw: 0.4, pitch: -0.32, vYaw: 0, vPitch: 0, tYaw: 0, tPitch: -0.32 };
    const onPointer = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      cam.tYaw = nx * 0.9;
      cam.tPitch = -0.32 + ny * 0.5;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const project = (p: Vec3, spin: number): { x: number; y: number; z: number; s: number } => {
      let q = rotY(p, spin + cam.yaw);
      q = rotX(q, cam.pitch);
      const s = CAM_DIST / (CAM_DIST + q[2]);
      return { x: w / 2 + q[0] * scale * s, y: h / 2 + q[1] * scale * s, z: q[2], s };
    };

    const drawSphere = (x: number, y: number, r: number, light: string, mid: string, dark: string, alpha: number) => {
      const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
      g.addColorStop(0, light);
      g.addColorStop(0.45, mid);
      g.addColorStop(1, dark);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    let spin = 0;
    let simTime = 0;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let running = false;

    const frame = (now: number) => {
      const dtReal = Math.min(0.05, (now - last) / 1000);
      last = now;

      // ── ฟิสิกส์ ──
      acc += dtReal;
      let steps = 0;
      while (acc >= DT && steps < 24) {
        for (const el of electrons) step(el);
        acc -= DT;
        steps++;
      }
      simTime += dtReal;
      spin += dtReal * 0.16;
      // สปริงหน่วงวิกฤตเกือบพอดี (k=10, ζ≈0.8)
      const k = 10;
      const c = 2 * Math.sqrt(k) * 0.8;
      cam.vYaw += (k * (cam.tYaw - cam.yaw) - c * cam.vYaw) * dtReal;
      cam.vPitch += (k * (cam.tPitch - cam.pitch) - c * cam.vPitch) * dtReal;
      cam.yaw += cam.vYaw * dtReal;
      cam.pitch += cam.vPitch * dtReal;

      for (const el of electrons) {
        el.trail.push(orbitTo3D(el, el.x, el.y));
        if (el.trail.length > TRAIL_LEN) el.trail.shift();
      }

      // ── วาด ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      // แสงเรืองรอบนิวเคลียส
      const halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, scale * 0.9);
      halo.addColorStop(0, "rgba(56,189,248,0.22)");
      halo.addColorStop(0.35, "rgba(14,116,144,0.08)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // เส้นวงโคจร: ความทึบตามความลึก (ไกล = จาง)
      ctx.lineWidth = 1.1;
      for (let o = 0; o < orbitPaths.length; o++) {
        const pts = orbitPaths[o].map((p) => project(p, spin));
        for (let i = 1; i < pts.length; i++) {
          const z = (pts[i].z + pts[i - 1].z) / 2;
          ctx.globalAlpha = 0.08 + 0.22 * (1 - (z + 1) / 2);
          ctx.strokeStyle = `hsl(${electrons[o].hue} 90% 72%)`;
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }

      // รวบรวมวัตถุแล้วเรียงตามความลึก (ไกล → ใกล้) เพื่อบังกันอย่างถูกต้อง
      const items: { z: number; draw: () => void }[] = [];

      for (const nu of nucleus) {
        const j = 0.006;
        const p: Vec3 = [
          nu.p[0] + j * Math.sin(simTime * nu.freq + nu.phase),
          nu.p[1] + j * Math.sin(simTime * (nu.freq + 1.3) + nu.phase * 1.4),
          nu.p[2] + j * Math.cos(simTime * (nu.freq - 0.7) + nu.phase),
        ];
        const pr = project(p, spin);
        items.push({
          z: pr.z,
          draw: () => {
            const r = 0.058 * scale * pr.s;
            if (nu.proton) drawSphere(pr.x, pr.y, r, "#ffd0bd", "#f0623f", "#7a1d12", 1);
            else drawSphere(pr.x, pr.y, r, "#e6eefc", "#7f9cc7", "#1f3354", 1);
          },
        });
      }

      for (const el of electrons) {
        const head = project(el.trail[el.trail.length - 1], spin);
        items.push({
          z: head.z,
          draw: () => {
            // หางแสง: บางและจางลงตามอายุ
            ctx.globalCompositeOperation = "lighter";
            const tr = el.trail.map((p) => project(p, spin));
            for (let i = 1; i < tr.length; i++) {
              const f = i / tr.length;
              ctx.globalAlpha = f * f * 0.55;
              ctx.strokeStyle = `hsl(${el.hue} 95% 68%)`;
              ctx.lineWidth = 0.5 + f * 2.6 * tr[i].s;
              ctx.beginPath();
              ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
              ctx.lineTo(tr[i].x, tr[i].y);
              ctx.stroke();
            }
            const depth = 0.55 + 0.45 * (1 - (head.z + 1) / 2);
            const r = 0.026 * scale * head.s;
            const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 5);
            glow.addColorStop(0, `hsla(${el.hue}, 100%, 75%, ${0.75 * depth})`);
            glow.addColorStop(1, `hsla(${el.hue}, 100%, 60%, 0)`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(head.x, head.y, r * 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            drawSphere(head.x, head.y, r, "#ffffff", `hsl(${el.hue} 95% 70%)`, `hsl(${el.hue} 80% 35%)`, depth);
          },
        });
      }

      items.sort((a, b) => b.z - a.z);
      for (const it of items) it.draw();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    if (reduceMotion) {
      // ภาพนิ่ง: เดินเวลาไปเล็กน้อยให้มีหางแสง แล้ววาดเฟรมเดียว
      for (let i = 0; i < TRAIL_LEN; i++) {
        for (let s = 0; s < 4; s++) electrons.forEach(step);
        electrons.forEach((el) => el.trail.push(orbitTo3D(el, el.x, el.y)));
      }
      frame(performance.now());
    }

    let visible = true;
    const sync = () => (visible && document.visibilityState === "visible" ? start() : stop());
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none block h-full w-full", className)}
    />
  );
}
