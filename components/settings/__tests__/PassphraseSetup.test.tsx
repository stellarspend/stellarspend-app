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
});
