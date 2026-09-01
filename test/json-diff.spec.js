import fs from 'fs';
import path from 'path';
import { assert, expect } from 'chai';
import { JsonDiff, diff, diffString } from '../lib/index.js';

describe('diff', () => {
  let jsonDiff;

  // Instantiates a new class before each individual test case
  beforeEach(() => {
    jsonDiff = new JsonDiff({});
  });

  describe('with simple scalar values', () => {
    it('should return undefined for two identical numbers', () => {
      const result = jsonDiff.diff(42, 42).result;
      expect(result).to.be.undefined;
    });

    it('should return undefined for two identical strings', () => {
      const result = jsonDiff.diff('foo', 'foo').result;
      expect(result).to.be.undefined;
    });

    it('should return undefined for two identical dates', () => {
      const date = new Date();
      const result = jsonDiff.diff(date, date).result;
      expect(result).to.be.undefined;
    });

    it('should return { __old: <old value>, __new: <new value> } object for two different numbers', () => {
      const result = jsonDiff.diff(42, 10).result;
      expect(result).to.deep.equal({ __old: 42, __new: 10 });
    });

    it('should return { __old: <old value>, __new: <new value> } object for two different dates', () => {
      const oldDate = new Date();
      const newDate = new Date();
      newDate.setFullYear(oldDate.getFullYear() - 4);
      const result = jsonDiff.diff(oldDate, newDate).result;
      expect(result).to.deep.equal({ __old: oldDate, __new: newDate });
    });
  });

  describe('with objects', () => {
    it('should return undefined for two empty objects', () => {
      const result = diff({}, {});
      assert.deepEqual(result, undefined);
    });

    it('should return undefined for two objects with identical contents', () => {
      const result = diff({ foo: 42, bar: 10 }, { foo: 42, bar: 10 });
      assert.deepEqual(result, undefined);
    });

    it('should return undefined for two object hierarchies with identical contents', () => {
      const result = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 10, bbboz: 11 } });
      assert.deepEqual(result, undefined);
    });

    it('should return { <key>__deleted: <old value> } when the second object is missing a key', () => {
      const result = diff({ foo: 42, bar: 10 }, { bar: 10 });
      assert.deepEqual(result, { foo__deleted: 42 });
    });

    it('should return { <key>__added: <new value> } when the first object is missing a key', () => {
      const result = diff({ bar: 10 }, { foo: 42, bar: 10 });
      assert.deepEqual(result, { foo__added: 42 });
    });

    it('should return { <key>: { __old: <old value>, __new: <new value> } } for two objects with different scalar values for a key', () => {
      const result = diff({ foo: 42 }, { foo: 10 });
      assert.deepEqual(result, { foo: { __old: 42, __new: 10 } });
    });

    it('should return { <key>: <diff> } with a recursive diff for two objects with different values for a key', () => {
      const result = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 12 } });
      assert.deepEqual(result, { bar: { bbboz__deleted: 11, bbbar: { __old: 10, __new: 12 } } });
    });
  });

  describe('with arrays of scalars', () => {
    it('should return undefined for two arrays with identical contents', () => {
      const result = diff([10, 20, 30], [10, 20, 30]);
      assert.deepEqual(result, undefined);
    });

    it("should return [..., ['-', <removed item>], ...] for two arrays when the second array is missing a value", () => {
      const result = diff([10, 20, 30], [10, 30]);
      assert.deepEqual(result, [[' '], ['-', 20], [' ']]);
    });

    it("should return [..., ['+', <added item>], ...] for two arrays when the second one has an extra value", () => {
      const result = diff([10, 30], [10, 20, 30]);
      assert.deepEqual(result, [[' '], ['+', 20], [' ']]);
    });

    it("should return [..., ['+', <added item>]] for two arrays when the second one has an extra value at the end (edge case test)", () => {
      const result = diff([10, 20], [10, 20, 30]);
      assert.deepEqual(result, [[' '], [' '], ['+', 30]]);
    });

    it("should return [['-', true], ['+', 'true']] for two arrays with identical strings of different types", () => {
      const result = diff([10, 20, 30], [10, 20, 30]);
      assert.deepEqual(result, undefined);
    });
  });

  describe('with arrays of objects', () => {
    it('should return undefined for two arrays with identical contents', () => {
      const result = diff([{ foo: 10 }, { foo: 20 }, { foo: 30 }], [{ foo: 10 }, { foo: 20 }, { foo: 30 }]);
      assert.deepEqual(result, undefined);
    });

    it('should return undefined for two arrays with identical, empty object contents', () => {
      const result = diff([{}], [{}]);
      assert.deepEqual(result, undefined);
    });

    it('should return undefined for two arrays with identical, empty array contents', () => {
      const result = diff([[]], [[]]);
      assert.deepEqual(result, undefined);
    });

    it("should return undefined for two arrays with identical array contents including 'null'", () => {
      const result = diff([1, null, null], [1, null, null]);
      assert.deepEqual(result, undefined);
    });

    it('should return undefined for two arrays with identical, repeated contents', () => {
      const result = diff(
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ]
      );
      assert.deepEqual(result, undefined);
    });

    it("should return [..., ['-', <removed item>], ...] for two arrays when the second array is missing a value", () => {
      const result = diff([{ foo: 10 }, { foo: 20 }, { foo: 30 }], [{ foo: 10 }, { foo: 30 }]);
      assert.deepEqual(result, [[' '], ['-', { foo: 20 }], [' ']]);
    });

    it("should return [..., ['+', <added item>], ...] for two arrays when the second array has an extra value", () => {
      const result = diff([{ foo: 10 }, { foo: 30 }], [{ foo: 10 }, { foo: 20 }, { foo: 30 }]);
      assert.deepEqual(result, [[' '], ['+', { foo: 20 }], [' ']]);
    });

    it("should return [['+', <added item>], ..., ['+', <added item>]] for two arrays containing objects of 3 or more properties when the second array has extra values (fixes issue #57)", () => {
      const result = diff(
        [{ key1: 'a', key2: '12', key3: 'cm' }],
        [
          { key1: 'b', key2: '1', key3: 'm' },
          { key1: 'a', key2: '12', key3: 'cm' },
          { key1: 'c', key2: '1', key3: 'dm' },
        ]
      );
      assert.deepEqual(result, [['+', { key1: 'b', key2: '1', key3: 'm' }], [' '], ['+', { key1: 'c', key2: '1', key3: 'dm' }]]);
    });

    it("should return [..., ['+', <added item>], ...] for two arrays when the second array has a new but nearly identical object added", () => {
      const result = diff([{ name: 'Foo', a: 3, b: 1 }, { foo: 10 }], [{ name: 'Foo', a: 3, b: 1 }, { name: 'Foo', a: 3, b: 1, c: 1 }, { foo: 10 }]);
      assert.deepEqual(result, [[' '], ['+', { name: 'Foo', a: 3, b: 1, c: 1 }], [' ']]);
    });

    it("should return [..., ['~', <diff>], ...] for two arrays when an item has been modified", () => {
      const result = diff(
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 20, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ],
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 21, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ]
      );
      assert.deepEqual(result, [[' '], ['~', { foo: { __old: 20, __new: 21 } }], [' ']]);
    });
  });

  describe('with reported bugs', () => {
    it('should handle type mismatch during scalarize', () => {
      const result = diff({ s: [[{ b: '123' }]] }, { s: [[{ b: 'abc' }], []] });
      const expected = {
        s: [
          ['~', [['~', { b: { __old: '123', __new: 'abc' } }]]],
          ['+', []],
        ],
      };
      assert.deepEqual(result, expected);
    });

    it('should handle mixed scalars and non-scalars in scalarize', () => {
      const result = diff(['a', { foo: 'bar' }, { foo: 'bar' }], ['a', { foo: 'bar' }, { foo: 'bar' }]);
      assert.deepEqual(result, undefined);
    });
  });
});

