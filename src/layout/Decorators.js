/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2016

 */
import _                        from 'lodash';
import Timer                    from 'famous/utilities/Timer.js';
import Easing                   from 'famous/transitions/Easing.js';
import AnimationController      from 'famous-flex/AnimationController.js';
import LayoutUtility            from 'famous-flex/LayoutUtility.js';

import {View}                   from '../core/View.js';

function prepDecoratedRenderable(viewOrRenderable, renderableName, descriptor) {
    /* This function can also be called as prepDecoratedRenderable(renderable) */
    if (!renderableName && !descriptor) {
        let renderable = viewOrRenderable;
        renderable.decorations = renderable.decorations || {};
        return renderable;
    }
    let view = viewOrRenderable;

    if (!view.renderableConstructors) {
        view.renderableConstructors = new Map();
    }

    let constructors = view.renderableConstructors;

    /* Because the inherited views share the same prototype, we'll have to split it up depending on which subclass we're talking about */
    let specificRenderableConstructors = constructors.get(view.constructor);
    if (!specificRenderableConstructors) {
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
    if (!constructor.decorations) {
        constructor.decorations = {descriptor: descriptor};
    }

    return constructor;
}

function prepDecoratedPrototype(prototype) {
    if (!prototype.decorations) {
        prototype.decorations = {};
    }

    /* Return the class' prototype, so it can be extended by the decorator */
    return prototype;
}

export const layout = {


    /**
     * @example
     * @layout.renderable
     * renderable = new Surface();
     *
     * Merely marks a view property as a decorated renderable, which allows it to be rendered.
     * Use this in combination with a @layout.custom decorator on the view in which this renderable resides.
     * This decorator works directly on the object so you shouldn't pass any arguments nor use parentheses.
     *
     * @param {View} [view]
     * @param {String} [renderableName]
     * @param {Object} [descriptor]
     *
     * @returns {void}
     */
    renderable: function (view, renderableName, descriptor) {
        prepDecoratedRenderable(view, renderableName, descriptor);
    },

    /**
     * @example:
     * @layout.fullscreen
     * // Has a red background
     * background = new Surface({properties: {backgroundColor: 'red'}});
     *
     * Marks the renderable to cover the entire screen. Translate can also be specified on such a renderable.
     * This decorator works directly on the object so you shouldn't pass any arguments nor use parentheses.
     *
     * @param [view] Automatically set by decorator
     * @param [renderableName] Automatically set by decorator
     * @param [descriptor] Automatically set by decorator
     *
     * @returns {void}
     */
    fullscreen: function (view, renderableName, descriptor) {
        let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
        renderable.decorations.fullscreen = true;
    },

    /**
     * @example:
     * // there's a 20px space before this box
     * @layout.dockSpace(20)
     * @layout.size(100, 100)
     * @layout.dock('left')
     * box = new Surface({properties: {backgroundColor: 'red'}});
     *
     * Specifies the space that should come before the docked renderable. Useful when not specifying the size in the
     * layout.dock function. Note that the space does not appear if there isn't any renderable with a size greater than
     * zero before it.
     *
     * @param {Number} space The space that is inserted before the renderable.
     * @returns {Function} A decorator function
     */
    dockSpace: function (space) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            // Todo refactor also the z index to the dock
            renderable.decorations.dock = renderable.decorations.dock ? _.extend(renderable.decorations.dock, {space}) : {space};
        };
    },

    /**
     * @example:
     * @layout.dock('left', 30, 0, 10)
     * @layout.origin(0.5, 0)
     * @layout.align(0.5, 0)
     * dockedRenderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     * Docks the renderable to a certain position.
     * When using both a docked size and the layout.size decorator, then that decorator size becomes the inner size.
     * The renderable can then be placed within the docking area with origin and align.
     * When using layout.size without specifying a docked size, it.
     * When combined with align, treats the context size the docking size.
     *
     * @param {String} dockMethod. Can be either of 'left', 'right', 'bottom', 'top'
     * @param {Number|Function} [size]. The size of the renderable in the one dimension that is being docked, e.g.
     * dock left or right will be width, whereas dock top or bottom will result in height. For more information about
     * different variations, see layout.size.
     * @param {Number} [space = 0]. Any space that should be inserted before the docked renderable
     * @param {Number} [zIndex = 0]. DEPRECATED: Use translate(0, 0, zIndex) instead.
     * @returns {Function} A decorator function
     */
    dock: function (dockMethod, size, space = 0, zIndex) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);

            if (renderable.decorations.dock) {
                space = space || renderable.decorations.dock.space;
            }

            let width = dockMethod === 'left' || dockMethod === 'right' ? size : undefined;
            let height = dockMethod === 'top' || dockMethod === 'bottom' ? size : undefined;

            let twoDimensionalSize = [width, height];
            // Todo refactor also the z index to the dock, probably
            renderable.decorations.dock = {space, dockMethod, size: twoDimensionalSize};



            if (!renderable.decorations.translate) {
                renderable.decorations.translate = [0, 0, 0];
            }
            if (zIndex) {
                renderable.decorations.translate[2] = zIndex;
            }
        };
    },

    /**
     * @example
     * @layout.draggable({xRange: [0, 100}, yRange: [0, 200]})
     * @layout.size(100, 100)
     * // Makes a draggable square that is red
     * draggableRenderable = new Surface({properties: {backgroundColor: 'red'});
     *
     * Makes the renderable allowed to be dragged around.
     *
     * @param {Object} draggableOptions. Same options that can be passed to a Famous Draggable.
     * @param {Number} [options.snapX] grid width for snapping during drag
     * @param {Number} [options.snapY] grid height for snapping during drag
     * @param {Array.Number} [options.xRange] maxmimum [negative, positive] x displacement from start of drag
     * @param {Array.Number} [options.yRange] maxmimum [negative, positive] y displacement from start of drag
     * @param {Number} [options.scale] one pixel of input motion translates to this many pixels of output drag motion
     * @param {Number} [options.projection] User should set to Draggable._direction.x or
     *    Draggable._direction.y to constrain to one axis.
     * @returns {Function}
     */
    draggable: function (draggableOptions) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.draggableOptions = draggableOptions;
        }
    },


    /**
     * @example
     * @layout.size(100, 100)
     * @layout.swipable({xRange: [0, 100}, snapX: true})
     * //Make a red box that can slide to the right
     * swipable = new Surface({properties: {backgroundColor: 'red'});
     *
     * Makes the renderable swipable with physics-like velocity after the dragging is released. Emits event
     * 'thresholdReached' with arguments ('x'|'y', 0|1) when any thresholds have been reached
     *
     * @param {Object} options
     * @param {Boolean} [options.snapX] Whether to snap to the x axis
     * @param {Boolean} [options.snapY] Whether to snap to the Y axis
     * @param {Boolean} [options.enabled] Whether the swipable should be initially enabled
     * @param {Array.Number} [options.xThreshold] Two values of the thresholds that trigger the thresholdReached event with
     * argument 'x' and second argument 0 or 1, depending on the direction.
     * Specify undefined in one of them to disable threshold to that direction.
     * @param {Array.Number} [options.yThreshold] Two values of the thresholds that trigger the thresholdReached event with
     * argument 'y'  and second argument 0 or 1, depending on the direction.
     * Specify undefined in one of them to disable threshold to that direction.
     * @returns {Function} A decorator function
     */
    swipable: function (options) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.swipableOptions = options;
        }
    },


    /**
     * @example
     * @layout.size(function(contextWidth) {return Math.max(contextWidth, this.options.maxWidth)}, ~300)
     * // Creates a renderable where the width is equal to the text width and the height is whatever is bigger,
     * // options.maxWidth, or the context size
     * text = new Surface({content: 'This is some text', properties: {backgroundColor: 'red'}});
     *
     * Specifies the size of the renderable. For both of the parameters, sizes can be interpreted as follows:
     *
     * If specified as a function, then the argument passed is the context size of the specified dimension
     * (width or height). Note that if an arrow function is used, this scoping cannot be used when inside a
     * decorator, since the scope will be the global scope.
     *
     * If true is specified or a tilde with a size (e.g. ~300), then the renderable will be automatically sized.
     * If a tilde is used to indicate the size, then the size after the tildde will be used when/if the
     * renderable doesn't have a size, or turn into true if the size can be determined. This is useful when wanting to
     * reduce the flickering of surfaces who's size cannot be determined the first render tick.
     * Beware that true sizing of surfaces or other raw dom elements (input surfaces, image surfaces, text boxes etc)
     * often comes with a perfomance penalty and should only be used when necessary.
     * Also beware that any negative size will be interpreted as a tilde, since ~x = 1 - x
     *
     * If undefined is specified, then the size of that dimension will equal the entire context size.
     *
     * If a size between 0 and 1 is specified, then that will be interpreted as a proportion of the context size. For
     * example if 0.5 is specified, then the size will be half of the context size (the parent's size).
     *
     * @param {Number|Function} x
     * @param {Number|Function} y
     * @returns {Function} A decorator function
     */
    size: function (x, y) {
        return function (view, renderableName, descriptor) {
            if (Array.isArray(x)) {
                throw Error('Please specify size as two arguments, and not as an array');
            }
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.size = [x, y];
        };
    },

    /**
     * @example
     * @layout.size(40,40)
     * @layout.clip(20, 20)
     * // Shows a quarter of a circle
     * renderable = new Surface({properties: {backgroundColor: 'red', borderRadius: '50%'});
     *
     * Clips the renderable by creating another DOM-element with overflow: hidden. Internally, creates a Famous
     * ContainerSurface.
     * The two size parameters can either be a number or undefined (equals the context size).
     *
     * @param {Number} width The width of the ContainerSurface
     * @param {Number} heigh The height of the ContainerSurface
     * @param {Object} [properties]. Properties that will be passed to the newly created parent DOM-element.
     * Defaults to {overflow: 'hidden'}
     * @returns {Function} A decorator function
     */
    clip: function (width, height, properties = {}) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.clip = {size: [width, height], properties};
        }
    },

    /**
     * @example
     * @layout.size(100,100)
     * @layout.rotate(0, 0, Math.PI)
     * // Writes text upside down
     * renderable = new Surface({content: 'upside down text'});
     *
     * Rotates the renderable around any of the three axes
     *
     * @param {Number} x The rotation around the x axis (flips things vertically)
     * @param {Number} y The rotation around the y axis (flips things horizontally)
     * @param {Number} z The rotation around the z axis (rotates them in the more intuitive sense)
     * @returns {Function}
     */
    rotate: function (x, y, z) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.rotate = [x, y, z];
        }
    },

    /**
     * @example
     * @layout.size(100,~300)
     * @layout.place('center')
     * renderable = new Surface({content: 'centered text'});
     *
     * Places the renderable by settings origin/align. If no origin/align is set, it will default to topleft.
     *
     * @param {String} place. Can be either of 'center', 'left', 'right', 'bottom', 'top', 'bottomleft', 'bottomright',
     * 'topright', 'topleft'
     * @returns {Function} A decorator function
     */
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
                case 'left':
                    origin = align = [0, 0.5];
                    break;
                case 'right':
                    origin = align = [1, 0.5];
                    break;
                case 'top':
                    origin = align = [0.5, 0];
                    break;
                case 'bottom':
                    origin = align = [0.5, 1];
                    break;
                default:
                case 'topleft':
                    origin = align = [0, 0];
                    break;

            }

            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = origin;
            renderable.decorations.align = align;
        };
    },

    /**
     * @example
     * @layout.origin(0.5, 0)
     * @layout.align(0.5, 0.5)
     * @layout.size(100,100)
     * //Displays a red box horizontically centered and displays just below the vertical mid point
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     * Sets the point where the renderable has its anchor from where rotation and translation will be done.
     * You could consider it as translating the negative of the proportion times its size. The arguments are always
     * between and including 0 and 1
     *
     * @param {Number} x. The x of the origin.
     * @param {Number} y. The y of the origin.
     * @returns {Function} A decorator function
     */
    origin: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.origin = [x, y];
        };
    },

    /**
     * @example
     * @layout.align(0.5, 0.5)
     * @layout.size(100,100)
     * //Displays a red box just below the vertical mid point and past the horizontal mid point
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     * Translates the renderable by a proportion of the context size.
     *
     * @param {Number} x. The proportion of the context width that is going to be translated
     * @param {Number} y. The proportion of the context height that is going to be translated
     * @returns {Function} A decorator function
     */
    align: function (x, y) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.align = [x, y];
        };
    },

    /**
     * @example
     * @layout.translate(0, 0, 20)
     * class myView extends View{
     *  @layout.translate(0, 0, -20)
     *  @layout.fullscreen
     *  // Will display relatively at z level 0 (20 minus 20)
     *  myBackground = new Surface({properties: {backgroudColor: 'red'}});
     * }
     *
     * Specifies a translation of a renderable. Can be applied to every kind of renderable (docked, fullscreen,
     * and normal)
     *
     * Can also be applied on view level to translate every renderable of that view. The view wide translation defaults
     * to [0, 0, 10] in order to always increase the z space of every level of the Famous rendering tree.
     * @param {Number} x Moves the renderable along the x axis
     * @param {Number} y Moves the renderable along the y axis
     * @param {Number} z Moves the renderable along the z axis
     * @returns {Function} A decorator function
     */
    translate: function (x, y, z) {
        return function (target, renderableName, descriptor) {
            if (Array.isArray(x)) {
                throw Error('Please specify translate as three arguments, and not as an array');
            }
            let prototypeOrRenderable, propertyName;
            if (typeof target == 'function') {
                prototypeOrRenderable = prepDecoratedPrototype(target.prototype);
                propertyName = 'extraTranslate';
            } else {
                prototypeOrRenderable = prepDecoratedRenderable(...arguments);
                propertyName = 'translate';
            }
            prototypeOrRenderable.decorations[propertyName] = [x, y, z];
        };
    },

    /**
     * @example
     * @layout.place('center')
     * @layout.size(100,100)
     * @layout.animate({transition: {duration: 350}})
     * renderable = new Surface({properties: {backgroundColor: 'red'}});
     *
     *
     * Creates an animation controller to show/hide the renderable. Renderables can be shown by calling
     * this.showRenderable(renderableName) and hidden using this.hideRenderable(renderableName) or
     * this.showRenderable(renderableName, false). When a renderable has been shown, it will emit the event 'shown'.
     *
     * @param {Object} [options] The same as famous-flex Animation Controller, plus a few more.
     * @param {Boolean} [options.showInitially] Whether to show the renderable when the view is created. (Default: true).
     * @param {String} [options.waitFor] If specified, it will wait for the renderable with the specified name to show
     * before showing the renderable
     * @param {Object} [options.transition] Transition options.
     * @param {Function} [options.animation] Animation function (default: `AnimationController.Animation.FadedZoom`).
     * @param {Number} [options.zIndexOffset] Optional z-index difference between the hiding & showing renderable (default: 0).
     * @param {Number} [options.keepHiddenViewsInDOMCount] Keeps views in the DOM after they have been hidden (default: 0).
     * @param {Object} [options.show] Show specific options.
     * @param {Object} [options.show.transition] Show specific transition options.
     * @param {Function} [options.show.animation] Show specific animation function.
     * @param {Object} [options.hide] Hide specific options.
     * @param {Object} [options.hide.transition] Hide specific transition options.
     * @param {Function} [options.hide.animation] Hide specific animation function.
     * @param {Object} [options.transfer] Transfer options.
     * @param {Object} [options.transfer.transition] Transfer specific transition options.
     * @param {Number} [options.transfer.zIndex] Z-index the tranferables are moved on top while animating (default: 10).
     * @param {Bool} [options.transfer.fastResize] When enabled, scales the renderable i.s.o. resizing when doing the transfer animation (default: true).
     * @param {Array} [options.transfer.items] Ids (key/value) pairs (source-id/target-id) of the renderables that should be transferred.
     * @returns {Function}
     */
    animate: function (options = {}) {
        return function (view, renderableName, descriptor) {
            let renderableConstructor = prepDecoratedRenderable(view, renderableName, descriptor);
            options = _.merge({
                showInitially: true,
                animation: AnimationController.Animation.FadedZoom,
                show: {transition: options.transition || {curve: Easing.outCubic, duration: 250}},
                hide: {transition: options.transition || {curve: Easing.inCubic, duration: 250}}
            }, options);

            renderableConstructor.decorations.animation = options;

            constructor.decorations = renderableConstructor.decorations;

        };
    },

    /**
     * @example
     * @layout.scrollable
     * class myView extends View{
     * ...
     * }
     *
     * Makes the view as scrollable. This will put the entire content in a ReflowingScrollView that calls getSize on the
     * View. If the size cannot be determined, you might consider declaring your own getSize() on the View.
     * This decorator works directly on the object so you shouldn't pass any arguments nor use parentheses.
     *
     * @param [target]
     * @returns {void}
     */
    scrollable: function (target) {
        let prototype = prepDecoratedPrototype(target.prototype);
        prototype.decorations.isScrollable = true;
    },

    /**
     * @example
     * @layout.margins([15])
     * //Creates a class with 15px on all sides for docked renderables
     * class myView extends View{
     *
     *  //Will be displayed with margin
     *  @layout.dock('top', 20)
     *  onTop = new Surface({content: "hello world"});
     *
     *  //Will be displayed without margin since we're using @layout.place
     *  @layout.place('bottom')
     *  onButtom = new Surface({content: "hey hey"});
     * }
     *
     * Sets the margins for the docked content. This can be applied both to a child and a class. When in conflict,
     * the parent will override the child's setting. If the margin is set on a Surface, then CSS padding will be set.
     *
     * @param {Array.Number} margins Can be 1, 2, or 4, parameters, which can be specified as shorthand in the same way
     * as CSS does it.
     * @returns {Function} A decorator function
     */
    margins: function (margins) {
        return function (target) {
            let prototypeOrRenderable;
            if (typeof target == 'function') {
                prototypeOrRenderable = prepDecoratedPrototype(target.prototype);
            } else {
                prototypeOrRenderable = prepDecoratedRenderable(...arguments);
            }
            prototypeOrRenderable.decorations.viewMargins = LayoutUtility.normalizeMargins(margins);
        };
    },

    /**
     * @layout.custom((context) => {
     *  context.set('myRenderable', {
     *  size: [100, 100]
     * })
     * class MyView extends View {
     *  constructor(options) {
     *      super(options);
     *      this.renderables.myRenderable = new Surface({properties: {backgroundColor: 'red'}});
     *  }
     * }
     * Adds a custom layout function to the view
     *
     * This decorator works directly on the object so you shouldn't pass any arguments nor use parentheses.
     *
     * @param customLayoutFunction
     * @returns {Function} A decorator function
     */
    custom: function (customLayoutFunction) {
        return function (target) {
            let prototype = prepDecoratedPrototype(target.prototype);
            prototype.decorations.customLayoutFunction = customLayoutFunction;
        };
    }
};

