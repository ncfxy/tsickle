"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var minimist = require("minimist");
var mkdirp = require("mkdirp");
var path = require("path");
var ts = require("typescript");
var glob = require("glob");
var cliSupport = require("./cli_support");
var tsickel = require("./tsickle");
/** Base compiler options to be customized and exposed. */
var baseCompilerOptions = {
    target: ts.ScriptTarget.ES2015,
    // Disable searching for @types typings. This prevents TS from looking
    // around for a node_modules directory.
    types: ['node', 'myclosure', 'my-google-closure-types.ts'],
    skipDefaultLibCheck: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.CommonJS,
    strictNullChecks: true,
    noImplicitUseStrict: true,
};
/** The TypeScript compiler options used by the test suite. */
exports.compilerOptions = __assign({}, baseCompilerOptions, { emitDecoratorMetadata: true, noEmitHelpers: true, jsx: ts.JsxEmit.React, 
    // Flags below are needed to make sure source paths are correctly set on write calls.
    rootDir: path.resolve(process.cwd()), outDir: 'ncfxyOut', declaration: false, declarationDir: "ncfxyOutDeclaration" });
var _a = (function () {
    var host = ts.createCompilerHost(baseCompilerOptions);
    var fn = host.getDefaultLibFileName(baseCompilerOptions);
    var p = ts.getDefaultLibFilePath(baseCompilerOptions);
    return {
        // Normalize path to fix mixed/wrong directory separators on Windows.
        cachedLibPath: path.normalize(p),
        cachedLib: host.getSourceFile(fn, baseCompilerOptions.target),
    };
})(), cachedLibPath = _a.cachedLibPath, cachedLib = _a.cachedLib;
function usage() {
    console.error("usage: tsickle [tsickle options] -- [tsc options]\n    \n    example:\n      tsickle --externs=foo/externs.js -- -p src --noImplicitAny\n    \n    tsickle flags are:\n      --externs=PATH     save generated Closure externs.js to PATH\n      --typed            [experimental] attempt to provide Closure types instead of {?}\n    ");
}
/**
 * Parses the command-line arguments, extracting the tsickle settings and
 * the arguments to pass on to tsc.
 */
