export type LessonContentBlock =
  | {
      type: "rich-text";
      content: string;
    }
  | {
      type: "table";
      content: string;
    };

const TABLE_PLACEHOLDER_PREFIX = "__TABLE_BLOCK__";

const ALLOWED_TABLE_TAGS = new Set([
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
]);

const ALLOWED_TABLE_ATTRS = new Set([
  "colspan",
  "rowspan",
  "scope",
  "span",
]);

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof DOMParser !== "undefined";
}

function hasTableLikeMarkup(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

function containsForbiddenTableFragments(html: string): boolean {
  return /<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b/i.test(html);
}

function normalizeHtml(html: string): string {
  return html.replace(/\uFEFF/g, "").trim();
}

function createFallbackBlock(html: string): LessonContentBlock[] {
  return [{ type: "rich-text", content: html }];
}

/**
 * Remove comentários, scripts e estilos.
 */
function removeDangerousNodes(root: ParentNode): void {
  root.querySelectorAll("script, style, iframe, object, embed").forEach((node) => {
    node.remove();
  });
}

/**
 * Sanitiza uma tabela preservando apenas estrutura segura e atributos mínimos.
 * Remove qualquer tag fora da whitelist em vez de "desembrulhar" de forma agressiva.
 */
export function sanitizeTableHtml(tableHtml: string): string {
  if (!isBrowser()) {
    return tableHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(tableHtml, "text/html");
  const table = doc.querySelector("table");

  if (!table) {
    return "";
  }

  removeDangerousNodes(doc);

  const sanitizeElement = (el: Element): void => {
    const tag = el.tagName.toLowerCase();

    // Remove tag não permitida completamente
    if (!ALLOWED_TABLE_TAGS.has(tag)) {
      el.remove();
      return;
    }

    // Limpa atributos
    [...el.attributes].forEach((attr) => {
      const attrName = attr.name.toLowerCase();

      // remove estilos inline e handlers
      if (
        attrName === "style" ||
        attrName.startsWith("on") ||
        !ALLOWED_TABLE_ATTRS.has(attrName)
      ) {
        el.removeAttribute(attr.name);
      }
    });

    // Sanitiza filhos recursivamente
    [...el.children].forEach((child) => {
      sanitizeElement(child);
    });
  };

  sanitizeElement(table);

  // Remove elementos vazios perigosos que possam ter sobrado
  table.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TABLE_TAGS.has(tag)) {
      el.remove();
    }
  });

  return table.outerHTML;
}

/**
 * Extrai tabelas do HTML preservando a ordem do conteúdo.
 * Estratégia:
 * 1. Parseia o HTML
 * 2. Substitui cada <table> por placeholder
 * 3. Sanitiza a tabela separadamente
 * 4. Recompõe em blocos rich-text / table
 */
export function splitContent(html: string): LessonContentBlock[] {
  const source = normalizeHtml(html);

  if (!source) {
    return [];
  }

  if (!isBrowser()) {
    return createFallbackBlock(source);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");

  // Fallback mais robusto:
  // se o HTML original tinha <table> mas nenhuma tabela foi parseada, não arriscar.
  const originalHadTable = hasTableLikeMarkup(source);
  const parsedTables = Array.from(doc.querySelectorAll("table"));

  if (originalHadTable && parsedTables.length === 0) {
    return createFallbackBlock(source);
  }

  removeDangerousNodes(doc);

  const tableMap = new Map<string, string>();

  parsedTables.forEach((table, index) => {
    const placeholder = `${TABLE_PLACEHOLDER_PREFIX}_${index}__`;
    const sanitizedTable = sanitizeTableHtml(table.outerHTML);

    // Se sanitização falhar, preserva original como fallback mínimo
    tableMap.set(placeholder, sanitizedTable || table.outerHTML);

    const marker = doc.createTextNode(placeholder);
    table.replaceWith(marker);
  });

  const rawHtml = doc.body.innerHTML;
  if (!rawHtml) {
    return [];
  }

  const blocks: LessonContentBlock[] = [];
  const placeholderRegex = new RegExp(`(${TABLE_PLACEHOLDER_PREFIX}_\\d+__)`, "g");
  const parts = rawHtml.split(placeholderRegex);

  for (const part of parts) {
    if (!part) continue;

    if (tableMap.has(part)) {
      blocks.push({
        type: "table",
        content: tableMap.get(part)!,
      });
      continue;
    }

    const cleaned = normalizeHtml(part);

    if (!cleaned) continue;

    // Segurança extra: rich-text não pode conter fragmentos de tabela
    if (containsForbiddenTableFragments(cleaned)) {
      // fallback seguro: não perder conteúdo
      blocks.push({
        type: "rich-text",
        content: cleaned
          .replace(/<(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)\b[^>]*>/gi, "")
          .replace(/<\/(table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)>/gi, ""),
      });
      continue;
    }

    blocks.push({
      type: "rich-text",
      content: cleaned,
    });
  }

  return blocks;
}

/**
 * Recompõe o HTML final preservando a ordem original dos blocos.
 */
export function mergeContent(blocks: LessonContentBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "";
  }

  return blocks
    .map((block) => normalizeHtml(block.content))
    .filter(Boolean)
    .join("");
}
