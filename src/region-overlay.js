// ============================================================================
// REGION OVERLAY RENDERER - Phase 5: Screen Region Selection
// ============================================================================
// Canvas-based click-and-drag rectangle selection with marching ants,
// coordinate info display, confirm/cancel buttons, and corner resize handles.
// ============================================================================

(() => {
  const canvas = document.getElementById('overlay-canvas');
  const ctx = canvas.getContext('2d');
  const infoPanel = document.getElementById('info-panel');
  const infoPos = document.getElementById('info-pos');
  const infoSize = document.getElementById('info-size');
  const instruction = document.getElementById('instruction');
  const actionButtons = document.getElementById('action-buttons');
  const btnConfirm = document.getElementById('btn-confirm');
  const btnCancel = document.getElementById('btn-cancel');

  // Selection state
  let isDrawing = false;
  let isResizing = false;
  let resizeHandle = null; // 'tl', 'tr', 'bl', 'br', 'move'
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let selectionDone = false;

  // Final selection bounds (normalised: x,y = top-left)
  let selection = null;

  // Marching ants animation offset
  let dashOffset = 0;
  let animFrame = null;

  // Handle size for corner resize
  const HANDLE_SIZE = 8;

  // ========================================================================
  // CANVAS SETUP
  // ========================================================================

  function resizeCanvas() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    drawOverlay();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ========================================================================
  // DRAWING
  // ========================================================================

  function drawOverlay() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Semi-transparent dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, w, h);

    if (selection === null && !isDrawing) return;

    // Get current rect (during drawing or after finalised)
    const rect = selection ?? normaliseRect(startX, startY, currentX, currentY);
    if (rect.width <= 0 || rect.height <= 0) return;

    // Cut out the selected region (transparent hole)
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);

    // Dashed border (marching ants)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Secondary inner border for contrast
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
    ctx.lineWidth = 1;
    ctx.lineDashOffset = dashOffset;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

    ctx.setLineDash([]);

    // Corner resize handles (only when selection is finalised)
    if (selectionDone && selection !== null) {
      drawHandle(rect.x, rect.y);                              // top-left
      drawHandle(rect.x + rect.width, rect.y);                 // top-right
      drawHandle(rect.x, rect.y + rect.height);                // bottom-left
      drawHandle(rect.x + rect.width, rect.y + rect.height);   // bottom-right
    }

    // Crosshair guidelines during drawing
    if (isDrawing) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(w, currentY);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(currentX, 0);
      ctx.lineTo(currentX, h);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Update info panel
    infoPos.textContent = `${Math.round(rect.x)}, ${Math.round(rect.y)}`;
    infoSize.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  }

  function drawHandle(cx, cy) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function animate() {
    dashOffset += 0.4;
    drawOverlay();
    animFrame = requestAnimationFrame(animate);
  }

  // Start the marching ants animation
  animate();

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  function normaliseRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  /**
   * Check which resize handle (if any) is under the given point.
   * @returns {'tl' | 'tr' | 'bl' | 'br' | 'move' | null}
   */
  function hitTestHandle(mx, my) {
    if (selection === null) return null;

    const r = selection;
    const threshold = HANDLE_SIZE + 4;

    // Corners
    if (dist(mx, my, r.x, r.y) < threshold) return 'tl';
    if (dist(mx, my, r.x + r.width, r.y) < threshold) return 'tr';
    if (dist(mx, my, r.x, r.y + r.height) < threshold) return 'bl';
    if (dist(mx, my, r.x + r.width, r.y + r.height) < threshold) return 'br';

    // Inside selection = move
    if (mx >= r.x && mx <= r.x + r.width && my >= r.y && my <= r.y + r.height) {
      return 'move';
    }

    return null;
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  function updateCursor(mx, my) {
    const handle = hitTestHandle(mx, my);
    switch (handle) {
      case 'tl':
      case 'br':
        document.body.style.cursor = 'nwse-resize';
        break;
      case 'tr':
      case 'bl':
        document.body.style.cursor = 'nesw-resize';
        break;
      case 'move':
        document.body.style.cursor = 'move';
        break;
      default:
        document.body.style.cursor = 'crosshair';
    }
  }

  function positionActionButtons() {
    if (selection === null) return;

    // Position buttons below the selection (or above if too close to bottom)
    const btnX = selection.x + selection.width / 2;
    const gap = 12;
    let btnY = selection.y + selection.height + gap;

    // If buttons would go off-screen, place above
    if (btnY + 50 > window.innerHeight) {
      btnY = selection.y - 50 - gap;
    }

    actionButtons.style.left = `${Math.round(btnX)}px`;
    actionButtons.style.top = `${Math.round(btnY)}px`;
    actionButtons.style.transform = 'translateX(-50%)';
  }

  // ========================================================================
  // MOUSE EVENTS
  // ========================================================================

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left-click

    if (selectionDone) {
      // Check for handle hits to resize
      const handle = hitTestHandle(e.clientX, e.clientY);
      if (handle !== null) {
        isResizing = true;
        resizeHandle = handle;
        startX = e.clientX;
        startY = e.clientY;
        return;
      }

      // Click outside selection = start new selection
      selectionDone = false;
      selection = null;
      actionButtons.classList.remove('visible');
    }

    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      currentX = e.clientX;
      currentY = e.clientY;
    } else if (isResizing && selection !== null) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      switch (resizeHandle) {
        case 'tl':
          selection.x += dx;
          selection.y += dy;
          selection.width -= dx;
          selection.height -= dy;
          break;
        case 'tr':
          selection.y += dy;
          selection.width += dx;
          selection.height -= dy;
          break;
        case 'bl':
          selection.x += dx;
          selection.width -= dx;
          selection.height += dy;
          break;
        case 'br':
          selection.width += dx;
          selection.height += dy;
          break;
        case 'move':
          selection.x += dx;
          selection.y += dy;
          break;
      }

      // Prevent negative dimensions
      if (selection.width < 10) selection.width = 10;
      if (selection.height < 10) selection.height = 10;

      startX = e.clientX;
      startY = e.clientY;

      positionActionButtons();
    } else if (selectionDone) {
      updateCursor(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (isDrawing) {
      isDrawing = false;
      currentX = e.clientX;
      currentY = e.clientY;

      const rect = normaliseRect(startX, startY, currentX, currentY);

      // Only register selection if it has meaningful size
      if (rect.width > 10 && rect.height > 10) {
        selection = rect;
        selectionDone = true;
        instruction.style.display = 'none';
        actionButtons.classList.add('visible');
        positionActionButtons();
      }
    }

    if (isResizing) {
      isResizing = false;
      resizeHandle = null;
    }
  });

  // ========================================================================
  // KEYBOARD EVENTS
  // ========================================================================

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && selectionDone && selection !== null) {
      e.preventDefault();
      confirm();
    }
  });

  // ========================================================================
  // BUTTONS
  // ========================================================================

  btnConfirm.addEventListener('click', (e) => {
    e.stopPropagation();
    confirm();
  });

  btnCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    cancel();
  });

  // ========================================================================
  // CONFIRM / CANCEL
  // ========================================================================

  function confirm() {
    if (selection === null) return;

    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }

    // Send bounds (logical pixels) to main process
    window.regionAPI.confirmRegion({
      x: Math.round(selection.x),
      y: Math.round(selection.y),
      width: Math.round(selection.width),
      height: Math.round(selection.height)
    });
  }

  function cancel() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }

    window.regionAPI.cancelRegion();
  }
})();
