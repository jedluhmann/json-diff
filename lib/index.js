import { SequenceMatcher } from '@ewoudenberg/difflib';
import { extendedTypeOf, roundObj, keysEqual } from './util.js';
import { colorize } from './colorize.js';

export class JsonDiff {
  constructor(options) {
    options.outputKeys = options.outputKeys || [];
    options.excludeKeys = options.excludeKeys || [];
    this.options = options;
  }

  isScalar(obj) {
    return typeof obj !== 'object' || obj === null;
  }

  objectDiff(obj1, obj2) {
    let result = {};
    let score = 0;
    let equal = true;

    if (
      /* prettier-ignore */
      (Object.keys(obj1).length === Object.keys(obj2).length) &&
      (JSON.stringify(obj1) === JSON.stringify(obj2) || this.options.keysOnly && keysEqual(obj1, obj2))
    ) {
      score = 100 * Math.max(Object.keys(obj1).length, 0.5);
      if (this.options.full) {
        result = obj1;
      } else {
        result = undefined;
      }

      return { score, result, equal };
    }

    for (const [key, value] of Object.entries(obj1)) {
      if (!this.options.outputNewOnly) {
        const postfix = '__deleted';

        if (!(key in obj2) && !this.options.excludeKeys.includes(key)) {
          result[`${key}${postfix}`] = value;
          score -= 30;
          equal = false;
        }
      }
    }

    for (const [key, value] of Object.entries(obj2)) {
      const postfix = !this.options.outputNewOnly ? '__added' : '';

      if (!(key in obj1) && !this.options.excludeKeys.includes(key)) {
        result[`${key}${postfix}`] = value;
        score -= 30;
        equal = false;
      }
    }

    for (const [key, value1] of Object.entries(obj1)) {
      if (key in obj2) {
        if (this.options.excludeKeys.includes(key)) {
          continue;
        }
        score += 20;
        const value2 = obj2[key];
        const change = this.diff(value1, value2);
        if (!change.equal) {
          result[key] = change.result;
          equal = false;
        } else if (this.options.full || this.options.outputKeys.includes(key)) {
          result[key] = value1;
        }
        // console.log(`key ${key} change.score=${change.score} ${change.result}`)
        // score += Math.min(20, Math.max(-10, change.score / 5)); // BATMAN!

        if (change.equal) {
          score += 20;
        } else {
          score -= Math.max(1, 20 - change.score / 5);
        }
      }
    }

    if (equal) {
      // Can't totally eliminate this as it can still be true with the options excludeKeys and outputNewOnly.
      // Could filter excludeKeys from objects in conditional above, i.e. Object.fromEntries(Object.entries(obj1).filter(([k, v]) => !this.options.excludeKeys.includes(k))),
      // but for an option that isn't used often, it get's messy really fast.
      score = 100 * Math.max(Object.keys(obj1).length, 0.5);
      if (!this.options.full) {
        result = undefined;
      }
    } else {
      score = Math.max(0, score);
    }

    // console.log(`objectDiff(${JSON.stringify(obj1, null, 2)} <=> ${JSON.stringify(obj2, null, 2)}) == ${JSON.stringify({score, result, equal})}`)
    return { score, result, equal };
  }

  findMatchingObject(item, index, fuzzyOriginals) {
    // console.log('findMatchingObject: ' + JSON.stringify({item, fuzzyOriginals}, null, 2))
    let bestMatch = null;

    for (const [key, { item: candidate, index: matchIndex }] of Object.entries(fuzzyOriginals)) {
      if (key !== '__next') {
        const indexDistance = Math.abs(matchIndex - index);
        if (extendedTypeOf(item) === extendedTypeOf(candidate)) {
          const change = this.diff(candidate, item); // A (left: old file/obj), B (right: new file/obj) - Order of arguments is important here (candidate is the original value) and allows caching (reuse change values calculated here in later fuzzy matching in case statement where op is 'equal')
          if (
            /* prettier-ignore */
            !bestMatch ||
            change.score > bestMatch.change.score ||
            (change.score === bestMatch.change.score &&
              indexDistance < bestMatch.indexDistance)
          ) {
            bestMatch = { key, indexDistance, change };
            if (change.equal && indexDistance === 0) break; // exact match (value and position), no need to continue
          }
        }
      }
    }

    // console.log('findMatchingObject result = ' + JSON.stringify(bestMatch, null, 2));
    return bestMatch;
  }

  scalarize(array, originals, fuzzyOriginals) {
    // console.log('scalarize', array, originals, fuzzyOriginals);
    const fuzzyMatches = [];
    const keyScores = {};
    if (fuzzyOriginals) {
      // Find best fuzzy match for each object in the array
      for (let index = 0; index < array.length; index++) {
        const item = array[index];
        if (this.isScalar(item)) {
          continue;
        }
        const bestMatch = this.findMatchingObject(item, index, fuzzyOriginals);
        if (bestMatch && (!keyScores[bestMatch.key] || bestMatch.change.score > keyScores[bestMatch.key].change.score)) {
          keyScores[bestMatch.key] = { index, change: bestMatch.change };
        }
      }
      for (const [key, match] of Object.entries(keyScores)) {
        fuzzyMatches[match.index] = key;
      }
    }

    const result = [];
    for (let index = 0; index < array.length; index++) {
      const item = array[index];
      if (this.isScalar(item)) {
        result.push(item);
      } else {
        const key = fuzzyMatches[index] || '__$!SCALAR' + originals.__next++;
        originals[key] = { item, index, change: keyScores[key]?.change };
        result.push(key);
      }
    }
    // console.log('Scalarize result', result);
    return result;
  }

