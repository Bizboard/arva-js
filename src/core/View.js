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
import Surface                      from 'famous/core/Surface.js';

import {TrueSizedLayoutDockHelper}  from '../layout/TrueSizedLayoutDockHelper.js';
import {ObjectHelper}               from 'arva-utils/ObjectHelper.js';
import LayoutDockHelper             from 'famous-flex/src/helpers/LayoutDockHelper.js';

const DEFAULT_OPTIONS = {};

export class View extends FamousView {

    constructor(options = {}) {

        super(_.merge(options, DEFAULT_OPTIONS));

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);


        if (!this.decorations) {
            this.decorations = {};
        }
        if (!this.renderables) {
            this.renderables = {};
        }
        if (!this.layouts) {
            this.layouts = [];
        }

        this._copyPrototypeProperties();
        this._initTrueSizedBookkeeping();
        this._constructDecoratedRenderables();

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
     * Reflows the layout while also informing any subscribing parents that a reflow has to take place
     */
    reflowRecursively() {
        this.layout.reflowLayout();
        this._eventOutput.emit('recursiveReflow');
    }

    /**
     * Reflows the layout when the current reflow of the layout is complete
     */
    reflowDelayedRecursively() {
        this.layout.reflowLayout();
        this._delayedRecursiveReflowEvent = true;
    }

    /**
     * Gets the size used when displaying a renderable on the screen the last tick
     * @param {Renderable/Name} The renderable or the name of the renderableof which you need the size
     */
    getResolvedSize(renderableOrName) {
        let renderable = renderableOrName;
        if (typeof renderableOrName === 'string') {
            renderable = this.renderables[renderableOrName];
        }
        let size = this._resolvedSizesCache.get(renderable);

        if (!size) {
            return null;
        }
        if (size[0] === true || size[1] === true) {
            return renderable.getSize();
        }

        return size;
    }

    constainsUncalculatedSurfaces() {
        for (let [surface, {isUncalculated}] of this._trueSizedSurfaceInfo) {
            if (isUncalculated) {
                return true;
            }
        }
        return false;
    }

    adjustContextSize(size) {
        this._adjustedContextSize = size;
    }

    /** Requests for a parent layoutcontroller trying to resolve the size of this view
     * @private
     */
    _requestLayoutControllerReflow() {
        this._nodes = {_trueSizeRequested: true};
        this._eventOutput.emit('layoutControllerReflow');
    }

    _constructDecoratedRenderables() {
        if (!this.decoratedRenderables) {
            this.decoratedRenderables = {};
        }
        if (!this.renderables) {
            this.renderables = {};
        }
        for (let name in this.renderableConstructors) {
            let decorations = this.renderableConstructors[name].decorations;
            let constructionOptions = decorations.constructionOptionsMethod ? decorations.constructionOptionsMethod(this.options) : [];
            if (!(constructionOptions instanceof Array)) {
                constructionOptions = [constructionOptions];
            }

            let renderable = this.renderableConstructors[name](...constructionOptions);
            renderable.decorations = decorations;


            /* Since after constructor() of this View class is called, all decorated renderables will
             * be attempted to be initialized by Babel / the ES7 class properties spec, we'll need to
             * override the descriptor get/initializer to return this specific instance once.
             *
             * If we don't do this, the View will have its renderables overwritten by new renderable instances
             * that don't have constructor.options applied to them correctly. If we always return this specific instance
             * instead of only just once, any instantiation of the same View class somewhere else in the code will refer
             * to the renderables of this instance, which is unwanted.
             */
            if (decorations.descriptor.get) {
                let originalGet = decorations.descriptor.get;
                decorations.descriptor.get = () => {
                    decorations.descriptor.get = originalGet;
                    return renderable;
                }
            }
            if (decorations.descriptor.initializer) {
                let originalInitializer = decorations.descriptor.initializer;
                decorations.descriptor.initializer = () => {
                    decorations.descriptor.initializer = originalInitializer;
                    return renderable;
                }
            }

            this._setEventHandlers(renderable);
            this._setPipes(renderable);

            this.decoratedRenderables[name] = renderable;
            /* If a renderable has an AnimationController used to animate it, add that to this.renderables.
             * this.renderables is used in the LayoutController in this.layout to render this view. */
            this.renderables[name] = renderable.animationController || renderable;
            this[name] = renderable;
        }
        this._resolvedSizesCache = new Map();
        this._groupedRenderables = this._groupRenderableTypes();
    }

