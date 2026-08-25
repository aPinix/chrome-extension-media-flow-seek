# macOS input routing in Chrome and BetterVideo

This document separates what the web platform exposes, what a Chrome
extension adds, and what would require native macOS code. It targets recent
Chrome releases on macOS; other operating systems can route inactive-window
input differently.

## Practical conclusion

BetterVideo can reveal controls and seek from a scroll gesture over a visible
video even when that Chrome window is inactive. The received `WheelEvent`
contains the cursor position and a snapshot of the active modifiers, so this
does not require remembered `keydown` state or a native helper.

BetterVideo cannot observe arbitrary pointer movement while Chrome is not the
frontmost macOS application. If controls must react to movement alone in that
state, a separately installed native companion is required.

## Focus-state matrix

| State | Wheel over visible page | Pointer movement | Page signals |
| --- | --- | --- | --- |
| Active tab in the focused Chrome window | Delivered | Delivered | `document.hasFocus()` is true and visibility is normally `visible` |
| Active tab in a non-key Chrome window while Chrome is frontmost | Expected to be delivered | Expected to be delivered; verify against the target Chrome release | `document.hasFocus()` is false while visibility can remain `visible` |
| Visible Chrome window while another application is frontmost | Delivered on macOS to the window beneath the pointer | Normal Chrome content tracking stops | `document.hasFocus()` is false while visibility can remain `visible` |
| Background tab | No direct pointer or wheel input | No | Usually `hidden`; a tab being active in its window is separate from window focus |
| Minimized or otherwise hidden Chrome window | No usable page input | No | Visibility becomes `hidden` |

Apple documents that `NSScrollWheel` events go to the window beneath the
pointer whether the window is active or inactive. Chromium's macOS content
view converts that native event to a renderer `WebMouseWheelEvent` without a
focus gate in the wheel handler. Chromium uses
`NSTrackingActiveInActiveApp` for ordinary content-window mouse tracking,
which explains why movement can continue over a non-key Chrome window while
Chrome is frontmost but not while another application is frontmost. Floating
Chrome windows can use `NSTrackingActiveAlways` and are a separate case.

Sources:

