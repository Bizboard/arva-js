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
     * Sets the initial controller and method to be activated whenever the controllers are activated.
     * @param {Controller|Function|String} controller Default controller instance, controller constructor, or controller name to go to.
     * @param {String} method Default method to call in given controller.
     * @returns {void}
     */
    setDefault(controller, method = null) {
    }

    /**
     * Sets the animation specs object for use by the famous-flex AnimationController.
     * @param {Object} specs Animation specs, keyed by target controller.
     * @returns {void}
     */
    setControllerSpecs(specs) {
    }

    /**
     * Triggers navigation to one of the controllers
     * @param {Controller|Function|String} controller The controller instance, controller constructor, or controller name to go to.
     * @param {String} method The method to call in given controller.
     * @param {Object} params Dictonary of key-value pairs containing named arguments (i.e. {id: 1, test: "yes"})
     * @returns {void}
     */
    go(controller, method, params = null) {
    }

    /**
     * Returns an object containing the current route.
     * @returns {{controller: *, method: (*), params: {}}}
     */
    getRoute() {

    }

    /**
     * Registers a single controller.
     * @param {String} route Route to trigger handler on.
     * @param {Object} handlers
     * @param {Function} handler.enter Method to call on entering a route.
     * @param {Function} handler.leave Method to call on when leaving a route.
     * @returns {void}
     */
    add(route, {enter, leave}, controller) {

    }

    /**
     * On a route change, calls the corresponding controller method with the given parameter values.
     * @returns {Boolean} Whether the current route was successfully ran.
     */
    run() {

    }

    setInitialSpec(spec) {
    }

    setBackButtonEnabled(enabled) {
    }

    isBackButtonEnabled() {
    }

    /**
     * Return the previous known route, or default route if no route stack is present
     * @returns {*}
     */
    getPreviousRoute(){

    }

    goBackInHistory() {

    }

    _setupNativeBackButtonListener() {

    }


    /**
     * Executes the controller handler associated with a given route, passing the route as a parameter.
     * @param {Object} rule Rule handler to execute.
     * @param {Object} route Route object to pass as parameter.
     * @returns {void}
     * @private
     */
    _executeRoute(rule, route) {

    }

    /**
     * Checks if the current route is already present in the history stack, and if so removes all entries after
     * and including the first occurrence. It will then append the current route to the history stack.
     * @param {Object} currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {void}
     * @private
     */
    _setHistory(currentRoute) {

    }

    /**
     * CheckS whether a route is already present in the history stack.
     * @param {Object} currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {Boolean} Whether the route has been visited previously.
     * @private
     */
    _hasVisited(currentRoute) {

    }

    /**
     * Returns the Famous-Flex animation spec for two given routes. Takes its spec inputs from the specs set in
     * router.setControllerSpecs(), which is called from the app constructor.
     * @param {Object} previousRoute Previous route object containing url, controller, method, keys, and values.
     * @param {Object} currentRoute Current route object containing url, controller, method, keys, and values.
     * @returns {Object} A spec object if one is found, or an empty object otherwise.
     * @private
     */
    _getAnimationSpec(previousRoute, currentRoute) {

    }

    /**
     * Extracts a controller name from a given string, constructor, or controller instance. 'Controller' part is not included in the returned name.
     * E.g. _getControllerName(HomeController) -> 'Home'.
     * @param {Function|Object|String} controller String, constructor, or controller instance.
     * @returns {String} Name of the controller
     * @private
     */
    _getControllerName(controller) {

    }
}