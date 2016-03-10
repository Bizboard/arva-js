/**
 * Created by tom on 21/01/16.
 * Credits: Hein Rutjes (2015)
 *
 * Fix z-index support for famo.us in MSIE / FF
 */
import ElementOutput                    from 'famous/core/ElementOutput';
import Bowser                           from 'bowser';

(function () {
    let browser = Bowser;

    if ((browser.msie || browser.msedge) && parseFloat(browser.version) <= 11) {
        duplicateZIndex();
    } else if (browser.firefox && parseFloat(browser.version) <= 37) {
        removeSurfacePreserve3D();
    }

    function duplicateZIndex() {
        let oldCommit = ElementOutput.prototype.commit;
        ElementOutput.prototype.commit = function (context) {
            oldCommit.call(this, context);
            if (this._element) {
                var zIndex = this._matrix[14];
                if (this._element.style.zIndex !== zIndex) {
                    this._element.style.zIndex = zIndex;
                }
            }
        };
    }

    function removeSurfacePreserve3D() {
        debugger;
        let styleSheets = window.document.styleSheets;
        for(let sheetIndex in styleSheets) {
            let sheet = styleSheets[sheetIndex];
            if(sheet && sheet.href && sheet.href.indexOf('famous.css') !== -1) {
                for(let ruleIndex in sheet.cssRules) {
                    let rule = sheet.cssRules[ruleIndex];
                    if(rule && rule.selectorText === '.famous-surface') {
                        rule.style.removeProperty('transform-style');
                        rule.style.removeProperty('-moz-transform-style');
                        rule.style.removeProperty('-webkit-transform-style');
                    }
                }
            }
        }
    }
})();