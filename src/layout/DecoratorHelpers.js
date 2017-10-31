import { RenderablePrototype }      from 'famous/utilities/RenderablePrototype.js'

/**
 *
 * @param viewOrRenderable
 * @param renderableName
 * @param descriptor
 * @returns {*}
 */
export function prepDecoratedRenderable (viewOrRenderable, renderableName, descriptor) {


    /* This function can also be called as prepDecoratedRenderable(renderable) */
    if (!renderableName && !descriptor) {
        let renderable = viewOrRenderable;
        renderable.decorations = renderable.decorations || {};
        return renderable
    }
    let view = viewOrRenderable;

    if (!view.renderableConstructors) {
        view.renderableConstructors = new Map()
    }

    let constructors = view.renderableConstructors;

    /* Because the inherited views share the same prototype, we'll have to split it up depending on which subclass we're referring out */
    let specificRenderableConstructors = constructors.get(view.constructor);
    if (!specificRenderableConstructors) {
        specificRenderableConstructors = constructors.set(view.constructor, {}).get(view.constructor)
    }

    if (!specificRenderableConstructors[renderableName]) {
        /* Getters have a get() method on the descriptor, class properties have an initializer method.
         * get myRenderable(){ return new Surface() } => descriptor.get();
         * myRenderable = new Surface(); => descriptor.initializer();
         */
        if (descriptor.get) {
            Utils.warn(`Adding renderables on views through getters has been deprecated (${renderableName}).`);
            specificRenderableConstructors[renderableName] = descriptor.get
        } else if (descriptor.initializer) {
            specificRenderableConstructors[renderableName] = descriptor.initializer
        }
    }
    let constructor = specificRenderableConstructors[renderableName];
    if (!constructor.decorations) {
        constructor.decorations = {descriptor: descriptor}
    }

    return constructor
}

/**
 * Extracts a decorations object
 *
 * @param {View} prototype
 * @returns {Object} The decorations for the prototype
 */
export function prepPrototypeDecorations (prototype) {

    /* To prevent inherited classes from taking each others class-level decorators, we need to store these decorations in
     * a map, similarly to function preparing a decorated renderable
     */
    if (!prototype.decorationsMap) {
        prototype.decorationsMap = new Map()
    }

    let {decorationsMap} = prototype;

    let decorations = decorationsMap.get(prototype.constructor);
    if (!decorations) {
        decorations = decorationsMap.set(prototype.constructor, {}).get(prototype.constructor)
    }

    /* Return the class' prototype, so it can be extended by the decorator */
    return decorations
}

export let decoratorTypes = {childDecorator: 1, viewDecorator: 2, viewOrChild: 3};

export let createChainableDecorator = function (method, type) {

    let methodToReturn = function (viewOrRenderable, renderableName, descriptor) {
        if (methodToReturn.lastResult) {
            methodToReturn.lastResult(viewOrRenderable, renderableName, descriptor);
        }
        if (type === decoratorTypes.viewOrChild) {
            type = typeof viewOrRenderable === 'function' ? decoratorTypes.viewDecorator : decoratorTypes.childDecorator;
        }
        let decorations = type === decoratorTypes.childDecorator ? prepDecoratedRenderable(...arguments).decorations : prepPrototypeDecorations(viewOrRenderable.prototype);

        /* If we are directly applying the decorator on a RenderablePrototype, we need to save the methods to be executed later,
         * rather than just executing the methods. This is needed so that decorators can be applied both directly as methods in
         * in combination with them being used actually as decorators, on the same renderable */
        if(!descriptor && viewOrRenderable instanceof RenderablePrototype){
            viewOrRenderable.addDirectlyAppliedDecoratorFunction(method)
        } else {

            method(decorations, type, viewOrRenderable, renderableName, descriptor);
        }


        if(!descriptor){
            /*  If the descriptor isn't present, we are not executing the decorator at decoration time.
             *  This means that we can utilize the return to provide the renderable. This allows you to do things like this:
             *
             *  this.myRenderable = this.addRenderable(layout.size(new Surface()))
             *
             *  Or this (in the class field):
             *
             *  items = this.options.items.map(itemInfo =>
             *    layout.size(...itemInfo.size)(
             *      new Surface({content: itemInfo.content})
             *    )
             *  );
             *
             *  */
            return viewOrRenderable;
        }
        return descriptor;
    };

    let root = this;
    if (root && root.originalObject) {
        methodToReturn.lastResult = root;
        root = methodToReturn.originalObject = root.originalObject;
    } else {
        methodToReturn.originalObject = this;
    }
    if (root) {
        methodToReturn.createChainableDecorator = createChainableDecorator.bind(methodToReturn);
        /* We are allowing for chaining here by defining the properties on the returning object having the same properties
        *  as the original object. For example, layout.fullSize() would return an object that has all the methods of layout */
        Object.defineProperties(methodToReturn, Object.getOwnPropertyDescriptors(root.__proto__));
    }

    return methodToReturn;
};

