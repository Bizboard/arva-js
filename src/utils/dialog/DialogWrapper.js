/**
 * Created by Manuel on 08/02/2017.
 */

import {View}               from '../../core/View.js';
import {layout}             from '../../layout/Decorators.js';

@layout.scrollable({overscroll: false, scrollSync: {preventDefault: false}})
export class DialogWrapper extends View {

    /**
     * Defines the size that is appropriate for the dialog. The dialog can return undefined on its getSize function for
     * full-blown sizing instead of true sizing, and it can define a maxSize to specify a maximum that causes the margins
     * to get larger.
     * @param size
     */
    determineSizeWithMargins (size, maxSize, dimension) {
        return ~Math.min(maxSize ? maxSize[dimension] : 480, size[dimension] - 32);
    }

    @layout.size(function(...size) {return this.determineSizeWithMargins(size, this.options.dialog.maxSize, 0)},
        function(...size) {return this.determineSizeWithMargins(size, this.options.dialog.maxSize, 1)})
    @layout.stick.center()
    dialog = this.options.dialog;

    onNewParentSize(parentSize) {
        this._parentSize = parentSize;
    }

    /**
     * The getSize function is used to determine the size by the scrolling behaviour. It will try to make sure that
     * a too big dialog can be scrolled. If this isn't possible, it let's the dialog capture the entire screen
     * @returns {*}
     */
    getSize() {
        if (!this._parentSize) {
            return [undefined, undefined];
        }
        let dialogHeight = this.dialog.getSize()[1];
        let height;
        if(dialogHeight !== undefined){
            height = Math.max(this._parentSize[1], dialogHeight);
        } else {
            /* undefined height, let's make it the entire height  */
            height = this._parentSize[1];
        }
        return [undefined, height];
    }

}