// ============================================================================
// REGION SELECTION SERVICE - Phase 5: Screen Region Selection
// ============================================================================
// Provides window enumeration, capture config CRUD, window re-detection,
// and screenshot cropping using electron nativeImage.
// ============================================================================

const { nativeImage } = require('electron');
const fs = require('fs');
const settingsStore = require('./settings-store');

// Known meeting app process names for highlighting in the window picker
const MEETING_APP_PROCESS_NAMES = [
  'teams', 'microsoft teams',
  'zoom', 'zoom.us',
  'google chrome', 'chrome',   // Google Meet runs in Chrome
  'webex', 'cisco webex',
  'slack',
  'discord',
  'skype',
  'firefox',                    // Meet/Teams can run in Firefox
  'safari',                     // Meet can run in Safari
  'microsoft edge', 'msedge'    // Teams can run in Edge
];

// Known meeting-related window title keywords
const MEETING_TITLE_KEYWORDS = [
  'meeting', 'teams', 'zoom', 'google meet', 'webex',
  'slack huddle', 'discord call', 'skype'
];

/**
 * Lazily load node-window-manager to handle missing/broken installs gracefully.
 * @returns {{ windowManager: object } | null}
 */
function loadWindowManager() {
  try {
    return require('node-window-manager');
  } catch (error) {
    console.error('[RegionService] Failed to load node-window-manager:', error.message);
    return null;
  }
}

// ============================================================================
// WINDOW ENUMERATION
// ============================================================================

/**
 * Get all visible open windows, filtering out system/invisible windows
 * and the EchoAssist window itself.
 * @param {string} [selfExecPath] - The Electron executable path to exclude own windows
 * @returns {Array<{ id: number, title: string, processName: string, bounds: { x: number, y: number, width: number, height: number }, isMeetingApp: boolean }>}
 */
function getOpenWindows(selfExecPath) {
  const nwm = loadWindowManager();
  if (nwm === null) {
    console.warn('[RegionService] node-window-manager not available — returning empty list');
    return [];
  }

  try {
    const allWindows = nwm.windowManager.getWindows();
    const results = [];

    for (const win of allWindows) {
      try {
        const title = win.getTitle();
        // Skip windows with no title or very short titles (system windows)
        if (title === undefined || title === null || title.length < 2) {
          continue;
        }

        const bounds = win.getBounds();
        // Skip zero-size (minimized or invisible) windows
        if (bounds.width <= 0 || bounds.height <= 0) {
          continue;
        }

        const winPath = win.path ?? '';

        // Skip the EchoAssist window itself (match by executable path)
        if (selfExecPath !== undefined && winPath.length > 0 && winPath === selfExecPath) {
          continue;
        }

        const processName = winPath
          ? winPath.split(/[/\\]/).pop().replace(/\.exe$/i, '')
          : '';

        const isMeetingApp = checkIsMeetingApp(processName, title);

        results.push({
          id: win.id,
          title,
          processName,
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
          },
          isMeetingApp
        });
      } catch (winError) {
        // Individual window access can fail; skip silently
        continue;
      }
    }

    // Sort: meeting apps first, then alphabetically by title
    results.sort((a, b) => {
      if (a.isMeetingApp && !b.isMeetingApp) return -1;
      if (!a.isMeetingApp && b.isMeetingApp) return 1;
      return a.title.localeCompare(b.title);
    });

    return results;
  } catch (error) {
    console.error('[RegionService] Error enumerating windows:', error.message);
    return [];
  }
}

/**
 * Get only windows from known meeting applications.
 * @param {string} [selfExecPath] - The Electron executable path to exclude own windows
 * @returns {Array}
 */
function getMeetingWindows(selfExecPath) {
  return getOpenWindows(selfExecPath).filter((w) => w.isMeetingApp);
}

/**
 * Check whether a window belongs to a known meeting application.
 * @param {string} processName
 * @param {string} title
 * @returns {boolean}
 */
