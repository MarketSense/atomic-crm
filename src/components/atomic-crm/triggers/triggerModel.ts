import type { Identifier, RaRecord } from "ra-core";

/**
 * Rehearsal flag. Until switch day, Notion is still the system of record for
 * MarketSense leads: Trigger Desk only shadows it. Flip to false on switch day.
 */
export const NOTION_IS_RECORD = true;

export type TriggerStage =
  | "needs_check"
  | "hold"
  | "ready_to_send"
  | "in_sequence"
  | "replied"
  | "meeting_set"
  | "opportunity"
  | "closed_out";

export type WindowStatus = "hold" | "write" | "expiring" | "expired" | null;

export interface TriggerEvent extends RaRecord {
  client_id: Identifier;
  contact_id: Identifier | null;
  company_id: Identifier | null;
  trigger_type: string;
  trigger_detail: string | null;
  hire_or_promotion: string | null;
  start_month: string | null;
  detected_date: string | null;
  trigger_source: string | null;
  live_check_detail: string | null;
  verified_date: string | null;
  second_signal: string | null;
  second_signal_detail: string | null;
  second_signal_date: string | null;
  second_signal_source: string | null;
  gate: "pass" | "fail" | "hold" | null;
  gate_note: string | null;
  stage: TriggerStage;
  send_order: number | null;
  next_action: string | null;
  next_action_date: string | null;
  asset_url: string | null;
  replied: boolean;
  meeting: boolean;
  day_count: number | null;
  window_status: WindowStatus;
  last_contact: string | null;
  days_since_contact: number | null;
}

export interface TodayItem extends RaRecord {
  trigger_event_id: Identifier;
  contact_id: Identifier | null;
  company_id: Identifier | null;
  contact_name: string;
  company_name: string | null;
  stage: TriggerStage;
  send_order: number | null;
  window_status: WindowStatus;
  day_count: number | null;
  kind: string;
  label: string;
  due_date: string | null;
  overdue: boolean;
  sort_rank: number;
}

export interface OutreachTouch extends RaRecord {
  trigger_event_id: Identifier | null;
  contact_id: Identifier;
  channel: "email" | "linkedin" | "phone" | "mail" | "other";
  touch: string;
  touched_on: string;
  note: string | null;
}

export interface RepCard extends RaRecord {
  trigger_event_id: Identifier;
  contact_id: Identifier | null;
  header: string | null;
  go_call: string | null;
  why_now: string | null;
  know: string | null;
  say: string | null;
  watch_out: string | null;
  contact_clock: string | null;
  open_before_send: string | null;
  checked_on: string | null;
}

export const STAGES: { id: TriggerStage; label: string }[] = [
  { id: "needs_check", label: "Needs check" },
  { id: "hold", label: "Hold" },
  { id: "ready_to_send", label: "Ready to send" },
  { id: "in_sequence", label: "In sequence" },
  { id: "replied", label: "Replied" },
  { id: "meeting_set", label: "Meeting set" },
  { id: "opportunity", label: "Opportunity" },
  { id: "closed_out", label: "Closed out" },
];

export const stageLabel = (stage: string | null | undefined) =>
  STAGES.find((s) => s.id === stage)?.label ?? stage ?? "";

export const windowLabel = (w: WindowStatus) =>
  w === "write"
    ? "Write"
    : w === "expiring"
      ? "Expiring"
      : w === "expired"
        ? "Expired"
        : w === "hold"
          ? "Too early"
          : "No dates";

/** Touch buttons on the contact page, in Moment Play order. */
export const TOUCHES: {
  touch: string;
  channel: OutreachTouch["channel"];
  label: string;
}[] = [
  { touch: "email_1", channel: "email", label: "Email 1 sent" },
  { touch: "linkedin_connect", channel: "linkedin", label: "LinkedIn connect" },
  { touch: "email_2", channel: "email", label: "Email 2 sent" },
  { touch: "card_mailed", channel: "mail", label: "Card mailed" },
  { touch: "email_3", channel: "email", label: "Email 3 sent" },
  { touch: "call", channel: "phone", label: "Call made" },
  { touch: "linkedin_note", channel: "linkedin", label: "LinkedIn note" },
];

export const touchLabel = (touch: string) =>
  TOUCHES.find((t) => t.touch === touch)?.label ??
  (touch === "reply_sent" ? "Reply sent" : touch.replace(/_/g, " "));

export const secondSignalLabel = (s: string | null) =>
  s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "";

/** Local date as YYYY-MM-DD (not UTC, so an evening touch isn't dated tomorrow). */
export const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDay = (iso: string | null | undefined) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};
