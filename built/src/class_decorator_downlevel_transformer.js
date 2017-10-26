"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
var decorator_annotator_1 = require("./decorator-annotator");
var transformer_util_1 = require("./transformer_util");
/**
 * Creates the AST for the decorator field type annotation, which has the form
 * { type: Function, args?: any[] }[]
 */
function createClassDecoratorType() {
    var typeElements = [];
    typeElements.push(ts.createPropertySignature(undefined, 'type', undefined, ts.createTypeReferenceNode(ts.createIdentifier('Function'), undefined), undefined));
    typeElements.push(ts.createPropertySignature(undefined, 'args', ts.createToken(ts.SyntaxKind.QuestionToken), ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)), undefined));
    return ts.createArrayTypeNode(ts.createTypeLiteralNode(typeElements));
}
/**
 * Extracts the type of the decorator, as well as all the arguments passed to
 * the decorator.  Returns an AST with the form
 * { type: decorator, args: [arg1, arg2] }
 */
function extractMetadataFromSingleDecorator(decorator, diagnostics) {
    var metadataProperties = [];
    var expr = decorator.expression;
    switch (expr.kind) {
        case ts.SyntaxKind.Identifier:
            // The decorator was a plain @Foo.
            metadataProperties.push(ts.createPropertyAssignment('type', expr));
            break;
        case ts.SyntaxKind.CallExpression:
            // The decorator was a call, like @Foo(bar).
            var call = expr;
            metadataProperties.push(ts.createPropertyAssignment('type', call.expression));
            if (call.arguments.length) {
                var args = [];
                try {
                    for (var _a = __values(call.arguments), _b = _a.next(); !_b.done; _b = _a.next()) {
                        var arg = _b.value;
                        args.push(arg);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                var argsArrayLiteral = ts.createArrayLiteral(args);
                argsArrayLiteral.elements.hasTrailingComma = true;
                metadataProperties.push(ts.createPropertyAssignment('args', argsArrayLiteral));
            }
            break;
        default:
            diagnostics.push({
                file: decorator.getSourceFile(),
                start: decorator.getStart(),
                length: decorator.getEnd() - decorator.getStart(),
                messageText: ts.SyntaxKind[decorator.kind] + " not implemented in gathering decorator metadata",
                category: ts.DiagnosticCategory.Error,
                code: 0,
            });
            break;
    }
    return ts.createObjectLiteral(metadataProperties);
    var e_1, _c;
}
/**
 * Takes a list of decorator metadata object ASTs and produces an AST for a
 * static class property of an array of those metadata objects.
 */
function createDecoratorClassProperty(decoratorList) {
    var modifier = ts.createToken(ts.SyntaxKind.StaticKeyword);
    var type = createClassDecoratorType();
    var initializer = ts.createArrayLiteral(decoratorList, true);
    initializer.elements.hasTrailingComma = true;
    return ts.createProperty(undefined, [modifier], 'decorators', undefined, type, initializer);
}
function isNameEqual(classMember, name) {
    if (classMember.name === undefined) {
        return false;
    }
    var id = classMember.name;
    return id.text === name;
}
/**
 * Inserts the decorator metadata property in the place that the old
 * decorator-annotator visitor would put it, so the unit tests don't have to
 * change.
 * TODO(lucassloan): remove this when all 3 properties are put in via
 * transformers
 */
function insertBeforeDecoratorProperties(classMembers, decoratorMetadata) {
    var insertionPoint = classMembers.findIndex(function (m) { return isNameEqual(m, 'ctorParameters') || isNameEqual(m, 'propDecorators'); });
    if (insertionPoint === -1) {
        insertionPoint = classMembers.length - 1;
    }
    classMembers.splice(insertionPoint, 0, decoratorMetadata);
}
function classDecoratorDownlevelTransformer(typeChecker, diagnostics) {
    return function (context) {
        var visitor = function (node) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                    var cd = transformer_util_1.visitEachChild(node, visitor, context);
                    var decorators = cd.decorators;
                    if (decorators === undefined || decorators.length === 0)
                        return cd;
                    var decoratorList = [];
                    try {
                        for (var decorators_1 = __values(decorators), decorators_1_1 = decorators_1.next(); !decorators_1_1.done; decorators_1_1 = decorators_1.next()) {
                            var decorator = decorators_1_1.value;
                            if (decorator_annotator_1.shouldLower(decorator, typeChecker)) {
                                decoratorList.push(extractMetadataFromSingleDecorator(decorator, diagnostics));
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (decorators_1_1 && !decorators_1_1.done && (_a = decorators_1.return)) _a.call(decorators_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    if (decoratorList.length === 0)
                        return cd;
                    var newClassDeclaration = ts.getMutableClone(cd);
                    insertBeforeDecoratorProperties(newClassDeclaration.members, createDecoratorClassProperty(decoratorList));
                    newClassDeclaration.decorators = undefined;
                    return newClassDeclaration;
                default:
                    return transformer_util_1.visitEachChild(node, visitor, context);
            }
            var e_2, _a;
        };
        return function (sf) { return visitor(sf); };
    };
}
exports.classDecoratorDownlevelTransformer = classDecoratorDownlevelTransformer;

//# sourceMappingURL=class_decorator_downlevel_transformer.js.map
