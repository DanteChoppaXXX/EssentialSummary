// pdfUtils.js - Utility functions for PDF text extraction

/**
 * Extract text from a specific page
 * @param {Object} pdfDocument - PDF.js document object
 * @param {number} pageNumber - Page number (1-indexed)
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromPage = async (pdfDocument, pageNumber) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
    throw new Error(`Invalid page number. Must be between 1 and ${pdfDocument.numPages}`);
  }

  try {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    
    // Extract text items and join them
    const text = textContent.items
      .map(item => item.str)
      .join(' ')
      .trim();
    
    return text;
  } catch (error) {
    console.error(`Error extracting text from page ${pageNumber}:`, error);
    throw error;
  }
};

/**
 * Extract text from multiple pages
 * @param {Object} pdfDocument - PDF.js document object
 * @param {number} startPage - Start page number (1-indexed)
 * @param {number} endPage - End page number (1-indexed)
 * @returns {Promise<Object>} - Object with page numbers as keys and text as values
 */
export const extractTextFromPages = async (pdfDocument, startPage, endPage) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  const validStart = Math.max(1, startPage);
  const validEnd = Math.min(pdfDocument.numPages, endPage);

  const pageTexts = {};

  for (let i = validStart; i <= validEnd; i++) {
    try {
      const text = await extractTextFromPage(pdfDocument, i);
      pageTexts[i] = text;
    } catch (error) {
      console.error(`Failed to extract text from page ${i}:`, error);
      pageTexts[i] = '';
    }
  }

  return pageTexts;
};

/**
 * Extract text from entire document
 * @param {Object} pdfDocument - PDF.js document object
 * @param {Function} onProgress - Optional callback for progress updates (receives percentage)
 * @returns {Promise<Object>} - Object with page numbers as keys and text as values
 */
export const extractAllText = async (pdfDocument, onProgress = null) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  const totalPages = pdfDocument.numPages;
  const allText = {};

  for (let i = 1; i <= totalPages; i++) {
    try {
      const text = await extractTextFromPage(pdfDocument, i);
      allText[i] = text;

      // Update progress
      if (onProgress) {
        const progress = Math.round((i / totalPages) * 100);
        onProgress(progress);
      }
    } catch (error) {
      console.error(`Failed to extract text from page ${i}:`, error);
      allText[i] = '';
    }
  }

  return allText;
};

/**
 * Search for text in PDF
 * @param {Object} pdfDocument - PDF.js document object
 * @param {string} searchQuery - Text to search for
 * @param {boolean} caseSensitive - Whether search should be case-sensitive
 * @returns {Promise<Array>} - Array of results with page number and matches
 */
export const searchInPDF = async (pdfDocument, searchQuery, caseSensitive = false) => {
  if (!pdfDocument || !searchQuery) {
    return [];
  }

  const results = [];
  const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    try {
      const text = await extractTextFromPage(pdfDocument, i);
      const searchText = caseSensitive ? text : text.toLowerCase();

      if (searchText.includes(query)) {
        // Find all occurrences
        const matches = [];
        let index = searchText.indexOf(query);
        
        while (index !== -1) {
          // Get context around the match (50 chars before and after)
          const start = Math.max(0, index - 50);
          const end = Math.min(searchText.length, index + query.length + 50);
          const context = text.substring(start, end);
          
          matches.push({
            index,
            context: context.trim()
          });
          
          index = searchText.indexOf(query, index + 1);
        }

        results.push({
          page: i,
          matches
        });
      }
    } catch (error) {
      console.error(`Error searching page ${i}:`, error);
    }
  }

  return results;
};

/**
 * Detect chapter boundaries (heuristic approach)
 * Looks for common chapter patterns like "Chapter N", "Section N", numbered headings
 * @param {Object} pdfDocument - PDF.js document object
 * @returns {Promise<Array>} - Array of chapter objects with start page and title
 */
export const detectChapters = async (pdfDocument) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  const chapters = [];
  const chapterPatterns = [
    /^chapter\s+\d+/i,
    /^section\s+\d+/i,
    /^\d+\.\s+[A-Z]/,
    /^part\s+\d+/i,
    /^[IVX]+\.\s+[A-Z]/ // Roman numerals
  ];

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    try {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      // Check first few text items for chapter headings
      const firstItems = textContent.items.slice(0, 10);
      
      for (const item of firstItems) {
        const text = item.str.trim();
        
        // Check if text matches any chapter pattern
        const isChapter = chapterPatterns.some(pattern => pattern.test(text));
        
        if (isChapter) {
          chapters.push({
            page: i,
            title: text,
            confidence: 'high'
          });
          break; // Move to next page
        }
      }
    } catch (error) {
      console.error(`Error detecting chapters on page ${i}:`, error);
    }
  }

  return chapters;
};

/**
 * Get text from current chapter (starting from current page and going until next chapter)
 * @param {Object} pdfDocument - PDF.js document object
 * @param {number} currentPage - Current page number
 * @param {number} maxPages - Maximum pages to extract (default: 20)
 * @returns {Promise<Object>} - Object with combined text and page range
 */
export const extractCurrentChapter = async (pdfDocument, currentPage, maxPages = 20) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  // Detect all chapters
  const chapters = await detectChapters(pdfDocument);
  
  // Find current chapter
  let startPage = currentPage;
  let endPage = currentPage + maxPages - 1;

  if (chapters.length > 0) {
    // Find the chapter that includes current page
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].page <= currentPage) {
        startPage = chapters[i].page;
        
        // End page is either the next chapter or max pages
        if (i < chapters.length - 1) {
          endPage = Math.min(chapters[i + 1].page - 1, startPage + maxPages - 1);
        } else {
          endPage = Math.min(pdfDocument.numPages, startPage + maxPages - 1);
        }
      }
    }
  }

  // Ensure we don't exceed document bounds
  endPage = Math.min(endPage, pdfDocument.numPages);

  // Extract text from chapter
  const pageTexts = await extractTextFromPages(pdfDocument, startPage, endPage);
  const combinedText = Object.values(pageTexts).join('\n\n');

  return {
    text: combinedText,
    startPage,
    endPage,
    pageCount: endPage - startPage + 1
  };
};

/**
 * Get summary statistics about the PDF text
 * @param {Object} pdfDocument - PDF.js document object
 * @returns {Promise<Object>} - Statistics about the document
 */
export const getPDFTextStats = async (pdfDocument) => {
  if (!pdfDocument) {
    throw new Error('PDF document not loaded');
  }

  const allText = await extractAllText(pdfDocument);
  const combinedText = Object.values(allText).join(' ');
  
  const words = combinedText.split(/\s+/).filter(word => word.length > 0);
  const characters = combinedText.replace(/\s/g, '').length;

  return {
    totalPages: pdfDocument.numPages,
    totalWords: words.length,
    totalCharacters: characters,
    averageWordsPerPage: Math.round(words.length / pdfDocument.numPages),
    estimatedReadingTimeMinutes: Math.round(words.length / 200) // Average reading speed
  };
};
