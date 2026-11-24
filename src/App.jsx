import { useEffect, useRef, useState } from 'react';
import './index.css';

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const DENSITY_RAMP =
  ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

function hslToRgbString(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `rgb(${Math.round(f(0) * 255)},${Math.round(f(8) * 255)},${Math.round(
    f(4) * 255
  )})`;
}

const CHARACTERS = [
  {
    id: 'artem',
    name: 'Артём & Хомяк Филя',
    city: 'Витебск',
    lat: 55.19,
    lon: 30.2,
    angle: 0.0,
    color: '#38bdf8',
    distance: 'База • 0 км',
    message:
      'Держит связь из Витебска! Хомяк Филя накручивает круги в колесе и передаёт привет в Польшу.',
  },
  {
    id: 'alina',
    name: 'Алина & Попугай Кеша',
    city: 'Торунь',
    lat: 53.01,
    lon: 18.6,
    angle: 2.1,
    color: '#4ade80',
    distance: 'Витебск ↔ Торунь: 785 км',
    message:
      'Пряничный Торунь на связи! Кеша сидит на плече и громко чирикает на всю планету.',
  },
  {
    id: 'kira_ira',
    name: 'Кира, Ира & Собачка Эльза',
    city: 'Лодзь',
    lat: 51.75,
    lon: 19.45,
    angle: 4.2,
    color: '#f472b6',
    distance: 'Витебск ↔ Лодзь: 770 км',
    message:
      'Лодзь в эфире! Белая пушистая Эльза бегает по снегу вокруг елки и охраняет сестёр.',
  },
];

