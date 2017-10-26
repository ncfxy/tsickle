"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var jsdoc = require("./jsdoc");
var transformer_util_1 = require("./transformer_util");
/**
 * A set of JSDoc tags that mark a comment as a fileoverview comment. These are recognized by other
 * pieces of infrastructure (Closure Compiler, module system, ...).
 */
var FILEOVERVIEW_COMMENT_MARKERS = new Set(['fileoverview', 'externs', 'modName', 'mods', 'pintomodule']);
/**
 * A transformer that ensures the emitted JS file has an \@fileoverview comment that contains an
 * \@suppress {checkTypes} annotation by either adding or updating an existing comment.
 */
function transformFileoverviewComment(context) {
    return function (sf) {
        var comments = [];
        // Use trailing comments because that's what transformer_util.ts creates (i.e. by convention).
        if (sf.statements.length && sf.statements[0].kind === ts.SyntaxKind.NotEmittedStatement) {
            comments = ts.getSyntheticTrailingComments(sf.statements[0]) || [];
        }
        var fileoverviewIdx = -1;
        var parsed = null;
        for (var i = comments.length - 1; i >= 0; i--) {
            var current = jsdoc.parseContents(comments[i].text);
            if (current !== null && current.tags.some(function (t) { return FILEOVERVIEW_COMMENT_MARKERS.has(t.tagName); })) {
                fileoverviewIdx = i;
                parsed = current;
                break;
            }
        }
        // Add a @suppress {checkTypes} tag to each source file's JSDoc comment,
        // being careful to retain existing comments and their @suppress'ions.
        // Closure Compiler considers the *last* comment with @fileoverview (or @externs or @nocompile)
        // that has not been attached to some other tree node to be the file overview comment, and
        // only applies @suppress tags from it.
        // AJD considers *any* comment mentioning @fileoverview.
        if (!parsed) {
            // No existing comment to merge with, just emit a new one.
            return addNewFileoverviewComment(sf);
        }
        // Add @suppress {checkTypes}, or add to the list in an existing @suppress tag.
        // Closure compiler barfs if there's a duplicated @suppress tag in a file, so the tag must
        // only appear once and be merged.
        var tags = parsed.tags;
        var suppressTag = tags.find(function (t) { return t.tagName === 'suppress'; });
        if (suppressTag) {
            var suppressions = suppressTag.type || '';
            var suppressionsList = suppressions.split(',').map(function (s) { return s.trim(); });
            if (suppressionsList.indexOf('checkTypes') === -1) {
                suppressionsList.push('checkTypes');
            }
            suppressTag.type = suppressionsList.join(',');
        }
        else {
            tags.push({
                tagName: 'suppress',
                type: 'checkTypes',
                text: 'checked by tsc',
            });
        }
        var commentText = jsdoc.toStringWithoutStartEnd(tags);
        comments[fileoverviewIdx].text = commentText;
        // sf does not need to be updated, synthesized comments are mutable.
        return sf;
    };
}
exports.transformFileoverviewComment = transformFileoverviewComment;
function addNewFileoverviewComment(sf) {
    var commentText = jsdoc.toStringWithoutStartEnd([
        { tagName: 'fileoverview', text: 'added by tsickle' },
        { tagName: 'suppress', type: 'checkTypes', text: 'checked by tsc' },
    ]);
    var syntheticFirstStatement = transformer_util_1.createNotEmittedStatement(sf);
    syntheticFirstStatement = ts.addSyntheticTrailingComment(syntheticFirstStatement, ts.SyntaxKind.MultiLineCommentTrivia, commentText, true);
    return transformer_util_1.updateSourceFileNode(sf, ts.createNodeArray(__spread(sf.statements)));
}

//# sourceMappingURL=fileoverview_comment_transformer.js.map
