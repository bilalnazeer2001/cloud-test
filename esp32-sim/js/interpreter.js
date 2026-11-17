/*
 * ESP32 Practice Bench - interpreter for a simplified Arduino-style language.
 *
 * Pipeline:  source text -> lex() -> Parser -> analyse() -> Runtime
 *
 * The Runtime is written with JavaScript generators so that delay() can pause
 * the learner's program without freezing the browser. Time is virtual: every
 * statement costs a few microseconds and delay() jumps the clock forward, so
 * the same program can run in real time (on screen) or instantly (in lesson
 * checks).
 */
(function (root) {
  'use strict';
  const Sim = (root.ESP32Sim = root.ESP32Sim || {});

  class SimError extends Error {
    constructor(message, line, kind) {
      super(message);
      this.line = line == null ? null : line;
      this.kind = kind || 'syntax';
    }
  }

  // ------------------------------------------------------------------ lexer
  const OPS = ['<<=', '>>=', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=',
    '<=', '>=', '&&', '||', '<<', '>>', '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|',
    '^', '?', ':', ';', ',', '.', '(', ')', '{', '}', '[', ']'];
  const ESCAPES = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' };
  const isDigit = (c) => c >= '0' && c <= '9';
  const isIdStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  const isIdChar = (c) => isIdStart(c) || isDigit(c);

  function lex(src, macros) {
    macros = macros || new Map();
    const toks = [];
    const n = src.length;
    let i = 0;
    let line = 1;
    const fail = (m) => { throw new SimError(m, line, 'syntax'); };

    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const start = line;
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        if (i >= n) throw new SimError('This /* comment is never closed with */', start, 'syntax');
        i += 2;
        continue;
      }
      if (c === '#') {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        const text = src.slice(i, j).replace(/\/\/.*$/, '').trim();
        i = j;
        const m = /^#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/.exec(text);
        if (m) {
          const sub = lex(m[2], macros);
          sub.pop();
          macros.set(m[1], sub);
        } else if (!/^#\s*(include|define\s+[A-Za-z_]\w*$)/.test(text)) {
          fail('Lines starting with # must look like:  #define NAME value');
        }
        continue;
      }
      if (isDigit(c) || (c === '.' && isDigit(src[i + 1] || ''))) {
        let j = i;
        let f = false;
        let v;
        if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
          j = i + 2;
          while (/[0-9a-fA-F]/.test(src[j] || '')) j++;
          v = parseInt(src.slice(i + 2, j), 16);
        } else if (c === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
          j = i + 2;
          while (src[j] === '0' || src[j] === '1') j++;
          v = parseInt(src.slice(i + 2, j), 2);
        } else {
          while (isDigit(src[j] || '')) j++;
          if (src[j] === '.') { f = true; j++; while (isDigit(src[j] || '')) j++; }
          if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) {
            f = true; j += 2;
            while (isDigit(src[j] || '')) j++;
          }
          v = parseFloat(src.slice(i, j));
          while (/[uUlLfF]/.test(src[j] || '')) { if (src[j] === 'f' || src[j] === 'F') f = true; j++; }
        }
        if (v !== v || isIdChar(src[j] || '')) fail("This number doesn't look right: " + src.slice(i, j + 1));
        toks.push({ t: 'num', v, f, line });
        i = j;
        continue;
      }
      if (isIdStart(c)) {
        let j = i + 1;
        while (j < n && isIdChar(src[j])) j++;
        const word = src.slice(i, j);
        i = j;
        if (word === 'true') toks.push({ t: 'num', v: 1, f: false, line });
        else if (word === 'false') toks.push({ t: 'num', v: 0, f: false, line });
        else if (macros.has(word)) for (const mt of macros.get(word)) toks.push(Object.assign({}, mt, { line }));
        else toks.push({ t: 'id', v: word, line });
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        let s = '';
        while (j < n && src[j] !== c) {
          if (src[j] === '\n') break;
          if (src[j] === '\\') {
            const e = src[j + 1];
            s += Object.prototype.hasOwnProperty.call(ESCAPES, e) ? ESCAPES[e] : e;
            j += 2;
          } else s += src[j++];
        }
        if (src[j] !== c) fail(c === '"' ? 'This text is missing its closing " quote.' : "This character is missing its closing ' quote.");
        i = j + 1;
        if (c === '"') toks.push({ t: 'str', v: s, line });
        else {
          if (s.length !== 1) fail("Single quotes hold exactly one character, like 'A'. Use double quotes for text.");
          toks.push({ t: 'chr', v: s.charCodeAt(0), line });
        }
        continue;
      }
      let matched = null;
      for (const op of OPS) if (src.startsWith(op, i)) { matched = op; break; }
      if (!matched) fail("I don't understand the character '" + c + "' here.");
      toks.push({ t: 'op', v: matched, line });
      i += matched.length;
    }
    toks.push({ t: 'eof', v: 'end of code', line });
    return toks;
  }

  // ----------------------------------------------------------------- parser
  const TYPE_WORDS = new Set(['void', 'int', 'long', 'short', 'unsigned', 'signed', 'float', 'double',
    'bool', 'boolean', 'byte', 'char', 'String', 'const', 'static', 'volatile', 'uint8_t', 'uint16_t',
    'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'size_t', 'word']);
  const KEYWORDS = ['if', 'else', 'while', 'do', 'for', 'return', 'break', 'continue', 'switch', 'case', 'default'];
  const BIN_PREC = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
  };
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);

  class Parser {
    constructor(toks) { this.toks = toks; this.p = 0; }
    get tok() { return this.toks[this.p]; }
    get prevLine() { return this.p > 0 ? this.toks[this.p - 1].line : 1; }
    next() { return this.toks[this.p++]; }
    isOp(v) { const t = this.tok; return t.t === 'op' && t.v === v; }
    isWord(v) { const t = this.tok; return t.t === 'id' && t.v === v; }
    eatOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
    eatWord(v) { if (this.isWord(v)) { this.p++; return true; } return false; }
    describe(t) {
      if (t.t === 'eof') return 'the end of the code';
      if (t.t === 'str') return 'the text "' + t.v + '"';
      return "'" + (t.t === 'chr' ? String.fromCharCode(t.v) : t.v) + "'";
    }
    fail(msg, line) { throw new SimError(msg, line == null ? this.tok.line : line, 'syntax'); }
    expectOp(v, where) {
      if (this.eatOp(v)) return;
      const t = this.tok;
      if (v === ';') this.fail("Missing ';' at the end of this line.", this.prevLine);
      if (t.t === 'eof') this.fail("The code ended too early. Expected '" + v + "'" + (where ? ' ' + where : '') + ". Is a closing } or ) missing?", this.prevLine);
      this.fail("Expected '" + v + "'" + (where ? ' ' + where : '') + ' but found ' + this.describe(t) + '.');
    }
    expectId(what) {
      const t = this.tok;
      if (t.t !== 'id' || TYPE_WORDS.has(t.v) || KEYWORDS.includes(t.v)) this.fail('Expected ' + what + ' but found ' + this.describe(t) + '.');
      this.p++;
      return t;
    }
    isTypeStart() { const t = this.tok; return t.t === 'id' && TYPE_WORDS.has(t.v); }

    parseType() {
      let isConst = false, isStatic = false, unsigned = false, base = null;
      while (this.isTypeStart()) {
        const w = this.next().v;
        if (w === 'const') isConst = true;
        else if (w === 'static') isStatic = true;
        else if (w === 'volatile' || w === 'signed') { /* ignored */ }
        else if (w === 'unsigned') unsigned = true;
        else if (base && w === 'int' && (base === 'long' || base === 'short')) { /* long int */ }
        else if (base === 'long' && w === 'long') { /* long long */ }
        else if (base) this.fail("Two types in a row ('" + base + "' and '" + w + "'). Is a ; or a variable name missing?", this.prevLine);
        else base = w;
      }
      if (!base) base = 'int';
      let kind;
      switch (base) {
        case 'int': case 'long': case 'int32_t': kind = unsigned ? 'uint' : 'int'; break;
        case 'uint32_t': case 'size_t': kind = 'uint'; break;
        case 'short': case 'int16_t': kind = unsigned ? 'ushort' : 'short'; break;
        case 'uint16_t': case 'word': kind = 'ushort'; break;
        case 'byte': case 'uint8_t': kind = 'byte'; break;
        case 'char': case 'int8_t': kind = unsigned ? 'byte' : 'char'; break;
        case 'float': case 'double': kind = 'float'; break;
        case 'bool': case 'boolean': kind = 'bool'; break;
        default: kind = base; // String, void
      }
      while (this.isOp('*')) {
        if (kind !== 'char') this.fail("Pointers (*) aren't supported in this simulator.");
        this.p++;
        kind = 'String';
      }
      return { kind, isConst, isStatic };
    }

    parseProgram() {
      const globals = [];
      const fns = [];
      while (this.tok.t !== 'eof') {
        if (!this.isTypeStart()) {
          this.fail('Expected a variable or a function here (for example  int x = 0;  or  void setup() { }). ' +
            'Commands such as digitalWrite(...) must be inside setup() or loop(). Found ' + this.describe(this.tok) + '.');
        }
        const line = this.tok.line;
        const type = this.parseType();
        const name = this.expectId('a name after the type');
        if (this.isOp('(')) fns.push(this.parseFunction(type, name));
        else {
          if (type.kind === 'void') this.fail("A variable can't be 'void'. Did you mean to write a function, like void " + name.v + '() { } ?', line);
          globals.push(this.parseDeclRest(type, name, line));
        }
      }
      return { globals, fns };
    }

    parseFunction(type, nameTok) {
      this.expectOp('(');
      const params = [];
      if (!this.isOp(')')) {
        if (this.isWord('void') && this.toks[this.p + 1].t === 'op' && this.toks[this.p + 1].v === ')') this.p++;
        else {
          do {
            if (!this.isTypeStart()) this.fail('Each function input needs a type and a name, like (int pin). Found ' + this.describe(this.tok) + '.');
            const pt = this.parseType();
            const pn = this.expectId('a name for this input');
            let arr = false;
            if (this.eatOp('[')) { this.expectOp(']'); arr = true; }
            params.push({ name: pn.v, kind: pt.kind, arr });
          } while (this.eatOp(','));
        }
      }
      this.expectOp(')', 'after the function inputs');
      if (!this.isOp('{')) this.fail("Expected '{' to start the body of " + nameTok.v + '().', this.prevLine);
      const body = this.parseBlock();
      return { name: nameTok.v, ret: type.kind, params, body, line: nameTok.line, blk: false };
    }

    parseDeclRest(type, nameTok, line) {
      const decls = [];
      for (;;) {
        const d = { name: nameTok.v, kind: type.kind, isConst: type.isConst, isStatic: type.isStatic, arr: false, size: null, init: null, initList: null, line: nameTok.line };
        if (this.eatOp('[')) {
          d.arr = true;
          if (!this.isOp(']')) d.size = this.parseExpr();
          this.expectOp(']', 'after the array size');
        }
        if (this.eatOp('=')) {
          if (this.isOp('{')) {
            if (!d.arr) this.fail("A list in { } needs an array. Add [] after the name:  " + d.name + '[] = { ... };');
            this.p++;
            d.initList = [];
            if (!this.isOp('}')) do { d.initList.push(this.parseAssign()); } while (this.eatOp(',') && !this.isOp('}'));
            this.expectOp('}', 'to close the list');
          } else d.init = this.parseAssign();
        }
        if (d.arr && d.kind === 'char' && d.init && d.init.k === 'str') { d.kind = 'String'; d.arr = false; }
        if (d.arr && d.init) this.fail('Give an array its values as a list:  ' + d.name + '[] = {1, 2, 3};', d.line);
        if (d.arr && !d.size && !d.initList) this.fail("The array '" + d.name + "' needs a size, like " + d.name + '[4], or a list of values.', d.line);
        decls.push(d);
        if (!this.eatOp(',')) break;
        nameTok = this.expectId('another variable name');
      }
      this.expectOp(';');
      return { k: 'decl', decls, line };
    }

    parseBlock() {
      const line = this.tok.line;
      this.expectOp('{');
      const body = [];
      while (!this.isOp('}')) {
        if (this.tok.t === 'eof') this.fail("A '{' opened on line " + line + " is never closed with '}'.", line);
        body.push(this.parseStatement());
      }
      this.p++;
      return { k: 'block', body, line };
    }

    parseStatement() {
      const t = this.tok;
      const line = t.line;
      if (t.t === 'op') {
        if (t.v === '{') return this.parseBlock();
        if (t.v === ';') { this.p++; return { k: 'empty', line }; }
      }
      if (t.t === 'id') {
        const nx = this.toks[this.p + 1];
        if (TYPE_WORDS.has(t.v) && !(nx.t === 'op' && nx.v === '(')) {
          const type = this.parseType();
          if (type.kind === 'void') this.fail("A function can't start inside another function. Is a closing } missing above this line?", line);
          return this.parseDeclRest(type, this.expectId('a variable name'), line);
        }
        switch (t.v) {
          case 'if': {
            this.p++;
            this.expectOp('(', "after 'if'");
            const c = this.parseExpr();
            this.expectOp(')', 'to close the if condition');
            const a = this.parseStatement();
            const b = this.eatWord('else') ? this.parseStatement() : null;
            return { k: 'if', c, a, b, line };
          }
          case 'else': this.fail("This 'else' has no matching 'if' before it. Check for an extra ; or a missing }.");
          // falls through (fail throws)
          case 'while': {
            this.p++;
            this.expectOp('(', "after 'while'");
            const c = this.parseExpr();
            this.expectOp(')', 'to close the while condition');
            return { k: 'while', c, body: this.parseStatement(), line };
          }
          case 'do': {
            this.p++;
            const body = this.parseStatement();
            if (!this.eatWord('while')) this.fail("Expected 'while' after the do { } block.");
            this.expectOp('(', "after 'while'");
            const c = this.parseExpr();
            this.expectOp(')');
            this.expectOp(';');
            return { k: 'do', c, body, line };
          }
          case 'for': {
            this.p++;
            this.expectOp('(', "after 'for'");
            let init = null;
            if (this.isTypeStart()) init = this.parseDeclRest(this.parseType(), this.expectId('a variable name'), line);
            else { init = this.isOp(';') ? null : this.parseExprList(); this.expectOp(';'); }
            const c = this.isOp(';') ? null : this.parseExpr();
            if (!this.eatOp(';')) this.fail("A for loop needs three parts separated by ';' like  for (int i = 0; i < 5; i++)");
            const update = this.isOp(')') ? null : this.parseExprList();
            this.expectOp(')', 'to close the for loop');
            return { k: 'for', init, c, update, body: this.parseStatement(), line };
          }
          case 'return': {
            this.p++;
            const e = this.isOp(';') ? null : this.parseExpr();
            this.expectOp(';');
            return { k: 'return', e, line };
          }
          case 'break': this.p++; this.expectOp(';'); return { k: 'break', line };
          case 'continue': this.p++; this.expectOp(';'); return { k: 'continue', line };
          case 'switch': return this.parseSwitch();
          default:
        }
      }
      const e = this.parseExpr();
      this.expectOp(';');
      return { k: 'expr', e, line };
    }

    parseSwitch() {
      const line = this.next().line;
      this.expectOp('(', "after 'switch'");
      const disc = this.parseExpr();
      this.expectOp(')');
      this.expectOp('{', 'to start the switch');
      const cases = [];
      while (!this.isOp('}')) {
        let test = null;
        if (this.eatWord('case')) test = this.parseExpr();
        else if (!this.eatWord('default')) this.fail("Inside a switch, each part must start with 'case' or 'default'.");
        this.expectOp(':', 'after the case value');
        const body = [];
        while (!this.isOp('}') && !this.isWord('case') && !this.isWord('default')) {
          if (this.tok.t === 'eof') this.fail('This switch is never closed with }.', line);
          body.push(this.parseStatement());
        }
        cases.push({ test, body });
      }
      this.p++;
      return { k: 'switch', disc, cases, line };
    }

    parseExprList() {
      const list = [this.parseExpr()];
      while (this.eatOp(',')) list.push(this.parseExpr());
      return list;
    }
    parseExpr() { return this.parseAssign(); }

    parseAssign() {
      const left = this.parseTernary();
      const t = this.tok;
      if (t.t === 'op' && ASSIGN_OPS.has(t.v)) {
        if (left.k !== 'id' && left.k !== 'index') this.fail("The left side of '" + t.v + "' must be a variable.");
        this.p++;
        return { k: 'assign', op: t.v, target: left, value: this.parseAssign(), line: t.line };
      }
      return left;
    }
    parseTernary() {
      const c = this.parseBinary(1);
      if (!this.isOp('?')) return c;
      const line = this.next().line;
      const a = this.parseAssign();
      this.expectOp(':', 'in the ? : choice');
      return { k: 'tern', c, a, b: this.parseAssign(), line };
    }
    parseBinary(minPrec) {
      let left = this.parseUnary();
      for (;;) {
        const t = this.tok;
        const prec = t.t === 'op' ? BIN_PREC[t.v] : undefined;
        if (!prec || prec < minPrec) return left;
        this.p++;
        const right = this.parseBinary(prec + 1);
        left = { k: t.v === '&&' || t.v === '||' ? 'logic' : 'bin', op: t.v, l: left, r: right, line: t.line };
      }
    }
    parseUnary() {
      const t = this.tok;
      if (t.t === 'op') {
        if (t.v === '!' || t.v === '-' || t.v === '+' || t.v === '~') {
          this.p++;
          return { k: 'un', op: t.v, e: this.parseUnary(), line: t.line };
        }
        if (t.v === '++' || t.v === '--') {
          this.p++;
          const target = this.parseUnary();
          if (target.k !== 'id' && target.k !== 'index') this.fail("'" + t.v + "' needs a variable.", t.line);
          return { k: 'upd', op: t.v, prefix: true, target, line: t.line };
        }
        if (t.v === '(') {
          const nx = this.toks[this.p + 1];
          if (nx.t === 'id' && TYPE_WORDS.has(nx.v)) {
            this.p++;
            const type = this.parseType();
            this.expectOp(')', 'after the type');
            return { k: 'cast', kind: type.kind, e: this.parseUnary(), e2: null, line: t.line };
          }
        }
      }
      return this.parsePostfix();
    }
    parsePostfix() {
      let e = this.parsePrimary();
      for (;;) {
        const t = this.tok;
        if (t.t !== 'op') return e;
        if (t.v === '[') {
          this.p++;
          const idx = this.parseExpr();
          this.expectOp(']', 'after the index');
          e = { k: 'index', obj: e, idx, line: t.line };
        } else if (t.v === '.') {
          this.p++;
          const m = this.tok;
          if (m.t !== 'id') this.fail("Expected a name after '.'");
          this.p++;
          if (!this.isOp('(')) this.fail("'." + m.v + "' needs brackets: ." + m.v + '()', m.line);
          e = { k: 'mcall', obj: e, method: m.v, args: this.parseArgs(), line: m.line };
        } else if (t.v === '++' || t.v === '--') {
          if (e.k !== 'id' && e.k !== 'index') this.fail("'" + t.v + "' needs a variable.");
          this.p++;
          e = { k: 'upd', op: t.v, prefix: false, target: e, line: t.line };
        } else return e;
      }
    }
    parseArgs() {
      this.expectOp('(');
      const args = [];
      if (!this.isOp(')')) do { args.push(this.parseAssign()); } while (this.eatOp(','));
      this.expectOp(')', 'to close the brackets');
      return args;
    }
    parsePrimary() {
      const t = this.next();
      switch (t.t) {
        case 'num': return { k: 'num', v: t.v, f: t.f, line: t.line };
        case 'str': {
          let v = t.v;
          while (this.tok.t === 'str') v += this.next().v;
          return { k: 'str', v, line: t.line };
        }
        case 'chr': return { k: 'chr', v: t.v, line: t.line };
        case 'id':
          if (TYPE_WORDS.has(t.v)) {
            this.p--;
            const type = this.parseType();
            if (!this.isOp('(')) this.fail("Unexpected type '" + t.v + "' here.", t.line);
            const args = this.parseArgs();
            if (args.length < 1 || args.length > 2) this.fail(t.v + '(...) needs one value inside the brackets.', t.line);
            return { k: 'cast', kind: type.kind, e: args[0], e2: args[1] || null, line: t.line };
          }
          if (KEYWORDS.includes(t.v)) { this.p--; this.fail("'" + t.v + "' can't be used here. Is a ; or a } missing just before it?"); }
          if (this.isOp('(')) return { k: 'call', name: t.v, args: this.parseArgs(), fn: null, line: t.line };
          return { k: 'id', name: t.v, line: t.line };
        case 'op':
          if (t.v === '(') {
            const e = this.parseExpr();
            this.expectOp(')', 'to close the bracket');
            return e;
          }
          break;
        default:
      }
      this.p--;
      if (t.t === 'eof') this.fail('The code ended too early. Is a closing } or ; missing?', this.prevLine);
      this.fail('Unexpected ' + this.describe(t) + ' here.');
      return null;
    }
  }

  // --------------------------------------------------------------- builtins
  const CONSTS = { HIGH: 1, LOW: 0, INPUT: 1, OUTPUT: 3, INPUT_PULLUP: 5, INPUT_PULLDOWN: 9, LED_BUILTIN: 2, DEC: 10, HEX: 16, OCT: 8, BIN: 2 };
  const FLOAT_CONSTS = { PI: Math.PI };
  const anyF = (fl) => fl.some(Boolean);
  // n: [min, max] argument count, use: shown in error messages, f: result is a decimal number?
  const BUILTINS = {
    pinMode: { n: [2, 2], use: 'pinMode(pin, mode)', fn: (rt, a) => { rt.board.pinMode(a[0], a[1], rt.now); return 0; } },
    digitalWrite: { n: [2, 2], use: 'digitalWrite(pin, HIGH or LOW)', fn: (rt, a) => { rt.board.digitalWrite(a[0], a[1], rt.now); return 0; } },
    digitalRead: { n: [1, 1], use: 'digitalRead(pin)', fn: (rt, a) => rt.board.digitalRead(a[0], rt.now) },
    analogRead: { n: [1, 1], use: 'analogRead(pin)', fn: (rt, a) => rt.board.analogRead(a[0], rt.now) },
    analogWrite: { n: [2, 2], use: 'analogWrite(pin, 0 to 255)', fn: (rt, a) => { rt.board.analogWrite(a[0], a[1], rt.now); return 0; } },
    tone: { n: [2, 3], use: 'tone(pin, frequency) or tone(pin, frequency, milliseconds)', fn: (rt, a) => { rt.board.tone(a[0], a[1], rt.now, a.length > 2 ? a[2] : null); return 0; } },
    noTone: { n: [1, 1], use: 'noTone(pin)', fn: (rt, a) => { rt.board.noTone(a[0], rt.now); return 0; } },
    delay: { n: [1, 1], use: 'delay(milliseconds)' },
    delayMicroseconds: { n: [1, 1], use: 'delayMicroseconds(microseconds)' },
    millis: { n: [0, 0], use: 'millis()', fn: (rt) => Math.floor(rt.now / 1000) },
    micros: { n: [0, 0], use: 'micros()', fn: (rt) => Math.floor(rt.now) },
    map: {
      n: [5, 5], use: 'map(value, fromLow, fromHigh, toLow, toHigh)',
      fn: (rt, a) => {
        const v = a.map(Math.trunc);
        if (v[2] === v[1]) throw rt.err("map() can't work when fromLow and fromHigh are the same number.");
        return Math.trunc((v[0] - v[1]) * (v[4] - v[3]) / (v[2] - v[1])) + v[3];
      },
    },
    constrain: { n: [3, 3], use: 'constrain(value, low, high)', f: 'any', fn: (rt, a) => Math.min(Math.max(a[0], a[1]), a[2]) },
    min: { n: [2, 2], use: 'min(a, b)', f: 'any', fn: (rt, a) => Math.min(a[0], a[1]) },
    max: { n: [2, 2], use: 'max(a, b)', f: 'any', fn: (rt, a) => Math.max(a[0], a[1]) },
    abs: { n: [1, 1], use: 'abs(value)', f: 'any', fn: (rt, a) => Math.abs(a[0]) },
    sq: { n: [1, 1], use: 'sq(value)', f: 'any', fn: (rt, a) => a[0] * a[0] },
    sqrt: { n: [1, 1], use: 'sqrt(value)', f: true, fn: (rt, a) => Math.sqrt(a[0]) },
    pow: { n: [2, 2], use: 'pow(base, exponent)', f: true, fn: (rt, a) => Math.pow(a[0], a[1]) },
    sin: { n: [1, 1], use: 'sin(angle)', f: true, fn: (rt, a) => Math.sin(a[0]) },
    cos: { n: [1, 1], use: 'cos(angle)', f: true, fn: (rt, a) => Math.cos(a[0]) },
    tan: { n: [1, 1], use: 'tan(angle)', f: true, fn: (rt, a) => Math.tan(a[0]) },
    floor: { n: [1, 1], use: 'floor(value)', f: true, fn: (rt, a) => Math.floor(a[0]) },
    ceil: { n: [1, 1], use: 'ceil(value)', f: true, fn: (rt, a) => Math.ceil(a[0]) },
    round: { n: [1, 1], use: 'round(value)', fn: (rt, a) => (a[0] < 0 ? -Math.round(-a[0]) : Math.round(a[0])) },
    random: {
      n: [1, 2], use: 'random(max) or random(min, max)',
      fn: (rt, a) => {
        const lo = a.length === 2 ? Math.trunc(a[0]) : 0;
        const hi = Math.trunc(a[a.length - 1]);
        return hi <= lo ? lo : lo + Math.floor(rt.rand() * (hi - lo));
      },
    },
    randomSeed: { n: [1, 1], use: 'randomSeed(number)', fn: () => 0 },
    analogReadResolution: { n: [1, 1], use: 'analogReadResolution(bits)', fn: () => 0 },
  };
  const SERIAL_METHODS = ['begin', 'print', 'println', 'printf', 'write', 'available', 'read', 'peek', 'parseInt', 'parseFloat', 'readString', 'readStringUntil', 'flush', 'end'];
  const STRING_METHODS = ['length', 'toInt', 'toFloat', 'trim', 'toUpperCase', 'toLowerCase', 'charAt', 'indexOf', 'substring', 'equals', 'startsWith', 'endsWith', 'concat'];

  function suggest(name, candidates) {
    const low = name.toLowerCase();
    for (const c of candidates) if (c.toLowerCase() === low) return c;
    for (const c of candidates) {
      if (Math.abs(c.length - name.length) > 1) continue;
      // one-character slip (typo, missing or extra letter)
      const a = c.toLowerCase();
      let i = 0;
      while (i < a.length && i < low.length && a[i] === low[i]) i++;
      let j = 0;
      while (j < a.length - i && j < low.length - i && a[a.length - 1 - j] === low[low.length - 1 - j]) j++;
      if (Math.max(a.length, low.length) - i - j <= 1) return c;
    }
    return null;
  }

  // --------------------------------------------------------------- analysis
  function walk(n, visit) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) walk(x, visit); return; }
    if (n.k) visit(n);
    for (const key in n) {
      if (key === 'fn') continue;
      const v = n[key];
      if (v && typeof v === 'object') walk(v, visit);
    }
  }
  function markBlocking(n) {
    if (!n || typeof n !== 'object') return false;
    let b = false;
    if (Array.isArray(n)) { for (const x of n) if (markBlocking(x)) b = true; return b; }
    for (const key in n) {
      if (key === 'fn') continue;
      const v = n[key];
      if (v && typeof v === 'object' && markBlocking(v)) b = true;
    }
    if (n.k === 'call' && (n.name === 'delay' || n.name === 'delayMicroseconds' || (n.fn && n.fn.blk))) b = true;
    if (n.k) n.blk = b;
    return b;
  }

  function compile(src) {
    const parsed = new Parser(lex(String(src))).parseProgram();
    const fns = new Map();
    for (const fn of parsed.fns) {
      if (fns.has(fn.name)) throw new SimError('The function ' + fn.name + '() is written twice. Keep only one.', fn.line);
      if (BUILTINS[fn.name]) throw new SimError(fn.name + '() already exists in Arduino. Pick a different name for your function.', fn.line);
      fns.set(fn.name, fn);
    }
    for (const need of ['setup', 'loop']) {
      if (!fns.has(need)) {
        const near = suggest(need, [...fns.keys()]);
        throw new SimError('Every sketch needs a  void ' + need + '() { }  function.' + (near ? ' (You wrote ' + near + '() - check the spelling.)' : ''), near ? fns.get(near).line : 1);
      }
      if (fns.get(need).params.length) throw new SimError(need + '() must not take any inputs: void ' + need + '()', fns.get(need).line);
    }

    const calls = new Set();
    const kinds = new Set();
    const known = Object.keys(BUILTINS).concat([...fns.keys()]);
    const check = (n) => {
      kinds.add(n.k);
      if (n.k === 'call') {
        calls.add(n.name);
        const fn = fns.get(n.name);
        const bi = BUILTINS[n.name];
        if (fn) {
          n.fn = fn;
          if (n.args.length !== fn.params.length) {
            throw new SimError(fn.name + '() needs ' + fn.params.length + ' value' + (fn.params.length === 1 ? '' : 's') + ' in the brackets, but got ' + n.args.length + '.', n.line);
          }
        } else if (bi) {
          if (n.args.length < bi.n[0] || n.args.length > bi.n[1]) {
            throw new SimError(n.name + '() got ' + n.args.length + ' value' + (n.args.length === 1 ? '' : 's') + ' in the brackets. Write it like this:  ' + bi.use, n.line);
          }
          const second = n.args[1];
          if (n.name === 'pinMode' && second.k === 'id' && (second.name === 'HIGH' || second.name === 'LOW')) {
            throw new SimError('pinMode() sets the direction of a pin: use INPUT, OUTPUT or INPUT_PULLUP. To switch a pin on, use digitalWrite(pin, HIGH).', n.line);
          }
          if (n.name === 'digitalWrite' && second.k === 'id' && /^(INPUT|OUTPUT)/.test(second.name)) {
            throw new SimError('digitalWrite() needs HIGH or LOW. To set the direction of a pin, use pinMode(pin, ' + second.name + ').', n.line);
          }
        } else {
          const near = suggest(n.name, known);
          throw new SimError("I don't know a function called " + n.name + '().' + (near ? ' Did you mean ' + near + '()? Capital letters matter.' : ''), n.line);
        }
      } else if (n.k === 'mcall' && n.obj.k === 'id' && n.obj.name === 'Serial' && !SERIAL_METHODS.includes(n.method)) {
        const near = suggest(n.method, SERIAL_METHODS);
        throw new SimError("Serial." + n.method + "() doesn't exist." + (near ? ' Did you mean Serial.' + near + '()?' : ''), n.line);
      } else if (n.k === 'id' && n.name === 'serial') {
        throw new SimError("Serial needs a capital S.", n.line);
      }
    };
    walk(parsed.globals, check);
    for (const fn of parsed.fns) walk(fn.body, check);

    // A function is "blocking" if running it can take a long time (it waits or loops).
    const info = new Map();
    for (const fn of parsed.fns) {
      const d = { loops: false, calls: new Set() };
      walk(fn.body, (n) => {
        if (n.k === 'while' || n.k === 'for' || n.k === 'do') d.loops = true;
        if (n.k === 'call') d.calls.add(n.name);
      });
      fn.blk = d.loops || d.calls.has('delay') || d.calls.has('delayMicroseconds');
      info.set(fn, d);
    }
    for (let changed = true; changed;) {
      changed = false;
      for (const fn of parsed.fns) {
        if (fn.blk) continue;
        for (const name of info.get(fn).calls) if (fns.has(name) && fns.get(name).blk) { fn.blk = true; changed = true; break; }
      }
    }
    markBlocking(parsed.globals);
    for (const fn of parsed.fns) markBlocking(fn.body);

    return { globals: parsed.globals, fns, calls, kinds };
  }

  // ---------------------------------------------------------------- runtime
  const BRK = 1, CNT = 2, RET = 3;
  const truthy = (v) => (typeof v === 'string' ? v.length > 0 : v !== 0);

  function fmtFloat(v, digits) {
    if (v !== v) return 'nan';
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    return v.toFixed(Math.max(0, Math.min(10, digits == null ? 2 : Math.trunc(digits))));
  }
  function fmt(v, f) {
    if (typeof v === 'string') return v;
    if (typeof v !== 'number') return '[array]';
    return f ? fmtFloat(v, 2) : String(v);
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Scope {
    constructor(parent) { this.m = new Map(); this.p = parent; }
  }

  class Runtime {
    constructor(program, board, opts) {
      opts = opts || {};
      this.prog = program;
      this.board = board;
      this.cost = opts.cost || 20;            // virtual microseconds per statement
      this.rand = opts.rand || mulberry32(opts.seed == null ? 12345 : opts.seed);
      this.now = 0;                           // virtual time in microseconds
      this.until = 0;
      this.line = 1;
      this.f = false;                         // "last value was a decimal number" register
      this.depth = 0;
      this.retVal = 0;
      this.dead = false;
      this.statics = new Map();
      this.globals = new Scope(null);
      for (const name in CONSTS) this.globals.m.set(name, { v: CONSTS[name], ty: 'int', isConst: true, arr: false, name });
      for (const name in FLOAT_CONSTS) this.globals.m.set(name, { v: FLOAT_CONSTS[name], ty: 'float', isConst: true, arr: false, name });
      this.globals.m.set('Serial', { v: 1, ty: 'bool', isConst: true, arr: false, name: 'Serial' });
      this.gen = this.main();
    }

    err(msg) { return new SimError(msg, this.line, 'runtime'); }

    /** Run the program until the virtual clock reaches untilUs (microseconds). */
    run(untilUs) {
      if (this.dead) return;
      this.until = untilUs;
      try {
        while (this.now < untilUs) {
          if (this.gen.next().done) { this.dead = true; break; }
        }
      } catch (e) {
        this.dead = true;
        this.board.sync(this.now);
        if (e instanceof SimError) { if (e.line == null) e.line = this.line; throw e; }
        if (e instanceof RangeError) throw this.err('The program got stuck calling functions inside functions (too much recursion).');
        throw e;
      }
      this.board.sync(this.now);
    }

    *main() {
      for (const d of this.prog.globals) yield* this.exec(d, this.globals);
      yield* this.invoke(this.prog.fns.get('setup'), [], []);
      const loop = this.prog.fns.get('loop');
      for (;;) {
        yield* this.invoke(loop, [], []);
        this.now += this.cost;
        if (this.now >= this.until) yield;
      }
    }

    *wait(us) {
      if (typeof us !== 'number') throw this.err('delay() needs a number of milliseconds.');
      const wake = this.now + Math.max(0, us || 0);
      for (;;) {
        if (wake <= this.until) { if (wake > this.now) this.now = wake; return; }
        if (this.until > this.now) this.now = this.until;
        yield;
      }
    }

    *invoke(fn, args, fl) {
      if (++this.depth > 150) throw this.err(fn.name + '() keeps calling itself and never stops (too much recursion).');
      const sc = new Scope(this.globals);
      for (let i = 0; i < fn.params.length; i++) {
        const p = fn.params[i];
        if (p.arr) {
          if (!Array.isArray(args[i])) throw this.err(fn.name + '() expects an array for ' + p.name + '.');
          sc.m.set(p.name, { v: args[i], ty: p.kind, isConst: false, arr: true, name: p.name });
        } else sc.m.set(p.name, { v: this.coerce(p.kind, args[i], fl[i]), ty: p.kind, isConst: false, arr: false, name: p.name });
      }
      const sig = yield* this.execList(fn.body.body, sc);
      this.depth--;
      if (fn.ret === 'void') { this.f = false; return 0; }
      const v = this.coerce(fn.ret, sig === RET ? this.retVal : 0, sig === RET ? this.retF : false);
      this.f = fn.ret === 'float';
      return v;
    }
    callSync(fn, args, fl) {
      const g = this.invoke(fn, args, fl);
      let r = g.next();
      while (!r.done) r = g.next();
      return r.value;
    }

    // ---- statements
    *execList(list, sc) {
      for (let i = 0; i < list.length; i++) {
        const r = yield* this.exec(list[i], sc);
        if (r) return r;
      }
      return 0;
    }

    *exec(s, sc) {
      this.now += this.cost;
      if (this.now >= this.until) yield;
      this.line = s.line;
      switch (s.k) {
        case 'expr': yield* this.evG(s.e, sc); return 0;
        case 'decl': for (const d of s.decls) yield* this.declare(d, sc); return 0;
        case 'block': return yield* this.execList(s.body, new Scope(sc));
        case 'if':
          if (truthy(yield* this.evG(s.c, sc))) return yield* this.exec(s.a, new Scope(sc));
          if (s.b) return yield* this.exec(s.b, new Scope(sc));
          return 0;
        case 'while':
          while (truthy(yield* this.evG(s.c, sc))) {
            const r = yield* this.exec(s.body, new Scope(sc));
            if (r === BRK) break;
            if (r === RET) return RET;
            this.line = s.line;
          }
          return 0;
        case 'do':
          do {
            const r = yield* this.exec(s.body, new Scope(sc));
            if (r === BRK) break;
            if (r === RET) return RET;
            this.line = s.line;
          } while (truthy(yield* this.evG(s.c, sc)));
          return 0;
        case 'for': {
          const fs = new Scope(sc);
          if (s.init) {
            if (Array.isArray(s.init)) for (const e of s.init) yield* this.evG(e, fs);
            else for (const d of s.init.decls) yield* this.declare(d, fs);
          }
          while (!s.c || truthy(yield* this.evG(s.c, fs))) {
            const r = yield* this.exec(s.body, new Scope(fs));
            if (r === BRK) break;
            if (r === RET) return RET;
            this.line = s.line;
            if (s.update) for (const e of s.update) yield* this.evG(e, fs);
          }
          return 0;
        }
        case 'switch': {
          const v = yield* this.evG(s.disc, sc);
          let start = -1;
          for (let i = 0; i < s.cases.length && start < 0; i++) {
            const c = s.cases[i];
            if (c.test && this.ev(c.test, sc) === v) start = i;
          }
          if (start < 0) start = s.cases.findIndex((c) => !c.test);
          if (start < 0) return 0;
          const ss = new Scope(sc);
          for (let i = start; i < s.cases.length; i++) {
            const r = yield* this.execList(s.cases[i].body, ss);
            if (r === BRK) return 0;
            if (r) return r;
          }
          return 0;
        }
        case 'return':
          if (s.e) { this.retVal = yield* this.evG(s.e, sc); this.retF = this.f; } else { this.retVal = 0; this.retF = false; }
          return RET;
        case 'break': return BRK;
        case 'continue': return CNT;
        default: return 0;
      }
    }

    *declare(d, sc) {
      this.line = d.line;
      if (sc.m.has(d.name) && !(d.isStatic && this.statics.has(d))) {
        if (sc === this.globals && (d.name in CONSTS || d.name in FLOAT_CONSTS || d.name === 'Serial')) throw this.err("'" + d.name + "' is a built-in name. Pick a different name for your variable.");
        throw this.err("'" + d.name + "' is already declared. Remove the type the second time if you only want to change its value.");
      }
      if (d.isStatic && this.statics.has(d)) { sc.m.set(d.name, this.statics.get(d)); return; }
      const cell = { v: 0, ty: d.kind, isConst: false, arr: d.arr, name: d.name };
      const zero = d.kind === 'String' ? '' : 0;
      if (d.arr) {
        let size = d.initList ? d.initList.length : 0;
        if (d.size) {
          size = yield* this.evG(d.size, sc);
          if (typeof size !== 'number' || size < 1 || size > 10000) throw this.err("The size of the array '" + d.name + "' must be a number from 1 to 10000.");
          size = Math.trunc(size);
        }
        cell.v = new Array(size).fill(zero);
        if (d.initList) {
          if (d.initList.length > size) throw this.err("The array '" + d.name + "' has room for " + size + ' values, but the list has ' + d.initList.length + '.');
          for (let i = 0; i < d.initList.length; i++) {
            const v = yield* this.evG(d.initList[i], sc);
            cell.v[i] = this.coerce(d.kind, v, this.f);
          }
        }
      } else if (d.init) {
        const v = yield* this.evG(d.init, sc);
        cell.v = this.coerce(d.kind, v, this.f);
      } else cell.v = zero;
      cell.isConst = d.isConst;
      sc.m.set(d.name, cell);
      if (d.isStatic) this.statics.set(d, cell);
    }

    // ---- values
    coerce(kind, v, f) {
      if (kind === 'String') return typeof v === 'string' ? v : fmt(v, f);
      if (typeof v !== 'number') {
        throw this.err(typeof v === 'string'
          ? "You can't put text into a number variable. Use a String variable, or .toInt() to turn text into a number."
          : "A whole array can't be used as a single number. Pick one item, like name[0].");
      }
      if (kind === 'float') return v;
      if (kind === 'bool') return v !== 0 ? 1 : 0;
      if (v !== v || v === Infinity || v === -Infinity) return 0;
      v = Math.trunc(v);
      switch (kind) {
        case 'int': return v | 0;
        case 'uint': return v >>> 0;
        case 'byte': return v & 255;
        case 'char': return (v << 24) >> 24;
        case 'short': return (v << 16) >> 16;
        case 'ushort': return v & 65535;
        default: return v;
      }
    }

    lookup(n, sc) {
      for (let s = sc; s; s = s.p) {
        const c = s.m.get(n.name);
        if (c) return c;
      }
      this.line = n.line;
      const names = [];
      for (let s = sc; s; s = s.p) for (const k of s.m.keys()) names.push(k);
      const near = suggest(n.name, names);
      throw this.err("'" + n.name + "' is not declared." + (near ? ' Did you mean ' + near + '? Capital letters matter.' : ' Create it first, for example:  int ' + n.name + ' = 0;'));
    }

    binop(op, l, lf, r, rf) {
      if (typeof l === 'string' || typeof r === 'string') {
        const a = fmt(l, lf), b = fmt(r, rf);
        this.f = false;
        switch (op) {
          case '+': return a + b;
          case '==': return a === b ? 1 : 0;
          case '!=': return a !== b ? 1 : 0;
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          default: throw this.err("You can't use '" + op + "' with text.");
        }
      }
      if (typeof l !== 'number' || typeof r !== 'number') throw this.err("You can't do maths on a whole array. Pick one item, like name[0].");
      const f = lf || rf;
      switch (op) {
        case '+': this.f = f; return l + r;
        case '-': this.f = f; return l - r;
        case '*': this.f = f; return l * r;
        case '/':
          this.f = f;
          if (f) return l / r;
          if (r === 0) throw this.err('Division by zero. On a real ESP32 this crashes the program.');
          return Math.trunc(l / r);
        case '%':
          this.f = false;
          if (f) throw this.err("'%' (remainder) only works with whole numbers.");
          if (r === 0) throw this.err('Remainder (%) by zero. On a real ESP32 this crashes the program.');
          return l % r;
        default:
      }
      this.f = false;
      switch (op) {
        case '==': return l === r ? 1 : 0;
        case '!=': return l !== r ? 1 : 0;
        case '<': return l < r ? 1 : 0;
        case '>': return l > r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '&': return l & r;
        case '|': return l | r;
        case '^': return l ^ r;
        case '<<': return l << r;
        case '>>': return l >> r;
        default: throw this.err("Unknown operator '" + op + "'.");
      }
    }
    unop(op, v) {
      if (op === '!') { this.f = false; return truthy(v) ? 0 : 1; }
      if (typeof v !== 'number') throw this.err("'" + op + "' only works with numbers.");
      if (op === '-') return -v;
      if (op === '~') { this.f = false; return ~v; }
      return v;
    }
    cast(n, v, f, digits) {
      if (n.kind === 'String') {
        this.f = false;
        if (typeof v === 'string') return v;
        if (n.e.k === 'chr') return String.fromCharCode(v);
        return f ? fmtFloat(v, digits == null ? 2 : digits) : String(v);
      }
      if (n.kind === 'void') throw this.err("You can't convert a value to void.");
      const r = this.coerce(n.kind, v, f);
      this.f = n.kind === 'float';
      return r;
    }
    /** Find the storage for an assignment target. Returns [cell, index] (index -1 for plain variables). */
    target(t, sc, idxValue) {
      if (t.k === 'id') { this.tIdx = -1; return this.lookup(t, sc); }
      if (t.obj.k !== 'id') throw this.err('Only simple array items like name[0] can be changed.');
      const cell = this.lookup(t.obj, sc);
      if (!cell.arr) throw this.err("'" + cell.name + "' is not an array, so [ ] can't be used to change it.");
      const i = idxValue === undefined ? this.ev(t.idx, sc) : idxValue;
      this.tIdx = this.checkIndex(cell, i);
      return cell;
    }
    checkIndex(cell, i) {
      if (typeof i !== 'number' || i !== Math.trunc(i)) throw this.err('An array index must be a whole number.');
      if (i < 0 || i >= cell.v.length) {
        throw this.err('Index ' + i + " is outside the array '" + cell.name + "', which has " + cell.v.length + ' items (numbered 0 to ' + (cell.v.length - 1) + ').');
      }
      return i;
    }
    store(cell, i, v, vf) {
      if (cell.isConst) throw this.err("'" + cell.name + "' is a constant and can't be changed.");
      if (cell.arr && i < 0) throw this.err("'" + cell.name + "' is an array. Change one item at a time, like " + cell.name + '[0] = ...');
      const cv = this.coerce(cell.ty, v, vf);
      if (i >= 0) cell.v[i] = cv; else cell.v = cv;
      this.f = cell.ty === 'float';
      return cv;
    }
    assign(n, sc, v, vf) {
      const cell = this.target(n.target, sc);
      const i = this.tIdx;
      if (n.op !== '=') {
        const cur = i >= 0 ? cell.v[i] : cell.v;
        v = this.binop(n.op.slice(0, -1), cur, cell.ty === 'float', v, vf);
        vf = this.f;
      }
      return this.store(cell, i, v, vf);
    }
    indexRead(n, sc, i) {
      if (n.obj.k === 'id') {
        const cell = this.lookup(n.obj, sc);
        if (cell.arr) { const v = cell.v[this.checkIndex(cell, i)]; this.f = cell.ty === 'float'; return v; }
      }
      const o = this.ev(n.obj, sc);
      this.f = false;
      if (typeof o === 'string') return i >= 0 && i < o.length ? o.charCodeAt(i) : 0;
      throw this.err('[ ] can only be used on arrays and Strings.');
    }
    builtin(n, args, fl) {
      const b = BUILTINS[n.name];
      for (let i = 0; i < args.length; i++) {
        if (typeof args[i] !== 'number') throw this.err(n.name + '() needs numbers. Write it like this:  ' + b.use);
      }
      const v = b.fn(this, args);
      this.f = b.f === 'any' ? anyF(fl) : !!b.f;
      return v;
    }

    printable(node, v, f, sc, opt) {
      if (typeof v === 'string') return v;
      if (typeof v !== 'number') return '[array]';
      if (node.k === 'chr' || (node.k === 'id' && this.lookup(node, sc).ty === 'char')) return String.fromCharCode(v);
      if (f) return fmtFloat(v, opt == null ? 2 : opt);
      if (opt != null && opt !== 10 && opt >= 2 && opt <= 36) return (v >>> 0).toString(opt).toUpperCase();
      return String(v);
    }
    method(n, sc, args, fl) {
      const o = n.obj;
      if (o.k === 'id' && o.name === 'Serial') return this.serial(n, sc, args, fl);
      const s = this.ev(o, sc);
      if (typeof s !== 'string') throw this.err('.' + n.method + '() only works on Serial and on String variables.');
      const m = n.method;
      this.f = false;
      const setBack = (v) => {
        if (o.k !== 'id') return 0;
        this.store(this.lookup(o, sc), -1, v, false);
        this.f = false;
        return 0;
      };
      switch (m) {
        case 'length': return s.length;
        case 'toInt': { const r = parseInt(s, 10); return r !== r ? 0 : r | 0; }
        case 'toFloat': { const r = parseFloat(s); this.f = true; return r !== r ? 0 : r; }
        case 'trim': return setBack(s.trim());
        case 'toUpperCase': return setBack(s.toUpperCase());
        case 'toLowerCase': return setBack(s.toLowerCase());
        case 'concat': return setBack(s + fmt(args[0], fl[0]));
        case 'charAt': return args[0] >= 0 && args[0] < s.length ? s.charCodeAt(args[0]) : 0;
        case 'indexOf': return s.indexOf(typeof args[0] === 'number' ? String.fromCharCode(args[0]) : String(args[0]));
        case 'substring': return args.length > 1 ? s.substring(args[0], args[1]) : s.substring(args[0]);
        case 'equals': return s === fmt(args[0], fl[0]) ? 1 : 0;
        case 'startsWith': return s.startsWith(fmt(args[0], fl[0])) ? 1 : 0;
        case 'endsWith': return s.endsWith(fmt(args[0], fl[0])) ? 1 : 0;
        default: {
          const near = suggest(m, STRING_METHODS);
          throw this.err("Strings don't have ." + m + '().' + (near ? ' Did you mean .' + near + '()?' : ''));
        }
      }
    }
    serial(n, sc, args, fl) {
      const ser = this.board.serial;
      const m = n.method;
      this.f = false;
      const takeNumber = (re) => {
        const mt = re.exec(ser.inBuf);
        if (!mt) { ser.inBuf = ''; return 0; }
        ser.inBuf = ser.inBuf.slice(mt.index + mt[0].length);
        return Number(mt[0]);
      };
      switch (m) {
        case 'begin': this.board.serialBegin(args.length ? args[0] : 9600); return 0;
        case 'end': case 'flush': return 0;
        case 'print': case 'println': {
          if (args.length > 2) throw this.err('Serial.' + m + '() takes one value (and an optional format).');
          const text = args.length ? this.printable(n.args[0], args[0], fl[0], sc, args.length > 1 ? args[1] : null) : '';
          this.board.serialWrite(text + (m === 'println' ? '\n' : ''));
          return 0;
        }
        case 'write':
          this.board.serialWrite(typeof args[0] === 'number' ? String.fromCharCode(args[0]) : fmt(args[0], false));
          return 0;
        case 'printf': {
          let k = 1;
          const text = String(args[0]).replace(/%(\.(\d+))?(l?[diufsxXc%])/g, (all, _p, digits, type) => {
            if (type === '%') return '%';
            const v = args[k], vf = fl[k];
            k++;
            if (v === undefined) return all;
            switch (type[type.length - 1]) {
              case 'f': return fmtFloat(Number(v), digits == null ? 6 : Number(digits));
              case 's': return fmt(v, vf);
              case 'c': return typeof v === 'number' ? String.fromCharCode(v) : fmt(v, vf);
              case 'x': return (Math.trunc(v) >>> 0).toString(16);
              case 'X': return (Math.trunc(v) >>> 0).toString(16).toUpperCase();
              default: return typeof v === 'number' ? String(Math.trunc(v)) : fmt(v, vf);
            }
          });
          this.board.serialWrite(text);
          return 0;
        }
        case 'available': return ser.inBuf.length;
        case 'peek': return ser.inBuf.length ? ser.inBuf.charCodeAt(0) : -1;
        case 'read': {
          if (!ser.inBuf.length) return -1;
          const c = ser.inBuf.charCodeAt(0);
          ser.inBuf = ser.inBuf.slice(1);
          return c;
        }
        case 'parseInt': return Math.trunc(takeNumber(/-?\d+/));
        case 'parseFloat': this.f = true; { const v = takeNumber(/-?\d+(\.\d+)?/); this.f = true; return v; }
        case 'readString': { const s = ser.inBuf; ser.inBuf = ''; return s; }
        case 'readStringUntil': {
          const ch = typeof args[0] === 'number' ? String.fromCharCode(args[0]) : String(args[0]);
          const at = ser.inBuf.indexOf(ch);
          const s = at < 0 ? ser.inBuf : ser.inBuf.slice(0, at);
          ser.inBuf = at < 0 ? '' : ser.inBuf.slice(at + 1);
          return s;
        }
        default: throw this.err("Serial." + m + "() doesn't exist.");
      }
    }

    // ---- expressions (fast path: cannot pause)
    ev(n, sc) {
      switch (n.k) {
        case 'num': this.f = n.f; return n.v;
        case 'chr': case 'str': this.f = false; return n.v;
        case 'id': { const c = this.lookup(n, sc); this.f = c.ty === 'float'; return c.v; }
        case 'bin': {
          const l = this.ev(n.l, sc), lf = this.f;
          const r = this.ev(n.r, sc);
          return this.binop(n.op, l, lf, r, this.f);
        }
        case 'logic': {
          const l = truthy(this.ev(n.l, sc));
          if (n.op === '&&' ? !l : l) { this.f = false; return l ? 1 : 0; }
          const r = truthy(this.ev(n.r, sc));
          this.f = false;
          return r ? 1 : 0;
        }
        case 'un': return this.unop(n.op, this.ev(n.e, sc));
        case 'upd': {
          const cell = this.target(n.target, sc);
          const i = this.tIdx;
          const old = i >= 0 ? cell.v[i] : cell.v;
          if (typeof old !== 'number') throw this.err("'" + n.op + "' only works on number variables.");
          const nv = this.store(cell, i, old + (n.op === '++' ? 1 : -1), cell.ty === 'float');
          return n.prefix ? nv : old;
        }
        case 'assign': { const v = this.ev(n.value, sc); return this.assign(n, sc, v, this.f); }
        case 'tern': return truthy(this.ev(n.c, sc)) ? this.ev(n.a, sc) : this.ev(n.b, sc);
        case 'cast': {
          const v = this.ev(n.e, sc), f = this.f;
          return this.cast(n, v, f, n.e2 ? this.ev(n.e2, sc) : null);
        }
        case 'index': return this.indexRead(n, sc, this.ev(n.idx, sc));
        case 'call': {
          const len = n.args.length;
          const args = new Array(len), fl = new Array(len);
          for (let i = 0; i < len; i++) { args[i] = this.ev(n.args[i], sc); fl[i] = this.f; }
          return n.fn ? this.callSync(n.fn, args, fl) : this.builtin(n, args, fl);
        }
        case 'mcall': {
          const len = n.args.length;
          const args = new Array(len), fl = new Array(len);
          for (let i = 0; i < len; i++) { args[i] = this.ev(n.args[i], sc); fl[i] = this.f; }
          return this.method(n, sc, args, fl);
        }
        default: throw this.err('The simulator cannot run this part of the code.');
      }
    }

    // ---- expressions that may pause (they contain delay() or a slow function)
    *evG(n, sc) {
      if (!n.blk) return this.ev(n, sc);
      switch (n.k) {
        case 'call': {
          const args = [], fl = [];
          for (const a of n.args) { args.push(yield* this.evG(a, sc)); fl.push(this.f); }
          this.line = n.line;
          if (n.name === 'delay') { yield* this.wait(args[0] * 1000); this.f = false; return 0; }
          if (n.name === 'delayMicroseconds') { yield* this.wait(args[0]); this.f = false; return 0; }
          if (n.fn) { const v = yield* this.invoke(n.fn, args, fl); this.line = n.line; return v; }
          return this.builtin(n, args, fl);
        }
        case 'mcall': {
          const args = [], fl = [];
          for (const a of n.args) { args.push(yield* this.evG(a, sc)); fl.push(this.f); }
          return this.method(n, sc, args, fl);
        }
        case 'bin': {
          const l = yield* this.evG(n.l, sc);
          const lf = this.f;
          const r = yield* this.evG(n.r, sc);
          return this.binop(n.op, l, lf, r, this.f);
        }
        case 'logic': {
          const l = truthy(yield* this.evG(n.l, sc));
          if (n.op === '&&' ? !l : l) { this.f = false; return l ? 1 : 0; }
          const r = truthy(yield* this.evG(n.r, sc));
          this.f = false;
          return r ? 1 : 0;
        }
        case 'un': return this.unop(n.op, yield* this.evG(n.e, sc));
        case 'tern': return truthy(yield* this.evG(n.c, sc)) ? yield* this.evG(n.a, sc) : yield* this.evG(n.b, sc);
        case 'cast': {
          const v = yield* this.evG(n.e, sc);
          const f = this.f;
          return this.cast(n, v, f, n.e2 ? yield* this.evG(n.e2, sc) : null);
        }
        case 'assign': {
          if (n.target.blk) break;
          const v = yield* this.evG(n.value, sc);
          return this.assign(n, sc, v, this.f);
        }
        case 'index': {
          if (n.obj.blk) break;
          return this.indexRead(n, sc, yield* this.evG(n.idx, sc));
        }
        default:
      }
      throw this.err('This line is too complicated for the simulator. Split it into smaller steps.');
    }
  }

  Sim.SimError = SimError;
  Sim.compile = compile;
  Sim.Runtime = Runtime;
  Sim.mulberry32 = mulberry32;
  Sim.words = {
    types: [...TYPE_WORDS],
    keywords: KEYWORDS.concat(['true', 'false']),
    builtins: Object.keys(BUILTINS).concat(['Serial']),
    consts: Object.keys(CONSTS).concat(Object.keys(FLOAT_CONSTS)),
  };
})(typeof window !== 'undefined' ? window : globalThis);
