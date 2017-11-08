/**
 * Created by lundfall on 02/06/2017.
 */
import Bowser           from 'bowser';
import Timer            from 'famous/utilities/Timer.js';
import {Surface}        from '../../surfaces/Surface.js';
import ImageSurface     from 'famous/surfaces/ImageSurface.js';
import ElementOutput    from 'famous/core/ElementOutput.js';


export let invalidateLayoutForElement = (element) => {
    var disp = element.style.display;
    element.style.display = 'none';
    var trick = element.offsetHeight;
    element.style.display = disp;
};


let browser = Bowser;

/* Firefox has an issue with new elements not being painted  */
if (browser.gecko) {
    let oldAllocateFunction = Surface.prototype.allocate;
    Surface.prototype.allocate = function (allocator) {
        let result = oldAllocateFunction.call(this, allocator);
        //TOOO find out exact cause why this is necessary
        setTimeout(() => invalidateLayoutForElement(result), 200);

        return result;
    }

}
/* Safari has an issue with elements coming back from scale 0 (context.hide==true) not being painted */
if (browser.safari) {
    let oldCommitFunction = ElementOutput.prototype.commit;
    ElementOutput.prototype.commit = function (context) {
        oldCommitFunction.call(this, context);
        if(this._wasHidden && !context.hide){
            invalidateLayoutForElement(this._element);
        }
        this._wasHidden = context.hide;
    };

    //Safari on mobile seems to have troubles displaying images
    let oldOnLoadedFunction = ImageSurface.prototype._onImageLoadedInDOM;
    ImageSurface.prototype._onImageLoadedInDOM = function () {
        Timer.after(() => {
            this._element && invalidateLayoutForElement(this._element);
        }, 1);
        return oldOnLoadedFunction.apply(this, arguments);
    }


}
