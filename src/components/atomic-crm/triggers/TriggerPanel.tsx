import {
  useCreate,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { Contact } from "../types";
import { RehearsalNote } from "./RehearsalNote";
import { WindowChip } from "./WindowChip";
import {
  formatDay,
  secondSignalLabel,
  stageLabel,
  todayIso,
  touchLabel,
  TOUCHES,
  type OutreachTouch,
  type RepCard,
  type TriggerEvent,
} from "./triggerModel";

type LeadFields = {
  id: Contact["id"];
  engine_fit: string | null;
  email_status: string | null;
  email_jsonb: Contact["email_jsonb"];
};

const REP_CARD_BOXES: { key: keyof RepCard; title: string }[] = [
  { key: "go_call", title: "Go" },
  { key: "why_now", title: "Why now (for you, not for the email)" },
  { key: "know", title: "Know" },
  { key: "say", title: "Say" },
  { key: "watch_out", title: "Watch out" },
  { key: "contact_clock", title: "Contact and clock" },
  { key: "open_before_send", title: "Open before send" },
];

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) =>
  children ? (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {children}
    </div>
  ) : null;

const SourceLink = ({ href }: { href: string | null }) =>
  href ? (
    <>
      {" "}
      <a href={href} target="_blank" rel="noreferrer" className="underline">
        source
      </a>
    </>
  ) : null;

const RepCardView = ({ card }: { card: RepCard }) => (
  <div className="rounded-md border p-3 flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="font-semibold">Rep card</h3>
      {card.checked_on ? (
        <span className="text-xs text-muted-foreground">
          checked {formatDay(card.checked_on)}
        </span>
      ) : null}
    </div>
    {card.header ? <p className="text-sm font-medium">{card.header}</p> : null}
    {REP_CARD_BOXES.map(({ key, title }) =>
      card[key] ? (
        <div key={key} className="text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <p className="whitespace-pre-line">{String(card[key])}</p>
        </div>
      ) : null,
    )}
  </div>
);

const TouchLog = ({ event }: { event: TriggerEvent }) => {
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const { data: touches, refetch } = useGetList<OutreachTouch>(
    "outreach_touches",
    {
      filter: { contact_id: event.contact_id },
      sort: { field: "touched_on", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: event.contact_id != null },
  );
  const logged = new Set((touches ?? []).map((t) => t.touch));

  const logTouch = (touch: (typeof TOUCHES)[number]) => {
    create(
      "outreach_touches",
      {
        data: {
          client_id: event.client_id,
          trigger_event_id: event.id,
          contact_id: event.contact_id,
          channel: touch.channel,
          touch: touch.touch,
          touched_on: todayIso(),
        },
      },
      {
        onSuccess: () => {
          notify(`${touch.label}: logged for today`, { type: "info" });
          refetch();
        },
        onError: () =>
          notify("Couldn't log that touch. Try again.", { type: "error" }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Touches</h3>
      <div className="flex flex-wrap gap-2">
        {TOUCHES.map((t) => (
          <Button
            key={t.touch}
            type="button"
            size="sm"
            variant={logged.has(t.touch) ? "secondary" : "outline"}
            disabled={isPending}
            onClick={() => logTouch(t)}
          >
            {t.label}
            {logged.has(t.touch) ? " ✓" : ""}
          </Button>
        ))}
      </div>
      {touches && touches.length > 0 ? (
        <ul className="text-sm flex flex-col gap-1">
          {touches.map((t) => (
            <li key={t.id}>
              <span className="text-muted-foreground">
                {formatDay(t.touched_on)}
              </span>{" "}
              {touchLabel(t.touch)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No touches logged yet.</p>
      )}
    </div>
  );
};

/**
 * Trigger Desk panel for a contact: rep card first, then the trigger facts
 * a rep needs, then the touch log with one-tap logging.
 */
export const TriggerPanel = () => {
  const contact = useRecordContext<Contact>();
  const { data: events, isPending } = useGetList<TriggerEvent>(
    "trigger_events_live",
    {
      filter: { contact_id: contact?.id },
      sort: { field: "detected_date", order: "DESC" },
      pagination: { page: 1, perPage: 5 },
    },
    { enabled: contact?.id != null },
  );
  const event = events?.[0];
  const { data: repCards } = useGetList<RepCard>(
    "rep_cards",
    {
      filter: { trigger_event_id: event?.id },
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: event != null },
  );
  const { data: lead } = useGetOne<LeadFields>(
    "contact_lead_fields",
    { id: contact?.id },
    { enabled: contact?.id != null },
  );

  if (!contact || isPending) return null;
  if (!event) {
    return (
      <p className="text-sm text-muted-foreground">
        No trigger on file for this person.
      </p>
    );
  }
  const repCard = repCards?.[0];
  const email = lead?.email_jsonb?.[0]?.email;

  return (
    <div className="flex flex-col gap-4">
      <RehearsalNote />
      {repCard ? <RepCardView card={repCard} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{stageLabel(event.stage)}</Badge>
        <WindowChip
          windowStatus={event.window_status}
          dayCount={event.day_count}
        />
        {event.gate ? (
          <Badge variant="outline">Gate: {event.gate}</Badge>
        ) : null}
        {event.send_order != null ? (
          <Badge variant="outline">Send order {event.send_order}</Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Field label="Next action">
          {event.next_action}
          {event.next_action_date
            ? ` (${formatDay(event.next_action_date)})`
            : null}
        </Field>
        <Field label="Gate note">{event.gate_note}</Field>
      </div>

      <Separator />

      <div className="flex flex-col gap-1">
        <Field label="Trigger">
          {event.trigger_detail}
          {event.trigger_detail ? (
            <SourceLink href={event.trigger_source} />
          ) : null}
        </Field>
        <Field label="Second signal">
          {event.second_signal_detail ?? secondSignalLabel(event.second_signal)}
          {event.second_signal_date
            ? ` (${formatDay(event.second_signal_date)})`
            : null}
          {event.second_signal_detail || event.second_signal ? (
            <SourceLink href={event.second_signal_source} />
          ) : null}
        </Field>
        <Field label="Engine fit">{lead?.engine_fit}</Field>
        <Field label="Email">
          {email}
          {email && lead?.email_status
            ? ` (${lead.email_status.replace(/_/g, "-")})`
            : null}
        </Field>
        {event.asset_url ? (
          <Field label="One-pager">
            <a
              href={event.asset_url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              open
            </a>
          </Field>
        ) : null}
      </div>

      <Separator />

      <TouchLog event={event} />
    </div>
  );
};
