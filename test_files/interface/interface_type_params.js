/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
goog.module('test_files.interface.interface_type_params');var module = module || {id: 'test_files/interface/interface_type_params.js'};/**
 * @record
 */
function UpperBound() { }
function UpperBound_tsickle_Closure_declarations() {
    /** @type {number} */
    UpperBound.prototype.x;
}
// unsupported: template constraints.
/**
 * @record
 * @template T, U
 */
function WithTypeParam() { }
function WithTypeParam_tsickle_Closure_declarations() {
    /** @type {T} */
    WithTypeParam.prototype.tea;
    /** @type {U} */
    WithTypeParam.prototype.you;
}
