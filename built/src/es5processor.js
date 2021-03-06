"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var ts = require("typescript");
var rewriter_1 = require("./rewriter");
var tsickle_1 = require("./tsickle");
/**
 * Extracts the namespace part of a goog: import, or returns null if the given
 * import is not a goog: import.
 */
function extractGoogNamespaceImport(tsImport) {
    if (tsImport.match(/^goog:/))
        return tsImport.substring('goog:'.length);
    return null;
}
exports.extractGoogNamespaceImport = extractGoogNamespaceImport;
/**
 * ES5Processor postprocesses TypeScript compilation output JS, to rewrite commonjs require()s into
 * goog.require(). Contrary to its name it handles converting the modules in both ES5 and ES6
 * outputs.
 */
var ES5Processor = (function (_super) {
    __extends(ES5Processor, _super);
    function ES5Processor(host, file) {
        var _this = _super.call(this, file) || this;
        _this.host = host;
        /**
         * namespaceImports collects the variables for imported goog.modules.
         * If the original TS input is:
         *   import foo from 'goog:bar';
         * then TS produces:
         *   var foo = require('goog:bar');
         * and this class rewrites it to:
         *   var foo = require('goog.bar');
         * After this step, namespaceImports['foo'] is true.
         * (This is used to rewrite 'foo.default' into just 'foo'.)
         */
        _this.namespaceImports = new Set();
        /**
         * moduleVariables maps from module names to the variables they're assigned to.
         * Continuing the above example, moduleVariables['goog.bar'] = 'foo'.
         */
        _this.moduleVariables = new Map();
        /** strippedStrict is true once we've stripped a "use strict"; from the input. */
        _this.strippedStrict = false;
        /** unusedIndex is used to generate fresh symbols for unnamed imports. */
        _this.unusedIndex = 0;
        return _this;
    }
    ES5Processor.prototype.process = function () {
        var moduleId = this.host.fileNameToModuleId(this.file.fileName);
        // TODO(evanm): only emit the goog.module *after* the first comment,
        // so that @suppress statements work.
        var moduleName = this.host.pathToModuleName('', this.file.fileName);
        // NB: No linebreak after module call so sourcemaps are not offset.
        this.emit("goog.module('" + moduleName + "');");
        if (this.host.prelude)
            this.emit(this.host.prelude);
        // Allow code to use `module.id` to discover its module URL, e.g. to resolve
        // a template URL against.
        // Uses 'var', as this code is inserted in ES6 and ES5 modes.
        // The following pattern ensures closure doesn't throw an error in advanced
        // optimizations mode.
        if (this.host.es5Mode) {
            this.emit("var module = module || {id: '" + moduleId + "'};");
        }
        else {
            // The `exports = {}` serves as a default export to disable Closure Compiler's error checking
            // for mutable exports. That's OK because TS compiler makes sure that consuming code always
            // accesses exports through the module object, so mutable exports work.
            // It is only inserted in ES6 because we strip `.default` accesses in ES5 mode, which breaks
            // when assigning an `exports = {}` object and then later accessing it.
            this.emit(" exports = {}; var module = {id: '" + moduleId + "'};");
        }
        var pos = 0;
        try {
            for (var _a = __values(this.file.statements), _b = _a.next(); !_b.done; _b = _a.next()) {
                var stmt = _b.value;
                this.writeRange(this.file, pos, stmt.getFullStart());
                this.visitTopLevel(stmt);
                pos = stmt.getEnd();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_1) throw e_1.error; }
        }
        this.writeRange(this.file, pos, this.file.getEnd());
        var referencedModules = Array.from(this.moduleVariables.keys());
        // Note: don't sort referencedModules, as the keys are in the same order
        // they occur in the source file.
        var output = this.getOutput().output;
        return { output: output, referencedModules: referencedModules };
        var e_1, _c;
    };
    /**
     * visitTopLevel processes a top-level ts.Node and emits its contents.
     *
     * It's separate from the normal Rewriter recursive traversal
     * because some top-level statements are handled specially.
     */
    ES5Processor.prototype.visitTopLevel = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.ExpressionStatement:
                // Check for "use strict" and skip it if necessary.
                if (!this.strippedStrict && this.isUseStrict(node)) {
                    this.emitCommentWithoutStatementBody(node);
                    this.strippedStrict = true;
                    return;
                }
                // Check for:
                // - "require('foo');" (a require for its side effects)
                // - "__export(require(...));" (an "export * from ...")
                if (this.emitRewrittenRequires(node)) {
                    return;
                }
                // Check for
                //   Object.defineProperty(exports, "__esModule", ...);
                if (this.isEsModuleProperty(node)) {
                    this.emitCommentWithoutStatementBody(node);
                    return;
                }
                // Otherwise fall through to default processing.
                break;
            case ts.SyntaxKind.VariableStatement:
                // Check for a "var x = require('foo');".
                if (this.emitRewrittenRequires(node))
                    return;
                break;
            default:
                break;
        }
        this.visit(node);
    };
    /**
     * The TypeScript AST attaches comments to statement nodes, so even if a node
     * contains code we want to skip emitting, we need to emit the attached
     * comment(s).
     */
    ES5Processor.prototype.emitCommentWithoutStatementBody = function (node) {
        this.writeLeadingTrivia(node);
    };
    /** isUseStrict returns true if node is a "use strict"; statement. */
    ES5Processor.prototype.isUseStrict = function (node) {
        if (node.kind !== ts.SyntaxKind.ExpressionStatement)
            return false;
        var exprStmt = node;
        var expr = exprStmt.expression;
        if (expr.kind !== ts.SyntaxKind.StringLiteral)
            return false;
        var literal = expr;
        return literal.text === 'use strict';
    };
    /**
     * emitRewrittenRequires rewrites require()s into goog.require() equivalents.
     *
     * @return True if the node was rewritten, false if needs ordinary processing.
     */
    ES5Processor.prototype.emitRewrittenRequires = function (node) {
        // We're looking for requires, of one of the forms:
        // - "var importName = require(...);".
        // - "require(...);".
        if (node.kind === ts.SyntaxKind.VariableStatement) {
            // It's possibly of the form "var x = require(...);".
            var varStmt = node;
            // Verify it's a single decl (and not "var x = ..., y = ...;").
            if (varStmt.declarationList.declarations.length !== 1)
                return false;
            var decl = varStmt.declarationList.declarations[0];
            // Grab the variable name (avoiding things like destructuring binds).
            if (decl.name.kind !== ts.SyntaxKind.Identifier)
                return false;
            var varName = rewriter_1.getIdentifierText(decl.name);
            if (!decl.initializer || decl.initializer.kind !== ts.SyntaxKind.CallExpression)
                return false;
            var call = decl.initializer;
            var require_1 = this.isRequire(call);
            if (!require_1)
                return false;
            this.writeLeadingTrivia(node);
            this.emitGoogRequire(varName, require_1);
            return true;
        }
        else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            // It's possibly of the form:
            // - require(...);
            // - __export(require(...));
            // Both are CallExpressions.
            var exprStmt = node;
            var expr = exprStmt.expression;
            if (expr.kind !== ts.SyntaxKind.CallExpression)
                return false;
            var call = expr;
            var require_2 = this.isRequire(call);
            var isExport = false;
            if (!require_2) {
                // If it's an __export(require(...)), we emit:
                //   var x = require(...);
                //   __export(x);
                // This extra variable is necessary in case there's a later import of the
                // same module name.
                require_2 = this.isExportRequire(call);
                isExport = require_2 != null;
            }
            if (!require_2)
                return false;
            this.writeLeadingTrivia(node);
            var varName = this.emitGoogRequire(null, require_2);
            if (isExport) {
                this.emit("__export(" + varName + ");");
            }
            return true;
        }
        else {
            // It's some other type of statement.
            return false;
        }
    };
    /**
     * Emits a goog.require() statement for a given variable name and TypeScript import.
     *
     * E.g. from:
     *   var varName = require('tsImport');
     * produces:
     *   var varName = goog.require('goog.module.name');
     *
     * If the input varName is null, generates a new variable name if necessary.
     *
     * @return The variable name for the imported module, reusing a previous import if one
     *    is available.
     */
    ES5Processor.prototype.emitGoogRequire = function (varName, tsImport) {
        var modName;
        var isNamespaceImport = false;
        var nsImport = extractGoogNamespaceImport(tsImport);
        if (nsImport !== null) {
            // This is a namespace import, of the form "goog:foo.bar".
            // Fix it to just "foo.bar".
            modName = nsImport;
            isNamespaceImport = true;
        }
        else {
            modName = this.host.pathToModuleName(this.file.fileName, tsImport);
        }
        if (!varName) {
            var mv = this.moduleVariables.get(modName);
            if (mv) {
                // Caller didn't request a specific variable name and we've already
                // imported the module, so just return the name we already have for this module.
                return mv;
            }
            // Note: we always introduce a variable for any import, regardless of whether
            // the caller requested one.  This avoids a Closure error.
            varName = this.generateFreshVariableName();
        }
        if (isNamespaceImport)
            this.namespaceImports.add(varName);
        if (this.moduleVariables.has(modName)) {
            this.emit("var " + varName + " = " + this.moduleVariables.get(modName) + ";");
        }
        else {
            this.emit("var " + varName + " = goog.require('" + modName + "');");
            this.moduleVariables.set(modName, varName);
        }
        return varName;
    };
    // workaround for syntax highlighting bug in Sublime: `
    /**
     * Returns the string argument if call is of the form
     *   require('foo')
     */
    ES5Processor.prototype.isRequire = function (call) {
        // Verify that the call is a call to require(...).
        if (call.expression.kind !== ts.SyntaxKind.Identifier)
            return null;
        var ident = call.expression;
        if (rewriter_1.getIdentifierText(ident) !== 'require')
            return null;
        // Verify the call takes a single string argument and grab it.
        if (call.arguments.length !== 1)
            return null;
        var arg = call.arguments[0];
        if (arg.kind !== ts.SyntaxKind.StringLiteral)
            return null;
        return arg.text;
    };
    /**
     * Returns the inner string if call is of the form
     *   __export(require('foo'))
     */
    ES5Processor.prototype.isExportRequire = function (call) {
        if (call.expression.kind !== ts.SyntaxKind.Identifier)
            return null;
        var ident = call.expression;
        if (ident.getText() !== '__export')
            return null;
        // Verify the call takes a single call argument and check it.
        if (call.arguments.length !== 1)
            return null;
        var arg = call.arguments[0];
        if (arg.kind !== ts.SyntaxKind.CallExpression)
            return null;
        return this.isRequire(arg);
    };
    ES5Processor.prototype.isEsModuleProperty = function (expr) {
        // We're matching the explicit source text generated by the TS compiler.
        return expr.getText() === 'Object.defineProperty(exports, "__esModule", { value: true });';
    };
    /**
     * maybeProcess is called during the recursive traversal of the program's AST.
     *
     * @return True if the node was processed/emitted, false if it should be emitted as is.
     */
    ES5Processor.prototype.maybeProcess = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.PropertyAccessExpression:
                var propAccess = node;
                // We're looking for an expression of the form:
                //   module_name_var.default
                if (rewriter_1.getIdentifierText(propAccess.name) !== 'default')
                    break;
                if (propAccess.expression.kind !== ts.SyntaxKind.Identifier)
                    break;
                var lhs = rewriter_1.getIdentifierText(propAccess.expression);
                if (!this.namespaceImports.has(lhs))
                    break;
                // Emit the same expression, with spaces to replace the ".default" part
                // so that source maps still line up.
                this.writeLeadingTrivia(node);
                this.emit(lhs + "        ");
                return true;
            default:
                break;
        }
        return false;
    };
    /** Generates a new variable name inside the tsickle_ namespace. */
    ES5Processor.prototype.generateFreshVariableName = function () {
        return "tsickle_module_" + this.unusedIndex++ + "_";
    };
    return ES5Processor;
}(rewriter_1.Rewriter));
/**
 * Converts TypeScript's JS+CommonJS output to Closure goog.module etc.
 * For use as a postprocessing step *after* TypeScript emits JavaScript.
 *
 * @param fileName The source file name.
 * @param moduleId The "module id", a module-identifying string that is
 *     the value module.id in the scope of the module.
 * @param pathToModuleName A function that maps a filesystem .ts path to a
 *     Closure module name, as found in a goog.require('...') statement.
 *     The context parameter is the referencing file, used for resolving
 *     imports with relative paths like "import * as foo from '../foo';".
 * @param prelude An additional prelude to insert after the `goog.module` call,
 *     e.g. with additional imports or requires.
 */
