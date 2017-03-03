/**
 * Created by lundfall on 01/09/16.
 */


import {limit}                      from 'arva-js/utils/Limiter.js';

import ImageSurface                 from 'famous/surfaces/ImageSurface.js';
import AnimationController          from 'famous-flex/AnimationController.js';

import {View}                       from '../../core/View.js';
import {Utils}                      from './Utils.js';

import EventEmitter                 from 'eventemitter3';

/**
 * Used by the view to keep track of sizes. Emits events to communicate with the view to do certain actions
 */
export class SizeResolver extends EventEmitter {

    constructor() {
        super();
        this._resolvedSizesCache = new Map();
        this._sizeIsFinalFor = new Map();
        this._trueSizedSurfaceInfo = new Map();
    }

    /**
     * Determines the decorated size. If there is true sizing involved, then it will not return the resolved true size.
     * Instead, this can be accessed through getResolvedSize()
     * @param {Renderable} renderable. The renderable for which we need the size
     * @param {Renderable} renderableCounterpart. The renderable counter-part (e.g. AnimationController, RenderNode, or ContainerSurface).
     * @param {Object} context. The context, with a specified size. The size can be set to NaN in order to return NaN
     * @param {Array} specifiedSize. The size to use which is specified as a decorator
     * @returns {*}
     */
    settleDecoratedSize(renderable, renderableCounterpart, context, specifiedSize = [undefined, undefined]) {
        let size = [];
        let cacheResolvedSize = [];
        for (let dimension = 0; dimension < 2; dimension++) {
            size[dimension] = this.resolveSingleSize(specifiedSize[dimension], context.size, dimension);
            if (this.isValueTrueSized(size[dimension])) {
                cacheResolvedSize[dimension] = this._resolveSingleTrueSizedRenderable(renderable, size, dimension, renderableCounterpart);
                if (Utils.renderableIsSurface(renderable)) {
                    size[dimension] = true;
                } else {
                    size[dimension] = cacheResolvedSize[dimension];
                }
            } else {
                this._sizeIsFinalFor.set(renderable, true);
                size[dimension] = size[dimension] === undefined ? (context.size[dimension] || size[dimension]) : size[dimension];
                cacheResolvedSize[dimension] = size[dimension];
            }
        }

        this._resolvedSizesCache.set(renderable, [cacheResolvedSize[0], cacheResolvedSize[1]]);

        return (size[0] !== null && size[1] !== null) ? size : null;
    }

    /**
     * Resolves a single dimension (i.e. x or y) size of a renderable.
     * @param {Number|Boolean|Object|Undefined|Function} renderableSize Renderable's single dimension size.
     * @param {Array.Number} contextSize The context size
     * @param {Number} dimension The dimension of the size that is being evaluated (e.g. 1 or 0)
     * @returns {Number} The resulting size
     * @private
     */
    resolveSingleSize(renderableSize, contextSize, dimension) {
        switch (typeof renderableSize) {
            case 'function':
                return this.resolveSingleSize(renderableSize(...contextSize), contextSize, dimension);
            case 'number':
                /* If 0 < renderableSize < 1, we interpret renderableSize as a fraction of the contextSize */
                return renderableSize < 1 && renderableSize > 0 ? renderableSize * Math.max(contextSize[dimension], 0) : renderableSize;
            default:
                /* renderableSize can be true/false, undefined, or 'auto' for example. */
                return renderableSize;
        }
    }

