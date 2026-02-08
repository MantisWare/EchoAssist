// ============================================================================
// REGION OVERLAY PRELOAD - Phase 5: Screen Region Selection
// ============================================================================
// Minimal preload script for the fullscreen region selection overlay.
// Exposes two IPC methods to communicate the selection result back to main.
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('regionAPI', {
  /**
   * Confirm the selected region bounds.
   * @param {{ x: number, y: number, width: number, height: number }} bounds
   */
  confirmRegion: (bounds) => {
    return ipcRenderer.invoke('confirm-capture-region', bounds);
  },

  /**
   * Cancel the region selection without saving.
   */
  cancelRegion: () => {
    return ipcRenderer.invoke('cancel-capture-region');
  }
});
