/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import OrderedHashMap               from 'ordered-hashmap';
import FamousView                   from 'famous/core/View.js';
import LayoutController             from 'famous-flex/LayoutController.js';
import Draggable                    from 'famous/modifiers/Draggable';
import RenderNode                   from 'famous/core/RenderNode';
import MouseSync                    from 'famous/inputs/MouseSync.js';
import TouchSync                    from 'famous/inputs/TouchSync.js';
import GenericSync                  from 'famous/inputs/GenericSync.js';
import Easing                       from 'famous/transitions/Easing.js';
import Transitionable               from 'famous/transitions/Transitionable.js';
import Modifier                     from 'famous/core/Modifier.js';
import Transform                    from 'famous/core/Transform.js';
import AnimationController          from 'famous-flex/AnimationController.js';
import ContainerSurface             from 'famous/Surfaces/ContainerSurface.js';

import {limit}                      from 'arva-js/utils/Limiter.js';

import {ObjectHelper}               from '../utils/ObjectHelper.js';
import {SizeResolver}               from '../utils/view/SizeResolver.js';
import {Helpers}                    from '../utils/view/Helpers.js';
import {DockedRenderables,
    FullSizeRenderables,
    TraditionalRenderables}
                                    from '../utils/view/RenderableGroupModules.js';
