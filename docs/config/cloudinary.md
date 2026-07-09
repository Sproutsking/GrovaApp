# Cloudinary Accounts — Mapping & Usage

Goal: absolute clarity on which Cloudinary account is used for what and where the corresponding env vars are referenced in the codebase.

Accounts recommended:

1) `CLOUD_PROFILES_*` (profiles account)
- Purpose: avatars, cover images, small transforms for profile display.
- Usage locations: `src/components/Account/*`, `src/components/Shared/ProfilePreview.jsx`, profile upload flows.
- Recommended transforms: 100x100 avatar webp, 200x200 display.
- Env vars: `CLOUD_PROFILES_NAME`, `CLOUD_PROFILES_KEY`, `CLOUD_PROFILES_SECRET`.

2) `CLOUD_CONTENT_*` (content images)
- Purpose: post images, story images, thumbnails.
- Usage locations: `src/components/MediaUploader/*`, post creation flows, feed rendering.
- Recommended transforms: thumbnail (320x180), medium (720x405), full (max width 2048), auto quality.
- Env vars: `CLOUD_CONTENT_NAME`, `CLOUD_CONTENT_KEY`, `CLOUD_CONTENT_SECRET`.

3) `CLOUD_REELS_*` (video heavy)
- Purpose: reels, long-form video, HLS/DASH outputs, streaming assets.
- Usage locations: `src/components/wallet/paywave/tabs/`, `src/components/MediaUploader/VideoEditor.jsx`, live streaming components.
- Recommended settings: adaptive bitrate, streaming profile, CDN + geo-replication if needed.
- Env vars: `CLOUD_REELS_NAME`, `CLOUD_REELS_KEY`, `CLOUD_REELS_SECRET`.

4) `CLOUD_ADMIN_*` (administrative and backups)
- Purpose: internal exports, archived assets, diagnostic uploads.
- Usage locations: admin scripts, migration utilities, backups.
- Env vars: `CLOUD_ADMIN_NAME`, `CLOUD_ADMIN_KEY`, `CLOUD_ADMIN_SECRET`.


## Migration notes
- Dual-write during migration: implement uploader to write to both old `REACT_APP_CLOUDINARY_CLOUD_NAME` (legacy) and new targeted account; switch reads to new URL only after full migration.
- Batch copy: use Cloudinary admin API to copy resources between clouds or use signed downloads + reupload script.


## Quick find usages (examples)

```bash
# Find legacy cloud name usage
grep -R "REACT_APP_CLOUDINARY" -n src || true

# Find cloudinary uploader usage
grep -R "cloudinary" -n src || true
```
