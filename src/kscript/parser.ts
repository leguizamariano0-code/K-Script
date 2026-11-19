import { KScriptLexer } from './lexer';
import { 
  Token, 
  KScriptProgram, 
  Statement, 
  CommandNode, 
  ParamNode, 
  ValueNode, 
  ModifierNode, 
  KScriptError 
} from './types';
import { findVerb, findSubject, suggestVerb, suggestSubject } from './dictionary';

export class KScriptParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public static parse(source: string): { program?: KScriptProgram; error?: KScriptError } {
    const lexer = new KScriptLexer(source);
    const { tokens, error: lexError } = lexer.tokenize();
    if (lexError) return { error: lexError };

    const parser = new KScriptParser(tokens);
    return parser.parseProgram();
  }

  private current(): Token {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const t = this.current();
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return t;
  }

  private skipNewlines() {
    while (this.current().kind.type === 'NEWLINE' || this.current().kind.type === 'SEMICOLON') {
      this.advance();
    }
  }

  public parseProgram(): { program?: KScriptProgram; error?: KScriptError } {
    const statements: Statement[] = [];
    this.skipNewlines();

    while (this.current().kind.type !== 'EOF') {
      if (this.current().kind.type === 'COMMENT') {
        const comment = (this.current().kind as { type: 'COMMENT'; value: string }).value;
        this.advance();
        statements.push({ type: 'Comment', value: comment });
        this.skipNewlines();
        continue;
      }

      const stmtRes = this.parseStatement();
      if (stmtRes.error) return { error: stmtRes.error };
      if (stmtRes.statement) {
        statements.push(stmtRes.statement);
      }
      this.skipNewlines();
    }

    if (statements.length === 0) {
      return {
        error: {
          code: 'E008_EMPTY_PROGRAM',
          message: 'El programa K-Script está vacío',
          line: 1,
          column: 1,
        },
      };
    }

    return { program: { statements } };
  }

  private parseStatement(): { statement?: Statement; error?: KScriptError } {
    const cmdRes = this.parseCommand();
    if (cmdRes.error) return { error: cmdRes.error };
    const initialCmd = cmdRes.command!;

    // Pipeline `>>`
    if (this.current().kind.type === 'PIPELINE_ARROW') {
      const steps: CommandNode[] = [initialCmd];
      while (this.current().kind.type === 'PIPELINE_ARROW') {
        this.advance(); // consume `>>`
        this.skipNewlines();
        const nextCmd = this.parseCommand();
        if (nextCmd.error) return { error: nextCmd.error };
        steps.push(nextCmd.command!);
      }
      return { statement: { type: 'Pipeline', pipeline: { steps } } };
    }

    // Paralelo `|`
    if (this.current().kind.type === 'PIPE') {
      const branches: CommandNode[] = [initialCmd];
      while (this.current().kind.type === 'PIPE') {
        this.advance(); // consume `|`
        this.skipNewlines();
        const nextCmd = this.parseCommand();
        if (nextCmd.error) return { error: nextCmd.error };
        branches.push(nextCmd.command!);
      }
      return { statement: { type: 'Parallel', parallel: { branches } } };
    }

    return { statement: { type: 'Command', command: initialCmd } };
  }

  private parseCommand(): { command?: CommandNode; error?: KScriptError } {
    const token = this.current();
    if (token.kind.type !== 'IDENTIFIER') {
      return {
        error: {
          code: 'E001_UNEXPECTED_TOKEN',
          message: `Se esperaba un verbo canónico, se encontró '${token.raw}'`,
          line: token.line,
          column: token.column,
        },
      };
    }

    const verbName = token.kind.value;
    if (!findVerb(verbName)) {
      const suggestion = suggestVerb(verbName);
      return {
        error: {
          code: 'E002_UNKNOWN_VERB',
          message: `Verbo desconocido '${verbName}'`,
          line: token.line,
          column: token.column,
          suggestion: suggestion ? `¿Quisiste decir '${suggestion}'?` : undefined,
        },
      };
    }
    this.advance();

    // Esperar `:`
    if (this.current().kind.type !== 'COLON') {
      return {
        error: {
          code: 'E007_EXPECTED_COLON',
          message: `Se esperaba ':' después del verbo '${verbName}', se encontró '${this.current().raw}'`,
          line: this.current().line,
          column: this.current().column,
        },
      };
    }
    this.advance(); // consume `:`

    // Modificador opcional (`~`, `!`, `@`)
    let modifier: ModifierNode | undefined = undefined;
    if (['TILDE', 'EXCLAMATION', 'AT'].includes(this.current().kind.type)) {
      const modTok = this.advance();
      modifier = {
        symbol: modTok.raw,
        description: modTok.raw === '~' 
          ? 'Incertidumbre controlada / Aproximación difusa' 
          : modTok.raw === '!' 
          ? 'Prioridad armónica / Afirmación inmediata' 
          : 'Sincronía cuántica entrelazada',
      };
    }

    // Sujeto
    const subjTok = this.current();
    if (subjTok.kind.type !== 'IDENTIFIER') {
      return {
        error: {
          code: 'E001_UNEXPECTED_TOKEN',
          message: `Se esperaba un sujeto después de ':', se encontró '${subjTok.raw}'`,
          line: subjTok.line,
          column: subjTok.column,
        },
      };
    }

    const subjectName = subjTok.kind.value;
    if (!findSubject(subjectName)) {
      const suggestion = suggestSubject(subjectName);
      return {
        error: {
          code: 'E003_UNKNOWN_SUBJECT',
          message: `Sujeto desconocido '${subjectName}'`,
          line: subjTok.line,
          column: subjTok.column,
          suggestion: suggestion ? `¿Quisiste decir '${suggestion}'?` : undefined,
        },
      };
    }
    this.advance();

    // Parámetros `[...]`
    const params: ParamNode[] = [];
    if (this.current().kind.type === 'BRACKET_OPEN') {
      this.advance(); // consume `[`
      const pRes = this.parseParamList();
      if (pRes.error) return { error: pRes.error };
      params.push(...pRes.params);

      if (this.current().kind.type !== 'BRACKET_CLOSE') {
        return {
          error: {
            code: 'E004_UNBALANCED_BRACKETS',
            message: "Se esperaba ']' para cerrar los parámetros",
            line: this.current().line,
            column: this.current().column,
          },
        };
      }
      this.advance(); // consume `]`
    }

    return {
      command: {
        verb: verbName,
        subject: subjectName,
        modifier,
        params,
        line: token.line,
        column: token.column,
      },
    };
  }

  private parseParamList(): { params: ParamNode[]; error?: KScriptError } {
    const params: ParamNode[] = [];

    while (this.current().kind.type !== 'BRACKET_CLOSE' && this.current().kind.type !== 'EOF') {
      const tok = this.current();

      if (tok.kind.type === 'FREQUENCY') {
        this.advance();
        params.push({
          key: 'frecuencia',
          value: { type: 'Frequency', value: tok.kind.value },
        });
      } else if (tok.kind.type === 'IDENTIFIER') {
        const keyName = tok.kind.value;
        this.advance();

        if (this.current().kind.type === 'COLON') {
          this.advance(); // consume `:`
          const valTok = this.current();
          let value: ValueNode;

          if (valTok.kind.type === 'NUMBER') {
            this.advance();
            value = { type: 'Number', value: valTok.kind.value };
          } else if (valTok.kind.type === 'FREQUENCY') {
            this.advance();
            value = { type: 'Frequency', value: valTok.kind.value };
          } else if (valTok.kind.type === 'STRING_LITERAL') {
            this.advance();
            value = { type: 'Text', value: valTok.kind.value };
          } else if (valTok.kind.type === 'IDENTIFIER') {
            this.advance();
            if (valTok.kind.value === 'true' || valTok.kind.value === 'verdadero') {
              value = { type: 'Boolean', value: true };
            } else if (valTok.kind.value === 'false' || valTok.kind.value === 'falso') {
              value = { type: 'Boolean', value: false };
            } else {
              value = { type: 'Identifier', value: valTok.kind.value };
            }
          } else {
            return {
              params: [],
              error: {
                code: 'E005_INVALID_PARAM',
                message: `Valor no válido para el parámetro '${keyName}'`,
                line: valTok.line,
                column: valTok.column,
              },
            };
          }
          params.push({ key: keyName, value });
        } else {
          params.push({
            key: 'arg',
            value: { type: 'Identifier', value: keyName },
          });
        }
      } else if (tok.kind.type === 'STRING_LITERAL') {
        this.advance();
        params.push({
          key: 'descripcion',
          value: { type: 'Text', value: tok.kind.value },
        });
      } else {
        return {
          params: [],
          error: {
            code: 'E005_INVALID_PARAM',
            message: `Parámetro inesperado '${tok.raw}'`,
            line: tok.line,
            column: tok.column,
          },
        };
      }

      if (this.current().kind.type === 'COMMA') {
        this.advance();
      } else {
        break;
      }
    }

    return { params };
  }
}
