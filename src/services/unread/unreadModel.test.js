import { getVisibleUnreadNotifications } from "./unreadModel";

describe("unread read-boundary logic", () => {
  it("ignores notifications created before the user cleared the badge", () => {
    const notifications = [
      { id: "old", is_read: false, created_at: "2024-01-01T00:00:00.000Z" },
      { id: "new", is_read: false, created_at: "2024-01-03T00:00:00.000Z" },
      { id: "read", is_read: true, created_at: "2024-01-04T00:00:00.000Z" },
    ];

    const visible = getVisibleUnreadNotifications(notifications, "2024-01-02T00:00:00.000Z");

    expect(visible.map((item) => item.id)).toEqual(["new"]);
  });
});