    _setEventHandlers(renderable) {
        if (!renderable.decorations || !renderable.decorations.eventSubscriptions) {
            return;
        }

        let subscriptions = renderable.decorations.eventSubscriptions;
        for (let subscription of subscriptions) {
            let subscriptionType = subscription.type || 'on';
            let eventName = subscription.eventName;
            let callback = subscription.callback;
            if (subscriptionType in renderable) {
                renderable[subscriptionType](eventName, callback);
            }
        }
    }

    _setPipes(renderable) {
        if (!renderable.decorations || !renderable.decorations.pipes || !('pipe' in renderable || '_eventOutput' in renderable)) {
            return;
        }

        let pipes = renderable.decorations.pipes;
        for (let pipeToName of pipes) {
            let target = pipeToName ? this[pipeToName] : this;
            if (renderable.pipe) {
                renderable.pipe(target);
            }
            if (renderable.pipe && target._eventOutput) {
                renderable.pipe(target._eventOutput);
            }
        }
    }

    /**
     * Resolves a decorated renderable's size (both x and y)
     * @name {String} name The name of the renderable such that this.renderables[name] = renderable
     * @param {Object} renderable Decorated renderable to query size of.
     * @param {Object} context Famous-flex context in which the renderable is rendered.
     * @param {Boolean} resolveTrueSize if true, translates a true size instruction (negative value) to an estimation of the size. Otherwise, tranlsates it to true
     * @returns {Array|Object} Array of [x, y] sizes, or null if resolving is not possible.
     * @private
     */
    _resolveDecoratedSize(name, renderable, context, resolveTrueSize = false) {
        if (!renderable.decorations || !('size' in renderable.decorations)) {
            return null;
        }

        let size = [];
        let cacheResolvedSize = [];
        let dimensionIsTrueSized = [false, false];
        for (let dim = 0; dim < 2; dim++) {
            size[dim] = this._resolveSingleSize(renderable.decorations.size[dim], context.size[dim]);
            if (size[dim] < 0 || size[dim] === true) {
                dimensionIsTrueSized[dim] = true;
                if (!(renderable instanceof View) || resolveTrueSize) {
                    this._processSingleTrueSizedRenderable(renderable, name, size, dim);
                } else {
                    size[dim] = true;
                }
            }
            cacheResolvedSize[dim] = size[dim] === undefined ? context.size[dim] : size[dim];
        }

        if(!resolveTrueSize){
            if(renderable instanceof View){
                /* If we displaying a true sized view, then we should inform this view so that it knows its context size*/
                let customSize = renderable.getSize();
                let resolveCustomSize = (i) => dimensionIsTrueSized[i] === true ? (customSize[i] || ~renderable.decorations.size[i]) : size[i];
                /* Also set the cache size so that both are positive integers */
                cacheResolvedSize = [resolveCustomSize(0), resolveCustomSize(1)];
                renderable.adjustContextSize(cacheResolvedSize);
            } else {
                /* If the renderable is a surface or something else which size
                 *  we already determined, set the cache size to that and also adjust the size to have
                 *  the true instead of the computed value
                 */
                cacheResolvedSize = size;
                size = [dimensionIsTrueSized[0] || size[0],dimensionIsTrueSized[1] || size[1] ];
            }
        }

        this._resolvedSizesCache.set(renderable, cacheResolvedSize);

        return (size[0] !== null && size[1] !== null) ? size : null;
    }