  isScalarized(item, originals) {
    return typeof item === 'string' && item in originals;
  }

  descalarize(item, originals) {
    if (this.isScalarized(item, originals)) {
      return originals[item].item;
    } else {
      return item;
    }
  }

  arrayDiff(obj1, obj2) {
    let result = [];
    let score = 0;
    let equal = true;

    if (this.options.sort) {
      obj1.sort();
      obj2.sort();
    }

    // bypass the comparison logic for exact matches and return immediately
    if (obj1.length === obj2.length && (JSON.stringify(obj1) === JSON.stringify(obj2) || this.options.keysOnly)) {
      if (this.options.full) {
        result = obj1;
      } else {
        result = undefined;
      }
      score = 100;
      return { score, result, equal };
    }

    equal = false;

    const originals1 = { __next: 1 };
    const seq1 = this.scalarize(obj1, originals1);
    const originals2 = { __next: originals1.__next };
    const seq2 = this.scalarize(obj2, originals2, originals1);

    const opcodes = new SequenceMatcher(null, seq1, seq2).getOpcodes();

    // console.log(`arrayDiff:\nobj1 = ${JSON.stringify(obj1, null, 2)}\nobj2 = ${JSON.stringify(obj2, null, 2)}\nseq1 = ${JSON.stringify(seq1, null, 2)}\nseq2 = ${JSON.stringify(seq2, null, 2)}\nopcodes = ${JSON.stringify(opcodes, null, 2)}`)

    for (const [op, i1, i2, j1, j2] of opcodes) {
      let i, j;
      let asc, end;
      let asc1, end1;
      let asc2, end2;
      let asc3, end3;
      let asc4, end4;

      switch (op) {
        case 'equal':
          for (
            /* prettier-ignore */
            i = i1, end = i2, asc = i1 <= end;
            asc ? i < end : i > end;
            asc ? i++ : i--
          ) {
            const item = seq1[i];
            if (this.isScalarized(item, originals1)) {
              if (!this.isScalarized(item, originals2)) {
                throw new Error(`internal bug: isScalarized(item, originals1) != isScalarized(item, originals2) for item ${JSON.stringify(item)}`);
              }

              const item2 = this.descalarize(item, originals2);
              const change = originals2[item].change; // use cached value

              if (!change.equal) {
                result.push(['~', change.result]);
              } else {
                if (this.options.full || this.options.keepUnchangedValues) {
                  result.push([' ', item2]);
                } else {
                  result.push([' ']);
                }
              }
            } else {
              if (this.options.full || this.options.keepUnchangedValues) {
                result.push([' ', item]);
              } else {
                result.push([' ']);
              }
            }
            score += 10;
          }
          break;
        case 'delete':
          for (
            /* prettier-ignore */
            i = i1, end1 = i2, asc1 = i1 <= end1;
            asc1 ? i < end1 : i > end1;
            asc1 ? i++ : i--
          ) {
            result.push(['-', this.descalarize(seq1[i], originals1)]);
            score -= 5;
          }
          break;
        case 'insert':
          for (
            /* prettier-ignore */
            j = j1, end2 = j2, asc2 = j1 <= end2;
            asc2 ? j < end2 : j > end2;
            asc2 ? j++ : j--
          ) {
            result.push(['+', this.descalarize(seq2[j], originals2)]);
            score -= 5;
          }
          break;
        case 'replace':
          for (
            /* prettier-ignore */
            i = i1, end3 = i2, asc3 = i1 <= end3;
            asc3 ? i < end3 : i > end3;
            asc3 ? i++ : i--
          ) {
            result.push(['-', this.descalarize(seq1[i], originals1)]);
            score -= 5;
          }

          for (
            /* prettier-ignore */
            j = j1, end4 = j2, asc4 = j1 <= end4;
            asc4 ? j < end4 : j > end4;
            asc4 ? j++ : j--
          ) {
            result.push(['+', this.descalarize(seq2[j], originals2)]);
            score -= 5;
          }
          break;
      }
    }

    score = Math.max(0, score);
    return { score, result, equal };
  }

  diff(obj1, obj2) {
    const type1 = extendedTypeOf(obj1);
    const type2 = extendedTypeOf(obj2);

    if (type1 === type2) {
      switch (type1) {
        case 'object':
          return this.objectDiff(obj1, obj2);

        case 'array':
          return this.arrayDiff(obj1, obj2);
      }
    }

    // Compare primitives or complex objects of different types
    let score = 100;
    let result = obj1;
    let equal;
    if (!this.options.keysOnly) {
      if (type1 === 'date' && type2 === 'date') {
        equal = obj1.getTime() === obj2.getTime();
      } else {
        equal = obj1 === obj2;
      }
      if (!equal) {
        score = 0;

        if (this.options.outputNewOnly) {
          result = obj2;
        } else {
          result = { __old: obj1, __new: obj2 };
        }
      } else if (!this.options.full) {
        result = undefined;
      }
    } else {
      equal = true;
      result = undefined;
    }

    // console.log(`diff: equal ${equal} obj1 ${obj1} obj2 ${obj2} score ${score} ${result || ''}`)

    return { score, result, equal };
  }
}

export const diff = function (obj1, obj2, options = {}) {
  if (options.precision !== undefined) {
    obj1 = roundObj(obj1, options.precision);
    obj2 = roundObj(obj2, options.precision);
  }
  return new JsonDiff(options).diff(obj1, obj2).result;
};

export const diffString = function (obj1, obj2, options = {}) {
  return colorize(diff(obj1, obj2, options), options);
};
