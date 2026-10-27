import { BookOpen, CalendarClock, Gauge, Users } from "lucide-react";

// Shown before the first run. The shelf outline is an empty state, not books.
// The size rule is only listed when it's actually switched on.
export function RulesPanel({ windowYears, popularityMax }: { windowYears: number; popularityMax: number | null }) {
  const rules = [
    { icon: Users, text: "Qloo finds books that readers of your seed books also love." },
    { icon: CalendarClock, text: `It was published in the last ${windowYears} years.` },
    ...(popularityMax !== null ? [{ icon: Gauge, text: `It isn't a megahit (popularity under ${popularityMax.toFixed(3)}).` }] : []),
    { icon: BookOpen, text: "It isn't one of your own seed books." },
  ];
  return (
    <aside className="rules" aria-labelledby="rules-h">
      <div className="empty-shelf" aria-hidden="true">
        <div className="empty-shelf-books">
          {[188, 170, 196, 176, 190, 168].map((h, i) => (
            <span key={i} style={{ height: h * 0.6 }} />
          ))}
        </div>
        <div className="empty-shelf-board" />
      </div>
      <p className="empty-shelf-label">Your comps land here</p>
      <h2 id="rules-h">How a comp gets on the shelf</h2>
      <ul className="rule-list">
        {rules.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className="rule-icon"><Icon size={16} strokeWidth={1.75} aria-hidden="true" /></span>
            {text}
          </li>
        ))}
      </ul>
      <p className="small muted">
        Every comp shows its evidence. Books that don&apos;t make it are listed with the rule they broke.
        {popularityMax === null ? " The size rule is off until it's calibrated against real data." : ""}
      </p>
    </aside>
  );
}
