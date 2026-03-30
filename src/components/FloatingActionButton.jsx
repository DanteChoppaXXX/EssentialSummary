// src/components/FloatingActionButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The FAB is kept simple. It just calls the callbacks it receives.
// ALL usage tracking, limit checking, and modal logic lives in HomePage.jsx
// where it belongs — because HomePage already knows about pdfDocument, apiKey,
// and all the other conditions that affect whether an action should run.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, FileText, BookOpen, X } from 'lucide-react';

const FloatingActionButton = ({ onSummarizePage, onSummarizeChapter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleOptionClick = (callback) => {
    setIsOpen(false);
    callback(); // HomePage.jsx handles everything — limit check, modal, API call
  };

  return (
    <>
      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 9999,
            animation: 'slideUp 0.2s ease-out'
          }}
        >
          <button
            onClick={() => handleOptionClick(onSummarizePage)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 20px', backgroundColor: 'white', border: 'none',
              borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer', fontSize: '15px', fontWeight: '500',
              color: '#333', transition: 'all 0.2s', minWidth: '200px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.transform = 'translateX(-4px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', backgroundColor: '#e3f2fd', borderRadius: '8px'
            }}>
              <FileText size={18} color="#1976d2" />
            </div>
            <span>Summarize Page</span>
          </button>

          <button
            onClick={() => handleOptionClick(onSummarizeChapter)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 20px', backgroundColor: 'white', border: 'none',
              borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer', fontSize: '15px', fontWeight: '500',
              color: '#333', transition: 'all 0.2s', minWidth: '200px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.transform = 'translateX(-4px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', backgroundColor: '#f3e5f5', borderRadius: '8px'
            }}>
              <BookOpen size={18} color="#7b1fa2" />
            </div>
            <span>Multi-Page Summary</span>
          </button>
        </div>
      )}

      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '64px', height: '64px', borderRadius: '50%',
          backgroundColor: isOpen ? '#d32f2f' : '#6366f1',
          border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 10000,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)';
          }
        }}
        aria-label="Summarize options"
      >
        {isOpen
          ? <X size={28} color="white" strokeWidth={2.5} />
          : <Sparkles size={28} color="white" strokeWidth={2.5} />
        }
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          button[aria-label="Summarize options"] {
            width: 56px !important; height: 56px !important;
            bottom: 20px !important; right: 20px !important;
          }
          div[style*="bottom: 100px"] {
            bottom: 88px !important; right: 20px !important;
          }
          div[style*="bottom: 100px"] button {
            padding: 16px 18px !important;
            min-width: 180px !important;
            font-size: 14px !important;
          }
        }
        button[aria-label="Summarize options"],
        div[style*="bottom: 100px"] {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </>
  );
};

export default FloatingActionButton;
