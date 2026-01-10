import test from "ava";
import { compile, render, registerFunction } from "./dist/index.mjs";

const data = {
  url: "/docs/getting-started/",
  title: "Getting Started",
  excerpt: "Pagefind is a <mark>search</mark> library",
  image: "/logo.png",
  image_alt: "Logo",
  author: "bglw",
  tags: ["search", "static-site", "tutorial"],
  nested: { value: "deep", level2: { level3: "very deep" } },
  sub_results: [
    {
      url: "/docs/1/",
      title: "Section 1",
      excerpt: "First <mark>match</mark>",
    },
    {
      url: "/docs/2/",
      title: "Section 2",
      excerpt: "Second <mark>match</mark>",
    },
    {
      url: "/docs/3/",
      title: "Section 3",
      excerpt: "Third <mark>match</mark>",
    },
    {
      url: "/docs/4/",
      title: "Section 4",
      excerpt: "Fourth <mark>match</mark>",
    },
  ],
  word_count: 1250,
  zero: 0,
  empty_string: "",
  empty_array: [],
  empty_object: {},
};

// =============================================================================
// Basic Interpolation
// =============================================================================

test("interpolates simple field", (t) => {
  t.is(render("{{ title }}", data), "Getting Started");
});

test("interpolates nested path", (t) => {
  t.is(render("{{ nested.value }}", data), "deep");
});

test("interpolates deeply nested path", (t) => {
  t.is(render("{{ nested.level2.level3 }}", data), "very deep");
});

test("missing field returns empty string", (t) => {
  t.is(render("{{ missing }}", data), "");
});

test("missing nested field returns empty string", (t) => {
  t.is(render("{{ missing.path.deep }}", data), "");
});

test("array index access via dot notation", (t) => {
  t.is(render("{{ tags.0 }}", data), "search");
  t.is(render("{{ tags.1 }}", data), "static-site");
  t.is(render("{{ tags.2 }}", data), "tutorial");
});

test("numeric property access on objects", (t) => {
  t.is(render("{{ obj.123 }}", { obj: { 123: "value" } }), "value");
});

test("template with no expressions", (t) => {
  t.is(render("Hello World", {}), "Hello World");
});

test("multiple interpolations in one template", (t) => {
  t.is(
    render("{{ author }} wrote {{ title }}", data),
    "bglw wrote Getting Started",
  );
});

test("whitespace variations in delimiters", (t) => {
  t.is(render("{{title}}", data), "Getting Started");
  t.is(render("{{  title  }}", data), "Getting Started");
  t.is(render("{{\ttitle\t}}", data), "Getting Started");
  t.is(render("{{\ntitle\n}}", data), "Getting Started");
});

// =============================================================================
// Literals
// =============================================================================

test("string literal with double quotes", (t) => {
  t.is(render('{{ "hello" }}', {}), "hello");
});

test("string literal with single quotes", (t) => {
  t.is(render("{{ 'hello' }}", {}), "hello");
});

test("number literal integer", (t) => {
  t.is(render("{{ 42 }}", {}), "42");
});

test("number literal decimal", (t) => {
  t.is(render("{{ 3.14 }}", {}), "3.14");
});

test("number literal leading decimal", (t) => {
  t.is(render("{{ .5 }}", {}), "0.5");
});

test("negative number literal", (t) => {
  t.is(render("{{ -10 }}", {}), "-10");
});

test("negative decimal literal", (t) => {
  t.is(render("{{ -3.14 }}", {}), "-3.14");
});

test("true literal", (t) => {
  t.is(render("{{ true }}", {}), "true");
});

test("false literal", (t) => {
  t.is(render("{{ false }}", {}), "false");
});

test("null literal", (t) => {
  t.is(render("{{ null }}", {}), "");
});

test("escaped quotes in double-quoted string", (t) => {
  t.is(render('{{+ "hello \\"world\\"" +}}', {}), 'hello "world"');
});

test("escaped quotes in single-quoted string", (t) => {
  t.is(render("{{+ 'hello \\'world\\'' +}}", {}), "hello 'world'");
});

