import { STREAM_REGISTRY, STREAM_TYPES } from "./streamRegistry";
import { XRC_EVENTS } from "./xrcService";

it("keeps XRD claim lifecycle events in a dedicated XRC stream", () => {
  expect(STREAM_TYPES.XDRC).toBe("XDRC");
  expect(STREAM_REGISTRY[STREAM_TYPES.XDRC]).toMatchObject({
    label: "XRD Record Chain",
    requiresRealUser: true,
    sensitive: true,
  });
});

it("records identity changes without including the identity field values", () => {
  expect(XRC_EVENTS.identityDetailsUpdated("profile-1", ["bio", "visibility"], "public")).toEqual({
    event: "identity_details_updated",
    user_id: "profile-1",
    updated_fields: ["bio", "visibility"],
    visibility: "public",
  });
});

it("records platform connection assurance without storing external account identifiers", () => {
  expect(XRC_EVENTS.platformConnected("github", {
    id: "connection-1",
    connected_via: "oauth_popup",
    auth_status: "active",
    platform_user_id: "must-not-be-copied",
  })).toEqual({
    event: "platform_connected",
    provider: "github",
    connection_id: "connection-1",
    connection_method: "oauth_popup",
    auth_status: "active",
    assurance_scope: "account_control",
  });
});

it("marks an existing platform link as observed at reconciliation time", () => {
  expect(XRC_EVENTS.platformConnectionObserved("github", {
    id: "connection-1",
    connected_via: "oauth_popup",
    auth_status: "active",
    platform_user_id: "must-not-be-copied",
  })).toEqual({
    event: "platform_connection_observed",
    provider: "github",
    connection_id: "connection-1",
    connection_method: "oauth_popup",
    auth_status: "active",
    assurance_scope: "account_control",
  });
});