- [Apple: Event Objects and Types](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/EventOverview/EventObjectsTypes/EventObjectsTypes.html)
- [Chromium: macOS wheel event handling](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/renderer_host/render_widget_host_view_mac.mm)
- [Chromium: content-view tracking-area configuration](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/remote_cocoa/app_shim/bridged_content_view.mm)
- [Page Visibility](https://www.w3.org/TR/page-visibility-2/)
- [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

The second row remains an explicit manual test case because DOM delivery is a
browser behavior layered on top of the native tracking-area configuration.

## Web event data

`WheelEvent` inherits from `MouseEvent`. For a trusted wheel event associated
with a pointing device, Chrome exposes:

- viewport coordinates through `clientX` and `clientY`;
- global screen coordinates through `screenX` and `screenY`;
- scroll amounts through `deltaX`, `deltaY`, `deltaZ`, and `deltaMode`;
- the modifier snapshot through `metaKey`, `ctrlKey`, `altKey`, and
  `shiftKey`.

The modifier flags describe that specific event. They do not provide a
continuously queryable global keyboard state, but they remove the need to see
an earlier `keydown` when handling the wheel gesture. On macOS, Command maps
to `metaKey`, Option to `altKey`, Control to `ctrlKey`, and Shift to
`shiftKey`.

Chromium represents a trackpad pinch as a control-modified wheel sequence and
preserves widget and screen positions. Consequently, `ctrlKey: true` on a
wheel event can mean a pinch gesture rather than a physically held Control
key. Command plus scroll remains identifiable through `metaKey`.

Sources:

- [Pointer Events: WheelEvent coordinates and modifiers](https://www.w3.org/TR/pointerevents/)
- [Chromium: touchpad pinch event queue](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/input/touchpad_pinch_event_queue.cc)

## Capability boundaries

### Standard webpage JavaScript

A page can listen for wheel, pointer, mouse, keyboard, focus, blur, and
visibility events delivered to its document. It can use the coordinates and
modifier flags on each event and compare the point with an element's
`getBoundingClientRect()`.

It cannot poll the global cursor, query arbitrary global key state, or monitor
input Chrome did not deliver. `document.visibilityState` and
`document.hasFocus()` answer different questions: a visible page can lack
focus.

Pointer Lock does not change this boundary. It provides relative/raw movement
only while locked and exits when the document, tab, or window loses focus.
[Pointer Lock](https://www.w3.org/TR/pointerlock-2/)

### Chrome extension code

A content script still uses normal DOM input events. Its useful additions are
broad site coverage, isolated execution, settings, communication with the
service worker, and the ability to run in every permitted frame. It does not
receive a privileged global mouse or keyboard event stream.

An extension service worker has no DOM or window and can be suspended when
idle. An offscreen document is hidden and cannot become a global input target.
Neither creates input that the browser did not receive.

The Tabs and Windows APIs can supplement a probe with browser state:
`Tab.active` means selected within that tab's window, while
`windows.onFocusChanged` can report that no Chrome window is focused. They do
not expose cursor or wheel events.

Sources:

- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Extension service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)

### Commands API

`chrome.commands.onCommand` reports only commands declared in the manifest.
Ordinary commands work while Chrome is focused. An eligible command declared
with `global: true` can work while Chrome is unfocused, but suggested global
defaults are restricted, operating-system conflicts can leave a shortcut
unassigned, and users can remap shortcuts at `chrome://extensions/shortcuts`.

Commands cannot report arbitrary current modifiers, mouse position, wheel
events, or Command plus scroll. BetterVideo's current toggle command is not
declared global and is intentionally unchanged.

Source: [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)

## Why Figma can appear to work while unfocused

The observable behavior does not imply global input monitoring. A browser
application can listen for the inactive-window wheel event that macOS already
routes to Chrome, read its coordinates, and apply zoom around that point.
Trackpad pinch can be recognized from Chrome's control-modified wheel
sequence. This is the most likely explanation for Figma's browser behavior,
but it is an inference rather than a statement about Figma's private
implementation.

## Development probe

In a WXT development build, enable BetterVideo's existing debug setting and
reload or revisit a page if necessary. The all-frames content script logs
wheel, pointer, mouse, keyboard, focus, blur, and visibility transitions.
Records are printed as `[BetterVideo input probe]` and the latest 500 are
available as `globalThis.__MFS_INPUT_EVENTS__` after selecting the extension
content-script context in DevTools.

Each record has this stable shape:

```ts
{
  eventType,
  clientX,
  clientY,
  screenX,
  screenY,
  deltaX,
  deltaY,
  metaKey,
  ctrlKey,
  altKey,
  shiftKey,
  documentHasFocus: document.hasFocus(),
  visibilityState: document.visibilityState,
}
```

Fields unavailable on an event are `null`; modifier flags unavailable on an
event are `false`. Disabling debug removes the listeners and clears the
in-memory log.

For each row in the focus matrix, test pointer movement, vertical and
horizontal scrolling, Command/Control/Option/Shift plus scroll, trackpad
pinch, and points inside and outside the video. Record the Chrome and macOS
versions with the observations.

## Future native companion

True global monitoring requires separately installed native macOS code. The
cleanest future design is a signed and notarized companion executable with an
interactive onboarding mode and a `--native-messaging` stdio mode.

```text
listen-only CGEventTap
  -> companion input-monitor module
  -> native-messaging stdin/stdout adapter
  -> chrome.runtime.connectNative() in the extension service worker
  -> chrome.tabs.sendMessage()
  -> content-script video hit-testing
```

The companion would:

1. Request Input Monitoring using `CGPreflightListenEventAccess()` and
   `CGRequestListenEventAccess()`.
2. Install a listen-only `CGEventTap` for mouse movement, scroll wheel, and
   modifier flag changes.
3. Coalesce movement to roughly 60 Hz, keep wheel events individually, and
   send only coordinates, deltas, modifier flags, and timestamps, not typed
   key contents.
4. Frame native-messaging JSON with Chrome's four-byte message length prefix.
5. Restrict the host manifest's `allowed_origins` to the exact BetterVideo
   extension ID and reconnect the worker after host termination.
6. Deliver extension messages rather than synthesizing DOM events.

Input Monitoring is the appropriate permission for passive keyboard, mouse,
and trackpad observation across applications. Accessibility is broader and is
only needed if the helper injects or filters events or uses Accessibility APIs
to inspect/control other applications. Querying the current global cursor
position alone does not normally require either permission.

On macOS, install the native-host manifest under:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
```

The manifest contains the helper's absolute executable path and exact allowed
extension origin. The installer must create it, and uninstall must remove it.

A first version can calibrate viewport origin from any DOM mouse/wheel event
using `screenX - clientX` and `screenY - clientY`. That calibration must be
invalidated when window geometry changes. Robustly identifying arbitrary
Chrome windows and tabs from native screen coordinates is a separate stage
and may require broader window metadata or permissions.

Sources:

- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Chrome service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Apple Input Monitoring settings](https://support.apple.com/guide/mac-help/control-access-to-input-monitoring-on-mac-mchl4cedafb6/mac)
- [Apple privacy protections for input events](https://developer.apple.com/videos/play/wwdc2019/701/)
