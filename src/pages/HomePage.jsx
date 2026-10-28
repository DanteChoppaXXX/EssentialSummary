
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import PDFReader from "../components/PDFReader";
import FloatingActionButton from "../components/FloatingActionButton";
import AuthModal from "../components/AuthModal/AuthModal";
import UpgradeModal from "../components/UpgradeModal/UpgradeModal";
import SoftWarningBanner from "../components/SoftWarningBanner";
import FreeTierBanner from "../components/FreeTierBanner";

import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../hooks/useAuthModal";
import { useUpgradeModal } from "../hooks/useUpgradeModal";

import {
  hasReachedAnonymousQuickSummaryLimit,
  incrementAnonymousQuickSummaryCount,
  getSoftWarningMessage,
} from "../utils/anonymousUsage";

import {
  checkAndResetIfNeeded,
  canUserUseQuickSummary,
  incrementQuickSummaryUsage,
} from "../services/usageService";

import {
  extractTextFromPage,
  extractCurrentChapter,
} from "../components/pdfUtils";

import {
  summarizeWithOpenRouter,
  summarizeLongText,
  getOpenRouterApiKey,
  saveOpenRouterApiKey,
  validateOpenRouterKey,
  OPENROUTER_MODELS,
} from "../components/openRouterAPI";

import { useNavigate } from "react-router-dom";
import { isPremiumActive } from "../services/premiumService";
import { saveSummary } from "../services/summaryService";

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────

const theme = {
  background: "#f6f8fc",
  surface: "#ffffff",
  surfaceSoft: "#f8faff",
  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  blue: "#4f46e5",
  blueDark: "#4338ca",
  violet: "#7c3aed",
  green: "#16a34a",
  greenSoft: "#f0fdf4",
  greenBorder: "#bbf7d0",
  dark: "#111827",
};

const pageFont = "'Outfit', 'Segoe UI', sans-serif";
const headingFont = "'Playfair Display', Georgia, serif";

const buttonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "13px 22px",
  borderRadius: "12px",
  fontFamily: pageFont,
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  transition:
    "background 180ms ease, transform 180ms ease, box-shadow 180ms ease",
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER
// ─────────────────────────────────────────────────────────────────────────────

