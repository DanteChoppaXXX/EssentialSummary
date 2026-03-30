// src/pages/HomePage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import PDFReader from '../components/PDFReader';
import FloatingActionButton from '../components/FloatingActionButton';
import AuthModal from '../components/AuthModal/AuthModal';
import UpgradeModal from '../components/UpgradeModal/UpgradeModal';
import SoftWarningBanner from '../components/SoftWarningBanner';
import FreeTierBanner from '../components/FreeTierBanner';

import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../hooks/useAuthModal';
import { useUpgradeModal } from '../hooks/useUpgradeModal';

import {
  hasReachedAnonymousQuickSummaryLimit,
  incrementAnonymousQuickSummaryCount,
  getSoftWarningMessage,
} from '../utils/anonymousUsage';

import {
  checkAndResetIfNeeded,
  canUserUseQuickSummary,
  incrementQuickSummaryUsage,
} from '../services/usageService';

import {
  extractTextFromPage,
  extractCurrentChapter,
} from '../components/pdfUtils';

import {
  summarizeWithOpenRouter,
  summarizeLongText,
  getOpenRouterApiKey,
  saveOpenRouterApiKey,
  validateOpenRouterKey,
  OPENROUTER_MODELS,
} from '../components/openRouterAPI';

import { useNavigate } from "react-router-dom";
import { isPremiumActive } from "../services/premiumService";
import { saveSummary } from "../services/summaryService";

// ─── Markdown renderer ────────────────────────────────────────────────────
const MarkdownContent = ({ content }) => {
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let inCodeBlock = false;
    let codeBlockContent = [];

    lines.forEach((line, index) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(<pre key={`code-${index}`} style={{ backgroundColor:'#f6f8fa', padding:'16px', borderRadius:'6px', overflow:'auto', fontSize:'14px', fontFamily:'monospace', border:'1px solid #e1e4e8', margin:'16px 0' }}><code>{codeBlockContent.join('\n')}</code></pre>);
          codeBlockContent = []; inCodeBlock = false;
        } else { inCodeBlock = true; }
        return;
      }
      if (inCodeBlock) { codeBlockContent.push(line); return; }
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const sizes = {1:'24px',2:'20px',3:'18px',4:'16px',5:'14px',6:'13px'};
        const margins = {1:'24px 0 16px 0',2:'20px 0 12px 0',3:'16px 0 10px 0',4:'14px 0 8px 0',5:'12px 0 6px 0',6:'10px 0 6px 0'};
        elements.push(<h1 key={index} style={{ fontSize:sizes[level], fontWeight:'600', margin:margins[level], color:'#1a1a1a', borderBottom:level<=2?'1px solid #e1e4e8':'none', paddingBottom:level<=2?'8px':'0' }}>{headerMatch[2]}</h1>);
        return;
      }
      const bulletMatch = line.match(/^[\s]*[-*+]\s+(.+)/);
      if (bulletMatch) { currentList.push(bulletMatch[1]); return; }
      else if (currentList.length > 0) {
        elements.push(<ul key={`list-${index}`} style={{ marginLeft:'20px', marginBottom:'16px', lineHeight:'1.8' }}>{currentList.map((item,i)=><li key={i} style={{marginBottom:'8px'}}>{parseInlineMarkdown(item)}</li>)}</ul>);
        currentList = [];
      }
      const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/);
      if (numberedMatch) { elements.push(<ol key={index} style={{ marginLeft:'20px', marginBottom:'16px', lineHeight:'1.8' }}><li style={{marginBottom:'8px'}}>{parseInlineMarkdown(numberedMatch[2])}</li></ol>); return; }
      if (line.match(/^[\s]*[-_*]{3,}[\s]*$/)) { elements.push(<hr key={index} style={{ border:'none', borderTop:'2px solid #e1e4e8', margin:'24px 0' }} />); return; }
      const quoteMatch = line.match(/^>\s+(.+)/);
      if (quoteMatch) { elements.push(<blockquote key={index} style={{ borderLeft:'4px solid #dfe2e5', paddingLeft:'16px', margin:'16px 0', color:'#666', fontStyle:'italic' }}>{parseInlineMarkdown(quoteMatch[1])}</blockquote>); return; }
      if (line.trim()) { elements.push(<p key={index} style={{ marginBottom:'16px', lineHeight:'1.8' }}>{parseInlineMarkdown(line)}</p>); }
      else { elements.push(<div key={index} style={{ height:'8px' }} />); }
    });
    if (currentList.length > 0) {
      elements.push(<ul key="list-end" style={{ marginLeft:'20px', marginBottom:'16px', lineHeight:'1.8' }}>{currentList.map((item,i)=><li key={i} style={{marginBottom:'8px'}}>{parseInlineMarkdown(item)}</li>)}</ul>);
    }
    return elements;
  };

  const parseInlineMarkdown = (text) => {
    const parts = []; let remaining = text; let key = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2/);
      if (boldMatch) { if (boldMatch[1]) parts.push(boldMatch[1]); parts.push(<strong key={key++} style={{fontWeight:'600',color:'#1a1a1a'}}>{boldMatch[3]}</strong>); remaining = remaining.slice(boldMatch[0].length); continue; }
      const italicMatch = remaining.match(/^(.*?)([*_])(.+?)\2/);
      if (italicMatch) { if (italicMatch[1]) parts.push(italicMatch[1]); parts.push(<em key={key++} style={{fontStyle:'italic'}}>{italicMatch[3]}</em>); remaining = remaining.slice(italicMatch[0].length); continue; }
      const codeMatch = remaining.match(/^(.*?)`(.+?)`/);
      if (codeMatch) { if (codeMatch[1]) parts.push(codeMatch[1]); parts.push(<code key={key++} style={{backgroundColor:'#f6f8fa',padding:'2px 6px',borderRadius:'3px',fontSize:'0.9em',fontFamily:'monospace',border:'1px solid #e1e4e8'}}>{codeMatch[2]}</code>); remaining = remaining.slice(codeMatch[0].length); continue; }
      const linkMatch = remaining.match(/^(.*?)\[(.+?)\]\((.+?)\)/);
      if (linkMatch) { if (linkMatch[1]) parts.push(linkMatch[1]); parts.push(<a key={key++} href={linkMatch[3]} target="_blank" rel="noopener noreferrer" style={{color:'#0366d6',textDecoration:'none'}}>{linkMatch[2]}</a>); remaining = remaining.slice(linkMatch[0].length); continue; }
      parts.push(remaining); break;
    }
    return parts;
  };

  return <div style={{ wordWrap:'break-word' }}>{renderMarkdown(content)}</div>;
};