test("escape sequences in strings", (t) => {
  t.is(render('{{ "hello\\nworld" }}', {}), "hello\nworld");
  t.is(render('{{ "hello\\tworld" }}', {}), "hello\tworld");
  t.is(render('{{ "hello\\rworld" }}', {}), "hello\rworld");
});

// =============================================================================
// HTML Escaping & Raw Output
// =============================================================================

test("escapes HTML in normal interpolation", (t) => {
  t.is(
    render("{{ excerpt }}", data),
    "Pagefind is a &lt;mark&gt;search&lt;/mark&gt; library",
  );
});

test("raw output preserves HTML", (t) => {
  t.is(
    render("{{+ excerpt +}}", data),
    "Pagefind is a <mark>search</mark> library",
  );
});

test("escapes ampersands", (t) => {
  t.is(render("{{ x }}", { x: "A & B" }), "A &amp; B");
});

test("escapes quotes", (t) => {
  t.is(render("{{ x }}", { x: '"quoted"' }), "&quot;quoted&quot;");
});

test("escapes single quotes", (t) => {
  t.is(render("{{ x }}", { x: "it's" }), "it&#39;s");
});

test("escapes angle brackets", (t) => {
  t.is(
    render("{{ x }}", { x: "<script>alert(1)</script>" }),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

// =============================================================================
// Escaped Delimiters
// =============================================================================

test("escaped opening delimiter", (t) => {
  t.is(render("\\{{ not a tag }}", data), "{{ not a tag }}");
});

test("escaped delimiter in mixed content", (t) => {
  t.is(
    render("Show \\{{ code }} and {{ title }}", data),
    "Show {{ code }} and Getting Started",
  );
});

// =============================================================================
// Pipes (Built-in Functions as Pipes)
// =============================================================================

test("lowercase pipe", (t) => {
  t.is(render("{{ title | lowercase }}", data), "getting started");
});

test("uppercase pipe", (t) => {
  t.is(render("{{ title | uppercase }}", data), "GETTING STARTED");
});

test("trim pipe", (t) => {
  t.is(render("{{ padded | trim }}", { padded: "  hello  " }), "hello");
});

test("truncate pipe with default suffix", (t) => {
  t.is(render("{{ title | truncate(10) }}", data), "Getting St...");
});

test("truncate pipe with custom suffix", (t) => {
  t.is(render('{{ title | truncate(10, "…") }}', data), "Getting St…");
});

test("truncate pipe with empty suffix", (t) => {
  t.is(render('{{ title | truncate(10, "") }}', data), "Getting St");
});

test("truncate does not add suffix when not truncated", (t) => {
  t.is(render('{{ short | truncate(50, "...") }}', { short: "Hi" }), "Hi");
});

test("truncate with negative length", (t) => {
  t.is(render("{{ title | truncate(-5) }}", { title: "Hello" }), "...");
});

test("replace pipe", (t) => {
  t.is(
    render('{{ title | replace("Started", "Finished") }}', data),
    "Getting Finished",
  );
});

test("replace all occurrences", (t) => {
  t.is(render('{{ x | replace("a", "x") }}', { x: "banana" }), "bxnxnx");
});

test("join pipe", (t) => {
  t.is(
    render('{{ tags | join(", ") }}', data),
    "search, static-site, tutorial",
  );
});

test("join with empty separator", (t) => {
  t.is(render('{{ tags | join("") }}', data), "searchstatic-sitetutorial");
});

test("limit pipe on array", (t) => {
  t.is(
    render("{{#each tags | limit(2) as tag}}{{ tag }} {{/each}}", data),
    "search static-site ",
  );
});

test("limit with zero", (t) => {
  t.is(render("{{#each tags | limit(0) as tag}}{{ tag }}{{/each}}", data), "");
});

test("limit with negative number clamps to zero", (t) => {
  t.is(
    render("{{#each items | limit(-1) as x}}{{ x }}{{/each}}", {
      items: [1, 2, 3],
    }),
    "",
  );
});

test("default pipe with falsy value", (t) => {
  t.is(render('{{ nothing | default("N/A") }}', data), "N/A");
});

test("default pipe with truthy value", (t) => {
  t.is(render('{{ author | default("Anon") }}', data), "bglw");
});

test("default pipe with zero", (t) => {
  t.is(render('{{ zero | default("fallback") }}', data), "fallback");
});

test("default pipe with empty string", (t) => {
  t.is(render('{{ empty_string | default("fallback") }}', data), "fallback");
});

test("default pipe with empty array", (t) => {
  t.is(render('{{ empty_array | default("fallback") }}', data), "fallback");
});

test("default pipe with empty object", (t) => {
  t.is(render('{{ empty_object | default("fallback") }}', data), "fallback");
});

test("safeUrl allows relative URLs", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "/path/to/page" }), "/path/to/page");
  t.is(render("{{ url | safeUrl }}", { url: "./relative" }), "./relative");
  t.is(render("{{ url | safeUrl }}", { url: "../parent" }), "../parent");
});

