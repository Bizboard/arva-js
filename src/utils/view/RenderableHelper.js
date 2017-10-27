/**
 * Created by lundfall on 02/09/16.
 */

import OrderedHashMap               from 'ordered-hashmap'
import merge                        from 'lodash/merge.js'
import Modifier                     from 'famous/core/Modifier.js'
import Transform                    from 'famous/core/Transform.js'
import RenderNode                   from 'famous/core/RenderNode.js'
import Timer                        from 'famous/utilities/Timer.js'
import MouseSync                    from 'famous/inputs/MouseSync.js'
import TouchSync                    from 'famous/inputs/TouchSync.js'
import GenericSync                  from 'famous/inputs/GenericSync.js'
import Easing                       from 'famous/transitions/Easing.js'
import Draggable                    from 'famous/modifiers/Draggable.js'
import AnimationController          from 'famous-flex/AnimationController.js'
import ContainerSurface             from 'famous/surfaces/ContainerSurface.js'
import Transitionable               from 'famous/transitions/Transitionable.js'

import {Throttler}                  from 'arva-js/utils/Throttler.js'

import {Utils}                      from './Utils.js'
import {limit}                      from '../Limiter.js'
import {
    callbackToPromise,
    waitMilliseconds
}                                   from '../CallbackHelpers.js'

export class RenderableHelper {

    /**
     * Creates a utility for maintaining proper state of decorated renderables
     * @param {Function} bindMethod
     * @param {Function} pipeMethod
     * @param {Function} getIDfromLocalNameMethod
     * @param {Object|Renderable} outputRenderables
     * @param sizeResolver
     */
    constructor(bindMethod, pipeMethod, getIDfromLocalNameMethod, outputRenderables, sizeResolver) {
        this._bindMethod = bindMethod;
        this._renderableCounterparts = outputRenderables;
        this._sizeResolver = sizeResolver;
        this._pipeToView = pipeMethod;
        this._getIDfromLocalName = getIDfromLocalNameMethod;
        this.waitingAnimations = [];
        this._renderables = {};
        this._groupedRenderables = {};
        this._pipedRenderables = {};
        this._groupedRenderables = {};
    }

    assignRenderable(renderable, renderableName) {
        this._renderables[renderableName] = renderable;
        let renderableEquivalent = renderable;
        if (renderable.decorations) {
            renderableEquivalent = this._addDecoratedRenderable(renderable, renderableName);
        }
        this._renderableCounterparts[renderableName] = renderableEquivalent;
        this._setupAllRenderableListeners(renderableName);
    }

    getRenderableNames() {
        return Object.keys(this._renderables)
    }

    /**
     * Setups all renderable listeners (decoration events, decoration pipes, pipe to the view)
     * @param {String} renderableName the name of the renderable
     * @param {Boolean} enabled set to false to unset all the events
     * @private
     */
    _setupAllRenderableListeners(renderableName, enabled = true) {
        /* If the this._renderableCounterparts equivalent doesn't have the pipe function as is the case with the draggable, then use the regular renderable */
        let renderableOrEquivalent = this._getPipeableRenderableFromName(renderableName)
        if (enabled) {
            this._pipeRenderable(renderableOrEquivalent, renderableName)
        } else {
            this._unpipeRenderable(renderableOrEquivalent, renderableName)
        }
        let { decorations } = this._renderables[renderableName]
        if (decorations) {
            this._setDecorationPipes(renderableOrEquivalent, decorations.pipes, enabled);
            this._setDecorationEvents(renderableOrEquivalent, decorations.eventSubscriptions, enabled);
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
            let { options } = subscription;
            if (!enable) {
                /* In famous, you remove a listener by calling 'removeListener', but some classes might have another event
                 * listener that is called 'off'
                 */
                subscriptionType = renderable.removeListener ? 'removeListener' : 'off';
            }
            let eventName = subscription.eventName;
            let callback = subscription.callback;
            if (subscriptionType in renderable) {
                renderable[subscriptionType](eventName, this._bindMethod(callback), options)
            }
        }
    }

