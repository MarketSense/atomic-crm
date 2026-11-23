import { NOTION_IS_RECORD } from "./triggerModel";

/** Reminder shown during the rehearsal, while Notion is still the record. */
export const RehearsalNote = () =>
  NOTION_IS_RECORD ? (
    <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 mb-4">
      Rehearsal: Notion is still the record for MarketSense leads. Keep entering
      changes in Notion; this screen shows the last copy.
    </p>
  ) : null;
