import { render, screen } from "@testing-library/react";
import QuickActions from "../QuickActions";

// The send flow pulls in the Stellar SDK, which is irrelevant to these
// accessibility assertions and slow to load under jsdom.
jest.mock("../../transactions/SendPaymentModal", () => ({
  __esModule: true,
  default: () => null,
}));

describe("QuickActions", () => {
  it("exposes an accessible name for the New Goal button", () => {
    render(<QuickActions />);

    const newGoal = screen.getByRole("button", {
      name: "Create new savings goal",
    });
    expect(newGoal).toHaveAttribute("aria-label", "Create new savings goal");
    expect(newGoal).toHaveAttribute("id", "quick-action-goal");
  });

  it("gives every quick action an accessible name", () => {
    render(<QuickActions />);

    for (const name of [
      "Send payment",
      "Receive payment",
      "Create new budget",
      "Create new savings goal",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });
});
