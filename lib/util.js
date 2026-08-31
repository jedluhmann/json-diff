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