test("safeUrl allows hash and query URLs", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "#section" }), "#section");
  t.is(render("{{ url | safeUrl }}", { url: "?query=1" }), "?query=1");
});

test("safeUrl allows http and https", (t) => {
  t.is(
    render("{{ url | safeUrl }}", { url: "https://example.com" }),
    "https://example.com",
  );
  t.is(
    render("{{ url | safeUrl }}", { url: "http://example.com/path" }),
    "http://example.com/path",
  );
  t.is(
    render("{{ url | safeUrl }}", { url: "HTTPS://EXAMPLE.COM" }),
    "HTTPS://EXAMPLE.COM",
  );
});

test("safeUrl allows mailto and tel", (t) => {
  t.is(
    render("{{ url | safeUrl }}", { url: "mailto:test@example.com" }),
    "mailto:test@example.com",
  );
  t.is(
    render("{{ url | safeUrl }}", { url: "tel:+1234567890" }),
    "tel:+1234567890",
  );
});

test("safeUrl blocks javascript protocol", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "javascript:alert('xss')" }), "");
  t.is(render("{{ url | safeUrl }}", { url: "JAVASCRIPT:alert(1)" }), "");
  t.is(
    render("{{ url | safeUrl }}", { url: "javascript:void(0)" }),
    "",
  );
});

test("safeUrl blocks data protocol", (t) => {
  t.is(
    render("{{ url | safeUrl }}", { url: "data:text/html,<script>alert(1)</script>" }),
    "",
  );
});

test("safeUrl blocks vbscript protocol", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "vbscript:msgbox" }), "");
});

test("safeUrl returns empty for null/undefined", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: null }), "");
  t.is(render("{{ url | safeUrl }}", {}), "");
});

test("safeUrl allows ftp", (t) => {
  t.is(
    render("{{ url | safeUrl }}", { url: "ftp://example.com/file.txt" }),
    "ftp://example.com/file.txt",
  );
});

test("safeUrl trims whitespace from valid URLs", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "  /path  " }), "/path");
  t.is(render("{{ url | safeUrl }}", { url: "\n/path\n" }), "/path");
});

test("safeUrl blocks whitespace bypass attempts", (t) => {
  t.is(render("{{ url | safeUrl }}", { url: "  javascript:alert(1)" }), "");
  t.is(render("{{ url | safeUrl }}", { url: "\njavascript:alert(1)" }), "");
  t.is(render("{{ url | safeUrl }}", { url: "\tjavascript:alert(1)" }), "");
});

test("pipe chaining: multiple pipes", (t) => {
  t.is(render("{{ title | lowercase | truncate(7) }}", data), "getting...");
});

test("pipe chaining: three pipes", (t) => {
  t.is(
    render('{{ x | trim | uppercase | truncate(5, "!") }}', {
      x: "  hello world  ",
    }),
    "HELLO!",
  );
});

// =============================================================================
// Functions (Direct Call Syntax)
// =============================================================================

test("length function on array", (t) => {
  t.is(render("{{ length(tags) }}", data), "3");
  t.is(render("{{ length(sub_results) }}", data), "4");
});

