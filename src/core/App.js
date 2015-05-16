/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
  @license MIT
  @copyright Bizboard, 2015

 */


import {Inject, annotate}  from 'di.js';
import {Router}            from './Router';
import Context             from 'famous/core/Context';

/**
 * The App class exposes the Router which can be used to configure the Application's routing settings.
 * You can specify which Route should be default by calling router.setDefault(controller, method);
 */
export class App {

    /**
     * Have the router check check which route is active and fire the Controller
     * @param router
     */
    constructor(router, context) {
        this.router = router;
        this.context = context;
        this.router.run();
    }
}

annotate(App, new Inject(Router));
annotate(App, new Inject(Context));
