/**
 * Created by lundfall on 01/09/16.
 */

import EventEmitter                 from 'eventemitter3';
import browser                      from 'bowser';

import _unescape                    from 'lodash/unescape.js';
import LayoutUtility                from 'famous-flex/LayoutUtility.js';
import Engine                       from 'famous/core/Engine.js';
import Timer                        from 'famous/utilities/Timer.js';
import {limit}                      from 'arva-js/utils/Limiter.js';

import ImageSurface                 from 'famous/surfaces/ImageSurface.js';
import AnimationController          from 'famous-flex/AnimationController.js';

import {View}                       from '../../core/View.js';
import {Utils}                      from './Utils.js';

import ElementOutput                from 'famous/core/ElementOutput';

/**
 * Used by the view to keep track of sizes. Emits events to communicate with the view to do certain actions
 */
export class SizeResolver extends EventEmitter {

    constructor() {
        super();
        this._resolvedSizesCache = new Map();
        this._sizeIsFinalFor = new Map();
        this._sizeIsResolvedFor = new Map();
        this._trueSizedSurfaceInfo = new Map();
    }

    /**
     *
     *
     * Determines the decorated size. If there is true sizing involved, then it will not return the resolved true size.
     * Instead, this can be accessed through getResolvedSize()
     * @param {Renderable} renderable. The renderable for which we need the size
     * @param {Renderable} renderableCounterpart. The renderable counter-part (e.g. AnimationController, RenderNode, or ContainerSurface).
     * @param {Object} context. The context, with a specified size. The size can be set to NaN in order to return NaN
     * @param {Array} specifiedSize. The size to use which is specified as a decorator
     * @returns {*}
     */
    settleDecoratedSize(renderable, renderableCounterpart, context, specifiedSize = [undefined, undefined]) {
        let size = specifiedSize.map((size, dimension) => this.resolveSingleSize(size, context.size, dimension));
        let cacheResolvedSize = [];
        for (let dimension = 0; dimension < 2; dimension++) {
            if (this.isValueTrueSized(size[dimension])) {
                cacheResolvedSize[dimension] = this._resolveSingleTrueSizedRenderable(renderable, size, dimension, renderableCounterpart, specifiedSize, context.size);
                if (Utils.renderableIsSurface(renderable)) {
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
                /* renderableSize can be true, undefined, or something unkown. */
                return renderableSize;
        }
    }

    /**
     * Resolves a true size to an actual size of a truesized renderable. size[dim] must be negative or true.
     * @param {Renderable} renderable the renderable
     * @param {Array} size the size as specified
     * @param dim the dimensions e.g. 0,1 that should be processed
     * @param {Renderable} renderableCounterpart. The renderable counter-part (e.g. AnimationController, RenderNode, or ContainerSurface).
     * @param {Array} specifiedSize The size as specified
     * @returns {Number} size[dim] will be returned with a non-truesized value
     * @private
     */
    _resolveSingleTrueSizedRenderable(renderable, size, dim, renderableCounterpart, specifiedSize, contextSize) {
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
                /* If the renderable isn't displaying, we must simply consider it final.
                 TODO: There might be better ways to reason about non-displaying renderables  */
                let sizeConsideredFinal = !(renderableIsView && renderable.layout.isDisplaying()) ||
                    ((renderableIsView && (renderable._initialised && !renderable.containsUncalculatedSurfaces())) || !renderableIsView);
                if (size[dim] === true && twoDimensionalSize[dim] === undefined && sizeConsideredFinal) {
                    Utils.warn(`True sized renderable '${renderable.constructor.name}' is taking up the entire context size.`);
                    return contextSize[dim];
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
            let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable);

            if (!trueSizedSurfaceInfo) {
                /* Seems like the surface isn't properly configured, let's get that going */
                trueSizedSurfaceInfo = this.configureTrueSizedSurface(renderable, specifiedSize);
            }
            let { isUncalculated, trueSizedDimensions } = trueSizedSurfaceInfo;

            this._sizeIsFinalFor.set(renderable, !isUncalculated);

            if (isUncalculated === false && trueSizedDimensions[dim]) {
                return trueSizedSurfaceInfo.size[dim];
            }

            if (!trueSizedDimensions[dim]) {
                trueSizedDimensions[dim] = true;
                this._evaluateTrueSizedSurface(renderable);
            }

            if (size[dim] === true) {
                /* If size is set to true, and it can't be resolved, then settle with size undefined*/
                size[dim] = undefined;
            }
            let fallbackSize = ~size[dim];

            let approximatedSize = size[dim] === undefined ? (contextSize[dim] || fallbackSize) : fallbackSize
            /* Return an approximated size, if possible */
            return (trueSizedSurfaceInfo.size[dim] || approximatedSize);
        } else {
            this._sizeIsFinalFor.set(renderable, true);
            return this._specifyUndeterminedSingleHeight(renderable, size, dim);
        }
    }

    async invalidateFontForBrowserBugFix(font) {
        let dummyContext = Engine.getCachedCanvas().getContext("2d");
        dummyContext.font = font;
        dummyContext.measureText('A');
        await new Promise((resolve) => Timer.after(resolve, 1));

    }

    _measureRenderableWidth(surface, text = surface.getContent()) {
        /* The canvas API is too unreliable for now */
        if (true) {
            return;
        }
        let surfaceProperties = surface.getProperties();
        let {
            fontStyle = 'normal',
            fontSize = 'medium',
            fontWeight = 'normal',
            fontVariant = 'normal',
            lineHeight = 'normal',
            fontFamily,
            letterSpacing = '0px',
            font
        } = surfaceProperties;
        if (!font && fontFamily) {
            font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} "${fontFamily}"`;
        }
        if (!font) return;


        let context = Engine.getCachedCanvas().getContext("2d");

        if (font) {
            context.font = font;
        }


        let [paddingTop, paddingRight, paddingBottom, paddingLeft] = this._getParsedPadding(surfaceProperties);
        let content = _unescape(text);
        context.measureText(content);
        let textWidth = context.measureText(content).width + content.length * this._cssValueToPixels(letterSpacing, undefined);
        let resultingWidth = this._cssValueToPixels(paddingLeft, textWidth) + textWidth + this._cssValueToPixels(paddingRight, textWidth);
        /* Mozilla Firefox appreciates the values rounded upwards */
        return Math.ceil(resultingWidth);
    }

    _getParsedPadding(properties) {
        let {
            padding,
            paddingRight = '0px',
            paddingLeft = '0px',
            paddingTop = '0px',
            paddingBottom = '0px'
        } = properties;
        if (padding) {
            [paddingTop, paddingRight, paddingBottom, paddingLeft] = LayoutUtility.normalizeMargins(padding.split(" "));
        }
        return [paddingTop, paddingRight, paddingBottom, paddingLeft];
    }

    _estimateRenderableHeight(surface) {
        let surfaceProperties = surface.getProperties();
        let { fontSize, lineHeight } = surface.getProperties();
        if (!fontSize) {
            return NaN;
        }
        let [paddingTop, paddingRight, paddingBottom, paddingLeft] = this._getParsedPadding(surfaceProperties);
        /* If using a percentage in font, it refers to 16px */
        let estimatedHeight;
        if (!surface.getContent()) {
            estimatedHeight = 0;
        } else {
            estimatedHeight = this._cssValueToPixels(fontSize, 16);
        }
        if (lineHeight) {
            estimatedHeight = this._cssValueToPixels(lineHeight, estimatedHeight);
        }
        return this._cssValueToPixels(paddingTop, estimatedHeight) + estimatedHeight + this._cssValueToPixels(paddingBottom, estimatedHeight);
    }

    _cssValueToPixels(value = NaN, parentSize = NaN) {
        if (value.endsWith('px')) {
            return parseFloat(value);
        }
        /* Pixels are points times 1 and a third */
        if (value.endsWith('pt')) {
            return parseFloat(value) * (1 + 1 / 3);
        }
        if (value === 'normal') {
            return parentSize;
        }

        if (value.endsWith('%')) {
            return (parseFloat(value) / 100) * parentSize;
        }
        //value ends with number, assume proportion
        return parseFloat(value) * parentSize;
    }

    /**
     * Determines whether the size is considered final or not, and may affect whether the rendering will take place or
     * not
     * @param {Renderable} renderable
     * @returns {Boolean} sizeIsFinal
     */
    isSizeFinal(renderable) {
        let consideredFinal = this._sizeIsFinalFor.get(renderable) || this._sizeIsResolvedFor.get(renderable);

        /* Return true if nothing is known, to be sure not to make false negatives */
        if (consideredFinal === undefined) {
            consideredFinal = true;
        }
        /* If the size has been considered final once, we should mark the renderable as being final forever */
        if(consideredFinal === true){
            this._sizeIsResolvedFor.set(renderable, true);
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
        for (let [surface, { isUncalculated }] of this._trueSizedSurfaceInfo) {
            if (isUncalculated) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculates a surface size, if possible
     * @param renderable
     * @returns Boolean True if the surface could be calculated
     * @private
     */
    _tryCalculateTrueSizedSurface(renderable) {
        let renderableHtmlElement = renderable._element;
        if (!renderableHtmlElement) return false;
        let trueSizedInfo = this._trueSizedSurfaceInfo.get(renderable);
        let { trueSizedDimensions } = trueSizedInfo;

        /* HTML treats white space as nothing at all, so we need to be sure that "  " == "" */
        let trimmedContent = (renderable.getContent() && renderable.getContent().trim) ? renderable.getContent().trim() : renderable.getContent();

        if (renderableHtmlElement &&
            ((
                    renderableHtmlElement.offsetWidth && renderableHtmlElement.offsetHeight
                ) ||
                (!trimmedContent && !(renderable instanceof ImageSurface))
            ) &&
            /* If the content is dirty, that means that the content is about to change, so we shouldn't resolve the size */
            !renderable._contentDirty &&
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
                this.requestRecursiveReflow();
            }

            return true;
        } else {
            this.requestReflow();
            this.requestLayoutControllerReflow();
            return false;
        }
    }

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
    configureTrueSizedSurface(renderable, specifiedSize) {
        let trueSizedDimensions = specifiedSize.map((singleSize) => this.isValueTrueSized(singleSize));
        let trueSizedSurfaceInfo = {
            isUncalculated: true,
            trueSizedDimensions,
            size: [undefined, undefined],
            specifiedSize
        };

        /* We assume both dimensions not to be truesized, they are set in this._resolveDecoratedSize */
        this._trueSizedSurfaceInfo.set(renderable, trueSizedSurfaceInfo);


        this._evaluateTrueSizedSurface(renderable);

        return trueSizedSurfaceInfo;
    }

    /**
     * Investigates the surfaces to see in which way the size should be estimated.
     *
     * Currently disabled due to browser and font difficulties
     * @param renderable
     * @returns {*}
     * @private
     */
    async _evaluateTrueSizedSurface(renderable) {
        //TODO Re-enable the canvas sizing once its been stabilizied
        return this._setupSurfaceGetsSizeFromDOM(renderable);

        let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable);


        if (renderable instanceof ImageSurface) {
            return this._setupSurfaceGetsSizeFromDOM(renderable);
        }

        let [widthExplicitlySet, heightExplicitlySet] = this._determineDimensionsExplicitlySet(renderable);

        if (widthExplicitlySet && heightExplicitlySet) {
            trueSizedSurfaceInfo.size = [...renderable.size];
            return;
        }

        if (!widthExplicitlySet && this._doesBrowserNeedBugFixForSurface(renderable)) {
            this._patchCanvasBug(renderable);
            Timer.after(() => {
                this._calculateTrueSizedSurfaceFromCanvas(renderable);
                this.requestRecursiveReflow();
            }, 1);
            return;
        }

        this._calculateTrueSizedSurfaceFromCanvas(renderable);
    }

    /**
     * Sets up that the surface should estimate its own size by querying the DOM (the less performant option)
     * @param renderable
     * @private
     */
    _setupSurfaceGetsSizeFromDOM(renderable) {


        let trueSizeSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable);
        let { resizeFromCanvasListener, deployFromCanvasListener, trueSizedDimensions } = trueSizeSurfaceInfo;

        /* Need to set the Surface 'size' property in order to get resize notifications */
        renderable.setSize(trueSizedDimensions.map((isTrueSized) => isTrueSized || undefined));

        if (resizeFromCanvasListener) {
            renderable.removeListener('resize', resizeFromCanvasListener);
        }
        if (deployFromCanvasListener) {
            renderable.removeListener('deploy', deployFromCanvasListener);
        }
        if (!trueSizeSurfaceInfo.resizeFromDOMListener) {
            let resizeListener = trueSizeSurfaceInfo.resizeFromDOMListener = () => {
                this._tryCalculateTrueSizedSurface(renderable);
                /* Because the resize is triggered before the DOM manipulations happened, also
                 *  try to calculate the surface after 1 more tick */
                Timer.after(() => this._tryCalculateTrueSizedSurface(renderable), 1);
            };
            renderable.on('resize', resizeListener);
        }
        if (!trueSizeSurfaceInfo.deployFromDOMListener) {
            let deployListener = trueSizeSurfaceInfo.deployFromDOMListener = () => {
                if (!trueSizeSurfaceInfo.isUncalculated) {
                    this._tryCalculateTrueSizedSurface(renderable);
                }
            };
            renderable.on('deploy', deployListener);
        }
    }

    /**
     * Sets up that we should estimate the size of the renderable based on the canvas API
     * @param renderable
     * @private
     */
    _setupSurfaceGetsSizeFromCanvas(renderable) {
        let trueSizeSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable);
        renderable.setSize(trueSizeSurfaceInfo.size);
        let { resizeFromDOMListener, deployFromDOMListener } = trueSizeSurfaceInfo;
        if (resizeFromDOMListener) {
            renderable.removeListener('resize', resizeFromDOMListener);
        }
        if (deployFromDOMListener) {
            renderable.removeListener('deploy', deployFromDOMListener);
        }
        if (!trueSizeSurfaceInfo.resizeFromCanvasListener) {
            let resizeListener = trueSizeSurfaceInfo.resizeFromCanvasListener = () => {
                this._evaluateTrueSizedSurface(renderable);
                this.requestReflow();
            };
            renderable.on('resize', resizeListener);
        }
        if (!trueSizeSurfaceInfo.deployFromCanvasListener) {
            let deployListener = trueSizeSurfaceInfo.deployFromCanvasListener = () => {
                if (!trueSizeSurfaceInfo.isUncalculated) {
                    /* Reset size. If not reset, it will be interpreted as being explicitly set
                     *  in evaluateTrueSizedSurface */
                    renderable.setSize(null);
                    this._evaluateTrueSizedSurface(renderable);
                    this.requestReflow();
                }
            };
            renderable.on('deploy', deployListener);
        }

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

    /**
     * For Chrome and Safari, the canvas API doesn't return the correct value when font is loaded
     * @param renderable
     * @returns {Promise.<void>}
     * @private
     */
    async _patchCanvasBug(renderable) {
        let fontFamily = this._getFontFamilyFromSurface(renderable);
        await this.invalidateFontForBrowserBugFix(fontFamily);
        SizeResolver._invalidatedFonts[fontFamily] = true;

    }

    _doesBrowserNeedBugFixForSurface(surface) {
        if (!browser.check('webkit')) {
            return false;
        }
        if (!SizeResolver._invalidatedFonts) {
            SizeResolver._invalidatedFonts = {};
        }

        let fontFamily = this._getFontFamilyFromSurface(surface);

        if (!fontFamily) {
            return true;
        }

        return !SizeResolver._invalidatedFonts[fontFamily];
    }

    _getFontFamilyFromSurface(surface) {
        let properties = surface.getProperties();
        let { fontFamily, font } = properties;
        if (!fontFamily) {
            if (!font) {
                return;
            }
            let fontMatch = /"(.*)"$/g.exec(font);
            if (fontMatch[1]) {
                fontFamily = fontMatch[1];
            } else {
                fontFamily = font.split(' ').slice(-1)[0];
            }
        }
        return fontFamily;
    }

    _calculateTrueSizedSurfaceFromCanvas(renderable) {
        let trueSizedSurfaceInfo = this._trueSizedSurfaceInfo.get(renderable);
        let { trueSizedDimensions, specifiedSize } = trueSizedSurfaceInfo;
        let [widthExplicitlySet, heightExplicitlySet] = this._determineDimensionsExplicitlySet(renderable);

        let estimatedWidth = widthExplicitlySet ?
            renderable.size[0] :
            this._measureRenderableWidth(renderable);


        let height = null, width = null;

        if (trueSizedDimensions[0]) {
            width = trueSizedSurfaceInfo.size[0] = estimatedWidth;
        }

        if (trueSizedDimensions[1]) {
            if (!trueSizedDimensions[0]) {
                let resolvedSpecifiedWidth = this.resolveSingleSize(specifiedSize[0], { size: [NaN, NaN] }, 0);
                if (!resolvedSpecifiedWidth || resolvedSpecifiedWidth < estimatedWidth) {
                    return this._setupSurfaceGetsSizeFromDOM(renderable);
                }
            }
            if (heightExplicitlySet && !renderable.size) {
                return this._setupSurfaceGetsSizeFromDOM(renderable);
            }
            height = trueSizedSurfaceInfo.size[1] =
                heightExplicitlySet ?
                    renderable.size[1]
                    : this._estimateRenderableHeight(renderable);
        }

        for (let singleSize of [width, height]) {
            if (singleSize === undefined || Number.isNaN(singleSize)) {
                return this._setupSurfaceGetsSizeFromDOM(renderable);
            }
        }

        /* If we reached this far, then everything could succesfully be calculated */
        trueSizedSurfaceInfo.isUncalculated = false;
        /* Keep listening for further changes, if necessary */
        this._setupSurfaceGetsSizeFromCanvas(renderable);
    }

    _determineDimensionsExplicitlySet(surface) {
        return [surface.size && typeof surface.size[0] === 'number',
            surface.size && typeof surface.size[1] === 'number'];
    }
}