    /**
     * Pipes the renderable to a list of other renderables
     * @param {Renderable} renderable
     * @param {Array|String} Names of renderables that have to be piped.
     * @param {Boolean} enabled. Set to false to unpipe
     * @private
     */
    _setDecorationPipes(renderable, pipes, enabled = true) {
        for (let pipeToName of pipes || []) {
            let target = this._renderables[this._getIDfromLocalName(pipeToName)];
            if(!target){
                Utils.warn(`Cannot pipe to unknown renderable: ${pipeToName}`);
            }
            let pipeFn = (enabled ? '' : 'un') + 'pipe';
            /* In order to keep things consistent and easier to use, we pipe from the renderable equivalent */
            if (renderable[pipeFn]) {
                renderable[pipeFn](target)
            }
            if (renderable[pipeFn] && target._eventOutput) {
                renderable[pipeFn](target._eventOutput)
            }
        }

    }

    /**
     * Unpipes a renderables that has been piped to this view
     * @param {String} renderableName The name of the renderable
     * @private
     */
    _unpipeRenderable(renderableName) {
        if (this._pipeToView(this._pipedRenderables[renderableName], false)) {
            delete this._pipedRenderables[renderableName]
        }
    }

    /**
     * Pipes a renderable to this view
     * @param {Renderable} renderable. The renderable that is going to be piped
     * @param {String} renderableName. The name of the renderable that is going to be piped.
     * @private
     */
    _pipeRenderable(renderable, renderableName) {
        /* Auto pipe events from the renderable to the view */
        if (this._pipeToView(renderable, true)) {
            this._pipedRenderables[renderableName] = renderable
        }
    }

    /**
     * Determines whether the renderable counterpart (i.e. animationcontroller or containersurface) should be used
     * when piping, or the renderable itself
     * @param {String} renderableName The name of the renderable
     * @returns {Renderable} the renderable or its counterpart
     * @private
     */
    _getPipeableRenderableFromName(renderableName) {
        return this._renderableCounterparts[renderableName].pipe ? this._renderableCounterparts[renderableName] : this._renderables[renderableName]
    }

    /**
     * Adds a decorated renderable to the bookkeeping of the view
     * @param renderable
     * @param renderableName
     * @returns {Renderable} newRenderable The renderable that is normally stored this._renderableCounterpart[renderableName]
     * @private
     */
    _addDecoratedRenderable(renderable, renderableName) {
        let { flow, size, dock } = renderable.decorations

        if (size) {
            this._bindSizeFunctions(size)
        }
        if (dock && dock.size) {
            this._bindSizeFunctions(dock.size)
        }
        let renderableCounterpart = this._processsDecoratedRenderableCounterpart(renderable, renderableName)

        this._addRenderableToDecoratorGroup(renderable, renderableCounterpart, renderableName)
        return renderableCounterpart
    }

    /**
     * Bind the size functions so that they don't have to be bound afterwards
     * @param {Array|Number} size
     * @private
     */
    _bindSizeFunctions(size) {
        for (let index = 0; index < 2; index++) {
            if (typeof size[index] === 'function') {
                size[index] = this._bindMethod(size[index])
            }
        }
    }

    /**
     * Returns true if there are any flowy renderables.
     * @returns {Boolean} hasFlowyRenderables
     */
    hasFlowyRenderables() {
        for (let groupName in this._groupedRenderables) {
            let renderableGroup = this._groupedRenderables[groupName]
            if (!renderableGroup.keys().every((renderableName) => !renderableGroup.get(renderableName)[0].decorations.flow)) {
                return true
            }
        }
        return false
    }

