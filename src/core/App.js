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
import {DialogManager}          from '../utils/DialogManager.js';
import {ArvaRouter}             from '../routers/ArvaRouter.js';
import {Injection}              from '../utils/Injection.js';
import {Router}                 from './Router.js';

import '../utils/hotfixes/Polyfills.js';
import '../utils/hotfixes/FamousKeyboardOffset.js';
import '../utils/hotfixes/DisableTextSelection.js';

/**
 * The App class exposes the Router which can be used to configure the Application's routing settings.
 * You can specify which Route should be default by calling `router.setDefault(controller, method);`
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
        let options = this.constructor.options || {};
        let controllers = this.constructor.controllers || [];
        let defaultRouter = this.constructor.router || ArvaRouter;
        let defaultDataSource = this.constructor.defaultDataSource;
        
        /* Allow user taps to emit immediately as click events,
         * instead of having the default 300ms delay. */
        if(FastClick.attach) {
            FastClick.attach(document.body);
        } else {
            FastClick(document.body);
        }
        
        /* Add default class providers to DI engine */
        Injection.addProviders(defaultRouter, FamousContextSingleton, NewAnimationController);

        if(defaultDataSource){
            Injection.addProviders(defaultDataSource);
        }
        
        /* Request instances of a Router and a Famous Context. */
        let [router, context] = Injection.getAll(Router, Context);

        /**
         * The dialog manager used to show and hide dialogs
         */
        this.dialogManager = Injection.get(DialogManager);

        /**
         * The router of the application
         */
        this.router = router;
        /**
         * The animationController that controls the animations between screens
         */
        this.context = context;

        if(this.constructor.loaded && typeof this.constructor.loaded === 'function') {
            try { this.constructor.loaded(); } catch(error) { console.log('Caught exception in App.loaded():', error); }
        }

        /* Load controllers */
        this.controllers = Injection.getAll(...controllers);

        this.router.run();

        /* Hide splash screen */
        if(navigator && navigator.splashscreen && !options.keepSplashScreen) { navigator.splashscreen.hide(); }

        let {done} = this.constructor;
        if(done && typeof done === 'function') {
            try { done.call(this.constructor); } catch(error) { console.log('Caught exception in App.done():', error); }
        }
    }

    /**
     * Triggers a creation of the app, by using an Injection.get
     */
    static start(){
        /* Instantiate this App, which also instantiates the other components. */
        this.app = Injection.get(this);
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