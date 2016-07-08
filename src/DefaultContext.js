/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import {Injector, provide}                      from 'di';
import {ArvaRouter}                             from './routers/ArvaRouter.js';
import {Context as ArvaContext}                 from './utils/Context.js';
import Engine                                   from 'famous/core/Engine.js';
import FamousContext                            from 'famous/core/Context.js';
import AnimationController                      from 'famous-flex/AnimationController.js';

var famousContext = null;

@provide(FamousContext)
class NewFamousContext {
    constructor() {
        return famousContext || (famousContext = Engine.createContext());
    }
}

@provide(AnimationController)
class NewAnimationController {
    constructor() {
        let context = new NewFamousContext();
        var controller = new AnimationController();

        context.add(controller);
        return controller;
    }
}

/**
 * Creates a new dependency injection Context instance with the standard Arva components like a Router and a Famous Context.
 * Allows you to pass in more default dependencies you want to be injectable in your app, through the function call arguments.
 * @param {Function} router Router type to use.
 * @returns {Object} Context object that has a get() method for getting a dependency injected object instance.
 */
export function createDefaultContext(router = ArvaRouter) {
    /* Combine all dependencies from context creation and the default dependencies. */
    let dependencies = [router, NewFamousContext, NewAnimationController];

    for (let i = 1; i < arguments.length; i++) {
        dependencies.push(arguments[i]);
    }

    ArvaContext.buildContext(dependencies);
    return ArvaContext.getContext();
}
