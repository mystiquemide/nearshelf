import {
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Copy,
  Fingerprint,
  Link2,
  ListChecks,
  Scale,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import type { EvalTotals } from "@/lib/eval-results";

// Everything below the hero. Copy only states what the app does today.
// Eval numbers render only when eval/results.json exists from a real run.
export function Sections({ evalTotals }: { evalTotals: EvalTotals | null }) {
  return (
    <>
      <section id="how" className="band" aria-labelledby="how-h">
        <div className="container">
          <SectionHead id="how-h" icon={ListChecks} title="How Nearshelf picks a comp" sub="Three steps, each shown on screen as it happens." />
          <ol className="steps-3">
            <Step n={1} icon={BookOpen} title="Tell us three books yours reads like">
              Type titles or pick a preset. Each one is looked up in Qloo, and you see straight away whether it was found.
            </Step>
            <Step n={2} icon={Users} title="Qloo finds the readers">
              Nearshelf asks Qloo&apos;s taste graph which books the readers of your seeds also love, filtered to recent titles.
            </Step>
            <Step n={3} icon={ShieldCheck} title="Every book is checked against the rules">
              Recency, size, and whether it&apos;s one of your own books. Every verdict is made in code, not by a model.
            </Step>
          </ol>
        </div>
      </section>

      <section className="band band-warm" aria-labelledby="get-h">
        <div className="container">
          <SectionHead id="get-h" icon={BadgeCheck} title="What you leave with" sub="Everything you need for the comps line in your query letter." />
          <div className="bento">
            <Tile wide icon={BookOpen} title="Comps you can defend.">
              Recent, mid-list books with readers like yours, up to six on the shelf, in the order Qloo ranks them.
            </Tile>
            <Tile icon={Fingerprint} title="Proof for every book.">
              Its Qloo entity ID, publication year, popularity score and the seed books it came from.
            </Tile>
            <Tile icon={XCircle} title="Know why a book didn't make it.">
              Rejected books stay visible with the rule they broke and the value that failed it.
            </Tile>
            <Tile icon={ClipboardCheck} title="Check the comps you already have." href="#check" cta="Check my comps">
              Paste up to five titles and see which pass, which don&apos;t, and a replacement for the ones that fail.
            </Tile>
            <Tile icon={Copy} title="A line ready for your query.">
              &quot;My novel will appeal to readers of A and B&quot;, built only from comps that passed. Copy it in one click.
            </Tile>
          </div>
        </div>
      </section>

      <section id="llm" className="band" aria-labelledby="llm-h">
        <div className="container">
          <SectionHead
            id="llm-h"
            icon={Scale}
            title="Why not just ask ChatGPT?"
            sub="Ask a plain LLM for comps and check its answers. That's what the comparison tab does, live, with the same rules."
          />
          <div className="llm-grid">
            <div className="llm-col">
              <p className="label">What a plain LLM did in one test run</p>
              <ul className="plain-list">
                <li><XCircle size={16} aria-hidden="true" /> Returned all three seed books as their own comps</li>
                <li><XCircle size={16} aria-hidden="true" /> Credited two of them to the wrong authors</li>
                <li><XCircle size={16} aria-hidden="true" /> Suggested a title that doesn&apos;t appear to exist</li>
              </ul>
              <p className="small muted">Seeds: The Jasmine Throne, The Spear Cuts Through Water, Godkiller.</p>
            </div>
            <div className="llm-col">
              <p className="label">What Nearshelf can&apos;t do</p>
              <ul className="plain-list plain-list-pass">
                <li><ShieldCheck size={16} aria-hidden="true" /> Show a book Qloo doesn&apos;t know</li>
                <li><ShieldCheck size={16} aria-hidden="true" /> Return one of your seed books as a comp</li>
                <li><ShieldCheck size={16} aria-hidden="true" /> Let the model pick, add or rename a book</li>
              </ul>
              <a className="btn btn-primary" href="#tool">Try the comparison</a>
            </div>
          </div>
          {evalTotals && <EvalStrip t={evalTotals} />}
        </div>
      </section>

      <section className="band band-rules" aria-label="How Nearshelf stays honest">
        <div className="container facts">
          <Fact icon={Fingerprint} title="Every comp carries its Qloo ID">Shown in the evidence panel for every book on the shelf.</Fact>
          <Fact icon={ShieldCheck} title="Zero books come from the model">The agent picks tools. Books and verdicts come from Qloo and the rules.</Fact>
          <Fact icon={Link2} title="Your search lives in the link">Share the link and it reruns the same search.</Fact>
        </div>
      </section>

      <section className="final on-ink" aria-labelledby="final-h">
        <div className="container final-inner">
          <h2 id="final-h">Find comps for your book in a minute</h2>
          <p>Three titles in, recent mid-list comps out, with the proof.</p>
          <div className="row final-actions">
            <a className="btn btn-primary" href="#tool">Find my comps</a>
            <a className="btn btn-secondary" href="#check">Check my comps</a>
          </div>
        </div>
      </section>

    </>
  );
}

export function Footer() {
  return (
    <footer className="footer on-ink">
        <div className="container">
          <div className="footer-cols">
            <div>
              <p className="footer-brand">Nearshelf</p>
              <p className="footer-tag">Comp titles backed by reader data.</p>
            </div>
            <FooterCol title="Product" links={[["How it works", "#how"], ["Check my comps", "#check"], ["Why not an LLM", "#llm"]]} />
            <FooterCol
              title="Built with"
              links={[["Qloo taste graph", "https://www.qloo.com"], ["Vercel AI SDK", "https://ai-sdk.dev"], ["NVIDIA models", "https://build.nvidia.com"]]}
            />
            <FooterCol
              title="Project"
              links={[["Source code", "https://github.com/mystiquemide/nearshelf"], ["MIT License", "https://github.com/mystiquemide/nearshelf/blob/main/LICENSE"], ["Qloo Agentic Hackathon", "https://qloo.devpost.com"]]}
            />
          </div>
          <p className="footer-note">Reader data from Qloo. Publication years cross-checked with Open Library.</p>
        </div>
      </footer>
  );
}

type Icon = typeof Search;

function SectionHead({ id, icon: I, title, sub }: { id: string; icon: Icon; title: string; sub: string }) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{sub}</p>
      </div>
      <span className="icon-tile" aria-hidden="true"><I size={20} strokeWidth={1.5} /></span>
    </div>
  );
}

