import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Search, X, Maximize2, Minimize2 } from 'lucide-react';

const PDFReader = ({ pdfUrl, fileName = 'document.pdf', onPageChange, onPdfLoad }) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfjsLib = useRef(null);

  useEffect(() => {
    // Load PDF.js library
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

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [pdfUrl]);

  const loadPDF = async () => {
    if (!pdfjsLib.current) return;
    
    setLoading(true);
    try {
      const loadingTask = pdfjsLib.current.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pdf) {
      renderPage(currentPage);
      // Notify parent component of page change
      if (onPageChange) {
        onPageChange(currentPage);
      }
    }
  }, [pdf, currentPage, scale]);

  // Notify parent when PDF is loaded
  useEffect(() => {
    if (pdf && onPdfLoad) {
      onPdfLoad(pdf);
    }
  }, [pdf, onPdfLoad]);

  const renderPage = async (pageNum) => {
    if (!pdf || pageRendering) return;
    
    setPageRendering(true);
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale });
      
      // Adjust for high DPI displays
      const outputScale = window.devicePixelRatio || 1;
      
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      
      const renderContext = {
        canvasContext: context,
        transform,
        viewport
      };
      
      await page.render(renderContext).promise;
      setPageRendering(false);
    } catch (error) {
      console.error('Error rendering page:', error);
      setPageRendering(false);
    }
  };

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
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
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSearch = async () => {
    if (!pdf || !searchText.trim()) return;
    
    // Simple search implementation - you can enhance this
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      
      if (text.toLowerCase().includes(searchText.toLowerCase())) {
        goToPage(i);
        break;
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="pdf-reader-container"
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#525252',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Toolbar */}
      <div style={{
        backgroundColor: '#2d2d2d',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid #404040'
      }}>
        {/* Left controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: 'white',
            fontSize: '14px'
          }}>
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              min="1"
              max={numPages}
              style={{
                width: '50px',
                padding: '6px',
                backgroundColor: '#404040',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            />
            <span>/ {numPages}</span>
          </div>
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage >= numPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= numPages ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Center controls - Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
              opacity: scale <= 0.5 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ZoomOut size={18} />
          </button>
          
          <span style={{ color: 'white', fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: scale >= 3.0 ? 'not-allowed' : 'pointer',
              opacity: scale >= 3.0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ZoomIn size={18} />
          </button>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              padding: '8px 12px',
              backgroundColor: showSearch ? '#555' : '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search size={18} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          
          <button
            onClick={handleDownload}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{
          backgroundColor: '#2d2d2d',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #404040'
        }}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search in document..."
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Find
          </button>
          <button
            onClick={() => setShowSearch(false)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#404040',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* PDF Canvas */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '20px',
        backgroundColor: '#525252'
      }}>
        {loading ? (
          <div style={{ 
            color: 'white', 
            fontSize: '18px',
            marginTop: '50px'
          }}>
            Loading PDF...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              height: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              backgroundColor: 'white'
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div style={{
        backgroundColor: '#2d2d2d',
        padding: '8px 16px',
        color: '#999',
        fontSize: '12px',
        borderTop: '1px solid #404040',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span>{fileName}</span>
        <span>Page {currentPage} of {numPages}</span>
      </div>

      {/* Mobile-friendly CSS */}
      <style>{`
        @media (max-width: 768px) {
          .pdf-reader-container {
            height: 100vh;
            height: 100dvh; /* Dynamic viewport height for mobile */
          }
          
          .pdf-reader-container input[type="number"] {
            width: 45px !important;
            font-size: 14px;
          }
          
          .pdf-reader-container button {
            padding: 6px 10px !important;
            font-size: 14px;
          }
        }

        /* Hide number input spinner */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }

        /* Scrollbar styling */
        .pdf-reader-container *::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        
        .pdf-reader-container *::-webkit-scrollbar-track {
          background: #2d2d2d;
        }
        
        .pdf-reader-container *::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 6px;
        }
        
        .pdf-reader-container *::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>
    </div>
  );
};

export default PDFReader;
