/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Inject, annotate}   from 'di.js'
import {App}                from './core/App'
import HomeController       from './controllers/HomeController'
import TestController       from './controllers/TestController'


export class DefaultApp extends App {


    constructor(router, homeController, testController) {
        // make one of the controllers default
        router.setDefault(homeController, 'Index');

        super(router);
    }
}

annotate(DefaultApp, new Inject(HomeController));
annotate(DefaultApp, new Inject(TestController));
