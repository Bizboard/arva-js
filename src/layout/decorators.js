/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2016

 */

import _ from 'lodash';


function _getRenderableDefinition(id) {
    let renderablePosition = _.findIndex(this.lazyRenderableList, function (definition) {
        return definition.id == id;
    });

    if (renderablePosition != -1) {
        return this.lazyRenderableList[renderablePosition];
    }
    else {
        return null;
    }
}

/**
 * Creates a reference collection for decorated renderables in the view if none already exists (for easy lookup later),
 * and adds the renderable with renderableName to that collection as well as the normal renderables collection.
 * @param {View} view Arva View to place decorated renderable in
 * @param {String} renderableName Name of the renderable to place
 * @returns {Object} Renderable object that is defined on the view
 */
function prepDecoratedRenderable(view, renderableName) {
    let renderable = view[renderableName];

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

export const layout = {

    /**** Renderable decorators ****/
    fullscreen: function (view, renderableName, properties) {
        let renderable = prepDecoratedRenderable(view, renderableName);
        renderable.decorations.fullscreen = true;
    },

    override: function (layoutOptions) {
        return function (view, renderableName, properties) {
            let renderable = prepDecoratedRenderable(view, renderableName);
            renderable.decorations.overrideLayout = layoutOptions;
        }
    },

    dock: function (dockMethod, zIndex) {
        return function (view, renderableName, properties) {
            let renderable = prepDecoratedRenderable(view, renderableName);
            renderable.decorations.dock = dockMethod;

            if(!renderable.decorations.translate) { renderable.decorations.translate = [0, 0, 0]; }
            renderable.decorations.translate[2] = zIndex;
        }
    },

    size: function (x, y) {
        return function (view, renderableName, properties) {
            let renderable = prepDecoratedRenderable(view, renderableName);
            renderable.decorations.sizeX = x;
            renderable.decorations.sizeY = y;
        }
    },

    fill: function (view, renderableName, properties) {
        let renderable = prepDecoratedRenderable(view, renderableName);
        renderable.decorations.fill = true;
    },

    /**** Class decorators ****/
    scrollable: function (target, renderable, properties) {
        target.prototype.decorations.isScrollable = true;
    },

    margins: function (margins) {
        return function (target, renderable, properties) {
            target.prototype.decorations.viewMargins = margins;
        }
    }
};
