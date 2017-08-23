/**
 * Created by lundfall on 19/01/2017.
 */

import {View}               from 'arva-js/core/View.js';

/**
 * Abstract class to recognize a dialog in the controller
 */
export class Dialog extends View {
    /**
     *
     * @param [goBackInHistory] If set to true, goes back in history
     */
    close(goBackInHistory = false) {
        this._eventOutput.emit('closeDialog', goBackInHistory);
    }
}