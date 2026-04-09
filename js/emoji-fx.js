/**
 * emoji-fx.js — Animated emoji effects for inline feedback
 *
 * Wraps emojis in animated containers with CSS-driven effects.
 * Each emoji maps to a unique animation class + optional particles.
 */
const EmojiFx = (() => {
  // Map emoji to animation type and particle count
  const _emojiMap = {
    '🎯': { fx: 'target',    particles: 0 },
    '✨': { fx: 'sparkle',   particles: 4 },
    '🔥': { fx: 'fire',      particles: 0 },
    '💪': { fx: 'flex',      particles: 0 },
    '⭐': { fx: 'star',      particles: 0 },
    '🎉': { fx: 'party',     particles: 6 },
    '👏': { fx: 'clap',      particles: 0 },
    '💫': { fx: 'dizzy',     particles: 0 },
    '⚡': { fx: 'lightning',  particles: 0 },
    '💥': { fx: 'boom',      particles: 0 },
    '🏆': { fx: 'trophy',    particles: 0 },
    '👑': { fx: 'crown',     particles: 0 },
    '🌟': { fx: 'glow',      particles: 0 },
  };

  /**
   * Build HTML for a praise string, wrapping the leading emoji
   * in an animated container with optional particle spans.
   * @param {string} text - Praise text like "🎯 Spot on!"
   * @returns {string} HTML string
   */
  function buildPraiseHTML(text) {
    // Extract leading emoji (emoji can be multi-codepoint)
    const emojiMatch = text.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
    if (!emojiMatch) return _escHtml(text);

    const emoji = emojiMatch[1];
    const rest = text.slice(emoji.length);
    const config = _emojiMap[emoji];

    if (!config) {
      return _escHtml(text);
    }

    let particles = '';
    for (let i = 0; i < config.particles; i++) {
      particles += '<span class="emoji-particle"></span>';
    }

    return `<span class="emoji-fx emoji-fx-${config.fx}">${emoji}${particles}</span>${_escHtml(rest)}`;
  }

  function _escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { buildPraiseHTML };
})();