    /**
     * Processes the renderable counter-part of the renderable. The counterpart is different from the renderable
     * in @layout.draggable, @layout.swipable, @layout.animate, and others.
     * @param {Renderable} renderable the renderable which has renderable.decorations set to determine the counter part
     * @param {String} renderableName the name of the renderable
     * @returns {AnimationController|ContainerSurface|RenderNode|*} The renderable counterpart
     * @private
     */
    _processsDecoratedRenderableCounterpart(renderable, renderableName) {
        let { draggableOptions, swipableOptions, clip, animation, flow, modifier } = renderable.decorations

        /* If we clip, then we need to create a containerSurface */
        if (clip) {
            let clipSize = clip.size
            /* Resolve clipSize specified as undefined */
            let containerSurface = new ContainerSurface({
                size: clipSize,
                properties: { overflow: 'hidden', ...clip.properties }
            })
            containerSurface.add(renderable)
            if (renderable.pipe) {
                renderable.pipe(containerSurface._eventOutput)
            }
            renderable.containerSurface = containerSurface
        }

        if (animation) {
            this._processAnimatedRenderable(renderable, renderableName, animation)
        }

        if (swipableOptions) {
            renderable = this._initSwipable(swipableOptions, renderable);
        } else if (draggableOptions && !renderable.node) {
            renderable.node = new RenderNode();
            let draggable = new Draggable(draggableOptions);
            renderable.draggable = draggable;
            renderable.node.add(draggable).add(renderable);
            renderable.pipe(draggable);
            //TODO: We don't do an unpiping of the draggable, which might be dangerous
            this._pipeToView(draggable);
        } else if (modifier) {
            renderable.node = new RenderNode();
            renderable.node.add(modifier).add(renderable);
        }

        if (renderable.node) {
            /* Assign output handler */
            renderable.node._eventOutput = renderable._eventOutput
        }

        let renderableCounterpart = renderable.animationController || renderable.containerSurface || renderable.node || renderable
        /* If a renderable has an AnimationController used to animate it, add that to this._renderableCounterparts.
         * If a renderable has an ContainerSurface used to clip it, add that to this._renderableCounterparts.
         * this._renderableCounterparts is used in the LayoutController in this.layout to render this view. */
        if (flow) {
            renderableCounterpart.isFlowy = true
        }
        return renderableCounterpart
    }

    /**
     * Pipes the output events of all items in the renderable counterparts that might have been forgotten due to legacy way of declaring
     * renderables
     * @returns {void}
     * @private
     */
    pipeAllRenderables() {
        for (let renderableName in this.renderables) {
            if (!this._pipedRenderables[renderableName]) {
                this._pipeRenderable(this._getPipeableRenderableFromName(renderableName), renderableName)
            }
        }
    }

    /**
     * Initialize all animation set by @layout.animate
     */
    initializeAnimations() {
        for (let animation of (this.waitingAnimations || [])) {
            let renderableToWaitFor = this._renderables[animation.waitFor]
            if (renderableToWaitFor && renderableToWaitFor.on) {
                renderableToWaitFor.on('shown', function subscription() {
                    animation.showMethod()
                    if ('off' in renderableToWaitFor) {
                        renderableToWaitFor.off('shown', subscription)
                    }
                    if ('removeListener' in renderableToWaitFor) {
                        renderableToWaitFor.removeListener('shown', subscription)
                    }
                })
            } else {
                Utils.warn(`Attempted to delay showing renderable ${animation.waitFor}, which does not exist or contain an on() method.`)
            }
        }
    }

    /**
     * Processes an animated renderable
     * @param renderable
     * @param renderableName
     * @param options
     * @private
     */
    _processAnimatedRenderable(renderable, renderableName, options) {

        let pipeRenderable = () => {
            if (renderable.pipe) renderable.pipe(renderable.animationController._eventOutput)
        }

        /* If there's already an animationcontroller present, just change the options */
        let renderableCounterpart = this._renderableCounterparts[renderableName]
        if (renderableCounterpart instanceof AnimationController) {
            renderable.animationController = renderableCounterpart
            renderable.animationController.setOptions(options)
            pipeRenderable()
        } else {
            let animationController = renderable.animationController = new AnimationController(options)
            pipeRenderable()
            let showMethod = this.showWithAnimationController.bind(this, animationController, renderable)

            if (options.delay && options.delay > 0 && options.showInitially) {
                Timer.setTimeout(showMethod, options.delay)
            } else if (options.waitFor) {
                this.waitingAnimations.push({ showMethod: showMethod, waitFor: options.waitFor })
            } else if (options.showInitially) {
                showMethod()
            }

        }
    }