function checkIsMeetingApp(processName, title) {
  const procLower = processName.toLowerCase();
  const titleLower = title.toLowerCase();

  for (const name of MEETING_APP_PROCESS_NAMES) {
    if (procLower.includes(name)) return true;
  }
  for (const keyword of MEETING_TITLE_KEYWORDS) {
    if (titleLower.includes(keyword)) return true;
  }
  return false;
}

// ============================================================================
// CAPTURE CONFIG PERSISTENCE
// ============================================================================

/**
 * Load capture configuration from settings store.
 * @returns {object} The capture config with defaults applied.
 */
function loadCaptureConfig() {
  return settingsStore.getCaptureConfig();
}

/**
 * Save capture configuration to settings store.
 * Validates that bounds values are non-negative integers when applicable.
 * @param {object} config
 */
function saveCaptureConfig(config) {
  // Validate region bounds if mode is 'region'
  if (config.mode === 'region' && config.region !== undefined) {
    const { x, y, width, height } = config.region;
    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof width !== 'number' || typeof height !== 'number') {
      console.error('[RegionService] Invalid region bounds — all must be numbers');
      return;
    }
    if (width <= 0 || height <= 0) {
      console.error('[RegionService] Region width and height must be positive');
      return;
    }
    // Floor all values to whole pixels
    config.region = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.floor(width),
      height: Math.floor(height)
    };
  }

  settingsStore.setCaptureConfig(config);
  console.log('[RegionService] Capture config saved:', config.mode);
}

/**
 * Reset capture mode to full screen, clearing saved region/window data.
 */
function resetToFullScreen() {
  settingsStore.resetCaptureMode();
  console.log('[RegionService] Reset to full screen capture');
}

// ============================================================================
// WINDOW RE-DETECTION
// ============================================================================

/**
 * Re-detect a previously saved window by process name or title substring.
 * Called before every capture in "window" mode so we get live bounds.
 * @param {object} savedConfig - The stored capture config
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 *   Live window bounds, or null if the window cannot be found.
 */
function resolveWindowBounds(savedConfig) {
  if (savedConfig.mode !== 'window') return null;

  const windowConfig = savedConfig.window ?? {};
  const targetProcessName = (windowConfig.processName ?? '').toLowerCase();
  const targetTitle = (windowConfig.title ?? '').toLowerCase();

  if (targetProcessName.length === 0 && targetTitle.length === 0) {
    console.warn('[RegionService] No window identifier stored — cannot resolve');
    return null;
  }

  const windows = getOpenWindows();

  // First pass: match by processName
  if (targetProcessName.length > 0) {
    for (const win of windows) {
      if (win.processName.toLowerCase() === targetProcessName) {
        // If there is also a title, prefer a title substring match
        if (targetTitle.length > 0 && !win.title.toLowerCase().includes(targetTitle)) {
          continue;
        }
        console.log(`[RegionService] Window resolved by process: ${win.title}`);
        return win.bounds;
      }
    }
  }

  // Second pass: match by title substring
  if (targetTitle.length > 0) {
    for (const win of windows) {
      if (win.title.toLowerCase().includes(targetTitle)) {
        console.log(`[RegionService] Window resolved by title: ${win.title}`);
        return win.bounds;
      }
    }
  }

  console.warn('[RegionService] Target window not found');
  return null;
}

// ============================================================================
// SCREENSHOT CROPPING
// ============================================================================

/**
 * Crop a screenshot PNG on disk to the specified region, accounting for
 * display scale factor (HiDPI / Retina).
 *
 * The file is overwritten in place with the cropped result.
 *
 * @param {string} screenshotPath - Absolute path to the PNG file
 * @param {{ x: number, y: number, width: number, height: number }} region
 *   Region in logical (CSS) pixels, relative to the captured display origin.
 * @param {number} [scaleFactor=1] - Display scale factor
 * @returns {string} The same screenshotPath (for chaining)
 */
