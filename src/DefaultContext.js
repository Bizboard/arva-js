/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */
// hello world

import {Provide, Injector}          from 'di.js';
import {ArvaRouter}                 from './routers/ArvaRouter';
import Engine                       from 'famous/core/Engine';
import {Context}                    from 'arva-context/Context';
import AnimationController          from 'famous-flex/src/AnimationController';

@Provide(AnimationController)
function NewAnimationController() {
    var context = Engine.createContext();
    var controller = new AnimationController();

    context.add(controller);
    return controller;
}

export function GetDefaultContext() {
    return Context.getContext('Default');
}

export function reCreateDefaultContext(dataSource = null) {
    if (dataSource) {
        Context.setContext('Default', new Injector([ArvaRouter, NewAnimationController, dataSource]));
    } else {
        Context.setContext('Default', new Injector([ArvaRouter, NewAnimationController]));
    }

    return Context.getContext('Default');
}
