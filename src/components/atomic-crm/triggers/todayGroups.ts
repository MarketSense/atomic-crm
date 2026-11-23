import { todayIso, type TodayItem } from "./triggerModel";

export type Section = {
  key: string;
  title: string;
  hint: string;
  items: TodayItem[];
};

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const byRank = (a: TodayItem, b: TodayItem) =>
  a.sort_rank - b.sort_rank ||
  (a.send_order ?? 999) - (b.send_order ?? 999) ||
  (a.due_date ?? "").localeCompare(b.due_date ?? "");

/** Splits the due actions into Overdue, Today, Next 7 days and Expiring. */
export const groupTodayItems = (
  items: TodayItem[],
  today = todayIso(),
): Section[] => {
  const weekOut = addDays(today, 7);
  const expiring = items.filter((i) => i.kind === "expiring");
  const rest = items.filter((i) => i.kind !== "expiring");
  return [
    {
      key: "overdue",
      title: "Overdue",
      hint: "Past their date. Do these first or move the date.",
      items: rest.filter((i) => i.due_date && i.due_date < today).sort(byRank),
    },
    {
      key: "today",
      title: "Today",
      hint: "Due today, in send order.",
      items: rest.filter((i) => i.due_date === today).sort(byRank),
    },
    {
      key: "week",
      title: "Next 7 days",
      hint: "Coming up this week.",
      items: rest
        .filter(
          (i) => i.due_date && i.due_date > today && i.due_date <= weekOut,
        )
        .sort(byRank),
    },
    {
      key: "expiring",
      title: "Expiring",
      hint: "Day 61 to 75: write now or let it go.",
      items: expiring.sort(byRank),
    },
  ];
};
