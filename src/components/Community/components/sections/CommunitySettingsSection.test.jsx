import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunitySettingsSection from "./CommunitySettingsSection";
import { supabase } from "../../../../services/config/supabase";

jest.mock("../../../../services/config/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("CommunitySettingsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockImplementation(() => {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return query;
    });
  });

  it("keeps a saved community image URL out of the editable text and preview copy", async () => {
    const imageUrl = "https://images.example/community.png?signature=private-value";
    const { container } = render(
      <CommunitySettingsSection
        community={{ id: "community-1", owner_id: "owner-1", icon: imageUrl, settings: {} }}
        userId="owner-1"
        onUpdate={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByAltText("Community preview").getAttribute("src")).toBe(imageUrl));
    expect(screen.getByRole("textbox", { name: "Community emoji" }).value).toBe("");
    expect(container.textContent).not.toContain(imageUrl);
    expect(screen.getByText("Community image set")).not.toBeNull();
  });

  it("previews channel appearance selections before saving", () => {
    const { container } = render(
      <CommunitySettingsSection
        community={{ id: "community-2", owner_id: "owner-2", settings: {} }}
        userId="owner-2"
        onUpdate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Sharp corners/ }));
    expect(container.querySelector(".chb")?.className).toContain("chb--no-radius");
    expect(screen.getByRole("button", { name: /Sharp corners/ }).getAttribute("aria-pressed")).toBe("true");
  });
});
