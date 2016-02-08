/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2016

 */

import _ from 'lodash';

/**
 * Creates a reference collection for decorated renderables in the view if none already exists (for easy lookup later),
 * and adds the renderable with renderableName to that collection as well as the normal renderables collection.
 * @param {View} view Arva View to place decorated renderable in
 * @param {String} renderableName Name of the renderable to place
 * @returns {Object} Renderable object that is defined on the view
 */
function prepDecoratedRenderable(view, renderableName, descriptor) {
    let renderable = view[renderableName] || descriptor.get();
    if(!renderable.decorations) { renderable.decorations = {}; }

    /* Create renderables collections if they don't yet exist */
    if (!view.renderables) { view.renderables = {}; }
    if (!view.decoratedRenderables) { view.decoratedRenderables = {}; }

    /* Reference the renderable in both collections */
    if (!(renderableName in view.decoratedRenderables)) {
        view.renderables[renderableName] = renderable;
        view.decoratedRenderables[renderableName] = renderable;
    }

    /* Return the renderable object itself, so it can be extended by the decorater */
    return renderable;
}

function prepDecoratedClass(view) {
    let prototype = Object.getPrototypeOf(view);
    if(!prototype.decorations) { prototype.decorations = {}; }

    /* Return the class' prototype, so it can be extended by the decorater */
    return prototype;
}

export const layout = {

    /**** Renderable decorators ****/
    fullscreen: function (view, renderableName, descriptor) {
        let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
        renderable.decorations.fullscreen = true;
    },

    override: function (layoutOptions) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.overrideLayout = layoutOptions;
        }
    },

    dock: function (dockMethod, size, zIndex = 0) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.dock = dockMethod;

            let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined;
            let height = dockMethod === 'top' || dockMethod === 'bottom' ? size: undefined;
            renderable.decorations.size = [width, height];

            if(!renderable.decorations.translate) { renderable.decorations.translate = [0, 0, 0]; }
            renderable.decorations.translate[2] = zIndex;
        }
    },

    size: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.size = [x, y];
        }
    },

    origin: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = [x, y];
        }
    },

    align: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.align = [x, y];
        }
    },

    /**** Class decorators ****/
    scrollable: function (target) {
        let prototype = prepDecoratedClass(target);
        prototype.decorations.isScrollable = true;
    },

    margins: function (margins) {
        return function (target) {
            let prototype = prepDecoratedClass(target);
            prototype.decorations.viewMargins = margins;
        }
    }
};
