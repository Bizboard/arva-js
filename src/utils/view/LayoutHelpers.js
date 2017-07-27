/**
 * Created by lundfall on 01/09/16.
 */
import isEqual                      from 'lodash/isEqual.js';
import findIndex                    from 'lodash/findIndex.js';
import Easing                       from 'famous/transitions/Easing.js';

import {Utils}                      from './Utils.js';
import {TrueSizedLayoutDockHelper}  from '../../layout/TrueSizedLayoutDockHelper.js';


class BaseLayoutHelper {
    constructor(sizeResolver) {
        this._sizeResolver = sizeResolver;
    }

    layout() {
        throw Error("Not implemented");
    }

    boundingBoxSize() {
        throw Error("Not implemented");
    }

    /**
     * Gets the flow information from the renderable
     * @param {Renderable} renderable
     * @returns {{transition: Object, callback: Function}}
     * @private
     */
    _getRenderableFlowInformation(renderable) {
        let { decorations } = renderable;
        let flowInformation = { transition: undefined, callback: undefined };
        let { flow } = decorations;
        if (flow) {
            flowInformation.transition = flow.currentTransition || (flow.defaults && flow.defaults.transition);
            flowInformation.callback = flow.callback;
        }
        return flowInformation;
    }
}


export class DockedLayoutHelper extends BaseLayoutHelper {

    /**
     * Computes translation, inner size, actual docking size (outer size) and an adjusted docking size for a renderable that is about to be docked.
     * @param {OrderedHashMap} dockedRenderables A map containing Array-pairs of [renderable, renderableCounterpart] containing the things that are attached to the sides.
     * @param {OrderedHashMap} filledRenderables A map containing Array-pairs of [renderable, renderableCounterpart] containing the things that are filled.
     * @param {Object} context. The famous context with a valid size proportion.
     * @param {Object} ownDecorators The decorators that are applied to the view.
     * @param {Array|Number} [ownDecorators.extraTranslate]. A translate to shift the entire layout with.
     * @param {Array|Number} [ownDecorators.viewMargins] The margins to apply on the outer edges of the view.
     * @returns {undefined}
     * @private
     */
    layout(dockedRenderables, filledRenderables, context, ownDecorations) {
        let { extraTranslate, viewMargins: margins } = ownDecorations;
        let dockHelper = new TrueSizedLayoutDockHelper(context);

        if (margins) {
            dockHelper.margins(margins);
        }

        /* Process Renderables with a non-fill dock */
        let dockedNames = dockedRenderables ? dockedRenderables.keys() : [];
        for (let renderableName of dockedNames) {
            let [renderable, renderableCounterpart] = dockedRenderables.get(renderableName);
            let { dockSize, translate, innerSize, space = (ownDecorations.dockSpacing || 0) } = this._prepareForDockedRenderable(renderable, renderableCounterpart, context, extraTranslate, margins);
            let { callback, transition } = this._getRenderableFlowInformation(renderable);
            let { dock, rotate, origin, scale, skew, opacity } = renderable.decorations;
            let { dockMethod } = dock;
            if (dockHelper[dockMethod]) {
                dockHelper[dockMethod](renderableName, dockSize, space, translate, innerSize, {
                    rotate,
                    hide: !this._sizeResolver.isSizeFinal(renderable),
                    opacity,
                    callback,
                    transition,
                    origin,
                    scale,
                    skew
                });
            }
        }

        /* Process Renderables with a fill dock (this needs to be done after non-fill docks, since order matters in LayoutDockHelper) */
        let filledNames = filledRenderables ? filledRenderables.keys() : [];
        for (let renderableName of filledNames) {
            let [renderable, renderableCounterpart] = filledRenderables.get(renderableName);
            let { decorations } = renderable;
            let { rotate, origin, opacity, skew, scale } = decorations;
            decorations.dock.size = dockHelper.getFillSize();
            let { translate, innerSize } = this._prepareForDockedRenderable(renderable, renderableCounterpart, context, extraTranslate, margins);
            let { callback, transition } = this._getRenderableFlowInformation(renderable);
            dockHelper.fill(renderableName, innerSize, translate, {
                rotate,
                opacity,
                hide: !this._sizeResolver.isSizeFinal(renderable),
                origin,
                callback,
                transition,
                skew,
                scale
            });
        }
    }