    /**
     * Shows a renderable using the animationController specified. When operation is complete, the renderable emits
     * the one events 'show' or 'hide', depending on what operation that was done.
     * @param animationController
     * @param renderable
     * @param show
     * @private
     */
    showWithAnimationController(animationController, renderable, callback, show = true, options = {}) {
        animationController._showingRenderable = show
        let callbackIfExists = () => {
            if (callback) {
                callback()
            }
        }
        let emitOnFinished = () => {
            if (renderable.emit) {
                renderable.emit(show ? 'shown' : 'hidden')
            }
            callbackIfExists()
        }

        if (show) {
            animationController.show(renderable.containerSurface || renderable, options, emitOnFinished)
        } else {
            animationController.hide(null, emitOnFinished)
        }
    }

    _addRenderableToDecoratorGroup(renderable, renderableCounterpart, renderableName) {
        /* Group the renderable */
        let groupName = this._getGroupName(renderable)

        if (groupName) {
            if (!(groupName in this._groupedRenderables)) {
                this._groupedRenderables[groupName] = new OrderedHashMap()
            }
            /* We save the both the renderable and the renderable counterpart in pairs */
            this._groupedRenderables[groupName].set(renderableName, [renderable, renderableCounterpart])
        }
    }

    _getGroupName(renderable) {
        let { decorations } = renderable

        if (!!decorations.dock) {
            /* 'filled' is a special subset of 'docked' renderables, that need to be rendered after the normal 'docked' renderables are rendered. */
            return decorations.dock.dockMethod === 'fill' ? 'filled' : 'docked'
        } else if (!!decorations.fullSize) {
            return 'fullSize'
        } else if (decorations.size || decorations.origin || decorations.align || decorations.translate) {
            return 'traditional'
        } else {
            /* This occurs e.g. when a renderable is only marked @renderable, and its parent view has a @layout.custom decorator to define its context. */
            return 'ignored'
        }
    }

    /**
     * Gets the renderables of a certain group
     * @param {String} The name of the group
     * @returns {OrderedHashMap} A map containing Array-pairs of [renderable, renderableCounterpart] containing the renderables of the specified type.
     */
    getRenderableGroup(groupName) {
        return this._groupedRenderables[groupName]
    }

    /**
     * Removes the renderable from the view
     * @param {String} renderableName The name of the renderable
     */
    removeRenderable(renderableName) {
        let renderable = this._renderables[renderableName]
        this._setDecorationPipes(renderableName, false)
        this._setDecorationEvents(renderableName, false)
        this._unpipeRenderable(renderableName, renderableName)
        this._removeRenderableFromDecoratorGroup(renderable, renderableName)
        delete this._renderableCounterparts[renderableName]
        delete this._renderables[renderableName]
    }

    //Done
    _removeRenderableFromDecoratorGroup(renderable, renderableName) {
        let groupName = this._getGroupName(renderable)
        this._removeRenderableFromGroupWithName(renderableName, groupName)
    }

