# Media Flow Seek - Changelog

All notable changes to this project will be documented in this file.

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
