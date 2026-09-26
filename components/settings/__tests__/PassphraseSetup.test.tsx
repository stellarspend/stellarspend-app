import { fireEvent, render, screen } from "@testing-library/react";
import { PassphraseSetup } from "../PassphraseSetup";

jest.mock("../../../context/WalletContext", () => ({
  useWalletContext: () => ({
    passphraseSet: false,
    setPassphrase: jest.fn(),
    unlock: jest.fn(),
    resetLocalData: jest.fn(),
  }),
}));

jest.mock("../../offline/OfflineProvider", () => ({
  useOffline: () => ({
    unlockQueue: jest.fn(),
  }),
}));

describe("PassphraseSetup", () => {
  it("toggles the passphrase visibility button aria-label", () => {
    render(<PassphraseSetup />);

    const toggleButton = screen.getByRole("button", {
      name: "Show passphrase",
    });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(
      screen.getByRole("button", { name: "Hide passphrase" }),
    ).toBeInTheDocument();
  });

  it("toggles passphrase input type between password and text when show/hide is clicked", () => {
    render(<PassphraseSetup />);

    const passphraseInput = screen.getByPlaceholderText(
      "Enter passphrase (min 6 characters)",
    );
    expect(passphraseInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show passphrase" }));
    expect(passphraseInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide passphrase" }));
    expect(passphraseInput).toHaveAttribute("type", "password");
  });
});