    /**
     * Processes a dimension of a truesized renderable. size[dim] must be negative. size[dim] Will be modified by the function.
     * @param renderable the renderable
     * @param name the index so that this.renderables[name] = renderable
     * @param size the size array. The function will modify size[dim]
     * @param dim the dimensions e.g. 0,1 that should be processed
     * @returns
     * @private
     */
    _processSingleTrueSizedRenderable(renderable, name, size, dim) {
        if (size[dim] === -1) {
            this._warn('-1 detected as set size. If you want a true sized element to take ' +
                'up a proportion of your view, please define a function doing so by ' +
                'using the context size');
        }
        /* True sized element. This has been specified as ~100 where 100 is the initial size
         * applying this operator again (e.g. ~~100) gives us the value 100 back
         * */
        if (renderable instanceof View) {
            if (size[dim] === true) {
                size[dim] = renderable.getSize()[dim];
                if (size[dim] === undefined && renderable._initialised) {
                    this._warn(`True sized renderable '${name}' is taking up the entire context size. Called from ${this._name()}`);
                }
            } else {
                size[dim] = !renderable.constainsUncalculatedSurfaces() && renderable._initialised ? renderable.getSize()[dim] || ~size[dim] : ~size[dim];
            }
            this._ensureTrueSizedViewSubscriptions(renderable);
        } else if (renderable instanceof Surface) {
            let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable) || {};
            if (trueSizedSurfaceInfo.calculateOnNext) {
                this._tryCalculateTrueSizedSurface(renderable);
            }
            let {isUncalculated} = trueSizedSurfaceInfo;
            if (isUncalculated === false) {
                size[dim] = trueSizedSurfaceInfo.size[dim];
            } else {
                if (size[dim] === true) {
                    let defaultSize = 5;
                    this._warn(`No initial size set for surface, will default to ${defaultSize}px`);
                    size[dim] = ~5;
                }
                size[dim] = ~size[dim];
                if (isUncalculated !== true) {
                    /* Seems like the surface isn't properly configured, let's get that going */
                    trueSizedSurfaceInfo = this._configureTrueSizedSurface(renderable, name);
                }
                trueSizedSurfaceInfo.trueSizedDimensions[dim] = true;
            }
        }
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
                return this._resolveSingleSize(renderableSize(contextSize), contextSize);
            case 'number':
                /* If 0 < renderableSize < 1, we interpret renderableSize as a fraction of the contextSize */
                return renderableSize < 1 && renderableSize > 0 ? renderableSize * contextSize : renderableSize;
            default:
                /* renderableSize can be true/false, undefined, or 'auto' for example. */
                return renderableSize;
        }
    }

    /**
     * Sets up a true sized surface
     * @param renderable
     * @param name Needs to match so that this.renderables[name] === renderable
     * @returns {{isUncalculated: boolean, trueSizedDimensions: boolean[], name: *}} an entry in this._trueSizedSurfaceInfo
     * @private
     */
    _configureTrueSizedSurface(renderable, name) {
        let trueSizedSurfaceInfo = {isUncalculated: true, trueSizedDimensions: [false, false], name};

        /* We assume both dimensions not to be truesized, they are set in this._resolveDecoratedSize */
        this._trueSizedSurfaceInfo.set(renderable, trueSizedSurfaceInfo);


        renderable.on('resize', () => {
            this._tryCalculateTrueSizedSurface(renderable);
        });
        renderable.on('deploy', () => {
            if (!this._trueSizedSurfaceInfo.get(renderable).isUncalculated) {
                console.log('deploy');
                this._tryCalculateTrueSizedSurface(renderable);
            }
        });

        return trueSizedSurfaceInfo;
    }


    _groupRenderableTypes() {
        return _.reduce(this.decoratedRenderables, function (result, renderable, renderableName) {
            let groupName;
            let decorations = renderable.decorations;
            if (!!decorations.dock) {
                /* 'filled' is a special subset of 'docked' renderables, that need to be rendered after the normal 'docked' renderables are rendered. */
                groupName = decorations.dock.dockMethod === 'fill' ? 'filled' : 'docked';
            } else if (!!decorations.fullscreen) {
                groupName = 'fullscreen';
            } else if (decorations.size || decorations.origin || decorations.align || decorations.translate) {
                groupName = 'traditional';
            } else {
                /* This occurs e.g. when a renderable is only marked @renderable, and its parent view has a @layout.custom decorator to define its context. */
                groupName = 'ignored';
            }

            if (groupName) {
                if (!(groupName in result)) {
                    result[groupName] = {};
                }
                result[groupName][renderableName] = renderable;
            }

            return result;
        }, {});
    }


    _layoutDecoratedRenderables(context, options) {
        if (this._adjustedContextSize) {
            context.size = this._adjustedContextSize;
        }
        this._layoutDockedRenderables(this._groupedRenderables['docked'], this._groupedRenderables['filled'], context, options);
        this._layoutFullScreenRenderables(this._groupedRenderables['fullscreen'], context, options);
        this._layoutTraditionalRenderables(this._groupedRenderables['traditional'], context, options);
    }

    _layoutDockedRenderables(dockedRenderables, filledRenderables, context, options) {
        let dock = new TrueSizedLayoutDockHelper(context, options);

        if (this.decorations && this.decorations.viewMargins) {
            dock.margins(this.decorations.viewMargins);
        }

        /* Process Renderables with a non-fill dock */
        for (let name in dockedRenderables) {
            let renderable = dockedRenderables[name];
            let {dockMethod, space} = renderable.decorations.dock;
            let zIndex = renderable.decorations.translate ? renderable.decorations.translate[2] : 0;
            let renderableSize = this._resolveDecoratedSize(name, renderable, context, true);
            let dockSize = (dockMethod === 'left' || dockMethod === 'right' ? renderableSize[0] :
                (dockMethod === 'top' || dockMethod === 'bottom' ? renderableSize[1] : null));

            if (dockSize !== null) {
                dock[dockMethod](name, dockSize, zIndex, space, !!this._trueSizedSurfaceInfo.get(renderable));
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
            let renderableSize = this._resolveDecoratedSize(name, renderable, context) || [undefined, undefined];
            let {translate = [0, 0, 0], origin = [0, 0, 0], align = [0, 0, 0]} = renderable.decorations;
            let adjustedTranslation = this._adjustOriginForTrueSize(renderable, renderableSize, origin, translate);
            context.set(name, {
                size: renderableSize,
                translate: adjustedTranslation,
                origin,
                align
            });
        }
    }

    /**
     * Specifying origin for true sized renderables doesn't work. Therefore we do a quick fix to adjust the
     * translation according to the current faulty behaviour of famous
     * @param renderable The renderable of which we should correct
     * @param size  The size of this renderable
     * @param origin The origin
     * @param translate The current translation
     * @returns {*[]} The new translation taking this the current famous implementation into account
     * @private
     */
    _adjustOriginForTrueSize(renderable, size, origin, translate) {
        let newTranslation = [translate[0], translate[1], translate[2]];
        for (let i = 0; i < 2; i++) {
            if (size[i] === true && origin[i] !== 0) {
                newTranslation[i] -= this._resolvedSizesCache.get(renderable)[i] * origin[i];
            }
        }
        return newTranslation;
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

                    /*
                     * When the data source is set, it will not be reflected in the context yet because the layout is already
                     * prepared for the previous (empty) renderable data source. Therefore, it's a waste of resources
                     * and mysterious bugs to continue. We will wait for the next rendering cycle. However, if views
                     * are only having decorated renderables, then we don't have to do this whatsoever
                     */
                    return;
                }

                /* Layout all renderables that have decorators (e.g. @someDecorator) */
                if (this.hasDecorators) {
                    this._layoutDecoratedRenderables(context, options);
                    if (this.decorations && this.decorations.customLayoutFunction) {
                        this.decorations.customLayoutFunction(context);
                    }
                }

                if (this._hasTrueSizedSurfaces()) {
                    this._doTrueSizedSurfacesBookkeeping();
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
        if (this.decorations && this.decorations.isScrollable) {
            let scrollView = new FlexScrollView({
                autoPipeEvents: true
            });

            let viewSize = [undefined, undefined];
            this.layout.on('reflow', () => {
                viewSize = [undefined, this._getLayoutSize()[1]];
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
     * getSize() is called by this view and by layoutControllers. For lazy people that don't want to specifiy their own getSize() function,
     * we provide a fallback. This function can be performance expensive when using non-docked renderables, but for docked renderables it
     * is efficient and convenient]
     * @returns {*[]}
     */
    getSize() {
        return this._getLayoutSize();
    }

    /**
     * Calculates the total height of the View's layout when it's embedded inside a FlexScrollView (i.e. @scrollable is set on the View),
     * by iterating over each renderable inside the View, and finding the minimum and maximum y values at which they are drawn.
     *
     * The total layout height is the difference between the lowest y coordinate drawn, and the largest one.
     * @returns {*[]}
     * @private
     */
    _getLayoutSize() {
        let minPosition = [0, 0], maxPosition = [0, 0];

        let fastSizeCalculation = this._calculateLayoutSizeOptimized();
        if (fastSizeCalculation) {
            return fastSizeCalculation;
        }

        for (let renderableName in this.layout._dataSource) {
            let renderable = this.renderables[renderableName];
            let size = this.getResolvedSize(renderable);
            /*
             * If there is no cached size, then we're having a fill or background or something, and we shouldn't take it into account when summing up these
             */
            if (!size) {
                continue;
            }
            let renderableSpec = this.layout.getSpec(renderableName, true);
            if (!renderableSpec || !renderableSpec.transform || !renderableSpec.size) {
                continue;
            }


            let translate = renderableSpec.transform.slice(-4, -1);
            let [left,top] = translate;
            let right = left + size[0];
            let bottom = top + size[1];

            /* If the renderable has a lower min y/x position, or a higher max y/x position, save its values */
            minPosition = [Math.min(minPosition[0], left), Math.min(minPosition[1], top)];
            maxPosition = [Math.max(maxPosition[0], right), Math.max(maxPosition[1], bottom)];
        }

        return [maxPosition[0] - minPosition[0] || undefined, maxPosition[1] - maxPosition[1] || undefined];
    }


    /**
     * Calculates the size in a fast way based on the dock helper
     * @returns {*}
     * @private
     */
    _calculateLayoutSizeOptimized() {


        let {docked: dockedRenderables, filled: filledRenderables} = this._groupedRenderables;
        if (filledRenderables) {
            return [undefined, undefined]
        }
        if (dockedRenderables) {

            let {dockMethod} = dockedRenderables[Object.keys(dockedRenderables)[0]].decorations.dock;

            if (dockMethod === 'right' || dockMethod === 'bottom') {
                return [undefined, undefined]
            }

            /* Add up the different sizes to if they are docked all in the same direction */
            let dockSize = _.reduce(dockedRenderables, (result, dockedRenderable, name) => {
                let {decorations} = dockedRenderable;
                if (decorations.dock.dockMethod !== dockMethod) {
                    return NaN;
                } else {
                    let resolvedSize = this._resolvedSizesCache.get(dockedRenderable) ||
                        this._resolveDecoratedSize(name, dockedRenderable, {size: NaN}, true);
                    if (!resolvedSize) {
                        return NaN;
                    }
                    return resolvedSize[+(dockMethod === 'top')] + decorations.dock.space + result
                }
            }, 0);

            /* If the docking directions are missing, then take up entire context size */
            if (!dockSize) {
                return [undefined, undefined]
            }

            /* If you mixed in these types of renderables, then it gets hard to determine the size (it has to be done the slow way) */
            if (this._groupedRenderables['traditional'] || this._groupedRenderables['ignored']) {
                return null;
            }

            return dockMethod === 'left' ? [dockSize, undefined] : [undefined, dockSize];
        }
        return null;
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
        for (let animation of (this.waitingAnimations || [])) {
            let renderableToWaitFor = this[animation.waitFor];
            if (renderableToWaitFor && renderableToWaitFor.on) {
                renderableToWaitFor.on('shown', function subscription() {
                    animation.showMethod();
                    if ('off' in renderableToWaitFor) {
                        renderableToWaitFor.off('shown', subscription);
                    }
                    if ('removeListener' in renderableToWaitFor) {
                        renderableToWaitFor.removeListener('shown', subscription);
                    }
                });
            } else {
                this._warn(`Attempted to delay showing renderable ${this._name()}.${animation.waitFor}, which does not exist or contain an on() method.`);
            }
        }

        for (let animation of (this.delayedAnimations || [])) {
            Timer.setTimeout(() => animation.showMethod, animation.delay)
        }

        for (let animation of (this.immediateAnimations || [])) {
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

    _ensureTrueSizedViewSubscriptions(renderable) {
        /*  TODO: It might be good to do this as this._eventInput.on('recursiveReflow', ... ) instead but for some reason it
         Doesn't work (why not?)
         */
        if (!this._trueSizedViewSizeSubscriptions.get(renderable)) {
            renderable.on('recursiveReflow', () => {
                this.reflowRecursively();
            });
            this._trueSizedViewSizeSubscriptions.set(renderable, true);
        }
    }

    _hasTrueSizedSurfaces() {
        return !![...this._trueSizedSurfaceInfo.keys()].length;
    }


    _doTrueSizedSurfacesBookkeeping() {
        this._nodes._trueSizeRequested = false;
        if (this._delayedRecursiveReflowEvent) {
            this._eventOutput.emit('recursiveReflow');
            this._delayedRecursiveReflowEvent = false;
        }
    }


    _initTrueSizedBookkeeping() {

        this._trueSizedSurfaceInfo = new Map();

        this._trueSizedViewSizeSubscriptions = new WeakMap();

        /* Hack to make the layoutcontroller reevaluate sizes on resize of the parent */
        this._nodes = {_trueSizedRequested: false};
        /* This needs to be set in order for the LayoutNodeManager to be happy */
        this.options = this.options || {};
        this.options.size = this.options.size || [true, true];


    }

    _tryCalculateTrueSizedSurface(renderable) {
        let renderableHtmlElement = renderable._element;
        let trueSizedInfo = this._trueSizedSurfaceInfo.get(renderable);
        if (renderableHtmlElement && renderableHtmlElement.innerHTML === renderable.getContent()) {
            let renderableTarget = renderable._element;
            let newSize;

            if (renderableTarget) {
                newSize = [renderableTarget.offsetWidth, renderableTarget.offsetHeight];
            } else {
                newSize = renderable.size
            }

            let oldSize = trueSizedInfo.size;
            let sizeChange = false;
            if (oldSize) {
                let {trueSizedDimensions} = trueSizedInfo;
                for (let i = 0; i < 2; i++) {
                    if (trueSizedDimensions[i] && oldSize[i] !== newSize[i]) {
                        sizeChange = true;
                    }
                }
            } else {
                sizeChange = true;
            }

            if (sizeChange) {
                this.reflowDelayedRecursively();
                trueSizedInfo.size = newSize;
                trueSizedInfo.isUncalculated = false;
            }
        } else {
            trueSizedInfo.calculateOnNext = true;
            this.layout.reflowLayout();
            this._requestLayoutControllerReflow();
        }
    }

}
