declare module '@jedluhmann/json-diff' {
  export type options = {
    verbose?: boolean;
    color?: boolean;
    raw?: boolean;
    full?: boolean;
    maxElisions?: number;
    outputKeys?: string[];
    excludeKeys?: string[];
    outputNewOnly?: boolean;
    keysOnly?: boolean;
    sort?: boolean;
    keepUnchangedValues?: boolean;
    precision?: number;
    debug?: boolean;
    silent?: boolean;
  };

  export class JsonDiff {
    constructor(options?: options);

    get options(): options;
    set options(opts: options);
    exec(obj1: any, obj2: any): Promise<any>;
    diff(obj1: any, obj2: any, path: string): Promise<any>;
  }
}
