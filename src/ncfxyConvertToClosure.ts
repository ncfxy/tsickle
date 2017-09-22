
import * as fs from 'fs';
import * as minimist from 'minimist';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';

import * as cliSupport from './cli_support';
import * as tsickel from './tsickle';
import {ModulesManifest} from './tsickle';
import {createSourceReplacingCompilerHost} from './util';

/** Base compiler options to be customized and exposed. */
const baseCompilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2015,
    // Disable searching for @types typings. This prevents TS from looking
    // around for a node_modules directory.
    types: [],
    skipDefaultLibCheck: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.CommonJS,
    strictNullChecks: true,
    noImplicitUseStrict: true,
};

/** The TypeScript compiler options used by the test suite. */
export const compilerOptions: ts.CompilerOptions = {
    ...baseCompilerOptions,
    emitDecoratorMetadata: true,
    noEmitHelpers: true,
    jsx: ts.JsxEmit.React,
    // Flags below are needed to make sure source paths are correctly set on write calls.
    rootDir: path.resolve(process.cwd()),
    outDir: './ncfxyOut',
};

const {cachedLibPath, cachedLib} = (() => {
    const host = ts.createCompilerHost(baseCompilerOptions);
    const fn = host.getDefaultLibFileName(baseCompilerOptions);
    const p = ts.getDefaultLibFilePath(baseCompilerOptions);
    return {
        // Normalize path to fix mixed/wrong directory separators on Windows.
        cachedLibPath: path.normalize(p),
        cachedLib: host.getSourceFile(fn, baseCompilerOptions.target!),
    };
})();


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

function usage() {
    console.error(`usage: tsickle [tsickle options] -- [tsc options]
    
    example:
      tsickle --externs=foo/externs.js -- -p src --noImplicitAny
    
    tsickle flags are:
      --externs=PATH     save generated Closure externs.js to PATH
      --typed            [experimental] attempt to provide Closure types instead of {?}
    `);
}

/**
 * Parses the command-line arguments, extracting the tsickle settings and
 * the arguments to pass on to tsc.
 */
function loadSettingsFromArgs(args: string[]): {settings: Settings, tscArgs: string[]} {
    const settings: Settings = {};
    const parsedArgs = minimist(args);
    for(const flag of Object.keys(parsedArgs)) {
        switch(flag) {
            case 'h' :
            case 'help':
                usage();
                process.exit();
                break;
            case 'externs':
                settings.externsPath = parsedArgs[flag];
                break;
            case 'typed':
                settings.isTyped = true;
                break;
            case 'verbose':
                settings.verbose = true;
                break;
            case '_':
                // This is part of the minimist API, and hold args after the '--'.
                break;
            default:
                console.error(`unknown flag '--${flag}'`);
                usage();
                process.exit(1);
        }
    }
    // Arguments after the '--' arg are arguments to tsc.
    const tscArgs = parsedArgs['_'];
    return {settings, tscArgs};
}

function loadTscConfig(args: string[]):
        {options: ts.CompilerOptions, fileNames: string[], errors: ts.Diagnostic[]} {
    // Gather tsc options/input files from command line.
    let {options, fileNames, errors} = ts.parseCommandLine(args);
    if(errors.length > 0) {
        return {options:{}, fileNames:[],errors};
    }

    // Store file arguments
    const tsFileArguments = fileNames;

    // Read further settings from tsconfig.json.
    const projectDir = options.project || '.';
    const configFileName = path.join(projectDir, 'tsconfig.json');
    const {config: json, error} = 
        ts.readConfigFile(configFileName, path => fs.readFileSync(path, 'utf-8'));
    if(error){
        return {options:{}, fileNames: [], errors: [error]};
    }
    ({options, fileNames, errors} =
        ts.parseJsonConfigFileContent(json, ts.sys, projectDir, options, configFileName));
    
    if(errors.length > 0){
        return {options: {}, fileNames: [], errors};
    }

    // if file arguments were given to the typescript transpiler then transpile only those files
    fileNames = tsFileArguments.length > 0 ? tsFileArguments : fileNames;

    return {options, fileNames, errors:[]};
}

