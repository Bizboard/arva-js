/**
 * Created by tom on 21/01/16.
 * Credits: Hein Rutjes (2015)
 *
 * Fix z-index support for famo.us in MSIE / FF
 */
import ElementOutput                    from 'famous/core/ElementOutput';
import Bowser                           from 'bowser';

let browser = Bowser;

if (browser.firefox && parseFloat(browser.version) <= 53) {
    removeSurfacePreserve3D();
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