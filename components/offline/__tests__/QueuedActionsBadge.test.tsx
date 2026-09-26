import { render, screen } from "@testing-library/react";
import QueuedActionsBadge from "../QueuedActionsBadge";

describe("QueuedActionsBadge", () => {
  it("shows count when count is greater than zero", () => {
    render(<QueuedActionsBadge count={3} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders nothing when count is zero", () => {
    const { container } = render(
      <QueuedActionsBadge count={0} />
    );

    expect(container.firstChild).toBeFalsy();
  });

  it("renders nothing when count is negative", () => {
    const { container } = render(
      <QueuedActionsBadge count={-1} />
    );

    expect(container.firstChild).toBeFalsy();
  });
});