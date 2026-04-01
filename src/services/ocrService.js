// src/services/ocrService.js
// ─────────────────────────────────────────────────────────────────────────────
// ISOLATED OCR service. Completely separate from the PDF extraction pipeline.
// Uses Tesseract.js for in-browser OCR on images (JPG, JPEG, PNG).
//
// NOTHING in this file touches or imports from the PDF system.
// ─────────────────────────────────────────────────────────────────────────────

// Supported image types for OCR
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
export const MAX_IMAGE_SIZE_MB = 10;

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateImageFile(file)
//
// Validates the uploaded file before OCR starts.
// Returns { valid: true } or { valid: false, error: string }
// ─────────────────────────────────────────────────────────────────────────────
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Please upload a JPG or PNG image.`,
    };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_IMAGE_SIZE_MB) {
    return {
      valid: false,
      error: `Image is too large (${sizeMB.toFixed(1)}MB). Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`,
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. extractTextFromImage(file, onProgress)
//
// Runs Tesseract.js OCR on the image file.
// onProgress(message) is called with status updates for the UI.
// Returns the extracted text string.
// Throws on failure.
// ─────────────────────────────────────────────────────────────────────────────
export async function extractTextFromImage(file, onProgress) {
  // Dynamically import Tesseract.js so it only loads when needed
  // and never affects the PDF flow bundle
  const Tesseract = (await import("tesseract.js")).default;

  if (onProgress) onProgress("Loading OCR engine…");

  const imageUrl = URL.createObjectURL(file);

  try {
    const result = await Tesseract.recognize(imageUrl, "eng", {
      logger: (info) => {
        if (info.status === "recognizing text" && onProgress) {
          const pct = Math.round((info.progress || 0) * 100);
          onProgress(`Extracting text from image… ${pct}%`);
        }
      },
    });

    const text = result.data.text || "";
    return text;
  } finally {
    // Always revoke the object URL to free memory
    URL.revokeObjectURL(imageUrl);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. cleanOcrText(rawText)
//
// Light cleanup of raw Tesseract output before sending to OpenRouter.
// Does NOT aggressively alter content — just removes noise.
// ─────────────────────────────────────────────────────────────────────────────
export function cleanOcrText(rawText) {
  if (!rawText) return "";

  return rawText
    // Collapse 3+ consecutive newlines into 2 (keep paragraph breaks)
    .replace(/\n{3,}/g, "\n\n")
    // Remove lines that are only whitespace or single special characters
    .replace(/^[\s\W]{0,2}$/gm, "")
    // Collapse multiple spaces into one
    .replace(/ {2,}/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. hasUsableText(text)
//
// Returns true if the extracted text is long enough to be worth summarizing.
// Rejects empty or near-empty OCR results.
// ─────────────────────────────────────────────────────────────────────────────
export function hasUsableText(text) {
  if (!text) return false;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 20; // minimum 20 words for a useful summary
}
