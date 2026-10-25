import type { RunEvent } from "@/lib/run/pipeline";
import type { CheckResult } from "@/lib/run/check";
import type { SeedResolution } from "@/lib/run/resolve";

export type { RunEvent, CheckResult, SeedResolution };
export type RunResult = Extract<RunEvent, { type: "result" }>;
export type RunError = Extract<RunEvent, { type: "error" }>;
export type StepState = "RESOLVING" | "QUERYING" | "CHECKING";

export type BaselineResponse =
  | { state: "CHECKED"; model: string; thinking: boolean; results: CheckResult[] }
  | { state: "UNCHECKED"; model: string; thinking: boolean; titles: { title: string; author?: string }[]; message: string }
  | { state: "UNAVAILABLE"; message: string };
