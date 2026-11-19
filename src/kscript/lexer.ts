import { Token, TokenKind, KScriptError } from './types';

export class KScriptLexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string | null {
    return this.pos < this.input.length ? this.input[this.pos] : null;
  }

  private peekNext(): string | null {
    return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : null;
  }

  private advance(): string | null {
    if (this.pos < this.input.length) {
      const c = this.input[this.pos++];
      if (c === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      return c;
    }
    return null;
  }

  public tokenize(): { tokens: Token[]; error?: KScriptError } {
    const tokens: Token[] = [];

    while (this.peek() !== null) {
      const c = this.peek()!;
      const startLine = this.line;
      const startCol = this.col;

      if (c === ' ' || c === '\t' || c === '\r') {
        this.advance();
        continue;
      }

      if (c === '\n') {
        this.advance();
        tokens.push({
          kind: { type: 'NEWLINE' },
          line: startLine,
          column: startCol,
          raw: '\n',
        });
        continue;
      }

      // Comentarios (# o //)
      if (c === '#' || (c === '/' && this.peekNext() === '/')) {
        let comment = '';
        while (this.peek() !== null && this.peek() !== '\n') {
          comment += this.advance();
        }
        tokens.push({
          kind: { type: 'COMMENT', value: comment },
          line: startLine,
          column: startCol,
          raw: comment,
        });
        continue;
      }

      // Pipeline `>>`
      if (c === '>' && this.peekNext() === '>') {
        this.advance();
        this.advance();
        tokens.push({
          kind: { type: 'PIPELINE_ARROW' },
          line: startLine,
          column: startCol,
          raw: '>>',
        });
        continue;
      }

      // Símbolos únicos
      if (c === ':') {
        this.advance();
        tokens.push({ kind: { type: 'COLON' }, line: startLine, column: startCol, raw: ':' });
        continue;
      }
      if (c === '[') {
        this.advance();
        tokens.push({ kind: { type: 'BRACKET_OPEN' }, line: startLine, column: startCol, raw: '[' });
        continue;
      }
      if (c === ']') {
        this.advance();
        tokens.push({ kind: { type: 'BRACKET_CLOSE' }, line: startLine, column: startCol, raw: ']' });
        continue;
      }
      if (c === '|') {
        this.advance();
        tokens.push({ kind: { type: 'PIPE' }, line: startLine, column: startCol, raw: '|' });
        continue;
      }
      if (c === '~') {
        this.advance();
        tokens.push({ kind: { type: 'TILDE' }, line: startLine, column: startCol, raw: '~' });
        continue;
      }
      if (c === '!') {
        this.advance();
        tokens.push({ kind: { type: 'EXCLAMATION' }, line: startLine, column: startCol, raw: '!' });
        continue;
      }
      if (c === '@') {
        this.advance();
        tokens.push({ kind: { type: 'AT' }, line: startLine, column: startCol, raw: '@' });
        continue;
      }
      if (c === ',') {
        this.advance();
        tokens.push({ kind: { type: 'COMMA' }, line: startLine, column: startCol, raw: ',' });
        continue;
      }
      if (c === ';') {
        this.advance();
        tokens.push({ kind: { type: 'SEMICOLON' }, line: startLine, column: startCol, raw: ';' });
        continue;
      }

      // Strings
      if (c === '"' || c === "'") {
        const quote = c;
        this.advance();
        let str = '';
        let closed = false;
        while (this.peek() !== null) {
          const ch = this.advance()!;
          if (ch === quote) {
            closed = true;
            break;
          }
          str += ch;
        }
        if (!closed) {
          return {
            tokens,
            error: {
              code: 'E006_UNTERMINATED_STRING',
              message: 'Comilla no cerrada en la cadena de texto',
              line: startLine,
              column: startCol,
            },
          };
        }
        tokens.push({
          kind: { type: 'STRING_LITERAL', value: str },
          line: startLine,
          column: startCol,
          raw: `${quote}${str}${quote}`,
        });
        continue;
      }

      // Números y Frecuencias (ej: 528Hz)
      if (/\d/.test(c) || (c === '-' && this.peekNext() && /\d/.test(this.peekNext()!))) {
        let numStr = '';
        if (c === '-') {
          numStr += this.advance();
        }
        while (this.peek() !== null && (/[\d.]/.test(this.peek()!))) {
          numStr += this.advance();
        }
        // Chequear sufijo Hz
        if (this.peek()?.toLowerCase() === 'h' && this.peekNext()?.toLowerCase() === 'z') {
          this.advance();
          this.advance();
          tokens.push({
            kind: { type: 'FREQUENCY', value: parseFloat(numStr) },
            line: startLine,
            column: startCol,
            raw: `${numStr}Hz`,
          });
          continue;
        }
        tokens.push({
          kind: { type: 'NUMBER', value: parseFloat(numStr) },
          line: startLine,
          column: startCol,
          raw: numStr,
        });
        continue;
      }

      // Identificadores (Verbos, Sujetos, Parámetros)
      if (/[a-zA-Z_]/.test(c)) {
        let ident = '';
        while (this.peek() !== null && /[a-zA-Z0-9_\-]/.test(this.peek()!)) {
          ident += this.advance();
        }
        tokens.push({
          kind: { type: 'IDENTIFIER', value: ident },
          line: startLine,
          column: startCol,
          raw: ident,
        });
        continue;
      }

      return {
        tokens,
        error: {
          code: 'E001_UNEXPECTED_TOKEN',
          message: `Carácter inesperado '${c}'`,
          line: startLine,
          column: startCol,
        },
      };
    }

    tokens.push({
      kind: { type: 'EOF' },
      line: this.line,
      column: this.col,
      raw: '',
    });

    return { tokens };
  }
}