describe('diff({sort: true})', () => {
  describe('with arrays', () => {
    it('should return undefined for two arrays with the same contents in different order', () => {
      const result = diff([1, undefined, null, true, '', { a: 4 }, [7, 8]], [[7, 8], { a: 4 }, true, null, undefined, '', 1], { sort: true });
      assert.deepEqual(result, undefined);
    });
  });
});

describe('diff({keepUnchangedValues: true})', () => {
  describe('with nested object', () => {
    it('should return partial object with modified and unmodified elements in the edited scope', () => {
      const result = diff({ a: { b: [1, 2, 3], c: 'd' } }, { a: { b: [1, 3, 4], c: 'd' } }, { keepUnchangedValues: true });
      const expected = {
        a: {
          b: [
            [' ', 1],
            ['-', 2],
            [' ', 3],
            ['+', 4],
          ],
        },
      };
      assert.deepEqual(result, expected);
    });
  });
});

describe('diff({full: true})', () => {
  describe('with simple scalar values', () => {
    it('should return the number for two identical numbers', () => {
      const response = diff(42, 42, { full: true });
      assert.deepEqual(response, 42);
    });

    it('should return the string for two identical strings', () => {
      const response = diff('foo', 'foo', { full: true });
      assert.deepEqual(response, 'foo');
    });

    it('should return { __old: <old value>, __new: <new value> } object for two different numbers', () => {
      const response = diff(42, 10, { full: true });
      assert.deepEqual(response, { __new: 10, __old: 42 });
    });
  });

  describe('with objects', () => {
    it('should return an empty object for two empty objects', () => {
      const response = diff({}, {}, { full: true });
      assert.deepEqual(response, {});
    });

    it('should return the object for two objects with identical contents', () => {
      const response = diff({ foo: 42, bar: 10 }, { foo: 42, bar: 10 }, { full: true });
      assert.deepEqual(response, { foo: 42, bar: 10 });
    });

    it('should return the object for two object hierarchies with identical contents', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { full: true });
      assert.deepEqual(response, { foo: 42, bar: { bbbar: 10, bbboz: 11 } });
    });

    it('should return { <key>__deleted: <old value>, <remaining properties>} when the second object is missing a key', () => {
      const response = diff({ foo: 42, bar: 10 }, { bar: 10 }, { full: true });
      assert.deepEqual(response, { foo__deleted: 42, bar: 10 });
    });

    it('should return { <key>__added: <new value>, <remaining properties> } when the first object is missing a key', () => {
      const response = diff({ bar: 10 }, { foo: 42, bar: 10 }, { full: true });
      assert.deepEqual(response, { foo__added: 42, bar: 10 });
    });

    it('should return { <key>: { __old: <old value>, __new: <new value> } } for two objects with different scalar values for a key', () => {
      const response = diff({ foo: 42 }, { foo: 10 }, { full: true });
      assert.deepEqual(response, { foo: { __old: 42, __new: 10 } });
    });

    it('should return { <key>: <diff>, <equal properties> } with a recursive diff for two objects with different values for a key', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10 } }, { foo: 42, bar: { bbbar: 12 } }, { full: true });
      assert.deepEqual(response, { foo: 42, bar: { bbbar: { __old: 10, __new: 12 } } });
    });

    it('should return { <key>: <diff>, <equal properties> } with a recursive diff for two objects with different values for a key', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 12 } }, { full: true });
      assert.deepEqual(response, { foo: 42, bar: { bbboz__deleted: 11, bbbar: { __old: 10, __new: 12 } } });
    });
  });

  describe('with arrays of scalars', () => {
    it('should return an array showing no changes for any element for two arrays with identical contents', () => {
      const response = diff([10, 20, 30], [10, 20, 30], { full: true });
      assert.deepEqual(response, [10, 20, 30]);
    });

    it("should return [[' ', <unchanged item>], ['-', <removed item>], [' ', <unchanged item>]] for two arrays when the second array is missing a value", () => {
      const response = diff([10, 20, 30], [10, 42, 30], { full: true });
      const expected = [
        [' ', 10],
        ['-', 20],
        ['+', 42],
        [' ', 30],
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [' ', <unchanged item>], ['+', <added item>], [' ', <unchanged item>]] for two arrays when the second one has an extra value", () => {
      const response = diff([10, 30], [10, 20, 30], { full: true });
      const expected = [
        [' ', 10],
        ['+', 20],
        [' ', 30],
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [' ', <unchanged item>s], ['+', <added item>]] for two arrays when the second one has an extra value at the end (edge case test)", () => {
      const response = diff([10, 20], [10, 20, 30], { full: true });
      const expected = [
        [' ', 10],
        [' ', 20],
        ['+', 30],
      ];
      assert.deepEqual(response, expected);
    });
  });

  describe('with arrays of objects', () => {
    it('should return an array of unchanged elements for two arrays with identical contents', () => {
      const response = diff([{ foo: 10 }, { foo: 20 }, { foo: 30 }], [{ foo: 10 }, { foo: 20 }, { foo: 30 }], { full: true });
      assert.deepEqual(response, [{ foo: 10 }, { foo: 20 }, { foo: 30 }]);
    });

    it('should return an array with an unchanged element for two arrays with identical, empty object contents', () => {
      const response = diff([{}], [{}], { full: true });
      assert.deepEqual(response, [{}]);
    });

    it('should return an array with an unchanged element for two arrays with identical, empty array contents', () => {
      const response = diff([[]], [[]], { full: true });
      assert.deepEqual(response, [[]]);
    });

    it("should return an array of unchanged elements for two arrays with identical array contents including 'null'", () => {
      const response = diff([1, null, null], [1, null, null], { full: true });
      assert.deepEqual(response, [1, null, null]);
    });

    it('should return an array of unchanged elements for two arrays with identical, repeated contents', () => {
      const response = diff(
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        { full: true }
      );
      const expected = [
        { a: 1, b: 2 },
        { a: 1, b: 2 },
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [[' ', <unchanged item>], ['-', <removed item>], [' ', <unchanged item>]] for two arrays when the second array is missing a value", () => {
      const response = diff([{ foo: 10 }, { foo: 20 }, { foo: 30 }], [{ foo: 10 }, { foo: 30 }], { full: true });
      const expected = [
        [' ', { foo: 10 }],
        ['-', { foo: 20 }],
        [' ', { foo: 30 }],
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [[' ', <unchanged item>], ['+', <added item>], [' ', <unchanged item>]] for two arrays when the second array has an extra value", () => {
      const response = diff([{ foo: 10 }, { foo: 30 }], [{ foo: 10 }, { foo: 20 }, { foo: 30 }], { full: true });
      const expected = [
        [' ', { foo: 10 }],
        ['+', { foo: 20 }],
        [' ', { foo: 30 }],
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [[' ', <unchanged item>], ['+', <added item>], [' ', <unchanged item>]] for two arrays when the second array has a new but nearly identical object added", () => {
      const response = diff([{ name: 'Foo', a: 3, b: 1 }, { foo: 10 }], [{ name: 'Foo', a: 3, b: 1 }, { name: 'Foo', a: 3, b: 1, c: 1 }, { foo: 10 }], { full: true });
      const expected = [
        [' ', { name: 'Foo', a: 3, b: 1 }],
        ['+', { name: 'Foo', a: 3, b: 1, c: 1 }],
        [' ', { foo: 10 }],
      ];
      assert.deepEqual(response, expected);
    });

    it("should return [[' ', <unchanged item>], ['~', <diff>], [' ', <unchanged item>]] for two arrays when an item has been modified", () => {
      const response = diff(
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 20, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ],
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 21, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ],
        { full: true }
      );
      const expected = [
        [' ', { foo: 10, bar: { bbbar: 10, bbboz: 11 } }],
        ['~', { foo: { __old: 20, __new: 21 }, bar: { bbbar: 50, bbboz: 25 } }],
        [' ', { foo: 30, bar: { bbbar: 92, bbboz: 34 } }],
      ];
      assert.deepEqual(response, expected);
    });
  });
});

