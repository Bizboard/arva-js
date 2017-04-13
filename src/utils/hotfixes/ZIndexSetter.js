/**
 * Created by tom on 21/01/16.
 * Credits: Hein Rutjes (2015)
 *
 * Fix z-index support for famo.us in MSIE / FF
 */
import ElementOutput                    from 'famous/core/ElementOutput';
import Bowser                           from 'bowser';

let browser = Bowser;

if (((browser.msie || browser.msedge) && parseFloat(browser.version) <= 11) ||
    (browser.chrome)) {
    //TODO: Check if this is still broken in Chrome v56
    duplicateZIndex();
} else if (browser.firefox && parseFloat(browser.version) <= 53) {
    removeSurfacePreserve3D();
}

function duplicateZIndex() {
    let oldCommit = ElementOutput.prototype.commit;
    ElementOutput.prototype.commit = function (context) {
        oldCommit.call(this, context);
        if (this._element) {
            /* Turns Z-property of matrix into an integer, and then into a string */
            let zIndex = this._matrix[14] | 0 + '';
            if (this._element.style.zIndex !== zIndex) {
                this._element.style.zIndex = zIndex;
            }
        }
    };
}

function removeSurfacePreserve3D() {
    let styleSheets = window.document.styleSheets;
    for (let sheetIndex in styleSheets) {
        let sheet = styleSheets[sheetIndex];
        if (sheet && sheet.href && sheet.href.indexOf('famous.css') !== -1) {
            for (let ruleIndex in sheet.cssRules) {
                let rule = sheet.cssRules[ruleIndex];
                if (rule && rule.selectorText === '.famous-surface') {
                    rule.style.removeProperty('transform-style');
                    rule.style.removeProperty('-moz-transform-style');
                    rule.style.removeProperty('-webkit-transform-style');
                }
            }
        }
    }
}