// ─── Landing page data ─────────────────────────────────────────────────────
const FREE_FEATURES = [
  { icon: '⚡', title: 'Quick Page Summary',  desc: 'Get the key ideas from any PDF page in seconds using AI — up to 10 times per month.' },
  { icon: '💾', title: 'Saved Summaries',     desc: 'Every summary you generate is automatically saved to your personal library.' },
  { icon: '📋', title: 'Copy & Export',       desc: 'Copy any summary to your clipboard instantly to paste into your notes.' },
  { icon: '📊', title: 'Usage Dashboard',     desc: 'Track your monthly usage and view all your past summaries in one clean place.' },
];

const PREMIUM_FEATURES = [
  { icon: '📚', title: 'Multi-Page Summary',       desc: 'Summarize multiple pages at once — perfect for textbooks and long reports.' },
  { icon: '♾️', title: 'Unlimited Summaries',   desc: 'No monthly cap. Summarize as many pages as you need, any time.' },
  { icon: '🚀', title: 'Priority AI Processing',desc: 'Your requests are processed first — no waiting during peak hours.' },
  { icon: '✨', title: 'All Future Features',   desc: 'Every new feature we ship is included in your Premium plan automatically.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload your PDF',     desc: 'Drop any PDF — textbooks, lecture notes, research papers, anything.' },
  { step: '02', title: 'Navigate to a page',  desc: 'Use the built-in reader to go to the page or chapter you want to understand.' },
  { step: '03', title: 'Tap the ⚡ button',   desc: 'Hit the floating button and choose Quick Summary or Multi-Page Summary.' },
  { step: '04', title: 'Read and retain',     desc: 'Get a clear summary in seconds. Saved automatically to your library.' },
];

