/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Injector}                   from 'di';

var contextContainer = {};

export class Context {

    static get() {
        return Context.getContext().get(...arguments);
    }

    static getContext(contextName = 'Default') {
        return contextContainer[contextName];
    }

    static setContext(context = {}, contextName = 'Default') {
        return contextContainer[contextName] = context;
    }

    static buildContext(dependencies = [], contextName = 'Default') {
        return Context.setContext(new Injector(dependencies), contextName);
    }
}
