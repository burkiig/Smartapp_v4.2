import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

const MIN_Z = 0.5;
const MAX_Z = 3;
const STEP = 0.12;

/**
 * Wraps material iframe: CSS transform scale + pan. Cross-origin safe.
 * Hand mode: capture wheel zoom + drag pan (iframe clicks blocked while active).
 * Optional playlistNav: prev/next material in the floating toolbar.
 * Pen / eraser: canvas overlay scaled with the slide (mutually exclusive with hand mode).
 */
export function MaterialZoomFrame({
  children,
  materialSrc,
  isSplitLayout,
  t,
  playlistNav = null,
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [handMode, setHandMode] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(null);
  const dragRef = useRef(null);
  const prevSplitRef = useRef(false);
  const overlayRef = useRef(null);
  const stackRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setHandMode(false);
    setAnnotateMode(null);
  }, [materialSrc]);

  useEffect(() => {
    if (isSplitLayout && !prevSplitRef.current) {
      setScale((z) => Math.min(MAX_Z, Math.max(z * 1.06, 1.06)));
    }
    prevSplitRef.current = isSplitLayout;
  }, [isSplitLayout]);

  const fitCanvasToStack = useCallback(() => {
    const stack = stackRef.current;
    const canvas = canvasRef.current;
    if (!stack || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = stack.getBoundingClientRect();
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    const stack = stackRef.current;
    const canvas = canvasRef.current;
    if (!stack || !canvas) return undefined;
    const ro = new ResizeObserver(() => {
      fitCanvasToStack();
    });
    ro.observe(stack);
    fitCanvasToStack();
    return () => ro.disconnect();
  }, [fitCanvasToStack, materialSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [materialSrc]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !handMode) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      setScale((z) => Math.min(MAX_Z, Math.max(MIN_Z, z * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handMode]);

  const zoomIn = useCallback(() => setScale((z) => Math.min(MAX_Z, z + STEP)), []);
  const zoomOut = useCallback(() => setScale((z) => Math.max(MIN_Z, z - STEP)), []);
  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleHandMode = useCallback(() => {
    setHandMode((m) => {
      const next = !m;
      if (next) setAnnotateMode(null);
      if (m) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const toggleAnnotatePen = useCallback(() => {
    setHandMode(false);
    setAnnotateMode((mode) => (mode === 'pen' ? null : 'pen'));
  }, []);

  const toggleAnnotateEraser = useCallback(() => {
    setHandMode(false);
    setAnnotateMode((mode) => (mode === 'eraser' ? null : 'eraser'));
  }, []);

  const clearAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const clientToCanvas = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  const paintSegment = useCallback((from, to, mode) => {
    const canvas = canvasRef.current;
    if (!canvas || !from || !to) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 28 * dpr;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.92)';
      ctx.lineWidth = Math.max(2.5, 3 * dpr);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  const onAnnotatePointerDown = useCallback(
    (e) => {
      if (!annotateMode || e.button !== 0) return;
      const p = clientToCanvas(e.clientX, e.clientY);
      if (!p) return;
      drawingRef.current = true;
      lastPtRef.current = p;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [annotateMode, clientToCanvas],
  );

  const onAnnotatePointerMove = useCallback(
    (e) => {
      if (!annotateMode || !drawingRef.current) return;
      const p = clientToCanvas(e.clientX, e.clientY);
      const last = lastPtRef.current;
      if (!p || !last) return;
      paintSegment(last, p, annotateMode);
      lastPtRef.current = p;
    },
    [annotateMode, clientToCanvas, paintSegment],
  );

  const onAnnotatePointerUp = useCallback(
    (e) => {
      if (!annotateMode) return;
      drawingRef.current = false;
      lastPtRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [annotateMode],
  );

  const onPointerDown = useCallback(
    (e) => {
      if (!handMode || e.button !== 0) return;
      dragRef.current = {
        mx: e.clientX,
        my: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [handMode, pan.x, pan.y],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!handMode || !dragRef.current) return;
      const d = dragRef.current;
      setPan({
        x: d.px + (e.clientX - d.mx),
        y: d.py + (e.clientY - d.my),
      });
    },
    [handMode],
  );

  const onPointerUp = useCallback((e) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const pct = Math.round(scale * 100);

  return (
    <div className="classroom-zoom-root">
      <div className="classroom-zoom-viewport">
        <div
          className="classroom-zoom-surface"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <div className="classroom-zoom-surface-stack" ref={stackRef}>
            {children}
            <canvas
              ref={canvasRef}
              className={`classroom-annotate-canvas${annotateMode ? ' is-on' : ''}`}
              onPointerDown={onAnnotatePointerDown}
              onPointerMove={onAnnotatePointerMove}
              onPointerUp={onAnnotatePointerUp}
              onPointerCancel={onAnnotatePointerUp}
            />
          </div>
        </div>
        <div
          ref={overlayRef}
          role="presentation"
          aria-hidden={!handMode}
          className={`classroom-zoom-overlay${handMode ? ' classroom-zoom-overlay--on' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="classroom-zoom-toolbar">
          <span className="classroom-zoom-pct" title={t('classroom.zoomPercentHint')}>
            {pct}
            %
          </span>
          <button type="button" className="classroom-zoom-btn" onClick={zoomOut} title={t('classroom.zoomOut')} aria-label={t('classroom.zoomOut')}>
            −
          </button>
          <button type="button" className="classroom-zoom-btn" onClick={zoomIn} title={t('classroom.zoomIn')} aria-label={t('classroom.zoomIn')}>
            +
          </button>
          <button
            type="button"
            className="classroom-zoom-btn classroom-zoom-btn--narrow"
            onClick={resetView}
            title={t('classroom.zoomReset')}
            aria-label={t('classroom.zoomReset')}
          >
            ⟲
          </button>
          {playlistNav && playlistNav.total > 1 && (
            <>
              <span className="classroom-zoom-toolbar-sep" aria-hidden />
              <button
                type="button"
                className="classroom-zoom-btn classroom-zoom-btn--step"
                onClick={playlistNav.onPrev}
                disabled={!playlistNav.canPrev}
                title={t('classroom.prevMaterial')}
                aria-label={t('classroom.prevMaterial')}
              >
                ‹
              </button>
              <span className="classroom-zoom-playlist-meta" title={t('classroom.materialsPlaylistTitle')}>
                {playlistNav.current}
                /
                {playlistNav.total}
              </span>
              <button
                type="button"
                className="classroom-zoom-btn classroom-zoom-btn--step"
                onClick={playlistNav.onNext}
                disabled={!playlistNav.canNext}
                title={t('classroom.nextMaterial')}
                aria-label={t('classroom.nextMaterial')}
              >
                ›
              </button>
            </>
          )}
          <span className="classroom-zoom-toolbar-sep" aria-hidden />
          <button
            type="button"
            className={`classroom-zoom-btn classroom-zoom-btn--narrow${annotateMode === 'pen' ? ' classroom-zoom-tool-active' : ''}`}
            onClick={toggleAnnotatePen}
            aria-pressed={annotateMode === 'pen'}
            title={t('classroom.annotatePen')}
            aria-label={t('classroom.annotatePen')}
          >
            ✎
          </button>
          <button
            type="button"
            className={`classroom-zoom-btn classroom-zoom-btn--narrow${annotateMode === 'eraser' ? ' classroom-zoom-tool-active' : ''}`}
            onClick={toggleAnnotateEraser}
            aria-pressed={annotateMode === 'eraser'}
            title={t('classroom.annotateEraser')}
            aria-label={t('classroom.annotateEraser')}
          >
            ⌫
          </button>
          <button
            type="button"
            className="classroom-zoom-btn classroom-zoom-btn--narrow"
            onClick={clearAnnotations}
            title={t('classroom.annotateClear')}
            aria-label={t('classroom.annotateClear')}
          >
            ⌧
          </button>
          <button
            type="button"
            className={`classroom-zoom-hand${handMode ? ' is-active' : ''}`}
            onClick={toggleHandMode}
            aria-pressed={handMode}
            title={t('classroom.zoomHandHint')}
          >
            {t('classroom.zoomHand')}
          </button>
        </div>
      </div>
    </div>
  );
}