export default function App() {
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [forceSnow, setForceSnow] = useState(false);
  const [weatherMap, setWeatherMap] = useState({
    Витебск: { temp: '...', snow: false },
    Торунь: { temp: '...', snow: false },
    Лодзь: { temp: '...', snow: false },
  });

  const targetAngleRef = useRef(null);
  const selectedIdRef = useRef(null);
  const snowActiveRef = useRef(false);
  const screenTargetsRef = useRef([]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const anyRealSnow = Object.values(weatherMap).some((w) => w.snow);
  useEffect(() => {
    snowActiveRef.current = anyRealSnow || forceSnow;
  }, [anyRealSnow, forceSnow]);

  // Загрузка погоды
  useEffect(() => {
    const loadAllWeather = async () => {
      const updates = {};
      await Promise.all(
        CHARACTERS.map(async (ch) => {
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${ch.lat}&longitude=${ch.lon}&current=temperature_2m,weather_code`
            );
            const data = await res.json();
            const temp = Math.round(data.current.temperature_2m);
            const code = data.current.weather_code;
            updates[ch.city] = {
              temp: `${temp > 0 ? `+${temp}` : temp}°C`,
              snow: SNOW_CODES.has(code),
            };
          } catch {
            updates[ch.city] = { temp: '—', snow: false };
          }
        })
      );
      setWeatherMap((prev) => ({ ...prev, ...updates }));
    };

    loadAllWeather();
    const interval = setInterval(loadAllWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const focusCharacter = (charObj) => {
    if (selectedId === charObj.id) {
      setSelectedId(null);
      targetAngleRef.current = null;
      return;
    }
    setSelectedId(charObj.id);
    targetAngleRef.current = -charObj.angle - Math.PI / 2;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('canvasRef.current is null — <canvas> не отрендерен!');
      return;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    let animId;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let cellW = 5;
    let cellH = 8;

    const snowflakes = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.0007 + Math.random() * 0.002,
      sway: Math.random() * Math.PI * 2,
      char: ['*', '·', '+', '❄', '.'][Math.floor(Math.random() * 5)],
      alpha: 0.35 + Math.random() * 0.65,
      size: Math.random() > 0.78 ? 11 : 8,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isMobile = width < 640;
      cellH = isMobile ? 7 : 8;
      cellW = cellH * 0.58;
      cols = Math.floor(width / cellW);
      rows = Math.floor(height / cellH);
    };

    resize();
    window.addEventListener('resize', resize);

    const points = [];

    const GLOBE_R = 0.62;
    const GLOBE_Y = -0.68;

    // 1. Земной шар
    for (let phi = 0.04; phi < Math.PI - 0.04; phi += 0.032) {
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const stepTheta = Math.max(0.032, 0.032 / Math.max(0.2, sinP));

      for (let theta = 0; theta < Math.PI * 2; theta += stepTheta) {
        const nx = sinP * Math.cos(theta);
        const ny = cosP;
        const nz = sinP * Math.sin(theta);

        const continentNoise =
          Math.sin(theta * 2.1 + 0.5) * Math.cos(phi * 2.4) +
          0.45 * Math.sin(theta * 5.2 - phi * 3.1) +
          0.25 * Math.cos(theta * 9.0 + phi * 7.0);

        const isPolarSnow = phi < 0.68 + Math.sin(theta * 4) * 0.06;
        const isLand = continentNoise > 0.08;
        const isCityLight =
          isLand && !isPolarSnow && Math.sin(theta * 37 + phi * 53) > 0.94;

        points.push({
          x: nx * GLOBE_R,
          y: GLOBE_Y + ny * GLOBE_R,
          z: nz * GLOBE_R,
          nx,
          ny,
          nz,
          type: isPolarSnow
            ? 'globe_snow'
            : isCityLight
            ? 'globe_city'
            : isLand
            ? 'globe_land'
            : 'globe_ocean',
        });
      }
    }

    // 2. Ёлка
    const TREE_BASE_Y = GLOBE_Y + GLOBE_R * 0.88;
    const TREE_HEIGHT = 1.28;

    for (let y = TREE_BASE_Y; y <= TREE_BASE_Y + 0.14; y += 0.008) {
      for (let a = 0; a < Math.PI * 2; a += 0.15) {
        const r = 0.048;
        points.push({
          x: r * Math.cos(a),
          y,
          z: r * Math.sin(a),
          nx: Math.cos(a),
          ny: 0,
          nz: Math.sin(a),
          type: 'trunk',
        });
      }
    }

    const numTiers = 10;
    for (let t = 0; t < numTiers; t++) {
      const tierFrac = t / (numTiers - 1);
      const tierBaseY = TREE_BASE_Y + 0.08 + tierFrac * (TREE_HEIGHT - 0.14);
      const tierMaxLen = (1 - Math.pow(tierFrac, 0.85)) * 0.44 + 0.045;
      const branchesInTier = Math.max(5, Math.round(10 - tierFrac * 4));
      const tierAngleOffset = t * 1.18;

      for (let h = 0; h < 0.12; h += 0.012) {
        const coreR = tierMaxLen * 0.55 * (1 - h * 3.0);
        if (coreR <= 0.01) continue;
        for (let a = 0; a < Math.PI * 2; a += 0.16) {
          points.push({
            x: coreR * Math.cos(a),
            y: tierBaseY + h,
            z: coreR * Math.sin(a),
            nx: Math.cos(a) * 0.8,
            ny: 0.4,
            nz: Math.sin(a) * 0.8,
            type: 'needle',
            tipRatio: 0.25,
          });
        }
      }

      for (let b = 0; b < branchesInTier; b++) {
        const baseAngle = tierAngleOffset + (b / branchesInTier) * Math.PI * 2;
        const branchLen = tierMaxLen * (0.88 + 0.2 * Math.sin(b * 3.7 + t));

        for (let s = 0.05; s <= 1.0; s += 0.022) {
          const dist = s * branchLen;
          const droop =
            -Math.pow(s, 1.8) * 0.11 * (1 - tierFrac * 0.4) +
            Math.sin(s * Math.PI) * 0.025;
          const curveAngle = baseAngle + Math.sin(s * 3 + t) * 0.07;

          const bx = dist * Math.cos(curveAngle);
          const by = tierBaseY + droop;
          const bz = dist * Math.sin(curveAngle);

          const needleSpread = (1 - s * 0.65) * 0.044;
          for (let ring = 0; ring < 7; ring++) {
            const na = (ring / 7) * Math.PI * 2 + s * 5;
            const nr = needleSpread * (0.6 + 0.4 * Math.sin(na * 3 + s * 10));
            const dx = Math.cos(na) * nr;
            const dy = Math.sin(na) * nr * 0.85;
            const dz = Math.sin(na + curveAngle) * nr;

            points.push({
              x: bx + dx,
              y: by + dy,
              z: bz + dz,
              nx: Math.cos(curveAngle) * 0.6 + dx * 6,
              ny: 0.45 + dy * 6,
              nz: Math.sin(curveAngle) * 0.6 + dz * 6,
              type: 'needle',
              tipRatio: s,
            });
          }
        }
      }
    }

    for (let u = 0; u <= 1; u += 0.0016) {
      const y = TREE_BASE_Y + 0.1 + u * (TREE_HEIGHT - 0.15);
      const r = (1 - Math.pow(u, 0.85)) * 0.43 + 0.035;
      const a = u * Math.PI * 2 * 5.0;
      points.push({
        x: r * Math.cos(a),
        y,
        z: r * Math.sin(a),
        nx: Math.cos(a),
        ny: 0.2,
        nz: Math.sin(a),
        type: 'ribbon',
        phase: u,
      });
    }

    const starY = TREE_BASE_Y + TREE_HEIGHT + 0.03;
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const ray = Math.pow(Math.abs(Math.cos(2.5 * a)), 2.2);
      const outerR = 0.026 + ray * 0.075;
      for (let r = 0; r <= outerR; r += 0.008) {
        const sx = r * Math.sin(a);
        const sy = starY + r * Math.cos(a);
        points.push({ x: sx, y: sy, z: 0.014, nx: 0, ny: 0, nz: 1, type: 'star' });
        points.push({ x: sx, y: sy, z: -0.014, nx: 0, ny: 0, nz: -1, type: 'star' });
      }
    }

    // 3. Герои
    const addSurfaceCluster = (
      phi,
      theta,
      localOffsetSide,
      heightScale,
      radiusScale,
      type,
      extra = {}
    ) => {
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const tx = -Math.sin(theta);
      const tz = Math.cos(theta);
      const ux = sinP * Math.cos(theta);
      const uy = cosP;
      const uz = sinP * Math.sin(theta);

      const baseX = ux * GLOBE_R + tx * localOffsetSide;
      const baseY = GLOBE_Y + uy * GLOBE_R;
      const baseZ = uz * GLOBE_R + tz * localOffsetSide;

      for (let h = 0; h <= heightScale; h += 0.007) {
        const frac = h / heightScale;
        const profile = Math.sin(frac * Math.PI) * 0.7 + 0.3;
        const r = radiusScale * profile;
        for (let a = 0; a < Math.PI * 2; a += 0.35) {
          const ox = Math.cos(a) * r;
          const oz = Math.sin(a) * r;
          points.push({
            x: baseX + ux * h + ox,
            y: baseY + uy * h,
            z: baseZ + uz * h + oz,
            nx: ux * 0.5 + Math.cos(a) * 0.8,
            ny: uy * 0.5 + 0.3,
            nz: uz * 0.5 + Math.sin(a) * 0.8,
            type,
            ...extra,
          });
        }
      }
      return {
        x: baseX + ux * (heightScale * 0.6),
        y: baseY + uy * (heightScale * 0.6),
        z: baseZ + uz * (heightScale * 0.6),
      };
    };

    const characterAnchors = [];

    {
      const theta = CHARACTERS[0].angle;
      const phi = 0.72;
      const anchor = addSurfaceCluster(phi, theta, -0.02, 0.145, 0.026, 'person_artem', { charId: 'artem' });
      addSurfaceCluster(phi, theta, -0.02, 0.185, 0.02, 'person_head', { charId: 'artem' });
      addSurfaceCluster(phi + 0.03, theta + 0.11, 0, 0.038, 0.022, 'pet_filya', { charId: 'artem' });
      characterAnchors.push({ ...CHARACTERS[0], ...anchor });
    }

    {
      const theta = CHARACTERS[1].angle;
      const phi = 0.72;
      const anchor = addSurfaceCluster(phi, theta, 0, 0.132, 0.024, 'person_alina', { charId: 'alina' });
      addSurfaceCluster(phi, theta, 0, 0.17, 0.019, 'person_head', { charId: 'alina' });
      addSurfaceCluster(phi - 0.01, theta + 0.06, 0, 0.155, 0.016, 'pet_kesha', { charId: 'alina' });
      characterAnchors.push({ ...CHARACTERS[1], ...anchor });
    }

    {
      const theta = CHARACTERS[2].angle;
      const phi = 0.72;
      const anchor = addSurfaceCluster(phi, theta - 0.06, 0, 0.132, 0.023, 'person_kira', { charId: 'kira_ira' });
      addSurfaceCluster(phi, theta - 0.06, 0, 0.168, 0.018, 'person_head', { charId: 'kira_ira' });
      addSurfaceCluster(phi, theta + 0.06, 0, 0.128, 0.023, 'person_ira', { charId: 'kira_ira' });
      addSurfaceCluster(phi, theta + 0.06, 0, 0.164, 0.018, 'person_head', { charId: 'kira_ira' });
      addSurfaceCluster(phi + 0.06, theta, 0, 0.056, 0.026, 'pet_elsa', { charId: 'kira_ira' });
      addSurfaceCluster(phi + 0.075, theta + 0.02, 0, 0.074, 0.018, 'pet_elsa', { charId: 'kira_ira' });
      characterAnchors.push({ ...CHARACTERS[2], ...anchor });
    }

    // 4. Дуги
    for (let i = 0; i < characterAnchors.length; i++) {
      const a1 = characterAnchors[i];
      const a2 = characterAnchors[(i + 1) % characterAnchors.length];
      for (let t = 0; t <= 1; t += 0.012) {
        const lx = a1.x * (1 - t) + a2.x * t;
        const ly = a1.y * (1 - t) + a2.y * t + Math.sin(t * Math.PI) * 0.24;
        const lz = a1.z * (1 - t) + a2.z * t;
        points.push({
          x: lx,
          y: ly,
          z: lz,
          nx: 0,
          ny: 1,
          nz: 0,
          type: 'arc',
          arcPhase: t + i * 0.33,
        });
      }
    }

    for (const p of points) {
      const len = Math.hypot(p.nx, p.ny, p.nz) || 1;
      p.nx /= len;
      p.ny /= len;
      p.nz /= len;
    }

    let angle = -0.3;
    let vel = 0;
    let dragging = false;
    let lastX = 0;
    let dragDist = 0;

    const onDown = (e) => {
      dragging = true;
      targetAngleRef.current = null;
      lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      dragDist = 0;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const dx = x - lastX;
      dragDist += Math.abs(dx);
      vel = dx * 0.006;
      angle += vel;
      lastX = x;
    };
    const onUp = (e) => {
      dragging = false;
      if (dragDist < 8) {
        const cx = e.clientX ?? e.changedTouches?.[0]?.clientX;
        const cy = e.clientY ?? e.changedTouches?.[0]?.clientY;
        if (cx !== undefined && cy !== undefined) {
          let closest = null;
          let minDist = 55;
          for (const item of screenTargetsRef.current) {
            if (!item.visible) continue;
            const d = Math.hypot(item.sx - cx, item.sy - cy);
            if (d < minDist) {
              minDist = d;
              closest = item.charObj;
            }
          }
          if (closest) focusCharacter(closest);
        }
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const lightX = 0.48;
    const lightY = 0.55;
    const lightZ = 0.68;

    const render = (time) => {
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, width, height);

      if (snowActiveRef.current) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const s of snowflakes) {
          s.y += s.speed;
          s.sway += 0.015;
          if (s.y > 1.02) {
            s.y = -0.02;
            s.x = Math.random();
          }
          const sx = (s.x + Math.sin(s.sway) * 0.012) * width;
          const sy = s.y * height;
          ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
          ctx.font = `${s.size}px monospace`;
          ctx.fillText(s.char, sx, sy);
        }
      }

      if (!dragging) {
        if (targetAngleRef.current !== null) {
          let diff = targetAngleRef.current - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          angle += diff * 0.08;
        } else {
          angle += 0.009 + vel;
          vel *= 0.94;
        }
      }

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const totalCells = cols * rows;
      const zBuf = new Float32Array(totalCells).fill(-Infinity);
      const charBuf = new Uint8Array(totalCells);
      const colorBuf = new Array(totalCells);

      const scenePixelHeight = height * 0.88; // Уменьшили масштаб (было 0.88), чтобы влезло с отступами
      const scaleY = scenePixelHeight / 2.58 / cellH;
      const scaleX = scaleY * (cellH / cellW);
      const centerX = cols * 0.5;
      // Центрируем по вертикали с учётом отступов сверху (погода) и снизу (док-панель)
      const topMarginPx = 60;    // отступ сверху для верхней панели погоды
      const bottomMarginPx = 20; // отступ снизу для кнопок и карточки
      const availableHeight = height - topMarginPx - bottomMarginPx;
      const availableCenter = topMarginPx + availableHeight / 2;
      // 2.58 — это полная высота модели (от низа планеты до звезды)
      // Сдвигаем так, чтобы середина модели была ровно в центре доступной области
      const centerY = availableCenter / cellH - (scaleY * 0.1); // 0.1 — небольшая поправка на глаз

      const rampLen = DENSITY_RAMP.length - 1;
      const fov = 3.6;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const rx = p.x * cosA - p.z * sinA;
        const rz = p.x * sinA + p.z * cosA;
        const depth = fov + rz;
        if (depth <= 0.3) continue;

        const ooz = 1 / depth;
        const projFactor = ooz * fov;
        const px = Math.floor(centerX + rx * scaleX * projFactor);
        const py = Math.floor(centerY - p.y * scaleY * projFactor);

        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;

        const idx = py * cols + px;
        if (ooz <= zBuf[idx]) continue;

        const rnx = p.nx * cosA - p.nz * sinA;
        const rnz = p.nx * sinA + p.nz * cosA;
        const rny = p.ny;

        const diff = Math.max(0, rnx * lightX + rny * lightY + rnz * lightZ);
        const rim = Math.pow(1 - Math.abs(rnz), 2.5) * 0.35;
        let lum = 0.16 + diff * 0.72 + rim;
        let color = '#94a3b8';

        const isHighlighted = p.charId && p.charId === selectedIdRef.current;

        switch (p.type) {
          case 'globe_ocean':
            lum *= 0.75;
            color = hslToRgbString(215, 55, 14 + lum * 28);
            break;
          case 'globe_land':
            lum *= 0.88;
            color = hslToRgbString(160, 42, 16 + lum * 32);
            break;
          case 'globe_snow':
            lum = Math.min(1, 0.32 + diff * 0.65 + rim * 0.5);
            color = hslToRgbString(205, 25, 45 + lum * 45);
            break;
          case 'globe_city':
            lum = 0.75 + 0.25 * Math.sin(time * 0.005 + p.x * 40);
            color = hslToRgbString(42, 85, 55 + lum * 35);
            break;
          case 'trunk':
            color = hslToRgbString(28, 35, 14 + lum * 22);
            break;
          case 'needle': {
            const tipBoost = p.tipRatio * 0.25;
            lum = Math.min(1, lum * (0.65 + p.tipRatio * 0.45));
            const hue = 148 + p.tipRatio * 18;
            const sat = 45 - p.tipRatio * 15;
            const light = 15 + lum * 46 + tipBoost * 15;
            color = hslToRgbString(hue, sat, light);
            break;
          }
          case 'ribbon': {
            const shimmer = 0.75 + 0.25 * Math.sin(p.phase * 30 - time * 0.004);
            lum = Math.min(1, (0.35 + diff * 0.65) * shimmer);
            color = hslToRgbString(42, 65, 38 + lum * 45);
            break;
          }
          case 'star':
            lum = Math.min(1, 0.65 + 0.35 * Math.sin(time * 0.004));
            color = hslToRgbString(45, 85, 52 + lum * 40);
            break;
          case 'person_artem':
            lum = isHighlighted ? 1 : Math.min(1, lum + 0.25);
            color = hslToRgbString(198, 85, 48 + lum * 38);
            break;
          case 'person_alina':
            lum = isHighlighted ? 1 : Math.min(1, lum + 0.25);
            color = hslToRgbString(142, 75, 45 + lum * 38);
            break;
          case 'person_kira':
            lum = isHighlighted ? 1 : Math.min(1, lum + 0.25);
            color = hslToRgbString(330, 80, 52 + lum * 36);
            break;
          case 'person_ira':
            lum = isHighlighted ? 1 : Math.min(1, lum + 0.25);
            color = hslToRgbString(280, 75, 54 + lum * 36);
            break;
          case 'person_head':
            lum = Math.min(1, lum + 0.2);
            color = hslToRgbString(28, 55, 55 + lum * 30);
            break;
          case 'pet_filya':
            lum = Math.min(1, lum + 0.3);
            color = hslToRgbString(34, 80, 55 + lum * 35);
            break;
          case 'pet_kesha':
            lum = Math.min(1, lum + 0.35);
            color = hslToRgbString(85, 90, 50 + lum * 40);
            break;
          case 'pet_elsa':
            lum = 0.85 + 0.15 * diff;
            color = hslToRgbString(200, 30, 78 + lum * 22);
            break;
          case 'arc': {
            const pulse = Math.sin((p.arcPhase * 6 - time * 0.003) * Math.PI);
            if (pulse < 0.2) continue;
            lum = pulse;
            color = hslToRgbString(195, 85, 55 + pulse * 35);
            break;
          }
          default:
            break;
        }

        const charIndex = Math.max(1, Math.min(rampLen, Math.floor(lum * rampLen)));
        zBuf[idx] = ooz;
        charBuf[idx] = charIndex;
        colorBuf[idx] = color;
      }

      ctx.font = `${cellH}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let r = 0; r < rows; r++) {
        const yPos = r * cellH + cellH * 0.5;
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const ci = charBuf[idx];
          if (ci > 0) {
            ctx.fillStyle = colorBuf[idx];
            ctx.fillText(DENSITY_RAMP[ci], c * cellW + cellW * 0.5, yPos);
          }
        }
      }

      const nextTargets = [];
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      for (const anchor of characterAnchors) {
        const rx = anchor.x * cosA - anchor.z * sinA;
        const rz = anchor.x * sinA + anchor.z * cosA;
        const visible = rz < 0.12;
        const depth = fov + rz;
        const ooz = 1 / depth;
        const projFactor = ooz * fov;
        const sx = (centerX + rx * scaleX * projFactor) * cellW;
        const sy = (centerY - (anchor.y + 0.15) * scaleY * projFactor) * cellH;
        nextTargets.push({ charObj: anchor, sx, sy, visible });
        if (visible) {
          const alpha = Math.max(0, Math.min(1, (0.12 - rz) * 2.2));
          const label =
            anchor.id === 'artem'
              ? 'Артём & Филя'
              : anchor.id === 'alina'
              ? 'Алина & Кеша'
              : 'Кира, Ира & Эльза';
          ctx.save();
          ctx.globalAlpha = alpha;
          const textW = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(5, 10, 20, 0.78)';
          ctx.beginPath();
          ctx.roundRect(sx - textW / 2 - 8, sy - 10, textW + 16, 20, 10);
          ctx.fill();
          ctx.strokeStyle = anchor.color;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(label, sx, sy);
          ctx.restore();
        }
      }
      screenTargetsRef.current = nextTargets;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const activeCharacter = CHARACTERS.find((c) => c.id === selectedId);

  return (
    <div className="app">
      {/* ✅ ВОТ ТОТ САМЫЙ <canvas>, БЕЗ КОТОРОГО БЫЛ ЧЁРНЫЙ ЭКРАН */}
      <canvas ref={canvasRef} className="canvas" />

      <div className="weather-bar">
        {CHARACTERS.map((ch) => {
          const w = weatherMap[ch.city];
          return (
            <button
              key={ch.id}
              className={`city-chip ${selectedId === ch.id ? 'active' : ''}`}
              onClick={() => focusCharacter(ch)}
            >
              <span className="dot" style={{ backgroundColor: ch.color }} />
              {ch.city}: {w?.temp} {w?.snow ? '❄️' : ''}
            </button>
          );
        })}
      </div>

      {activeCharacter && (
        <div className="story-card">
          <span className="story-title" style={{ color: activeCharacter.color }}>
            {activeCharacter.name}
          </span>
          <button className="close-btn" onClick={() => setSelectedId(null)}>
            ✕
          </button>
          <div className="story-meta">
            {activeCharacter.city} ({weatherMap[activeCharacter.city]?.temp}) •{' '}
            {activeCharacter.distance}
          </div>
          <p className="story-message">{activeCharacter.message}</p>
        </div>
      )}

      <div className="dock">
        {CHARACTERS.map((ch) => (
          <button
            key={ch.id}
            className={`dock-btn ${selectedId === ch.id ? 'active' : ''}`}
            onClick={() => focusCharacter(ch)}
          >
            {ch.id === 'artem'
              ? '🐹 Артём + Филя'
              : ch.id === 'alina'
              ? '🦜 Алина + Кеша'
              : '🐶 Кира, Ира + Эльза'}
          </button>
        ))}
        <button
          className={`dock-btn ${forceSnow ? 'active' : ''}`}
          onClick={() => setForceSnow((prev) => !prev)}
        >
          {forceSnow ? '❄️ Снег: ВКЛ' : '❄️ Снег'}
        </button>
      </div>
    </div>
  );
}