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

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        this._copyPrototypeProperties();
        this._constructDecoratedRenderables();
        if (!this.decorations) { this.decorations = {}; }
        if (!this.renderables) { this.renderables = {}; }
        if (!this.layouts) { this.layouts = []; }

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

    _constructDecoratedRenderables() {
        if (!this.decoratedRenderables) { this.decoratedRenderables = {}; }
        if (!this.renderables) { this.renderables = {}; }
        for (let name in this.renderableConstructors) {
            let decorations = this.renderableConstructors[name].decorations;
            /* TODO: add constructor options */
            let constructionOptions = decorations.constructionOptionsMethod ? decorations.constructionOptionsMethod(this.options) : undefined;
            let renderable = this.renderableConstructors[name](constructionOptions);
            renderable.decorations = decorations;

            if(decorations.descriptor.get) { decorations.descriptor.get = () => renderable; }
            if(decorations.descriptor.initializer) { decorations.descriptor.initializer = () => renderable; }

            this.decoratedRenderables[name] = renderable;
            /* If a renderable has an AnimationController used to animate it, add that to this.renderables.
             * this.renderables is used in the LayoutController in this.layout to render this view. */
            this.renderables[name] = renderable.decorations.animationController || renderable;
            this[name] = renderable;
        }
    }

    /**
     * Resolves a decorated renderable's size (both x and y)
     * @param {Object} renderable Decorated renderable to query size of.
     * @param {Object} context Famous-flex context in which the renderable is rendered.
     * @returns {Array|Object} Array of [x, y] sizes, or null if resolving is not possible.
     * @private
     */
    _resolveDecoratedSize(renderable, context) {
        if (!renderable.decorations || !('size' in renderable.decorations)) {
            return null;
        }

        let x = this._resolveSingleSize(renderable.decorations.size[0], context.size[0]);
        let y = this._resolveSingleSize(renderable.decorations.size[1], context.size[1]);

        return (x !== null && y !== null) ? [x, y] : null;
    }

    /**
     * Resolves a single dimension (i.e. x or y) size of a renderable.
     * @param {Number|Boolean|Object|Undefined|Function} renderableSize Renderable's single dimension size.
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
                /* renderableSize can be true/false, undefined, or 'auto' for example. */
                return renderableSize;
        }
    }

    _groupRenderableTypes() {
        return _.reduce(this.decoratedRenderables, function (result, renderable, renderableName) {
            let groupName;
            let decorations = renderable.decorations;
            if (!!decorations.dock) {
                /* 'filled' is a special subset of 'docked' renderables, that need to be rendered after the normal 'docked' renderables are rendered. */
                groupName = decorations.dock === 'fill' ? 'filled' : 'docked';
            } else if (!!decorations.fullscreen) {
                groupName = 'fullscreen';
            } else if (decorations.size || decorations.origin || decorations.align || decorations.translate) {
                groupName = 'traditional';
            } else {
                /* This occurs e.g. when a renderable is only marked @renderable, and its parent view has a @layout.custom decorator to define its context. */
                groupName = 'ignored';
            }

            if (groupName) {
                if (!(groupName in result)) { result[groupName] = {}; }
                result[groupName][renderableName] = renderable;
            }

            return result;
        }, {});
    }


    _layoutDecoratedRenderables(context, options) {
        let groupedRenderables = this._groupRenderableTypes();

        this._layoutDockedRenderables(groupedRenderables['docked'], groupedRenderables['filled'], context, options);
        this._layoutFullScreenRenderables(groupedRenderables['fullscreen'], context, options);
        this._layoutTraditionalRenderables(groupedRenderables['traditional'], context, options);
    }

    _layoutDockedRenderables(dockedRenderables, filledRenderables, context, options) {
        let dock = new LayoutDockHelper(context, options);

        if (this.decorations.viewMargins) {
            dock.margins(this.decorations.viewMargins);
        }

        /* Process Renderables with a non-fill dock */
        for (let name in dockedRenderables) {
            let renderable = dockedRenderables[name];
            let dockMethod = renderable.decorations.dock;
            let zIndex = renderable.decorations.translate ? renderable.decorations.translate[2] : 0;
            let renderableSize = this._resolveDecoratedSize(renderable, context, options);
            let dockSize = (dockMethod === 'left' || dockMethod === 'right' ? renderableSize[0] :
                            (dockMethod === 'top' || dockMethod === 'bottom' ? renderableSize[1] : null));

            if (dockSize !== null) {
                dock[dockMethod](name, dockSize, zIndex);
            } else {
                this._warn(`Arva: ${this._name()}.${name} contains an unknown @dock method '${dockMethod}', and was ignored.`);
            }
        }

        /* Process Renderables with a fill dock (this needs to be done after non-fill docks, since order matters in LayoutDockHelper) */
        for (let name in filledRenderables) {
            let renderable = filledRenderables[name];
            let zIndex = renderable.decorations.translate ? renderable.decorations.translate[2] : 0;

            dock.fill(name, zIndex);
        }
    }

    _layoutFullScreenRenderables(fullScreenRenderables, context, options) {
        for (let name in fullScreenRenderables) {
            let renderable = fullScreenRenderables[name];
            context.set(name, _.merge({translate: renderable.decorations.translate || [0, 0, 0]}, context));
        }
    }

    _layoutTraditionalRenderables(traditionalRenderables, context, options) {
        for (let name in traditionalRenderables) {
            let renderable = traditionalRenderables[name];
            let renderableSize = this._resolveDecoratedSize(renderable, context, options) || [undefined, undefined];
            context.set(name, {
                size: renderableSize,
                translate: renderable.decorations.translate || [0, 0, 0],
                origin: renderable.decorations.origin || [0, 0],
                align: renderable.decorations.align || [0, 0]
            });
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

                /* Because views that extend this View class first call super() and then define their renderables,
                 * we wait until the first engine render tick to add our renderables to the layout, when the view will have declared them all.
                 * layout.setDataSource() will automatically pipe events from the renderables to this View, since autoPipeEvents = true.       */
                if (!this._initialised) {
                    this._addRenderables();
                    this._initializeAnimations();
                    this._initialised = true;
                    this.layout.reflowLayout();
                }

                /* Layout all renderables that have decorators (e.g. @someDecorator) */
                if (this.hasDecorators) {
                    this._layoutDecoratedRenderables(context, options);
                    if (this.decorations && this.decorations.customLayoutFunction) {
                        this.decorations.customLayoutFunction(context);
                    }
                }

                /* Layout all other renderables that have explicit context.set() calls in this View's layout methods */
                for (let layout of this.layouts) {
                    try {
                        switch (typeof layout) {
                            case 'function':
                                layout.call(this, context, options);
                                break;
                            default:
                                this._warn(`Unrecognized layout specification in view '${this._name()}'.`);
                                break;
                        }
                    } catch (error) {
                        this._warn(`Exception thrown in ${this._name()}:`);
                        console.log(error);
                    }
                }
            }.bind(this)
        });

        /* Add the layoutController to this View's rendering context. */
        this._prepareLayoutController();
    }

    /**
     * Either adds this.layout (a LayoutController) to the current View, or a FlexScrollView containing this.layout if this view
     * has been decorated with a @scrollable.
     * @returns {void}
     * @private
     */
    _prepareLayoutController() {
        if (this.decorations.isScrollable) {
            let scrollView = new FlexScrollView({
                autoPipeEvents: true
            });

            let viewSize = [undefined, undefined];
            this.layout.on('reflow', () => {
                viewSize = this._getScrollableLayoutSize();
            });

            this.layout.getSize = function () {
                return viewSize;
            };

            scrollView.push(this.layout);
            scrollView.pipe(this._eventOutput);
            this.add(scrollView);
        }
        else {
            this.add(this.layout);
            this.layout.pipe(this._eventOutput);
        }
    }

    /**
     * Calculates the total height of the View's layout when it's embedded inside a FlexScrollView (i.e. @scrollable is set on the View),
     * by iterating over each renderable inside the View, and finding the minimum and maximum y values at which they are drawn.
     *
     * The total layout height is the difference between the lowest y coordinate drawn, and the largest one.
     * @returns {*[]}
     * @private
     */
    _getScrollableLayoutSize() {
        let minYPosition = 0, maxYPosition = 0;

        for (let renderableName in this.layout._dataSource) {
            let renderableSpec = this.layout.getSpec(renderableName, true);
            if (!renderableSpec || !renderableSpec.translate || !renderableSpec.size) { continue; }
            let top = renderableSpec.translate[1];
            let bottom = renderableSpec.size[1] + renderableSpec.translate[1];

            /* If the renderable has a lower min y position, or a higher max y position, save its values */
            minYPosition = minYPosition < bottom ? minYPosition : bottom;
            maxYPosition = maxYPosition > top ? maxYPosition : top;
        }

        return [undefined, maxYPosition - minYPosition || undefined];
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
    _addRenderables() {
        this.layout.setDataSource(this.renderables);
    }

    _initializeAnimations() {
        for (let animation of this.waitingAnimations) {
            let renderableToWaitFor = this[animation.waitFor];
            if (renderableToWaitFor && renderableToWaitFor.on) {
                renderableToWaitFor.on('shown', animation.showMethod);
            } else {
                this._warn(`Attempted to delay showing renderable ${this._name()}.${animation.waitFor}, which does not exist or contain an on() method.`);
            }
        }

        for(let animation of this.delayedAnimations) {
            Timer.setTimeout(() => animation.showMethod, animation.delay)
        }

        for(let animation of this.immediateAnimations) {
            animation.showMethod()
        }
    }

    _copyPrototypeProperties() {
        let prototype = Object.getPrototypeOf(this);

        /* Move over all renderable- and decoration information that decorators.js set to the View prototype */
        for (let name of ['decorations', 'renderableConstructors']) {
            this[name] = prototype[name];
        }
    }
}
