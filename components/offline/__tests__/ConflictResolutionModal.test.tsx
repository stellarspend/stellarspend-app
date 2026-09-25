import { fireEvent, render, screen } from "@testing-library/react";

import ConflictResolutionModal from "../ConflictResolutionModal";
import type { ConflictPrompt } from "../actionHandlers";

function makePrompt(overrides: Partial<ConflictPrompt> = {}): ConflictPrompt {
  const current = {
    id: "budget_1",
    name: "Groceries",
    amount: 800,
    updatedAt: "2026-03-01T11:00:00.000Z",
  };

  return {
    actionId: "q1",
    type: "UPDATE_BUDGET",
    recordId: "budget_1",
    label: "Groceries",
    queuedAt: Date.parse("2026-03-01T10:01:00.000Z"),
    update: {
      id: "budget_1",
      changes: { amount: 650 },
      base: { id: "budget_1", name: "Groceries", amount: 500 },
      baseVersion: "2026-03-01T10:00:00.000Z",
      legacy: false,
    },
    detection: {
      status: "conflict",
      record: current,
      current,
      conflicts: [{ field: "amount", mine: 650, theirs: 800 }],
      autoMergedFields: [],
    },
    ...overrides,
  };
}

describe("ConflictResolutionModal", () => {
  it("describes the clash in plain language and shows both values", () => {
    render(
      <ConflictResolutionModal conflict={makePrompt()} onResolve={jest.fn()} />,
    );

    expect(
      screen.getByRole("dialog", { name: /this budget was changed in two places/i }),
    ).toBeTruthy();
    expect(screen.getByText(/You changed .Groceries. on this device/)).toBeTruthy();
    expect(screen.getByText("Amount")).toBeTruthy();
    expect(screen.getByText(/Keep what I changed/)).toBeTruthy();
    expect(screen.getByText(/Keep what.s saved/)).toBeTruthy();
    expect(screen.getByText("650")).toBeTruthy();
    expect(screen.getByText("800")).toBeTruthy();

    // No version-control jargon leaks into the UI.
    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).not.toMatch(/merge|three-way|diff\b|commit/i);
  });

  it("defaults to keeping the saved value and does not resolve on its own", () => {
    const onResolve = jest.fn();
    render(
      <ConflictResolutionModal conflict={makePrompt()} onResolve={onResolve} />,
    );

    expect(screen.getByRole("radio", { name: /Keep what.s saved/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Keep what I changed/ })).not.toBeChecked();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("resolves with the offline values when the user keeps them", () => {
    const onResolve = jest.fn();
    render(
      <ConflictResolutionModal conflict={makePrompt()} onResolve={onResolve} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Keep all my values" }));

    expect(onResolve).toHaveBeenCalledWith({ strategy: "keep_mine" });
  });

  it("resolves with the saved values when the user keeps those", () => {
    const onResolve = jest.fn();
    render(
      <ConflictResolutionModal conflict={makePrompt()} onResolve={onResolve} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Keep all saved values" }));

    expect(onResolve).toHaveBeenCalledWith({ strategy: "keep_theirs" });
  });

  it("supports deciding per field", () => {
    const onResolve = jest.fn();
    render(
      <ConflictResolutionModal conflict={makePrompt()} onResolve={onResolve} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Keep what I changed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));

    expect(onResolve).toHaveBeenCalledWith({
      strategy: "choose_fields",
      choices: { amount: "mine" },
    });
  });

  it("explains which offline changes will be saved automatically", () => {
    const prompt = makePrompt({
      detection: {
        ...makePrompt().detection,
        autoMergedFields: ["category"],
      },
    });

    render(<ConflictResolutionModal conflict={prompt} onResolve={jest.fn()} />);

    expect(
      screen.getByText(/Your change to Category doesn.t clash/),
    ).toBeTruthy();
    expect(screen.getByText(/saved automatically/)).toBeTruthy();
  });

  it("lets the user postpone the decision", () => {
    const onDecideLater = jest.fn();
    render(
      <ConflictResolutionModal
        conflict={makePrompt()}
        onResolve={jest.fn()}
        onDecideLater={onDecideLater}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Decide later" }));
    expect(onDecideLater).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDecideLater).toHaveBeenCalledTimes(2);
  });
});
