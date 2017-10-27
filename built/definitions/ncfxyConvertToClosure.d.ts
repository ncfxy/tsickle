import * as ts from 'typescript';
import * as tsickel from './tsickle';
/** The TypeScript compiler options used by the test suite. */
export declare const compilerOptions: ts.CompilerOptions;
/**
 * Tsickle settings passed on the command line.
 */
export interface Settings {
    /** If provided, path to save externs to. */
    externsPath?: string;
    /** If provided, attempt to provide types rather than {?}. */
    isTyped?: boolean;
    /** If true, log internal debug warnings to the console. */
    verbose?: boolean;
}
export declare function createSourceCachingHost(sources: Map<string, string>, tsCompilerOptions?: ts.CompilerOptions): ts.CompilerHost;
/**
 * Compiles TypeScript code into Closure-compiler-ready JS.
 */
export declare function toClosureJS(options: ts.CompilerOptions, fileNames: string[], settings: Settings, writeFile?: ts.WriteFileCallback): tsickel.EmitResult;
export declare function main(args: string[]): number;
