
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Search,
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  Printer,
  FileText,
} from 'lucide-react';

const TOOLBAR_HIDE_DELAY = 2500;
const HOVER_ZONE_HEIGHT = 60;
const SWIPE_THRESHOLD = 50;
const SWIPE_MAX_VERTICAL = 80;

const PDFReader = ({
  pdfUrl,
  fileName = 'document.pdf',
  onPageChange,
  onPdfLoad,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [isPageInputFocused, setIsPageInputFocused] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);

  const hideTimerRef = useRef(null);

  // Touch tracking
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isSwiping = useRef(false);

  // DOM and PDF.js refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const pdfjsLib = useRef(null);

  // Rendering coordination
  const renderTaskRef = useRef(null);
  const renderRequestRef = useRef(0);
  const loadingTaskRef = useRef(null);
  const pdfUrlRef = useRef(pdfUrl);

  // Keep the latest PDF URL available to asynchronous operations.
  pdfUrlRef.current = pdfUrl;

  // ── Toolbar visibility ────────────────────────────────────────────────

  const showToolbar = useCallback(() => {
    setToolbarVisible(true);
    clearTimeout(hideTimerRef.current);

    if (!showSearch) {
      hideTimerRef.current = setTimeout(() => {
        setToolbarVisible(false);
      }, TOOLBAR_HIDE_DELAY);
    }
  }, [showSearch]);

  useEffect(() => {
    if (showSearch) {
      clearTimeout(hideTimerRef.current);
      setToolbarVisible(true);
    } else {
      hideTimerRef.current = setTimeout(() => {
        setToolbarVisible(false);
      }, TOOLBAR_HIDE_DELAY);
    }

    return () => clearTimeout(hideTimerRef.current);
  }, [showSearch]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (event.clientY <= HOVER_ZONE_HEIGHT) {
        showToolbar();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [showToolbar]);

  useEffect(() => {
    hideTimerRef.current = setTimeout(() => {
      setToolbarVisible(false);
    }, TOOLBAR_HIDE_DELAY);

    return () => clearTimeout(hideTimerRef.current);
  }, []);

  // ── Mobile swipe navigation ───────────────────────────────────────────

  const handleTouchStart = useCallback((event) => {
    if (event.touches.length !== 1) return;

    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((event) => {
    if (touchStartX.current === null) return;
    if (event.touches.length !== 1) return;

    const dx = event.touches[0].clientX - touchStartX.current;
    const dy = event.touches[0].clientY - touchStartY.current;

    if (
      !isSwiping.current &&
      Math.abs(dx) > 10 &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      isSwiping.current = true;
    }

    if (isSwiping.current) {
      event.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (touchStartX.current === null) return;

    const touch = event.changedTouches[0];

    if (!touch) {
      touchStartX.current = null;
      touchStartY.current = null;
      isSwiping.current = false;
      return;
    }

    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;
    isSwiping.current = false;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;

    if (dx < 0) {
      setCurrentPage((previous) => Math.min(previous + 1, numPages));
    } else {
      setCurrentPage((previous) => Math.max(previous - 1, 1));
    }
  }, [numPages]);

  // Attach a non-passive listener so preventDefault works on mobile.
  useEffect(() => {
    const element = canvasAreaRef.current;
    if (!element) return;

    element.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });

    return () => {
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchMove]);

  // ── PDF loading ───────────────────────────────────────────────────────

  useEffect(() => {
    let disposed = false;
    let script = null;

    const loadPDF = async () => {
      if (disposed || !pdfjsLib.current || !pdfUrlRef.current) return;

      // Invalidate outstanding page-render requests.
      renderRequestRef.current += 1;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (loadingTaskRef.current) {
        try {
          await loadingTaskRef.current.destroy();
        } catch {
          // The previous loading task may already have finished.
        }
        loadingTaskRef.current = null;
      }

      if (disposed) return;

      setLoading(true);
      setPageRendering(false);
      setPdf(null);
      setNumPages(0);
      setCurrentPage(1);
      setPageInputValue('1');
      setSearchResults([]);
      setCurrentSearchIndex(0);

      try {
        const loadingTask = pdfjsLib.current.getDocument(pdfUrlRef.current);
        loadingTaskRef.current = loadingTask;

        const pdfDocument = await loadingTask.promise;

        if (disposed || pdfUrlRef.current !== pdfUrl) {
          await pdfDocument.destroy();
          return;
        }

        loadingTaskRef.current = null;

        setPdf(pdfDocument);
        setNumPages(pdfDocument.numPages);
        setLoading(false);
      } catch (error) {
        if (!disposed) {
          console.error('Error loading PDF:', error);
          setLoading(false);
        }
      }
    };

    const initializePdfJs = () => {
      if (disposed) return;

      if (window.pdfjsLib) {
        pdfjsLib.current = window.pdfjsLib;

        pdfjsLib.current.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        loadPDF();
        return;
      }

      script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;

      script.onload = () => {
        if (disposed) return;

        pdfjsLib.current = window.pdfjsLib;

        if (!pdfjsLib.current) {
          console.error('PDF.js failed to initialize.');
          setLoading(false);
          return;
        }

        pdfjsLib.current.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        loadPDF();
      };

      script.onerror = () => {
        if (!disposed) {
          console.error('Unable to load the PDF.js library.');
          setLoading(false);
        }
      };

      document.body.appendChild(script);
    };

    initializePdfJs();

    return () => {
      disposed = true;

      // Prevent an old component effect from publishing render results.
      renderRequestRef.current += 1;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }

      if (script?.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [pdfUrl]);

  // ── Safe page rendering ───────────────────────────────────────────────

  const renderPage = useCallback(async (pageNum) => {
    if (!pdf) return;

    // Each request gets a unique ID. Only the latest request may render.
    const requestId = ++renderRequestRef.current;

    setPageRendering(true);

    // Cancel and await the previous render before reusing the canvas.
    const previousTask = renderTaskRef.current;

    if (previousTask) {
      previousTask.cancel();

      try {
        await previousTask.promise;
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error cancelling previous PDF render:', error);
        }
      }

      if (requestId !== renderRequestRef.current) return;

      if (renderTaskRef.current === previousTask) {
        renderTaskRef.current = null;
      }
    }

    try {
      const page = await pdf.getPage(pageNum);

      // A newer page, zoom, or rotation request may have arrived.
      if (requestId !== renderRequestRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale, rotation });
      const devicePixelRatio = window.devicePixelRatio || 1;

      const pixelWidth = Math.floor(viewport.width * devicePixelRatio);
      const pixelHeight = Math.floor(viewport.height * devicePixelRatio);

      // Resize the backing canvas only after the previous render has stopped.
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;

      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Reset the transform instead of accumulating scale operations.
      context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
      );

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;
    } catch (error) {
      if (
        error?.name !== 'RenderingCancelledException' &&
        requestId === renderRequestRef.current
      ) {
        console.error('Error rendering page:', error);
      }
    } finally {
      // Older renders must not clear the state of newer render requests.
      if (requestId === renderRequestRef.current) {
        renderTaskRef.current = null;
        setPageRendering(false);
      }
    }
  }, [pdf, scale, rotation]);

  useEffect(() => {
    if (!pdf) return;

    renderPage(currentPage);

    if (onPageChange) {
      onPageChange(currentPage);
    }
  }, [pdf, currentPage, renderPage, onPageChange]);

  useEffect(() => {
    if (pdf && onPdfLoad) {
      onPdfLoad(pdf);
    }
  }, [pdf, onPdfLoad]);

  // ── Navigation and toolbar actions ────────────────────────────────────

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleZoomIn = () => {
    setScale((previous) => Math.min(previous + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((previous) => Math.max(previous - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((previous) => (previous + 90) % 360);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Unable to toggle fullscreen:', error);
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
    };
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!pdf || !searchText.trim()) return;

    try {
      const results = [];
      const query = searchText.trim().toLowerCase();

      for (let index = 1; index <= numPages; index += 1) {
        const page = await pdf.getPage(index);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => item.str || '')
          .join(' ');

        if (text.toLowerCase().includes(query)) {
          results.push(index);
        }
      }

      setSearchResults(results);
      setCurrentSearchIndex(0);

      if (results.length > 0) {
        goToPage(results[0]);
      }
    } catch (error) {
      console.error('Error searching PDF:', error);
    }
  };

  const nextSearchResult = () => {
    if (!searchResults.length) return;

    const next = (currentSearchIndex + 1) % searchResults.length;

    setCurrentSearchIndex(next);
    goToPage(searchResults[next]);
  };

  const prevSearchResult = () => {
    if (!searchResults.length) return;

    const previous =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;

    setCurrentSearchIndex(previous);
    goToPage(searchResults[previous]);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (event) => {
      if (event.target.tagName === 'INPUT') return;

      switch (event.key) {
        case 'ArrowLeft':
          goToPage(currentPage - 1);
          break;
        case 'ArrowRight':
          goToPage(currentPage + 1);
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setShowSearch(true);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [currentPage, numPages]);

  // ── UI ────────────────────────────────────────────────────────────────

  const statusBarHeight = 38;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        maxWidth: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        height: '100vh',
        height: '100dvh',
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Invisible hover zone */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HOVER_ZONE_HEIGHT,
          zIndex: 200,
          pointerEvents: toolbarVisible ? 'none' : 'all',
        }}
        onMouseEnter={showToolbar}
      />

      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transform: toolbarVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: toolbarVisible ? 'all' : 'none',
        }}
        onMouseEnter={showToolbar}
      >
        <div
          style={{
            backgroundColor: '#252525',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid #3a3a3a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {/* Page navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <ToolbarButton
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              tooltip="Previous (←)"
            >
              <ChevronLeft size={20} />
            </ToolbarButton>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#333',
                padding: '5px 12px',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
              }}
            >
              <input
                type="number"
                value={isPageInputFocused ? pageInputValue : currentPage}
                onChange={(event) => setPageInputValue(event.target.value)}
                onFocus={(event) => {
                  setIsPageInputFocused(true);
                  setPageInputValue(String(currentPage));
                  setTimeout(() => event.target.select(), 0);
                }}
                onBlur={() => {
                  setIsPageInputFocused(false);

                  const pageNumber = parseInt(pageInputValue, 10);

                  if (
                    !Number.isNaN(pageNumber) &&
                    pageNumber >= 1 &&
                    pageNumber <= numPages
                  ) {
                    goToPage(pageNumber);
                  } else {
                    setPageInputValue(String(currentPage));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.target.blur();

                  if (event.key === 'Escape') {
                    setPageInputValue(String(currentPage));
                    event.target.blur();
                  }
                }}
                min="1"
                max={numPages}
                aria-label="Current page"
                style={{
                  width: '48px',
                  padding: '3px 8px',
                  backgroundColor: '#1e1e1e',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '14px',
                }}
              />

              <span style={{ color: '#999' }}>/</span>
              <span>{numPages}</span>
            </div>

            <ToolbarButton
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              tooltip="Next (→)"
            >
              <ChevronRight size={20} />
            </ToolbarButton>
          </div>

          {/* Zoom and rotation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <ToolbarButton
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              tooltip="Zoom Out (-)"
            >
              <ZoomOut size={18} />
            </ToolbarButton>

            <div
              style={{
                backgroundColor: '#333',
                padding: '5px 14px',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '64px',
                textAlign: 'center',
              }}
            >
              {Math.round(scale * 100)}%
            </div>

            <ToolbarButton
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              tooltip="Zoom In (+)"
            >
              <ZoomIn size={18} />
            </ToolbarButton>

            <div
              style={{
                width: '1px',
                height: '22px',
                backgroundColor: '#444',
                margin: '0 2px',
              }}
            />

            <ToolbarButton onClick={handleRotate} tooltip="Rotate (R)">
              <RotateCw size={18} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => setScale(1.0)}
              active={scale === 1.0}
              tooltip="Fit to Width"
            >
              <span style={{ fontSize: '13px', fontWeight: '500' }}>
                Fit
              </span>
            </ToolbarButton>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ToolbarButton
              onClick={() => setShowSearch(!showSearch)}
              active={showSearch}
              tooltip="Search (Ctrl+F)"
            >
              <Search size={18} />
            </ToolbarButton>

            <ToolbarButton onClick={() => window.print()} tooltip="Print">
              <Printer size={18} />
            </ToolbarButton>

            <ToolbarButton onClick={toggleFullscreen} tooltip="Fullscreen">
              {isFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </ToolbarButton>

            <ToolbarButton
              onClick={handleDownload}
              tooltip="Download"
              primary
            >
              <Download size={18} />
            </ToolbarButton>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div
            style={{
              backgroundColor: '#2a2a2a',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderBottom: '1px solid #3a3a3a',
            }}
          >
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch();
              }}
              placeholder="Search in document..."
              autoFocus
              style={{
                flex: 1,
                minWidth: 0,
                padding: '9px 14px',
                backgroundColor: '#1e1e1e',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '14px',
              }}
            />

            <button
              onClick={handleSearch}
              style={{
                padding: '9px 18px',
                backgroundColor: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = '#0052a3';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = '#0066cc';
              }}
            >
              Find
            </button>

            {searchResults.length > 0 && (
              <>
                <div
                  style={{
                    color: '#999',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentSearchIndex + 1} / {searchResults.length}
                </div>

                <ToolbarButton onClick={prevSearchResult} tooltip="Previous">
                  <ChevronLeft size={16} />
                </ToolbarButton>

                <ToolbarButton onClick={nextSearchResult} tooltip="Next">
                  <ChevronRight size={16} />
                </ToolbarButton>
              </>
            )}

            <ToolbarButton
              onClick={() => {
                setShowSearch(false);
                setSearchResults([]);
                setSearchText('');
              }}
              tooltip="Close"
            >
              <X size={18} />
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* Toolbar peek hint */}
      {!toolbarVisible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99,
            backgroundColor: 'rgba(37,37,37,0.75)',
            color: '#aaa',
            fontSize: '11px',
            padding: '3px 12px',
            borderRadius: '0 0 8px 8px',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          Move mouse to top to show toolbar
        </div>
      )}

      {/* PDF canvas area */}
      <div
        ref={canvasAreaRef}
        style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '32px 0',
          backgroundColor: '#1e1e1e',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              marginTop: '100px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '4px solid #333',
                borderTop: '4px solid #0066cc',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />

            <div
              style={{
                color: '#999',
                fontSize: '16px',
                fontWeight: '500',
              }}
            >
              Loading PDF…
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              height: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              backgroundColor: 'white',
              borderRadius: '4px',
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          backgroundColor: '#252525',
          padding: '6px 20px',
          color: '#999',
          fontSize: '12.5px',
          borderTop: '1px solid #3a3a3a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          height: statusBarHeight,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
          }}
        >
          <FileText size={13} />
          <span
            style={{
              fontWeight: '500',
              color: '#ccc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span>
            Page {currentPage} of {numPages}
          </span>
          <span>{Math.round(scale * 100)}% zoom</span>
          {rotation !== 0 && <span>{rotation}° rotated</span>}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          canvas {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({
  onClick,
  disabled = false,
  active = false,
  primary = false,
  tooltip = '',
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    style={{
      padding: '8px 12px',
      backgroundColor: active || primary ? '#0066cc' : '#333',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13.5px',
      fontWeight: '500',
      transition: 'background-color 0.15s',
      boxShadow: primary ? '0 2px 8px rgba(0,102,204,0.3)' : 'none',
    }}
    onMouseEnter={(event) => {
      if (!disabled) {
        event.currentTarget.style.backgroundColor =
          active || primary ? '#0052a3' : '#404040';
      }
    }}
    onMouseLeave={(event) => {
      if (!disabled) {
        event.currentTarget.style.backgroundColor =
          active || primary ? '#0066cc' : '#333';
      }
    }}
  >
    {children}
  </button>
);

export default PDFReader;

