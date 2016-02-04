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
        if (!this.renderables) { this.renderables = {}; }
        this.layouts = [];

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        this._combineLayouts();
    }

    get hasDecorators() {
        return !!this.decoratedRenderables;
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
     * Resolves a decorated renderable's size (both x and y)
     * @param {Object} renderable Decorated renderable to query size of.
     * @param {Object} context Famous-flex context in which the renderable is rendered.
     * @returns {Array|Object} Array of [x, y] sizes, or null if resolving is not possible.
     * @private
     */
    _resolveDecoratedSize(renderable, context) {
        if (!renderable.decorations || !('sizeX' in renderable.decorations) || !('sizeY' in renderable.decorations)) {
            return null;
        }

        let x = this._resolveSingleSize(renderable.decorations.sizeX, context.size[0]);
        let y = this._resolveSingleSize(renderable.decorations.sizeY, context.size[1]);

        return (x !== null && y !== null) ? [x, y] : null;
    }

    /**
     * Resolves a single dimension (i.e. x or y) size of a renderable.
     * @param {Number|Boolean|Object|Undefined} renderableSize Renderable's single dimension size.
     * @param {Number} contextSize Single dimension size value of the Famous-flex context in which the renderable is rendered.
     * @returns {Number|Boolean|Object|Undefined} Size value, which can be a numeric value, true, null, or undefined.
     * @private
     */
    _resolveSingleSize(renderableSize, contextSize) {
        switch (typeof renderableSize) {
            case 'function':
                return renderableSize(contextSize);
            case 'number':
                /* If 0 < renderableSize < 1, we interpret renderableSize as a fraction of the contextSize */
                return renderableSize < 1 ? renderableSize * contextSize : renderableSize;
            default:
                /* renderableSize can be true/false, or 'auto' for example. */
                return renderableSize;
        }
    }

    _renderDecoratedRenderables(context, options) {
        this._renderDockedRenderables(context, options);
        this._renderFullScreenRenderables(context, options);
    }

    _renderDockedRenderables(context, options) {
        let dock = new LayoutDockHelper(context, options);

        let dockedRenderables = _.filter(this.decoratedRenderables, (renderable) => !!renderable.decorations.dock && renderable.decorations.dock !== 'fill');
        let filledRenderables = _.filter(this.decoratedRenderables, (renderable) => !!renderable.decorations.dock && renderable.decorations.dock === 'fill');

        if (this.decorations.viewMargins) {
            dock.margins(this.decorations.viewMargins);
        }

        /* Place Renderables with a non-fill dock */
        for (let name in dockedRenderables) {
            let renderable = dockedRenderables[name];
            let dockMethod = renderable.decorations.dock;
            let zIndex = context.translate[2] + (renderable.decorations.translate ? renderable.decorations.translate[2] : 0);
            let renderableSize = this._resolveDecoratedSize(renderable, context, options);
            let dockSize = (dockMethod === 'left' || dockMethod === 'right' ? renderableSize[0] :
                            (dockMethod === 'top' || dockMethod === 'bottom' ? renderableSize[1] : null));

            if (dockSize !== null) {
                dock[dockMethod](renderable.id, dockSize, zIndex);
            } else {
                this._warn(`Arva: ${this._name()}.${name} contains an unknown @dock method '${dockMethod}', and was ignored.`);
            }
        }

        /* Place Renderables with a fill dock (this needs to be done after non-fill docks, since order matters in LayoutDockHelper) */
        for (let name in filledRenderables) {
            let renderable = filledRenderables[name];
            let zIndex = context.translate[2] + (renderable.decorations.translate ? renderable.decorations.translate[2] : 0);

            dock.fill(renderable.id, zIndex);
        }
    }

    _renderFullScreenRenderables(context, options) {
        let fullScreenRenderables = _.filter(this.decoratedRenderables, (renderable) => !!renderable.decorations.fullscreen);

        for(let name in fullScreenRenderables) {
            let renderable = fullScreenRenderables[name];

            /* TODO: set z-index properly */
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
                if (!this.initialised) {
                    this._bindEvents();
                    this.initialised = true;
                }

                for (let layout of this.layouts) {
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
                    } catch (error) {
                        console.log(`Exception thrown in ${this._name()}:`, error);
                    }
                }
            }.bind(this)//,
            //dataSource: this.renderables
        });

        this.layout.setDataSource(this.renderables);

        if (this.isScrollable) {
            let scrollView = new FlexScrollView({
                autoPipeEvents: true
            });

            let viewSize = [undefined, 0];
            this.layout.on('reflow', () => {
                for (let renderableName in this.layout._dataSource) {
                    let currentSize = this.layout._dataSource[renderableName].getSize();
                    if (currentSize) {
                        if (currentSize[1] > viewSize[1]) {
                            viewSize[1] += currentSize[1];
                        }
                    }
                }
            });

            this.layout.getSize = function () {
                console.log(viewSize);
                return viewSize;
            };

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
        if (console.warn) {
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
