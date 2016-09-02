/**
 * Created by lundfall on 01/09/16.
 */
import {Helpers}                    from './Helpers.js';
import {TrueSizedLayoutDockHelper}  from '../../layout/TrueSizedLayoutDockHelper.js';
import _                            from 'lodash';


class BasicLayout {
    run() {
        throw Error("Not implemented")
    }
}


export class DockedRenderablesLayout extends BasicLayout {

    constructor(sizeResolver) {
        super();
        this._sizeResolver = sizeResolver;
    }

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
    run(dockedRenderables, filledRenderables, context, ownDecorations) {
        let {extraTranslate, viewMargins: margins} = ownDecorations;
        let dockHelper = new TrueSizedLayoutDockHelper(context);

        if (margins) {
            dockHelper.margins(margins);
        }

        /* Process Renderables with a non-fill dock */
        let dockedNames = dockedRenderables ? dockedRenderables.keys() : [];
        for (let renderableName of dockedNames) {
            let [renderable, renderableCounterpart] = dockedRenderables.get(renderableName);
            let {dockSize, translate, innerSize, space} = this._prepareForDockedRenderable(renderable, renderableCounterpart, context, extraTranslate, margins);
            let {dock, rotate, opacity, origin} = renderable.decorations;
            let {dockMethod} = dock;
            if (dockHelper[dockMethod]) {
                dockHelper[dockMethod](renderableName, dockSize, space, translate, innerSize, {
                    rotate,
                    opacity,
                    origin
                });
            }
        }

        /* Process Renderables with a fill dock (this needs to be done after non-fill docks, since order matters in LayoutDockHelper) */
        let filledNames = filledRenderables ? filledRenderables.keys() : [];
        for (let renderableName of filledNames) {
            let [renderable, renderableCounterpart] = filledRenderables.get(renderableName);
            let {decorations} = renderable;
            let {rotate, opacity, origin} = decorations;
            let {translate, dockSize} = this._prepareForDockedRenderable(renderable, renderableCounterpart, context, extraTranslate, margins);
            /* Special case for undefined size, since it's treated differently by the dockhelper, and should be kept to undefined if specified */
            let dimensionHasUndefinedSize = (dimension) => ![decorations.dock.size, decorations.size].every((size) => size && size[dimension] !== undefined);
            dockSize = dockSize.map((fallbackSize, dimension) => dimensionHasUndefinedSize(dimension) ? undefined : fallbackSize);
            dockHelper.fill(renderableName, dockSize, translate, {rotate, opacity, origin});
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
        let {decorations} = renderable;
        let {translate = [0, 0, 0]} = decorations;
        translate = Helpers.addTranslations(extraTranslate, translate);
        let {dockMethod, space} = decorations.dock;
        let horizontalMargins = margins[1] + margins[3];
        let verticalMargins = margins[0] + margins[2];
        let sizeWithoutMargins = [context.size[0] - horizontalMargins, context.size[1] - verticalMargins];
        let dockSizeSpecified = !(_.isEqual(decorations.dock.size, [undefined, undefined]));
        let dockSize = this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, {size: sizeWithoutMargins}, dockSizeSpecified ? decorations.dock.size : undefined);
        let inUseDockSize = this._sizeResolver.getResolvedSize(renderable);
        let innerSize;
        let {origin, align} = decorations;
        if (decorations.size || origin || align) {
            /* If origin and align is used, we have to add this to the translate of the renderable */
            this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, {size: sizeWithoutMargins}, decorations.size);
            innerSize = this._sizeResolver.getResolvedSize(renderable);
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
                        let dockingDirection = this.getDockType(dockMethod);
                        outerDockSize[dockingDirection] = innerSize[dockingDirection];
                        outerDockSize[+!dockingDirection] = sizeWithoutMargins[+!dockingDirection];
                    }
                }

                if (origin) {
                    renderable.decorations.size.forEach((size, dimension) => {
                        if (this._sizeResolver.isValueTrueSized(size)) {
                            /* Because the size is set to true, it is interpreted as 1 by famous. We have to add 1 pixel
                             *  to make up for this.
                             */
                            translate[dimension] += 1;
                        }
                    });
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

    getDockType(dockMethodToGet) {
        let dockTypes = [['right', 'left'], ['top', 'bottom']];
        return _.findIndex(dockTypes, (dockMethods) => ~dockMethods.indexOf(dockMethodToGet));
    }
}

export class FullSizeRenderablesLayout extends BasicLayout {
    /**
     * Layouts full size renderables
     * @param {OrderedHashMap} A map containing Array-pairs of [renderable, renderableCounterpart] containing the full size renderables.
     * @param {Object} context The famous-flex context with a valid size property
     * @param {Object} ownDecorations. The decorators that are applied to the view.
     */
    run(fullScreenRenderables, context, ownDecorations) {
        let {extraTranslate} = ownDecorations;
        let names = fullScreenRenderables ? fullScreenRenderables.keys() : [];
        for (let renderableName of names) {
            let [renderable] = fullScreenRenderables.get(renderableName);
            let renderableCurve = renderable.decorations && renderable.decorations.flow && renderable.decorations.flow.currentTransition;
            let translate = Helpers.addTranslations(extraTranslate, renderable.decorations.translate || [0, 0, 0]);
            context.set(renderableName, {
                translate, size: context.size, transition: renderableCurve,
                opacity: renderable.decorations.opacity === undefined ? 1 : renderable.decorations.opacity
            });
        }
    }

}

export class TraditionalRenderablesLayout extends BasicLayout {

    constructor(sizeResolver){
        super();
        this._sizeResolver = sizeResolver;
    }

    run(traditionalRenderables, context, ownDecorations) {
        let names = traditionalRenderables ? traditionalRenderables.keys() : [];
        for (let renderableName of names) {
            let [renderable, renderableCounterpart] = traditionalRenderables.get(renderableName);

            let renderableSize = this._sizeResolver.settleDecoratedSize(renderable, renderableCounterpart, context, renderable.decorations.size) || [undefined, undefined];
            let {
                translate = [0, 0, 0], origin = [0, 0], align = [0, 0], rotate = [0, 0, 0],
                opacity = 1, transition, scale = [1, 1, 1], skew = [0, 0, 0]
            } = renderable.decorations;
            translate = Helpers.addTranslations(ownDecorations.extraTranslate, translate);
            let adjustedTranslation = Helpers.adjustPlacementForTrueSize(renderable, renderableSize, origin, translate, this._sizeResolver);
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
}