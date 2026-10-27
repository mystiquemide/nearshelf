import Link from "next/link";

export default function NotFound() {
  return (
    <main className="simple on-ink">
      <div>
        <p className="label">Nearshelf</p>
        <h1>This page isn&apos;t on the shelf.</h1>
        <p>The link may be old or mistyped.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/">Find my comps</Link>
        </div>
      </div>
    </main>
  );
}