function cropScreenshot(screenshotPath, region, scaleFactor = 1) {
  try {
    const image = nativeImage.createFromPath(screenshotPath);
    if (image.isEmpty()) {
      console.error('[RegionService] Could not load image for cropping:', screenshotPath);
      return screenshotPath;
    }

    const imageSize = image.getSize();

    // Scale the region to device pixels
    const cropRect = {
      x: Math.round(region.x * scaleFactor),
      y: Math.round(region.y * scaleFactor),
      width: Math.round(region.width * scaleFactor),
      height: Math.round(region.height * scaleFactor)
    };

    // Clamp crop rect to image bounds
    cropRect.x = Math.max(0, Math.min(cropRect.x, imageSize.width - 1));
    cropRect.y = Math.max(0, Math.min(cropRect.y, imageSize.height - 1));
    cropRect.width = Math.min(cropRect.width, imageSize.width - cropRect.x);
    cropRect.height = Math.min(cropRect.height, imageSize.height - cropRect.y);

    // Skip if crop region is too small
    if (cropRect.width < 10 || cropRect.height < 10) {
      console.warn('[RegionService] Crop region too small, skipping crop');
      return screenshotPath;
    }

    const cropped = image.crop(cropRect);
    const pngBuffer = cropped.toPNG();
    fs.writeFileSync(screenshotPath, pngBuffer);

    console.log(
      `[RegionService] Cropped screenshot: ${cropRect.width}x${cropRect.height} ` +
      `at (${cropRect.x},${cropRect.y}) scale=${scaleFactor}`
    );

    return screenshotPath;
  } catch (error) {
    console.error('[RegionService] Crop error:', error.message);
    return screenshotPath;
  }
}

// ============================================================================
// PLATFORM EDGE CASES
// ============================================================================

/**
 * Check whether node-window-manager is working (macOS may require
 * Accessibility permission). Returns a diagnostic object.
 * @returns {{ available: boolean, windowCount: number, error: string | null }}
 */
function checkWindowManagerStatus() {
  const nwm = loadWindowManager();
  if (nwm === null) {
    return {
      available: false,
      windowCount: 0,
      error: 'node-window-manager could not be loaded'
    };
  }

  try {
    const windows = nwm.windowManager.getWindows();
    if (windows.length === 0) {
      // On macOS, an empty list often means Accessibility permission is missing
      if (process.platform === 'darwin') {
        return {
          available: false,
          windowCount: 0,
          error: 'No windows found. On macOS, grant Accessibility access in System Preferences > Privacy & Security > Accessibility.'
        };
      }
      return {
        available: true,
        windowCount: 0,
        error: null
      };
    }
    return {
      available: true,
      windowCount: windows.length,
      error: null
    };
  } catch (error) {
    return {
      available: false,
      windowCount: 0,
      error: error.message
    };
  }
}

/**
 * Clamp window bounds to a display's bounds to handle windows that
 * span across multiple monitors.
 * @param {{ x: number, y: number, width: number, height: number }} windowBounds
 * @param {{ x: number, y: number, width: number, height: number }} displayBounds
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function clampBoundsToDisplay(windowBounds, displayBounds) {
  const left = Math.max(windowBounds.x, displayBounds.x);
  const top = Math.max(windowBounds.y, displayBounds.y);
  const right = Math.min(
    windowBounds.x + windowBounds.width,
    displayBounds.x + displayBounds.width
  );
  const bottom = Math.min(
    windowBounds.y + windowBounds.height,
    displayBounds.y + displayBounds.height
  );

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getOpenWindows,
  getMeetingWindows,
  loadCaptureConfig,
  saveCaptureConfig,
  resetToFullScreen,
  resolveWindowBounds,
  cropScreenshot,
  checkWindowManagerStatus,
  clampBoundsToDisplay
};
