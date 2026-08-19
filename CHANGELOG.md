# Better Video Controls for YouTube, Instagram, TikTok & More - Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Changed

- Rebranded the extension as Better Video Controls for YouTube, Instagram, TikTok & More, with the compact name BetterVideo.

### 🌟 New Features

- **Configurable Scroll Speed Hotkeys**: Defaults to Alt for 3× seeking and Alt+Shift for ¼× precision, with both assignable from the popup.
- **Toggle Shortcut**: Changed the suggested extension toggle shortcut to Ctrl+Shift+S (physical Control+Shift+S on macOS).
- **Universal Video Support**: Enabled HTML5 video seeking on all websites by default, including Steam, Facebook, Instagram, Vimeo, and embedded players.
- **Embedded and Dynamic Players**: Added all-frame injection, open shadow DOM discovery, and reliable handling for videos replaced by social feeds and carousels.
- **Live/DVR Seeking**: Added support for seekable live-stream windows in addition to finite on-demand videos.

## [1.0.9] - 2025-08-12

### 🐛 Bug Fixes

- **Mouse Event Forwarding**: Fixed issue where extension would temporarily disable when any mouse event was triggered, ensuring consistent functionality during mouse interactions

## [1.0.8] - 2025-08-11

### 🌟 New Features

- **Action Area**:
  - New setting to define which part of the video responds to scroll gestures.
  - Choose between `Full`, `Top`, `Middle`, or `Bottom` of the video player.
  - Customize the size of the `Top`, `Middle`, and `Bottom` action areas with a slider control.
- **Timeline Customization**:
  - New settings to control the timeline's appearance.
  - Adjust the timeline's `position` to either the `top` or `bottom` of the video.
  - Control the timeline's `height` using either pixels (`px`) or percentage (`%`).

## [1.0.7] - 2025-08-08

### 🌟 New Features

- Hotkey Toggle: Instantly enable/disable the extension with Cmd/Ctrl+Shift+V
- Inline Feedback: Clean in-page notification when you toggle the extension

---

## [1.0.6] - 2025-08-08

### 🐛 Bug Fixes

- **Keyboard Event Handling**: Fixed issue where extension would temporarily disable when any key was pressed, ensuring consistent functionality during keyboard interactions

---

## [1.0.5] - 2025-07-31

### ✨ New Features

- **Keyboard Event Handling**: Added keyboard event handling to restore scrub-wrapper elements when any key is pressed

### 🐛 Bug Fixes

- **Video Position**: Fixed video position when scrolling
- **Video Tag Compatibility**: Extension now fully supports video elements with custom mouse interactions (hover, click-to-play/pause, etc.); scrubbing and overlays work seamlessly regardless of player mouse behavior

---

## [1.0.4] - 2025-07-30

### ✨ New Features

- **Timeline Unit Selection**: Choose between pixel (px) and percentage (%) units for timeline height
- **Domain Management Overhaul**: Completely redesigned domain management system with predefined configurations

### 🐛 Bug Fixes

- **Video Position**: Fixed video position when scrolling
- **Video Tag Compatibility**: Extension now fully supports video elements with custom mouse interactions (hover, click-to-play/pause, etc.); scrubbing and overlays work seamlessly regardless of player mouse behavior

---

## [1.0.3] - 2025-07-23

### ✨ New Features

- **Enhanced Domain Management UI**: Completely redesigned domain management interface with improved visual design and user experience

### 🚀 Performance Enhancements

- **Improved Scrolling Performance**: Custom scroll area implementation provides smoother scrolling experience

---

## [1.0.2] - 2025-01-22

### ✨ New Features

- **Enable/Disable Extension**: Toggle to completely enable or disable the extension functionality
- **Blacklisted Domains**: Ability to add domains where the extension should not run

### 🐛 Bug Fixes

- **Browser History Navigation**: Fixed horizontal scroll interfering with browser back/forward navigation
- **Scroll Event Conflicts**: Resolved conflicts between media seeking and page navigation
- **Performance Optimizations**: Improved event handling efficiency for better responsiveness

---

## [1.0.1] - 2025-07-17

### ✨ New Features

- **Timeline Hover Display**: New option to show timeline on video hover for quick progress checking
- **Customizable Timeline Height**: Adjustable timeline thickness from 0-100px via popup slider
- **Reset Defaults Button**: One-click reset to restore all settings to default values
- **Enhanced UI**: Added app icon to popup header for better branding

### 🔄 Changes

- **Default Scroll Direction**: Changed default horizontal scroll inversion to enabled (better UX)
- **Improved Timeline Positioning**: Enhanced timeline placement and sizing calculations

### 🐛 Bug Fixes

- Fixed timeline positioning issues during window resize
- Improved timeline updates during scroll interactions
- Enhanced timeline visibility management

---

## [1.0.0] - 2025-07-16

### 🎉 Initial Release

#### 🚀 Core Features

- **Video Scrubbing**: Horizontal scroll-based video seeking across all video elements
- **Universal Compatibility**: Works on YouTube, Vimeo, Twitch, Netflix, and all video sites
- **Smart Detection**: Automatic video detection including iframes and shadow DOM elements
- **Domain-Specific Colors**: Timeline colors adapt to each platform (YouTube red, Vimeo blue, etc.)

#### ⚙️ Settings & Customization

- **Scroll Inversion**: Toggle to reverse horizontal scroll direction for better control
- **Chrome Storage Sync**: Settings persist across browser sessions and devices
- **Real-time Updates**: Popup changes apply instantly without page reload

#### 🎨 User Interface

- **Modern Design**: Clean, gradient-based popup with light/dark theme support
- **Responsive Timeline**: Semi-transparent progress bar with smooth animations
- **Visual Feedback**: Timeline appears during scrubbing with real-time progress updates

#### 🔧 Technical Features

- **Cross-Origin Support**: Works across different domains and embedded content
- **Performance Optimized**: Efficient DOM observation and event handling
- **Accessibility**: Proper ARIA labels and keyboard navigation support
- **Fallback Detection**: Multiple video detection methods for maximum compatibility

#### 🌐 Supported Platforms

- YouTube, Vimeo, Twitch, Netflix, Hulu, TikTok
- Instagram, Facebook, Twitter/X, Dailymotion
- Any website with HTML5 video elements

---

## 🔗 Links

- [Repository](https://github.com/aPinix/chrome-extension-media-flow-seek)
- [Issues](https://github.com/aPinix/chrome-extension-media-flow-seek/issues)
- [Releases](https://github.com/aPinix/chrome-extension-media-flow-seek/releases)

---

**Made with ❤️ by [aPinix](https://www.linkedin.com/in/pinix/)**
