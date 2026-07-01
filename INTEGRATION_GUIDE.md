// ============================================================================
// INTEGRATION_GUIDE.md — GrovaApp Major Features Integration
// ============================================================================

## Overview
This guide integrates 6 major feature sets into GrovaApp for enhanced calling,
messaging, streaming, and voice/video note capabilities.

## Features Implemented

### 1. Call Timing Optimizer ✓
**File:** `src/services/messages/CallTimingOptimizer.js`

**Usage in ActiveCall.jsx:**
```jsx
import CallTimingOptimizer from "../../services/messages/CallTimingOptimizer";

// In your call setup:
const { stream, channel } = await CallTimingOptimizer.parallelSetup(
  callId,
  mediaConstraints
);

// For eager offer creation:
await CallTimingOptimizer.createAndSendEagerOffer(pc, channel, callId);
```

### 2. Message Action Menu ✓
**Files:** 
- `src/components/Messages/MessageActionMenu.jsx`
- `src/components/Messages/MessageActionMenu.css`

**Integration in ChatView.jsx:**
```jsx
import MessageActionMenu from "./MessageActionMenu";

// Wrap your message with the menu:
<MessageActionMenu
  messageId={msg.id}
  isSentByMe={isSentByMe(msg, currentUser)}
  messageText={msg.content}
  onReply={() => setReplyingTo(msg)}
  onReact={() => showReactionPicker(msg)}
  onCopy={() => navigator.clipboard.writeText(msg.content)}
  onDelete={() => deleteMessage(msg.id)}
  onForward={() => showForwardDialog(msg)}
  messageRect={messageRef.current?.getBoundingClientRect()}
  isGroupChat={false}
/>
```

### 3. Group Admin Manager ✓
**File:** `src/services/messages/GroupAdminManager.js`

**Usage in GroupChatView.jsx:**
```jsx
import GroupAdminManager from "../../services/messages/GroupAdminManager";

// Check if user can perform action:
if (GroupAdminManager.validateGroupOperation("kick_member", currentUser, group)) {
  await GroupAdminManager.kickMember(groupId, memberId, currentUser, group);
}

// Get user tier:
const tier = GroupAdminManager.getMemberTier(user);
const maxMembers = GroupAdminManager.getMaxMembers(tier);

// Update group image:
await GroupAdminManager.updateGroupImage(groupId, imageId, currentUser, group);
```

### 4. Voice Note Recorder ✓
**Files:**
- `src/components/Messages/VoiceNoteRecorder.jsx`
- `src/components/Messages/VoiceNoteRecorder.css`

**Integration in MessageInput.jsx:**
```jsx
import VoiceNoteRecorder from "./VoiceNoteRecorder";

<VoiceNoteRecorder
  onSend={async (data) => {
    // Upload blob and send as message
    const url = await uploadMedia(data.blob);
    await sendMessage({
      type: "voice",
      url: url,
      duration: data.duration,
    });
  }}
  onCancel={() => console.log("Cancelled")}
  maxDuration={120}
/>
```

### 5. Video Note Recorder ✓
**Files:**
- `src/components/Messages/VideoNoteRecorder.jsx`
- `src/components/Messages/VideoNoteRecorder.css`

**Integration in MessageInput.jsx:**
```jsx
import VideoNoteRecorder from "./VideoNoteRecorder";

<VideoNoteRecorder
  onSend={async (data) => {
    const url = await uploadMedia(data.blob);
    await sendMessage({
      type: "video",
      url: url,
      duration: data.duration,
      shape: data.shape,
    });
  }}
  onCancel={() => console.log("Cancelled")}
  maxDuration={60}
/>
```

### 6. Stream Stage Layout ✓
**Files:**
- `src/components/Stream/StreamStageLayout.jsx`
- `src/components/Stream/StreamStageLayout.css`