    _removeRenderableFromGroupWithName(renderableName, groupName) {
        let group = this._groupedRenderables[groupName]
        group.remove(renderableName)
        if (!group.count()) {
            delete this._groupedRenderables[groupName]
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
        let renderable = this._renderables[renderableName];
        /* Add translate and rotate to be sure that there decorators translateFrom and rotateFrom work */
        let fakeRenderable = {
            decorations: {
                translate: renderable.decorations.translate || [0, 0, 0],
                rotate: renderable.decorations.rotate || [0, 0, 0]
            }
        };

        /* There can be existing decorators already, which are preserved. We are extending the decorators object,
         * by first creating a fake renderable that gets decorators */
        this.applyDecoratorFunctionsToRenderable(fakeRenderable, decorators);
        let { decorations } = fakeRenderable;
        this.applyDecoratorObjectToRenderable(renderableName, decorations);

    }

    applyDecoratorObjectToRenderable(renderableName, decorations) {
        let renderable = this._renderables[renderableName];
        let renderableOrEquivalent = this._getPipeableRenderableFromName(renderableName);
        /* We might need to do extra piping */
        this._setDecorationPipes(renderableOrEquivalent, decorations.pipes);
        this._setDecorationEvents(renderableOrEquivalent, decorations.eventSubscriptions);

        /* If the renderable is surface, we need to do some special things if there is a true size being used */
        if (Utils.renderableIsSurface(renderable)) {
            let sizesToCheck = [];
            let { size, dock } = decorations;
            if (size) {
                sizesToCheck.push(size);
            }
            if (dock) {
                sizesToCheck.push(dock.size);
            }
            let trueSizedInfo = this._sizeResolver.getSurfaceTrueSizedInfo(renderable);
            for (let sizeToCheck of sizesToCheck) {
                for (let dimension of [0, 1]) {
                    if (this._sizeResolver.isValueTrueSized(sizeToCheck[dimension])) {
                        if (!trueSizedInfo) {
                            this._sizeResolver.configureTrueSizedSurface(renderable, sizeToCheck);
                        }
                    }
                }
            }
        }
        let oldRenderableGroupName = this._getGroupName(renderable)
        let shouldDisableDock = (decorations.disableDock && renderable.decorations.dock)
        let shouldDisableFullSize = (decorations.size && renderable.decorations.fullSize)
        if (shouldDisableDock) {
            delete renderable.decorations.dock
        }
        if (shouldDisableFullSize) {
            delete renderable.decorations.fullSize
        }

        /* Merge existing flow decorations so they won't be discarded */
        if (renderable.decorations.flow && decorations.flow) {
            merge(decorations.flow, renderable.decorations.flow)
        }

        /* Extend the object */
        Object.assign(renderable.decorations, decorations);
        /* See if we have to redo the grouping */
        let needToChangeDecoratorGroup = (oldRenderableGroupName !== this._getGroupName(renderable)) || shouldDisableDock || shouldDisableFullSize
        /* Process new renderable equivalent, if that applies */
        let renderableCounterpart = this._renderableCounterparts[renderableName] = this._processsDecoratedRenderableCounterpart(renderable, renderableName)
        if (needToChangeDecoratorGroup) {
            this._removeRenderableFromGroupWithName(renderableName, oldRenderableGroupName)
            this._addRenderableToDecoratorGroup(renderable, renderableCounterpart, renderableName)
        }
    }

    applyDecoratorFunctionsToRenderable(renderable, decorators) {
        for (let decorator of decorators) {
            /* There can be existing decorators already, which are preserved. We are extending the decorators object,
             * by first creating a fake renderable that gets decorators */
            decorator(renderable)
        }
    }

    /**
     * Replaces one renderable with the other, making sure that the decorators stay consistent
     * @param oldRenderableName
     * @param newRenderable
     * @param newRenderableName
     */
    replaceRenderable(oldRenderableName, newRenderable, newRenderableName) {
        let renderable = this._renderables[oldRenderableName]
        let renderableHasAnimationController = (this._renderableCounterparts[oldRenderableName] instanceof AnimationController)
        /* If there isn't a renderable equivalent animationController that does the piping, then we need to redo the event piping */
        if (!renderableHasAnimationController) {
            /* Remove the listeners */
            this._setupAllRenderableListeners(oldRenderableName, false)
        }
        newRenderable.decorations = { ...newRenderable.decorations, ...renderable.decorations }
        let newRenderableCounterpart = this._processsDecoratedRenderableCounterpart(newRenderable, oldRenderableName)
        if (!renderableHasAnimationController) {
            this._renderableCounterparts[oldRenderableName] = newRenderableCounterpart
            this._setupAllRenderableListeners(oldRenderableName, true)
        }
        let renderableGroup = this._groupedRenderables[this._getGroupName(renderable)]
        let indexOfRenderable = renderableGroup.indexOf(oldRenderableName)
        renderableGroup.remove(oldRenderableName)
        renderableGroup.insert(indexOfRenderable, newRenderableName, [newRenderable, newRenderableCounterpart])
        this._renderables[newRenderableName] = newRenderable;
        this._renderableCounterparts[newRenderableName] = this._renderableCounterparts[oldRenderableName]
        delete this._renderables[oldRenderableName]
        delete this._renderableCounterparts[oldRenderableName]
    }

    async setRenderableFlowState(renderableName = '', stateName = '') {

        let renderable = this._renderables[renderableName]
        if (!renderable || !renderable.decorations || !renderable.decorations.flow) {
            return Utils.warn(`setRenderableFlowState called on non-existing or renderable '${renderableName}' without flowstate`)
        }
        let flowOptions = renderable.decorations.flow

        /* Keep track of which flow state changes are running. We only allow one at a time per renderable.
         * The latest one is always the valid one.
         */
        let flowWasInterrupted = false

        flowOptions.currentState = stateName
        for (let { transformations, options } of flowOptions.states[stateName].steps) {
            flowOptions.currentTransition = options.transition
            this.decorateRenderable(renderableName, ...transformations)

            /* Make sure FlowLayoutNode.set() is called next render tick */
            this._sizeResolver.requestReflow()

            /* Set the callback of the renderable so it's passed to the flowLayoutNode */
            let resolveData = await new Promise((resolve) => renderable.decorations.flow.callback = resolve)

            /* Optionally, we insert a delay in between ending the previous state change, and starting on the new one. */
            if (options.delay) {
                await waitMilliseconds(options.delay)
            }

            /* If the flow has been interrupted */
            if (resolveData.reason === 'flowInterrupted') {
                flowWasInterrupted = true
                break
            }

            let emit = (renderable._eventOutput && renderable._eventOutput.emit || renderable.emit).bind(renderable._eventOutput || renderable)
            emit('flowStep', { state: stateName })
        }

        return !flowWasInterrupted
    }

    async setViewFlowState(stateName = '', flowOptions) {
        let steps = flowOptions.viewStates[stateName]

        if (!steps) {
            Utils.warn(`Flow state name '${stateName}' does not exist`)
            return false
        }
        /* If there is just one step, it might not be an array */
        if (!Array.isArray(steps)) {
            steps = [steps]
        }

        /* This is intended to be overwritten by other asynchronous calls to this method, see the stateName check below. */
        flowOptions.currentState = stateName

        for (let step of steps) {
            await Promise.all(this.generateWaitQueueFromViewStateStep(step))

            /* If another state has been set since the invocation of this method, skip any remaining transformations. */
            if (flowOptions.currentState !== stateName) {
                break
            }
        }

        return true
    }

    generateWaitQueueFromViewStateStep(step) {
        let waitQueue = []
        for (let localRenderableName in step) {
            let state = step[localRenderableName]
            waitQueue.push(this.setRenderableFlowState(this._getIDfromLocalName(localRenderableName), state))
        }
        return waitQueue
    }

    getRenderableFlowState(renderableName = '') {
        let renderable = this._renderables[renderableName]
        if (!renderable || !renderable.decorations || !renderable.decorations.flow) {
            return Utils.warn(`getRenderableFlowState called on non-existing or renderable '${renderableName}' without flowstate`)
        }
        let flowOptions = renderable.decorations.flow
        return flowOptions.currentState
    }

    getViewFlowState(flowOptions = {}) {
        return flowOptions.currentState
    }

    /**
     * Create the swipable and register all the event logic for a swipable renderable
     * @private
     */
    _initSwipable(swipableOptions = {}, renderable = {}) {
        GenericSync.register({
            'mouse': MouseSync,
            'touch': TouchSync
        })

        let sync = new GenericSync({
            'mouse': {},
            'touch': {}
        })

        renderable.pipe(sync)

        /* Translation modifier */
        var positionModifier = new Modifier({
            transform: function () {
                let [x, y] = position.get()
                return Transform.translate(x, y, 0)
            }
        })

        var position = new Transitionable([0, 0])

        sync.on('update', (data) => {
            let [x, y] = position.get()
            x += !swipableOptions.snapX ? data.delta[0] : 0
            y += !swipableOptions.snapY ? data.delta[1] : 0
            let { yRange = [0, 0], xRange = [0, 0] } = swipableOptions
            y = limit(yRange[0], y, yRange[1])
            x = limit(xRange[0], x, xRange[1])
            position.set([x, y])
        })

        sync.on('end', (data) => {
            let [x, y] = position.get()
            data.velocity[0] = Math.abs(data.velocity[0]) < 0.5 ? data.velocity[0] * 2 : data.velocity[0]
            let endX = swipableOptions.snapX ? 0 : x + data.delta[0] + (data.velocity[0] * 175)
            let endY = swipableOptions.snapY ? 0 : y + data.delta[1] + (data.velocity[1] * 175)
            let { yRange = [0, 0], xRange = [0, 0] } = swipableOptions
            endY = limit(yRange[0], endY, yRange[1])
            endX = limit(xRange[0], endX, xRange[1])
            position.set([endX, endY], {
                curve: Easing.outCirc,
                duration: (750 - Math.abs((data.velocity[0] * 150)))
            })

            this._determineSwipeEvents(renderable, swipableOptions, endX, endY)

        })

        renderable.node = new RenderNode()
        renderable.node.add(positionModifier).add(renderable)

        return renderable
    }

    _determineSwipeEvents(renderable, swipableOptions = {}, endX = 0, endY = 0) {

        if (!renderable || !renderable._eventOutput) return

        let xThreshold = swipableOptions.xThreshold || [undefined, undefined]
        let yThreshold = swipableOptions.yThreshold || [undefined, undefined]

        if (xThreshold[1] && endX > xThreshold[1]) {
            renderable._eventOutput.emit('swiped', {
                direction: 0,
                displacement: 'right'
            })
        }

        if (xThreshold[0] && endX < xThreshold[0]) {
            renderable._eventOutput.emit('swiped', {
                direction: 0,
                displacement: 'left'
            })
        }

        if (yThreshold[1] && endY > yThreshold[1]) {
            renderable._eventOutput.emit('swiped', {
                direction: 1,
                displacement: 'bottom'
            })
        }

        if (yThreshold[0] && endY < yThreshold[0]) {
            renderable._eventOutput.emit('swiped', {
                direction: 1,
                displacement: 'top'
            })
        }
    }

    /**
     * Rearranges the order in which docked renderables are parsed for rendering, ensuring that 'renderableName' is processed
     * before 'nextRenderableName'.
     * @param {String} renderableName
     * @param {String} nextRenderableName
     */
    prioritiseDockBefore(renderableName, nextRenderableName) {
        let dockedRenderables = this._groupedRenderables.docked
        if (!dockedRenderables) {
            Utils.warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': no docked renderables present.`)
            return false
        }
        let result = this._prioritiseDockAtIndex(renderableName, dockedRenderables.indexOf(nextRenderableName))
        if (!result) {
            Utils.warn(`Could not prioritise '${renderableName}' before '${nextRenderableName}': could not find one of the renderables by name.
                        The following docked renderables are present: ${dockedRenderables.keys()}`)
        }
        return result
    }

    /**
     * @param {String} renderableName
     * @param {String} prevRenderableName
     */
    prioritiseDockAfter(renderableName, prevRenderableName) {
        let dockedRenderables = this._groupedRenderables.docked
        if (!dockedRenderables) {
            Utils.warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': no docked renderables present.`)
            return false
        }
        let result = this._prioritiseDockAtIndex(renderableName, dockedRenderables.indexOf(prevRenderableName) + 1)
        if (!result) {
            Utils.warn(`Could not prioritise '${renderableName}' after '${prevRenderableName}': could not find one of the renderables by name.
                        The following docked renderables are present: ${dockedRenderables.keys()}`)
        }
        return result
    }

    /**
     * Helper function used by prioritiseDockBefore and prioritiseDockAfter to change order of docked renderables
     * @param renderableName
     * @param index
     * @returns {boolean}
     * @private
     */
    _prioritiseDockAtIndex(renderableName, index) {
        let dockedRenderables = this._groupedRenderables.docked
        let renderableToRearrange = dockedRenderables.get(renderableName);

        if (index < 0 || !renderableToRearrange) {
            return false
        }

        dockedRenderables.remove(renderableName);
        dockedRenderables.insert(index, renderableName, renderableToRearrange);

        return true

    }

    applyDirectDecoratorsFromRenderablePrototype(decorations, renderablePrototype) {
        /* Instead of passing the renderable here, we pass the decorations-object directly, since this is what the
         * directly applied decorator functions expect. This makes it a very simple function but it's kept as a separate
         * for explanatory purposes */
        this.applyDecoratorFunctionsToRenderable(decorations, renderablePrototype.getDirectlyAppliedDecoratorFunctions());
    }
}
