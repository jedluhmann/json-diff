export const extendedTypeOf = function (obj) {
  const result = typeof obj;
  if (obj == null) {
    return 'null';
  } else if (result === 'object' && obj.constructor === Array) {
    return 'array';
  } else if (result === 'object' && obj instanceof Date) {
    return 'date';
  } else {
    return result;
  }
};

export const roundObj = function (data, precision) {
  const type = typeof data;
  if (type === 'array') {
    return data.map((x) => roundObj(x, precision));
  } else if (type === 'object') {
    for (const key in data) {
      data[key] = roundObj(data[key], precision);
    }
    return data;
  } else if (type === 'number' && Number.isFinite(data) && !Number.isInteger(data)) {
    return +data.toFixed(precision);
  } else {
    return data;
  }
};

const isObject = (val) => val !== null && typeof val === 'object' && !Array.isArray(val);

export const keysEqual = function (obj1, obj2) {
  if (!isObject(obj1) && !isObject(obj2)) return true; // Both arguments are primitives

  if (isObject(obj1) !== isObject(obj2)) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Fail early if key counts at this depth differ
  if (keys1.length !== keys2.length) return false;

  // Recursively check key existence and nested objects
  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
      return false;
    }

    // Recurse down to compare sub-keys
    if (!keysEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
};

export const escapeRegExp = function (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Function to format uneven raw TSV text into properly aligned columns
function formatTableColumns(rawTsv) {
  const rows = rawTsv
    .trim()
    .split('\n')
    .map((row) => row.split('\t'));
  const colWidths = rows[0].map((_, colIdx) => Math.max(...rows.map((row) => row[colIdx]?.length || 0)));

  return rows.map((row) => row.map((cell, colIdx) => cell.padEnd(colWidths[colIdx] + 2)).join('')).join('\n');
}

function printPivotTable(headers, rowsData) {
  // Define columns: Left column is 'B', followed by all unique 'A' headers
  const allHeaders = ['', ...headers.map((h) => 'A' + h)];

  // Build a matrix of clean text rows
  const matrix = [
    allHeaders, // Row 1: Headers
    ...rowsData.map((row) => [
      'B' + row.b.toString(),
      ...headers.map((aKey) => {
        return row.cells[aKey] !== undefined ? row.cells[aKey].toString() : '-';
      }),
    ]),
  ];

  // Calculate maximum column widths for padding alignment
  const colWidths = allHeaders.map((_, colIdx) => Math.max(...matrix.map((row) => row[colIdx].length)));

  const formatRow = (row) => row.map((cell, colIdx) => cell.padEnd(colWidths[colIdx] + 3)).join('');

  // Assemble the visual structure
  const headerLine = formatRow(matrix[0]);
  const dividerLine = colWidths.map((w) => '-'.repeat(w + 3)).join('');
  const dataLines = matrix.slice(1).map(formatRow).join('\n');

  return `${headerLine}\n${dividerLine}\n${dataLines}`;
}

export const printFuzzMatchesPivotTable = async function (jq, jsonString, path = undefined) {
  // jq groups your data by B, and aggregates a key-value map of { "A_value": "score_value" }
  const jqFilter = `
    [ .[] ] 
    | group_by(.bi) 
    | .[] 
    | { 
        b: .[0].bi, 
        cells: (reduce .[] as $item ({}; . + { ($item.ai | tostring): $item.score })) 
      }
  `;

  // Fetch structured pivot data as a JSON array
  const pivotData = await jq.json(jsonString, jqFilter);

  // Extract all unique 'A' values from the original data to use as headers
  const uniqueAFilter = '[.[] | .ai] | unique | map(tostring)[]';
  const headerColumns = await jq.json(jsonString, uniqueAFilter);

  if (pivotData.length > 0) {
    process.stdout.write('\n');
    if (path) process.stdout.write(`path: ${path}\n`);
    process.stdout.write('FUZZY SCORES for new obj B compared to candidate A\n\n');
    process.stdout.write(`${printPivotTable(headerColumns, pivotData)}\n\n`);
  }
};

export const printFuzzyMatchesDetail = async function (jq, jsonString) {
  const conditions = '.'; // '.depth == 0';
  const jqFilter = `(
    ["B ", "A", "score", "depth", "key", "path"],
    ["---", "---", "-----", "-----", "-----------", "-----------"],
    (.[] | select(${conditions}) | [(.bi | tostring), (.ai | tostring), (.score | tostring), (.depth | tostring), .key, .path])
  ) | @tsv`;

  const tsvResult = await jq.raw(jsonString, jqFilter, ['-r']).stdout;

  process.stdout.write('\nFUZZY MATCH Records\n\n');
  process.stdout.write(`${formatTableColumns(tsvResult)}\n\n`);
};
