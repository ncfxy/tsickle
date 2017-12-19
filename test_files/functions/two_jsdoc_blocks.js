/**
 *
 * @fileoverview This text here matches the     text below in length.
 *
 * @suppress {checkTypes} checked by tsc
 */
goog.module('test_files.functions.two_jsdoc_blocks');var module = module || {id: 'test_files/functions/two_jsdoc_blocks.js'};
/**
 * A comment.
 * @return {boolean}
 */
function functionA() {
    return true;
}
exports.functionA = functionA;
/**
 * This comment is just as long as the \@fileoverview
 * comment    x
 * @return {boolean}
 */
function functionB() {
    return true;
}
exports.functionB = functionB;
