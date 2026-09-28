jest.mock("../../services/config/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://storage.example/audio.mp3" } })),
      })),
    },
  },
}));

import { probeAudioTrack, resolveCatalogAudioUrl } from "./SoundGallery";

describe("resolveCatalogAudioUrl", () => {
  it("falls back to the configured public base when the server catalog URL is empty", () => {
    expect(resolveCatalogAudioUrl({ name: "artist - track name", url: null }, "https://audio.example/library/"))
      .toBe("https://audio.example/library/artist%20-%20track%20name.mp3");
  });

  it("uses a storage path rather than the display name for public audio URLs", () => {
    expect(resolveCatalogAudioUrl({ name: "Display title", storage_path: "albums/live set/track.mp3" }, "https://audio.example"))
      .toBe("https://audio.example/albums/live%20set/track.mp3");
  });

  it("preserves a playable URL returned directly by the catalog", () => {
    expect(resolveCatalogAudioUrl({ name: "track", url: "https://cdn.example/track.ogg" }, "https://audio.example"))
      .toBe("https://cdn.example/track.ogg");
  });
});

describe("probeAudioTrack", () => {
  it("marks a URL playable when audio metadata loads", async () => {
    class AudioMock {
      duration = 12;
      load() {
        if (this.src) Promise.resolve().then(() => this.onloadedmetadata?.());
      }
      pause() {}
      removeAttribute() {}
    }

    await expect(probeAudioTrack("https://audio.example/track.mp3", AudioMock))
      .resolves.toEqual({ available: true, duration: 12 });
  });

  it("marks broken audio URLs unavailable", async () => {
    class AudioMock {
      load() {
        if (this.src) Promise.resolve().then(() => this.onerror?.());
      }
      pause() {}
      removeAttribute() {}
    }

    await expect(probeAudioTrack("https://audio.example/missing.mp3", AudioMock))
      .resolves.toEqual({ available: false, duration: 0 });
  });
});