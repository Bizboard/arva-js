/**


  @author: Hans van den Akker (mysim1)
  @license NPOSL-3.0
  @copyright Bizboard, 2015

 */


import {inject, annotate}       from 'di';
import {Router}                 from './Router.js';
import Context                  from 'famous/core/Context.js';

import '../utils/hotfixes/Polyfills.js';
import '../utils/hotfixes/FamousKeyboardOffset.js';
import '../utils/hotfixes/DisableTextSelection.js';

/**
 * The App class exposes the Router which can be used to configure the Application's routing settings.
 * You can specify which Route should be default by calling router.setDefault(controller, method);
 */
@inject(Router, Context)
export class App {

    /**
     * Have the router check check which route is active and fire the Controller
     * @param {Router} router The router instance to use in the app.
     * @param {Context} context The data context instance to use in the app.
     * @returns {App} App instance
     */
    constructor(router, context) {
        this.router = router;
        this.context = context;
        this.router.run();
    }
}