    /**
     * Resolves a true size to an actual size of a truesized renderable. size[dim] must be negative or true.
     * @param {Renderable} renderable the renderable
     * @param {Array} size the size as specified
     * @param dim the dimensions e.g. 0,1 that should be processed
     * @param {Renderable} renderableCounterpart. The renderable counter-part (e.g. AnimationController, RenderNode, or ContainerSurface).
     * @returns {Number} size[dim] will be returned with a non-truesized value
     * @private
     */
    _resolveSingleTrueSizedRenderable(renderable, size, dim, renderableCounterpart) {
        if (size[dim] === -1) {
            Utils.warn('-1 detected as set size. If you want a true sized element to take ' +
                'up a proportion of your view, please define a function doing so by ' +
                'using the context size');
        }
        /* If there is an AnimationController without content, display 0 size */
        if (renderableCounterpart instanceof AnimationController && !renderableCounterpart._showingRenderable) {
            return 0;
        }
        /* True sized element. This has been specified as ~100 where 100 is the initial size
         * applying this operator again (e.g. ~~100) gives us the value 100 back
         * */
        if (Utils.renderableIsComposite(renderable)) {
            let twoDimensionalSize = renderable.getSize();
            if (!twoDimensionalSize) {
                return this._specifyUndeterminedSingleHeight(renderable, size, dim);
            } else {
                let renderableIsView = renderable instanceof View;
                let sizeConsideredFinal = ((renderableIsView && (renderable._initialised && !renderable.containsUncalculatedSurfaces())) || !renderableIsView);
                if (size[dim] === true && twoDimensionalSize[dim] === undefined && sizeConsideredFinal) {
                    Utils.warn(`True sized renderable '${renderable.constructor.name}' is taking up the entire context size.`);
                    return twoDimensionalSize[dim];
                } else {
                    let approximatedSize = size[dim] === true ? twoDimensionalSize[dim] : ~size[dim];
                    let resultingSize = twoDimensionalSize[dim] !== undefined ? twoDimensionalSize[dim] : approximatedSize;
                    if (renderableIsView) {
                        resultingSize = sizeConsideredFinal ? resultingSize : approximatedSize;
                    }
                    this._sizeIsFinalFor.set(renderable, sizeConsideredFinal);
                    return resultingSize;
                }
            }
        } else if (Utils.renderableIsSurface(renderable)) {
            let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable) || {};
            if (trueSizedSurfaceInfo.calculateOnNext) {
                trueSizedSurfaceInfo.calculateOnNext = false;
                this._tryCalculateTrueSizedSurface(renderable);
            }
            let {isUncalculated} = trueSizedSurfaceInfo;
            this._sizeIsFinalFor.set(renderable, !isUncalculated);
            if (isUncalculated === false) {
                return trueSizedSurfaceInfo.size[dim];
            } else {
                if (size[dim] === true) {
                    let defaultSize = 5;
                    Utils.warn(`No initial size set for renderable '${renderable.constructor.name}', will default to ${defaultSize}px`);
                    size[dim] = ~5;
                }
                if (isUncalculated !== true) {
                    /* Seems like the surface isn't properly configured, let's get that going */
                    trueSizedSurfaceInfo = this.configureTrueSizedSurface(renderable);
                }
                trueSizedSurfaceInfo.trueSizedDimensions[dim] = true;
                renderable.size[dim] = true;
                /* Need to set the size in order to get resize notifications */
                return ~size[dim];
            }
        } else {
            this._sizeIsFinalFor.set(renderable, true);
            return this._specifyUndeterminedSingleHeight(renderable, size, dim);
        }
    }

    /**
     * Determines whether the size is considered final or not, and may affect whether the rendering will take place or
     * not
     * @param {Renderable} renderable
     * @returns {Boolean} sizeIsFinal
     */
    isSizeFinal(renderable) {
        let consideredFinal = this._sizeIsFinalFor.get(renderable);
        /* Return true if nothing is known, to be sure not to make errors */
        if(consideredFinal === undefined){
            return true;
        }
        return consideredFinal;
    }
    /**
     * Determines if the value is true sized
     * @param {*} value
     * @returns {boolean} True if the value is true sized
     * @private
     */
    isValueTrueSized(value) {
        return value < 0 || value === true
    }


    _specifyUndeterminedSingleHeight(renderable, size, dim) {
        let resultingSize = size[dim] < 0 ? ~size[dim] : 5;
        Utils.warn(`Cannot determine size of ${renderable.constructor.name}, falling back to default size or ${resultingSize}px. If the renderable is using legacy declaration this.renderables = ... this isn't supported for true sizing.`);
        return resultingSize;
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
     * Calculates a surface size, if possible
     * @param renderable
     * @private
     */
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
            this.requestRecursiveReflow();
        } else {
            this.requestReflow();
            this.requestLayoutControllerReflow();
        }
    }

    //Todo listen for these in the view
    requestRecursiveReflow() {
        this.emit('reflowRecursively');
    }

    requestReflow() {
        this.emit('reflow');
    }

    requestLayoutControllerReflow() {
        this.emit('layoutControllerReflow');
    }

    /**
     * Sets up a true sized surface
     * @param renderable
     * @returns {{isUncalculated: boolean, trueSizedDimensions: boolean[], name: *}} an entry in this._trueSizedSurfaceInfo
     * @private
     */
    configureTrueSizedSurface(renderable) {
        let trueSizedSurfaceInfo = {isUncalculated: true, trueSizedDimensions: [false, false]};

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

    /**
     * Gets the size used when displaying a renderable on the screen the last time the calculation was done.
     * @param {Renderable/Name} renderableOrName The renderable or the name of the renderable of which you need the size
     */
    getResolvedSize(renderable) {
        return this._resolvedSizesCache.get(renderable);
    }

    doTrueSizedBookkeeping() {
        for (let [surface] of this._trueSizedSurfaceInfo) {
            /* Encourage the surfaces to check if they have been resized, which could trigger the resize event */
            surface._trueSizeCheck = true;
        }
    }

    getSurfaceTrueSizedInfo(surface) {
        return this._trueSizedSurfaceInfo.get(surface);
    }
}