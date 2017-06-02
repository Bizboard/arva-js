/**
 * Created by lundfall on 02/06/2017.
 */
import Bowser           from 'bowser';
import Surface          from 'famous/core/Surface.js';
import ElementOutput    from 'famous/core/ElementOutput.js';


export let invalidateLayoutForElement = (element) => {
    var disp = element.style.display;
    element.style.display = 'none';
    var trick = element.offsetHeight;
    element.style.display = disp;
};


let browser = Bowser;

if (browser.gecko) {
    let oldAllocateFunction = Surface.prototype.allocate;
    Surface.prototype.allocate = function (allocator) {
        let result = oldAllocateFunction.call(this, allocator);
        //TOOO find out exact cause why this is necessary
        setTimeout(() => invalidateLayoutForElement(result), 200);

        return result;
    }

}
if (browser.safari) {
    let oldCommitFunction = ElementOutput.prototype.commit;
    ElementOutput.prototype.commit = function (context) {
        oldCommitFunction.call(this, context);
        if(this._wasHidden && !context.hide){
            invalidateLayoutForElement(this._element);
        }
        this._wasHidden = context.hide;
    }

}
