// Módulo `lexerV2`: convierte texto K-Script / .koko v2.0 en tokens con spans.
// Port directo de `korivm/src/kscript/lexer.rs` a TypeScript estricto.
// Alineado con `src/kscript/ast.ts` (v2.0). Sin dependencias externas.

import type { Span } from './ast';

// ============================================================================
// TOKENS
// ============================================================================

export type Token =
  // Literales
  | { type: 'identifier'; value: string }
  | { type: 'number'; value: number }
  | { type: 'integer'; value: number }
  | { type: 'string'; value: string }
  | { type: 'hertz'; value: number }
  // Prefijados
  | { type: 'reference'; value: string }
  | { type: 'conditional'; value: string }
  | { type: 'modifier'; value: string }
  // Puntuación
  | { type: 'colon' }
  | { type: 'comma' }
  | { type: 'semicolon' }
  | { type: 'openBracket' }
  | { type: 'closeBracket' }
  | { type: 'openParen' }
  | { type: 'closeParen' }
  | { type: 'openBrace' }
  | { type: 'closeBrace' }
  | { type: 'equals' }
  // Operadores
  | { type: 'pipe' }
  | { type: 'bar' }
  | { type: 'plus' }
  | { type: 'minus' }
  | { type: 'concat' }
  | { type: 'arrow' }
  | { type: 'gte' }
  | { type: 'lte' }
  | { type: 'gt' }
  | { type: 'lt' }
  | { type: 'eq' }
  | { type: 'neq' }
  | { type: 'slash' }
  // Glifos K-Script
  | { type: 'glyphVertical' }
  | { type: 'glyphHorizontal' }
  | { type: 'glyphMap' }
  // Control
  | { type: 'comment'; value: string }
  | { type: 'newline' }
  | { type: 'eof' };

export type SpannedToken = { token: Token; span: Span };

export function tokenKindName(t: Token): string {
  switch (t.type) {
    case 'identifier':
      return 'identificador';
    case 'number':
      return 'número';
    case 'integer':
      return 'entero';
    case 'string':
      return 'cadena';
    case 'hertz':
      return 'frecuencia (Hz)';
    case 'reference':
      return 'referencia (@)';
    case 'conditional':
      return 'condición (?)';
    case 'modifier':
      return 'modificador (~)';
    case 'colon':
      return "':'";
    case 'comma':
      return "','";
    case 'semicolon':
      return "';'";
    case 'openBracket':
      return "'['";
    case 'closeBracket':
      return "']'";
    case 'openParen':
      return "'('";
    case 'closeParen':
      return "')'";
    case 'openBrace':
      return "'{'";
    case 'closeBrace':
      return "'}'";
    case 'equals':
      return "'='";
    case 'pipe':
      return "'>>'";
    case 'bar':
      return "'|'";
    case 'plus':
      return "'+'";
    case 'minus':
      return "'-'";
    case 'concat':
      return "'||'";
    case 'arrow':
      return "'->'";
    case 'gte':
      return "'>='";
    case 'lte':
      return "'<='";
    case 'gt':
      return "'>'";
    case 'lt':
      return "'<'";
    case 'eq':
      return "'=='";
    case 'neq':
      return "'!='";
    case 'slash':
      return "'/'";
    case 'glyphVertical':
      return "'•|'";
    case 'glyphHorizontal':
      return "'•-'";
    case 'glyphMap':
      return "'🗺️'";
    case 'comment':
      return 'comentario';
    case 'newline':
      return 'salto de línea';
    case 'eof':
      return 'fin de archivo';
  }
}

// ============================================================================
// ERRORES
// ============================================================================

export class LexError extends Error {
  public readonly rawMessage: string;
  public readonly span: Span;

  constructor(message: string, span: Span) {
    super(`Error léxico en línea ${span.line}, col ${span.col}: ${message}`);
    this.name = 'LexError';
    this.rawMessage = message;
    this.span = span;
  }
}

// ============================================================================
// LEXER
// ============================================================================

export class Lexer {
  private chars: string[];
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;

  constructor(input: string) {
    // Array.from maneja correctamente code points Unicode (emojis incluidos)
    this.chars = Array.from(input);
  }

  // ---- Helpers básicos ----

  private peek(): string | undefined {
    return this.chars[this.pos];
  }

  private peekAt(offset: number): string | undefined {
    return this.chars[this.pos + offset];
  }

