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
import FlexScrollView               from 'famous-flex/src/FlexScrollView.js';
import {ObjectHelper}               from 'arva-utils/ObjectHelper.js';
import LayoutDockHelper             from 'famous-flex/src/helpers/LayoutDockHelper.js';

const DEFAULT_OPTIONS = {};

export class View extends FamousView {

    constructor(options = {}) {

        super(_.merge(options, DEFAULT_OPTIONS));
        this.renderables = {};
        this.layouts = [];

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Place Renderables which originate from decorators */
        let lazyRenderablesLength = this.lazyRenderableList? this.lazyRenderableList.length:0;
        for (let r=0;r<lazyRenderablesLength;r++) {
          this.renderables[this.lazyRenderableList[r].id] = this[this.lazyRenderableList[r].id];
        }

        this._combineLayouts();
    }

    get hasDecorators() {
      return !!this.lazyRenderableList;
    }

    /**
     * Deprecated, it is no longer required to call build() from within your View instances.
     * @deprecated
     * @returns {void}
     */
    build() {
        this._warn(`Arva: calling build() from within views is no longer necessary, any existing calls can safely be removed. Called from ${this._name()}`);
    }

    _renderDecoratedRenderables(context, options) {
      var dock = new LayoutDockHelper(context, options);

      let dockedRenderables = _.filter(this.lazyRenderableList, function(r) { return !!r.dock });
      let filledRenderables = _.filter(this.lazyRenderableList, function(r) { return !r.dock && !r.fullscreen });
      let fullScreenRenderables = _.filter(this.lazyRenderableList, function(r) { return !!r.fullscreen });

      /* Place Renderables with dock */
      let dockedRenderablesLength = dockedRenderables? dockedRenderables.length:0;
      for (let r=0;r<dockedRenderablesLength;r++) {
        let definition = dockedRenderables[r];
        dock[definition.dock](definition.id, undefined, definition.z);
      }

      let filledRenderablesLength = filledRenderables.length;
      for (let r=0;r<filledRenderablesLength;r++) {
        let definition = filledRenderables[r];
        dock.fill(definition.id);
      }

      if (fullScreenRenderables.length==1) {
        let definition = fullScreenRenderables[0];
        context.set(definition.id, context);
      }
    }

    /**
     * Combines all layouts defined in subclasses of the View into a single layout for the LayoutController.
     * @returns {void}
     * @private
     */
    _combineLayouts() {

        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function (context, options) {

                // have all decorated renderables processed. don't block backward compatible layouting.
                if (this.hasDecorators) {
                  this._renderDecoratedRenderables(context, options);
                }

                let isPortrait = window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : true;
                if(!this.initialised) {
                    this._bindEvents();
                    this.initialised = true;
                }

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
            }.bind(this)
        });

        this.layout.setDataSource(this.renderables);

        if (this.isScrollable) {
          let scrollView = new FlexScrollView({
            autoPipeEvents: true
          });

          let viewSize = [undefined, 0];
          this.layout.on('reflow', () => {
            for (let r in this.layout._dataSource) {
              let currentSize = this.layout._dataSource[r].getSize();
              if (currentSize) {
                if (currentSize[1]>viewSize[1]) {
                  viewSize[1] += currentSize[1];
                }
              }
            }
          });

          this.layout.getSize = function() {
            console.log(viewSize);
            return viewSize;
          }

          scrollView.push(this.layout);
          this.add(scrollView);
          scrollView.pipe(this._eventOutput);
        }
        else {
          this.add(this.layout);
          this.layout.pipe(this._eventOutput);
        }
    }



    /**
     * Uses either console.warn() or console.log() to log a mildly serious issue, depending on the user agent's availability.
     * @param {String|Object} message
     * @returns {void}
     * @private
     */
    _warn(message) {
        if(console.warn) {
            console.warn(message);
        } else {
            console.log(message);
        }
    }

    /**
     * Retrieves the class name of the subclass View instance.
     * @returns {string}
     * @private
     */
    _name() {
        return Object.getPrototypeOf(this).constructor.name;
    }

    /**
     * Pipes the output events of all items in this.renderables to the LayoutController in this.layout.
     * @returns {void}
     * @private
     */
    _bindEvents() {
        this.layout.setDataSource(this.renderables);
    }
}
