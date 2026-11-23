import { render } from "vitest-browser-react";
import { buildCompany, buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { TriggerBoard } from "./TriggerBoard";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

const event = (id: number, stage: string, send_order: number | null) => ({
  id,
  contact_id: id,
  company_id: id,
  stage,
  send_order,
  window_status: "write",
  day_count: 30,
});

describe.each([true, false])("TriggerBoard (mobile=%s)", (mobile) => {
  beforeEach(() => mockIsMobile.mockReturnValue(mobile));
  it("renders leads by stage", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          trigger_events_live: [
            event(1, "ready_to_send", 1),
            event(2, "hold", null),
            event(3, "closed_out", null),
          ],
          contacts: [
            buildContact({ id: 1, first_name: "Ada", last_name: "One" }),
            buildContact({ id: 2, first_name: "Bob", last_name: "Two" }),
            buildContact({ id: 3, first_name: "Cy", last_name: "Three" }),
          ],
          companies: [
            buildCompany({ id: 1, name: "Acme" }),
            buildCompany({ id: 2, name: "Beta" }),
            buildCompany({ id: 3, name: "Gamma" }),
          ],
        }}
      >
        <TriggerBoard />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText(/Ada One/)).toBeVisible();
  });
});
