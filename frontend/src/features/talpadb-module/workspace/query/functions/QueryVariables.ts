import type { QueryVariable, QueryVariableType } from '../../../../../interfaces/TalpadbInterfaces';

const VALID_VARIABLE_TYPES: QueryVariableType[] = ['auto', 'text', 'number', 'boolean', 'null', 'raw'];

export function normalizeQueryVariableType(rawType?: string): QueryVariableType {
  if (rawType && VALID_VARIABLE_TYPES.includes(rawType as QueryVariableType)) {
    return rawType as QueryVariableType;
  }
  return 'auto';
}

export function extractSqlVariableIndices(sqlText: string): number[] {
  const detectedIndices = new Set<number>();
  const textLength = sqlText.length;
  let cursor = 0;
  let insideSingleQuotes = false;

  while (cursor < textLength) {
    const currentChar = sqlText[cursor];
    const nextChar = cursor + 1 < textLength ? sqlText[cursor + 1] : '';

    if (!insideSingleQuotes && currentChar === '-' && nextChar === '-') {
      cursor += 2;
      while (cursor < textLength && sqlText[cursor] !== '\n') {
        cursor += 1;
      }
      continue;
    }

    if (!insideSingleQuotes && currentChar === '/' && nextChar === '*') {
      cursor += 2;
      while (cursor + 1 < textLength && !(sqlText[cursor] === '*' && sqlText[cursor + 1] === '/')) {
        cursor += 1;
      }
      cursor += 2;
      continue;
    }

    if (currentChar === "'") {
      if (insideSingleQuotes && nextChar === "'") {
        cursor += 2;
        continue;
      }
      insideSingleQuotes = !insideSingleQuotes;
      cursor += 1;
      continue;
    }

    if (currentChar === '$') {
      let digitEnd = cursor + 1;
      while (digitEnd < textLength && sqlText[digitEnd] >= '0' && sqlText[digitEnd] <= '9') {
        digitEnd += 1;
      }
      if (digitEnd > cursor + 1) {
        const trailingChar = digitEnd < textLength ? sqlText[digitEnd] : '';
        const isWordBoundary = !trailingChar || !/[a-zA-Z0-9_$]/.test(trailingChar);
        if (isWordBoundary) {
          const parsedIndex = Number.parseInt(sqlText.slice(cursor + 1, digitEnd), 10);
          if (Number.isFinite(parsedIndex) && parsedIndex > 0 && parsedIndex <= 999) {
            detectedIndices.add(parsedIndex);
          }
        }
        cursor = digitEnd;
        continue;
      }
    }

    cursor += 1;
  }

  return Array.from(detectedIndices).sort((firstIndex, secondIndex) => firstIndex - secondIndex);
}

export function syncVariablesWithSql(
  sqlText: string,
  currentVariables: QueryVariable[]
): QueryVariable[] {
  const detectedIndices = extractSqlVariableIndices(sqlText);
  const detectedSet = new Set<number>(detectedIndices);
  const variablesByIndex = new Map<number, QueryVariable>();

  for (const item of currentVariables) {
    if (item.index > 0) {
      variablesByIndex.set(item.index, {
        index: item.index,
        value: item.value ?? '',
        type: normalizeQueryVariableType(item.type),
      });
    }
  }

  for (const detectedIndex of detectedIndices) {
    if (!variablesByIndex.has(detectedIndex)) {
      variablesByIndex.set(detectedIndex, {
        value: '',
        type: 'auto',
        index: detectedIndex,
      });
    }
  }

  const mergedVariables: QueryVariable[] = [];
  for (const [variableIndex, variableEntry] of variablesByIndex.entries()) {
    const isDetectedInSql = detectedSet.has(variableIndex);
    const hasCustomState =
      variableEntry.value.trim() !== '' || variableEntry.type !== 'auto';
    if (isDetectedInSql || hasCustomState) {
      mergedVariables.push(variableEntry);
    }
  }

  return mergedVariables.sort((firstItem, secondItem) => firstItem.index - secondItem.index);
}

