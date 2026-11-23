import { describe, expect, it } from "vitest";
import { groupTodayItems } from "./todayGroups";
import type { TodayItem } from "./triggerModel";

const item = (over: Partial<TodayItem>): TodayItem => ({
  id: `${over.trigger_event_id ?? 1}:${over.kind ?? "email_2"}`,
  trigger_event_id: 1,
  contact_id: 1,
  company_id: 1,
  contact_name: "Ada",
  company_name: "ACME",
  stage: "in_sequence",
  send_order: null,
  window_status: "write",
  day_count: 20,
  kind: "email_2",
  label: "Send email 2",
  due_date: "2026-11-30",
  overdue: false,
  sort_rank: 20,
  ...over,
});

describe("groupTodayItems", () => {
  const today = "2026-11-30";

  it("splits actions into overdue, today, next 7 days and expiring", () => {
    const sections = groupTodayItems(
      [
        item({ trigger_event_id: 1, due_date: "2026-11-28", overdue: true }),
        item({ trigger_event_id: 2, due_date: today }),
        item({ trigger_event_id: 3, due_date: "2026-12-05" }),
        item({ trigger_event_id: 4, due_date: "2026-12-20" }),
        item({ trigger_event_id: 5, kind: "expiring", due_date: today }),
      ],
      today,
    );
    const ids = Object.fromEntries(
      sections.map((s) => [s.key, s.items.map((i) => i.trigger_event_id)]),
    );
    expect(ids).toEqual({
      overdue: [1],
      today: [2],
      week: [3],
      expiring: [5],
    });
  });

  it("orders email 1 sends by send order", () => {
    const sections = groupTodayItems(
      [
        item({
          trigger_event_id: 8,
          kind: "send_email_1",
          send_order: 2,
          sort_rank: 10,
          due_date: today,
        }),
        item({
          trigger_event_id: 9,
          kind: "send_email_1",
          send_order: 1,
          sort_rank: 10,
          due_date: today,
        }),
        item({
          trigger_event_id: 7,
          kind: "reply",
          sort_rank: 0,
          due_date: today,
        }),
      ],
      today,
    );
    expect(sections[1].items.map((i) => i.trigger_event_id)).toEqual([7, 9, 8]);
  });
});
