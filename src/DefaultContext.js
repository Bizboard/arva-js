/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */
// hello world

import {Injector, Provide}                      from 'di.js';
import {ArvaRouter}                             from './routers/ArvaRouter';
import {Context as ArvaContext}                 from 'arva-context/Context';
import Engine                                   from 'famous/core/Engine';
import Context                                  from 'famous/core/Context';
import AnimationController                      from 'famous-flex/src/AnimationController';

var famousContext = null;

@Provide(Context)
function createFamousContext() {
    if (famousContext) {
        return famousContext;
    }
    famousContext = Engine.createContext();
    return famousContext;
}

@Provide(AnimationController)
function newAnimationController() {
    famousContext = createFamousContext();
    var controller = new AnimationController();

    famousContext.add(controller);
    return controller;
}


export function GetDefaultContext() {
    return ArvaContext.getContext('Default');
}

export function reCreateDefaultContext(router=ArvaRouter) {
    // combine all injectors from context creation and the default injectors.
    let arrayOfInjectors = [router, createFamousContext, newAnimationController];

    for (let i = 0; i < arguments.length; i++) {
        arrayOfInjectors.push(arguments[i]);
    }

    ArvaContext.setContext('Default', new Injector(arrayOfInjectors));
    return ArvaContext.getContext('Default');
}
