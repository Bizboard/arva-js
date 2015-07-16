/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import FamousView                   from 'famous/core/View.js';
import LayoutController             from 'famous-flex/src/LayoutController.js';
import {ObjectHelper}               from 'arva-utils/ObjectHelper.js';


const DEFAULT_OPTIONS = {};

export class View extends FamousView {

    constructor(options = {}) {

        super(_.merge(options, DEFAULT_OPTIONS));
        this.renderables = {};
        this.layouts = [];

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);
    }

    /**
     * Converges all layout functions of this.layouts into a single layout function
     * and adds this.renderables and the layout function to a new famous-flex LayoutController.
     * Also pipes the eventOutput of the LayoutController to this View.
     *
     * For now this should not be called more than once, so only the lowest subclass should contain this.build() in their constructor.
     * If you inherit a View that has this.build() in their constructor and you call that method yourself as well, a second LayoutController
     * will be added to your view. Both LayoutControllers will contain this.renderables.
     *
     * @returns {void}
     */
    build() {
        this._combineLayouts();
    }

    /**
     * Combines all layouts defined in subclasses of the View into a single layout for the LayoutController.
     * @returns {void}
     * @private
     */
    _combineLayouts() {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function (context) {

                let isPortrait = window.matchMedia('(orientation: portrait)').matches;

                if (this.layouts && this.layouts.length > 0) {
                    let layouts = this.layouts.length;

                    for (let l = 0; l < layouts; l++) {
                        let spec = this.layouts[l];
                        let specType = typeof spec;

                        if (specType === 'object') {
                            if (isPortrait) {
                                if (spec.portrait) {
                                    spec.portrait.call(this, context);
                                } else {
                                    console.log('no portrait layout for view defined.');
                                }
                            } else {
                                if (spec.landscape) {
                                    spec.landscape.call(this, context);
                                } else {
                                    console.log('no landscape layout for view defined.');
                                }
                            }
                        } else if (specType === 'function') {
                            spec.call(this, context);
                        } else {
                            console.log('Unrecognized layout specification.');
                        }
                    }
                }
            }.bind(this),
            dataSource: this.renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }
}
