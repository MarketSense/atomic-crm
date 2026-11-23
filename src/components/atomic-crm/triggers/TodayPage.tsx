import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { RehearsalNote } from "./RehearsalNote";
import { WindowChip } from "./WindowChip";
import { formatDay, type TodayItem } from "./triggerModel";
import { groupTodayItems } from "./todayGroups";

const useTodayItems = () =>
  useGetList<TodayItem>("trigger_today", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "due_date", order: "ASC" },
  });

const TodayRow = ({ item }: { item: TodayItem }) => {
  const body = (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {item.send_order != null && item.kind === "send_email_1" ? (
            <span className="text-muted-foreground mr-1">
              #{item.send_order}
            </span>
          ) : null}
          {item.contact_name || "Unnamed"}
          {item.company_name ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {item.company_name}
            </span>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground line-clamp-2">
          {item.label}
          {item.due_date && item.kind !== "send_email_1" ? (
            <span> · {formatDay(item.due_date)}</span>
          ) : null}
        </div>
      </div>
      <WindowChip windowStatus={item.window_status} dayCount={item.day_count} />
    </div>
  );
  return item.contact_id != null ? (
    <Link
      to={`/contacts/${item.contact_id}/show`}
      className="block no-underline text-inherit hover:bg-muted/50 -mx-2 px-2 rounded-md"
    >
      {body}
    </Link>
  ) : (
    body
  );
};

const TodaySections = () => {
  const { data, isPending, error } = useTodayItems();
  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-muted-foreground">
        The Today list couldn't load. Pull to refresh or try again shortly.
      </p>
    );
  }
  const sections = groupTodayItems(data ?? []);
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  if (total === 0) {
    return (
      <p className="text-muted-foreground">
        Nothing due. New leads arrive after the Monday gate.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {sections
        .filter((s) => s.items.length > 0)
        .map((section) => (
          <section key={section.key} aria-labelledby={`today-${section.key}`}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h2 id={`today-${section.key}`} className="text-lg font-semibold">
                {section.title}{" "}
                <span className="text-muted-foreground font-normal">
                  {section.items.length}
                </span>
              </h2>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {section.hint}
              </span>
            </div>
            <div className="divide-y border-t">
              {section.items.map((item) => (
                <TodayRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
};

const DesktopToday = () => (
  <div className="mt-2 max-w-3xl">
    <Card>
      <CardContent>
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold">Today</h1>
          <Link to="/board" className="text-sm underline">
            Board by stage
          </Link>
        </div>
        <RehearsalNote />
        <TodaySections />
      </CardContent>
    </Card>
  </div>
);

const MobileToday = () => {
  const { title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold py-3 truncate">
          Today <span className="sr-only">· {title}</span>
        </h1>
      </MobileHeader>
      <MobileContent>
        <div className="flex justify-end mb-2">
          <Link to="/board" className="text-sm underline">
            Board by stage
          </Link>
        </div>
        <RehearsalNote />
        <TodaySections />
      </MobileContent>
    </>
  );
};

/** The morning screen: every action due, grouped by when. */
export const TodayPage = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileToday /> : <DesktopToday />;
};