test("length function on string", (t) => {
  t.is(render("{{ length(title) }}", data), "15");
});

test("length function on empty array", (t) => {
  t.is(render("{{ length(empty_array) }}", data), "0");
});

test("first function on array", (t) => {
  t.is(render("{{ first(tags) }}", data), "search");
});

test("first function on empty array", (t) => {
  t.is(render("{{ first(empty_array) }}", data), "");
});

test("first function on non-array returns value", (t) => {
  t.is(render("{{ first(title) }}", data), "Getting Started");
});

test("last function on array", (t) => {
  t.is(render("{{ last(tags) }}", data), "tutorial");
});

test("last function on empty array", (t) => {
  t.is(render("{{ last(empty_array) }}", data), "");
});

test("last function on non-array returns value", (t) => {
  t.is(render("{{ last(title) }}", data), "Getting Started");
});

test("limit function syntax", (t) => {
  t.is(
    render("{{#each limit(tags, 1) as tag}}{{ tag }}{{/each}}", data),
    "search",
  );
});

// =============================================================================
// Comparison Functions
// =============================================================================

test("eq function", (t) => {
  t.is(render("{{ eq(1, 1) }}", {}), "true");
  t.is(render("{{ eq(1, 2) }}", {}), "false");
  t.is(render('{{ eq("a", "a") }}', {}), "true");
});

test("ne function", (t) => {
  t.is(render("{{ ne(1, 2) }}", {}), "true");
  t.is(render("{{ ne(1, 1) }}", {}), "false");
});

test("gt function", (t) => {
  t.is(render("{{ gt(5, 3) }}", {}), "true");
  t.is(render("{{ gt(3, 5) }}", {}), "false");
  t.is(render("{{ gt(5, 5) }}", {}), "false");
});

test("lt function", (t) => {
  t.is(render("{{ lt(3, 5) }}", {}), "true");
  t.is(render("{{ lt(5, 3) }}", {}), "false");
  t.is(render("{{ lt(5, 5) }}", {}), "false");
});

test("gte function", (t) => {
  t.is(render("{{ gte(5, 3) }}", {}), "true");
  t.is(render("{{ gte(5, 5) }}", {}), "true");
  t.is(render("{{ gte(3, 5) }}", {}), "false");
});

test("lte function", (t) => {
  t.is(render("{{ lte(3, 5) }}", {}), "true");
  t.is(render("{{ lte(5, 5) }}", {}), "true");
  t.is(render("{{ lte(5, 3) }}", {}), "false");
});

test("gt with string numbers uses numeric comparison", (t) => {
  t.is(render('{{ gt("10", 9) }}', {}), "true");
  t.is(render('{{ gt("10", "9") }}', {}), "true");
});

// =============================================================================
// Logical Functions
// =============================================================================

test("and function with all truthy", (t) => {
  t.is(render("{{ and(1, 2, 3) }}", {}), "3");
});

test("and function with falsy value", (t) => {
  t.is(render("{{ and(1, 0, 3) }}", {}), "0");
});

test("and function with single arg", (t) => {
  t.is(render('{{ and("value") }}', {}), "value");
});

test("or function returns first truthy", (t) => {
  t.is(render('{{ or(null, "", "found") }}', {}), "found");
});

test("or function with all falsy", (t) => {
  t.is(render("{{ or(null, false, 0) }}", {}), "0");
});

test("or function with single arg", (t) => {
  t.is(render('{{ or("value") }}', {}), "value");
});

test("not function", (t) => {
  t.is(render("{{ not(true) }}", {}), "false");
  t.is(render("{{ not(false) }}", {}), "true");
  t.is(render("{{ not(null) }}", {}), "true");
  t.is(render("{{ not(1) }}", {}), "false");
  t.is(render("{{ not(0) }}", {}), "true");
});

// =============================================================================
// Conditionals (#if)
// =============================================================================

test("if block with truthy value", (t) => {
  t.is(render("{{#if author}}By {{ author }}{{/if}}", data), "By bglw");
});

