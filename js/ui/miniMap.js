// Fallback route map used only if js/scene/routeMap.js is unavailable. Same API as createRouteMap.
const NS = 'http://www.w3.org/2000/svg';
export function createMiniMap(container) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 360 180');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.classList.add('mini-map');
  container.append(svg);
  const P = (lat, lon) => [(lon + 180), (90 - lat)];
  let dots = [];
  const grid = () => { let s = ''; for (let x = 0; x <= 360; x += 30) s += `<line x1="${x}" y1="0" x2="${x}" y2="180"/>`; for (let y = 0; y <= 180; y += 30) s += `<line x1="0" y1="${y}" x2="360" y2="${y}"/>`; return `<g class="mm-grid">${s}</g>`; };
  return {
    show(chain = []) {
      const pts = chain.map(h => P(h.lat ?? 0, h.lon ?? 0));
      const port = P(51.9, 4.5); pts.push(port);
      // fit view to points
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const pad = 18, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
      const w = Math.max(80, Math.max(...xs) - minX + pad), hgt = Math.max(40, Math.max(...ys) - minY + pad);
      svg.setAttribute('viewBox', `${minX} ${minY} ${w} ${hgt}`);
      const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      svg.innerHTML = grid() + `<path class="mm-route" d="${path}"/>` +
        pts.map((p, i) => `<g class="mm-hop" data-i="${i}"><circle cx="${p[0]}" cy="${p[1]}" r="${(w / (i === pts.length - 1 ? 70 : 85)).toFixed(1)}"/><text x="${p[0] + w / 60}" y="${p[1] - w / 70}" font-size="${(w / 26).toFixed(1)}">${i === pts.length - 1 ? 'PORT' : i + 1}</text></g>`).join('');
      dots = [...svg.querySelectorAll('.mm-hop')];
    },
    revealRisk(idx = []) { idx.forEach(i => dots[i]?.classList.add('risk')); },
    clear() { svg.innerHTML = ''; dots = []; },
  };
}
