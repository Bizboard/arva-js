/**


  @author: Hans van den Akker (mysim1)
  @license NPOSL-3.0
  @copyright Bizboard, 2015

 */

import FastClick                from 'fastclick';
import Engine                   from 'famous/core/Engine.js';
import Context                  from 'famous/core/Context.js';
import AnimationController      from 'famous-flex/AnimationController.js';

import {provide}                from '../utils/di/Decorators.js';
import {ArvaRouter}             from '../routers/ArvaRouter.js';
import {Injection}              from '../utils/Injection.js';
import {Router}                 from './Router.js';

import '../utils/hotfixes/Polyfills.js';
import '../utils/hotfixes/FamousKeyboardOffset.js';

/**
 * The App class exposes the Router which can be used to configure the Application's routing settings.
 * You can specify which Route should be default by calling router.setDefault(controller, method);
 */
export class App {

    /**
     * Have the router check check which route is active and fire the Controller
     * @param {Router} router The router instance to use in the app.
     * @param {Context} context The data context instance to use in the app.
     * @returns {App} App instance
     */
    constructor() {
        /* Options are defined as a static property on the class that extends this App */
        let controllers = this.constructor.controllers || [];
        let defaultRouter = this.constructor.router || ArvaRouter;
        let defaultDataSource = this.constructor.defaultDataSource;
        
        /* Allow user taps to emit immediately as click events,
         * instead of having the default 300ms delay. */
        FastClick(document.body);
        
        /* Add default class providers to DI engine */
        Injection.addProviders(defaultDataSource, defaultRouter, FamousContextSingleton, NewAnimationController);
        
        /* Request instances of a Router and a Famous Context. */
        let [router, context] = Injection.getAll(Router, Context);
        
        /* Load controllers */
        this.controllers = Injection.getAll(...controllers);
        
        if(this.constructor.loaded && typeof this.constructor.loaded === 'function') {
            try { this.constructor.loaded(); } catch(error) { console.log('Caught exception in App.loaded():', error); }
        }

        this.router = router;
        this.context = context;
        this.router.run();

        /* Hide splash screen */
        if(navigator && navigator.splashscreen) { navigator.splashscreen.hide(); }

        let {done} = this.constructor;
        if(done && typeof done === 'function') {
            try { done(); } catch(error) { console.log('Caught exception in App.done():', error); }
        }
    }
    
    static start(){
        /* Instantiate this App, which also instantiates the other components. */
        this.references.app = Injection.get(this);
    }
}

@provide(Context)
class FamousContextSingleton {
    static famousContext = null;

    constructor() {
        return FamousContextSingleton.famousContext || (FamousContextSingleton.famousContext = Engine.createContext(null));
    }
}

@provide(AnimationController)
class NewAnimationController {
    constructor() {
        let context = new FamousContextSingleton();
        var controller = new AnimationController();

        context.add(controller);
        return controller;
    }
}