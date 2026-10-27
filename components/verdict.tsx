import { CircleAlert, CircleCheck, CircleX, SearchX } from "lucide-react";
import { describeFailure } from "@/lib/rules/labels";
import type { CheckResult } from "./types";

const ICON = { ACCEPTED: CircleCheck, REJECTED: CircleX, NOT_FOUND: SearchX, NO_QLOO_DATA: CircleAlert } as const;

const LABEL: Record<CheckResult["status"], string> = {
  ACCEPTED: "Passes",
  REJECTED: "Rejected",
  NOT_FOUND: "Not found",
  NO_QLOO_DATA: "No reader data",
};

export function VerdictRow({ r, replacement }: { r: CheckResult; replacement?: string | null }) {
  const detail =
    r.status === "REJECTED"
      ? r.failures.map(describeFailure).join(". ")
      : r.status === "NOT_FOUND"
        ? "Couldn't find this book in Qloo or Open Library"
        : r.status === "NO_QLOO_DATA"
          ? `Real book${r.external?.year ? ` (${r.external.year})` : ""}, but Qloo has no reader data for it`
          : `${r.book?.year ?? ""}${r.book?.popularity != null ? `, popularity ${r.book.popularity.toFixed(2)}` : ""}`;

  const Icon = ICON[r.status];
  return (
    <li className="verdict">
      <span className={`chip chip-${r.status.toLowerCase()}`}>
        <Icon size={13} strokeWidth={2} aria-hidden="true" />
        {LABEL[r.status]}
      </span>
      <span className="book">
        {r.input.title}
        {r.input.author ? ` by ${r.input.author}` : ""}
      </span>
      <span className="reason">
        {detail}
        {r.authorMismatch && r.book?.author ? `. Qloo has this title by ${r.book.author}` : ""}
        {r.status !== "ACCEPTED" && replacement ? `. Try ${replacement} instead` : ""}
      </span>
    </li>
  );
}
