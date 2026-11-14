import { render, screen, fireEvent } from "@testing-library/react";
import QuickActions from "../QuickActions";

// The send flow pulls in the Stellar SDK, which is irrelevant to these
// accessibility assertions and slow to load under jsdom.
jest.mock("../../transactions/SendPaymentModal", () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="send-payment-modal">
      <button onClick={onClose}>Close Send</button>
    </div>
  ),
}));

jest.mock("@/hooks/useWallet", () => ({
  __esModule: true,
  default: () => ({ freighter: { publicKey: "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO" } }),
}));

jest.mock("@/components/offline/OfflineProvider", () => ({
  useOffline: () => ({ isOnline: true, queueAction: jest.fn() }),
}));

jest.mock("@/context/NotificationContext", () => ({
  useNotifications: () => ({ addNotification: jest.fn() }),
}));

describe("QuickActions", () => {
  it('labels the Send button as "Send payment"', () => {
    render(<QuickActions />);

    const send = screen.getByRole("button", { name: "Send payment" });
    expect(send).toHaveAttribute("aria-label", "Send payment");
  });

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

  it("renders visible keyboard shortcut hints on all quick action buttons", () => {
    render(<QuickActions />);

    expect(screen.getByTestId("shortcut-hint-send")).toHaveTextContent("S");
    expect(screen.getByTestId("shortcut-hint-receive")).toHaveTextContent("R");
    expect(screen.getByTestId("shortcut-hint-budget")).toHaveTextContent("B");
    expect(screen.getByTestId("shortcut-hint-goal")).toHaveTextContent("G");
    expect(screen.getByTestId("shortcut-hint-split")).toHaveTextContent("X");
  });

  it("triggers Send, Receive, Budget, Goal, and Split Bill via keyboard shortcuts and closes with Escape", () => {
    const onSplitBill = jest.fn();
    render(<QuickActions onSplitBill={onSplitBill} />);

    // Press S -> opens Send modal
    fireEvent.keyDown(window, { key: "s" });
    expect(screen.getByTestId("send-payment-modal")).toBeInTheDocument();

    // Press Escape -> closes Send modal
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("send-payment-modal")).toBeNull();

    // Press R -> opens Receive modal
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.getByText("Receive Assets")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    // Press B -> opens Budget modal
    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByRole("heading", { name: "New Budget" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    // Press G -> opens Goal modal
    fireEvent.keyDown(window, { key: "g" });
    expect(screen.getByRole("heading", { name: "New Goal" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    // Press X -> triggers onSplitBill
    fireEvent.keyDown(window, { key: "x" });
    expect(onSplitBill).toHaveBeenCalledTimes(1);
  });

  it("does not conflict with browser modifier shortcuts or typing inside input fields", () => {
    render(
      <div>
        <input data-testid="search-input" type="text" />
        <QuickActions />
      </div>
    );

    // Ctrl+R / Meta+S / Alt+B must not open modals
    fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    fireEvent.keyDown(window, { key: "b", altKey: true });
    expect(screen.queryByTestId("send-payment-modal")).toBeNull();
    expect(screen.queryByText("Receive Assets")).toBeNull();

    // Typing inside an input must not trigger quick action shortcuts
    const input = screen.getByTestId("search-input");
    fireEvent.keyDown(input, { key: "s" });
    expect(screen.queryByTestId("send-payment-modal")).toBeNull();
  });
});
