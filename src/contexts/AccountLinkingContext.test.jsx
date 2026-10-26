import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AccountLinkingProvider, useAccountLinking } from "./AccountLinkingContext";
import socialConnectService from "../services/distribution/socialConnectService";

jest.mock("../services/distribution/socialConnectService", () => ({
  __esModule: true,
  default: {
    linkPlatform: jest.fn(),
    saveProfileLink: jest.fn(),
  },
}));

function Harness({ platform = "x", userId = "user-1" }) {
  const { openAccountLink } = useAccountLinking();
  const [result, setResult] = React.useState("");
  return (
    <>
      <button type="button" onClick={() => openAccountLink({ userId, platform }).then((value) => setResult(JSON.stringify(value)))}>
        Open linker
      </button>
      <output data-testid="result">{result}</output>
    </>
  );
}

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("AccountLinkingProvider", () => {
  it("completes OAuth inside the shared dialog and returns the result to its caller", async () => {
    const popup = { closed: false, close: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue(popup);
    let resolveLink;
    socialConnectService.linkPlatform.mockReturnValue(new Promise((resolve) => { resolveLink = resolve; }));
    render(<AccountLinkingProvider><Harness /></AccountLinkingProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Open linker" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue to platform" }));
    expect(socialConnectService.linkPlatform).toHaveBeenCalledWith(
      "user-1",
      "x",
      expect.objectContaining({ readOnly: false, popup }),
    );
    await act(async () => {
      resolveLink({ platform: "x", platformUserId: "x-user" });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(screen.getByText("X (Twitter) authorized. Returning you to what you were doing…")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("result")).toHaveTextContent('"platform":"x"');
  });

  it("routes profile URLs through the shared validation flow and discloses that ownership is unverified", async () => {
    socialConnectService.saveProfileLink.mockResolvedValue({
      platform: "youtube",
      profileUrl: "https://youtube.com/@sproutsking",
      ownershipVerified: false,
    });
    render(<AccountLinkingProvider><Harness platform="youtube" /></AccountLinkingProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Open linker" }));
    expect(screen.getByText(/does not prove account ownership/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Public profile URL"), { target: { value: "https://youtube.com/@sproutsking" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile link" }));
    await waitFor(() => expect(socialConnectService.saveProfileLink).toHaveBeenCalledWith(
      "user-1",
      "youtube",
      "https://youtube.com/@sproutsking",
    ));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("result")).toHaveTextContent('"ownershipVerified":false');
  });

  it("returns to the caller without altering its page when the dialog is cancelled", async () => {
    render(<AccountLinkingProvider><Harness /></AccountLinkingProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open linker" }));
    await act(async () => {
      screen.getByRole("button", { name: "Cancel" }).click();
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("result")).toHaveTextContent('"cancelled":true');
  });
});
