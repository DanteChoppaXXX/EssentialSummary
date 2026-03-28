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

const TOOLBAR_HIDE_DELAY = 2500; // ms idle before toolbar hides
const HOVER_ZONE_HEIGHT  = 60;   // px from top — moving here reveals toolbar

const PDFReader = ({ pdfUrl, fileName = 'document.pdf', onPageChange, onPdfLoad }) => {
  const [numPages, setNumPages]           = useState(0);
  const [currentPage, setCurrentPage]     = useState(1);
  const [scale, setScale]                 = useState(1.0);
  const [rotation, setRotation]           = useState(0);
  const [loading, setLoading]             = useState(true);
  const [searchText, setSearchText]       = useState('');
  const [showSearch, setShowSearch]       = useState(false);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [pdf, setPdf]                     = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  const [searchResults, setSearchResults]         = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [pageInputValue, setPageInputValue]         = useState('1');
  const [isPageInputFocused, setIsPageInputFocused] = useState(false);

  // ── Toolbar visibility ──
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef(null);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const pdfjsLib     = useRef(null);

  // ── Show toolbar and (re)start the hide countdown ──
  const showToolbar = useCallback(() => {
    setToolbarVisible(true);
    clearTimeout(hideTimerRef.current);
    // Don't auto-hide while search is open or search input is focused
    if (!showSearch) {
      hideTimerRef.current = setTimeout(() => {
        setToolbarVisible(false);
      }, TOOLBAR_HIDE_DELAY);
    }
  }, [showSearch]);

  // ── Keep toolbar visible while search is open ──
  useEffect(() => {
    if (showSearch) {
      clearTimeout(hideTimerRef.current);
      setToolbarVisible(true);
    } else {
      // Restart idle timer when search closes
      hideTimerRef.current = setTimeout(() => {
        setToolbarVisible(false);
      }, TOOLBAR_HIDE_DELAY);
    }
    return () => clearTimeout(hideTimerRef.current);
  }, [showSearch]);

  // ── Mouse proximity detection — reveal toolbar when near top ──
  useEffect(() => {
    function handleMouseMove(e) {
      if (e.clientY <= HOVER_ZONE_HEIGHT) {
        showToolbar();
      }
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [showToolbar]);

  // ── Start the initial hide timer on mount ──
  useEffect(() => {
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), TOOLBAR_HIDE_DELAY);
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  // ── Load pdf.js ──
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      pdfjsLib.current = window.pdfjsLib;
      pdfjsLib.current.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loadPDF();
    };
    document.body.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, [pdfUrl]);

  const loadPDF = async () => {
    if (!pdfjsLib.current) return;
    setLoading(true);
    try {
      const pdfDoc = await pdfjsLib.current.getDocument(pdfUrl).promise;
      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pdf) {
      renderPage(currentPage);
      if (onPageChange) onPageChange(currentPage);
    }
  }, [pdf, currentPage, scale, rotation]);

  useEffect(() => {
    if (pdf && onPdfLoad) onPdfLoad(pdf);
  }, [pdf, onPdfLoad]);

  const renderPage = async (pageNum) => {
    if (!pdf || pageRendering) return;
    setPageRendering(true);
    try {
      const page     = await pdf.getPage(pageNum);
      const canvas   = canvasRef.current;
      const context  = canvas.getContext('2d');
      const viewport = page.getViewport({ scale, rotation });
      const dpr      = window.devicePixelRatio || 1;

      canvas.width        = Math.floor(viewport.width  * dpr);
      canvas.height       = Math.floor(viewport.height * dpr);
      canvas.style.width  = Math.floor(viewport.width)  + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      context.scale(dpr, dpr);

      await page.render({ canvasContext: context, viewport }).promise;
      setPageRendering(false);
    } catch (err) {
      console.error('Error rendering page:', err);
      setPageRendering(false);
    }
  };

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= numPages) setCurrentPage(pageNum);
  };

  const handleZoomIn  = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate  = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href     = pdfUrl;
    link.download = fileName;
    link.click();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleSearch = async () => {
    if (!pdf || !searchText.trim()) return;
    const results = [];
    for (let i = 1; i <= numPages; i++) {
      const page        = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text        = textContent.items.map(item => item.str).join(' ');
      if (text.toLowerCase().includes(searchText.toLowerCase())) results.push(i);
    }
    setSearchResults(results);
    setCurrentSearchIndex(0);
    if (results.length > 0) goToPage(results[0]);
  };

  const nextSearchResult = () => {
    if (!searchResults.length) return;
    const next = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(next);
    goToPage(searchResults[next]);
  };

  const prevSearchResult = () => {
    if (!searchResults.length) return;
    const prev = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prev);
    goToPage(searchResults[prev]);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowLeft':  goToPage(currentPage - 1); break;
        case 'ArrowRight': goToPage(currentPage + 1); break;
        case '+': case '=': handleZoomIn();  break;
        case '-':           handleZoomOut(); break;
        case 'r': case 'R': handleRotate();  break;
        case 'f': case 'F':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); setShowSearch(true); }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, numPages]);

  // ── Status bar: always show current page even when toolbar is hidden ──
  const statusBarHeight = 38;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Invisible hover zone at very top — always present ── */}
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

      {/* ── Toolbar — slides in/out ── */}
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
        {/* Main toolbar */}
        <div style={{
          backgroundColor: '#252525',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #3a3a3a',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {/* Left — navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <ToolbarButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} tooltip="Previous (←)">
              <ChevronLeft size={20} />
            </ToolbarButton>

            <div style={{ display:'flex', alignItems:'center', gap:'8px', backgroundColor:'#333', padding:'5px 12px', borderRadius:'6px', color:'white', fontSize:'14px' }}>
              <input
                type="number"
                value={isPageInputFocused ? pageInputValue : currentPage}
                onChange={(e) => setPageInputValue(e.target.value)}
                onFocus={(e) => { setIsPageInputFocused(true); setPageInputValue(String(currentPage)); setTimeout(() => e.target.select(), 0); }}
                onBlur={() => {
                  setIsPageInputFocused(false);
                  const n = parseInt(pageInputValue);
                  if (!isNaN(n) && n >= 1 && n <= numPages) goToPage(n);
                  else setPageInputValue(String(currentPage));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') { setPageInputValue(String(currentPage)); e.target.blur(); }
                }}
                min="1" max={numPages}
                style={{ width:'48px', padding:'3px 8px', backgroundColor:'#1e1e1e', color:'white', border:'1px solid #555', borderRadius:'4px', textAlign:'center', fontSize:'14px' }}
              />
              <span style={{ color:'#999' }}>/</span>
              <span>{numPages}</span>
            </div>

            <ToolbarButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} tooltip="Next (→)">
              <ChevronRight size={20} />
            </ToolbarButton>
          </div>

          {/* Center — zoom & tools */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <ToolbarButton onClick={handleZoomOut} disabled={scale <= 0.5} tooltip="Zoom Out (-)">
              <ZoomOut size={18} />
            </ToolbarButton>
            <div style={{ backgroundColor:'#333', padding:'5px 14px', borderRadius:'6px', color:'white', fontSize:'14px', fontWeight:'500', minWidth:'64px', textAlign:'center' }}>
              {Math.round(scale * 100)}%
            </div>
            <ToolbarButton onClick={handleZoomIn} disabled={scale >= 3.0} tooltip="Zoom In (+)">
              <ZoomIn size={18} />
            </ToolbarButton>
            <div style={{ width:'1px', height:'22px', backgroundColor:'#444', margin:'0 2px' }} />
            <ToolbarButton onClick={handleRotate} tooltip="Rotate (R)">
              <RotateCw size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => setScale(1.0)} active={scale === 1.0} tooltip="Fit to Width">
              <span style={{ fontSize:'13px', fontWeight:'500' }}>Fit</span>
            </ToolbarButton>
          </div>

          {/* Right — actions */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <ToolbarButton onClick={() => setShowSearch(!showSearch)} active={showSearch} tooltip="Search (Ctrl+F)">
              <Search size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => window.print()} tooltip="Print">
              <Printer size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={toggleFullscreen} tooltip="Fullscreen">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </ToolbarButton>
            <ToolbarButton onClick={handleDownload} tooltip="Download" primary>
              <Download size={18} />
            </ToolbarButton>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div style={{ backgroundColor:'#2a2a2a', padding:'10px 20px', display:'flex', alignItems:'center', gap:'12px', borderBottom:'1px solid #3a3a3a' }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search in document..."
              autoFocus
              style={{ flex:1, padding:'9px 14px', backgroundColor:'#1e1e1e', color:'white', border:'1px solid #555', borderRadius:'6px', outline:'none', fontSize:'14px' }}
            />
            <button
              onClick={handleSearch}
              style={{ padding:'9px 18px', backgroundColor:'#0066cc', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'500', fontSize:'14px' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
            >
              Find
            </button>
            {searchResults.length > 0 && (
              <>
                <div style={{ color:'#999', fontSize:'14px', whiteSpace:'nowrap' }}>{currentSearchIndex + 1} / {searchResults.length}</div>
                <ToolbarButton onClick={prevSearchResult} tooltip="Previous"><ChevronLeft size={16} /></ToolbarButton>
                <ToolbarButton onClick={nextSearchResult} tooltip="Next"><ChevronRight size={16} /></ToolbarButton>
              </>
            )}
            <ToolbarButton onClick={() => { setShowSearch(false); setSearchResults([]); setSearchText(''); }} tooltip="Close">
              <X size={18} />
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* ── "Peek" hint when toolbar is hidden ── */}
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
          Touch to show toolbar
        </div>
      )}

      {/* ── PDF canvas ── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '32px 20px',
          backgroundColor: '#1e1e1e',
        }}
      >
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px', marginTop:'100px' }}>
            <div style={{ width:'48px', height:'48px', border:'4px solid #333', borderTop:'4px solid #0066cc', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
            <div style={{ color:'#999', fontSize:'16px', fontWeight:'500' }}>Loading PDF…</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ maxWidth:'100%', height:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', backgroundColor:'white', borderRadius:'4px' }}
          />
        )}
      </div>

      {/* ── Status bar — always visible ── */}
      <div style={{
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
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <FileText size={13} />
          <span style={{ fontWeight:'500', color:'#ccc' }}>{fileName}</span>
        </div>
        <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
          <span>Page {currentPage} of {numPages}</span>
          <span>{Math.round(scale * 100)}% zoom</span>
          {rotation !== 0 && <span>{rotation}° rotated</span>}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0%   { transform: rotate(0deg);   }
          100% { transform: rotate(360deg); }
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        @media print {
          .pdf-reader-container > div:first-child,
          .pdf-reader-container > div:last-child { display: none !important; }
        }
      `}</style>
    </div>
  );
};

const ToolbarButton = ({ onClick, disabled = false, active = false, primary = false, tooltip = '', children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    style={{
      padding: '8px 12px',
      backgroundColor: active ? '#0066cc' : primary ? '#0066cc' : '#333',
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
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = active || primary ? '#0052a3' : '#404040'; }}
    onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = active || primary ? '#0066cc' : '#333'; }}
  >
    {children}
  </button>
);

export default PDFReader;