describe('diff({ outputKeys: foo,bar }', () => {
  it('should return keys foo and bar although they have no changes', () => {
    const response = diff({ foo: 42, bar: 10 }, { foo: 42, bar: 10, bbar: 5 }, { outputKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { foo: 42, bar: 10, bbar__added: 5 });
  });

  it('should return keys foo (with addition) and bar (with no changes) ', () => {
    const response = diff({ bar: 10 }, { foo: 42, bar: 10, bbar: 5 }, { outputKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { foo__added: 42, bar: 10, bbar__added: 5 });
  });

  it('should return keys foo and bar (with addition) ', () => {
    const response = diff({ bbar: 5 }, { foo: 42, bar: 10, bbar: 5 }, { outputKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { foo__added: 42, bar__added: 10 });
  });

  it('should return nothing as the entire object is equal, no matter that show keys has some of them', () => {
    const response = diff({ foo: 42, bar: 10, bbar: 5 }, { foo: 42, bar: 10, bbar: 5 }, { outputKeys: ['foo', 'bar'] });
    assert.deepEqual(response, undefined);
  });

  it('should return the keys of an entire object although it has no changes ', () => {
    const response = diff({ foo: { a: 1, b: 2, c: [1, 2] } }, { foo: { a: 1, b: 2, c: [1, 2] }, bbar: 5 }, { outputKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { foo: { a: 1, b: 2, c: [1, 2] }, bbar__added: 5 });
  });
});

describe('diff({ excludeKeys: foo,bar }', () => {
  it("shouldn't return keys foo and bar even thou they have changes", () => {
    const response = diff({ foo: 42 }, { bar: 10, bbar: 5 }, { excludeKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { bbar__added: 5 });
  });

  it("shouldn't return keys foo (with addition) and bar (with no changes) ", () => {
    const response = diff({ bar: 10 }, { foo: 42, bar: 10, bbar: 5 }, { excludeKeys: ['foo', 'bar'] });
    assert.deepEqual(response, { bbar__added: 5 });
  });

  it("shouldn't return keys foo and bar (with addition) ", () => {
    const response = diff({ bbar: 5 }, { foo: 42, bar: 10, bbar: 5 }, { excludeKeys: ['foo', 'bar'] });
    assert.deepEqual(response, undefined);
  });
});

describe('diff({keysOnly: true})', () => {
  describe('with simple scalar values', () => {
    it('should return undefined for two identical numbers', () => {
      const response = diff(42, 42, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two identical strings', () => {
      const response = diff('foo', 'foo', { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined object for two different numbers', () => {
      const response = diff(42, 10, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });
  });

  describe('with objects', () => {
    it('should return undefined for two empty objects', () => {
      const response = diff({}, {}, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two objects with identical contents', () => {
      const response = diff({ foo: 42, bar: 10 }, { foo: 42, bar: 10 }, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two object hierarchies with identical contents', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return { <key>__deleted: <old value> } when the second object is missing a key', () => {
      const response = diff({ foo: 42, bar: 10 }, { bar: 10 }, { keysOnly: true });
      assert.deepEqual(response, { foo__deleted: 42 });
    });

    it('should return { <key>__added: <new value> } when the first object is missing a key', () => {
      const response = diff({ bar: 10 }, { foo: 42, bar: 10 }, { keysOnly: true });
      assert.deepEqual(response, { foo__added: 42 });
    });

    it('should return undefined for two objects with different scalar values for a key', () => {
      const response = diff({ foo: 42 }, { foo: 10 }, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined with a recursive diff for two objects with different values for a key', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10 } }, { foo: 42, bar: { bbbar: 12 } }, { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return { <key>: <diff> } with a recursive diff when second object is missing a key and two objects with different values for a key', () => {
      const response = diff({ foo: 42, bar: { bbbar: 10, bbboz: 11 } }, { foo: 42, bar: { bbbar: 12 } }, { keysOnly: true });
      assert.deepEqual(response, { bar: { bbboz__deleted: 11 } });
    });
  });

  describe('with arrays of scalars', () => {
    it('should return undefined for two arrays with identical contents', () => {
      const response = diff([10, 20, 30], [10, 20, 30], { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two arrays with when an item has been modified', () => {
      const response = diff([10, 20, 30], [10, 42, 30], { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it("should return [..., ['-', <removed item>], ...] for two arrays when the second array is missing a value", () => {
      const response = diff([10, 20, 30], [10, 30], { keysOnly: true });
      assert.deepEqual(response, [[' '], ['-', 20], [' ']]);
    });

    it("should return [..., ['+', <added item>], ...] for two arrays when the second one has an extra value", () => {
      const response = diff([10, 30], [10, 20, 30], { keysOnly: true });
      assert.deepEqual(response, [[' '], ['+', 20], [' ']]);
    });

    it("should return [..., ['+', <added item>]] for two arrays when the second one has an extra value at the end (edge case test)", () => {
      const response = diff([10, 20], [10, 20, 30], { keysOnly: true });
      assert.deepEqual(response, [[' '], [' '], ['+', 30]]);
    });
  });

  describe('with arrays of objects', () => {
    it('should return undefined for two arrays with identical contents', () => {
      const response = diff([{ foo: 10 }, { foo: 20 }, { foo: 30 }], [{ foo: 10 }, { foo: 20 }, { foo: 30 }], { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two arrays with identical, empty object contents', () => {
      const response = diff([{}], [{}], { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two arrays with identical, empty array contents', () => {
      const response = diff([[]], [[]], { keysOnly: true });
      assert.deepEqual(response, undefined);
    });

    it('should return undefined for two arrays with identical, repeated contents', () => {
      const response = diff(
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        { keysOnly: true }
      );
      assert.deepEqual(response, undefined);
    });

    it("should return [..., ['-', <removed item>], ...] for two arrays when the second array is missing a value", () => {
      const response = diff([{ foo: 10 }, { bar: 20 }, { bletch: 30 }], [{ foo: 10 }, { bletch: 30 }], { keysOnly: true });
      assert.deepEqual(response, [[' '], ['-', { bar: 20 }], [' ']]);
    });

    it("should return [..., ['+', <added item>], ...] for two arrays when the second array has an extra value", () => {
      const response = diff([{ foo: 10 }, { bletch: 30 }], [{ foo: 10 }, { bar: 20 }, { bletch: 30 }], { keysOnly: true });
      assert.deepEqual(response, [[' '], ['+', { bar: 20 }], [' ']]);
    });

    it('should return undefined for two arrays when an item has been modified', () => {
      const response = diff(
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 20, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ],
        [
          { foo: 10, bar: { bbbar: 10, bbboz: 11 } },
          { foo: 21, bar: { bbbar: 50, bbboz: 25 } },
          { foo: 30, bar: { bbbar: 92, bbboz: 34 } },
        ],
        { keysOnly: true }
      );
      assert.deepEqual(response, undefined);
    });
  });
});

describe('diffString', () => {
  const readExampleFile = (file) => fs.readFileSync(path.join(import.meta.dirname, '../example', file), 'utf8');
  const a = JSON.parse(readExampleFile('a.json'));
  const b = JSON.parse(readExampleFile('b.json'));
  const big_a = JSON.parse(readExampleFile('big_a.json'));
  const big_b = JSON.parse(readExampleFile('big_b.json'));
  // Get duplicate copies for the precision test - numbers within these are altered (rounded) by the precision operation
  const aprec = JSON.parse(readExampleFile('a.json'));
  const bprec = JSON.parse(readExampleFile('b.json'));

  it('should produce the expected result for the example JSON files', () => {
    assert.equal(diffString(a, b, { color: false, full: true }), readExampleFile('full-result.jsdiff'));
    assert.equal(diffString(big_a, big_b, { color: false, maxElisions: 5 }), readExampleFile('big_result.jsdiff'));
  });

  it('should produce the expected result for the example JSON files with precision set to 1', () => {
    assert.equal(diffString(a, b, { color: false, full: true, precision: 1 }), readExampleFile('full-result-precision-1.jsdiff'));
  });

  it('should produce the expected colored result for the example JSON files', () => {
    assert.equal(diffString(aprec, bprec, { color: true, full: true }), readExampleFile('full-result-colored.jsdiff'));
  });

  it('return an empty string when no diff found', () => {
    assert.equal(diffString(a, a), '');
  });
});

describe('diff({ outputNewOnly: true }', () => {
  it('should return only new diffs (added)', () => {
    const response = diff({ foo: 42, bar: 10 }, { foo: 42, bar: 10, bbar: 5 }, { outputNewOnly: true });
    assert.deepEqual(response, { bbar: 5 });
  });

  it('should return only new diffs (changed)', () => {
    const response = diff({ foo: 42, bar: 10 }, { foo: 13, bar: 10, bbar: 5 }, { outputNewOnly: true });
    assert.deepEqual(response, { foo: 13, bbar: 5 });
  });

  it('should return only new diffs (deleted)', () => {
    const response = diff({ foo: 42, bar: 10 }, { bar: 10, bbar: 5 }, { outputNewOnly: true });
    assert.deepEqual(response, { bbar: 5 });
  });

  it('should return only old diffs - exchanged first and second json (added)', () => {
    const response = diff({ foo: 42, bar: 10, bbar: 5 }, { foo: 42, bar: 10 }, { outputNewOnly: true });
    assert.deepEqual(response, undefined);
  });

  it('should return only old diffs - exchanged first and second json (changed)', () => {
    const response = diff({ foo: 13, bar: 10, bbar: 5 }, { foo: 42, bar: 10 }, { outputNewOnly: true });
    assert.deepEqual(response, { foo: 42 });
  });

  it('should return only old diffs - exchanged first and second json (deleted)', () => {
    const response = diff({ bar: 10, bbar: 5 }, { foo: 42, bar: 10 }, { outputNewOnly: true });
    assert.deepEqual(response, { foo: 42 });
  });
});
