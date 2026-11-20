import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PinSetupModal from "./PinSetupModal";
import { supabase } from "../../services/config/supabase";

jest.mock("../../services/config/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock("./TwoFactorSetupModal", () => () => null);

describe("PinSetupModal authenticator step-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { enabled: true }, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabase.from.mockReturnValue(query);
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    supabase.functions.invoke.mockResolvedValue({
      data: { success: true, authorizationToken: "a".repeat(64) },
      error: null,
    });
    supabase.rpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("requires a one-time authenticator authorization and passes it to the PIN RPC", async () => {
    render(
      <PinSetupModal
        userId="user-1"
        hasPin
        currentPinLength={4}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "6 Standard" }));
    fireEvent.click(screen.getByRole("button", { name: /Continue with 6-digit PIN/ }));
    const codeInput = await screen.findByLabelText("Authenticator code");
    expect(supabase.rpc).not.toHaveBeenCalled();

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify and continue/ }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("verify-2fa-login", {
        body: { token: "123456", purpose: "transaction_pin_change" },
      });
    });
    expect(await screen.findByText("Current PIN")).toBeInTheDocument();

    for (const digit of "1111") fireEvent.click(screen.getByRole("button", { name: digit }));
    expect(await screen.findByText("New 6-digit PIN")).toBeInTheDocument();
    for (const digit of "222222") fireEvent.click(screen.getByRole("button", { name: digit }));
    expect(await screen.findByText("Confirm New PIN")).toBeInTheDocument();
    for (const digit of "222222") fireEvent.click(screen.getByRole("button", { name: digit }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("set_transaction_pin", {
        p_new_pin: "222222",
        p_current_pin: "1111",
        p_pin_length: 6,
        p_authorization_token: "a".repeat(64),
      });
    });
  });
});
