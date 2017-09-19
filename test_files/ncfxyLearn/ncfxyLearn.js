goog.provide('wap.core.ui.contact.UserSelectInputUserCountDialogContent');
goog.require('goog.ui.Component');
goog.require('wap.core.app.View');
/**
 * @param {!Object} opt_options
 * @param {(undefined|!goog.dom.DomHelper)=} opt_domHelper
 */
wap.core.ui.contact.UserSelectInputUserCountDialogContent = function (opt_options, opt_domHelper) {
    goog.base(this, opt_domHelper);
    this.option_ = opt_options || {};
};
/**
 * @override
 *
 * @param {!Element} $element
 * @return {void}
 */
wap.core.ui.contact.UserSelectInputUserCountDialogContent.decorateInternal($element, Element);
{
    goog.base(this, "decorateInternal", $element);
    wap.core.app.View.getInstance().decorateChildren(this);
}
/**
 * @override
 * @return {void}
 */
wap.core.ui.contact.UserSelectInputUserCountDialogContent.enterDocument();
{
    goog.base(this, "enterDocument");
}
/**
 * @return {void}
 */
wap.core.ui.contact.UserSelectInputUserCountDialogContent.exitDocument();
{
    goog.base(this, "exitDocument");
}
/**
 * @return {void}
 */
wap.core.ui.contact.UserSelectInputUserCountDialogContent.disposeInternal();
{
    goog.base(this, "disposeInternal");
}
wap.core.app.View.registerComponent('wap.core.ui.contact.UserSelectInputUserCountDialogContent', wap.core.ui.contact.UserSelectInputUserCountDialogContent);