  private advance(): string | undefined {
    const c = this.chars[this.pos];
    if (c === undefined) return undefined;
    this.pos++;
    if (c === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return c;
  }

  private currentSpan(startLine: number, startCol: number, startOffset: number): Span {
    return {
      line: startLine,
      col: startCol,
      offset: startOffset,
      len: this.pos - startOffset,
    };
  }

  private makeError(msg: string, startLine: number, startCol: number, startOffset: number): LexError {
    return new LexError(msg, this.currentSpan(startLine, startCol, startOffset));
  }

  // ---- Punto de entrada ----

  tokenize(): SpannedToken[] {
    const tokens: SpannedToken[] = [];
    while (true) {
      this.skipWhitespaceNonNewline();
      if (this.pos >= this.chars.length) {
        tokens.push({
          token: { type: 'eof' },
          span: { line: this.line, col: this.col, offset: this.pos, len: 0 },
        });
        return tokens;
      }

      const c = this.peek()!;

      // Newline
      if (c === '\n') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        tokens.push({ token: { type: 'newline' }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Comentarios: // o #
      if ((c === '/' && this.peekAt(1) === '/') || c === '#') {
        const [l, col, off] = [this.line, this.col, this.pos];
        let comment = '';
        while (this.peek() !== undefined && this.peek() !== '\n') {
          comment += this.advance();
        }
        tokens.push({ token: { type: 'comment', value: comment }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Glifos especiales (antes de operadores porque usan •)
      if (c === '•') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        const next = this.peek();
        if (next === '|') {
          this.advance();
          tokens.push({ token: { type: 'glyphVertical' }, span: this.currentSpan(l, col, off) });
        } else if (next === '-') {
          this.advance();
          tokens.push({ token: { type: 'glyphHorizontal' }, span: this.currentSpan(l, col, off) });
        } else {
          throw this.makeError("se esperaba '|' o '-' después de '•'", l, col, off);
        }
        continue;
      }

      // 🗺️ (mapa)
      if (c === '🗺') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        // Variation selector U+FE0F opcional
        if (this.peek() === '\uFE0F') {
          this.advance();
        }
        tokens.push({ token: { type: 'glyphMap' }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Referencia @xxx
      if (c === '@') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        const name = this.readIdentifierBody();
        if (name === '') {
          throw this.makeError("se esperaba identificador después de '@'", l, col, off);
        }
        tokens.push({ token: { type: 'reference', value: name }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Condición ?xxx
      if (c === '?') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        const name = this.readIdentifierBody();
        if (name === '') {
          throw this.makeError("se esperaba identificador después de '?'", l, col, off);
        }
        tokens.push({ token: { type: 'conditional', value: name }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Modificador ~xxx
      if (c === '~') {
        const [l, col, off] = [this.line, this.col, this.pos];
        this.advance();
        const name = this.readIdentifierBody();
        if (name === '') {
          throw this.makeError("se esperaba identificador después de '~'", l, col, off);
        }
        tokens.push({ token: { type: 'modifier', value: name }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Strings
      if (c === '"' || c === "'") {
        const [l, col, off] = [this.line, this.col, this.pos];
        const s = this.readString(c);
        tokens.push({ token: { type: 'string', value: s }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Números (incluyendo negativos)
      if (isDigit(c) || (c === '-' && this.peekAt(1) !== undefined && isDigit(this.peekAt(1)!))) {
        const [l, col, off] = [this.line, this.col, this.pos];
        const tok = this.readNumber();
        tokens.push({ token: tok, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Identificadores
      if (isAlpha(c) || c === '_') {
        const [l, col, off] = [this.line, this.col, this.pos];
        const name = this.readIdentifierBody();
        tokens.push({ token: { type: 'identifier', value: name }, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Operadores de 2 caracteres
      const [l, col, off] = [this.line, this.col, this.pos];
      const next = this.peekAt(1);
      let matched2 = true;
      let tok2: Token | null = null;
      if (c === '>' && next === '>') tok2 = { type: 'pipe' };
      else if (c === '>' && next === '=') tok2 = { type: 'gte' };
      else if (c === '<' && next === '=') tok2 = { type: 'lte' };
      else if (c === '=' && next === '=') tok2 = { type: 'eq' };
      else if (c === '!' && next === '=') tok2 = { type: 'neq' };
      else if (c === '|' && next === '|') tok2 = { type: 'concat' };
      else if (c === '-' && next === '>') tok2 = { type: 'arrow' };
      else matched2 = false;

      if (matched2 && tok2) {
        this.advance();
        this.advance();
        tokens.push({ token: tok2, span: this.currentSpan(l, col, off) });
        continue;
      }

      // Operadores y puntuación de 1 carácter
      let tok1: Token;
      switch (c) {
        case ':':
          tok1 = { type: 'colon' };
          break;
        case ',':
          tok1 = { type: 'comma' };
          break;
        case ';':
          tok1 = { type: 'semicolon' };
          break;
        case '[':
          tok1 = { type: 'openBracket' };
          break;
        case ']':
          tok1 = { type: 'closeBracket' };
          break;
        case '(':
          tok1 = { type: 'openParen' };
          break;
        case ')':
          tok1 = { type: 'closeParen' };
          break;
        case '{':
          tok1 = { type: 'openBrace' };
          break;
        case '}':
          tok1 = { type: 'closeBrace' };
          break;
        case '=':
          tok1 = { type: 'equals' };
          break;
        case '|':
          tok1 = { type: 'bar' };
          break;
        case '+':
          tok1 = { type: 'plus' };
          break;
        case '-':
          tok1 = { type: 'minus' };
          break;
        case '>':
          tok1 = { type: 'gt' };
          break;
        case '<':
          tok1 = { type: 'lt' };
          break;
        case '/':
          tok1 = { type: 'slash' };
          break;
        default:
          throw this.makeError(`carácter inesperado '${c}'`, l, col, off);
      }
      this.advance();
      tokens.push({ token: tok1, span: this.currentSpan(l, col, off) });
    }
  }

  // ---- Helpers de lectura ----

  private skipWhitespaceNonNewline(): void {
    while (this.peek() !== undefined) {
      const c = this.peek()!;
      if (c === ' ' || c === '\t' || c === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private readIdentifierBody(): string {
    let s = '';
    while (this.peek() !== undefined) {
      const c = this.peek()!;
      if (isAlnum(c) || c === '_') {
        s += c;
        this.advance();
      } else {
        break;
      }
    }
    return s;
  }

  private readString(quote: string): string {
    const [l, col, off] = [this.line, this.col, this.pos];
    this.advance(); // consume opening quote
    let s = '';
    while (true) {
      const c = this.advance();
      if (c === undefined) {
        throw this.makeError('string sin comilla de cierre', l, col, off);
      }
      if (c === quote) return s;
      if (c === '\\') {
        const esc = this.advance();
        if (esc === undefined) {
          throw this.makeError('escape incompleto al final del archivo', l, col, off);
        }
        switch (esc) {
          case 'n':
            s += '\n';
            break;
          case 't':
            s += '\t';
            break;
          case 'r':
            s += '\r';
            break;
          case '\\':
            s += '\\';
            break;
          default:
            if (esc === quote) s += quote;
            else s += '\\' + esc;
        }
      } else {
        s += c;
      }
    }
  }

  private readNumber(): Token {
    const [l, col, off] = [this.line, this.col, this.pos];
    let s = '';

    if (this.peek() === '-') {
      s += '-';
      this.advance();
    }

    let hasDot = false;
    while (this.peek() !== undefined) {
      const c = this.peek()!;
      if (isDigit(c)) {
        s += c;
        this.advance();
      } else if (c === '.' && !hasDot) {
        if (s === '' || s === '-') break;
        hasDot = true;
        s += c;
        this.advance();
      } else {
        break;
      }
    }

    // Sufijo Hz
    if (this.peek() === 'H' && this.peekAt(1) === 'z') {
      this.advance();
      this.advance();
      const val = Number.parseFloat(s);
      if (Number.isNaN(val)) throw this.makeError('frecuencia Hz inválida', l, col, off);
      return { type: 'hertz', value: val };
    }

    if (hasDot) {
      const val = Number.parseFloat(s);
      if (Number.isNaN(val)) throw this.makeError('número flotante inválido', l, col, off);
      return { type: 'number', value: val };
    } else {
      const val = Number.parseInt(s, 10);
      if (Number.isNaN(val)) throw this.makeError('entero inválido', l, col, off);
      return { type: 'integer', value: val };
    }
  }
}

// ============================================================================
// HELPERS DE CARACTERES (code points Unicode)
// ============================================================================

const UNICODE_LETTER_RE = /^\p{L}$/u;

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isAlpha(c: string): boolean {
  return UNICODE_LETTER_RE.test(c);
}

function isAlnum(c: string): boolean {
  return isDigit(c) || isAlpha(c);
}

// ============================================================================
// FACADE (compatibilidad con imports existentes)
// ============================================================================

export function tokenize(input: string): SpannedToken[] {
  return new Lexer(input).tokenize();
}
