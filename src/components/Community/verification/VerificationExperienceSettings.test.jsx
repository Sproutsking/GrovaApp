import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import VerificationExperienceSettings from "./VerificationExperienceSettings";
import { DEFAULT_VERIFICATION_CONFIG } from "./verificationConfig";

describe("VerificationExperienceSettings", () => {
  it("updates the selected theme and owner-editable congratulations copy", () => {
    const onChange = jest.fn();
    render(<VerificationExperienceSettings value={DEFAULT_VERIFICATION_CONFIG} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Emerald Aurora/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      panel: expect.objectContaining({ theme: "aurora" }),
    }));

    fireEvent.change(screen.getByLabelText("Congratulations heading"), { target: { value: "Welcome!" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completion: expect.objectContaining({ title: "Welcome!" }),
    }));
  });
});
