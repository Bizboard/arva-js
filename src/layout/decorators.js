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
import AnimationController      from 'famous-flex/AnimationController.js';
import LayoutUtility            from 'famous-flex/LayoutUtility.js'


import {View}                   from '../core/View.js'

function prepDecoratedRenderable(viewOrRenderable, renderableName, descriptor) {
    /* This function can also be called as prepDecoratedRenderable(renderable) */
    if(!renderableName && !descriptor){
        let renderable = viewOrRenderable;
        renderable.decorations = renderable.decorations || {};
        return renderable;
    }
    let view = viewOrRenderable;

    if (!view.renderableConstructors) { view.renderableConstructors = new Map(); }

    let constructors = view.renderableConstructors;

    /* Because the inherited views share the same prototype, we'll have to split it up depending on which subclass we're talking about */
    let specificRenderableConstructors = constructors.get(view.constructor);
    if(!specificRenderableConstructors){
        specificRenderableConstructors = constructors.set(view.constructor, {}).get(view.constructor);
    }

    if (!specificRenderableConstructors[renderableName]) {
        /* Getters have a get() method on the descriptor, class properties have an initializer method.
         * get myRenderable(){ return new Surface() } => descriptor.get();
         * myRenderable = new Surface(); => descriptor.initializer();
         */
        if (descriptor.get) {
            specificRenderableConstructors[renderableName] = descriptor.get;
        } else if (descriptor.initializer) {
            specificRenderableConstructors[renderableName] = descriptor.initializer;
        }
    }
    let constructor = specificRenderableConstructors[renderableName];
    if (!constructor.decorations) { constructor.decorations = {descriptor: descriptor}; }

    return constructor;
}

function prepDecoratedPrototype(prototype) {
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
    renderable: function (view, renderableName, descriptor) {
        prepDecoratedRenderable(view, renderableName, descriptor);
    },

    fullscreen: function (view, renderableName, descriptor) {
        let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
        renderable.decorations.fullscreen = true;
    },

    dockSpace: function (space) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            // Todo refactor also the z index to the dock
            renderable.decorations.dock = renderable.decorations.dock ? _.extend(renderable.decorations.dock, {space}) : {space};
        }
    },

    dock: function (dockMethod, size, space = 0, zIndex = 0) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);

            if(renderable.decorations.dock){
                space = space || renderable.decorations.dock.space;
            }
            // Todo refactor also the z index to the dock, probably
            renderable.decorations.dock = {space, dockMethod};

            if(!renderable.decorations.size){
                let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined;
                let height = dockMethod === 'top' || dockMethod === 'bottom' ? size : undefined;
                renderable.decorations.size = [width, height];
            } else if (size){
                throw Error("A size was specified both in the dock function and explicitly, which creates a conflict. " +
                    "Please use one of the two");
            }

            if (!renderable.decorations.translate) { renderable.decorations.translate = [0, 0, 0]; }
            renderable.decorations.translate[2] = zIndex;
        }
    },

    size: function (x, y) {
        return function (view, renderableName, descriptor) {
            if(Array.isArray(x)){
                throw Error("Please specify size as two arguments, and not as an array");
            }
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

    translate: function (x, y, z ) {
        return function (view, renderableName, descriptor) {
            if(Array.isArray(x)){
                throw Error("Please specify translate as three arguments, and not as an array");
            }
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.translate = [x, y, z];
        }
    },

    animate: function (options = {}) {
        return function (view, renderableName, descriptor) {
            let renderableConstructor = prepDecoratedRenderable(view, renderableName, descriptor);
            options = _.merge({animation: AnimationController.Animation.FadedZoom, transition: {duration: 250, curve: Easing.inQuad}}, options);

            /* We let the renderable variable below be instantiated when the View.js instance constructs this renderable */
            let constructor = view.renderableConstructors[renderableName] = (constructorOptions) => {
                let renderable = renderableConstructor(constructorOptions);
                let animationController = renderable.animationController = new AnimationController(options);
                if (renderable.pipe) { renderable.pipe(animationController._eventOutput); }

                let showMethod = () => {
                    animationController.show.call(animationController, renderable, options, () => {
                        if (renderable.emit) { renderable.emit('shown'); }
                    });
                };

                /* These animation starts get handled in arva-js/core/View.js:_handleAnimations() */
                if (!view.delayedAnimations) { view.delayedAnimations = []; }
                if (!view.waitingAnimations) { view.waitingAnimations = []; }
                if (!view.immediateAnimations) { view.immediateAnimations = []; }
                if (options.delay && options.delay > 0) {
                    Timer.setTimeout(showMethod, options.delay);
                    view.delayedAnimations.push({showMethod: showMethod, delay: options.delay});
                } else if (options.waitFor) {
                    view.waitingAnimations.push({showMethod: showMethod, waitFor: options.waitFor});
                } else {
                    view.immediateAnimations.push({showMethod: showMethod});
                }

                return renderable;
            };

            constructor.decorations = renderableConstructor.decorations;

        }
    },

    test: function () {
        console.log('ok');
    },

    /**** Class decorators ****/
    scrollable: function (target) {
        let prototype = prepDecoratedPrototype(target.prototype);
        prototype.decorations.isScrollable = true;
    },

    /**
     * Sets the margins for the docked content. This can be applied both to a child and a class. When in conflict,
     * the parent will override the child's setting
     * @param margins
     * @returns {Function}
     */
    margins: function (margins) {
        return function (target) {
            let prototypeOrRenderable;
            if(typeof target == 'function'){
                prototypeOrRenderable = prepDecoratedPrototype(target.prototype);
            } else {
                prototypeOrRenderable = prepDecoratedRenderable(...arguments);
            }
            prototypeOrRenderable.decorations.viewMargins = LayoutUtility.normalizeMargins(margins);
        }
    },

    custom: function (customLayoutFunction) {
        return function (target) {
            let prototype = prepDecoratedPrototype(target.prototype);
            prototype.decorations.customLayoutFunction = customLayoutFunction;
        }
    }
};

export const options = {
    set: function (optionMethod) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.constructionOptionsMethod = optionMethod;
        }
    },
    default: function (view, optionName, descriptor) {
        let prototype = prepDecoratedPrototype(view);
        if(optionName === 'options'){
            throw new Error("Default options are not allowed to have the name 'options'");
        }
        prototype.decorations.defaultOptions = descriptor.get ? descriptor.get : descriptor.initializer;
    }
};

export const event = {

    subscribe: function (subscriptionType, eventName, callback) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if(!renderable.decorations.eventSubscriptions) {
                renderable.decorations.eventSubscriptions = []
            }
            renderable.decorations.eventSubscriptions.push({
                subscriptionType: subscriptionType,
                eventName: eventName,
                callback: callback
            });
        }
    },

    on: function (eventName, callback) {
        return event.subscribe('on', eventName, callback)
    },

    once: function (eventName, callback) {
        return event.subscribe('once', eventName, callback)
    },

    pipe: function (pipeToName) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if (!renderable.decorations.pipes) {
                renderable.decorations.pipes = []
            }

            renderable.decorations.pipes.push(pipeToName);
        }
    }
};
