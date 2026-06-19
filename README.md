# AR Janken Prototype

This is a minimal iPhone Safari prototype for playing janken over a rear-camera view.
It composites a green-screen actor video onto a fullscreen camera background using Canvas chroma key processing.

## Files

```text
index.html
style.css
app.js
assets/videos/
  idle.mp4
  janken.mp4
  hoi.mp4
  aiko.mp4
  aiko_hoi.mp4
  aiko_comment.mp4
  late_hoi.mp4
  win.mp4
  lose.mp4
  draw.mp4
  cheat.mp4
  reward.mp4
assets/preview-videos/
  idle.mp4
  janken.mp4
  hoi.mp4
  aiko.mp4
  aiko_hoi.mp4
  aiko_comment.mp4
  late_hoi.mp4
  win.mp4
  lose.mp4
  draw.mp4
  cheat.mp4
  reward.mp4
```

If a video file is missing, the app does not stop. It shows the missing file name on screen and continues with a short simulated playback delay.

Preview-mode videos are managed separately in `assets/preview-videos/`.

## Local Check

`getUserMedia` requires HTTPS or `localhost`.
For a quick desktop check:

```powershell
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

For an actual iPhone Safari camera test, serve this folder over HTTPS:

1. Put the video files in `assets/videos/`.
2. Serve the folder from an HTTPS static host, HTTPS tunnel, or local HTTPS server.
3. Open the HTTPS URL in iPhone Safari.
4. Tap `Start` and allow camera access.

## Settings

The late-hand event rate is defined near the top of [app.js](app.js):

```js
const LATE_HOI_RATE = 0.1;
```

Adjust the chroma key thresholds inside `drawKeyedVideo()` in [app.js](app.js) if the green screen needs stronger or softer removal.

## Notes

- The first tap starts camera and video playback for iPhone Safari autoplay rules.
- The camera uses `facingMode: { ideal: "environment" }` to prefer the rear camera.
- `idle.mp4` loops while waiting.
- During clip changes, the same hidden video element continues feeding the Canvas render loop.
- Draws do not change the player streak.
- Three consecutive draws play `draw.mp4` and return to idle.
- Five player wins play `reward.mp4` instead of the normal `lose.mp4`, then reset the streak to zero.