// ─── LandingPage component ────────────────────────────────────────────────
function LandingPage({ onUpload, onSample, navigate, openSignUp }) {
  return (
    <div style={{ width:'100%', backgroundColor:'#f5f5f5', fontFamily:"'Outfit','Segoe UI',sans-serif" }}>

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px 60px', boxSizing:'border-box' }}>
        <div style={{ maxWidth:'500px', width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:'24px' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'1rem 0.5rem 0.5rem' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, borderRadius:100, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:11.5, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#15803d', fontFamily:"'Outfit',sans-serif", marginBottom:'2rem', padding:'5px 14px' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} />
              AI-Powered Study Tool
            </div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,7vw,56px)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.02em', color:'#0f172a', margin:'0 0 0.15em', maxWidth:680 }}>
              Essential Summary:<br />Students'{' '}
              <em style={{ fontStyle:'italic', position:'relative', display:'inline-block' }}>
                Reading
                <svg viewBox="0 0 220 14" style={{ position:'absolute', bottom:-6, left:-2, width:'calc(100% + 4px)', height:14 }} xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10 Q55 3 110 8 Q165 13 218 6" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.85"/>
                  <path d="M8 13 Q60 7 112 11 Q164 15 216 9" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
                </svg>
              </em>{' '}Cheat Code
            </h1>
            <div style={{ width:48, height:4, background:'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius:4, margin:'1.75rem 0 0' }} />
            <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:'clamp(14px,2.5vw,17px)', color:'#64748b', marginTop:'1.5rem', lineHeight:1.6, maxWidth:440 }}>
              Transform dense material into <strong style={{ fontWeight:600, color:'#334155' }}>clear, concise summaries</strong> — so students read less and remember more.
            </p>
            <div style={{ display:'flex', marginTop:'1.0rem', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', background:'#fff' }}>
              {[['3×','Faster reading'],['85%','Retention boost'],['ALL','Students']].map(([num,label],i,arr) => (
                <div key={i} style={{ padding:'14px 28px', display:'flex', flexDirection:'column', alignItems:'center', gap:2, borderRight: i<arr.length-1?'1px solid #e2e8f0':'none' }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:'#0f172a', lineHeight:1 }}>{num}</span>
                  <span style={{ fontFamily:"'Outfit',sans-serif", fontSize:11, fontWeight:500, color:'#94a3b8', letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor:'white', padding:'clamp(24px,5vw,40px)', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', width:'100%', boxSizing:'border-box' }}>
            <label htmlFor="file-upload" style={{ display:'block', width:'100%', padding:'clamp(12px,3vw,16px) clamp(16px,4vw,24px)', backgroundColor:'#0066cc', color:'white', borderRadius:'8px', textAlign:'center', cursor:'pointer', fontSize:'clamp(14px,3.5vw,16px)', fontWeight:'500', marginBottom:'16px', transition:'background-color 0.2s', boxSizing:'border-box', border:'none' }}
              onMouseEnter={(e)=>e.target.style.backgroundColor='#0052a3'}
              onMouseLeave={(e)=>e.target.style.backgroundColor='#0066cc'}
            >Upload PDF File</label>
            <input id="file-upload" type="file" accept="application/pdf" onChange={onUpload} style={{ display:'none' }} />
            <div style={{ textAlign:'center', margin:'16px 0', color:'#666', fontSize:'clamp(13px,3vw,14px)' }}>or</div>
            <button onClick={onSample} style={{ width:'100%', padding:'clamp(12px,3vw,16px) clamp(16px,4vw,24px)', backgroundColor:'#f0f0f0', color:'#333', border:'1px solid #ddd', borderRadius:'8px', cursor:'pointer', fontSize:'clamp(14px,3.5vw,16px)', fontWeight:'500', transition:'background-color 0.2s', boxSizing:'border-box' }}
              onMouseEnter={(e)=>e.target.style.backgroundColor='#e5e5e5'}
              onMouseLeave={(e)=>e.target.style.backgroundColor='#f0f0f0'}
            >Load Sample PDF</button>
          </div>

          <p style={{ color:'#666', fontSize:'clamp(13px,3vw,14px)', textAlign:'center', lineHeight:'1.5', margin:0, padding:'0 10px' }}>
            Upload a PDF and use the AI-powered floating button to summarize pages
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding:'80px 20px', backgroundColor:'#ffffff' }}>
        <div style={{ maxWidth:'860px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', borderRadius:100, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:11.5, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#1d4ed8', padding:'5px 14px', marginBottom:'16px' }}>
              Simple process
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,5vw,36px)', fontWeight:900, color:'#0f172a', margin:'0 0 12px', letterSpacing:'-0.02em' }}>How it works</h2>
            <p style={{ fontSize:'16px', color:'#64748b', margin:'0 auto', maxWidth:440, lineHeight:1.6 }}>From PDF to insight in four simple steps.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'24px' }}>
            {HOW_IT_WORKS.map((item,i) => (
              <div key={i} style={{ padding:'28px 24px', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'14px', display:'flex', flexDirection:'column', gap:'12px' }}>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'36px', fontWeight:900, color:'#e2e8f0', lineHeight:1, letterSpacing:'-0.04em' }}>{item.step}</span>
                <h3 style={{ fontSize:'15px', fontWeight:700, color:'#0f172a', margin:0 }}>{item.title}</h3>
                <p style={{ fontSize:'13.5px', color:'#64748b', margin:0, lineHeight:1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FREE PLAN FEATURES ── */}
      <section style={{ padding:'80px 20px', backgroundColor:'#f5f5f5' }}>
        <div style={{ maxWidth:'860px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, borderRadius:100, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:11.5, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#15803d', padding:'5px 14px', marginBottom:'16px' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} />
              Free plan
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,5vw,36px)', fontWeight:900, color:'#0f172a', margin:'0 0 12px', letterSpacing:'-0.02em' }}>Everything in the free account</h2>
            <p style={{ fontSize:'16px', color:'#64748b', margin:'0 auto', maxWidth:460, lineHeight:1.6 }}>Create a free account and start summarizing immediately — no credit card required.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'20px', marginBottom:'40px' }}>
            {FREE_FEATURES.map((f,i) => (
              <div key={i}
                style={{ background:'#ffffff', border:'1.5px solid #e2e8f0', borderRadius:'14px', padding:'24px 22px', display:'flex', flexDirection:'column', gap:'10px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'box-shadow 0.2s,transform 0.2s' }}
                onMouseEnter={(e)=>{ e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform='translateY(0)'; }}
              >
                <span style={{ fontSize:'26px', lineHeight:1 }}>{f.icon}</span>
                <h3 style={{ fontSize:'15px', fontWeight:700, color:'#0f172a', margin:0 }}>{f.title}</h3>
                <p style={{ fontSize:'13.5px', color:'#64748b', margin:0, lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center' }}>
            <button onClick={openSignUp}
              style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'14px 32px', backgroundColor:'#0f172a', color:'white', border:'none', borderRadius:'10px', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'background 0.2s,transform 0.1s' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor='#1e293b'; e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='#0f172a'; e.currentTarget.style.transform='translateY(0)'; }}
            >Create free account →</button>
            <p style={{ marginTop:'12px', fontSize:'13px', color:'#94a3b8' }}>No credit card needed · Free forever</p>
          </div>
        </div>
      </section>

      {/* ── PREMIUM FEATURES ── */}
      <section style={{ padding:'80px 20px', backgroundColor:'#0f172a' }}>
        <div style={{ maxWidth:'860px', margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:'56px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', borderRadius:100, background:'rgba(250,204,21,0.12)', border:'1px solid rgba(250,204,21,0.3)', fontSize:11.5, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'#fbbf24', padding:'5px 14px', marginBottom:'16px' }}>
              ⚡ Premium plan
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(24px,5vw,36px)', fontWeight:900, color:'#f1f5f9', margin:'0 0 12px', letterSpacing:'-0.02em' }}>Unlock your full potential</h2>
            <p style={{ fontSize:'16px', color:'#94a3b8', margin:'0 auto', maxWidth:460, lineHeight:1.6 }}>For serious students who want zero limits and the full power of AI summarization.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'20px', marginBottom:'40px' }}>
            {PREMIUM_FEATURES.map((f,i) => (
              <div key={i}
                style={{ background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'24px 22px', display:'flex', flexDirection:'column', gap:'10px', transition:'background 0.2s,transform 0.2s' }}
                onMouseEnter={(e)=>{ e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}
              >
                <span style={{ fontSize:'26px', lineHeight:1 }}>{f.icon}</span>
                <h3 style={{ fontSize:'15px', fontWeight:700, color:'#f1f5f9', margin:0 }}>{f.title}</h3>
                <p style={{ fontSize:'13.5px', color:'#94a3b8', margin:0, lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center' }}>
            <button onClick={() => navigate('/pricing')}
              style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'14px 32px', backgroundColor:'#fbbf24', color:'#0f172a', border:'none', borderRadius:'10px', fontSize:'15px', fontWeight:800, cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'background 0.2s,transform 0.1s' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor='#f59e0b'; e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='#fbbf24'; e.currentTarget.style.transform='translateY(0)'; }}
            >See Premium pricing →</button>
            <p style={{ marginTop:'12px', fontSize:'13px', color:'#64748b' }}>30-day access · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ backgroundColor:'#f1f5f9', padding:'16px 16px 24px', fontFamily:"'Outfit','Segoe UI',sans-serif" }}>
        <div style={{ maxWidth:'860px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'32px', marginBottom:'40px' }}>

            {/* Brand */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxWidth:'260px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                <img src="/es.png" alt="logo" style={{ width:"auto", height:64, borderRadius:6, objectFit:'contain' }} />
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'18px', fontWeight:900, color:'#0a0e1a', letterSpacing:'-0.2px' }}>Essential Summary</span>
              </div>
              <p style={{ fontSize:'13.5px', color:'#0a0e1a', lineHeight:1.6, margin:0 }}>Helping students study smarter with AI-powered PDF summaries.</p>
            </div>

            {/* Nav columns */}
            <div style={{ display:'flex', gap:'48px', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <span style={{ fontSize:'11.5px', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Product</span>
                {[['/', 'Home'], ['/pricing', 'Pricing'], ['/dashboard', 'Dashboard'], ['/summaries', 'Summaries'], ['/contact', 'Contact']].map(([to, label]) => (
                  <button key={to} onClick={() => navigate(to)}
                    style={{ background:'none', border:'none', color:'#475569', fontSize:'14px', cursor:'pointer', padding:0, textAlign:'left', fontFamily:"'Outfit',sans-serif", transition:'color 0.15s' }}
                    onMouseEnter={(e)=>e.target.style.color='#f1f5f9'}
                    onMouseLeave={(e)=>e.target.style.color='#475569'}
                  >{label}</button>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <span style={{ fontSize:'11.5px', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Account</span>
                {[['/signup','Sign up'],['/signin','Sign in'],['/account','Profile'],['/pricing','Upgrade']].map(([to, label]) => (
                  <button key={to} onClick={() => navigate(to)}
                    style={{ background:'none', border:'none', color:'#475569', fontSize:'14px', cursor:'pointer', padding:0, textAlign:'left', fontFamily:"'Outfit',sans-serif", transition:'color 0.15s' }}
                    onMouseEnter={(e)=>e.target.style.color='#f1f5f9'}
                    onMouseLeave={(e)=>e.target.style.color='#475569'}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height:'1px', background:'rgba(255,255,255,0.07)', marginBottom:'24px' }} />

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
            <p style={{ margin:0, fontSize:'13px', color:'#334155' }}>© {new Date().getFullYear()} Essential Summary. All rights reserved.</p>
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <span style={{ fontSize:'12px', color:'#334155' }}>Built for students, by DmC.</span>
              <span style={{ fontSize:'14px' }}>📚</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`@media (max-width:768px){body{-webkit-text-size-adjust:100%;touch-action:manipulation;}}`}</style>
    </div>
  );
}

// ─── HomePage ──────────────────────────────────────────────────────────────
function HomePage() {
  const [pdfUrl, setPdfUrl]             = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pdfDocument, setPdfDocument]   = useState(null);
  const [showSummary, setShowSummary]   = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summaryType, setSummaryType]   = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [apiKey, setApiKey]             = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedModel, setSelectedModel]     = useState(OPENROUTER_MODELS.LLAMA_3_1_8B);

  const { currentUser } = useAuth();

  const { isOpen: isAuthModalOpen, modalMode, openModal: openAuthModal, closeModal: closeAuthModal } = useAuthModal();
  const { isOpen: isUpgradeModalOpen, openUpgradeModal, closeUpgradeModal } = useUpgradeModal();

  const [anonWarningMessage, setAnonWarningMessage] = useState(null);
  const [userUsageProfile, setUserUsageProfile]     = useState(null);
  const [isBannerVisible, setIsBannerVisible]       = useState(true);

  const navigate     = useNavigate();
  const pdfReaderRef = useRef(null);

  useEffect(() => {
    const savedKey = getOpenRouterApiKey();
    if (savedKey) setApiKey(savedKey);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setAnonWarningMessage(getSoftWarningMessage());
      setUserUsageProfile(null);
      setIsBannerVisible(true);
    } else {
      setAnonWarningMessage(null);
      setIsBannerVisible(true);
      checkAndResetIfNeeded(currentUser.uid)
        .then((profile) => setUserUsageProfile(profile))
        .catch((err) => console.error("Failed to load usage profile:", err));
    }
  }, [currentUser]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfUrl(URL.createObjectURL(file));
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
    if (!apiKey || apiKey.trim().length === 0) { alert('Please enter a valid API key'); return; }
    setIsLoading(true);
    const isValid = await validateOpenRouterKey(apiKey);
    setIsLoading(false);
    if (!isValid) { alert('Invalid API key. Please check and try again.'); return; }
    saveOpenRouterApiKey(apiKey);
    setShowApiKeyModal(false);
    alert('API key saved successfully!');
  };

  const checkUsageGate = useCallback(async () => {
    if (!currentUser) {
      if (hasReachedAnonymousQuickSummaryLimit()) {
        openAuthModal('signup');
        return { allowed: false, reason: 'anon_limit' };
      }
      incrementAnonymousQuickSummaryCount();
      setAnonWarningMessage(null);
      setAnonWarningMessage(getSoftWarningMessage());
      return { allowed: true, reason: 'anon_ok' };
    }

    let freshProfile;
    try {
      freshProfile = await checkAndResetIfNeeded(currentUser.uid);
    } catch (err) {
      console.error('usageGate: failed to load usage profile', err);
      return { allowed: true, reason: 'firestore_error' };
    }

    setUserUsageProfile(freshProfile);

    if (isPremiumActive(freshProfile)) {
      return { allowed: true, reason: 'premium', profile: freshProfile };
    }

    const { allowed, reason } = canUserUseQuickSummary(freshProfile);
    if (!allowed) {
      setIsBannerVisible(false);
      openUpgradeModal();
      return { allowed: false, reason };
    }

    return { allowed: true, reason, profile: freshProfile };
  }, [currentUser, openAuthModal, openUpgradeModal]);

  const handleSummarizePage = async () => {
    const gate = await checkUsageGate();
    if (!gate.allowed) return;

    if (!pdfDocument) { alert('Please wait for the PDF to load'); return; }
    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType('page');
    setSummaryContent('Extracting text from current page...');

    let summarySucceeded = false;

    try {
      const pageText = await extractTextFromPage(pdfDocument, currentPage);

      if (!pageText || pageText.trim().length === 0) {
        setSummaryContent('No text found on this page. It may be an image or scanned document.');
        setIsLoading(false);
        return;
      }

      setSummaryContent(`Extracted ${pageText.split(/\s+/).length} words.\n\nGenerating AI summary...`);

      const summary = await summarizeWithOpenRouter(pageText, 'page', apiKey, { model: selectedModel });

      if (!summary || summary.trim().length === 0) {
        setSummaryContent('Failed to generate summary. Please try again.');
      } else {
        setSummaryContent(
          `📄 **Page ${currentPage} Summary**\n\n${summary}\n\n---\n` +
          `**Word Count:** ${pageText.split(/\s+/).length} words`
        );
        summarySucceeded = true;

        if (currentUser) {
          saveSummary(currentUser.uid, {
            fileName:    selectedFile ?? 'Untitled PDF',
            summaryType: 'quick',
            content:     summary,
            pageNumber:  currentPage,
            wordCount:   pageText.split(/\s+/).length,
          }).catch((err) => console.error('Failed to save summary:', err));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setSummaryContent(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);

      if (summarySucceeded && currentUser && gate.reason !== 'anon_ok') {
        try {
          await incrementQuickSummaryUsage(currentUser.uid);
          const updated = await checkAndResetIfNeeded(currentUser.uid);
          setUserUsageProfile(updated);
          setIsBannerVisible(true);
        } catch (err) {
          console.error('Failed to increment usage:', err);
        }
      }
    }
  };

  const handleSummarizeChapter = async () => {
    if (!currentUser) { openAuthModal('signup'); return; }

    let freshProfile;
    try {
      freshProfile = await checkAndResetIfNeeded(currentUser.uid);
      setUserUsageProfile(freshProfile);
    } catch (err) {
      console.error('handleSummarizeChapter: failed to load profile', err);
      freshProfile = userUsageProfile;
    }

    if (!isPremiumActive(freshProfile)) { openUpgradeModal(); return; }

    if (!pdfDocument) { alert('Please wait for the PDF to load'); return; }
    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType('chapter');
    setSummaryContent('Detecting chapter boundaries and extracting text...');

    try {
      const chapterData = await extractCurrentChapter(pdfDocument, currentPage);

      if (!chapterData.text || chapterData.text.trim().length === 0) {
        setSummaryContent('No text found in this chapter. The pages may contain only images.');
        setIsLoading(false);
        return;
      }

      const wordCount = chapterData.text.split(/\s+/).length;
      setSummaryContent(`Analyzing chapter (Pages ${chapterData.startPage}–${chapterData.endPage}, ${wordCount} words)...\n\nGenerating AI summary...`);

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
          `📚 **Multi-Page Summary**\n\n**Pages:** ${chapterData.startPage}–${chapterData.endPage}\n\n${summary}\n\n---\n**Word Count:** ${wordCount} words`
        );
        if (currentUser) {
          saveSummary(currentUser.uid, {
            fileName:     selectedFile ?? 'Untitled PDF',
            summaryType:  'chapter',
            content:      summary,
            chapterRange: `Pages ${chapterData.startPage}–${chapterData.endPage}`,
            wordCount:    wordCount,
          }).catch((err) => console.error('Failed to save chapter summary:', err));
        }
      }
    } catch (error) {
      console.error('Chapter summary error:', error);
      setSummaryContent(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeSummary = () => {
    setShowSummary(false);
    setSummaryContent('');
    if (currentUser && userUsageProfile) setIsBannerVisible(true);
  };

  const handleUpgradeClick = () => {
    closeUpgradeModal();
    navigate('/pricing');
  };

  // ── No PDF loaded → full landing page ──
  if (!pdfUrl) {
    return (
      <>
        <LandingPage
          onUpload={handleFileUpload}
          onSample={loadSamplePDF}
          navigate={navigate}
          openSignUp={() => openAuthModal('signup')}
        />
        <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={closeAuthModal} initialMode={modalMode} />
        <UpgradeModal isOpen={isUpgradeModalOpen} onClose={closeUpgradeModal} onUpgrade={handleUpgradeClick} userProfile={userUsageProfile} />
      </>
    );
  }

  // ── PDF loaded → reader view ──
  return (
    <div style={{ width:'100vw', height:'100vh', margin:0, padding:0, position:'relative' }}>
      <div style={{ position:'relative', width:'100%', height:'100%' }}>
        <PDFReader
          ref={pdfReaderRef}
          pdfUrl={pdfUrl}
          fileName={selectedFile || 'document.pdf'}
          onPageChange={(page) => setCurrentPage(page)}
          onPdfLoad={(pdf) => setPdfDocument(pdf)}
        />

        {!currentUser && anonWarningMessage && (
          <div style={{ position:'fixed', bottom:'100px', left:'50%', transform:'translateX(-50%)', zIndex:10002, width:'calc(100% - 48px)', maxWidth:'480px' }}>
            <SoftWarningBanner message={anonWarningMessage} onSignUp={() => openAuthModal('signup')} onClose={() => setAnonWarningMessage(null)} />
          </div>
        )}

        {currentUser && userUsageProfile && isBannerVisible && (
          <div style={{ position:'fixed', bottom:'100px', left:'50%', transform:'translateX(-50%)', zIndex:9998, width:'calc(100% - 48px)', maxWidth:'480px' }}>
            <FreeTierBanner userProfile={userUsageProfile} onUpgrade={() => { setIsBannerVisible(false); openUpgradeModal(); }} onClose={() => setIsBannerVisible(false)} />
          </div>
        )}

        <FloatingActionButton onSummarizePage={handleSummarizePage} onSummarizeChapter={handleSummarizeChapter} />

        {showSummary && (
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10001, padding:'20px', backdropFilter:'blur(4px)' }}>
            <div style={{ backgroundColor:'white', borderRadius:'16px', padding:'32px', maxWidth:'600px', width:'100%', maxHeight:'80vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', position:'relative' }}>
              <button onClick={closeSummary} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', cursor:'pointer', padding:'8px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              ><span style={{ fontSize:'24px', color:'#666' }}>×</span></button>
              <h2 style={{ fontSize:'24px', fontWeight:'600', marginBottom:'8px', color:'#333' }}>
                {summaryType === 'page' ? '📄 Page Summary' : '📚 Multi-Page Summary'}
              </h2>
              <p style={{ fontSize:'14px', color:'#666', marginBottom:'24px' }}>
                {summaryType === 'page' ? `Summary of page ${currentPage}` : 'Summary of multiple pagee'}
              </p>
              {isLoading && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
                  <div style={{ width:'40px', height:'40px', border:'4px solid #f3f3f3', borderTop:'4px solid #6366f1', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
                </div>
              )}
              {!isLoading && <div style={{ fontSize:'15px', lineHeight:'1.8', color:'#333' }}><MarkdownContent content={summaryContent} /></div>}
              {!isLoading && (
                <div style={{ marginTop:'24px', display:'flex', gap:'12px', justifyContent:'flex-end' }}>
                  <button onClick={() => { navigator.clipboard.writeText(summaryContent); alert('Copied!'); }}
                    style={{ padding:'10px 20px', backgroundColor:'#f0f0f0', color:'#333', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'500' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e5e5'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                  >Copy to Clipboard</button>
                  <button onClick={closeSummary}
                    style={{ padding:'10px 20px', backgroundColor:'#6366f1', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'500' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#5558e3'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#6366f1'}
                  >Close</button>
                </div>
              )}
            </div>
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {showApiKeyModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10002, padding:'20px' }}>
          <div style={{ backgroundColor:'white', borderRadius:'16px', padding:'32px', maxWidth:'500px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize:'24px', fontWeight:'600', marginBottom:'16px', color:'#333' }}>Configure OpenRouter API Key</h2>
            <p style={{ fontSize:'14px', color:'#666', marginBottom:'20px', lineHeight:'1.5' }}>
              Get a <strong>free</strong> OpenRouter API key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color:'#6366f1', textDecoration:'none' }}>openrouter.ai/keys</a>
              <br/><br/>No credit card required!
            </p>
            <label style={{ display:'block', fontSize:'14px', fontWeight:'500', color:'#333', marginBottom:'8px' }}>API Key:</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-..."
              style={{ width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'14px', fontFamily:'monospace', marginBottom:'20px' }}
            />
            <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowApiKeyModal(false)} disabled={isLoading}
                style={{ padding:'10px 20px', backgroundColor:'#f0f0f0', color:'#333', border:'none', borderRadius:'8px', cursor:isLoading?'not-allowed':'pointer', fontSize:'14px', fontWeight:'500', opacity:isLoading?0.5:1 }}
              >Cancel</button>
              <button onClick={handleSaveApiKey} disabled={isLoading}
                style={{ padding:'10px 20px', backgroundColor:'#6366f1', color:'white', border:'none', borderRadius:'8px', cursor:isLoading?'not-allowed':'pointer', fontSize:'14px', fontWeight:'500', opacity:isLoading?0.5:1 }}
              >{isLoading ? 'Validating...' : 'Save API Key'}</button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onSuccess={closeAuthModal} initialMode={modalMode} />
      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={closeUpgradeModal} onUpgrade={handleUpgradeClick} userProfile={userUsageProfile} />
    </div>
  );
}

export default HomePage;
