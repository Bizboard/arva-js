/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import FamousView                   from 'famous/core/View.js';
import LayoutController             from 'famous-flex/LayoutController.js';

import {limit}                      from 'arva-js/utils/Limiter.js';

import {ObjectHelper}               from '../utils/ObjectHelper.js';
import {SizeResolver}               from '../utils/view/SizeResolver.js';
import {Helpers}                    from '../utils/view/Helpers.js';
import {
    DockedRenderablesHelper,
    FullSizeRenderablesHelper,
    TraditionalRenderablesHelper
}
    from '../utils/view/RenderableGroupModules.js';
import {RenderableHelper}           from '../utils/view/RenderableHelper.js';
import {ReflowingScrollView}        from '../components/ReflowingScrollView.js';


export class View extends FamousView {

    constructor(options = {}) {

        super(options);


        /* Bind all local methods to the current object instance, so we can refer to 'this'
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);


        this._copyPrototypeProperties();
        this._initDataStructures();
        this._initOwnDecorations();
        this._initOptions(options);
        this._initUtils();
        this._constructDecoratedRenderables();

        this._combineLayouts();
        this._initTrueSizedBookkeeping();

    }

    //noinspection JSUnusedGlobalSymbols
    /**
     * Deprecated, it is no longer required to call build() from within your View instances.
     * @deprecated
     * @returns {void}
     */
    build() {
        Helpers.warn(`Arva: calling build() from within views is no longer necessary, any existing calls can safely be removed. Called from ${this._name()}`);
    }

    /**
     * Reflows the layout while also informing any subscribing parents that a reflow has to take place
     */
    reflowRecursively() {
        this.layout.reflowLayout();
        this._eventOutput.emit('recursiveReflow');
    }

    /**
     * Gets the size used when displaying a renderable on the screen the last tick
     * @param {Renderable/Name} renderableOrName The renderable or the name of the renderable of which you need the size
     */
    getResolvedSize(renderableOrName) {
        let renderable = renderableOrName;
        if (typeof renderableOrName === 'string') {
            renderable = this.renderables[renderableOrName];
        }
        let size = this._sizeResolver.getResolvedSize(renderable);

        /* Backup: If size can't be resolved, then see if there's a size specified on the decorator */
        if (!size && renderable.decorations) {
            let decoratedSize = renderable.decorations.size;
            let isValidSize = (inputSize) => typeof inputSize == 'number' && inputSize > 0;
            if (decoratedSize && decoratedSize.every(isValidSize)) {
                size = decoratedSize;
            }
        }

        return size || [undefined, undefined];
    }

    /**
     * Returns true if the view contains uncalculated surfaces
     * @returns {Boolean}
     */
    containsUncalculatedSurfaces() {
        return this._sizeResolver.containsUncalculatedSurfaces();
    }

    /**
     * Adds a renderable to the layout.
     * @param {Renderable} renderable The renderable to be added
     * @param {String} renderableName The name (key) of the renderable
     * @param {Decorator} Decorator Any decorator(s) to apply to the renderable
     * @returns {Renderable} The renderable that was assigned
     */
    addRenderable(renderable, renderableName, ...decorators) {
        /* Due to common mistake, we check if renderableName is a string */
        if (typeof renderableName !== 'string') {
            Helpers.warn(`The second argument of addRenderable(...) was not a string. Please pass the renderable name in ${this._name()}`);
        }
        this._renderableHelper.applyDecoratorFunctionsToRenderable(renderable, decorators);
        this._assignRenderable(renderable, renderableName);
        this.layout.reflowLayout();
        return renderable;
    }

    /**
     * Removes the renderable from the view
     * @param {String} renderableName The name of the renderable
     */
    removeRenderable(renderableName) {
        this._renderableHelper.removeRenderable(renderableName);
        delete this[renderableName];
        this.layout.reflowLayout();
    }

    /**
     * Rearranges the order in which docked renderables are parsed for rendering, ensuring that 'renderableName' is processed
     * before 'nextRenderableName'.
     * @param {String} renderableName
     * @param {String} nextRenderableName
     */
    prioritiseDockBefore(renderableName, nextRenderableName) {
        this.reflowRecursively();
        return this._renderableHelper.prioritiseDockBefore(renderableName, nextRenderableName);
    }

    /**
     * @param {String} renderableName
     * @param {String} prevRenderableName
     */
    prioritiseDockAfter(renderableName, prevRenderableName) {
        this.reflowRecursively();
        return this._renderableHelper.prioritiseDockAfter(renderableName, prevRenderableName);
    }

    showRenderable(renderableName, show = true) {
        let renderable = this[renderableName];
        if (!renderable.animationController) {
            Helpers.warn(`Trying to show renderable ${renderableName} which does not have an animationcontroller. Please use @layout.animate`);
            return;
        }
        this._renderableHelper.showWithAnimationController(this.renderables[renderableName], renderable, show);
        let decoratedSize = this[renderableName].decorations.size || (this[renderableName].decorations.dock ? this[renderableName].decorations.dock.size : undefined);
        if (decoratedSize) {
            /* Check if animationController has a true size specified. If so a reflow needs to be performed since there is a
             * new size to take into account. */
            for (let dimension of [0, 1]) {
                if (this._sizeResolver.isValueTrueSized(this._sizeResolver.resolveSingleSize(decoratedSize[dimension], [NaN, NaN], dimension))) {
                    this.reflowRecursively();
                    break;
                }

            }
        }
    }

    /**
     * @example
     * decorateRenderable('myRenderable',layout.size(100, 100));
     *
     * Decorates a renderable with other decorators. Using the same decorators as used previously will override the old ones.
     * @param {String} renderableName The name of the renderable
     * @param ...decorators The decorators that should be applied
     */
    decorateRenderable(renderableName, ...decorators) {
        this._renderableHelper.decorateRenderable(renderableName, ...decorators);
        this.reflowRecursively();
    }

    /**
     * Sets a renderable flow state as declared in the @flow.stateStep, or @flow.defaultState
     * @param {String} renderableName. The name of the renderable
     * @param {String} stateName. The name of the state as declared in the first argument of the decorator
     * @returns {*}
     */
    setRenderableFlowState(renderableName = '', stateName = '') {
        this.layout.reflowLayout();
        return this._renderableHelper.setRenderableFlowState(renderableName, stateName);
    }

    /**
     * Sets a renderable flow state as declared in the @flow.viewState
     * @param {String} renderableName. The name of the renderable
     * @param {String} stateName. The name of the state as declared in the first argument of the decorator
     * @returns {*}
     */
    setViewFlowState(stateName = '') {
        return this._renderableHelper.setViewFlowState(stateName, this.decorations.flow);
    }

    /**
     * Replaces an existing decorated renderable with a new renderable, preserving all necessary state and decorations
     * @param {String} renderableName. The name of the renderable
     * @param newRenderable
     */
    replaceRenderable(renderableName, newRenderable) {
        this._renderableHelper.replaceRenderable(renderableName, newRenderable);
        this.reflowRecursively();
        this[renderableName] = newRenderable;
    }

    /**
     * Hides a renderable that has been declared with @layout.animate
     * @param renderableName
     */
    hideRenderable(renderableName) {
        this.showRenderable(renderableName, false);
    }

    /**
     * Inits the utils that are used as helper classes for the view
     * @private
     */
    _initUtils() {
        this._sizeResolver = new SizeResolver();
        this._sizeResolver.on('layoutControllerReflow', this._requestLayoutControllerReflow);
        this._sizeResolver.on('reflow', () => this.layout.reflowLayout());
        this._sizeResolver.on('reflowRecursively', this.reflowRecursively);
        this._dockedRenderablesHelper = new DockedRenderablesHelper(this._sizeResolver);
        this._fullSizeRenderablesHelper = new FullSizeRenderablesHelper(this._sizeResolver);
        this._traditionalRenderablesHelper = new TraditionalRenderablesHelper(this._sizeResolver);
        this._renderableHelper = new RenderableHelper(this._bindToSelf, this._eventOutput, this.renderables, this._sizeResolver);
    }

    /** Requests for a parent LayoutController trying to resolve the size of this view
     * @private
     */
    _requestLayoutControllerReflow() {
        this._nodes = {_trueSizeRequested: true};
        //TODO: Do we really need to emit this?
        this._eventOutput.emit('layoutControllerReflow');
    }

    _getRenderableOptions(renderableName, decorations = this.renderables[renderableName]) {
        let decoratorOptions = decorations.constructionOptionsMethod ? decorations.constructionOptionsMethod.call(this, this.options) : {};
        if (!Helpers.isPlainObject(decoratorOptions)) {
            Helpers.warn(`Invalid option '${decoratorOptions}' given to item ${renderableName}`);
        }
        return decoratorOptions;
    }

    /**
     * Construct all the renderables that have been decorated in the class.
     * @private
     */
    _constructDecoratedRenderables() {

        let classConstructorList = [];

        /* Reverse the class list becaues rit makes more sense to make the renderables of the parent before the renderables
         * of this view
        */
        for (let currentClass = this; currentClass.__proto__.constructor !== View; currentClass = Object.getPrototypeOf(currentClass)) {
            classConstructorList.push(currentClass.__proto__.constructor);
        }
        classConstructorList.reverse();


        for (let currentClassConstructor of classConstructorList) {
            let renderableConstructors = this.renderableConstructors.get(currentClassConstructor);
            for (let renderableName in renderableConstructors) {
                let decorations = renderableConstructors[renderableName].decorations;

                let renderable = renderableConstructors[renderableName].call(this, this._getRenderableOptions(renderableName, decorations));

                /* Clone the decorator properties, because otherwise every view of the same type willl share them between
                 * the same corresponding renderable. TODO: profiling reveals that cloneDeep affects performance
                 */
                renderable.decorations = _.cloneDeep(_.extend({}, decorations, renderable.decorations || {}));


                /* Since after constructor() of this View class is called, all decorated renderables will
                 * be attempted to be initialized by Babel / the ES7 class properties spec, we'll need to
                 * override the descriptor get/initializer to return this specific instance once.
                 *
                 * If we don't do this, the View will have its renderables overwritten by new renderable instances
                 * that don't have constructor.options applied to them correctly. If we always return this specific instance
                 * instead of only just once, any instantiation of the same View class somewhere else in the code will refer
                 * to the renderables of this instance, which is unwanted.
                 */
                let {descriptor} = decorations;
                if (descriptor) {
                    if (descriptor.get) {
                        let originalGet = decorations.descriptor.get;
                        descriptor.get = () => {
                            descriptor.get = originalGet;
                            return renderable;
                        }
                    }
                    if (descriptor.initializer) {
                        let originalInitializer = decorations.descriptor.initializer;
                        descriptor.initializer = () => {
                            descriptor.initializer = originalInitializer;
                            return renderable;
                        }
                    }
                }
                this._assignRenderable(renderable, renderableName);
            }
        }
    }

    /**
     * Assigns a renderable to this view, without setting this[renderableName]
     * @param {Renderable} renderable the renderable that is going to be added
     * @param {String} renderableName the name of the renderable
     * @private
     */
    _assignRenderable(renderable, renderableName) {
        this._renderableHelper.assignRenderable(renderable, renderableName);
        /* Do add property to object because there can be a getter defined instead of a class property,
         * in which case we have to use the ObjectHelper
         */
        ObjectHelper.addPropertyToObject(this, renderableName, renderable, true, true, null, false);
    }
    
    _layoutDecoratedRenderables(context, options) {
        let dockedRenderables = this._renderableHelper;
        this._dockedRenderablesHelper.layout(dockedRenderables.getRenderableGroup('docked'), dockedRenderables.getRenderableGroup('filled'), context, this.decorations);
        this._fullSizeRenderablesHelper.layout(dockedRenderables.getRenderableGroup('fullSize'), context, this.decorations);
        this._traditionalRenderablesHelper.layout(dockedRenderables.getRenderableGroup('traditional'), context, this.decorations);
    }


    /**
     * Combines all layouts defined in subclasses of the View into a single layout for the LayoutController.
     * @returns {void}
     * @private
     */
    _combineLayouts() {
        let hasFlowyRenderables = this._renderableHelper.hasFlowyRenderables();
        this.layout = new LayoutController({
            flow: !!this.decorations.useFlow || hasFlowyRenderables,
            partialFlow: !this.decorations.useFlow,
            flowOptions: this.decorations.flowOptions || {},
            layout: function (context, options) {

                /* Because views that extend this View class first call super() and then define their renderables,
                 * we wait until the first engine render tick to add our renderables to the layout, when the view will have declared them all.
                 * layout.setDataSource() will automatically pipe events from the renderables to this View. */
                if (!this._initialised) {
                    this.layout.setDataSource(this.renderables);
                    this._renderableHelper.pipeAllRenderables();
                    this._renderableHelper.initializeAnimations();
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
                this._layoutDecoratedRenderables(context, options);
                if (this.decorations.customLayoutFunction) {
                    this.decorations.customLayoutFunction(context);
                }


                this._doTrueSizedSurfacesBookkeeping();

                /* Legacy context.set() based layout functions */
                if (this.layouts.length) {
                    this._callLegacyLayoutFunctions(context, options);
                }
            }.bind(this)
        });

        this._eventInput.on('recursiveReflow', () => {
            this.reflowRecursively();
        });

        /* Add the layoutController to this View's rendering context. */
        this._prepareLayoutController();
    }

    /**
     * Layout all renderables that have explicit context.set() calls in this View's legacy layout array.
     * @returns {void}
     * @private
     */
    _callLegacyLayoutFunctions(context, options) {
        for (let layout of this.layouts) {
            try {
                switch (typeof layout) {
                    case 'function':
                        layout.call(this, context, options);
                        break;
                    default:
                        Helpers.warn(`Unrecognized layout specification in view '${this._name()}'.`);
                        break;
                }
            } catch (error) {
                Helpers.warn(`Exception thrown in ${this._name()}:`);
                console.log(error);
            }
        }
    }

    /**
     * Either adds this.layout (a LayoutController) to the current View, or a FlexScrollView containing this.layout if this view
     * has been decorated with a @scrollable.
     * @returns {void}
     * @private
     */
    _prepareLayoutController() {
        if (this.decorations.isScrollable) {
            this._scrollView = new ReflowingScrollView();
            this.layout.getSize = this.getSize;
            this._scrollView.push(this.layout);
            this.pipe(this._scrollView);
            this.add(this._scrollView);
        }
        else {
            this.add(this.layout);
        }
    }

    /**
     * Gets the scroll view that was set if @layout.scrollable was used on the view
     * @returns {ReflowingScrollView}
     */
    getScrollView() {
        return this._scrollView;
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
     *
     * @returns {*[]}
     * @private
     */
    _getLayoutSize() {
        let dockedRenderables = this._renderableHelper.getRenderableGroup('docked');
        let traditionalRenderables = this._renderableHelper.getRenderableGroup('traditional');
        let filledRenderables = this._renderableHelper.getRenderableGroup('filled');
        if (!traditionalRenderables && !dockedRenderables) {
            return [undefined, undefined];
        }
        let totalSize = [0, 0];
        if (dockedRenderables) {

            // totalSize = this._calculateDockedRenderablesBoundingBox();
            totalSize = this._dockedRenderablesHelper.boundingBoxSize(dockedRenderables, filledRenderables, this.decorations);
            if (totalSize[0] === undefined && totalSize[1] === undefined) {
                /* We can return here because it isn't necessary to check further */
                return [undefined, undefined];
            }
        }

        if (traditionalRenderables) {
            let traditionalRenderablesBoundingBox = this._traditionalRenderablesHelper.boundingBoxSize(traditionalRenderables);
            for (let [dimension, singleSize] of totalSize.entries()) {
                let traditionalSingleSize = traditionalRenderablesBoundingBox[dimension];
                if (singleSize === undefined || singleSize < traditionalSingleSize) {
                    totalSize[dimension] = traditionalSingleSize;
                }
            }
        }
        return totalSize;

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
     * Copies prototype properties set by decorators to this
     * @private
     */
    _copyPrototypeProperties() {
        let prototype = Object.getPrototypeOf(this);

        /* Move over all renderable- and decoration information that decorators.js set to the View prototype */
        for (let name of ['decorationsMap', 'renderableConstructors']) {
            this[name] = _.cloneDeep(prototype[name]) || new Map();
        }
    }

    /**
     * Inits the decorations that is set on a class level
     * @private
     */
    _initOwnDecorations() {
        for (let currentClass = this; currentClass.__proto__.constructor !== View; currentClass = Object.getPrototypeOf(currentClass)) {
            /* The close the decoration is to this constructor in the prototype chain, the higher the priority */
            let decorations = this.decorationsMap.get(currentClass.__proto__.constructor);
            for (let property in decorations) {
                if (!(property in this.decorations)) {
                    this.decorations[property] = decorations[property];
                }
            }
        }
    }
    
    _doTrueSizedSurfacesBookkeeping() {
        this._nodes._trueSizeRequested = false;
    }

    _initTrueSizedBookkeeping() {
        this.layout.on('layoutstart', ({oldSize, size}) => {
            if (size[0] !== oldSize[0] ||
                size[1] !== oldSize[1]) {
                this._sizeResolver.doTrueSizedBookkeeping();
                this._eventOutput.emit('newSize', size);
            }
        });
        /* Hack to make the layoutcontroller reevaluate sizes on resize of the parent */
        this._nodes = {_trueSizedRequested: false};
        /* This needs to be set in order for the LayoutNodeManager to be happy */
        this.options.size = this.options.size || [true, true];
    }


    _initOptions(options) {
        if (!Helpers.isPlainObject(options)) {
            Helpers.warn(`View ${this._name()} initialized with invalid non-object arguments`);
        }
        this.options = options;
    }

    _initDataStructures() {
        if (!this.renderables) {
            this.renderables = {};
        }
        if (!this.layouts) {
            this.layouts = [];
        }

        if (!this.decorations) {
            this.decorations = {};
        }

        if (!this.decorations.extraTranslate) {
            this.decorations.extraTranslate = [0, 0, 10];
        }
    }

    /**
     * Binds the method to this view. Used by the util DecoratedRenderables
     * @param {Function} method The method that is about to be bound
     * @returns {*}
     * @private
     */
    _bindToSelf(method) {
        return method.bind(this);
    }
}