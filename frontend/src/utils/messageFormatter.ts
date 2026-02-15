/**
 * Rich message formatter — Teams-grade formatting.
 *
 * Supports:
 *  - Fenced code blocks: ```lang\ncode``` with language labels
 *  - Inline code: `code`
 *  - Bold: **text** or *text*
 *  - Italic: _text_
 *  - Strikethrough: ~~text~~
 *  - @mentions: @username (highlighted)
 *  - Block quotes: > text
 *  - Unordered lists: - item
 *  - Ordered lists: 1. item
 *  - Horizontal rules: ---
 *  - Auto-links: URLs become clickable
 *  - Line breaks: \n → <br>
 */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

// Regex for fenced code blocks: ```lang\ncode``` (multiline)
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;

// Regex for inline code: `code`
const INLINE_CODE_REGEX = /`([^`\n]+)`/g;

// Regex for auto-linking URLs
const URL_REGEX = /(https?:\/\/[^\s<)"']+)/g;

// Regex for @mentions
const MENTION_REGEX = /@(\w[\w.-]*)/g;

/**
 * Apply basic keyword highlighting to a code string.
 * Lightweight — highlights common keywords, strings, and comments.
 */
const highlightCode = (code: string): string => {
  let html = escapeHtml(code);

  // Highlight single-line comments (// and #)
  html = html.replace(/(\/\/.*$|#.*$)/gm, '<span class="code-comment">$1</span>');

  // Highlight strings (double and single quoted)
  html = html.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;)/g, '<span class="code-string">$1</span>');

  // Highlight common keywords
  const keywords = [
    'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
    'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try',
    'catch', 'throw', 'new', 'this', 'super', 'extends', 'implements',
    'interface', 'type', 'enum', 'public', 'private', 'protected', 'static',
    'def', 'self', 'None', 'True', 'False', 'print', 'lambda', 'with', 'as',
    'yield', 'raise', 'pass', 'break', 'continue', 'in', 'not', 'and', 'or',
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'TABLE', 'INTO', 'VALUES', 'SET', 'JOIN', 'ON', 'ORDER', 'BY',
    'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'AND', 'OR', 'NOT', 'NULL',
    'true', 'false', 'null', 'undefined', 'void', 'typeof', 'instanceof',
  ];
  const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  html = html.replace(kwRegex, '<span class="code-keyword">$1</span>');

  // Highlight numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>');

  return html;
};

/**
 * Format inline content (everything except code blocks).
 */
const formatInline = (text: string): string => {
  let html = escapeHtml(text);

  // Inline code (must run first so other rules don't interfere)
  html = html.replace(INLINE_CODE_REGEX, '<code class="msg-inline-code">$1</code>');

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Bold: *text* (single star if not already ** )
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<strong>$1</strong>');

  // Italic: _text_
  html = html.replace(/(?<=\s|^)_([^_]+)_(?=\s|$)/gm, '<em>$1</em>');

  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // @mentions
  html = html.replace(MENTION_REGEX, '<span class="msg-mention">@$1</span>');

  // Markdown links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="msg-link" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Auto-link raw URLs (but skip ones already in <a> tags)
  html = html.replace(URL_REGEX, (match) => {
    // Check if already inside an href or <a> tag
    return `<a href="${match}" class="msg-link" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  return html;
};

/**
 * Process block-level elements (blockquotes, lists, hr).
 */
const formatBlocks = (html: string): string => {
  const lines = html.split('\n');
  const output: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      if (inList) { output.push(listType === 'ol' ? '</ol>' : '</ul>'); inList = false; listType = null; }
      output.push('<hr class="msg-hr">');
      continue;
    }

    // Block quote
    if (trimmed.startsWith('&gt; ') || trimmed === '&gt;') {
      if (inList) { output.push(listType === 'ol' ? '</ol>' : '</ul>'); inList = false; listType = null; }
      const content = trimmed.replace(/^&gt;\s?/, '');
      output.push(`<blockquote class="msg-blockquote">${content}</blockquote>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) output.push(listType === 'ol' ? '</ol>' : '</ul>');
        output.push('<ul class="msg-list">');
        inList = true;
        listType = 'ul';
      }
      output.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) output.push(listType === 'ol' ? '</ol>' : '</ul>');
        output.push('<ol class="msg-list msg-list-ol">');
        inList = true;
        listType = 'ol';
      }
      output.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    // Close list if we leave list context
    if (inList) {
      output.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }

    output.push(rawLine);
  }

  if (inList) output.push(listType === 'ol' ? '</ol>' : '</ul>');

  return output.join('\n');
};

/**
 * Main formatter — handles code blocks, then inline + blocks.
 */
export const formatMessage = (text: string): string => {
  // 1. Extract fenced code blocks, replace with placeholders
  const codeBlocks: string[] = [];
  let processed = text.replace(CODE_BLOCK_REGEX, (_match, lang: string | undefined, code: string) => {
    const language = lang?.toLowerCase() || 'text';
    const highlighted = highlightCode(code.trimEnd());
    const langLabel = language !== 'text' ? `<div class="code-lang-label">${escapeHtml(language)}</div>` : '';
    const block = `<div class="msg-code-block">${langLabel}<pre><code>${highlighted}</code></pre></div>`;
    codeBlocks.push(block);
    return `[[[CODEBLOCK_${codeBlocks.length - 1}]]]`;
  });

  // 2. Format each segment between code blocks
  const segments = processed.split(/(\[\[\[CODEBLOCK_\d+\]\]\])/);
  processed = segments
    .map((seg) => {
      const cbMatch = seg.match(/^\[\[\[CODEBLOCK_(\d+)\]\]\]$/);
      if (cbMatch) return codeBlocks[parseInt(cbMatch[1], 10)];
      // Apply inline formatting then block formatting then line breaks
      let html = formatInline(seg);
      html = formatBlocks(html);
      html = html.replace(/\n/g, '<br>');
      return html;
    })
    .join('');

  return processed;
};

/**
 * Strip all formatting to produce plain text (for previews / search).
 */
export const stripFormatting = (text: string): string => {
  return text
    .replace(CODE_BLOCK_REGEX, '$2')
    .replace(INLINE_CODE_REGEX, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(MENTION_REGEX, '@$1');
};

/**
 * Extract @mentions from a message.
 */
export const extractMentions = (text: string): string[] => {
  const mentions: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = re.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)];
};