test("if block with falsy value", (t) => {
  t.is(render("{{#if nothing}}Yes{{/if}}", data), "");
});

test("if-else with truthy", (t) => {
  t.is(render("{{#if author}}Yes{{:else}}No{{/if}}", data), "Yes");
});

test("if-else with falsy", (t) => {
  t.is(render("{{#if nothing}}Yes{{:else}}No{{/if}}", data), "No");
});

test("else-if chain", (t) => {
  t.is(
    render(
      "{{#if eq(word_count, 100)}}A{{:else if eq(word_count, 1250)}}B{{:else}}C{{/if}}",
      data,
    ),
    "B",
  );
});

test("elseif without space", (t) => {
  t.is(render("{{#if false}}A{{:elseif true}}B{{:else}}C{{/if}}", {}), "B");
});

test("nested conditionals", (t) => {
  t.is(
    render(
      "{{#if author}}{{#if title}}{{ author }}: {{ title }}{{/if}}{{/if}}",
      data,
    ),
    "bglw: Getting Started",
  );
});

test("if with comparison function", (t) => {
  t.is(render("{{#if eq(word_count, 1250)}}Match{{/if}}", data), "Match");
  t.is(
    render("{{#if ne(word_count, 100)}}Different{{/if}}", data),
    "Different",
  );
  t.is(render("{{#if gt(word_count, 1000)}}Big{{/if}}", data), "Big");
  t.is(render("{{#if lt(word_count, 2000)}}Small{{/if}}", data), "Small");
  t.is(render("{{#if gte(word_count, 1250)}}GTE{{/if}}", data), "GTE");
  t.is(render("{{#if lte(word_count, 1250)}}LTE{{/if}}", data), "LTE");
});

test("if with and/or/not", (t) => {
  t.is(render("{{#if and(author, title)}}Both{{/if}}", data), "Both");
  t.is(render("{{#if or(nothing, title)}}One{{/if}}", data), "One");
  t.is(render("{{#if not(nothing)}}Negated{{/if}}", data), "Negated");
});

test("if with true literal", (t) => {
  t.is(render("{{#if true}}yes{{/if}}", {}), "yes");
});

test("if with false literal", (t) => {
  t.is(render("{{#if false}}yes{{:else}}no{{/if}}", {}), "no");
});

test("if with null literal", (t) => {
  t.is(render("{{#if null}}yes{{:else}}no{{/if}}", {}), "no");
});

// =============================================================================
// Loops (#each)
// =============================================================================

test("each loop over array", (t) => {
  t.is(
    render("{{#each tags as tag}}[{{ tag }}]{{/each}}", data),
    "[search][static-site][tutorial]",
  );
});

test("each loop with index", (t) => {
  t.is(
    render("{{#each tags as tag, i}}{{ i }}:{{ tag }} {{/each}}", data),
    "0:search 1:static-site 2:tutorial ",
  );
});

test("each loop with else on empty array", (t) => {
  t.is(
    render("{{#each empty as item}}X{{:else}}Empty{{/each}}", { empty: [] }),
    "Empty",
  );
});

test("each loop with nested object access", (t) => {
  t.is(
    render(
      "{{#each sub_results | limit(2) as sub}}{{ sub.title }},{{/each}}",
      data,
    ),
    "Section 1,Section 2,",
  );
});

test("each loop preserves outer scope", (t) => {
  t.is(
    render("{{#each tags as tag}}{{ tag }} by {{ author }}; {{/each}}", data),
    "search by bglw; static-site by bglw; tutorial by bglw; ",
  );
});

test("each loop variable shadows outer scope", (t) => {
  t.is(
    render("{{#each items as x}}{{ x }}{{/each}}:{{ x }}", {
      items: [1, 2],
      x: "outer",
    }),
    "12:outer",
  );
});

test("nested each loops", (t) => {
  const nestedData = {
    groups: [
      { name: "A", items: [1, 2] },
      { name: "B", items: [3, 4] },
    ],
  };
  t.is(
    render(
      "{{#each groups as g}}{{ g.name }}:{{#each g.items as i}}{{ i }}{{/each}};{{/each}}",
      nestedData,
    ),
    "A:12;B:34;",
  );
});

