/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */
// hello world

import {Injector, annotate, Provide}            from 'di.js';
import {ArvaRouter}                             from './routers/ArvaRouter';
import Engine                                   from 'famous/core/Engine';
import {Context as ArvaContext}                 from 'arva-context/Context';
import Context                                  from 'famous/core/Context';
import AnimationController                      from 'famous-flex/src/AnimationController';

@Provide(Context)
function famousContext() {
    if (famouscontext) {
        return famouscontext;
    }
    famouscontext = Engine.createContext();
    return famouscontext;
}

@Provide(AnimationController)
function newAnimationController() {
    famouscontext = famousContext();
    var controller = new AnimationController();

    famouscontext.add(controller);
    return controller;
}


export function GetDefaultContext() {
    return ArvaContext.getContext('Default');
}

export function reCreateDefaultContext() {
    // combine all injectors from context creation and the default injectors.
    let arrayOfInjectors = [ArvaRouter, famousContext, newAnimationController];

    for (let i = 0; i < arguments.length; i++) {
        arrayOfInjectors.push(arguments[i]);
    }

    ArvaContext.setContext('Default', new Injector(arrayOfInjectors));
    return ArvaContext.getContext('Default');
}
