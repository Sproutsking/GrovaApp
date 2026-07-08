# Bottom Nav PayWave Integration - DOM-Based Approach

## How It Works Now

### Architecture: Two Coordinated Components

```
PayWaveWrapper.jsx
├─ Adds/removes "paywave-open" class on body
└─ Works for both app back and device back

MobileBottomNav.jsx
├─ Watches for class changes via MutationObserver
├─ Instantly hides nav when class added
├─ Smoothly animates nav back when class removed
└─ Fully self-contained
```

---

## Flow Diagram

### Opening PayWave
```
User clicks Wallet tab
    ↓
WalletView sets showPayWaveV=true
    ↓
PayWaveWrapper mounts
    ↓
Effect adds "paywave-open" class to body
    ↓
MutationObserver detects class addition
    ↓
updateNavState() runs:
  - isPayWaveOpen = true
  - nav.style.display = "none" (INSTANT, no animation)
  - nav.classList.remove("mbn-show")
    ↓
Bottom nav instantly hidden (user doesn't see it disappear)
```

### Closing PayWave (Either Back Button)

#### Scenario 1: Click App Back Button
```
User clicks back button in PayWave header
    ↓
Header's onBack fires
    ↓
Calls props.onBack()
    ↓
WalletView sets showPayWaveV=false
    ↓
PayWaveWrapper unmounts
    ↓
Cleanup effect removes "paywave-open" class
    ↓
MutationObserver detects class removal
    ↓
updateNavState() runs:
  - isPayWaveOpen = false
  - nav.style.display = "flex"
  - requestAnimationFrame(() => nav.classList.add("mbn-show"))
    ↓
CSS animation plays (0.28s slide up)
    ↓
Bottom nav smoothly animates back into view
```

#### Scenario 2: Click Device Back Button
```
User presses device back button
    ↓
Browser triggers popstate event
    ↓
BackNavigationContext handler fires
    ↓
useRegisterBack callback executes
    ↓
Calls props.onBack()
    ↓
(Same as Scenario 1 from here)
    ↓
Bottom nav smoothly animates back into view
```

---

## Key Implementation Details

### 1. MobileBottomNav Effect (Lines 48-87)

```javascript
// DOM-based PayWave detection: watch body.paywave-open class
useEffect(() => {
  const nav = document.querySelector(".mbn");
  
  // Handler for class changes
  const updateNavState = () => {
    const isPayWaveOpen = document.body.classList.contains("paywave-open");
    
    if (isPayWaveOpen) {
      // INSTANT: hide immediately
      nav.style.display = "none";
      nav.classList.remove("mbn-show");
    } else {
      // SHOW: prepare for animation
      nav.style.display = "flex";
      // Trigger animation
      requestAnimationFrame(() => {
        nav.classList.add("mbn-show");
      });
    }
  };
  
  // Initialize
  updateNavState();
  
  // Watch for changes to body.class attribute
  const observer = new MutationObserver((mutations) => {
    if (mutation.attributeName === "class") {
      updateNavState();
    }
  });
  
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  
  return () => observer.disconnect();
}, []);
```

**Why this works:**
- **No state duplication**: Single source of truth is `body.paywave-open`
- **No timing issues**: MutationObserver fires immediately
- **Handles all cases**: Works for both back buttons automatically
- **Clean separation**: Hide is instant, show is animated

---

### 2. CSS Animation (Lines 109-121)

```css
/* Animation: smooth entrance when PayWave closes */
@keyframes mbnSlideIn {
  from {
    opacity: 0;
    transform: translateY(100%);  /* Slide up from bottom */
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mbn.mbn-show {
  animation: mbnSlideIn 0.28s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
```

**What happens:**
- Animation only applies when `.mbn-show` class is added
- Smooth cubic-bezier easing for natural motion
- 0.28s matches PayWave close animation
- Uses `forwards` to maintain final state

---

### 3. PayWaveWrapper Effect (Lines 234-244)

```javascript
useEffect(() => {
  // Open: add class
  document.body.classList.add("paywave-open");
  
  // Push history for browser back
  try { window.history.pushState({ paywave: true }, ""); } catch {}
  
  // Close: remove class (handles both app & device back)
  return () => {
    document.body.classList.remove("paywave-open");
    // MobileBottomNav's observer detects this and animates nav back
  };
}, []);
```

**Why it's simple:**
- Only responsible for class management
- MobileBottomNav handles all visibility logic
- No manual DOM manipulation needed
- Works for both back button types automatically

---

## Advantages Over Previous Approach

### ✅ Before (Event-Based)
- ❌ Timing issues with async event handlers
- ❌ State duplication (hidden state vs class vs events)
- ❌ Multiple failsafes needed (redundant code)
- ❌ Hard to debug race conditions

### ✅ Now (DOM-Based)
- ✅ Direct observation of actual state
- ✅ Single source of truth: body.paywave-open class
- ✅ No state duplication
- ✅ Clean separation: instant hide, animated show
- ✅ Works identically for both back button types
- ✅ Easy to understand and maintain

---

## Testing Scenarios

### Scenario 1: App Back Button
1. Open PayWave from wallet tab
2. Navigate through PayWave pages
3. Click back button in PayWave header
4. **Expected**: Bottom nav slides up smoothly
5. **Timing**: Should take 0.28s

### Scenario 2: Device Back Button
1. Open PayWave from wallet tab
2. Navigate through PayWave pages
3. Press device back button
4. **Expected**: Bottom nav slides up smoothly
5. **Timing**: Should take 0.28s

### Scenario 3: Side Nav Back (Desktop)
1. Open PayWave from sidebar
2. Click back button in side nav
3. **Expected**: Bottom nav slides up smoothly
4. **Timing**: Should take 0.28s

### Scenario 4: No Flicker/Ghosting
1. Open PayWave
2. Nav should instantly disappear (not fade)
3. Close PayWave
4. Nav should NOT appear before animation
5. Animation should be smooth throughout

---

## Browser Compatibility

| Feature | Support |
|---------|---------|
| MutationObserver | ✅ All modern browsers |
| CSS animations | ✅ All modern browsers |
| requestAnimationFrame | ✅ All modern browsers |
| History API | ✅ All modern browsers |
| classList API | ✅ All modern browsers |

---

## Performance Notes

- **MutationObserver**: Minimal overhead, only watches body.class
- **Animation**: GPU-accelerated (transform, opacity)
- **No layout thrashing**: CSS handles animation, not JavaScript
- **Cleanup**: Observer is properly disconnected on unmount

---

## Future Enhancements

If you want to adjust the animation:

```javascript
// Change animation timing
.mbn.mbn-show {
  animation: mbnSlideIn 0.4s ease-out forwards;  /* Slower, easier timing */
}

// Change slide direction (from bottom to right)
@keyframes mbnSlideInRight {
  from {
    opacity: 0;
    transform: translateX(-100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// Change opacity alone (no movement)
@keyframes mbnFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## Summary

✅ **Simple**: 40 lines of code, clear intent
✅ **Robust**: Single source of truth, handles all cases
✅ **Smooth**: Instant hide, animated show
✅ **Reliable**: Works for both back buttons without special handling
✅ **Maintainable**: Easy to understand and modify