import {ReflowingScrollView}        from '../components/ReflowingScrollView.js';
import {
    callbackToPromise,
    waitMilliseconds
}                                   from '../utils/CallbackHelpers.js';


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
        this._constructDecoratedRenderables();
        this._initUtils();

        this._combineLayouts();
        this._initTrueSizedBookkeeping();

    }

    get hasDecorators() {
        return !!this.decoratedRenderables;
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
        for (let decorator of decorators) {
            /* The decorator(s) provided in the last argument needed to decorate the renderable */
            decorator(renderable);
        }

        this._assignRenderable(renderable, renderableName);
        this.layout.reflowLayout();
        return renderable;
    }

    removeRenderable(renderableName) {
        let renderable = this[renderableName];
        this._setDecorationPipes(renderableName, false);
        this._setDecorationEvents(renderableName, false);
        this._unpipeRenderable(renderableName, renderableName);
        this._removeRenderableFromDecoratorGroup(renderable, renderableName);
        delete this.renderables[renderableName];
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
        let docked = this._groupedRenderables.docked;
        if (!docked) {
            Helpers.warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': no docked renderables present.`);
            return false;
        }
        let result = this._prioritiseDockAtIndex(renderableName, docked.indexOf(nextRenderableName));
        if (!result) {
            Helpers.warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': could not find one of the renderables by name.
                        The following docked renderables are present: ${docked.keys()}`);
        }
        return result;
    }

    /**
     * @param {String} renderableName
     * @param {String} prevRenderableName
     */
    prioritiseDockAfter(renderableName, prevRenderableName) {
        let docked = this._groupedRenderables.docked;
        if (!docked) {
            Helpers.warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': no docked renderables present.`);
            return false;
        }
        let result = this._prioritiseDockAtIndex(renderableName, docked.indexOf(prevRenderableName) + 1);
        if (!result) {
            Helpers.warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': could not find one of the renderables by name.
                        The following docked renderables are present: ${docked.keys()}`);
        }
        return result;
    }

    showRenderable(renderableName, show = true) {
        let renderable = this[renderableName];
        if (!renderable.animationController) {
            Helpers.warn(`Trying to show renderable ${renderableName} which does not have an animationcontroller. Please use @layout.animate`);
            return;
        }
        this._showWithAnimationController(this.renderables[renderableName], renderable, show);
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
        let renderable = this[renderableName];
        let fakeRenderable = {
            decorations: {
                translate: renderable.decorations.translate || [0, 0, 0],
                rotate: renderable.decorations.rotate || [0, 0, 0]
            }
        };
        if (!decorators.length) {
            Helpers.warn('No decorators specified to decorateRenderable(renderableName, ...decorators)');
        }
        for (let decorator of decorators) {
            /* There can be existing decorators already, which are preserved. We are extending the decorators object,
             * by first creating a fake renderable that gets decorators */
            decorator(fakeRenderable);
        }
        let {decorations} = fakeRenderable;
        let renderableOrEquivalent = this._getPipeableRenderableFromName(renderableName);
        /* We might need to do extra piping */
        this._setDecorationPipes(renderableOrEquivalent, decorations.pipes);
        this._setDecorationEvents(renderableOrEquivalent, decorations.eventSubscriptions);

        /* If the renderable is surface, we need to do some special things if there is a true size being used */
        if (Helpers.renderableIsSurface(renderable)) {
            let sizesToCheck = [];
            let {size, dock} = decorations;
            if (size) {
                sizesToCheck.push(size);
            }
            if (dock) {
                sizesToCheck.push(dock.size);
            }
            let renderableSize = [undefined, undefined];
            for (let sizeToCheck of sizesToCheck) {
                for (let dimension of [0, 1]) {
                    let trueSizedInfo = this._sizeResolver.getSurfaceTrueSizedInfo(renderable);
                    if (this._sizeResolver.isValueTrueSized(sizeToCheck[dimension])) {
                        if (!trueSizedInfo) {
                            trueSizedInfo = this._sizeResolver.configureTrueSizedSurface(renderable);
                        }
                        trueSizedInfo.trueSizedDimensions[dimension] = true;
                        renderableSize[dimension] = true;
                    } else {
                        if (trueSizedInfo) {
                            trueSizedInfo.trueSizedDimensions[dimension] = false;
                        }
                    }
                }
            }
            if (sizesToCheck.length) {
                renderable.setSize(renderableSize);
            }
        }
        let oldRenderableGroupName = this._getGroupName(renderable);
        let shouldDisableDock = (fakeRenderable.decorations.disableDock && renderable.decorations.dock);
        let shouldDisableFullSize = (fakeRenderable.decorations.size && renderable.decorations.fullSize);
        if (shouldDisableDock) {
            delete renderable.decorations.dock;
        }
        if (shouldDisableFullSize) {
            delete renderable.decorations.fullSize;
        }
        /* Extend the object */
        Object.assign(renderable.decorations, fakeRenderable.decorations);
        /* See if we have to redo the grouping */
        let needToChangeDecoratorGroup = (oldRenderableGroupName !== this._getGroupName(renderable)) || shouldDisableDock || shouldDisableFullSize;
        /* Process new renderable equivalent, if that applies */
        this.renderables[renderableName] = this._processDecoratedRenderableEquivalent(renderable, renderableName);
        if (needToChangeDecoratorGroup) {
            this._removeRenderableFromGroupWithName(renderableName, oldRenderableGroupName);
            this._addRenderableToDecoratorGroup(renderable, renderableName);
        }
        this.reflowRecursively();
    }

    /**
     * Does bookkeeping for a new flow state
     *
     * @param renderableName
     * @param stateName
     * @private
     */
    _registerNewFlowState(renderableName) {
        let currentFlow = {};
        let runningFlowStates = this._runningFlowStates[renderableName];
        if (!runningFlowStates) {
            this._runningFlowStates[renderableName] = runningFlowStates = [];
        }
        let flowWasInterrupted = false;
        runningFlowStates.push(currentFlow);

        runningFlowStates.forEach((flowState) => {
            flowState.shouldInterrupt = (flowState !== currentFlow);
        });
        return currentFlow;
    }

    _removeFinishedFlowState(renderableName, flowState) {
        let runningFlowStates = this._runningFlowStates[renderableName];
        runningFlowStates.splice(runningFlowStates.indexOf(flowState), 1);
    }

    async setRenderableFlowState(renderableName = '', stateName = '') {

        let renderable = this[renderableName];
        if (!renderable || !renderable.decorations || !renderable.decorations.flow) {
            return Helpers.warn(`setRenderableFlowState called on non-existing or renderable '${renderableName}' without flowstate`);
        }
        let flowOptions = renderable.decorations.flow;


        /* Keep track of which flow state changes are running. We only allow one at a time per renderable.
         * The latest one is always the valid one.
         */
        let currentFlow = this._registerNewFlowState(renderableName);
        let flowWasInterrupted = false;

        flowOptions.currentState = stateName;
        for (let {transformations, options} of flowOptions.states[stateName].steps) {
            flowOptions.currentTransition = options.transition || flowOptions.defaults.curve || {
                    curve: Easing.outCubic,
                    duration: 300
                };

            this.decorateRenderable(renderableName, ...transformations);

            let renderableOn = renderable.on.bind(renderable);
            await Promise.race([callbackToPromise(renderableOn, 'flowEnd'), callbackToPromise(renderableOn, 'flowInterrupted').then(() => console.log("INterrupted"))]);

            /* Optionally, we insert a delay in between ending the previous state change, and starting on the new one. */
            if (options.delay) {
                await waitMilliseconds(options.delay);
            }

            /* If the flow has been interrupted */
            if (currentFlow.shouldInterrupt) {
                flowWasInterrupted = true;
                break;
            }

            let emit = (renderable._eventOutput && renderable._eventOutput.emit || renderable.emit).bind(renderable._eventOutput || renderable);
            emit('flowStep', {state: stateName});
        }
        this._removeFinishedFlowState(renderableName, currentFlow);


        return !flowWasInterrupted;
    }

    async setViewFlowState(stateName = '') {
        let flowOptions = this.decorations.flow;
        let steps = flowOptions.viewStates[stateName];

        /* This is intended to be overwritten by other asynchronous calls to this method, see the stateName check below. */
        flowOptions.currentState = stateName;

        for (let step of steps) {
            let waitQueue = [];
            for (let renderableName in step) {
                let state = step[renderableName];
                waitQueue.push(this.setRenderableFlowState(renderableName, state));
            }
            await Promise.all(waitQueue);

            /* If another state has been set since the invocation of this method, skip any remaining transformations. */
            if (flowOptions.currentState !== stateName) {
                break;
            }
        }

        return true;
    }

    replaceRenderable(renderableName, newRenderable) {
        let renderable = this[renderableName];
        let renderableHasAnimationController = (this.renderables[renderableName] instanceof AnimationController);
        /* If there isn't a renderable equivalent animationController that does the piping, then we need to redo the event piping */
        if (!renderableHasAnimationController) {
            this._setupAllRenderableListeners(renderableName, false);
        }
        newRenderable.decorations = {...newRenderable.decorations, ...renderable.decorations};
        let newRenderableEquivalent = this._processDecoratedRenderableEquivalent(newRenderable, renderableName);
        this._groupedRenderables[this._getGroupName(renderable)].set(renderableName, newRenderable);
        if (!renderableHasAnimationController) {
            this.renderables[renderableName] = newRenderableEquivalent;
            this._setupAllRenderableListeners(renderableName, true);
        }
        this.reflowRecursively();
        this[renderableName] = newRenderable;
    }

    hideRenderable(renderableName) {
        this.showRenderable(renderableName, false);
    }

    _initUtils() {
        this._sizeResolver = new SizeResolver();
        this._sizeResolver.on('layoutControllerReflow', this._requestLayoutControllerReflow);
        this._sizeResolver.on('reflow', () => this.layout.reflowLayout());
        this._sizeResolver.on('reflowRecursively', this.reflowRecursively);
        this._dockedRenderables = new DockedRenderables(this._sizeResolver);
        this._fullSizeRenderables = new FullSizeRenderables(this._sizeResolver);
        this._traditionalRenderables = new TraditionalRenderables(this._sizeResolver);
    }

    _showWithAnimationController(animationController, renderable, show = true) {
        animationController._showingRenderable = show;
        let callback = () => {
            if (renderable.emit) {
                renderable.emit(show ? 'shown' : 'hidden');
            }
        };

        if (show) {
            animationController.show(renderable.containerSurface || renderable, null, callback);
        } else {
            animationController.hide(null, callback);
        }
    }

    /**
     * Helper function used by prioritiseDockBefore and prioritiseDockAfter to change order of docked renderables
     * @param renderableName
     * @param index
     * @returns {boolean}
     * @private
     */
    _prioritiseDockAtIndex(renderableName, index) {
        let docked = this._groupedRenderables.docked;
        let renderableToRearrange = docked.get(renderableName);

        if (index < 0 || !renderableToRearrange) {
            return false;
        }

        docked.remove(renderableName);
        docked.insert(index, renderableName, renderableToRearrange);
        this.reflowRecursively();
        return true;

    }

    /** Requests for a parent layoutcontroller trying to resolve the size of this view
     * @private
     */
    _requestLayoutControllerReflow() {
        this._nodes = {_trueSizeRequested: true};
        this._eventOutput.emit('layoutControllerReflow');
    }

    _isPlainObject(object) {
        return typeof object == 'object' && object.constructor.name == 'Object';
    }

    _getRenderableOptions(renderableName, decorations = this.renderables[renderableName]) {
        let decoratorOptions = decorations.constructionOptionsMethod ? decorations.constructionOptionsMethod.call(this, this.options) : {};
        if (!this._isPlainObject(decoratorOptions)) {
            Helpers.warn(`Invalid option '${decoratorOptions}' given to item ${renderableName}`);
        }
        return decoratorOptions;
    }

    _constructDecoratedRenderables() {

        let classList = [];

        for (let currentClass = this; currentClass.__proto__.constructor !== View; currentClass = Object.getPrototypeOf(currentClass)) {
            classList.push(currentClass);
        }
        classList.reverse();


        for (let currentClass of classList) {
            let renderableConstructors = this.renderableConstructors.get(currentClass.__proto__.constructor);
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

    _unpipeRenderable(renderableName) {
        let renderable = this._pipedRenderables[renderableName];
        /* Auto pipe events from the renderable to the view */
        if (renderable && renderable.unpipe) {
            renderable.unpipe(this);
            renderable.unpipe(this._eventOutput);
            delete this._pipedRenderables[renderableName];
        }
    }

    _pipeRenderable(renderable, renderableName) {
        /* Auto pipe events from the renderable to the view */
        if (renderable.pipe) {
            renderable.pipe(this);
            renderable.pipe(this._eventOutput);
            this._pipedRenderables[renderableName] = renderable;
        }
    }

    /**
     * Sets the decoration events that are specified with (among potential others) @layout.on and @layout.once
     * @param {String} renderableName
     * @param enable. If false, removes the events.
     * @private
     */
    _setDecorationEvents(renderable, subscriptions, enable = true) {
        for (let subscription of subscriptions || []) {
            let subscriptionType = subscription.type || 'on';
            if (!enable) {
                /* In famous, you remove a listener by calling removeListener, but some classes might have another event
                 * listener that is called off
                 */
                subscriptionType = renderable.removeListener ? 'removeListener' : 'off';
            }
            let eventName = subscription.eventName;
            let callback = subscription.callback;
            if (subscriptionType in renderable) {
                /* Always pipe the this.renderables thing, not the renderable itself */
                renderable[subscriptionType](eventName, callback.bind(this));
            }
        }
    }

    _setDecorationPipes(renderable, pipes, enabled = true) {
        for (let pipeToName of pipes || []) {
            let target = pipeToName ? this[pipeToName] : this;
            let pipeFn = (enabled ? '' : 'un') + 'pipe';
            /* In order to keep things consistent and easier to use, we pipe from the renderable equivalent */
            if (renderable[pipeFn]) {
                renderable[pipeFn](target);
            }
            if (renderable[pipeFn] && target._eventOutput) {
                renderable[pipeFn](target._eventOutput);
            }
        }

    }

    _setupAllRenderableListeners(renderableName, enabled = true) {
        /* If the this.renderables equivalent doesn't have the pipe function as is the case with the draggable, then use the regular renderable */
        let renderableOrEquivalent = this._getPipeableRenderableFromName(renderableName);
        if (enabled) {
            this._pipeRenderable(renderableOrEquivalent, renderableName);
        } else {
            this._unpipeRenderable(renderableOrEquivalent, renderableName);
        }
        let {decorations} = this[renderableName];
        if (decorations) {
            this._setDecorationPipes(renderableOrEquivalent, decorations.pipes, enabled);
            this._setDecorationEvents(renderableOrEquivalent, decorations.eventSubscriptions, enabled);
        }

    }

    _getPipeableRenderableFromName(renderableName) {
        return this.renderables[renderableName].pipe ? this.renderables[renderableName] : this[renderableName];
    }

    _assignRenderable(renderable, renderableName) {
        let renderableEquivalent = this._addDecoratedRenderable(renderable, renderableName);
        this.renderables[renderableName] = renderableEquivalent;
        ObjectHelper.addPropertyToObject(this, renderableName, renderable);
        this._setupAllRenderableListeners(renderableName);
    }


    _layoutDecoratedRenderables(context, options) {
        this._dockedRenderables.layout(this._groupedRenderables['docked'], this._groupedRenderables['filled'], context, this.decorations);
        this._fullSizeRenderables.layout(this._groupedRenderables['fullSize'], context, this.decorations);
        this._traditionalRenderables.layout(this._groupedRenderables['traditional'], context, this.decorations);
    }
    

    /**
     * Combines all layouts defined in subclasses of the View into a single layout for the LayoutController.
     * @returns {void}
     * @private
     */
    _combineLayouts() {

        this.layout = new LayoutController({
            flow: !!this.decorations.useFlow || this._usesPartialFlow,
            partialFlow: this._usesPartialFlow,
            flowOptions: this.decorations.flowOptions || {},
            layout: function (context, options) {

                /* Because views that extend this View class first call super() and then define their renderables,
                 * we wait until the first engine render tick to add our renderables to the layout, when the view will have declared them all.
                 * layout.setDataSource() will automatically pipe events from the renderables to this View. */
                if (!this._initialised) {
                    this._addAllRenderables();
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
                    if (this.decorations.customLayoutFunction) {
                        this.decorations.customLayoutFunction(context);
                    }
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
     * The total layout height is the difference between the lowest y coordinate drawn, and the largest one.
     * @returns {*[]}
     * @private
     */
    _getLayoutSize() {
        let {
            docked: dockedRenderables,
            traditional: traditionalRenderables, ignored: ignoredRenderables
        } = this._groupedRenderables;
        if (!traditionalRenderables && !ignoredRenderables && !dockedRenderables) {
            return [undefined, undefined];
        }
        let totalSize = [0, 0];
        if (dockedRenderables) {

            // totalSize = this._calculateDockedRenderablesBoundingBox();
            totalSize = this._dockedRenderables.boundingBoxSize(this._groupedRenderables['docked'], this._groupedRenderables['filled'], this.decorations);
            if (totalSize[0] === undefined && totalSize[1] === undefined) {
                /* We can return here because it isn't necessary to check further */
                return [undefined, undefined];
            }
        }

        if (traditionalRenderables || ignoredRenderables) {
            let traditionalNames = traditionalRenderables ? traditionalRenderables.keys() : [];
            let ignoredNames = ignoredRenderables ? ignoredRenderables.keys() : [];
            let combinedNames = traditionalNames.concat(ignoredNames);

            for (let renderableName of combinedNames) {
                let renderable = this.renderables[renderableName];
                let size = this.getResolvedSize(renderable);
                if (!size) {
                    continue;
                }
                let renderableSpec;
                /* If the renderable is included in the ignored renderables */
                if (ignoredRenderables && ignoredRenderables.indexOf(renderableName) !== -1) {
                    /* We rather not want to do this, because this function makes a loop that means quadratic complexity */
                    renderableSpec = this.layout.getSpec(renderableName);
                    renderableSpec.translate = renderableSpec.transform.slice(-4, -1);
                } else {
                    renderableSpec = renderable.decorations;
                    renderableSpec.align = renderableSpec.align || [0, 0];
                    renderableSpec.translate = renderableSpec.translate || [0, 0, 0];

                    if (renderableSpec.translate) {
                        renderableSpec.translate = Helpers.adjustPlacementForTrueSize(renderable, size, renderableSpec.origin || [0, 0]
                            , renderableSpec.translate);
                    } else {
                        renderableSpec.translate = [0, 0, 0];
                    }
                }


                /* If there has been an align specified, then nothing can be calculated */
                if (!renderableSpec || !renderableSpec.size || (renderableSpec.align[0] && renderableSpec.align[1])) {
                    continue;
                }

                let {translate, align} = renderableSpec;
                /* If the renderable has a lower min y/x position, or a higher max y/x position, save its values */
                for (let i = 0; i < 2; i++) {
                    /* Undefined is the same as context size */
                    if (size[i] !== undefined && !(align && align[i]) && totalSize[i] !== undefined) {
                        totalSize[i] = Math.max(totalSize[i], translate[i] + size[i]);
                    }

                }
            }
            let width = totalSize[0], height = totalSize[1];
            totalSize = [(width || width == 0) ? width : undefined, (height || height == 0) ? height : undefined];
        }
        /* If the total size is still [0, 0], there weren't any renderables to do our calculation, so return [undefined, undefined]  */
        if (totalSize[0] === 0 && totalSize[1] === 0) {
            return [undefined, undefined];
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
     * Pipes the output events of all items in this.renderables to the LayoutController in this.layout.
     * @returns {void}
     * @private
     */
    _addAllRenderables() {
        this.layout.setDataSource(this.renderables);
        for (let renderableName in this.renderables) {
            if (!this._pipedRenderables[renderableName]) {
                this._pipeRenderable(this._getPipeableRenderableFromName(renderableName), renderableName);
            }
        }
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
                Helpers.warn(`Attempted to delay showing renderable ${this._name()}.${animation.waitFor}, which does not exist or contain an on() method.`);
            }
        }


    }

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
        if (!this._isPlainObject(options)) {
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
        if (!this.decoratedRenderables) {
            this.decoratedRenderables = {};
        }

        if (!this.delayedAnimations) {
            this.delayedAnimations = [];
        }
        if (!this.waitingAnimations) {
            this.waitingAnimations = [];
        }
        if (!this.immediateAnimations) {
            this.immediateAnimations = [];
        }
        /* Keeping track of piped renderables */
        this._pipedRenderables = {};
        this._groupedRenderables = {};

        this._runningFlowStates = {};
    }

    /**
     * Adds a decorated renderable to the bookkeeping of the view
     * @param renderable
     * @param renderableName
     * @returns {Renderable} newRenderable The renderable that should be stored in this.renderables[renderableName]
     * @private
     */
    _addDecoratedRenderable(renderable, renderableName) {
        this.decoratedRenderables[renderableName] = renderable;
        let {flow, size, dock} = renderable.decorations;
        if (flow) {
            if (!this.decorations.useFlow) {
                this._usesPartialFlow = true;
            }
            renderable.isFlowy = true;
        }
        if (size) {
            this._bindSizeFunctions(size);
        }
        if (dock && dock.size) {
            this._bindSizeFunctions(dock.size);
        }
        this._addRenderableToDecoratorGroup(renderable, renderableName);
        return this._processDecoratedRenderableEquivalent(renderable, renderableName);
    }

    _bindSizeFunctions(size) {
        for (let index = 0; index < 2; index++) {
            if (typeof size[index] === 'function') {
                size[index] = size[index].bind(this);
            }
        }
    }

    _processDecoratedRenderableEquivalent(renderable, renderableName) {
        let {draggableOptions, swipableOptions, clip, animation} = renderable.decorations;

        /* If we clip, then we need to create a containerSurface */
        if (clip) {
            let clipSize = clip.size;
            /* Resolve clipSize specified as undefined */
            if (clipSize[0] === undefined || clipSize[1] === undefined) {
                this.layout.once('layoutstart', ({size}) => {
                    for (let i of [0, 1]) {
                        clipSize[i] = clipSize[i] || size[i]
                    }
                });
            }
            let containerSurface = new ContainerSurface({
                size: clipSize,
                properties: {overflow: 'hidden', ...clip.properties}
            });
            containerSurface.add(renderable);
            if (containerSurface.pipe) {
                containerSurface.pipe(renderable._eventOutput);
            }
            renderable.containerSurface = containerSurface;
        }

        if (animation) {
            this._processAnimatedRenderable(renderable, renderableName, animation);
        }

        if (swipableOptions) {
            renderable = this._initSwipable(swipableOptions, renderable);

        } else if (draggableOptions) {
            renderable.node = new RenderNode();
            let draggable = new Draggable(draggableOptions);
            renderable.draggable = draggable;
            renderable.node.add(draggable).add(renderable);
            renderable.pipe(draggable);
            renderable.pipe(this._eventOutput);
            draggable.pipe(this._eventOutput);
        }

        if (renderable.node) {
            /* Assign output handler */
            renderable.node._eventOutput = renderable._eventOutput;
        }
        /* If a renderable has an AnimationController used to animate it, add that to this.renderables.
         * If a renderable has an ContainerSurface used to clip it, add that to this.renderables.
         * this.renderables is used in the LayoutController in this.layout to render this view. */
        return renderable.animationController || renderable.containerSurface || renderable.node || renderable;
    }

    _processAnimatedRenderable(renderable, renderableName, options) {

        let pipeRenderable = () => {
            if (renderable.pipe) renderable.pipe(renderable.animationController._eventOutput)
        };

        /* If there's already an animationcontroller present, just change the options */
        if (this.renderables[renderableName] instanceof AnimationController) {
            renderable.animationController = this.renderables[renderableName];
            this.renderables[renderableName].setOptions(options);
            pipeRenderable();
        } else {
            let animationController = renderable.animationController = new AnimationController(options);
            pipeRenderable();
            let showMethod = this._showWithAnimationController.bind(this, animationController, renderable);

            if (options.delay && options.delay > 0 && options.showInitially) {
                Timer.setTimeout(showMethod, options.delay);
            } else if (options.waitFor) {
                this.waitingAnimations.push({showMethod: showMethod, waitFor: options.waitFor});
            } else if (options.showInitially) {
                showMethod();
            }


        }
    }

    _addRenderableToDecoratorGroup(renderable, renderableName) {
        /* Group the renderable */
        let groupName = this._getGroupName(renderable);

        if (groupName) {
            if (!(groupName in this._groupedRenderables)) {
                this._groupedRenderables[groupName] = new OrderedHashMap();
            }
            /* We save the both the renderable and the renderable counterpart in pairs */
            this._groupedRenderables[groupName].set(renderableName, [renderable, this.renderables[renderableName]]);
        }
    }

    _removeRenderableFromDecoratorGroup(renderable, renderableName) {
        let groupName = this._getGroupName(renderable);
        this._removeRenderableFromGroupWithName(renderableName, groupName);
    }

    _removeRenderableFromGroupWithName(renderableName, groupName) {
        let group = this._groupedRenderables[groupName];
        group.remove(renderableName);
        if (!group.count()) {
            delete this._groupedRenderables[groupName];
        }
    }

    _getGroupName(renderable) {
        let {decorations} = renderable;

        if (!!decorations.dock) {
            /* 'filled' is a special subset of 'docked' renderables, that need to be rendered after the normal 'docked' renderables are rendered. */
            return decorations.dock.dockMethod === 'fill' ? 'filled' : 'docked';
        } else if (!!decorations.fullSize) {
            return 'fullSize';
        } else if (decorations.size || decorations.origin || decorations.align || decorations.translate) {
            return 'traditional';
        } else {
            /* This occurs e.g. when a renderable is only marked @renderable, and its parent view has a @layout.custom decorator to define its context. */
            return 'ignored';
        }
    }

    /**
     * Create the swipable and register all the event logic for a swipable renderable
     * @private
     */
    _initSwipable(swipableOptions = {}, renderable = {}) {
        GenericSync.register({
            'mouse': MouseSync,
            'touch': TouchSync
        });

        let sync = new GenericSync({
            'mouse': {},
            'touch': {}
        });

        renderable.pipe(sync);

        /* Translation modifier */
        var positionModifier = new Modifier({
            transform: function () {
                let [x, y] = position.get();
                return Transform.translate(x, y, 0);
            }
        });

        var position = new Transitionable([0, 0]);

        sync.on('update', (data)=> {
            let [x,y] = position.get();
            x += !swipableOptions.snapX ? data.delta[0] : 0;
            y += !swipableOptions.snapY ? data.delta[1] : 0;
            let {yRange = [0, 0], xRange = [0, 0]} = swipableOptions;
            y = limit(yRange[0], y, yRange[1]);
            x = limit(xRange[0], x, xRange[1]);
            position.set([x, y]);
        });

        sync.on('end', (data)=> {
            let [x,y] = position.get();
            data.velocity[0] = Math.abs(data.velocity[0]) < 0.5 ? data.velocity[0] * 2 : data.velocity[0];
            let endX = swipableOptions.snapX ? 0 : x + data.delta[0] + (data.velocity[0] * 175);
            let endY = swipableOptions.snapY ? 0 : y + data.delta[1] + (data.velocity[1] * 175);
            let {yRange = [0, 0], xRange = [0, 0]} = swipableOptions;
            endY = limit(yRange[0], endY, yRange[1]);
            endX = limit(xRange[0], endX, xRange[1]);
            position.set([endX, endY], {
                curve: Easing.outCirc,
                duration: (750 - Math.abs((data.velocity[0] * 150)))
            });

            this._determineSwipeEvents(renderable, swipableOptions, endX, endY);

        });

        renderable.node = new RenderNode();
        renderable.node.add(positionModifier).add(renderable);
        renderable.pipe(this._eventOutput);

        return renderable;

    }

    _determineSwipeEvents(renderable, swipableOptions = {}, endX = 0, endY = 0) {

        if (!renderable || !renderable._eventOutput) return;

        let xThreshold = swipableOptions.xThreshold || [undefined, undefined];
        let yThreshold = swipableOptions.yThreshold || [undefined, undefined];

        if (xThreshold[1] && endX > xThreshold[1]) {
            renderable._eventOutput.emit('swiped', {
                direction: 0,
                displacement: 'right'
            });
        }

        if (xThreshold[0] && endX < xThreshold[0]) {
            renderable._eventOutput.emit('swiped', {
                direction: 0,
                displacement: 'left'
            });
        }

        if (yThreshold[1] && endY > yThreshold[1]) {
            renderable._eventOutput.emit('swiped', {
                direction: 1,
                displacement: 'bottom'
            });
        }

        if (yThreshold[0] && endY < yThreshold[0]) {
            renderable._eventOutput.emit('swiped', {
                direction: 1,
                displacement: 'top'
            });
        }
    }
}
