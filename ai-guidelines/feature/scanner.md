# QR Scanner & Real-Time Check-In Feature

This guide documents the web camera QR code / barcode scanner architecture, hardware camera permissions, barcode payload parsing, and instant check-in verification in the **GDG Jakarta Organizer Dashboard**.

---

## 1. Overview & User Flow

The web QR scanner provides organizers and volunteers with high-speed attendee check-in directly from any modern mobile or desktop web browser:

```
[Web Camera Stream] ──► [BarcodeDetector / JS QR Engine] ──► [Ticket / Attendee Code]
                                                                     │
                                                                     ▼
                                                          [GET /attendee_search/]
                                                                     │
                                                                     ▼
                                                          [PUT /attendee/checkin/]
                                                                     │
                               ┌─────────────────────────────────────┴─────────────────────────────────────┐
                               ▼                                                                           ▼
                    [Success Confirmation]                                                        [Duplicate / Error]
          (Green Ring, Beep Audio, Haptic Pulse)                                        (Red Alert, Check-In Time Warning)
```

---

## 2. Web Camera Integration & Permissions

### 2.1 Media Stream Constraints
The camera preview utilizes standard Web APIs (`navigator.mediaDevices.getUserMedia`):
```typescript
const constraints = {
  video: {
    facingMode: { ideal: "environment" }, // Prefer back-facing camera
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};
```

### 2.2 Permissions & Security
- **HTTPS Enforcement**: Camera access is restricted by modern browsers strictly to secure contexts (`https://` or `localhost`).
- **Permission States**:
  - Handle `NotAllowedError` (camera permission denied by user).
  - Handle `NotFoundError` (no camera device found).
  - Display user-friendly permission instructions with retry buttons.

---

## 3. Barcode Processing & Check-In Pipeline

1. **Detection Engine**:
   - Uses the native browser `window.BarcodeDetector` API when supported.
   - Falls back gracefully to lightweight JavaScript decoders (`html5-qrcode` or `@zxing/library`).

2. **Debounce & Scan Lock**:
   - Immediately pause frame analysis upon barcode detection to prevent multi-triggering while the network call executes.

3. **Check-In Execution**:
   - Check if attendee is already checked in. If so, display a warning with relative check-in time (`ERR406001`).
   - If valid, execute `PUT /attendee/checkin/`.
   - Update Firestore `event_registrations.status = "attended"` and increment `events.total_checked_in`.

4. **Multi-Sensory Feedback**:
   - **Audio**: Play a short high-frequency success chime.
   - **Haptics**: Trigger `navigator.vibrate([100, 50, 100])` on supported devices.
   - **Visual**: Flash an emerald border on the scanner viewfinder.