test("nested each with index in both", (t) => {
  const nestedData = { outer: [[1, 2], [3]] };
  t.is(
    render(
      "{{#each outer as row, i}}{{#each row as col, j}}({{ i }},{{ j }})={{col}} {{/each}}{{/each}}",
      nestedData,
    ),
    "(0,0)=1 (0,1)=2 (1,0)=3 ",
  );
});

// =============================================================================
// Compile & RegisterFunction
// =============================================================================

test("compile returns reusable template", (t) => {
  const template = compile("Hello {{ name }}!");
  t.is(template({ name: "World" }), "Hello World!");
  t.is(template({ name: "AVA" }), "Hello AVA!");
});

test("compiled templates are independent", (t) => {
  const templates = [];
  for (let i = 0; i < 5; i++) {
    templates.push(compile(`{{ val }}:${i}`));
  }
  for (let i = 0; i < 5; i++) {
    t.is(templates[i]({ val: "test" }), `test:${i}`);
  }
});

test("multiple compile calls have isolated parser state", (t) => {
  const t1 = compile("{{ a }}");
  const t2 = compile("{{ b }}");
  t.is(t1({ a: "A", b: "B" }), "A");
  t.is(t2({ a: "A", b: "B" }), "B");
});

test("registerFunction adds callable function", (t) => {
  registerFunction("double", (n) => n * 2);
  t.is(render("{{ double(5) }}", {}), "10");
});

test("custom function with multiple args", (t) => {
  registerFunction("add", (a, b) => a + b);
  t.is(render("{{ add(2, 3) }}", {}), "5");
});

test("custom function with variadic args", (t) => {
  registerFunction("sum", (...nums) => nums.reduce((a, b) => a + b, 0));
  t.is(render("{{ sum(1, 2, 3, 4) }}", {}), "10");
});

test("custom function works with pipe syntax", (t) => {
  registerFunction("exclaim", (s) => s + "!");
  t.is(render("{{ title | exclaim }}", data), "Getting Started!");
});

test("custom function as pipe with args", (t) => {
  registerFunction("wrap", (s, prefix, suffix) => prefix + s + suffix);
  t.is(render('{{ title | wrap("[", "]") }}', data), "[Getting Started]");
});

test("custom functions persist across render calls", (t) => {
  registerFunction("greet", (name) => `Hello, ${name}!`);
  t.is(render('{{ greet("World") }}', {}), "Hello, World!");
  t.is(render('{{ greet("Test") }}', {}), "Hello, Test!");
});

test("registerFunction can override built-in functions", (t) => {
  const originalEq = (a, b) => a === b;
  registerFunction("eq", (a, b) => (a === b ? "EQUAL" : "NOT_EQUAL"));
  t.is(render("{{ eq(1, 1) }}", {}), "EQUAL");
  t.is(render("{{ eq(1, 2) }}", {}), "NOT_EQUAL");
  // Restore
  registerFunction("eq", originalEq);
});

// =============================================================================
// Truthiness Edge Cases
// =============================================================================

test("zero is falsy", (t) => {
  t.is(render("{{#if zero}}yes{{:else}}no{{/if}}", data), "no");
});

test("empty string is falsy", (t) => {
  t.is(render("{{#if empty_string}}yes{{:else}}no{{/if}}", data), "no");
});

test("empty array is falsy", (t) => {
  t.is(render("{{#if empty_array}}yes{{:else}}no{{/if}}", data), "no");
});

test("empty object is falsy", (t) => {
  t.is(render("{{#if empty_object}}yes{{:else}}no{{/if}}", data), "no");
});

test("NaN is falsy", (t) => {
  t.is(render("{{#if nan}}yes{{:else}}no{{/if}}", { nan: NaN }), "no");
});

test("or() with NaN falls through", (t) => {
  t.is(render('{{ or(nan, "fallback") }}', { nan: NaN }), "fallback");
});

