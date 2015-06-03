/**
 * Created by mysim1 on 26/03/15.
 */

import _                            from 'lodash';
import FamousView                   from 'famous/core/View';
import LayoutController             from 'famous-flex/src/LayoutController';
import {ObjectHelper}               from 'arva-utils/ObjectHelper';


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

    build() {
        this._createRenderables();
        this._createLayout();
    }

    _createRenderables() {
        this._renderables = this.renderables;
    }

    _createLayout() {
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

            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }
}
