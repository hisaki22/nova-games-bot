import sharp from "sharp";

const SLICE_COLORS = [
  "#3498DB", // blue
  "#2ECC71", // green
  "#E91E63", // pink/magenta
  "#27AE60", // dark green
  "#9B59B6", // purple
  "#E74C3C", // red
  "#F39C12", // orange
  "#1ABC9C", // teal
  "#F1C40F", // yellow
  "#00BCD4", // cyan
];

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate a roulette wheel SVG and return a PNG Buffer.
 *
 * @param players     Ordered list of alive players with name and lobby number.
 * @param selectedIdx Index of the player the arrow should point to.
 */
export async function generateWheelPng(
  players: Array<{ name: string; number: number }>,
  selectedIdx: number,
): Promise<Buffer> {
  const SIZE = 700;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 285;
  const innerR = 268;
  const labelR = 190;
  const n = players.length;

  const sliceAngle = (2 * Math.PI) / n;

  // Rotate so selected slice centre is at angle 0 (right = 3 o'clock)
  // where the arrow points from the right.
  // Centre of slice i: baseRot + i*sliceAngle + sliceAngle/2 = 0
  // → baseRot = -selectedIdx*sliceAngle - sliceAngle/2
  const baseRot = -selectedIdx * sliceAngle - sliceAngle / 2;

  let slicesSvg = "";
  for (let i = 0; i < n; i++) {
    const a0 = baseRot + i * sliceAngle;
    const a1 = a0 + sliceAngle;
    const x0 = (cx + innerR * Math.cos(a0)).toFixed(3);
    const y0 = (cy + innerR * Math.sin(a0)).toFixed(3);
    const x1 = (cx + innerR * Math.cos(a1)).toFixed(3);
    const y1 = (cy + innerR * Math.sin(a1)).toFixed(3);
    const large = sliceAngle > Math.PI ? 1 : 0;
    const fill = SLICE_COLORS[i % SLICE_COLORS.length];
    const isSelected = i === selectedIdx;
    const stroke = isSelected ? "#FFFFFF" : "#FFFFFF";
    const sw = isSelected ? 3 : 1.5;

    slicesSvg += `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${innerR} ${innerR} 0 ${large} 1 ${x1} ${y1} Z"
      fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    const midA = a0 + sliceAngle / 2;
    const tx = (cx + labelR * Math.cos(midA)).toFixed(2);
    const ty = (cy + labelR * Math.sin(midA)).toFixed(2);
    const rotDeg = ((midA * 180) / Math.PI + 90).toFixed(1);

    const maxChars = n <= 6 ? 12 : n <= 10 ? 9 : 7;
    const truncName = players[i]!.name.slice(0, maxChars);
    const label = escXml(`${players[i]!.number}- ${truncName}`);
    const fontSize = n <= 6 ? 17 : n <= 10 ? 14 : 11;
    const fw = isSelected ? "900" : "700";

    slicesSvg += `
      <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(${rotDeg},${tx},${ty})"
        font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="${fw}"
        fill="white" stroke="rgba(0,0,0,0.75)" stroke-width="3" paint-order="stroke">${label}</text>`;
  }

  // Arrow on the RIGHT side pointing LEFT (◄)
  const arrowTip = { x: cx + innerR + 6, y: cy };
  const arrowLen = 46;
  const arrowHalf = 18;
  const arrowSvg = `
    <polygon
      points="${arrowTip.x + arrowLen},${arrowTip.y - arrowHalf} ${arrowTip.x + arrowLen},${arrowTip.y + arrowHalf} ${arrowTip.x},${arrowTip.y}"
      fill="#2C2C2C" stroke="#555" stroke-width="2" filter="url(#shadow)"/>`;

  // Thin outer ring
  const outerRingSvg = `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>`;

  // Centre hub — black circle with "ROULETTE" text
  const hubSvg = `
    <circle cx="${cx}" cy="${cy}" r="52" fill="#111111" stroke="#333" stroke-width="2" filter="url(#shadow)"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial Black,Arial,sans-serif" font-size="14" font-weight="900"
      fill="#FFFFFF" letter-spacing="1">ROULETTE</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>

  <!-- Dark background -->
  <rect width="${SIZE}" height="${SIZE}" fill="#1a1a2e" rx="16"/>

  <!-- Slices -->
  ${slicesSvg}

  <!-- Outer ring -->
  ${outerRingSvg}

  <!-- Arrow pointer on right -->
  ${arrowSvg}

  <!-- Centre hub -->
  ${hubSvg}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