test("not(NaN) is true", (t) => {
  t.is(render("{{ not(nan) }}", { nan: NaN }), "true");
});

test("non-empty array is truthy", (t) => {
  t.is(render("{{#if tags}}yes{{:else}}no{{/if}}", data), "yes");
});

test("non-empty object is truthy", (t) => {
  t.is(render("{{#if nested}}yes{{:else}}no{{/if}}", data), "yes");
});

// =============================================================================
// Error Handling
// =============================================================================

test("error on array interpolation", (t) => {
  t.is(render("{{ tags }}", data), "[Error: use #each for arrays]");
});

test("error on object interpolation", (t) => {
  t.is(render("{{ nested }}", data), "[Error: cannot render object]");
});

test("error on unknown function", (t) => {
  t.is(render("{{ unknown(x) }}", data), "[Error: unknown unknown()]");
});

test("error on each with non-array", (t) => {
  t.is(
    render("{{#each title as char}}X{{/each}}", data),
    "[Error: #each needs array]",
  );
});

test("error on unknown block keyword", (t) => {
  t.is(
    render("{{#unknown}}content{{/unknown}}", {}),
    "[Error: unknown #unknown]content",
  );
});

test("error on invalid each syntax", (t) => {
  const result = render(
    "{{#each items NOTASKEYWORD item}}{{ item }}{{/each}}",
    { items: [1, 2] },
  );
  t.true(result.startsWith("[Error: #each missing 'as']"));
});

test("missing function args - comparison functions", (t) => {
  // Use ne/gt/lt since eq may be modified by other tests
  t.is(render("{{ ne() }}", {}), "[Error: ne() needs 2 args]");
  t.is(render("{{ gt() }}", {}), "[Error: gt() needs 2 args]");
});

test("missing function args - ne, gt, lt, gte, lte", (t) => {
  t.true(render("{{ ne(5) }}", {}).includes("[Error"));
  t.true(render("{{ gt(5) }}", {}).includes("[Error"));
  t.true(render("{{ lt(5) }}", {}).includes("[Error"));
  t.true(render("{{ gte(5) }}", {}).includes("[Error"));
  t.true(render("{{ lte(5) }}", {}).includes("[Error"));
});

test("missing function args - not", (t) => {
  t.true(render("{{ not() }}", {}).includes("[Error"));
});

test("missing function args - truncate", (t) => {
  t.true(render('{{ truncate("hello") }}', {}).includes("[Error"));
});

test("missing function args - replace", (t) => {
  t.true(render('{{ replace("hello") }}', {}).includes("[Error"));
  t.is(
    render('{{ replace("hello", "l") }}', {}),
    "[Error: replace() needs 3 args]",
  );
});

test("missing function args - join", (t) => {
  t.is(
    render("{{ join(items) }}", { items: ["a", "b"] }),
    "[Error: join() needs 2 args]",
  );
});

// =============================================================================
// Parser Edge Cases
// =============================================================================

test("unclosed parenthesis in function", (t) => {
  t.is(render("{{ eq(1, 2 }} world", {}), "false world");
});

test("pipe with unclosed parenthesis", (t) => {
  t.is(render("{{ title | truncate(5 }}", data), "Getti...");
});

test("unclosed string literal", (t) => {
  t.is(render('{{ "hello }}', {}), "");
});

test("missing closing delimiter", (t) => {
  t.is(render("Hello {{ name World", {}), "Hello ");
});

test("unclosed if block renders content", (t) => {
  t.is(render("{{#if true}}Hello", {}), "Hello");
});

test("unclosed each block renders content", (t) => {
  t.is(render("{{#each items as x}}{{ x }}", { items: [1, 2] }), "12");
});

test("deeply nested unclosed blocks", (t) => {
  t.is(render("{{#if true}}A{{#if true}}B{{#if true}}C", {}), "ABC");
});

test("multiple decimals in number", (t) => {
  t.is(render("{{ 1.2.3 }}", {}), "1.2");
});

test("double dot in number", (t) => {
  t.is(render("{{ 1..2 }}", {}), "1");
});