function loadSettingsFromArgs(args) {
    var settings = {};
    var parsedArgs = minimist(args);
    try {
        for (var _a = __values(Object.keys(parsedArgs)), _b = _a.next(); !_b.done; _b = _a.next()) {
            var flag = _b.value;
            switch (flag) {
                case 'h':
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
                    console.error("unknown flag '--" + flag + "'");
                    usage();
                    process.exit(1);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Arguments after the '--' arg are arguments to tsc.
    var tscArgs = parsedArgs['_'];
    return { settings: settings, tscArgs: tscArgs };
    var e_1, _c;
}
function loadTscConfig(args) {
    // Gather tsc options/input files from command line.
    var _a = ts.parseCommandLine(args), options = _a.options, fileNames = _a.fileNames, errors = _a.errors;
    if (errors.length > 0) {
        return { options: {}, fileNames: [], errors: errors };
    }
    // Store file arguments
    var tsFileArguments = fileNames;
    // Read further settings from tsconfig.json.
    // Don't read from tsconfig.json
    // const projectDir = options.project || '.';
    // const configFileName = path.join(projectDir, 'tsconfig.json');
    // const {config: json, error} = 
    //     ts.readConfigFile(configFileName, path => fs.readFileSync(path, 'utf-8'));
    // if(error){
    //     return {options:{}, fileNames: [], errors: [error]};
    // }
    // ({options, fileNames, errors} =
    //     ts.parseJsonConfigFileContent(json, ts.sys, projectDir, options, configFileName));
    // if(errors.length > 0){
    //     return {options: {}, fileNames: [], errors};
    // }
    // // if file arguments were given to the typescript transpiler then transpile only those files
    // fileNames = tsFileArguments.length > 0 ? tsFileArguments : fileNames;
    if (!options) {
        options = {};
    }
    options.module = ts.ModuleKind.CommonJS;
    return { options: options, fileNames: fileNames, errors: [] };
}
function createSourceCachingHost(sources, tsCompilerOptions) {
    if (tsCompilerOptions === void 0) { tsCompilerOptions = exports.compilerOptions; }
    var host = ts.createCompilerHost(tsCompilerOptions);
    host.getSourceFile = function (fileName, languageVersion, onError) {
        // Normalize path to fix wrong directory separators on Windows which
        // would break the equality check.
        fileName = path.normalize(fileName);
        if (fileName === cachedLibPath)
            return cachedLib;
        if (path.isAbsolute(fileName))
            fileName = path.relative(process.cwd(), fileName);
        fileName = glob.sync(fileName)[0];
        var contents = sources.get(fileName);
        if (contents !== undefined) {
            return ts.createSourceFile(fileName, contents, ts.ScriptTarget.Latest, true);
        }
        else {
            var sourceContent = fs.readFileSync(fileName, 'utf-8');
            return ts.createSourceFile(fileName, sourceContent, ts.ScriptTarget.Latest, true);
        }
        // throw new Error(
        //     'unexpected file read of ' + fileName + ' not in ' + Array.from(sources.keys()));
    };
    var originalFileExists = host.fileExists;
    host.fileExists = function (fileName) {
        if (path.isAbsolute(fileName))
            fileName = path.relative(process.cwd(), fileName);
        fileName = glob.sync(fileName)[0];
        if (sources.has(fileName)) {
            return true;
        }
        return originalFileExists.call(host, fileName);
    };
    return host;
}
exports.createSourceCachingHost = createSourceCachingHost;
/**
 * Compiles TypeScript code into Closure-compiler-ready JS.
 */
function toClosureJS(options, fileNames, settings, writeFile) {
    // const compileHost = ts.createCompilerHost(options);
    var tsSources = new Map();
    try {
        for (var fileNames_1 = __values(fileNames), fileNames_1_1 = fileNames_1.next(); !fileNames_1_1.done; fileNames_1_1 = fileNames_1.next()) {
            var tsFile = fileNames_1_1.value;
            var tsSource = fs.readFileSync(tsFile, 'utf-8');
            tsSources.set(tsFile, tsSource);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (fileNames_1_1 && !fileNames_1_1.done && (_a = fileNames_1.return)) _a.call(fileNames_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    if (options.outDir) {
        exports.compilerOptions.outDir = options.outDir;
    }
    var compileHost = createSourceCachingHost(tsSources, exports.compilerOptions);
    var program = ts.createProgram(fileNames, exports.compilerOptions, compileHost);
    var transformerHost = {
        shouldSkipTsickleProcessing: function (fileName) {
            return fileNames.indexOf(fileName) === -1;
        },
        shouldIgnoreWarningsForPath: function (fileName) { return false; },
        pathToModuleName: cliSupport.pathToModuleName,
        fileNameToModuleId: function (fileName) { return fileName; },
        es5Mode: true,
        googmodule: false,
        prelude: '',
        transformDecorators: true,
        transformTypesToClosure: true,
        typeBlackListPaths: new Set(),
        untyped: false,
        logWarning: function (warning) { return console.error(tsickel.formatDiagnostics([warning])); }
    };
    var diagnostics = ts.getPreEmitDiagnostics(program);
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
    var e_2, _a;
}
exports.toClosureJS = toClosureJS;
function main(args) {
    var _a = loadSettingsFromArgs(args), settings = _a.settings, tscArgs = _a.tscArgs;
    var config = loadTscConfig(tscArgs);
    if (config.errors.length) {
        console.error(tsickel.formatDiagnostics(config.errors));
        return 1;
    }
    if (config.options.module !== ts.ModuleKind.CommonJS) {
        // This is not an upstream TypeScript diagnostic, therefore it does not go 
        // through the diagnostics array mechanism.
        console.error('tsickle converts TypeScript modules to Closure modules via CommonJS internally. ' +
            'Set tsconfig.js "module":"commonjs"');
        return 1;
    }
    // Run tsickle +TSC to convert inputs to Closure JS files.
    var result = toClosureJS(config.options, config.fileNames, settings, function (filePath, contents) {
        mkdirp.sync(path.dirname(filePath));
        fs.writeFileSync(filePath, contents, { encoding: 'utf-8' });
    });
    // if(result.diagnostics.length) {
    //     console.error(tsickel.formatDiagnostics(result.diagnostics));
    //     return 1;
    // }
    if (settings.externsPath) {
        mkdirp.sync(path.dirname(settings.externsPath));
        fs.writeFileSync(settings.externsPath, tsickel.getGeneratedExterns(result.externs));
    }
    return 0;
}
exports.main = main;
// CIL entry point
if (require.main === module) {
    process.exit(main(process.argv.splice(2)));
}

//# sourceMappingURL=ncfxyConvertToClosure.js.map
