/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import OrderedHashMap               from 'ordered-hashmap';
import FamousView                   from 'famous/core/View.js';
import LayoutController             from 'famous-flex/LayoutController.js';
import Surface                      from 'famous/core/Surface.js';
import Draggable                    from 'famous/modifiers/Draggable';
import RenderNode                   from 'famous/core/RenderNode';

import {limit}                      from 'arva-js/utils/Limiter.js';

import ImageSurface                 from 'famous/surfaces/ImageSurface.js';
import AnimationController          from 'famous-flex/AnimationController.js';
import ContainerSurface             from 'famous/Surfaces/ContainerSurface.js';

import {TrueSizedLayoutDockHelper}  from '../layout/TrueSizedLayoutDockHelper.js';
import {ObjectHelper}               from '../utils/ObjectHelper.js';
import {ReflowingScrollView}        from '../components/ReflowingScrollView.js';

import MouseSync                    from 'famous/inputs/MouseSync.js';
import TouchSync                    from 'famous/inputs/TouchSync.js';
import EventHandler                 from 'famous/core/EventHandler.js';
import GenericSync                  from 'famous/inputs/GenericSync.js';
import Easing                       from 'famous/transitions/Easing.js';
import Transitionable               from 'famous/transitions/Transitionable.js';
import Modifier                     from 'famous/core/Modifier.js';
import Transform                    from 'famous/core/Transform.js';
import {callbackToPromise,
        waitMilliseconds}           from '../utils/CallbackHelpers.js';


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
     * Gets the size used when displaying a renderable on the screen the last tick
     * @param {Renderable/Name} renderableOrName The renderable or the name of the renderable of which you need the size
     */
    getResolvedSize(renderableOrName) {
        let renderable = renderableOrName;
        if (typeof renderableOrName === 'string') {
            renderable = this.renderables[renderableOrName];
        }
        let size = this._resolvedSizesCache.get(renderable);


        if (size && (size[0] === true || size[1] === true)) {
            return renderable.getSize();
        }
        if (!size && renderable.decorations) {
            let decoratedSize = renderable.decorations.size;
            let isValidSize = (inputSize) => typeof inputSize == 'number' && inputSize > 0;
            if (decoratedSize && isValidSize(decoratedSize[0]) && isValidSize(decoratedSize[1])) {
                size = decoratedSize;
            }
        }

        return size;
    }

    containsUncalculatedSurfaces() {
        for (let [surface, {isUncalculated}] of this._trueSizedSurfaceInfo) {
            if (isUncalculated) {
                return true;
            }
        }
        return false;
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
            this._warn(`The second argument of addRenderable(...) was not a string. Please pass the renderable name in ${this._name()}`);
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
            this._warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': no docked renderables present.`);
            return false;
        }
        let result = this._prioritiseDockAtIndex(renderableName, docked.indexOf(nextRenderableName));
        if (!result) {
            this._warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': could not find one of the renderables by name.
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
            this._warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': no docked renderables present.`);
            return false;
        }
        let result = this._prioritiseDockAtIndex(renderableName, docked.indexOf(prevRenderableName) + 1);
        if (!result) {
            this._warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': could not find one of the renderables by name.
                        The following docked renderables are present: ${docked.keys()}`);
        }
        return result;
    }

    showRenderable(renderableName, show = true) {
        let renderable = this[renderableName];
        if (!renderable.animationController) {
            this._warn(`Trying to show renderable ${renderableName} which does not have an animationcontroller. Please use @layout.animate`);
            return;
        }
        this._showWithAnimationController(this.renderables[renderableName], renderable, show);
        let decoratedSize = this[renderableName].decorations.size || (this[renderableName].decorations.dock ? this[renderableName].decorations.dock.size : undefined);
        if (decoratedSize) {
            /* Check if animationController has a true size specified. If so a reflow needs to be performed since there is a
             * new size to take into account. */
            for (let dimension of [0, 1]) {
                if (this._isValueTrueSized(this._resolveSingleSize(decoratedSize[dimension], [NaN, NaN], dimension))) {
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
            this._warn('No decorators specified to decorateRenderable(renderableName, ...decorators)');
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
        if (this._renderableIsSurface(renderable)) {
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
                    let trueSizedInfo = this._trueSizedSurfaceInfo.get(renderable);
                    if (this._isValueTrueSized(sizeToCheck[dimension])) {
                        if (!trueSizedInfo) {
                            trueSizedInfo = this._configureTrueSizedSurface(renderable);
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
        if(shouldDisableDock){
            delete renderable.decorations.dock;
        }
        if(shouldDisableFullSize){
            delete renderable.decorations.fullSize;
        }
        /* Extend the object */
        Object.assign(renderable.decorations, fakeRenderable.decorations);
        /* See if we have to redo the grouping */
        let needToChangeDecoratorGroup = (oldRenderableGroupName !== this._getGroupName(renderable)) || shouldDisableDock || shouldDisableFullSize;
        /* Process new renderable equivalent, if that applies */
        this.renderables[renderableName] = this._processRenderableEquivalent(renderable, renderableName);
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
    _registerNewFlowState(renderableName){
        let currentFlow = {};
        let runningFlowStates = this._runningFlowStates[renderableName];
        if(!runningFlowStates){
            this._runningFlowStates[renderableName] = runningFlowStates = [];
        }
        let flowWasInterrupted = false;
        runningFlowStates.push(currentFlow);

        runningFlowStates.forEach((flowState) => {
            flowState.shouldInterrupt = (flowState !== currentFlow);
        });
        return currentFlow;
    }

    _removeFinishedFlowState(renderableName, flowState){
        let runningFlowStates = this._runningFlowStates[renderableName];
        runningFlowStates.splice(runningFlowStates.indexOf(flowState), 1);
    }

    async setRenderableFlowState(renderableName = '', stateName = ''){

        let renderable = this[renderableName];
        if(!renderable || !renderable.decorations || !renderable.decorations.flow) {
            return this._warn(`setRenderableFlowState called on non-existing or renderable '${renderableName}' without flowstate`);
        }
        let flowOptions = renderable.decorations.flow;


        /* Keep track of which flow state changes are running. We only allow one at a time per renderable.
         * The latest one is always the valid one.
         */
        let currentFlow = this._registerNewFlowState(renderableName);
        let flowWasInterrupted = false;

        flowOptions.currentState = stateName;
        for(let {transformations, options} of flowOptions.states[stateName].steps){
            flowOptions.currentTransition = options.transition || flowOptions.defaults.curve || {curve: Easing.outCubic, duration: 300};
            
            this.decorateRenderable(renderableName, ...transformations);

            let renderableOn = renderable.on.bind(renderable);
            await Promise.race([callbackToPromise(renderableOn, 'flowEnd'),callbackToPromise(renderableOn, 'flowInterrupted').then(() => console.log("INterrupted"))]);

            /* Optionally, we insert a delay in between ending the previous state change, and starting on the new one. */
            if(options.delay) { await waitMilliseconds(options.delay); }

            /* If the flow has been interrupted */
            if(currentFlow.shouldInterrupt){
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

        for(let step of steps) {
            let waitQueue = [];
            for(let renderableName in step) {
                let state = step[renderableName];
                waitQueue.push(this.setRenderableFlowState(renderableName, state));
            }
            await Promise.all(waitQueue);

            /* If another state has been set since the invocation of this method, skip any remaining transformations. */
            if(flowOptions.currentState !== stateName) { break; }
        }

        return true;
    }

    _showWithAnimationController(animationController, renderable, show = true) {
        animationController._showingRenderable = show;
        let callback = () => { if (renderable.emit) { renderable.emit(show ? 'shown' : 'hidden'); } };

        if(show){
            animationController.show(renderable.containerSurface || renderable, null, callback);
        } else {
            animationController.hide(null, callback);
        }
    }

    hideRenderable(renderableName) {
        this.showRenderable(renderableName, false);
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
            this._warn(`Invalid option '${decoratorOptions}' given to item ${renderableName}`);
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

    replaceRenderable(renderableName, newRenderable) {
        let renderable = this[renderableName];
        let renderableHasAnimationController = (this.renderables[renderableName] instanceof AnimationController);
        /* If there isn't a renderable equivalent animationController that does the piping, then we need to redo the event piping */
        if (!renderableHasAnimationController) {
            this._setupAllRenderableListeners(renderableName, false);
        }
        newRenderable.decorations = {...newRenderable.decorations, ...renderable.decorations};
        let newRenderableEquivalent = this._processRenderableEquivalent(newRenderable, renderableName);
        this._groupedRenderables[this._getGroupName(renderable)].set(renderableName, newRenderable);
        if (!renderableHasAnimationController) {
            this.renderables[renderableName] = newRenderableEquivalent;
            this._setupAllRenderableListeners(renderableName, true);
        }
        this.reflowRecursively();
        this[renderableName] = newRenderable;
    }


    /**
     * Resolves a decorated renderable's size (both width and height)
     * @name {String} name The name of the renderable such that this[name] = renderable
     * @param renderableName
     * @param {Object} context Famous-flex context in which the renderable is rendered.
     * @param specifiedSize
     * @returns {Array|Object} Array of [x, y] sizes, or null if resolving is not possible.
     * @private
     */
    _resolveDecoratedSize(renderableName, context, specifiedSize = this[renderableName].decorations.size || [undefined, undefined]) {
        let renderable = this[renderableName];

        let size = [];
        let cacheResolvedSize = [];
        for (let dimension = 0; dimension < 2; dimension++) {
            size[dimension] = this._resolveSingleSize(specifiedSize[dimension], context.size, dimension);
            if (this._isValueTrueSized(size[dimension])) {
                cacheResolvedSize[dimension] = this._resolveSingleTrueSizedRenderable(renderable, renderableName, size, dimension);
                if (this._renderableIsSurface(renderable)) {
                    size[dimension] = true;
                } else {
                    size[dimension] = cacheResolvedSize[dimension];
                }
            } else {
                size[dimension] = size[dimension] === undefined ? (context.size[dimension] || size[dimension]) : size[dimension];
                cacheResolvedSize[dimension] = size[dimension];
            }
        }

        this._resolvedSizesCache.set(renderable, [cacheResolvedSize[0], cacheResolvedSize[1]]);

        return (size[0] !== null && size[1] !== null) ? size : null;
    }

    _isValueTrueSized(value) {
        return value < 0 || value === true
    }


    /**
     * Processes a dimension of a truesized renderable. size[dim] must be negative.
     * @param renderable the renderable
     * @param name the index so that this.renderables[name] = renderable
     * @param size the size array. The function will modify size[dim]
     * @param dim the dimensions e.g. 0,1 that should be processed
     * @returns {Number} size[dim] will be returned with a non-truesized value
     * @private
     */
    _resolveSingleTrueSizedRenderable(renderable, name, size, dim) {
        if (size[dim] === -1) {
            this._warn('-1 detected as set size. If you want a true sized element to take ' +
                'up a proportion of your view, please define a function doing so by ' +
                'using the context size');
        }
        let renderableCounterpart = this.renderables[name];
        /* If there is an AnimationController without content, display 0 size */
        if (renderableCounterpart instanceof AnimationController && !renderableCounterpart._showingRenderable) {
            return 0;
        }
        /* True sized element. This has been specified as ~100 where 100 is the initial size
         * applying this operator again (e.g. ~~100) gives us the value 100 back
         * */
        if (this._renderableIsComposite(renderable)) {
            let twoDimensionalSize = renderable.getSize();
            if (!twoDimensionalSize) {
                return this._specifyUndeterminedSingleHeight(renderable, size, dim);
            } else {
                let renderableIsView = renderable instanceof View;
                if (size[dim] === true && twoDimensionalSize[dim] === undefined &&
                    ((renderableIsView && (renderable._initialised && !renderable.containsUncalculatedSurfaces())) || !renderableIsView)) {
                    this._warn(`True sized renderable '${name}' is taking up the entire context size. Caused in ${this._name()}`);
                    return twoDimensionalSize[dim];
                } else {
                    let approximatedSize = size[dim] === true ? twoDimensionalSize[dim] : ~size[dim];
                    let resultingSize = twoDimensionalSize[dim] !== undefined ? twoDimensionalSize[dim] : approximatedSize;
                    if (renderableIsView) {
                        resultingSize = (!renderable.containsUncalculatedSurfaces() && renderable._initialised) ? resultingSize : approximatedSize;
                    }
                    return resultingSize;
                }
            }
        } else if (this._renderableIsSurface(renderable)) {
            let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable) || {};
            if (trueSizedSurfaceInfo.calculateOnNext) {
                trueSizedSurfaceInfo.calculateOnNext = false;
                this._tryCalculateTrueSizedSurface(renderable);
            }
            let {isUncalculated} = trueSizedSurfaceInfo;
            if (isUncalculated === false) {
                return trueSizedSurfaceInfo.size[dim];
            } else {
                if (size[dim] === true) {
                    let defaultSize = 5;
                    this._warn(`No initial size set for surface, will default to ${defaultSize}px`);
                    size[dim] = ~5;
                }
                if (isUncalculated !== true) {
                    /* Seems like the surface isn't properly configured, let's get that going */
                    trueSizedSurfaceInfo = this._configureTrueSizedSurface(renderable, name);
                }
                trueSizedSurfaceInfo.trueSizedDimensions[dim] = true;
                renderable.size[dim] = true;
                /* Need to set the size in order to get resize notifications */
                return ~size[dim];
            }
        } else {
            return this._specifyUndeterminedSingleHeight(renderable, size, dim);
        }
    }


    /**
     * Resolves a single dimension (i.e. x or y) size of a renderable.
     * @param {Number|Boolean|Object|Undefined|Function} renderableSize Renderable's single dimension size.
     * @param {Array.Number} contextSize The context size
     * @param {Number} dimension The dimension of the size that is being evaluated (e.g. 1 or 0)
     * @returns {Number} The resulting size
     * @private
     */
    _resolveSingleSize(renderableSize, contextSize, dimension) {
        switch (typeof renderableSize) {
            case 'function':
                return this._resolveSingleSize(renderableSize.call(this, ...contextSize), contextSize, dimension);
            case 'number':
                /* If 0 < renderableSize < 1, we interpret renderableSize as a fraction of the contextSize */
                return renderableSize < 1 && renderableSize > 0 ? renderableSize * Math.max(contextSize[dimension], 0) : renderableSize;
            default:
                /* renderableSize can be true/false, undefined, or 'auto' for example. */
                return renderableSize;
        }
    }

    _specifyUndeterminedSingleHeight(renderable, size, dim) {
        let resultingSize = size[dim] < 0 ? ~size[dim] : 5;
        this._warn(`Cannot determine size of ${renderable.constructor.name}, falling back to default size or ${resultingSize}px. Called from ${this._name()}`);
        return resultingSize;
    }

    /**
     * Returns true if the renderable is complex and its size can be determined. Returns false if it is a surface
     * or something else that doesn't have a getSize function specified
     * @param renderable
     * @private
     */
    _renderableIsComposite(renderable) {
        return renderable.getSize && !(this._renderableIsSurface(renderable));
    }

    _renderableIsSurface(renderable) {
        return renderable instanceof Surface || renderable instanceof ImageSurface;
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
        /* Need to set the size in order to get resize notifications */
        renderable.size = [undefined, undefined];

        renderable.on('resize', () => {
            this._tryCalculateTrueSizedSurface(renderable);
        });
        renderable.on('deploy', () => {
            if (!this._trueSizedSurfaceInfo.get(renderable).isUncalculated) {
                this._tryCalculateTrueSizedSurface(renderable);
            }
        });

        return trueSizedSurfaceInfo;
    }


    _layoutDecoratedRenderables(context, options) {
        this._layoutDockedRenderables(this._groupedRenderables['docked'], this._groupedRenderables['filled'], context, options);
        this._layoutFullScreenRenderables(this._groupedRenderables['fullSize'], context, options);
        this._layoutTraditionalRenderables(this._groupedRenderables['traditional'], context, options);
    }

    _layoutFullScreenRenderables(fullScreenRenderables, context) {
        let names = fullScreenRenderables ? fullScreenRenderables.keys() : [];
        for (let name of names) {
            let renderable = fullScreenRenderables.get(name);
            let defaultCurve = {transition: Easing.outCubic, duration: 300};
            let renderableCurve = renderable.decorations && renderable.decorations.flow && renderable.decorations.flow.currentTransition;
            let translate = this._addTranslations(this.decorations.extraTranslate, renderable.decorations.translate || [0, 0, 0]);
            context.set(name, {translate, size: context.size, transition: renderableCurve || defaultCurve,
                opacity: renderable.decorations.opacity === undefined ? 1 : renderable.decorations.opacity});
        }
    }

    _layoutTraditionalRenderables(traditionalRenderables, context) {
        let names = traditionalRenderables ? traditionalRenderables.keys() : [];
        for (let renderableName of names) {
            let renderable = traditionalRenderables.get(renderableName);
            let renderableSize = this._resolveDecoratedSize(renderableName, context) || [undefined, undefined];
            let {translate = [0, 0, 0], origin = [0, 0], align = [0, 0], rotate = [0, 0, 0],
                opacity = 1, transition = {transition: Easing.outCubic, duration: 300}, scale = [1,1,1], skew = [0,0,0]} = renderable.decorations;
            translate = this._addTranslations(this.decorations.extraTranslate, translate);
            let adjustedTranslation = this._adjustPlacementForTrueSize(renderable, renderableSize, origin, translate);
            let renderableTransition = renderable.decorations && renderable.decorations.flow && renderable.decorations.flow.currentTransition;
            context.set(renderableName, {
                size: renderableSize,
                translate: adjustedTranslation,
                transition: renderableTransition || transition,
                origin,
                scale,
                skew,
                align,
                rotate,
                opacity
            });
        }
    }


    _layoutDockedRenderables(dockedRenderables, filledRenderables, context, options) {
        let dockHelper = new TrueSizedLayoutDockHelper(context, options);

        if (this.decorations.viewMargins) {
            dockHelper.margins(this.decorations.viewMargins);
        }

        /* Process Renderables with a non-fill dock */
        let dockedNames = dockedRenderables ? dockedRenderables.keys() : [];
        for (let renderableName of dockedNames) {
            let renderable = dockedRenderables.get(renderableName);
            let {dockSize, translate, innerSize, space} = this._prepareForDockedRenderable(renderable, renderableName, context);
            let {dock, rotate, opacity} = renderable.decorations;
            let {dockMethod} = dock;
            if (dockHelper[dockMethod]) {
                dockHelper[dockMethod](renderableName, dockSize, space, translate, innerSize, {rotate, opacity});
            } else {
                this._warn(`Arva: ${this._name()}.${renderableName} contains an unknown @dock method '${dockMethod}', and was ignored.`);
            }
        }

        /* Process Renderables with a fill dock (this needs to be done after non-fill docks, since order matters in LayoutDockHelper) */
        let filledNames = filledRenderables ? filledRenderables.keys() : [];
        for (let renderableName of filledNames) {
            let renderable = filledRenderables.get(renderableName);
            let {decorations} = renderable;
            let {rotate, opacity} = decorations;
            let {translate, dockSize} = this._prepareForDockedRenderable(renderable, renderableName, context);
            /* Special case for undefined size, since it's treated differently by the dockhelper, and should be kept to undefined if specified */
            let dimensionHasUndefinedSize = (dimension) => ![decorations.dock.size, decorations.size].every((size) => size && size[dimension] !== undefined);
            dockSize = dockSize.map((fallbackSize, dimension) => dimensionHasUndefinedSize(dimension) ? undefined : fallbackSize);
            dockHelper.fill(renderableName, dockSize, translate, {rotate, opacity});
        }
    }

    /**
     * Computes translation, inner size, actual docking size (outer size) and an adjusted docking size for a renderable that is about to be docked
     * @param renderable
     * @param {String} renderableName
     * @param context
     * @returns {{dockSize: (Array|Object), translate, innerSize: (Array|Number), inUseDockSize: (Array|Number}}
     * @private
     */
    _prepareForDockedRenderable(renderable, renderableName, context) {
        let {decorations} = renderable;
        let {translate = [0, 0, 0]} = decorations;
        translate = this._addTranslations(this.decorations.extraTranslate, translate);
        let {dockMethod, space} = decorations.dock;
        let {viewMargins = [0, 0, 0, 0]} = this.decorations;
        let horizontalMargins = viewMargins[1] + viewMargins[3];
        let verticalMargins = viewMargins[0] + viewMargins[2];
        let sizeWithoutMargins = [context.size[0] - horizontalMargins, context.size[1] - verticalMargins];
        let dockSizeSpecified = !(_.isEqual(decorations.dock.size, [undefined, undefined]));
        let dockSize = this._resolveDecoratedSize(renderableName, {size: sizeWithoutMargins}, dockSizeSpecified ? decorations.dock.size : undefined);
        let inUseDockSize = this._resolvedSizesCache.get(renderable);
        let innerSize;
        let {origin, align} = decorations;
        if (decorations.size || origin || align) {
            /* If origin and align is used, we have to add this to the translate of the renderable */
            this._resolveDecoratedSize(renderableName, {size: sizeWithoutMargins});
            innerSize = this._resolvedSizesCache.get(renderable);
            if (innerSize) {
                let translateWithProportion = (proportion, size, translation, dimension, factor) =>
                    translation[dimension] += size[dimension] ? factor * size[dimension] * proportion[dimension] : 0;
                translate = [...translate]; //shallow copy the translation to prevent the translation for happening multiple times

                /* If no docksize was specified in a certain direction, then use the context size without margins */
                let outerDockSize = dockSize;


                if (!dockSizeSpecified) {
                    if (dockMethod === 'fill') {
                        outerDockSize = [...sizeWithoutMargins];
                    } else {
                        let dockingDirection = this._getDockType(dockMethod);
                        outerDockSize[dockingDirection] = innerSize[dockingDirection];
                        outerDockSize[+!dockingDirection] = sizeWithoutMargins[+!dockingDirection];
                    }

                }

                if (origin) {
                    translateWithProportion(origin, innerSize, translate, 0, -1);
                    translateWithProportion(origin, innerSize, translate, 1, -1);
                }
                if (align) {

                    translateWithProportion(align, outerDockSize, translate, 0, 1);
                    translateWithProportion(align, outerDockSize, translate, 1, 1);
                }
            }
        }
        for (let i = 0; i < 2; i++) {
            if (dockSize[i] == true) {
                /* If a true size is used, do a tilde on it in order for the dockhelper to recognize it as true-sized */
                dockSize[i] = ~inUseDockSize[i];
            }
        }
        /* If the renderable is unrenderable due to zero height/width...*/
        if (inUseDockSize[0] === 0 || inUseDockSize[1] === 0) {
            /* Don't display the space if the size is 0*/
            space = 0;
        }
        return {dockSize, translate, innerSize, inUseDockSize, space};

    }

    /**
     * Specifying origin for true sized renderables doesn't work. Therefore we do a quick fix to adjust the
     * translation according to the current faulty behaviour of famous.
     * @param renderable The renderable of which we should correct
     * @param size  The size of this renderable
     * @param origin The origin
     * @param translate The current translation
     * @returns {*[]} The new translation taking this the current famous implementation into account
     * @private
     */
    _adjustPlacementForTrueSize(renderable, size, origin, translate) {
        let newTranslation = [translate[0], translate[1], translate[2]];
        for (let i = 0; i < 2; i++) {
            if (size[i] === true && origin[i] !== 0) {
                /* Because the size is set to true, it is interpreted as 1 by famous. We have to add 1 pixel
                 *  to make up for this.
                 */
                newTranslation[i] -= (this._resolvedSizesCache.get(renderable)[i] * origin[i] - 1);
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
            flow: !!this.decorations.useFlow || this._usesPartialFlow,
            partialFlow: this._usesPartialFlow,
            flowOptions: this.decorations.flowOptions || {},
            layout: function (context, options) {

                /* Because views that extend this View class first call super() and then define their renderables,
                 * we wait until the first engine render tick to add our renderables to the layout, when the view will have declared them all.
                 * layout.setDataSource() will automatically pipe events from the renderables to this View. */
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
                    if (this.decorations.customLayoutFunction) {
                        this.decorations.customLayoutFunction(context);
                    }
                }

                if (this._hasTrueSizedSurfaces()) {
                    this._doTrueSizedSurfacesBookkeeping();
                }

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
                        this._warn(`Unrecognized layout specification in view '${this._name()}'.`);
                        break;
                }
            } catch (error) {
                this._warn(`Exception thrown in ${this._name()}:`);
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
            totalSize = this._calculateDockedRenderablesBoundingBox();

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
                        renderableSpec.translate = this._adjustPlacementForTrueSize(renderable, size, renderableSpec.origin || [0, 0]
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

    _getDockType(dockMethodToGet) {
        let dockTypes = [['right', 'left'], ['top', 'bottom']];
        return _.findIndex(dockTypes, (dockMethods) => ~dockMethods.indexOf(dockMethodToGet));
    }

    _calculateDockedRenderablesBoundingBox() {
        let {docked: dockedRenderables, filled: filledRenderables} = this._groupedRenderables;
        let {dockMethod} = dockedRenderables.get(dockedRenderables.keyAt(0)).decorations.dock;
        /* Gets the dock type where, 0 is right or left (horizontal) and 1 is top or bottom (vertical) */
        let dockType = this._getDockType(dockMethod);
        let dockingDirection = dockType;
        let orthogonalDirection = !dockType + 0;


        /* Previously countered dock size for docking direction and opposite docking direction */
        let previousDockSize = 0;
        /* Add up the different sizes to if they are docked all in the same direction */
        let dockSize = dockedRenderables.reduce((result, dockedRenderable, name) => {
            let {decorations} = dockedRenderable;
            let {dockMethod: otherDockMethod} = decorations.dock;
            /* If docking is done orthogonally */
            if (this._getDockType(otherDockMethod) !== dockType) {
                return [NaN, NaN];
            } else {
                /* Resolve both inner size and outer size */
                this._resolveDecoratedSize(name, {size: [NaN, NaN]}, dockedRenderable.decorations.dock.size);
                let resolvedOuterSize = this._resolvedSizesCache.get(dockedRenderable);

                let resolvedInnerSize = [undefined, undefined];
                if (dockedRenderable.decorations.size) {
                    this._resolveDecoratedSize(name, {size: [NaN, NaN]});
                    resolvedInnerSize = this._resolvedSizesCache.get(dockedRenderable);
                }

                if (!resolvedOuterSize || !resolvedInnerSize) {
                    return [NaN, NaN];
                }
                let resolvedSize = [resolvedOuterSize[0] === undefined ? resolvedInnerSize[0] : resolvedOuterSize[0],
                    resolvedOuterSize[1] === undefined ? resolvedInnerSize[1] : resolvedOuterSize[1]];
                let newResult = new Array(2);
                /* If docking is done from opposite directions */
                let dockingFromOpposite = dockMethod !== otherDockMethod;
                if (dockingFromOpposite) {
                    newResult[dockingDirection] = NaN;
                } else {
                    /* If this or the previous renderable size is 0, don't add the space */
                    let spaceSize = (resolvedSize[dockingDirection] === 0 || previousDockSize === 0) ? 0 : decorations.dock.space;
                    newResult[dockingDirection] = resolvedSize[dockingDirection] + spaceSize + result[dockingDirection];
                    previousDockSize = resolvedSize[dockingDirection];
                }
                /* If a size in the orthogonalDirection has been set... */
                if (resolvedSize[orthogonalDirection] !== undefined && !Number.isNaN(resolvedSize[orthogonalDirection])) {
                    /* If there is no result in the orthogonal direction specified yet... */
                    if (result[orthogonalDirection] === undefined) {
                        newResult[orthogonalDirection] = resolvedSize[orthogonalDirection];
                    } else {
                        /* get the max bounding box for the specified orthogonal direction */
                        newResult[orthogonalDirection] = Math.max(result[orthogonalDirection], resolvedSize[orthogonalDirection]);
                    }
                } else {
                    newResult[orthogonalDirection] = result[orthogonalDirection];
                }
                return newResult;
            }
        }, dockingDirection ? [undefined, 0] : [0, undefined]);

        if (filledRenderables) {
            dockSize[dockingDirection] = undefined;
            /* We currently support multiple fills, but that might change in the future */
            let orthogonalSizes = filledRenderables.reduce((result, filledRenderable, renderableName) => {
                this._resolveDecoratedSize(renderableName, {size: [NaN, NaN]});
                let resolvedSize = this._resolvedSizesCache.get(filledRenderable);
                if (resolvedSize) {
                    let orthogonalSize = resolvedSize[orthogonalDirection];
                    if (orthogonalSize || orthogonalSize == 0) {
                        return result.concat(orthogonalSize);
                    }
                }
            }, []);

            if (orthogonalSizes) {
                let originalOrthogonalSize = dockSize[orthogonalDirection];
                if (originalOrthogonalSize || originalOrthogonalSize === 0) {
                    orthogonalSizes.push(originalOrthogonalSize)
                }
                dockSize[orthogonalDirection] = Math.max(...orthogonalSizes);
            }
        }

        for (let i = 0; i < 2; i++) {
            if (Number.isNaN(dockSize[i])) {
                dockSize[i] = undefined;
            }
            if (dockSize[i] !== undefined && this.decorations.viewMargins) {
                let {viewMargins} = this.decorations;
                /* if i==0 we want margin left and right, if i==1 we want margin top and bottom */
                dockSize[i] += viewMargins[(i + 1) % 4] + viewMargins[(i + 3) % 4];
            }
        }
        return dockSize;
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

    _addTranslations(translate1, translate2) {
        return [translate1[0] + translate2[0], translate1[1] + translate2[1], translate1[2] + translate2[2]];
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
                this._warn(`Attempted to delay showing renderable ${this._name()}.${animation.waitFor}, which does not exist or contain an on() method.`);
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
        this.layout.on('layoutstart', ({oldSize, size}) => {
            if (size[0] !== oldSize[0] ||
                size[1] !== oldSize[1]) {
                for (let [surface] of this._trueSizedSurfaceInfo) {
                    /* Encourage the surfaces to check if they have been resized, which could trigger the resize event */
                    surface._trueSizeCheck = true;
                }
                this._eventOutput.emit('newSize', size);
            }
        });

        this._resolvedSizesCache = new Map();
        this._trueSizedSurfaceInfo = new Map();
        /* Hack to make the layoutcontroller reevaluate sizes on resize of the parent */
        this._nodes = {_trueSizedRequested: false};
        /* This needs to be set in order for the LayoutNodeManager to be happy */
        this.options.size = this.options.size || [true, true];
    }


    _initOptions(options) {
        if (!this._isPlainObject(options)) {
            this._warn(`View ${this._name()} initialized with invalid non-object arguments`);
        }
        this.options = options;
    }

    _tryCalculateTrueSizedSurface(renderable) {
        let renderableHtmlElement = renderable._element;
        let trueSizedInfo = this._trueSizedSurfaceInfo.get(renderable);
        let {trueSizedDimensions} = trueSizedInfo;

        if (renderableHtmlElement && ((renderableHtmlElement.offsetWidth && renderableHtmlElement.offsetHeight) || (!renderable.getContent() && !(renderable instanceof ImageSurface))) && renderableHtmlElement.innerHTML === renderable.getContent() &&
            (!renderableHtmlElement.style.width || !trueSizedDimensions[0]) && (!renderableHtmlElement.style.height || !trueSizedDimensions[1])) {
            let newSize;


            newSize = [renderableHtmlElement.offsetWidth, renderableHtmlElement.offsetHeight];

            let oldSize = trueSizedInfo.size;
            let sizeChange = false;
            if (oldSize) {
                for (let i = 0; i < 2; i++) {
                    if (trueSizedDimensions[i] && oldSize[i] !== newSize[i]) {
                        sizeChange = true;
                    }
                }
            } else {
                sizeChange = true;
            }

            if (sizeChange) {
                trueSizedInfo.size = newSize;
                trueSizedInfo.isUncalculated = false;
            }
            this.reflowRecursively();
        } else {
            this.layout.reflowLayout();
            this._requestLayoutControllerReflow();
        }
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
        if(renderable.decorations.flow){
            if(!this.decorations.useFlow){
                this._usesPartialFlow = true;
            }
            renderable.isFlowy = true;
        }
        this._addRenderableToDecoratorGroup(renderable, renderableName);
        return this._processRenderableEquivalent(renderable, renderableName);
    }

    _processRenderableEquivalent(renderable, renderableName) {
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

        if(renderable.node){
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
            this._groupedRenderables[groupName].set(renderableName, renderable);
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
    _initSwipable(swipableOptions = {}, renderable = {}){
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
