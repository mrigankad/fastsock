export const formatMessage = (text: string): string => {
  // Escape HTML to prevent XSS
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Bold: *text* -> <strong>text</strong>
  formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // Italic: _text_ -> <em>text</em>
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Code: `text` -> <code>text</code>
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
  
  // Code blocks: ```text``` -> <pre><code>text</code></pre>
  formatted = formatted.replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto"><code>$1</code></pre>');
  
  // Links: [text](url) -> <a href="url">text</a>
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Line breaks: \n -> <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
};

export const stripFormatting = (text: string): string => {
  return text
    .replace(/\*([^*]+)\*/g, '$1') // Remove bold
    .replace(/_([^_]+)_/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/```([^`]+)```/g, '$1') // Remove code blocks
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // Remove link formatting
};