**Integration in StreamView.jsx:**
```jsx
import StreamStageLayout from "./StreamStageLayout";

<StreamStageLayout
  participants={stageParticipants}
  hostId={hostId}
  speakingIds={speakingIds}
  onParticipantAction={(participant) => {
    // Show context menu or handle action
  }}
  maxVisible={12}
/>
```

## Database Schema Updates

Add these columns to existing tables:

### group_chats table
```sql
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS admin_ids UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS muted_members UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS owner_id UUID;
```

### users table (if not exists)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_tier VARCHAR(20) DEFAULT 'normal';
-- Tiers: normal, silver, gold, diamond
```

### messages table (if not exists)
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
```

## Visual Improvements

### Call Experience
- ✓ Instant call arrival (CallTimingOptimizer)
- ✓ Premium UI with gradients and animations
- ✓ Better modal layering (prevent incoming call popup conflicts)
- [ ] TODO: Update ActiveCall.jsx UI with new premium design

### Messaging
- ✓ Elite message action menus (10px positioning)
- ✓ Voice note recording with waveform visualization
- ✓ Video note recording with shape options
- [ ] TODO: Integrate into ChatView and GroupChatView

### Group Management
- ✓ Admin system (2 admins + 1 owner)
- ✓ Tier-based member limits
- ✓ Permission validation
- [ ] TODO: Create admin settings UI in GroupChatView

### Streaming
- ✓ Intelligent grid layouts (1-12+ participants)
- ✓ Host prominence
- ✓ Speaking indicators
- [ ] TODO: Replace simple layout in StreamView

## Testing Checklist

### Calls
- [ ] Call arrives instantly when caller clicks call button
- [ ] Incoming call popup appears only once (no duplicates)
- [ ] Full-screen incoming call doesn't show popup modal
- [ ] Call quality preset selection works
- [ ] End call functions correctly

### Messaging
- [ ] Message action menu appears on long-press (mobile) / hover (desktop)
- [ ] Menu positioned 10px from message edge
- [ ] Reply/React/Copy/Delete actions work
- [ ] Works in both DM and group chats

### Group Chats
- [ ] Only 2 additional admins can be set (3 total with owner)
- [ ] Admin permissions enforced
- [ ] Member limits enforced by tier
- [ ] Group image updates correctly
- [ ] Owner can manage all admin functions

### Voice Notes
- [ ] Recording starts on button click
- [ ] Waveform animates during recording
- [ ] Can stop and send recording
- [ ] Can cancel without sending
- [ ] Duration displayed correctly

### Video Notes
- [ ] Camera permission requested
- [ ] Shape selector works
- [ ] Recording with selected shape
- [ ] Different shapes render correctly
- [ ] Can cancel and retry

### Streaming
- [ ] Grid layout changes based on participant count
- [ ] Host always visible and prominent
- [ ] Speaker indicators work
- [ ] Smooth transitions when participants join/leave
- [ ] Responsive on mobile/tablet/desktop

## Performance Considerations

1. **Call Timing**: Uses parallel operations to reduce latency
2. **Message Actions**: Uses fixed positioning for fast rendering
3. **Stream Layout**: CSS Grid for optimal performance
4. **Voice/Video**: Uses WebRTC optimizations and compression

## Accessibility

- All buttons have proper labels and contrast
- Keyboard navigation supported
- ARIA labels on dynamic content
- Color not sole indicator (icons + text)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Call doesn't arrive instantly
- Check CallTimingOptimizer priority subscription
- Verify Supabase realtime channel configuration
- Check network latency

### Message action menu not appearing
- Verify CSS is loaded
- Check z-index conflicts with other modals
- Test on mobile with long-press

### Group admin features not working
- Check database schema updates applied
- Verify permission validation logic
- Check currentUser object has correct ID fields

### Stream layout issues
- Clear browser cache
- Check participant object structure matches StreamStageLayout expectations
- Verify CSS Grid support in browser

## Future Enhancements

1. Call recording and playback
2. Screen sharing in calls
3. End-to-end encryption
4. Voice/video note effects and filters
5. Stream monetization features
6. Advanced analytics