function processES5(host, fileName, content) {
    var file = ts.createSourceFile(fileName, content, ts.ScriptTarget.ES5, true);
    return new ES5Processor(host, file).process();
}
exports.processES5 = processES5;
function convertCommonJsToGoogModuleIfNeeded(host, modulesManifest, fileName, content) {
    if (!host.googmodule || tsickle_1.isDtsFileName(fileName)) {
        return content;
    }
    var _a = processES5(host, fileName, content), output = _a.output, referencedModules = _a.referencedModules;
    var moduleName = host.pathToModuleName('', fileName);
    modulesManifest.addModule(fileName, moduleName);
    try {
        for (var referencedModules_1 = __values(referencedModules), referencedModules_1_1 = referencedModules_1.next(); !referencedModules_1_1.done; referencedModules_1_1 = referencedModules_1.next()) {
            var referenced = referencedModules_1_1.value;
            modulesManifest.addReferencedModule(fileName, referenced);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (referencedModules_1_1 && !referencedModules_1_1.done && (_b = referencedModules_1.return)) _b.call(referencedModules_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return output;
    var e_2, _b;
}
exports.convertCommonJsToGoogModuleIfNeeded = convertCommonJsToGoogModuleIfNeeded;

//# sourceMappingURL=es5processor.js.map
