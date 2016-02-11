/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2016

 */

import _                        from 'lodash';
import Timer                    from 'famous/utilities/Timer.js';
import Easing                   from 'famous/transitions/Easing.js';
import AnimationController      from 'famous-flex/src/AnimationController.js';


function prepDecoratedRenderable(view, renderableName, descriptor) {
    let constructor;
    if(!view.renderableConstructors) { view.renderableConstructors = {}; }

    let constructors = view.renderableConstructors;
    if (!constructors[renderableName]) {
        /* Getters have a get() method on the descriptor, class properties have an initializer method.
         * get myRenderable(){ return new Surface() } => descriptor.get();
         * myRenderable = new Surface(); => descriptor.initializer();
         */
        if (descriptor.get) {
            constructors[renderableName] = descriptor.get;
        } else if (descriptor.initializer) {
            constructors[renderableName] = descriptor.initializer;
        }
    }
    constructor = constructors[renderableName];
    if (!constructor.decorations) { constructor.decorations = {}; }

    return constructor;
}

function prepDecoratedClass(classObject) {
    let prototype = classObject.prototype;
    if (!prototype.decorations) { prototype.decorations = {}; }

    /* Return the class' prototype, so it can be extended by the decorator */
    return prototype;
}

export const layout = {

    /**** Renderable decorators ****/

    /**
     * Merely marks a view property as a decorated renderable, which allows it to be rendered.
     * Use this in combination with a @layout.custom decorator on the view in which this renderable resides.
     * @param {View} view
     * @param {String} renderableName
     * @param {Object} descriptor
     */
    renderable: function(view, renderableName, descriptor) {
        prepDecoratedRenderable(view, renderableName, descriptor);
    },

    fullscreen: function (view, renderableName, descriptor) {
        let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
        renderable.decorations.fullscreen = true;
    },

    dock: function (dockMethod, size, zIndex = 0) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.dock = dockMethod;

            let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined;
            let height = dockMethod === 'top' || dockMethod === 'bottom' ? size : undefined;
            renderable.decorations.size = [width, height];

            if (!renderable.decorations.translate) { renderable.decorations.translate = [0, 0, 0]; }
            renderable.decorations.translate[2] = zIndex;
        }
    },

    size: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.size = [x, y];
        }
    },


    place: function (place) {
        return function (view, renderableName, descriptor) {
            let origin = [0, 0], align = [0, 0];
            switch (place) {
                case 'center':
                    origin = align = [0.5, 0.5];
                    break;
                case 'bottomright':
                    origin = align = [1, 1];
                    break;
                case 'bottomleft':
                    origin = align = [0, 1];
                    break;
                case 'topright':
                    origin = align = [1, 0];
                    break;
                default:
                case 'topleft':
                    origin = align = [0, 0];
                    break;
            }

            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = origin;
            renderable.decorations.align = align;
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

    translate: function (x, y, z) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.translate = [x, y, z];
        }
    },

    animate: function (options = {}) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            options = _.merge({animation: AnimationController.Animation.FadedZoom, transition: {duration: 300, curve: Easing.outQuad}}, options);

            let animationController = new AnimationController(options);
            renderable.decorations.animationController = animationController;
            if (renderable.pipe) { renderable.pipe(animationController._eventOutput); }

            view.renderableConstructors[renderableName] = renderable;

            let showMethod = animationController.show.bind(animationController, renderable, options, () => {
                    if (renderable.emit) {
                        renderable.emit('shown')
                    } else if(renderable._eventOutput && renderable._eventOutput.emit){
                        renderable._eventOutput.emit('shown')
                    }
            });

            if (options.delay && options.delay > 0) {
                Timer.setTimeout(showMethod, options.delay);
            } else if (options.waitFor) {
                /* These delayed animation starts get handled in arva-js/core/View.js:_handleDelayedAnimations() */
                if (!view.delayedAnimations) { view.delayedAnimations = []; }
                view.delayedAnimations.push({showMethod: showMethod, waitFor: options.waitFor});
            } else {
                showMethod();
            }

        }
    },

    test: function () {
        console.log('ok');
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
    },

    custom: function(customLayoutFunction) {
        return function (target) {
            let prototype = prepDecoratedClass(target);
            prototype.decorations.customLayoutFunction = customLayoutFunction;
        }
    }
};

export const constructor = {
    arguments: function (optionMethod) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.constructionOptionsMethod = optionMethod;
        }
    }
};