const MarkdownContent = ({ content }) => {
  const parseInlineMarkdown = (text) => {
    const parts = [];
    const pattern =
      /(\*\*(.+?)\*\*|__(.+?)__|(?<!\*)\*([^*]+?)\*(?!\*)|(?<!_)_([^_]+?)_(?!_)|`([^`]+?)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[2] || match[3]) {
        parts.push(
          <strong
            key={key++}
            style={{ fontWeight: 700, color: theme.text }}
          >
            {match[2] || match[3]}
          </strong>
        );
      } else if (match[4] || match[5]) {
        parts.push(
          <em key={key++} style={{ fontStyle: "italic" }}>
            {match[4] || match[5]}
          </em>
        );
      } else if (match[6]) {
        parts.push(
          <code
            key={key++}
            style={{
              background: "#eef2ff",
              color: "#4338ca",
              padding: "2px 6px",
              borderRadius: "5px",
              border: "1px solid #e0e7ff",
              fontSize: "0.9em",
              fontFamily: "monospace",
              overflowWrap: "anywhere",
            }}
          >
            {match[6]}
          </code>
        );
      } else if (match[7] && match[8]) {
        parts.push(
          <a
            key={key++}
            href={match[8]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.blue,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {match[7]}
          </a>
        );
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderMarkdown = (text) => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements = [];

    let listItems = [];
    let listType = null;
    let inCodeBlock = false;
    let codeBlockContent = [];

    const flushList = (key) => {
      if (listItems.length === 0) return;

      const ListTag = listType === "ordered" ? "ol" : "ul";

      elements.push(
        <ListTag
          key={`list-${key}`}
          style={{
            paddingLeft: "26px",
            margin: "8px 0 20px",
            lineHeight: 1.85,
            color: "#334155",
          }}
        >
          {listItems.map((item, index) => (
            <li key={index} style={{ paddingLeft: "4px", marginBottom: "6px" }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>
      );

      listItems = [];
      listType = null;
    };

    const flushCodeBlock = (key) => {
      elements.push(
        <pre
          key={`code-${key}`}
          style={{
            background: "#111827",
            color: "#e2e8f0",
            padding: "18px",
            borderRadius: "12px",
            overflowX: "auto",
            fontSize: "13px",
            lineHeight: 1.7,
            fontFamily: "monospace",
            border: "1px solid #273449",
            margin: "16px 0 22px",
            whiteSpace: "pre",
          }}
        >
          <code>{codeBlockContent.join("\n")}</code>
        </pre>
      );

      codeBlockContent = [];
    };

    lines.forEach((line, index) => {
      if (line.trim().startsWith("```")) {
        flushList(index);

        if (inCodeBlock) {
          flushCodeBlock(index);
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

      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

      if (headingMatch) {
        flushList(index);

        const level = headingMatch[1].length;
        const headingSizes = {
          1: "25px",
          2: "22px",
          3: "19px",
          4: "17px",
          5: "15px",
          6: "14px",
        };

        elements.push(
          <h2
            key={`heading-${index}`}
            style={{
              fontSize: headingSizes[level],
              fontWeight: 800,
              lineHeight: 1.35,
              color: theme.text,
              margin: level <= 2 ? "26px 0 14px" : "20px 0 10px",
              paddingBottom: level <= 2 ? "10px" : 0,
              borderBottom: level <= 2 ? `1px solid ${theme.border}` : "none",
            }}
          >
            {parseInlineMarkdown(headingMatch[2])}
          </h2>
        );

        return;
      }

      const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)/);
      const orderedMatch = line.match(/^\s*\d+\.\s+(.+)/);

      if (unorderedMatch || orderedMatch) {
        const nextListType = orderedMatch ? "ordered" : "unordered";

        if (listType && listType !== nextListType) {
          flushList(index);
        }

        listType = nextListType;
        listItems.push((unorderedMatch || orderedMatch)[1]);
        return;
      }

      flushList(index);

      if (/^\s*[-_*]{3,}\s*$/.test(line)) {
        elements.push(
          <hr
            key={`hr-${index}`}
            style={{
              border: "none",
              borderTop: `1px solid ${theme.border}`,
              margin: "24px 0",
            }}
          />
        );
        return;
      }

      const quoteMatch = line.match(/^\s*>\s?(.*)/);

      if (quoteMatch) {
        elements.push(
          <blockquote
            key={`quote-${index}`}
            style={{
              margin: "16px 0",
              padding: "12px 18px",
              borderLeft: "3px solid #818cf8",
              borderRadius: "0 10px 10px 0",
              background: "#f5f3ff",
              color: "#475569",
            }}
          >
            {parseInlineMarkdown(quoteMatch[1])}
          </blockquote>
        );
        return;
      }

      if (line.trim()) {
        elements.push(
          <p
            key={`paragraph-${index}`}
            style={{
              margin: "0 0 14px",
              color: "#334155",
              lineHeight: 1.85,
              overflowWrap: "anywhere",
            }}
          >
            {parseInlineMarkdown(line)}
          </p>
        );
      }
    });

    flushList("end");

    if (inCodeBlock) {
      flushCodeBlock("end");
    }

    return elements;
  };

  return (
    <div
      style={{
        width: "100%",
        overflowWrap: "anywhere",
        wordBreak: "normal",
      }}
    >
      {renderMarkdown(content)}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  {
    icon: "⚡",
    title: "Quick Page Summary",
    desc: "Get the key ideas from any PDF page in seconds using AI — up to 10 times per month.",
  },
  {
    icon: "💾",
    title: "Saved Summaries",
    desc: "Every summary you generate is automatically saved to your personal library.",
  },
  {
    icon: "📋",
    title: "Copy & Export",
    desc: "Copy any summary to your clipboard instantly to paste into your notes.",
  },
  {
    icon: "📊",
    title: "Usage Dashboard",
    desc: "Track your monthly usage and view all your past summaries in one clean place.",
  },
];

const PREMIUM_FEATURES = [
  {
    icon: "📚",
    title: "Multi-Page Summary",
    desc: "Summarize multiple pages at once — perfect for textbooks and long reports.",
  },
  {
    icon: "♾️",
    title: "Unlimited Summaries",
    desc: "No monthly cap. Summarize as many pages as you need, any time.",
  },
  {
    icon: "🚀",
    title: "Priority AI Processing",
    desc: "Your requests are processed first — no waiting during peak hours.",
  },
  {
    icon: "✨",
    title: "All Future Features",
    desc: "Every new feature we ship is included in your Premium plan automatically.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Upload your PDF",
    desc: "Choose a PDF — textbooks, lecture notes, research papers, and more.",
  },
  {
    step: "02",
    title: "Navigate to a page",
    desc: "Use the built-in reader to find the page or chapter you want to understand.",
  },
  {
    step: "03",
    title: "Choose a summary",
    desc: "Open the floating action button and choose Quick Summary or Multi-Page Summary.",
  },
  {
    step: "04",
    title: "Read and retain",
    desc: "Get a clear summary and save it to your personal library.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE LANDING PAGE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ eyebrow, title, description, green = false }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "44px" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 13px",
          marginBottom: "16px",
          borderRadius: "100px",
          background: green ? "#f0fdf4" : "#eef2ff",
          border: `1px solid ${green ? "#bbf7d0" : "#c7d2fe"}`,
          color: green ? "#15803d" : "#4338ca",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {green && (
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#22c55e",
            }}
          />
        )}
        {eyebrow}
      </div>

      <h2
        style={{
          fontFamily: headingFont,
          fontSize: "clamp(25px, 4vw, 37px)",
          fontWeight: 900,
          letterSpacing: "-0.035em",
          lineHeight: 1.2,
          color: theme.text,
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          fontSize: "15px",
          color: theme.textSecondary,
          lineHeight: 1.8,
          maxWidth: "500px",
          margin: "0 auto",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function LandingPage({ onUpload, navigate, openSignUp }) {
  const fileInputRef = useRef(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const sectionStyle = {
    width: "100%",
    padding: "76px 20px",
    boxSizing: "border-box",
  };

  const containerStyle = {
    maxWidth: "1000px",
    margin: "0 auto",
    width: "100%",
  };

  const footerLinkStyle = {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: "13px",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    fontFamily: pageFont,
    transition: "color 180ms ease",
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        overflowX: "clip",
        background: theme.background,
        color: theme.text,
        fontFamily: pageFont,
      }}
    >
      {/* HERO */}
      <section
        style={{
          ...sectionStyle,
          minHeight: "min(850px, 100svh)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "66px",
          paddingBottom: "72px",
          position: "relative",
          isolation: "isolate",
          background:
            "radial-gradient(ellipse at 12% 15%, rgba(99,102,241,0.10), transparent 38%), radial-gradient(ellipse at 88% 55%, rgba(56,189,248,0.10), transparent 34%), #f6f8fc",
        }}
      >
        <div
          style={{
            ...containerStyle,
            maxWidth: "780px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "30px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "100px",
              background: "rgba(255,255,255,0.88)",
              border: "1px solid #dbe4ff",
              boxShadow: "0 4px 18px rgba(79,70,229,0.06)",
              color: "#4338ca",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 0 4px rgba(34,197,94,0.12)",
              }}
            />
            AI-powered study companion
          </div>

          <div style={{ textAlign: "center", width: "100%" }}>
            <h1
              style={{
                fontFamily: headingFont,
                fontSize: "clamp(34px, 7vw, 66px)",
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: "-0.045em",
                color: theme.text,
                margin: "0 auto",
                maxWidth: "780px",
              }}
            >
              Essential Summary:
              <br />
              Your smarter way to{" "}
              <span
                style={{
                  background:
                    "linear-gradient(110deg, #4f46e5 10%, #7c3aed 55%, #0891b2 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  display: "inline-block",
                  paddingBottom: "5px",
                }}
              >
                study.
              </span>
            </h1>

            <p
              style={{
                maxWidth: "570px",
                margin: "22px auto 0",
                fontSize: "clamp(15px, 2.3vw, 18px)",
                lineHeight: 1.85,
                color: theme.textSecondary,
              }}
            >
              Transform dense PDFs into{" "}
              <strong style={{ color: "#334155", fontWeight: 700 }}>
                clear, concise summaries
              </strong>{" "}
              so you can focus on understanding what matters.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {[
              ["✦", "AI-powered summaries"],
              ["✓", "Personal summary library"],
              ["⚡", "Quick page insights"],
            ].map(([icon, label]) => (
              <div
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 12px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "100px",
                  background: "rgba(255,255,255,0.76)",
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: theme.blue }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>

          {/* PDF UPLOAD CARD */}
          <div
            style={{
              width: "100%",
              maxWidth: "590px",
              boxSizing: "border-box",
              padding: "clamp(22px, 5vw, 36px)",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(226,232,240,0.95)",
              boxShadow:
                "0 24px 70px rgba(30,41,59,0.08), 0 3px 10px rgba(30,41,59,0.03)",
            }}
          >
            <div
              style={{
                width: "58px",
                height: "58px",
                margin: "0 auto 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "17px",
                background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                border: "1px solid #e0e7ff",
                fontSize: "27px",
              }}
            >
              📄
            </div>

            <h2
              style={{
                fontSize: "19px",
                fontWeight: 800,
                textAlign: "center",
                margin: "0 0 7px",
                color: theme.text,
              }}
            >
              Start with your PDF
            </h2>

            <p
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                fontSize: "13px",
                lineHeight: 1.7,
                margin: "0 0 24px",
              }}
            >
              Upload your document and turn lengthy reading into focused
              learning.
            </p>

            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onUpload}
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            />

            <button
              type="button"
              onClick={openFilePicker}
              style={{
                ...buttonBase,
                width: "100%",
                padding: "16px 20px",
                border: "1px solid #4f46e5",
                background: "linear-gradient(110deg, #4f46e5, #6d5ce8)",
                color: "#ffffff",
                boxShadow: "0 8px 20px rgba(79,70,229,0.22)",
                fontSize: "15px",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background =
                  "linear-gradient(110deg, #4338ca, #5b4bd8)";
                event.currentTarget.style.transform = "translateY(-1px)";
                event.currentTarget.style.boxShadow =
                  "0 12px 24px rgba(79,70,229,0.28)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background =
                  "linear-gradient(110deg, #4f46e5, #6d5ce8)";
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow =
                  "0 8px 20px rgba(79,70,229,0.22)";
              }}
            >
              <span style={{ fontSize: "18px" }}>↑</span>
              Upload PDF File
            </button>

            <p
              style={{
                margin: "13px 0 0",
                textAlign: "center",
                color: theme.textMuted,
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              PDF documents only · Select a file from your device
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "22px 0",
                color: "#94a3b8",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              <span style={{ flex: 1, height: "1px", background: theme.border }} />
              or
              <span style={{ flex: 1, height: "1px", background: theme.border }} />
            </div>

            <button
              type="button"
              onClick={() => navigate("/image-summary")}
              style={{
                ...buttonBase,
                width: "100%",
                padding: "15px 20px",
                background: "#ffffff",
                color: "#334155",
                border: `1px solid ${theme.border}`,
                fontSize: "14px",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#f8faff";
                event.currentTarget.style.borderColor = "#c7d2fe";
                event.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#ffffff";
                event.currentTarget.style.borderColor = theme.border;
                event.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span style={{ fontSize: "18px" }}>▧</span>
              Upload Photo of a Page
            </button>
          </div>

          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: "12px",
              textAlign: "center",
              lineHeight: 1.7,
              maxWidth: "440px",
            }}
          >
            Your study workflow, simplified — from your first upload to your
            personal summary library.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        style={{
          ...sectionStyle,
          background: "#ffffff",
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={containerStyle}>
          <SectionHeading
            eyebrow="Simple process"
            title="From PDF to insight"
            description="Four simple steps help you move from lengthy documents to clearer understanding."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
              gap: "18px",
            }}
          >
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                style={{
                  position: "relative",
                  padding: "25px 22px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "18px",
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #f8faff 100%)",
                  boxShadow: "0 4px 14px rgba(15,23,42,0.025)",
                  transition:
                    "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "translateY(-4px)";
                  event.currentTarget.style.boxShadow =
                    "0 14px 28px rgba(79,70,229,0.08)";
                  event.currentTarget.style.borderColor = "#c7d2fe";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                  event.currentTarget.style.boxShadow =
                    "0 4px 14px rgba(15,23,42,0.025)";
                  event.currentTarget.style.borderColor = theme.border;
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "45px",
                    height: "45px",
                    borderRadius: "13px",
                    background: "#eef2ff",
                    color: "#4f46e5",
                    fontFamily: headingFont,
                    fontSize: "18px",
                    fontWeight: 900,
                    marginBottom: "19px",
                  }}
                >
                  {item.step}
                </span>

                <h3
                  style={{
                    margin: "0 0 9px",
                    color: theme.text,
                    fontSize: "15px",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: theme.textSecondary,
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE PLAN */}
      <section style={{ ...sectionStyle, background: theme.background }}>
        <div style={containerStyle}>
          <SectionHeading
            eyebrow="Free plan"
            title="Everything you need to get started"
            description="Create a free account and start building a more effective study routine — no credit card required."
            green
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 215px), 1fr))",
              gap: "18px",
              marginBottom: "34px",
            }}
          >
            {FREE_FEATURES.map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: "24px 22px",
                  background: "#ffffff",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "18px",
                  boxShadow: "0 4px 16px rgba(15,23,42,0.025)",
                  transition:
                    "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "translateY(-3px)";
                  event.currentTarget.style.boxShadow =
                    "0 14px 30px rgba(15,23,42,0.07)";
                  event.currentTarget.style.borderColor = "#c7d2fe";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                  event.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(15,23,42,0.025)";
                  event.currentTarget.style.borderColor = theme.border;
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "14px",
                    background: "#f1f5ff",
                    fontSize: "24px",
                    marginBottom: "18px",
                  }}
                >
                  {feature.icon}
                </div>

                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: theme.text,
                    margin: "0 0 9px",
                  }}
                >
                  {feature.title}
                </h3>

                <p
                  style={{
                    fontSize: "13px",
                    color: theme.textSecondary,
                    margin: 0,
                    lineHeight: 1.8,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={openSignUp}
              style={{
                ...buttonBase,
                padding: "15px 26px",
                color: "#ffffff",
                background: theme.dark,
                border: `1px solid ${theme.dark}`,
                boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#263247";
                event.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = theme.dark;
                event.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Create free account <span aria-hidden="true">→</span>
            </button>

            <p
              style={{
                margin: "13px 0 0",
                fontSize: "12px",
                color: theme.textMuted,
              }}
            >
              No credit card needed · Free to get started
            </p>
          </div>
        </div>
      </section>

      {/* PREMIUM PLAN */}
      <section
        style={{
          ...sectionStyle,
          background:
            "radial-gradient(ellipse at 15% 0%, rgba(99,102,241,0.13), transparent 42%), radial-gradient(ellipse at 95% 95%, rgba(14,165,233,0.09), transparent 40%), #111827",
        }}
      >
        <div style={containerStyle}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "100px",
                background: "rgba(250,204,21,0.09)",
                border: "1px solid rgba(250,204,21,0.23)",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.11em",
                textTransform: "uppercase",
                color: "#fbbf24",
                padding: "8px 14px",
                marginBottom: "17px",
              }}
            >
              ⚡ Premium plan
            </div>

            <h2
              style={{
                fontFamily: headingFont,
                fontSize: "clamp(26px, 4vw, 39px)",
                fontWeight: 900,
                color: "#f8fafc",
                margin: "0 0 13px",
                letterSpacing: "-0.035em",
                lineHeight: 1.2,
              }}
            >
              Make more of every study session
            </h2>

            <p
              style={{
                fontSize: "15px",
                color: "#a8b4c7",
                margin: "0 auto",
                maxWidth: "500px",
                lineHeight: 1.8,
              }}
            >
              Unlock multi-page summaries and a more flexible way to work
              through lengthy study material.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 215px), 1fr))",
              gap: "18px",
              marginBottom: "36px",
            }}
          >
            {PREMIUM_FEATURES.map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: "24px 22px",
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.11)",
                  borderRadius: "18px",
                  transition:
                    "transform 180ms ease, background 180ms ease, border-color 180ms ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "translateY(-3px)";
                  event.currentTarget.style.background =
                    "rgba(255,255,255,0.08)";
                  event.currentTarget.style.borderColor =
                    "rgba(165,180,252,0.4)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                  event.currentTarget.style.background =
                    "rgba(255,255,255,0.045)";
                  event.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.11)";
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "14px",
                    background: "rgba(165,180,252,0.11)",
                    border: "1px solid rgba(165,180,252,0.13)",
                    fontSize: "24px",
                    marginBottom: "18px",
                  }}
                >
                  {feature.icon}
                </div>

                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#f8fafc",
                    margin: "0 0 9px",
                  }}
                >
                  {feature.title}
                </h3>

                <p
                  style={{
                    fontSize: "13px",
                    color: "#a8b4c7",
                    margin: 0,
                    lineHeight: 1.8,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => navigate("/pricing")}
              style={{
                ...buttonBase,
                padding: "15px 26px",
                background: "#fbbf24",
                color: "#111827",
                border: "1px solid #fbbf24",
                boxShadow: "0 8px 24px rgba(251,191,36,0.12)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#fcd34d";
                event.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#fbbf24";
                event.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Explore Premium <span aria-hidden="true">→</span>
            </button>

            <p
              style={{
                margin: "13px 0 0",
                fontSize: "12px",
                color: "#9ca9bc",
              }}
            >
              Visit the pricing page for plan details
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "#ffffff",
          borderTop: `1px solid ${theme.border}`,
          padding: "48px 20px 22px",
          fontFamily: pageFont,
        }}
      >
        <div style={containerStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "40px",
              marginBottom: "36px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxWidth: "280px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <img
                  src="/es.png"
                  alt=""
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "contain",
                    borderRadius: "12px",
                  }}
                />

                <span
                  style={{
                    fontFamily: headingFont,
                    fontSize: "19px",
                    fontWeight: 900,
                    color: theme.text,
                    letterSpacing: "-0.4px",
                  }}
                >
                  Essential Summary
                </span>
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: theme.textSecondary,
                  lineHeight: 1.8,
                  margin: 0,
                }}
              >
                Helping students study smarter with AI-powered PDF summaries.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "clamp(30px, 6vw, 68px)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "3px",
                  }}
                >
                  Product
                </span>

                {[
                  ["/", "Home"],
                  ["/pricing", "Pricing"],
                  ["/dashboard", "Dashboard"],
                  ["/summaries", "Summaries"],
                  ["/contact", "Contact"],
                  ["/image-summary", "Image Summary"],
                ].map(([to, label]) => (
                  <button
                    type="button"
                    key={to}
                    onClick={() => navigate(to)}
                    style={footerLinkStyle}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = theme.blue;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = "#64748b";
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "3px",
                  }}
                >
                  Account
                </span>

                {[
                  ["/signup", "Sign up"],
                  ["/signin", "Sign in"],
                  ["/account", "Profile"],
                  ["/pricing", "Upgrade"],
                ].map(([to, label]) => (
                  <button
                    type="button"
                    key={`${to}-${label}`}
                    onClick={() => navigate(to)}
                    style={footerLinkStyle}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = theme.blue;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = "#64748b";
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              height: "1px",
              background: theme.border,
              marginBottom: "20px",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: theme.textSecondary,
                lineHeight: 1.7,
              }}
            >
              © {new Date().getFullYear()} Essential Summary. All rights reserved.
            </p>

            <div
              style={{
                display: "flex",
                gap: "7px",
                alignItems: "center",
                fontSize: "12px",
                color: theme.textSecondary,
              }}
            >
              <span>Built for students, by DmC.</span>
              <span aria-hidden="true">📚</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        * {
          box-sizing: border-box;
        }

        #file-upload:focus-visible + label {
          outline: 3px solid #a5b4fc;
          outline-offset: 4px;
        }

        button:focus-visible {
          outline: 3px solid #a5b4fc;
          outline-offset: 3px;
        }

        @media (max-width: 600px) {
          body {
            -webkit-text-size-adjust: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────────────────────────────────────

function HomePage() {
  const [pdfUrl, setPdfUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDocument, setPdfDocument] = useState(null);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryType, setSummaryType] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    OPENROUTER_MODELS.LLAMA_3_1_8B
  );

  const { currentUser } = useAuth();

  const {
    isOpen: isAuthModalOpen,
    modalMode,
    openModal: openAuthModal,
    closeModal: closeAuthModal,
  } = useAuthModal();

  const {
    isOpen: isUpgradeModalOpen,
    openUpgradeModal,
    closeUpgradeModal,
  } = useUpgradeModal();

  const [anonWarningMessage, setAnonWarningMessage] = useState(null);
  const [userUsageProfile, setUserUsageProfile] = useState(null);
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  const navigate = useNavigate();
  const pdfReaderRef = useRef(null);

  // Load the locally saved OpenRouter API key.
  useEffect(() => {
    const savedKey = getOpenRouterApiKey();

    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Revoke temporary PDF URLs when the document changes or this component
  // unmounts. Remote URLs are not revoked.
  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Load usage information for the current account.
  useEffect(() => {
    let cancelled = false;

    if (!currentUser) {
      setAnonWarningMessage(getSoftWarningMessage());
      setUserUsageProfile(null);
      setIsBannerVisible(true);
      return undefined;
    }

    setAnonWarningMessage(null);
    setIsBannerVisible(true);

    checkAndResetIfNeeded(currentUser.uid)
      .then((profile) => {
        if (!cancelled) {
          setUserUsageProfile(profile);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load usage profile:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Handle the user's PDF selection.
  const handleFileUpload = (event) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("Please select a valid PDF file.");
      input.value = "";
      return;
    }

    const newPdfUrl = URL.createObjectURL(file);

    setPdfUrl(newPdfUrl);
    setSelectedFile(file.name);
    setCurrentPage(1);
    setPdfDocument(null);
    setShowSummary(false);
    setSummaryContent("");
    setSummaryType("");

    // Allows the same file to be selected again later.
    input.value = "";
  };

  const checkApiKey = () => {
    if (!apiKey || apiKey.trim().length === 0) {
      setShowApiKeyModal(true);
      return false;
    }

    return true;
  };

  const handleSaveApiKey = async () => {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      alert("Please enter a valid API key.");
      return;
    }

    setIsLoading(true);

    try {
      const isValid = await validateOpenRouterKey(trimmedKey);

      if (!isValid) {
        alert("Invalid API key. Please check it and try again.");
        return;
      }

      saveOpenRouterApiKey(trimmedKey);
      setApiKey(trimmedKey);
      setShowApiKeyModal(false);
      alert("API key saved successfully!");
    } catch (error) {
      console.error("API key validation failed:", error);
      alert("Unable to validate the API key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check access without consuming a summary allowance.
  // Usage is recorded only after a summary has been generated successfully.
  const checkUsageGate = useCallback(async () => {
    if (!currentUser) {
      if (hasReachedAnonymousQuickSummaryLimit()) {
        openAuthModal("signup");
        return { allowed: false, reason: "anon_limit" };
      }

      setAnonWarningMessage(getSoftWarningMessage());

      return { allowed: true, reason: "anon_ok" };
    }

    let freshProfile;

    try {
      freshProfile = await checkAndResetIfNeeded(currentUser.uid);
    } catch (error) {
      console.error("Usage gate: failed to load usage profile", error);

      // Fail closed if the usage service cannot confirm the user's allowance.
      alert("We couldn't verify your summary allowance. Please try again.");
      return { allowed: false, reason: "usage_check_failed" };
    }

    setUserUsageProfile(freshProfile);

    if (isPremiumActive(freshProfile)) {
      return {
        allowed: true,
        reason: "premium",
        profile: freshProfile,
      };
    }

    const { allowed, reason } = canUserUseQuickSummary(freshProfile);

    if (!allowed) {
      setIsBannerVisible(false);
      openUpgradeModal();

      return { allowed: false, reason };
    }

    return {
      allowed: true,
      reason,
      profile: freshProfile,
    };
  }, [currentUser, openAuthModal, openUpgradeModal]);

  // Generate a summary of the current PDF page.
  const handleSummarizePage = async () => {
    if (isLoading) return;

    const gate = await checkUsageGate();

    if (!gate.allowed) return;

    if (!pdfDocument) {
      alert("Please wait for the PDF to finish loading.");
      return;
    }

    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType("page");
    setSummaryContent("Extracting text from the current page...");

    let summarySucceeded = false;

    try {
      const pageText = await extractTextFromPage(pdfDocument, currentPage);

      if (!pageText || pageText.trim().length === 0) {
        setSummaryContent(
          "No text was found on this page. It may contain an image or a scanned document."
        );
        return;
      }

      const wordCount = pageText.split(/\s+/).filter(Boolean).length;

      setSummaryContent(
        `Extracted ${wordCount} words.\n\nGenerating your AI summary...`
      );

      const summary = await summarizeWithOpenRouter(
        pageText,
        "page",
        apiKey,
        { model: selectedModel }
      );

      if (!summary || !summary.trim()) {
        setSummaryContent("Failed to generate a summary. Please try again.");
        return;
      }

      setSummaryContent(
        `📄 **Page ${currentPage} Summary**\n\n${summary}\n\n---\n**Word Count:** ${wordCount} words`
      );

      summarySucceeded = true;

      if (currentUser) {
        saveSummary(currentUser.uid, {
          fileName: selectedFile ?? "Untitled PDF",
          summaryType: "quick",
          content: summary,
          pageNumber: currentPage,
          wordCount,
        }).catch((error) => {
          console.error("Failed to save summary:", error);
        });
      }
    } catch (error) {
      console.error("Page summary error:", error);

      setSummaryContent(
        `Unable to generate the summary. ${error?.message || "Please try again."}`
      );
    } finally {
      setIsLoading(false);

      if (summarySucceeded) {
        if (!currentUser) {
          // Anonymous usage is counted only after successful generation.
          incrementAnonymousQuickSummaryCount();
          setAnonWarningMessage(getSoftWarningMessage());
        } else {
          try {
            await incrementQuickSummaryUsage(currentUser.uid);

            const updatedProfile = await checkAndResetIfNeeded(
              currentUser.uid
            );

            setUserUsageProfile(updatedProfile);
            setIsBannerVisible(true);
          } catch (error) {
            console.error("Failed to update summary usage:", error);
          }
        }
      }
    }
  };

  // Generate a summary of the chapter containing the current page.
  const handleSummarizeChapter = async () => {
    if (isLoading) return;

    if (!currentUser) {
      openAuthModal("signup");
      return;
    }

    let freshProfile;

    try {
      freshProfile = await checkAndResetIfNeeded(currentUser.uid);
      setUserUsageProfile(freshProfile);
    } catch (error) {
      console.error("Failed to load chapter-summary profile:", error);

      alert("We couldn't verify your Premium access. Please try again.");
      return;
    }

    if (!isPremiumActive(freshProfile)) {
      openUpgradeModal();
      return;
    }

    if (!pdfDocument) {
      alert("Please wait for the PDF to finish loading.");
      return;
    }

    if (!checkApiKey()) return;

    setIsLoading(true);
    setShowSummary(true);
    setSummaryType("chapter");
    setSummaryContent(
      "Detecting chapter boundaries and extracting text..."
    );

    try {
      const chapterData = await extractCurrentChapter(
        pdfDocument,
        currentPage
      );

      if (!chapterData.text || !chapterData.text.trim()) {
        setSummaryContent(
          "No text was found in this chapter. The pages may contain only images."
        );
        return;
      }

      const wordCount = chapterData.text
        .split(/\s+/)
        .filter(Boolean).length;

      setSummaryContent(
        `Analyzing chapter (pages ${chapterData.startPage}–${chapterData.endPage}, ${wordCount} words)...\n\nGenerating your AI summary...`
      );

      let summary;

      if (chapterData.text.length > 10000) {
        summary = await summarizeLongText(
          chapterData.text,
          "chapter",
          apiKey,
          (progress, message) => {
            setSummaryContent(
              `Analyzing chapter...\n\n${message}\nProgress: ${progress}%`
            );
          }
        );
      } else {
        summary = await summarizeWithOpenRouter(
          chapterData.text,
          "chapter",
          apiKey,
          { model: selectedModel }
        );
      }

      if (!summary || !summary.trim()) {
        setSummaryContent("Failed to generate a summary. Please try again.");
        return;
      }

      setSummaryContent(
        `📚 **Multi-Page Summary**\n\n**Pages:** ${chapterData.startPage}–${chapterData.endPage}\n\n${summary}\n\n---\n**Word Count:** ${wordCount} words`
      );

      saveSummary(currentUser.uid, {
        fileName: selectedFile ?? "Untitled PDF",
        summaryType: "chapter",
        content: summary,
        chapterRange: `Pages ${chapterData.startPage}–${chapterData.endPage}`,
        wordCount,
      }).catch((error) => {
        console.error("Failed to save chapter summary:", error);
      });
    } catch (error) {
      console.error("Chapter summary error:", error);

      setSummaryContent(
        `Unable to generate the chapter summary. ${error?.message || "Please try again."}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeSummary = () => {
    setShowSummary(false);
    setSummaryContent("");

    if (currentUser && userUsageProfile) {
      setIsBannerVisible(true);
    }
  };

  const handleUpgradeClick = () => {
    closeUpgradeModal();
    navigate("/pricing");
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryContent);
      alert("Summary copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy summary:", error);
      alert(
        "Unable to copy automatically. Please select the summary text and copy it manually."
      );
    }
  };

  // Landing page — no PDF has been selected.
  if (!pdfUrl) {
    return (
      <>
        <LandingPage
          onUpload={handleFileUpload}
          navigate={navigate}
          openSignUp={() => openAuthModal("signup")}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          onSuccess={closeAuthModal}
          initialMode={modalMode}
        />

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={closeUpgradeModal}
          onUpgrade={handleUpgradeClick}
          userProfile={userUsageProfile}
        />
      </>
    );
  }

  // PDF reader view.
  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        position: "relative",
        overflow: "hidden",
        background: theme.background,
        fontFamily: pageFont,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        <PDFReader
          ref={pdfReaderRef}
          pdfUrl={pdfUrl}
          fileName={selectedFile || "document.pdf"}
          onPageChange={(page) => setCurrentPage(page)}
          onPdfLoad={(pdf) => setPdfDocument(pdf)}
        />

        {!currentUser && anonWarningMessage && (
          <div
            style={{
              position: "fixed",
              bottom: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10002,
              width: "calc(100% - 32px)",
              maxWidth: "480px",
            }}
          >
            <SoftWarningBanner
              message={anonWarningMessage}
              onSignUp={() => openAuthModal("signup")}
              onClose={() => setAnonWarningMessage(null)}
            />
          </div>
        )}

        {currentUser && userUsageProfile && isBannerVisible && (
          <div
            style={{
              position: "fixed",
              bottom: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9998,
              width: "calc(100% - 32px)",
              maxWidth: "480px",
            }}
          >
            <FreeTierBanner
              userProfile={userUsageProfile}
              onUpgrade={() => {
                setIsBannerVisible(false);
                openUpgradeModal();
              }}
              onClose={() => setIsBannerVisible(false)}
            />
          </div>
        )}

        <FloatingActionButton
          onSummarizePage={handleSummarizePage}
          onSummarizeChapter={handleSummarizeChapter}
        />

        {/* SUMMARY MODAL */}
        {showSummary && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10001,
              padding: "clamp(10px, 3vw, 24px)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isLoading) {
                closeSummary();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="summary-modal-title"
              style={{
                background: "#ffffff",
                border: `1px solid ${theme.border}`,
                borderRadius: "22px",
                padding: "clamp(22px, 4vw, 34px)",
                maxWidth: "680px",
                width: "100%",
                maxHeight: "min(84dvh, 850px)",
                overflowY: "auto",
                boxShadow: "0 28px 90px rgba(15,23,42,0.24)",
                position: "relative",
                color: theme.text,
              }}
            >
              <button
                type="button"
                onClick={closeSummary}
                disabled={isLoading}
                aria-label="Close summary"
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  width: "36px",
                  height: "36px",
                  background: "#f8fafc",
                  border: `1px solid ${theme.border}`,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  borderRadius: "11px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isLoading ? 0.5 : 1,
                  color: "#475569",
                  fontSize: "23px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 11px",
                  borderRadius: "100px",
                  background: "#eef2ff",
                  border: "1px solid #e0e7ff",
                  color: "#4338ca",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  marginBottom: "15px",
                }}
              >
                {summaryType === "page" ? "⚡ Quick summary" : "📚 Chapter summary"}
              </div>

              <h2
                id="summary-modal-title"
                style={{
                  fontFamily: headingFont,
                  fontSize: "clamp(23px, 4vw, 29px)",
                  fontWeight: 900,
                  lineHeight: 1.3,
                  letterSpacing: "-0.025em",
                  margin: "0 45px 8px 0",
                  color: theme.text,
                }}
              >
                {summaryType === "page"
                  ? "Page Summary"
                  : "Multi-Page Summary"}
              </h2>

              <p
                style={{
                  fontSize: "13px",
                  color: theme.textSecondary,
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {summaryType === "page"
                  ? `Summary of page ${currentPage}`
                  : "Summary of multiple pages"}
              </p>

              {isLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "45px 15px",
                    gap: "18px",
                    background: theme.surfaceSoft,
                    border: `1px solid ${theme.border}`,
                    borderRadius: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      border: "4px solid #e0e7ff",
                      borderTop: "4px solid #6366f1",
                      borderRadius: "50%",
                      animation: "es-spin 0.85s linear infinite",
                    }}
                  />

                  <p
                    style={{
                      margin: 0,
                      color: theme.textSecondary,
                      fontSize: "13px",
                      textAlign: "center",
                      lineHeight: 1.7,
                    }}
                  >
                    Working on your summary. This may take a moment.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.85,
                    color: "#334155",
                    overflowWrap: "anywhere",
                  }}
                >
                  <MarkdownContent content={summaryContent} />
                </div>
              )}

              {!isLoading && (
                <div
                  style={{
                    marginTop: "26px",
                    paddingTop: "20px",
                    borderTop: `1px solid ${theme.border}`,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    style={{
                      ...buttonBase,
                      background: "#ffffff",
                      color: "#334155",
                      border: `1px solid ${theme.border}`,
                      fontSize: "13px",
                      padding: "11px 16px",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    Copy to Clipboard
                  </button>

                  <button
                    type="button"
                    onClick={closeSummary}
                    style={{
                      ...buttonBase,
                      background: theme.blue,
                      color: "#ffffff",
                      border: `1px solid ${theme.blue}`,
                      fontSize: "13px",
                      padding: "11px 20px",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = theme.blueDark;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = theme.blue;
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            <style>{`
              @keyframes es-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }

              @media (prefers-reduced-motion: reduce) {
                @keyframes es-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(0deg); }
                }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* OPENROUTER API KEY MODAL */}
      {showApiKeyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: "16px",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-modal-title"
            style={{
              background: "#ffffff",
              border: `1px solid ${theme.border}`,
              borderRadius: "22px",
              padding: "clamp(22px, 4vw, 32px)",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 28px 90px rgba(15,23,42,0.24)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#eef2ff",
                border: "1px solid #e0e7ff",
                borderRadius: "14px",
                fontSize: "22px",
                marginBottom: "17px",
              }}
            >
              🔑
            </div>

            <h2
              id="api-key-modal-title"
              style={{
                fontFamily: headingFont,
                fontSize: "clamp(22px, 4vw, 27px)",
                fontWeight: 900,
                lineHeight: 1.3,
                color: theme.text,
                margin: "0 0 12px",
              }}
            >
              Connect your AI key
            </h2>

            <p
              style={{
                fontSize: "13px",
                color: theme.textSecondary,
                margin: "0 0 22px",
                lineHeight: 1.8,
              }}
            >
              Get an OpenRouter API key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: theme.blue,
                  fontWeight: 700,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                openrouter.ai/keys
              </a>
              . Check the provider's current terms and model pricing before
              using your key.
            </p>

            <label
              htmlFor="openrouter-api-key"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 800,
                color: "#334155",
                marginBottom: "8px",
              }}
            >
              OpenRouter API key
            </label>

            <input
              id="openrouter-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-or-v1-..."
              style={{
                display: "block",
                width: "100%",
                minWidth: 0,
                padding: "13px 14px",
                borderRadius: "11px",
                border: `1px solid ${theme.border}`,
                background: "#f8fafc",
                color: theme.text,
                fontSize: "13px",
                fontFamily: "monospace",
                marginBottom: "22px",
                outlineColor: "#818cf8",
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isLoading) {
                  handleSaveApiKey();
                }
              }}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                disabled={isLoading}
                style={{
                  ...buttonBase,
                  background: "#ffffff",
                  color: "#475569",
                  border: `1px solid ${theme.border}`,
                  opacity: isLoading ? 0.55 : 1,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  padding: "11px 17px",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={isLoading}
                style={{
                  ...buttonBase,
                  background: theme.blue,
                  color: "#ffffff",
                  border: `1px solid ${theme.blue}`,
                  opacity: isLoading ? 0.65 : 1,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  padding: "11px 17px",
                }}
              >
                {isLoading ? "Validating..." : "Validate & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={closeAuthModal}
        initialMode={modalMode}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        onUpgrade={handleUpgradeClick}
        userProfile={userUsageProfile}
      />
    </div>
  );
}

export default HomePage;

