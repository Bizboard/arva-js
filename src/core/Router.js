/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import EventEmitter                 from 'eventemitter3';
import {ObjectHelper}               from '../utils/ObjectHelper.js';

/**
 * Abstract Router class which can be implemented to be used in an MVP setup.
 */
export class Router extends EventEmitter {


    constructor() {
        super();
        // make classes behave like context bound
        ObjectHelper.bindAllMethods(this, this);

        // make the router aware of controllers active in the application
        // each controller will need to subscribe itself to this container.
        this.controllers = [];

        // when a default controller is designated. The router will map every route without a
        // controller reference to the HomeController.
        this.defaultController = 'Home';

        // when a default method is designated. the router map will every route without a
        // method reference to the HomeController's method.
        this.defaultMethod = 'Index';
    }

    /**
     * On a route change, calls the corresponding controller method with the given parameter values.
     * @returns {Boolean} Whether the current route was successfully ran.
     */
    run() { }


    /**
     * Sets the initial controller and method to be activated whenever the controllers are activated.
     * @param {Controller|Function|String} controller Default controller instance, controller constructor, or controller name to go to.
     * @param {String} method Default method to call in given controller.
     * @returns {void}
     */
    setDefault(controller, method) { }

    /**
     * Registers a single controller.
     * @param {String} route Route to trigger handler on.
     * @param {Function} handler Method to call on given route.
     * @returns {void}
     */
    add(route, handler) { }

    /**
     * Triggers navigation to one of the controllers
     * @param {Controller|Function|String} controller The controller instance, controller constructor, or controller name to go to.
     * @param {String} method The method to call in given controller.
     * @param {Object} params Dictonary of key-value pairs containing named arguments (i.e. {id: 1, test: "yes"})
     * @returns {void}
     */
    go(controller, method, params) { }

    /**
     * Executes the controller handler associated with a given route, passing the route as a parameter.
     * @param {Object} rule Rule handler to execute.
     * @param {Object} route Route object to pass as parameter.
     * @returns {void}
     * @private
     */
    _executeRoute(rule, route) { }
}