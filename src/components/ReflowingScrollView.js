/**
 @author: Karl Lundfall (lundfall)
 @license NPOSL-3.0
 @copyright Bizboard, 2015
 */

import FlexScrollView   from 'famous-flex/FlexScrollView.js';
import {ObjectHelper}   from '../utils/ObjectHelper.js';

/**
 * Class extended by the dataBoundScrollView and for wrapping up a View.
 * It automatically listens for reflows and handles them accordingly
 */
export class ReflowingScrollView extends FlexScrollView {

    /**
     * Constructor does not add any new options.
     *
     * @param options
     */
    constructor(options = {}) {
        super(options);
        ObjectHelper.bindAllMethods(this, this);
        this._eventInput.on('recursiveReflow', this._reflowWhenPossible)
    }

    _reflowWhenPossible() {
        if ((!this.isScrolling() && !this._nodes._reevalTrueSize) || !this._didReflowOnce) {
            this.reLayout();
            this._didReflowOnce = true;
        }
    }

    _addItem() {
        /* Views that use this ReflowingScrollView should manually subscribe to this event,
         * since it does not automatically bubble to Arva's View.js.
         */
        this._eventOutput.emit('resize');
    }

    _removeItem() {
        /* Views that use this ReflowingScrollView should manually subscribe to this event,
         * since it does not automatically bubble to Arva's View.js.
         */
        this._eventOutput.emit('resize');
    }

}