    /**
     * Computes translation, inner size, actual docking size (outer size) and an adjusted docking size for a renderable that is about to be docked
     * @param {Renderable} renderable The renderable that is going to be docked
     * @param {Renderable} renderableCounterpart. The renderable counter-part (e.g. AnimationController, RenderNode, or ContainerSurface).
     * @param {Object} context. The famous context with a valid size proportion
     * @param {Array|Number} extraTranslate. A translate to shift the entire layout with
     * @param {Array|Nuimber} margins The margins to apply on the outer edges of the view
     * @returns {{dockSize: (Array|Object), translate, innerSize: (Array|Number), inUseDockSize: (Array|Number}}
     * @private
     */
    _prepareForDockedRenderable(renderable, renderableCounterpart, context, extraTranslate, margins = [0, 0, 0, 0]) {
        let { decorations } = renderable;
        let { translate = [0, 0, 0] } = decorations;
        translate = Utils.addTranslations(extraTranslate, translate);
        let { dockMethod, space } = decorations.dock;
        let horizontalMargins = margins[1] + margins[3];
        let verticalMargins = margins[0] + margins[2];
        let sizeWithoutMargins = [context.size[0] - horizontalMargins, context.size[1] - verticalMargins];
        let dockSizeSpecified = !(isEqual(decorations.dock.size, [undefined, undefined]));
        let dockSize = this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, { size: sizeWithoutMargins }, dockSizeSpecified ? decorations.dock.size : decorations.size);
        let inUseDockSize = this._sizeResolver.getResolvedSize(renderable);
        let innerSize;
        let { origin, align } = decorations;
        /* If origin and align is used, we have to add this to the translate of the renderable */
        if (decorations.size || origin || align) {

            let translateWithProportion = (proportion, size, translation, dimension, factor) =>
                translation[dimension] += size[dimension] ? factor * size[dimension] * proportion[dimension] : 0;


            if (decorations.size) {

                this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, { size: dockSizeSpecified ? dockSize : sizeWithoutMargins }, decorations.size);
                innerSize = this._sizeResolver.getResolvedSize(renderable);


                translate = [...translate]; //shallow copy the translation to prevent the translation for happening multiple times

                /* If no docksize was specified in a certain direction, then use the context size without margins */
                let outerDockSize = dockSize;

                if (!dockSizeSpecified) {
                    if (dockMethod === 'fill') {
                        outerDockSize = [...sizeWithoutMargins];
                    } else {
                        let dockingDirection = this.getDockType(dockMethod);
                        let orthogonalDockingDirection = +!dockingDirection;
                        outerDockSize[dockingDirection] = innerSize[dockingDirection];
                        outerDockSize[orthogonalDockingDirection] = sizeWithoutMargins[orthogonalDockingDirection];
                    }
                }

                if (origin && decorations.size) {
                    decorations.size.forEach((size, dimension) => {
                        if (this._sizeResolver.isValueTrueSized(size)) {
                            /* Because the size is set to true, it is interpreted as 1 by famous. We have to add 1 pixel
                             *  to make up for this.
                             */
                            if (origin[dimension] === 1) {
                                translate[dimension] += 1;
                            }
                        }
                    });
                }
                if (align) {
                    translateWithProportion(align, outerDockSize, translate, 0, 1);
                    translateWithProportion(align, outerDockSize, translate, 1, 1);
                }
            } else if (align) {
                for (let i of [0, 1]) {
                    translateWithProportion(align, decorations.dock.size[i] ? dockSize : sizeWithoutMargins, translate, i, 1);
                }
            }
        }
        for (let i = 0; i < 2; i++) {
            if (dockSize[i] === true) {
                /* If a true size is used, do a tilde on it in order for the dockhelper to recognize it as true-sized */
                dockSize[i] = ~inUseDockSize[i];
            }
        }
        /* If the renderable is unrenderable due to zero height/width...*/
        if (inUseDockSize[0] === 0 || inUseDockSize[1] === 0) {
            /* Don't display the space if the size is 0*/
            space = 0;
        }
        return {
            dockSize,
            translate,
            innerSize,
            inUseDockSize,
            space,
            hide: !this._sizeResolver.isSizeFinal(renderable),
        };
    }

    getDockType(dockMethodToGet) {
        let dockTypes = [['right', 'left'], ['top', 'bottom']];
        return findIndex(dockTypes, (dockMethods) => ~dockMethods.indexOf(dockMethodToGet));
    }

    /**
     * Calculates the bounding box size for all the renderables passed to the function
     * @param {OrderedHashMap} dockedRenderables A map containing Array-pairs of [renderable, renderableCounterpart] containing the things that are attached to the sides.
     * @param {OrderedHashMap} filledRenderables A map containing Array-pairs of [renderable, renderableCounterpart] containing the things that are filled.
     * @param {Object} ownDecorators The decorators that are applied to the view.
     * @returns {Array|Number} The bounding box size of all the renderables
     */
    boundingBoxSize(dockedRenderables, filledRenderables, ownDecorations) {
        let fillSize = [undefined, undefined];
        if (filledRenderables) {
            /* We support having multiple fills */
            fillSize = filledRenderables.reduce((resultingSize, [filledRenderable, renderableCounterpart], renderableName) => {
                this._sizeResolver.settleDecoratedSize(filledRenderable, renderableCounterpart, { size: [NaN, NaN] }, filledRenderable.decorations.size);
                let resolvedSize = this._sizeResolver.getResolvedSize(filledRenderable);
                if (resolvedSize) {
                    for (let [dimension, singleSize] of resolvedSize.entries()) {
                        if (singleSize !== undefined && ((resultingSize[dimension] === undefined) || resultingSize[dimension] < singleSize)) {
                            resultingSize[dimension] = singleSize;
                        }
                    }
                }
                return resultingSize;
            }, [undefined, undefined]);
        }
        let dockSize = [...fillSize];
        if (dockedRenderables) {
            let dockSizeInfo = this._getRegularDockBoundingBoxInfo(dockedRenderables, ownDecorations);
            dockSize = dockSizeInfo.boundingBoxSize;
            if (fillSize) {
                for (let [dimension, singleFillSize] of fillSize.entries()) {
                    if (singleFillSize !== undefined) {
                        if (dockSize[dimension] === undefined) {
                            dockSize[dimension] = singleFillSize;
                        } else if (dockSizeInfo.dockingDirection == dimension) {
                            dockSize[dimension] += singleFillSize;
                        } else {
                            dockSize[dimension] = Math.min(singleFillSize, dockSize[dimension]);
                        }
                    }
                }
            }
        }

        for (let i = 0; i < 2; i++) {
            if (Number.isNaN(dockSize[i])) {
                dockSize[i] = undefined;
            }
            if (dockSize[i] !== undefined && ownDecorations.viewMargins) {
                let { viewMargins } = ownDecorations;
                /* if i==0 we want margin left and right, if i==1 we want margin top and bottom */
                dockSize[i] += viewMargins[(i + 1) % 4] + viewMargins[(i + 3) % 4];
            }
        }
        return dockSize;
    }


    _getRegularDockBoundingBoxInfo(dockedRenderables, ownDecorations) {
        let { dockMethod } = dockedRenderables.get(dockedRenderables.keyAt(0))[0].decorations.dock;
        /* Gets the dock type where, 0 is right or left (horizontal) and 1 is top or bottom (vertical) */
        let dockType = this.getDockType(dockMethod);
        let dockingDirection = dockType;
        let orthogonalDirection = !dockType + 0;


        /* Previously countered dock size for docking direction and opposite docking direction */
        let previousDockSize = 0;
        /* Add up the different sizes to if they are docked all in the same direction */
        let boundingBoxSize = dockedRenderables.reduce((result, [dockedRenderable, renderableCounterpart], renderableName) => {
            let { decorations } = dockedRenderable;
            let { dockMethod: otherDockMethod } = decorations.dock;
            /* If docking is done orthogonally */
            if (this.getDockType(otherDockMethod) !== dockType) {
                return [NaN, NaN];
            } else {
                /* Resolve both inner size and outer size */
                this._sizeResolver.settleDecoratedSize(dockedRenderable, renderableCounterpart, { size: [NaN, NaN] }, decorations.dock.size);
                let resolvedOuterSize = this._sizeResolver.getResolvedSize(dockedRenderable);

                let resolvedInnerSize = [undefined, undefined];
                if (dockedRenderable.decorations.size) {
                    this._sizeResolver.settleDecoratedSize(dockedRenderable, renderableCounterpart, { size: [NaN, NaN] }, decorations.size);
                    resolvedInnerSize = this._sizeResolver.getResolvedSize(dockedRenderable);
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
                    let spaceSize = (resolvedSize[dockingDirection] === 0 || previousDockSize === 0)
                        ? 0
                        : decorations.dock.space || ownDecorations.dockSpacing || 0;
                    newResult[dockingDirection] = resolvedSize[dockingDirection] + spaceSize + result[dockingDirection];
                    /* If the resolved size is 0, then the relevant previous dock size should be the one before that */
                    previousDockSize = resolvedSize[dockingDirection] || previousDockSize;
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
        return { boundingBoxSize, dockingDirection, orthogonalDirection };
    }
}

export class FullSizeLayoutHelper extends BaseLayoutHelper {

    /**
     * Layouts full size renderables
     * @param {OrderedHashMap} A map containing Array-pairs of [renderable, renderableCounterpart] containing the full size renderables.
     * @param {Object} context The famous-flex context with a valid size property
     * @param {Object} ownDecorations. The decorators that are applied to the view.
     */
    layout(fullScreenRenderables, context, ownDecorations) {
        let { extraTranslate } = ownDecorations;
        let names = fullScreenRenderables ? fullScreenRenderables.keys() : [];
        for (let renderableName of names) {
            let [renderable] = fullScreenRenderables.get(renderableName);
            let { callback, transition } = this._getRenderableFlowInformation(renderable);
            let translate = Utils.addTranslations(extraTranslate, renderable.decorations.translate || [0, 0, 0]);
            context.set(renderableName, {
                translate,
                size: context.size,
                opacity: renderable.decorations.opacity === undefined ? 1 : renderable.decorations.opacity,
                callback,
                transition
            });
        }
    }

}

export class TraditionalLayoutHelper extends BaseLayoutHelper {

    layout(traditionalRenderables, context, ownDecorations) {
        let names = traditionalRenderables ? traditionalRenderables.keys() : [];
        for (let renderableName of names) {
            let [renderable, renderableCounterpart] = traditionalRenderables.get(renderableName);
            let renderableSize = this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, context, renderable.decorations.size) || [undefined, undefined];
            let {
                translate = [0, 0, 0], origin = [0, 0], align, rotate,
                opacity = 1, scale, skew
            } = renderable.decorations;
            translate = Utils.addTranslations(ownDecorations.extraTranslate, translate);
            let { callback, transition } = this._getRenderableFlowInformation(renderable);
            let adjustedTranslation = Utils.adjustPlacementForTrueSize(renderable, renderableSize, origin, translate, this._sizeResolver);
            context.set(renderableName, {
                size: renderableSize,
                translate: adjustedTranslation,
                origin,
                scale,
                hide: !this._sizeResolver.isSizeFinal(renderable),
                skew,
                align,
                callback,
                transition,
                rotate,
                opacity
            });
        }
    }

    boundingBoxSize(traditionalRenderables) {
        let renderableNames = traditionalRenderables ? traditionalRenderables.keys() : [];
        let totalSize = [undefined, undefined];
        for (let renderableName of renderableNames) {
            let [renderable, renderableCounterpart] = traditionalRenderables.get(renderableName);
            this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, { size: [NaN, NaN] }, renderable.decorations.size);
            let size = this._sizeResolver.getResolvedSize(renderable);

            /* Backup: If size can't be resolved, then see if there's a size specified on the decorator */
            if (!size && renderable.decorations) {
                let decoratedSize = renderable.decorations.size;
                let isValidSize = (inputSize) => typeof inputSize == 'number' && inputSize > 0;
                if (decoratedSize && decoratedSize.every(isValidSize)) {
                    size = decoratedSize;
                }
            }
            if (!size) {
                continue;
            }
            let renderableSpec;
            renderableSpec = renderable.decorations;
            let { align = [0, 0] } = renderableSpec;
            let translate = Utils.adjustPlacementForTrueSize(renderable, size, renderableSpec.origin || [0, 0], renderableSpec.translate || [0, 0, 0]);

            if (!renderableSpec || !renderableSpec.size) {
                continue;
            }

            /* If the renderable has a lower min y/x position, or a higher max y/x position, save its values */
            for (let i = 0; i < 2; i++) {
                /* Undefined is the same as context size */
                if (renderable.decorations.size[i] !== undefined && size[i] !== undefined) {
                    /* If align is set, then there can be a case where the aligned renderable is the biggest one on the view.
                     * Therefore, the translation of the align is not taken into account here, only the explicitly specified translate*/
                    let newPotentialOuterSize = translate[i] + size[i];
                    if (newPotentialOuterSize > totalSize[i] || totalSize[i] === undefined) {
                        totalSize[i] = newPotentialOuterSize;
                    }
                }

            }
        }
        return totalSize;
    }
}