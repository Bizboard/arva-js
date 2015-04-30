/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */
// hello world

import {Injector, annotate, Provide}            from 'di.js'
import {FamonizedRouter}                        from './routers/FamonizedRouter'
import Engine                                   from 'famous/core/Engine'
import Context                                  from 'famous/core/Context'
import {Context as ArvaContext}                 from 'arva-context/Context';

var defaultContext;

function NewFamousContext() {
    return Engine.createContext();
}
annotate(NewFamousContext, new Provide(Context));


export function GetDefaultContext() {
    return ArvaContext.getContext('Default');
}

export function ReCreateDefaultContext(dataSource = null) {
    if (dataSource)
        ArvaContext.setContext('Default', new Injector([FamonizedRouter, NewFamousContext, dataSource]));
    else
        ArvaContext.setContext('Default', new Injector([FamonizedRouter, NewFamousContext]));

    return ArvaContext.getContext('Default');
}

