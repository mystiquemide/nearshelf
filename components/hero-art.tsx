// Decorative line drawing of shelves and book spines behind the hero. Purely visual, no data.
const SHELVES: { y: number; books: [number, number][] }[] = [
  { y: 150, books: [[40, 70], [64, 88], [86, 60], [112, 92], [140, 74], [170, 84], [196, 66], [226, 90], [254, 78]] },
  { y: 330, books: [[20, 82], [50, 64], [74, 90], [104, 70], [130, 86], [160, 62], [184, 92], [214, 76]] },
  { y: 510, books: [[60, 88], [88, 72], [114, 90], [146, 66], [170, 84], [200, 78], [228, 92], [258, 70]] },
];

function Side({ flip }: { flip?: boolean }) {
  return (
    <svg className={`hero-art-side${flip ? " flip" : ""}`} viewBox="0 0 300 560" fill="none" aria-hidden="true">
      {SHELVES.map(({ y, books }) => (
        <g key={y}>
          <line x1="0" y1={y} x2="300" y2={y} stroke="#3f3f46" strokeWidth="1.5" />
          {books.map(([x, h], i) => (
            <rect key={i} x={x} y={y - h} width={i % 3 === 0 ? 22 : 18} height={h} rx="2" stroke="#2f2f35" strokeWidth="1.2" />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <Side />
      <Side flip />
    </div>
  );
}
