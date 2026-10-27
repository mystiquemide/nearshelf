"use client";

import { useEffect } from "react";

// A crash shouldn't leave a blank page. The search lives in the URL, so a reload brings it back.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="simple">
      <div role="alert">
        <p className="label">Nearshelf</p>
        <h1>Something broke on this page</h1>
        <p>Your search is saved in the link, so reloading brings it back.</p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>Reload</button>
          <a className="btn btn-secondary" href="/">Start over</a>
        </div>
      </div>
    </main>
  );
}
