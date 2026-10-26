// Shown before the first run so a visitor knows how a book earns a place on the shelf.
// The size rule is only described when it's actually switched on.
export function RulesPanel({ windowYears, popularityMax }: { windowYears: number; popularityMax: number | null }) {
  return (
    <aside className="rules" aria-labelledby="rules-h">
      <h2 id="rules-h">How a comp gets on the shelf</h2>
      <ol>
        <li>Qloo finds books that readers of your seed books also love.</li>
        <li>It was published in the last {windowYears} years.</li>
        {popularityMax !== null ? <li>It isn't a megahit (popularity under {popularityMax.toFixed(2)}).</li> : null}
        <li>It isn't one of your own seed books.</li>
      </ol>
      <p className="small muted">
        Every comp shows its evidence. Books that don't make it are listed with the rule they broke.
        {popularityMax === null ? " The size rule is off until it's calibrated against real data." : ""}
      </p>
    </aside>
  );
}
