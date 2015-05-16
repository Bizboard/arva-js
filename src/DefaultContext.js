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
import {Context}                                from 'arva-context/Context';
import AnimationController                      from 'famous-flex/src/AnimationController';

var famouscontext;


function FamousContext() {
    return famouscontext;
}
annotate(FamousContext, new Provide(Context));


function NewAnimationController() {
    famouscontext = Engine.createContext();
    var controller = new AnimationController();

    famouscontext.add(controller);
    return controller;
}
annotate(NewAnimationController, new Provide(AnimationController));



export function GetDefaultContext() {
    return Context.getContext('Default');
}

export function reCreateDefaultContext(dataSource = null) {
    if (dataSource) {
        Context.setContext('Default', new Injector([ArvaRouter, FamousContext, NewAnimationController, dataSource]));
    } else {
        Context.setContext('Default', new Injector([ArvaRouter, FamousContext, NewAnimationController]));
    }

    return Context.getContext('Default');
}