test("lone minus sign treated as variable", (t) => {
  t.is(render("{{ - }}", {}), "");
});

test("prototype properties not accessible", (t) => {
  t.is(render("{{ constructor }}", {}), "");
  t.is(render("{{ __proto__ }}", {}), "");
  t.is(render("{{ hasOwnProperty }}", {}), "");
});

test("dollar sign is not valid in variable names", (t) => {
  // $ is not part of \w regex, so $var doesn't parse as a variable
  t.is(render("{{ $var }}", {}), "");
  t.is(render("{{ $var }}", { $var: "value" }), "");
});

test("special characters in function args", (t) => {
  t.is(render("{{ func(@) }}", {}), "[Error: unknown func()]");
  t.is(render("{{ func([1]) }}", {}), "[Error: unknown func()]");
});

// =============================================================================
// Function Evaluation Behavior
// =============================================================================

test("and() evaluates arguments until falsy", (t) => {
  let count = 0;
  registerFunction("countAnd", () => ++count && "x");
  count = 0;
  render("{{ and(countAnd(), countAnd()) }}", {});
  t.is(count, 2);

  count = 0;
  render("{{ and(null, countAnd()) }}", {});
  t.is(count, 0); // Short-circuits
});

test("or() evaluates arguments until truthy", (t) => {
  let count = 0;
  registerFunction("countOr", () => ++count && "x");
  count = 0;
  render("{{ or(null, countOr()) }}", {});
  t.is(count, 1);

  count = 0;
  render('{{ or("truthy", countOr()) }}', {});
  t.is(count, 0); // Short-circuits
});

// =============================================================================
// Full Template
// =============================================================================

test("reference template renders correctly", (t) => {
  const refTemplate = `<li class="pf-result">
  {{#if sub_results}}
    <div class="pf-result-with-headings">
  {{/if}}

      <div class="pf-result-card{{#if image}} with-image{{/if}}">
        {{#if image}}
          <img class="pf-result-image" src="{{ image }}" alt="{{ image_alt | default(title) }}">
        {{/if}}
        <div class="pf-result-content">
          <p class="pf-result-title">
            <a class="pf-result-link" href="{{ url }}">{{ title }}</a>
          </p>
          {{#if excerpt}}
            <p class="pf-result-excerpt">{{+ excerpt +}}</p>
          {{/if}}
        </div>
      </div>

      {{#if sub_results}}
        <ul class="pf-heading-chips">
          {{#each sub_results | limit(3) as sub}}
            <li class="pf-heading-chip">
              <a class="pf-heading-link" href="{{ sub.url }}">{{ sub.title }}</a>
              <p class="pf-heading-excerpt">{{+ sub.excerpt +}}</p>
            </li>
          {{/each}}
        </ul>
      {{/if}}

  {{#if sub_results}}
    </div>
  {{/if}}
</li>`;

  const expected = `<li class="pf-result">
<div class="pf-result-with-headings">
<div class="pf-result-card with-image">
<img class="pf-result-image" src="/logo.png" alt="Logo">
<div class="pf-result-content">
<p class="pf-result-title">
<a class="pf-result-link" href="/docs/getting-started/">Getting Started</a>
</p>
<p class="pf-result-excerpt">Pagefind is a <mark>search</mark> library</p>
</div>
</div>
<ul class="pf-heading-chips">
<li class="pf-heading-chip">
<a class="pf-heading-link" href="/docs/1/">Section 1</a>
<p class="pf-heading-excerpt">First <mark>match</mark></p>
</li>
<li class="pf-heading-chip">
<a class="pf-heading-link" href="/docs/2/">Section 2</a>
<p class="pf-heading-excerpt">Second <mark>match</mark></p>
</li>
<li class="pf-heading-chip">
<a class="pf-heading-link" href="/docs/3/">Section 3</a>
<p class="pf-heading-excerpt">Third <mark>match</mark></p>
</li>
</ul>
</div>
</li>`;

  // Normalize whitespace for comparison
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  t.is(normalize(render(refTemplate, data)), normalize(expected));
});
