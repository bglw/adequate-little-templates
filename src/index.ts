/**
 * Any value that can be used in template data or returned from functions.
 */
export type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | Value[]
  | { [k: string]: Value };

/**
 * The data object passed to templates.
 */
export type TemplateData = { [k: string]: Value };

/**
 * A compiled template function. Call with data to render the template.
 */
export type Template = (data: TemplateData) => string;

/**
 * A custom function that can be registered with registerFunction().
 * Receives evaluated arguments and returns a Value.
 * @example
 * registerFunction("double", (n) => n * 2);
 * render("{{ double(5) }}", {}) // "10"
 */
export type CustomFn = (...args: Value[]) => Value;

/** Internal function signature - receives context and unevaluated expressions */
type Fn = (ctx: TemplateData, ...args: Expr[]) => Value;

/**
 * AST Node types:
 * - T (Text): Static text content
 * - I (Interpolation): Expression to evaluate and output (raw flag skips HTML escaping)
 * - F (Flow): Conditional with branches and optional else
 * - E (Each): Loop over array with item alias, optional index, and optional else
 */
type Node =
  | { t: "T"; val: string }
  | { t: "I"; expr: Expr; raw?: 1 }
  | { t: "F"; branches: { cond: Expr; body: Node[] }[]; else?: Node[] }
  | {
      t: "E";
      arr: Expr;
      as: string;
      idx?: string;
      body: Node[];
      else?: Node[];
    };

/**
 * Expression types:
 * - L (Literal): String, number, boolean, or null
 * - V (Variable): Dot-separated path like "user.name"
 * - C (Call): Function call like eq(a, b)
 * - P (Pipe): Piped expression like "value | lowercase"
 */
type Expr =
  | { t: "L"; val: Value }
  | { t: "V"; path: string[] }
  | { t: "C"; fn: string; args: Expr[] }
  | { t: "P"; left: Expr; fn: string; args: Expr[] };

/**
 * Determines if a value is "truthy" for conditionals.
 *
 * Falsy values: null, undefined, false, 0, "", NaN, empty arrays [], empty objects {}
 * Everything else is truthy (including non-empty arrays/objects).
 *
 * This differs from JavaScript's truthiness where [] and {} are truthy.
 */
const truthy = (v: Value): boolean =>
  !(
    v === null ||
    v === undefined ||
    v === false ||
    v === 0 ||
    v === "" ||
    Number.isNaN(v) ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" &&
      v !== null &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0)
  );

/**
 * Argument count checker. Returns error string if not enough args, null otherwise.
 * Used by functions that require a minimum number of arguments.
 */
const ck = (a: Expr[], n: number, name: string): string | null =>
  a.length < n ? `[Error: ${name}() needs ${n} args]` : null;

/**
 * Registry of all available functions (built-in and custom).
 * Functions receive the context and unevaluated expressions, allowing
 * short-circuit evaluation (e.g., and/or don't evaluate all args).
 */
