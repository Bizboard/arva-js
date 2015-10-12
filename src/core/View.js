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

        this._combineLayouts();
    }

    /**
     * Deprecated, it is no longer required to call build() from within your View instances.
     * @deprecated
     * @returns {void}
     */
    build() {
        this._warn(`Arva: calling build() from within views is no longer necessary, any existing calls can safely be removed. Called from ${this._name()}`);
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

                let isPortrait = window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : true;

                for(let layout of this.layouts){
                    try {
                        let specType = typeof layout;

                        if (specType === 'object') {
                            if (isPortrait) {
                                if (layout.portrait) {
                                    layout.portrait.call(this, context);
                                } else {
                                    this._warn(`No portrait layout defined for view '${this._name()}'.`);
                                }
                            } else {
                                if (layout.landscape) {
                                    layout.landscape.call(this, context);
                                } else {
                                    this._warn(`No landscape layout defined for view '${this._name()}'.`);
                                }
                            }
                        } else if (specType === 'function') {
                            layout.call(this, context);
                        } else {
                            console.log(`Unrecognized layout specification in view '${this._name()}'.`);
                        }
                    } catch(error) {
                        console.log(`Exception thrown in ${this._name()}:`, error);
                    }
                }
            }.bind(this),
            dataSource: this.renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }

    _warn(message) {
        if(console.warn) {
            console.warn(message);
        }
    }

    _name() {
        return Object.getPrototypeOf(this).constructor.name;
    }
}
