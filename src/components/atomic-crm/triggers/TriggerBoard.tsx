import { useState } from "react";
import { useGetList, useGetMany } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { MobileBackButton } from "../misc/MobileBackButton";
import type { Company, Contact } from "../types";
import { RehearsalNote } from "./RehearsalNote";
import { WindowChip } from "./WindowChip";
import { STAGES, type TriggerEvent, type TriggerStage } from "./triggerModel";

type BoardCard = TriggerEvent & { name: string; company: string };

const useBoardCards = () => {
  const {
    data: events,
    isPending,
    error,
  } = useGetList<TriggerEvent>("trigger_events_live", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "send_order", order: "ASC" },
  });
  const contactIds = Array.from(
    new Set((events ?? []).map((e) => e.contact_id).filter((id) => id != null)),
  );
  const companyIds = Array.from(
    new Set((events ?? []).map((e) => e.company_id).filter((id) => id != null)),
  );
  const { data: contacts } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const cards: BoardCard[] = (events ?? []).map((e) => {
    const c = contacts?.find((x) => x.id === e.contact_id);
    const co = companies?.find((x) => x.id === e.company_id);
    return {
      ...e,
      name: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "",
      company: co?.name ?? "",
    };
  });
  return { cards, isPending, error };
};

const sortCards = (a: BoardCard, b: BoardCard) =>
  (a.send_order ?? 999) - (b.send_order ?? 999) ||
  (b.day_count ?? 0) - (a.day_count ?? 0);

const cardsFor = (cards: BoardCard[], stage: TriggerStage) =>
  cards.filter((c) => c.stage === stage).sort(sortCards);

const StageCard = ({ card }: { card: BoardCard }) => {
  const inner = (
    <div className="rounded-md border bg-card p-2 text-sm flex flex-col gap-1">
      <div className="font-medium leading-tight">
        {card.send_order != null ? (
          <span className="text-muted-foreground mr-1">#{card.send_order}</span>
        ) : null}
        {card.name || "Unnamed"}
      </div>
      {card.company ? (
        <div className="text-muted-foreground leading-tight">
          {card.company}
        </div>
      ) : null}
      <WindowChip windowStatus={card.window_status} dayCount={card.day_count} />
    </div>
  );
  return card.contact_id != null ? (
    <Link
      to={`/contacts/${card.contact_id}/show`}
      className="no-underline text-inherit hover:opacity-80"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
};

const BoardState = ({
  isPending,
  error,
}: {
  isPending: boolean;
  error: unknown;
}) =>
  isPending ? (
    <div className="flex gap-3">
      <Skeleton className="h-40 w-48" />
      <Skeleton className="h-40 w-48" />
      <Skeleton className="h-40 w-48" />
    </div>
  ) : error ? (
    <p className="text-muted-foreground">The board couldn't load.</p>
  ) : null;

const DesktopBoard = () => {
  const { cards, isPending, error } = useBoardCards();
  const [showClosed, setShowClosed] = useState(false);
  const closed = cardsFor(cards, "closed_out");
  return (
    <div className="mt-2">
      <Card>
        <CardContent>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h1 className="text-2xl font-semibold">Board by stage</h1>
            <Link to="/" className="text-sm underline">
              Back to Today
            </Link>
          </div>
          <RehearsalNote />
          {isPending || error ? (
            <BoardState isPending={isPending} error={error} />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STAGES.filter((s) => s.id !== "closed_out").map((stage) => {
                const list = cardsFor(cards, stage.id);
                return (
                  <div key={stage.id} className="w-48 min-w-48 flex flex-col">
                    <h2 className="text-sm font-semibold mb-2">
                      {stage.label}{" "}
                      <span className="text-muted-foreground font-normal">
                        {list.length}
                      </span>
                    </h2>
                    <div className="flex flex-col gap-2">
                      {list.map((card) => (
                        <StageCard key={card.id} card={card} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="w-48 min-w-48 flex flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start px-0 mb-2 font-semibold"
                  onClick={() => setShowClosed((v) => !v)}
                >
                  Closed out{" "}
                  <span className="text-muted-foreground font-normal">
                    {closed.length} · {showClosed ? "hide" : "show"}
                  </span>
                </Button>
                {showClosed ? (
                  <div className="flex flex-col gap-2">
                    {closed.map((card) => (
                      <StageCard key={card.id} card={card} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const MobileBoard = () => {
  const { cards, isPending, error } = useBoardCards();
  const [showClosed, setShowClosed] = useState(false);
  return (
    <>
      <MobileHeader>
        <MobileBackButton to="/" />
        <h1 className="flex-1 text-xl font-semibold py-3 truncate">
          Board by stage
        </h1>
      </MobileHeader>
      <MobileContent>
        <RehearsalNote />
        {isPending || error ? (
          <BoardState isPending={isPending} error={error} />
        ) : (
          <div className="flex flex-col gap-5">
            {STAGES.map((stage) => {
              const list = cardsFor(cards, stage.id);
              const isClosed = stage.id === "closed_out";
              return (
                <section key={stage.id}>
                  <h2 className="text-base font-semibold mb-2">
                    {stage.label}{" "}
                    <span className="text-muted-foreground font-normal">
                      {list.length}
                    </span>
                    {isClosed ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowClosed((v) => !v)}
                      >
                        {showClosed ? "hide" : "show"}
                      </Button>
                    ) : null}
                  </h2>
                  {!isClosed || showClosed ? (
                    <div className="flex flex-col gap-2">
                      {list.map((card) => (
                        <StageCard key={card.id} card={card} />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </MobileContent>
    </>
  );
};

/** Every trigger lead in pipeline order, one tap from Today. */
export const TriggerBoard = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileBoard /> : <DesktopBoard />;
};

TriggerBoard.path = "/board";
