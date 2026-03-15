import React, { useState, useRef, useEffect } from 'react';
import PDFReader from '../components/PDFReader';
import FloatingActionButton from '../components/FloatingActionButton';
import { 
  extractTextFromPage, 
  extractCurrentChapter 
} from '../components/pdfUtils';
import {
  summarizeWithOpenRouter,
  summarizeLongText,
  getOpenRouterApiKey,
  saveOpenRouterApiKey,
  validateOpenRouterKey,
  OPENROUTER_MODELS
} from '../components/openRouterAPI';

// Simple Markdown renderer component
const MarkdownContent = ({ content }) => {
  // Convert markdown to HTML-like structure
  const renderMarkdown = (text) => {
    if (!text) return null;

    // Split by lines
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let inCodeBlock = false;
    let codeBlockContent = [];

    lines.forEach((line, index) => {
      // Code blocks (```)
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${index}`} style={{
              backgroundColor: '#f6f8fa',
              padding: '16px',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '14px',
              fontFamily: 'monospace',
              border: '1px solid #e1e4e8',
              margin: '16px 0'
            }}>
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headers (##, ###, etc.)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const sizes = { 1: '24px', 2: '20px', 3: '18px', 4: '16px', 5: '14px', 6: '13px' };
        const margins = { 1: '24px 0 16px 0', 2: '20px 0 12px 0', 3: '16px 0 10px 0', 4: '14px 0 8px 0', 5: '12px 0 6px 0', 6: '10px 0 6px 0' };
        
        elements.push(
          <h1 key={index} style={{
            fontSize: sizes[level],
            fontWeight: '600',
            margin: margins[level],
            color: '#1a1a1a',
            borderBottom: level <= 2 ? '1px solid #e1e4e8' : 'none',
            paddingBottom: level <= 2 ? '8px' : '0'
          }}>
            {text}
          </h1>
        );
        return;
      }

      // Bullet points (-, *, +)
      const bulletMatch = line.match(/^[\s]*[-*+]\s+(.+)/);
      if (bulletMatch) {
        currentList.push(bulletMatch[1]);
        return;
      } else if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${index}`} style={{
            marginLeft: '20px',
            marginBottom: '16px',
            lineHeight: '1.8'
          }}>
            {currentList.map((item, i) => (
              <li key={i} style={{ marginBottom: '8px' }}>
                {parseInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }

      // Numbered lists (1., 2., etc.)
      const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        elements.push(
          <ol key={index} style={{
            marginLeft: '20px',
            marginBottom: '16px',
            lineHeight: '1.8'
          }}>
            <li style={{ marginBottom: '8px' }}>
              {parseInlineMarkdown(numberedMatch[2])}
            </li>
          </ol>
        );
        return;
      }

      // Horizontal rule (---, ___, ***)
      if (line.match(/^[\s]*[-_*]{3,}[\s]*$/)) {
        elements.push(
          <hr key={index} style={{
            border: 'none',
            borderTop: '2px solid #e1e4e8',
            margin: '24px 0'
          }} />
        );
        return;
      }

      // Blockquote (>)
      const quoteMatch = line.match(/^>\s+(.+)/);
      if (quoteMatch) {
        elements.push(
          <blockquote key={index} style={{
            borderLeft: '4px solid #dfe2e5',
            paddingLeft: '16px',
            margin: '16px 0',
            color: '#666',
            fontStyle: 'italic'
          }}>
            {parseInlineMarkdown(quoteMatch[1])}
          </blockquote>
        );
        return;
      }

      // Regular paragraph
      if (line.trim()) {
        elements.push(
          <p key={index} style={{
            marginBottom: '16px',
            lineHeight: '1.8'
          }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      } else {
        // Empty line - just add space
        elements.push(<div key={index} style={{ height: '8px' }} />);
      }
    });

    // Flush any remaining list
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-end`} style={{
          marginLeft: '20px',
          marginBottom: '16px',
          lineHeight: '1.8'
        }}>
          {currentList.map((item, i) => (
            <li key={i} style={{ marginBottom: '8px' }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    }

    return elements;
  };

  // Parse inline markdown (bold, italic, code, links)
  const parseInlineMarkdown = (text) => {
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold (**text** or __text__)
      const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2/);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(boldMatch[1]);
        parts.push(<strong key={key++} style={{ fontWeight: '600', color: '#1a1a1a' }}>{boldMatch[3]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic (*text* or _text_)
      const italicMatch = remaining.match(/^(.*?)([*_])(.+?)\2/);
      if (italicMatch) {
        if (italicMatch[1]) parts.push(italicMatch[1]);
        parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[3]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Inline code (`code`)
      const codeMatch = remaining.match(/^(.*?)`(.+?)`/);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(codeMatch[1]);
        parts.push(
          <code key={key++} style={{
            backgroundColor: '#f6f8fa',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '0.9em',
            fontFamily: 'monospace',
            border: '1px solid #e1e4e8'
          }}>
            {codeMatch[2]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Links ([text](url))
      const linkMatch = remaining.match(/^(.*?)\[(.+?)\]\((.+?)\)/);
      if (linkMatch) {
        if (linkMatch[1]) parts.push(linkMatch[1]);
        parts.push(
          <a key={key++} href={linkMatch[3]} target="_blank" rel="noopener noreferrer" style={{
            color: '#0366d6',
            textDecoration: 'none',
            borderBottom: '1px solid transparent',
            transition: 'border-bottom 0.2s'
          }}>
            {linkMatch[2]}
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // No more matches, add remaining text
      parts.push(remaining);
      break;
    }

    return parts;
  };

  return <div style={{ wordWrap: 'break-word' }}>{renderMarkdown(content)}</div>;
};

function HomePage() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryType, setSummaryType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(OPENROUTER_MODELS.GOOGLE_GEMINI_FLASH);
  
  const pdfReaderRef = useRef(null);

  useEffect(() => {
    const savedKey = getOpenRouterApiKey();
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setSelectedFile(file.name);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const loadSamplePDF = () => {
    setPdfUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
    setSelectedFile('sample.pdf');
  };

  const checkApiKey = () => {
    if (!apiKey || apiKey.trim().length === 0) {
      setShowApiKeyModal(true);
      return false;
    }
    return true;
  };

  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey.trim().length === 0) {
      alert('Please enter a valid API key');
      return;
    }

    setIsLoading(true);
    const isValid = await validateOpenRouterKey(apiKey);
    setIsLoading(false);

    if (!isValid) {
      alert('Invalid API key. Please check and try again.');
      return;
    }

    saveOpenRouterApiKey(apiKey);
    setShowApiKeyModal(false);
    alert('API key saved successfully!');
  };

  const handleSummarizePage = async () => {
    if (!pdfDocument) {
      alert('Please wait for the PDF to load');
      return;
    }

    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType('page');
    setSummaryContent('Extracting text from current page...');

    try {
      const pageText = await extractTextFromPage(pdfDocument, currentPage);
      
      if (!pageText || pageText.trim().length === 0) {
        setSummaryContent('No text found on this page. It may be an image or scanned document.');
        setIsLoading(false);
        return;
      }

      setSummaryContent(`Extracted ${pageText.split(/\s+/).length} words.\n\nGenerating AI summary using OpenRouter...`);
      
      const summary = await summarizeWithOpenRouter(pageText, 'page', apiKey, { model: selectedModel });
      
      if (!summary || summary.trim().length === 0) {
        setSummaryContent('Failed to generate summary. Please try again.');
      } else {
        setSummaryContent(
          `📄 **Page ${currentPage} Summary**\n\n${summary}\n\n---\n` +
          `**Word Count:** ${pageText.split(/\s+/).length} words`
        );
      }
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = error.message;
      setSummaryContent(`❌ Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeChapter = async () => {
    if (!pdfDocument) {
      alert('Please wait for the PDF to load');
      return;
    }

    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType('chapter');
    setSummaryContent('Detecting chapter boundaries and extracting text...');

    try {
      const chapterData = await extractCurrentChapter(pdfDocument, currentPage);
      
      if (!chapterData.text || chapterData.text.trim().length === 0) {
        setSummaryContent('No text found in this chapter.');
        setIsLoading(false);
        return;
      }

      const wordCount = chapterData.text.split(/\s+/).length;
      setSummaryContent(
        `Analyzing chapter (Pages ${chapterData.startPage}-${chapterData.endPage}, ${wordCount} words)...\n\n` +
        `Generating AI summary with OpenRouter...`
      );
      
      let summary;
      if (chapterData.text.length > 10000) {
        summary = await summarizeLongText(chapterData.text, 'chapter', apiKey, (progress, message) => {
          setSummaryContent(`Analyzing chapter...\n\n${message}\nProgress: ${progress}%`);
        });
      } else {
        summary = await summarizeWithOpenRouter(chapterData.text, 'chapter', apiKey, { model: selectedModel });
      }
      
      if (!summary || summary.trim().length === 0) {
        setSummaryContent('Failed to generate summary. Please try again.');
      } else {
        setSummaryContent(
          // `📚 **Chapter Summary**\n\n**Pages:** ${chapterData.startPage}-${chapterData.endPage}\n\n${summary}\n\n---\n` +
          // `**Word Count:** ${wordCount} words`
            'CHAPTER SUMMARY COMING SOON'
        );
      }
    } catch (error) {
      console.error('Error:', error);
      setSummaryContent(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeSummary = () => {
    setShowSummary(false);
    setSummaryContent('');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, position: 'relative' }}>
      {!pdfUrl ? (
        <div style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px'
          }}>

<div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'1rem 0.5rem 0.5rem' }}>

  {/* Badge */}
  <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'0px', borderRadius:100, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:11.5, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#15803d', fontFamily:"'Outfit', sans-serif", marginBottom:'2rem' }}>
    <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} />
    AI-Powered Study Tool
  </div>

  {/* Heading */}
  <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:'clamp(28px, 7vw, 56px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.02em', color:'#0f172a', margin:'0 0 0.15em', maxWidth:680 }}>
    Essential Summary:<br />
    Students'{' '}
    <em style={{ fontStyle:'italic', position:'relative', display:'inline-block' }}>
      Reading
      {/* SVG underline */}
      <svg viewBox="0 0 220 14" style={{ position:'absolute', bottom:-6, left:-2, width:'calc(100% + 4px)', height:14 }} xmlns="http://www.w3.org/2000/svg">
        <path d="M4 10 Q55 3 110 8 Q165 13 218 6" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.85"/>
        <path d="M8 13 Q60 7 112 11 Q164 15 216 9" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      </svg>
    </em>{' '}Accelerator
  </h1>

  {/* Accent line */}
  <div style={{ width:48, height:4, background:'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius:4, margin:'1.75rem 0 0' }} />

  {/* Subtitle */}
  <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:'clamp(14px, 2.5vw, 17px)', color:'#64748b', marginTop:'1.5rem', lineHeight:1.6, maxWidth:440 }}>
    Transform dense material into <strong style={{ fontWeight:600, color:'#334155' }}>clear, concise summaries</strong> — so students read less and remember more.
  </p>

  {/* Stats bar */}
  <div style={{ display:'flex', marginTop:'1.0rem', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', background:'#fff' }}>
    {[['3×','Faster reading'],['85%','Retention boost'],['10k+','Students']].map(([num, label], i, arr) => (
      <div key={i} style={{ padding:'14px 28px', display:'flex', flexDirection:'column', alignItems:'center', gap:2, borderRight: i < arr.length-1 ? '1px solid #e2e8f0' : 'none' }}>
        <span style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color:'#0f172a', lineHeight:1 }}>{num}</span>
        <span style={{ fontFamily:"'Outfit', sans-serif", fontSize:11, fontWeight:500, color:'#94a3b8', letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</span>
      </div>
    ))}
  </div>
</div>            
            <div style={{
              backgroundColor: 'white',
              padding: 'clamp(24px, 5vw, 40px)',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <label 
                htmlFor="file-upload"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  fontWeight: '500',
                  marginBottom: '16px',
                  transition: 'background-color 0.2s',
                  boxSizing: 'border-box',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
                onTouchStart={(e) => e.target.style.backgroundColor = '#0052a3'}
                onTouchEnd={(e) => e.target.style.backgroundColor = '#0066cc'}
              >
                Upload PDF File
              </label>
              <input
                id="file-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              
              <div style={{
                textAlign: 'center',
                margin: '16px 0',
                color: '#666',
                fontSize: 'clamp(13px, 3vw, 14px)'
              }}>
                or
              </div>
              
              <button
                onClick={loadSamplePDF}
                style={{
                  width: '100%',
                  padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  fontWeight: '500',
                  transition: 'background-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e5e5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                onTouchStart={(e) => e.target.style.backgroundColor = '#e5e5e5'}
                onTouchEnd={(e) => e.target.style.backgroundColor = '#f0f0f0'}
              >
                Load Sample PDF
              </button>
            </div>
            
            <p style={{ 
              color: '#666', 
              fontSize: 'clamp(13px, 3vw, 14px)',
              textAlign: 'center',
              lineHeight: '1.5',
              margin: '0',
              maxWidth: '100%',
              padding: '0 10px'
            }}>
              Upload a PDF and use the AI-powered floating button to summarize pages or chapters
            </p>
          </div>

          {/* Mobile-specific styles */}
          <style>{`
            @media (max-width: 768px) {
              body {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
                touch-action: manipulation;
              }
            }
          `}</style>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <PDFReader 
            ref={pdfReaderRef}
            pdfUrl={pdfUrl} 
            fileName={selectedFile || 'document.pdf'}
            onPageChange={(page) => setCurrentPage(page)}
            onPdfLoad={(pdf) => setPdfDocument(pdf)}
          />
          
          <FloatingActionButton
            onSummarizePage={handleSummarizePage}
            onSummarizeChapter={handleSummarizeChapter}
          />

          {/* Summary Modal */}
          {showSummary && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              padding: '20px',
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                position: 'relative'
              }}>
                <button
                  onClick={closeSummary}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: '24px', color: '#666' }}>×</span>
                </button>

                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  {summaryType === 'page' ? '📄 Page Summary' : '📚 Chapter Summary'}
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '24px'
                }}>
                  {summaryType === 'page' 
                    ? `Summary of page ${currentPage}` 
                    : 'Summary of current chapter'}
                </p>

                {isLoading && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    color: '#666'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #6366f1',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  </div>
                )}

                {!isLoading && (
                  <div style={{
                    fontSize: '15px',
                    lineHeight: '1.8',
                    color: '#333',
                  }}>
                    <MarkdownContent content={summaryContent} />
                  </div>
                )}

                {!isLoading && (
                  <div style={{
                    marginTop: '24px',
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(summaryContent);
                        alert('Summary copied to clipboard!');
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f0f0f0',
                        color: '#333',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e5e5'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={closeSummary}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#5558e3'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#6366f1'}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#333'
            }}>
              Configure OpenRouter API Key
            </h2>
            
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              Get a <strong>free</strong> OpenRouter API key at{' '}
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#6366f1', textDecoration: 'none' }}
              >
                openrouter.ai/keys
              </a>
              <br/><br/>
              No credit card required! Free tier includes Mistral 7B and other great models.
            </p>

            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333',
              marginBottom: '8px'
            }}>
              API Key:
            </label>
            
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px',
                fontFamily: 'monospace',
                marginBottom: '20px'
              }}
            />

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowApiKeyModal(false)}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                {isLoading ? 'Validating...' : 'Save API Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