const fns: { [k: string]: Fn } = {
  // Comparison (return boolean)
  eq: (ctx, ...a) => ck(a, 2, "eq") ?? ev(a[0], ctx) === ev(a[1], ctx),
  ne: (ctx, ...a) => ck(a, 2, "ne") ?? ev(a[0], ctx) !== ev(a[1], ctx),
  gt: (ctx, ...a) =>
    ck(a, 2, "gt") ?? Number(ev(a[0], ctx)) > Number(ev(a[1], ctx)),
  lt: (ctx, ...a) =>
    ck(a, 2, "lt") ?? Number(ev(a[0], ctx)) < Number(ev(a[1], ctx)),
  gte: (ctx, ...a) =>
    ck(a, 2, "gte") ?? Number(ev(a[0], ctx)) >= Number(ev(a[1], ctx)),
  lte: (ctx, ...a) =>
    ck(a, 2, "lte") ?? Number(ev(a[0], ctx)) <= Number(ev(a[1], ctx)),

  // Logical (short-circuit evaluation, return last evaluated value)
  and: (ctx, ...a) => {
    let r: Value = true;
    for (const e of a) {
      r = ev(e, ctx);
      if (!truthy(r)) return r;
    }
    return r;
  },
  or: (ctx, ...a) => {
    let r: Value = false;
    for (const e of a) {
      r = ev(e, ctx);
      if (truthy(r)) return r;
    }
    return r;
  },
  not: (ctx, ...a) => ck(a, 1, "not") ?? !truthy(ev(a[0], ctx)),

  // String manipulation
  lowercase: (ctx, ...a) => String(ev(a[0], ctx)).toLowerCase(),
  uppercase: (ctx, ...a) => String(ev(a[0], ctx)).toUpperCase(),
  trim: (ctx, ...a) => String(ev(a[0], ctx)).trim(),
  truncate: (ctx, ...a) => {
    const e = ck(a, 2, "truncate");
    if (e) return e;
    const s = String(ev(a[0], ctx)),
      n = Number(ev(a[1], ctx));
    const suffix = a[2] ? String(ev(a[2], ctx)) : "...";
    return s.length > n ? s.slice(0, n) + suffix : s;
  },
  replace: (ctx, ...a) =>
    ck(a, 3, "replace") ??
    String(ev(a[0], ctx))
      .split(String(ev(a[1], ctx)))
      .join(String(ev(a[2], ctx))),

  // Array functions
  limit: (ctx, ...a) => {
    const e = ck(a, 2, "limit");
    if (e) return e;
    const r = ev(a[0], ctx),
      n = ev(a[1], ctx) as number;
    return Array.isArray(r) ? r.slice(0, n < 0 ? 0 : n) : r;
  },
  first: (ctx, ...a) => {
    const e = ck(a, 1, "first");
    if (e) return e;
    const r = ev(a[0], ctx);
    return Array.isArray(r) ? r[0] : r;
  },
  last: (ctx, ...a) => {
    const e = ck(a, 1, "last");
    if (e) return e;
    const r = ev(a[0], ctx);
    return Array.isArray(r) ? r[r.length - 1] : r;
  },
  length: (ctx, ...a) => {
    const e = ck(a, 1, "length");
    if (e) return e;
    const v = ev(a[0], ctx);
    return Array.isArray(v) ? v.length : String(v).length;
  },
  join: (ctx, ...a) =>
    ck(a, 2, "join") ??
    ((r) => (Array.isArray(r) ? r.join(String(ev(a[1], ctx))) : String(r)))(
      ev(a[0], ctx),
    ),

  // Utility
  default: (ctx, ...a) => {
    const e = ck(a, 2, "default");
    if (e) return e;
    const v = ev(a[0], ctx);
    return truthy(v) ? v : ev(a[1], ctx);
  },
};

/**
 * Evaluates an expression AST node against a data context.
 *
 * Returns undefined for missing variables, error string for unknown functions.
 */
const ev = (e: Expr, ctx: TemplateData): Value => {
  if (!e) return undefined;

  // Literal: return value directly
  if (e.t === "L") return e.val;

  // Variable: traverse dot-separated path
  if (e.t === "V") {
    const has = (o: TemplateData, k: string) =>
      Object.prototype.hasOwnProperty.call(o, k);
    let v: Value = ctx;
    for (const k of e.path) {
      if (v == null || !has(v as TemplateData, k)) return undefined;
      v = (v as TemplateData)[k];
    }
    return v;
  }

  // Call or Pipe: look up function and invoke
  const fn = fns[e.fn];
  if (!fn) return `[Error: unknown ${e.fn}()]`;
  return e.t === "C" ? fn(ctx, ...e.args) : fn(ctx, e.left, ...e.args);
};

/**
 * Escapes HTML special characters.
 */
const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Renders an AST to a string using the provided data context.
 */
const rn = (nodes: Node[], ctx: TemplateData): string => {
  let out = "";
  for (const n of nodes) {
    // Text node: append directly
    if (n.t === "T") {
      out += n.val;
      continue;
    }

    // Interpolation: evaluate and output (with HTML escaping unless raw)
    if (n.t === "I") {
      const v = ev(n.expr, ctx);
      if (Array.isArray(v)) out += "[Error: use #each for arrays]";
      else if (typeof v === "object" && v !== null)
        out += "[Error: cannot render object]";
      else {
        const s = v == null ? "" : String(v);
        out += n.raw ? s : esc(s);
      }
      continue;
    }

    // Conditional: find first truthy branch or render else
    if (n.t === "F") {
      let matched = false;
      for (const b of n.branches)
        if (truthy(ev(b.cond, ctx))) {
          out += rn(b.body, ctx);
          matched = true;
          break;
        }
      if (!matched && n.else) out += rn(n.else, ctx);
      continue;
    }

    // Loop: iterate array with local scope for item and index
    if (n.t === "E") {
      const arr = ev(n.arr, ctx);
      if (!Array.isArray(arr)) {
        out += "[Error: #each needs array]";
        continue;
      }
      if (!arr.length && n.else) out += rn(n.else, ctx);
      else
        for (let i = 0; i < arr.length; i++) {
          const local: TemplateData = { ...ctx, [n.as]: arr[i] };
          if (n.idx) local[n.idx] = i;
          out += rn(n.body, local);
        }
    }
  }
  return out;
};