export function createSourceCachingHost(
    sources: Map<string, string>,
    tsCompilerOptions: ts.CompilerOptions = compilerOptions): ts.CompilerHost {
  const host = ts.createCompilerHost(tsCompilerOptions);

  host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget,
                        onError?: (msg: string) => void): ts.SourceFile => {
    // Normalize path to fix wrong directory separators on Windows which
    // would break the equality check.
    fileName = path.normalize(fileName);
    if (fileName === cachedLibPath) return cachedLib;
    if (path.isAbsolute(fileName)) fileName = path.relative(process.cwd(), fileName);
    fileName = glob.sync(fileName)[0];
    const contents = sources.get(fileName);
    if (contents !== undefined) {
      return ts.createSourceFile(fileName, contents, ts.ScriptTarget.Latest, true);
    }
    throw new Error(
        'unexpected file read of ' + fileName + ' not in ' + Array.from(sources.keys()));
  };
  const originalFileExists = host.fileExists;
  host.fileExists = (fileName: string): boolean => {
    if (path.isAbsolute(fileName)) fileName = path.relative(process.cwd(), fileName);
    fileName = glob.sync(fileName)[0];
    if (sources.has(fileName)) {
      return true;
    }
    return originalFileExists.call(host, fileName);
  };

  return host;
}

/**
 * Compiles TypeScript code into Closure-compiler-ready JS.
 */
export function toClosureJS(options: ts.CompilerOptions, fileNames: string[], settings: Settings, writeFile?: ts.WriteFileCallback): tsickel.EmitResult {
    // const compileHost = ts.createCompilerHost(options);
    const tsSources = new Map<string, string>();
    for (const tsFile of fileNames) {
      const tsSource = fs.readFileSync(tsFile, 'utf-8');
      tsSources.set(tsFile, tsSource);
    }
    const compileHost = createSourceCachingHost(tsSources, compilerOptions);
    
    const program = ts.createProgram(fileNames, compilerOptions, compileHost);
    const transformerHost: tsickel.TsickleHost = {
        shouldSkipTsickleProcessing: (fileName: string) => {
            return fileNames.indexOf(fileName) === -1;
        },
        shouldIgnoreWarningsForPath: (fileName:string) => false,
        pathToModuleName: cliSupport.pathToModuleName,
        fileNameToModuleId:(fileName)=> fileName,
        es5Mode: true,
        googmodule: false,
        prelude: '',
        transformDecorators: true,
        transformTypesToClosure: true,
        typeBlackListPaths: new Set(),
        untyped: false,
        logWarning: (warning) => console.error(tsickel.formatDiagnostics([warning]))
    };
    const diagnostics = ts.getPreEmitDiagnostics(program);
    // if(diagnostics.length > 0){
    //     return {
    //         diagnostics,
    //         modulesManifest: new ModulesManifest(),
    //         externs: {},
    //         emitSkipped: true,
    //         emittedFiles: []
    //     };
    // }
    return tsickel.emitWithTsickle(program, transformerHost, compileHost, options, undefined, writeFile);
}

function main(args: string[]): number {
    const {settings, tscArgs} = loadSettingsFromArgs(args);
    const config = loadTscConfig(tscArgs);
    if(config.errors.length){
        console.error(tsickel.formatDiagnostics(config.errors));
        return 1;
    }

    if(config.options.module !== ts.ModuleKind.CommonJS) {
        // This is not an upstream TypeScript diagnostic, therefore it does not go 
        // through the diagnostics array mechanism.
        console.error(
            'tsickle converts TypeScript modules to Closure modules via CommonJS internally. ' +
            'Set tsconfig.js "module":"commonjs"');
        return 1;
    }

    // Run tsickle +TSC to convert inputs to Closure JS files.
    const result = toClosureJS(
        config.options, config.fileNames, settings, (filePath: string, contents: string) => {
            mkdirp.sync(path.dirname(filePath));
            fs.writeFileSync(filePath, contents, {encoding: 'utf-8'});
        }
    );
    // if(result.diagnostics.length) {
    //     console.error(tsickel.formatDiagnostics(result.diagnostics));
    //     return 1;
    // }

    if(settings.externsPath) {
        mkdirp.sync(path.dirname(settings.externsPath));
        fs.writeFileSync(settings.externsPath, tsickel.getGeneratedExterns(result.externs));
    }
    return 0;
}

// CIL entry point
if(require.main === module){
    process.exit(main(process.argv.splice(2)));
}