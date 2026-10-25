import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap">
      <header className="hero">
        <h1>Nearshelf</h1>
        <p className="lede">This page isn't on the shelf.</p>
      </header>
      <Link className="btn btn-primary" href="/">Find comps</Link>
    </main>
  );
}