/**
 * Compiles a template string into a reusable Template function.
 */
export const compile = (tmpl: string): Template => {
  let src = tmpl,
    pos = 0;

  const skipWs = () => {
    while (pos < src.length && " \t\n\r".includes(src[pos])) pos++;
  };
  const at = (s: string) => src.slice(pos, pos + s.length) === s;
  const skip = (s: string) => {
    if (at(s)) pos += s.length;
  };

  /** Parse an identifier (word characters only) */
  const ident = () => {
    let r = "";
    while (pos < src.length && /\w/.test(src[pos])) r += src[pos++];
    return r;
  };

  /**
   * Parse an expression: literal, variable, function call, or piped expression.
   */
  const parseExpr = (): Expr => {
    skipWs();
    const start = pos;
    let expr: Expr;
    const ch = src[pos];

    // String literal: "..." or '...'
    if (ch === '"' || ch === "'") {
      const q = src[pos++];
      let s = "";
      while (pos < src.length && src[pos] !== q) {
        // Handle escape sequences: \n, \t, \r, \\, \", \'
        if (src[pos] === "\\" && pos + 1 < src.length) {
          pos++;
          const c = src[pos];
          s += c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c;
          pos++;
          continue;
        }
        s += src[pos++];
      }
      if (pos < src.length) pos++;
      else s = ""; // Unclosed string becomes empty
      expr = { t: "L", val: s };
    }
    // Number literal: integers, decimals, negative numbers
    else if (/[-0-9.]/.test(ch)) {
      let s = "",
        dot = 0;
      if (src[pos] === "-") s += src[pos++];
      if (src[pos] === ".") {
        s += src[pos++];
        dot = 1;
      }
      while (
        pos < src.length &&
        (/[0-9]/.test(src[pos]) || (src[pos] === "." && !dot++))
      )
        s += src[pos++];
      expr =
        s === "-" || s === "." || s === ""
          ? { t: "V", path: [s || "-"] }
          : { t: "L", val: parseFloat(s) };
    }
    // Identifier: variable, function call, or keyword (true/false/null)
    else {
      const name = ident();
      if (name === "true") expr = { t: "L", val: true };
      else if (name === "false") expr = { t: "L", val: false };
      else if (name === "null") expr = { t: "L", val: null };
      else {
        skipWs();
        // Function call: name(args...)
        if (src[pos] === "(") {
          pos++;
          const args: Expr[] = [];
          skipWs();
          while (pos < src.length && src[pos] !== ")" && src[pos] !== "}") {
            args.push(parseExpr());
            skipWs();
            if (src[pos] === ",") {
              pos++;
              skipWs();
            }
          }
          if (src[pos] === ")") pos++;
          expr = { t: "C", fn: name, args };
        }
        // Variable with optional dot-path: name.path.to.value
        else {
          const path = [name];
          while (src[pos] === ".") {
            pos++;
            path.push(ident());
          }
          expr = { t: "V", path };
        }
      }
    }

    // Parse any pipes: | pipeName or | pipeName(args...)
    skipWs();
    while (src[pos] === "|") {
      pos++;
      skipWs();
      const fn = ident();
      skipWs();
      const args: Expr[] = [];
      if (src[pos] === "(") {
        pos++;
        skipWs();
        while (pos < src.length && src[pos] !== ")" && src[pos] !== "}") {
          args.push(parseExpr());
          skipWs();
          if (src[pos] === ",") {
            pos++;
            skipWs();
          }
        }
        if (src[pos] === ")") pos++;
      }
      expr = { t: "P", left: expr, fn, args };
      skipWs();
    }

    // Safety: advance at least one char if we didn't parse anything
    if (pos === start && pos < src.length) pos++;
    return expr;
  };

  /**
   * Parse template nodes until we hit a stop sequence (e.g., {{/if}}, {{:else}}).
   */
  const parseNodes = (stops: string[] = []): Node[] => {
    const result: Node[] = [];
    outer: while (pos < src.length) {
      // Check for stop sequences
      for (const s of stops) if (at(s)) break outer;

      // Escaped delimiter: \{{ becomes literal {{
      if (src[pos] === "\\" && at("\\{{")) {
        pos++;
        result.push({ t: "T", val: "{{" });
        pos += 2;
        continue;
      }

      // Template tag: {{ ... }}
      if (at("{{")) {
        pos += 2;
        skipWs();

        // Raw output: {{+ expr +}}
        if (src[pos] === "+") {
          pos++;
          skipWs();
          const expr = parseExpr();
          skipWs();
          skip("+");
          skipWs();
          while (pos < src.length && !at("}}")) pos++;
          skip("}}");
          result.push({ t: "I", expr, raw: 1 });
          continue;
        }

        // Block: {{#if ...}} or {{#each ...}}
        if (src[pos] === "#") {
          pos++;
          const kw = ident();
          skipWs();

          // Conditional block: {{#if cond}}...{{:else if cond}}...{{:else}}...{{/if}}
          if (kw === "if") {
            const branches: { cond: Expr; body: Node[] }[] = [];
            const cond = parseExpr();
            skipWs();
            skip("}}");
            branches.push({
              cond,
              body: parseNodes([
                "{{:else if",
                "{{:elseif",
                "{{:else}}",
                "{{/if}}",
              ]),
            });

            // Parse else-if branches
            while (at("{{:else if") || at("{{:elseif")) {
              pos += at("{{:elseif") ? 9 : 10;
              skipWs();
              const cond2 = parseExpr();
              skipWs();
              skip("}}");
              branches.push({
                cond: cond2,
                body: parseNodes([
                  "{{:else if",
                  "{{:elseif",
                  "{{:else}}",
                  "{{/if}}",
                ]),
              });
            }

            // Parse else branch
            let elseBody: Node[] | undefined;
            if (at("{{:else}}")) {
              pos += 9;
              elseBody = parseNodes(["{{/if}}"]);
            }
            skip("{{/if}}");
            result.push({ t: "F", branches, else: elseBody });
            continue;
          }

          // Loop block: {{#each arr as item, index}}...{{:else}}...{{/each}}
          if (kw === "each") {
            const arrExpr = parseExpr();
            skipWs();
            const asKw = ident();
            skipWs();
            if (asKw !== "as") {
              result.push({ t: "T", val: `[Error: #each missing 'as']` });
              continue;
            }
            const itemName = ident();
            skipWs();
            let idxName: string | undefined;
            if (src[pos] === ",") {
              pos++;
              skipWs();
              idxName = ident();
              skipWs();
            }
            skip("}}");

            const body = parseNodes(["{{:else}}", "{{/each}}"]);
            let elseBody: Node[] | undefined;
            if (at("{{:else}}")) {
              pos += 9;
              elseBody = parseNodes(["{{/each}}"]);
            }
            skip("{{/each}}");
            result.push({
              t: "E",
              arr: arrExpr,
              as: itemName,
              idx: idxName,
              body,
              else: elseBody,
            });
            continue;
          }

          // Unknown block type
          result.push({ t: "T", val: `[Error: unknown #${kw}]` });
          skipWs();
          skip("}}");
          continue;
        }

        // Simple interpolation: {{ expr }}
        const expr = parseExpr();
        skipWs();
        while (pos < src.length && !at("}}")) pos++;
        skip("}}");
        result.push({ t: "I", expr });
        continue;
      }

      // Plain text: consume until next tag or stop sequence
      let text = "";
      while (pos < src.length) {
        for (const s of stops)
          if (at(s)) {
            if (text) result.push({ t: "T", val: text });
            continue outer;
          }
        if (src[pos] === "\\" && at("\\{{")) break;
        if (at("{{")) break;
        text += src[pos++];
      }
      if (text) result.push({ t: "T", val: text });
    }
    return result;
  };

  // Parse template into AST and return render function
  const ast = parseNodes();
  return (data: TemplateData) => rn(ast, data);
};

/**
 * Compiles and immediately renders a template with the given data.
 */
export const render = (tmpl: string, data: TemplateData): string =>
  compile(tmpl)(data);

/**
 * Registers a custom function that can be called from templates.
 * Can also be used to override built-in functions.
 *
 * Functions receive already-evaluated arguments (unlike built-ins which
 * receive expressions for short-circuit evaluation).
 *
 * @example
 * registerFunction("double", (n) => n * 2);
 * render("{{ double(5) }}", {}) // "10"
 *
 * registerFunction("wrap", (s, prefix, suffix) => prefix + s + suffix);
 * render('{{ name | wrap("[", "]") }}', { name: "test" }) // "[test]"
 */
export const registerFunction = (name: string, fn: CustomFn): void => {
  fns[name] = (ctx, ...a) => fn(...a.map((e) => ev(e, ctx)));
};