function Step({ n, icon: I, title, children }: { n: number; icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <li className="step-card">
      <div className="step-top">
        <span className="step-num">{n}</span>
        <I size={20} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </li>
  );
}

function Tile({ icon: I, title, children, wide, href, cta }: { icon: Icon; title: string; children: React.ReactNode; wide?: boolean; href?: string; cta?: string }) {
  return (
    <div className={`tile${wide ? " tile-wide" : ""}`}>
      <span className="icon-tile" aria-hidden="true"><I size={20} strokeWidth={1.5} /></span>
      <p><strong>{title}</strong> {children}</p>
      {href && cta && <a className="btn btn-secondary tile-cta" href={href}>{cta}</a>}
    </div>
  );
}

function Fact({ icon: I, title, children }: { icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <I size={20} strokeWidth={1.5} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function EvalStrip({ t }: { t: EvalTotals }) {
  return (
    <div className="eval-strip">
      <p className="label">Across {t.sets} seed sets, measured with npm run eval</p>
      <div className="facts">
        <div className="fact"><p className="fact-num">{t.llmPassed} of {t.llmTitles}</p><p>plain-LLM titles passed every rule</p></div>
        <div className="fact"><p className="fact-num">{t.llmNotFound}</p><p>LLM titles couldn&apos;t be found in Qloo or Open Library</p></div>
        <div className="fact"><p className="fact-num">{t.nearshelfSetsWithThreePlus} of {t.sets}</p><p>seed sets got three or more Nearshelf comps</p></div>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="footer-title">{title}</p>
      <ul>
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

