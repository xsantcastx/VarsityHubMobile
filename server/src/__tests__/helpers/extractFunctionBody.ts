export function extractFunctionBody(source: string, name: string): string {
  const startPattern = new RegExp(`export async function ${name}\\b`);
  const startMatch = source.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(`Could not locate function ${name} in source`);
  }
  const tail = source.slice(startMatch.index);

  // Skip past the parameter list's closing ')' before hunting for the body's
  // opening '{'. A naive indexOf('{') can catch type-literal params.
  const paramsStart = tail.indexOf('(');
  if (paramsStart === -1) throw new Error(`Malformed function ${name} (no params)`);
  let parenDepth = 1;
  let paramsEnd = paramsStart + 1;
  for (; paramsEnd < tail.length; paramsEnd++) {
    if (tail[paramsEnd] === '(') parenDepth++;
    else if (tail[paramsEnd] === ')') {
      parenDepth--;
      if (parenDepth === 0) break;
    }
  }
  if (parenDepth !== 0) throw new Error(`Malformed function ${name} (unbalanced parens)`);

  const firstBrace = tail.indexOf('{', paramsEnd);
  if (firstBrace === -1) throw new Error(`Malformed function ${name} (no body brace)`);

  let depth = 0;
  for (let i = firstBrace; i < tail.length; i++) {
    const ch = tail[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return tail.slice(0, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}