export const options = {
    set: function (optionMethod) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            renderable.decorations.constructionOptionsMethod = optionMethod;
        };
    },
    default: function (view, optionName, descriptor) {
        let prototype = prepDecoratedPrototype(view);
        if (optionName === 'options') {
            throw new Error('Default options are not allowed to have the name \'options\'');
        }
        prototype.decorations.defaultOptions = descriptor.get ? descriptor.get : descriptor.initializer;
    }
};

export const event = {

    subscribe: function (subscriptionType, eventName, callback) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if (!renderable.decorations.eventSubscriptions) {
                renderable.decorations.eventSubscriptions = [];
            }
            renderable.decorations.eventSubscriptions.push({
                subscriptionType: subscriptionType,
                eventName: eventName,
                callback: callback
            });
        };
    },

    on: function (eventName, callback) {
        return event.subscribe('on', eventName, callback);
    },

    once: function (eventName, callback) {
        return event.subscribe('once', eventName, callback);
    },

    pipe: function (pipeToName) {
        return function (view, renderableName, descriptor) {
            let renderable = prepDecoratedRenderable(view, renderableName, descriptor);
            if (!renderable.decorations.pipes) {
                renderable.decorations.pipes = [];
            }

            renderable.decorations.pipes.push(pipeToName);
        };
    }
};