function escapeSqlStringLiteral(rawValue: string): string {
  return rawValue.replace(/'/g, "''");
}

function isAutoNumericLiteral(trimmedValue: string): boolean {
  if (!/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    return false;
  }
  const unsignedValue = trimmedValue.startsWith('-') ? trimmedValue.slice(1) : trimmedValue;
  if (unsignedValue.length > 1 && unsignedValue.startsWith('0') && !unsignedValue.startsWith('0.')) {
    return false;
  }
  return true;
}

export function formatVariableSqlValue(
  variable: QueryVariable,
  insideSingleQuotes: boolean
): string {
  const rawValue = variable.value ?? '';
  const trimmedValue = rawValue.trim();
  const variableType = normalizeQueryVariableType(variable.type);

  if (insideSingleQuotes) {
    if (variableType === 'null') {
      return '';
    }
    return escapeSqlStringLiteral(rawValue);
  }

  if (variableType === 'null') {
    return 'NULL';
  }

  if (variableType === 'raw') {
    return trimmedValue.length > 0 ? rawValue : 'NULL';
  }

  if (variableType === 'number') {
    if (trimmedValue.length > 0 && /^-?\d+(\.\d+)?$/.test(trimmedValue)) {
      return trimmedValue;
    }
    return `'${escapeSqlStringLiteral(rawValue)}'`;
  }

  if (variableType === 'boolean') {
    const lowerValue = trimmedValue.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 't' || lowerValue === 'yes') {
      return 'TRUE';
    }
    return 'FALSE';
  }

  if (variableType === 'text') {
    return `'${escapeSqlStringLiteral(rawValue)}'`;
  }

  if (trimmedValue.toLowerCase() === 'null') {
    return 'NULL';
  }
  if (trimmedValue.toLowerCase() === 'true') {
    return 'TRUE';
  }
  if (trimmedValue.toLowerCase() === 'false') {
    return 'FALSE';
  }
  if (isAutoNumericLiteral(trimmedValue)) {
    return trimmedValue;
  }

  return `'${escapeSqlStringLiteral(rawValue)}'`;
}

export function interpolateSqlVariables(
  sqlText: string,
  variables: QueryVariable[]
): string {
  if (!sqlText || variables.length === 0) {
    return sqlText;
  }

  const variablesByIndex = new Map<number, QueryVariable>();
  for (const variable of variables) {
    if (variable.index > 0) {
      variablesByIndex.set(variable.index, variable);
    }
  }

  if (variablesByIndex.size === 0) {
    return sqlText;
  }

  const textLength = sqlText.length;
  const outputChunks: string[] = [];
  let cursor = 0;
  let insideSingleQuotes = false;

  while (cursor < textLength) {
    const currentChar = sqlText[cursor];
    const nextChar = cursor + 1 < textLength ? sqlText[cursor + 1] : '';

    if (!insideSingleQuotes && currentChar === '-' && nextChar === '-') {
      const commentStart = cursor;
      cursor += 2;
      while (cursor < textLength && sqlText[cursor] !== '\n') {
        cursor += 1;
      }
      outputChunks.push(sqlText.slice(commentStart, cursor));
      continue;
    }

    if (!insideSingleQuotes && currentChar === '/' && nextChar === '*') {
      const blockStart = cursor;
      cursor += 2;
      while (cursor + 1 < textLength && !(sqlText[cursor] === '*' && sqlText[cursor + 1] === '/')) {
        cursor += 1;
      }
      cursor = Math.min(textLength, cursor + 2);
      outputChunks.push(sqlText.slice(blockStart, cursor));
      continue;
    }

    if (currentChar === "'") {
      if (insideSingleQuotes && nextChar === "'") {
        outputChunks.push("''");
        cursor += 2;
        continue;
      }
      insideSingleQuotes = !insideSingleQuotes;
      outputChunks.push(currentChar);
      cursor += 1;
      continue;
    }

    if (currentChar === '$') {
      let digitEnd = cursor + 1;
      while (digitEnd < textLength && sqlText[digitEnd] >= '0' && sqlText[digitEnd] <= '9') {
        digitEnd += 1;
      }
      if (digitEnd > cursor + 1) {
        const trailingChar = digitEnd < textLength ? sqlText[digitEnd] : '';
        const isWordBoundary = !trailingChar || !/[a-zA-Z0-9_$]/.test(trailingChar);
        if (isWordBoundary) {
          const parsedIndex = Number.parseInt(sqlText.slice(cursor + 1, digitEnd), 10);
          const matchedVariable = variablesByIndex.get(parsedIndex);
          if (matchedVariable) {
            outputChunks.push(formatVariableSqlValue(matchedVariable, insideSingleQuotes));
            cursor = digitEnd;
            continue;
          }
        }
        outputChunks.push(sqlText.slice(cursor, digitEnd));
        cursor = digitEnd;
        continue;
      }
    }

    outputChunks.push(currentChar);
    cursor += 1;
  }

  return outputChunks.join('');
}

