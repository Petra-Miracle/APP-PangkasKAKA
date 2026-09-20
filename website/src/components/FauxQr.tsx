const SIZE = 21;

function rngFactory(seedInput: number) {
  let seed = seedInput >>> 0 || 1;
  return () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
}

export default function FauxQr({ seed, size = 200 }: { seed: string; size?: number }) {
  const numericSeed = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0) || 1;
  const rng = rngFactory(numericSeed);
  const cell = size / SIZE;
  const cells: { x: number; y: number }[] = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inFinder =
        (x < 7 && y < 7) || (x >= SIZE - 7 && y < 7) || (x < 7 && y >= SIZE - 7);
      if (inFinder) continue;
      if (rng() > 0.56) cells.push({ x, y });
    }
  }

  const finderPositions = [
    { x: 0, y: 0 },
    { x: SIZE - 7, y: 0 },
    { x: 0, y: SIZE - 7 },
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#FFFFFF" />
      {cells.map((c, i) => (
        <rect key={i} x={c.x * cell} y={c.y * cell} width={cell} height={cell} fill="#0A0A0A" />
      ))}
      {finderPositions.map((f, i) => (
        <g key={i}>
          <rect x={f.x * cell} y={f.y * cell} width={cell * 7} height={cell * 7} fill="#0A0A0A" />
          <rect
            x={(f.x + 1) * cell}
            y={(f.y + 1) * cell}
            width={cell * 5}
            height={cell * 5}
            fill="#FFFFFF"
          />
          <rect
            x={(f.x + 2) * cell}
            y={(f.y + 2) * cell}
            width={cell * 3}
            height={cell * 3}
            fill="#0A0A0A"
          />
        </g>
      ))}
    </svg>
  );
}
