/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import isEqual                      from 'lodash/isEqual';
import {Router}                     from '../core/Router.js';
import {provide}                    from '../utils/di/Decorators.js';
import Easing                       from 'famous/transitions/Easing.js';
import AnimationController          from 'famous-flex/AnimationController.js';

/**
 * Emits the event 'routechange' with {url,controller,controllerObject,method,keys,values} when the route has changed
 */
@provide(Router)
export class ArvaRouter extends Router {

    routes = {};
    route = {};
    previousRoute = {};
    routeStack = [];
    decode = decodeURIComponent;
    defaultController = 'Home';
    defaultMethod = 'Index';

    constructor() {
        super();
        if (window === null) {
            return;
        }
        window.addEventListener('hashchange', this.run);

        this.routeStack = [];
        this.decode = decodeURIComponent;

        window.addEventListener('hashchange', this.run);
        this._setupNativeBackButtonListener();
    }

    /**
     * Sets the initial controller and method to be activated whenever the controllers are activated.
     * @param {Controller|Function|String} controller Default controller instance, controller constructor, or controller name to go to.
     * @param {String} method Default method to call in given controller.
     * @returns {void}
     */
    setDefault(controller, method = null) {
        this.defaultController = this._getControllerName(controller);

        if (method !== null) {
            this.defaultMethod = method;
        }
    }

    /**
     * Sets the animation specs object for use by the famous-flex AnimationController.
     * @param {Object} specs Animation specs, keyed by target controller.
     * @returns {void}
     */
    setControllerSpecs(specs) {
        this.specs = specs;
    }

    /**
     * Triggers navigation to one of the controllers
     * @param {Controller|Function|String} controller The controller instance, controller constructor, or controller name to go to.
     * @param {String} method The method to call in given controller.
     * @param {Object} params Dictionary of key-value pairs containing named arguments (i.e. {id: 1, test: "yes"})
     * @returns {void}
     */
    go(controller, method, params = null) {

        let controllerName = this._getControllerName(controller);
        let routeRoot = controllerName.replace('Controller', '');

        let hash = '#' + (routeRoot.length > 0 ? '/' + routeRoot : '') + ('/' + method);
        if (params !== null) {
            for (let i = 0; i < Object.keys(params).length; i++) {
                let key = Object.keys(params)[i];
                hash += i == 0 ? '?' : '&';
                hash += (key + '=' + params[key]);
            }
        }

        if (history.pushState) {
            history.pushState(null, null, hash);
        }

        this.run();
    }

    /**
     * Returns an object containing the current route.
     * @returns {{controller: *, method: (*), params: {}}}
     */
    getRoute() {
        let currentRoute = {
            controller: this.route.controller,
            method: this.route.method,
            params: {}
        };

        for (let index in this.route.keys) {
            currentRoute.params[this.route.keys[index]] = this.route.values[index];
        }

        return currentRoute;
    }

    /**
     * Registers a single controller.
     * @param {String} route Route to trigger handler on.
     * @param {Object} handlers
     * @param {Function} handler.enter Method to call on entering a route.
     * @param {Function} handler.leave Method to call on when leaving a route.
     * @returns {void}
     */
    add(route, { enter, leave }, controller) {
        let pieces = route.split('/'),
            rules = this.routes;

        for (let i = 0; i < pieces.length; ++i) {
            let piece = pieces[i],
                name = piece[0] === ':' ? ':' : piece;

            rules = rules[name] || (rules[name] = {});

            if (name === ':') {
                rules['@name'] = piece.slice(1);
            }
        }

        rules['enter'] = enter;
        rules['leave'] = leave;
        rules['controller'] = controller;

    }

    /**
     * On a route change, calls the corresponding controller method with the given parameter values.
     * @returns {Boolean} Whether the current route was successfully ran.
     */
    run() {
        let url = window.location.hash.replace('#', '');

        if (url !== '') {
            url = url.replace('/?', '?');
            url[0] === '/' && (url = url.slice(1));
            url.slice(-1) === '/' && (url = url.slice(0, -1));
        }

        let rules = this.routes,
            querySplit = url.split('?'),
            pieces = querySplit[0].split('/'),
            values = [],
            keys = [],
            params = [],
            method = '';
        for (let piece in pieces) {
            if (pieces[piece].indexOf('=') > -1) {
                let splitted = pieces[piece].split('=');
                pieces[piece] = splitted[0];
                querySplit.push(pieces[piece] + '=' + splitted[1]);
            }
        }

        let rule = null;
        let controller;

        /* if there is no controller reference, assume we have hit the default Controller */
        if (pieces.length === 1 && pieces[0].length === 0) {
            pieces[0] = this.defaultController;
            pieces.push(this.defaultMethod);
        } else if (pieces.length === 1 && pieces[0].length > 0) {
            pieces.unshift(this.defaultController);
        }

        controller = pieces[0];

        /* Parse the non-query portion of the URL */
        for (let i = 0; i < pieces.length && rules; ++i) {
            let piece = this.decode(pieces[i]);
            rule = rules[piece];

            if (!rule && (rule = rules[':'])) {
                method = piece;
            }

            rules = rules[piece];
        }

        (function parseQuery(q) {
            let query = q.split('&');

            for (let i = 0; i < query.length; ++i) {
                let nameValue = query[i].split('=');

                if (nameValue.length > 1) {
                    let key = nameValue[0];
                    let value = this.decode(nameValue[1]);
                    keys.push(key);
                    values.push(value);
                    params[key] = value;
                }
            }
        }).call(this, querySplit.length > 1 ? querySplit[1] : '');

        if (rule && rule['enter']) {

            /* Push current route to the history stack for later use */
            let previousRoute = this.routeStack.length ? this.routeStack[this.routeStack.length - 1] : undefined;
            let currentRoute = {
                url,
                keys,
                method,
                values,
                params,
                controller,
                controllerObject: rule['controller']
            };

            this.route = currentRoute;

            if (previousRoute) {
                if (currentRoute.controllerObject !== previousRoute.controllerObject) {
                    this.routes[previousRoute.controller][':']['leave'](currentRoute);
                }
            }
            currentRoute.spec = previousRoute ? this._getAnimationSpec(previousRoute, currentRoute) : (this._initialSpec || {});

            /* Set the previousRoute and the history stack */
            this.previousRoute = this.routeStack[this.routeStack.length -1];
            this._setHistory(currentRoute);

            this._executeRoute(rule, currentRoute);

            return true;
        } else {
            console.log(`Controller ${controller} doesn\'t exist!`);
        }

        return false;
    }

    setInitialSpec(spec) {
        this._initialSpec = spec;
    }

    setBackButtonEnabled(enabled) {
        this._backButtonEnabled = enabled;
    }

    isBackButtonEnabled() {
        return this._backButtonEnabled;
    }

    /**
     * Return the previous known route, or default route if no route stack is present
     * @returns {*}
     */
    getPreviousRoute() {
        return this.previousRoute;
    }

    /**
     * @param {String} fallbackController Determines which controller to go to when no previous route exists
     * @param {String} fallbackMethod Determines which method to go to when no previous route exists
     * @param {Object} fallbackParams Sets the parameters to use with the above fallback route
     */
    goBackInHistory(fallbackController = '', fallbackMethod = '', fallbackParams = null) {
        /* Default behaviour: go back in history in the arva router */
        let previousRoute = this.getPreviousRoute();
        this.routeStack = this.routeStack.slice(0, this.routeStack.length - 2);
        if (previousRoute) {
            this.go(previousRoute.controller, previousRoute.method, previousRoute.params || null);
        } else {
            this.go(fallbackController, fallbackMethod, fallbackParams);
        }
    }

    _setupNativeBackButtonListener() {
        this.setBackButtonEnabled(true);
        document.addEventListener("backbutton", (e) => {
            if (!this.isBackButtonEnabled()) {
                e.preventDefault();
            } else {
                this.goBackInHistory();
            }
        }, false);
    }

    /**
     * Executes the controller handler associated with a given route, passing the route as a parameter.
     * @param {Object} rule Rule handler to execute.
     * @param {Object} route Route object to pass as parameter.
     * @returns {void}
     * @private
     */
    _executeRoute(rule, route) {
        /* Make the controller active for current scope */
        if (rule['enter'](route)) {
            this.emit('routechange', route);
        }
    }

    /**
     * Checks if the current route is already present in the history stack, and if so removes all entries after
     * and including the first occurrence. It will then append the current route to the history stack.
     * @param {Object} currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {void}
     * @private
     */
    _setHistory(currentRoute) {
        for (let i = 0; i < this.routeStack.length; i++) {
            let previousRoute = this.routeStack[i];
            if (currentRoute.controller === previousRoute.controller &&
                currentRoute.method === previousRoute.method &&
                isEqual(currentRoute.values, previousRoute.values)) {
                this.routeStack.splice(i, this.routeStack.length - i);
                break;
            }
        }

        this.routeStack.push(currentRoute);
    }

    /**
     * CheckS whether a route is already present in the history stack.
     * @param {Object} currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {Boolean} Whether the route has been visited previously.
     * @private
     */
    _hasVisited(currentRoute) {
        for (let i = 0; i < this.routeStack.length; i++) {
            let previousRoute = this.routeStack[i];
            if (currentRoute.controller === previousRoute.controller &&
                currentRoute.method === previousRoute.method &&
                isEqual(currentRoute.values, previousRoute.values)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the animation direction for a route change within the same controller
     * @param currentRoute
     * @returns {string}
     * @private
     */
    _getRouteDirection(currentRoute){
        return this._hasVisited(currentRoute) ? 'previous' : 'next';
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
        let fromController = previousRoute.controller;
        let toController = currentRoute.controller;

        if (fromController.indexOf('Controller') === -1) {
            fromController += 'Controller';
        }
        if (toController.indexOf('Controller') === -1) {
            toController += 'Controller';
        }

        /* We're on exactly the same page as before */
        if (currentRoute.controller === previousRoute.controller &&
            currentRoute.method === previousRoute.method &&
            isEqual(currentRoute.values, previousRoute.values)) {
            return {};
        }

        /* Same controller, different method or different parameters */
        if (currentRoute.controller === previousRoute.controller) {

            let direction = this._getRouteDirection(currentRoute);
            if (this.specs && this.specs[fromController] && this.specs[fromController].methods) {
                return this.specs[fromController].methods[direction];
            }

            /* Default method-to-method animations, used only if not overridden in app's controllers spec. */
            let defaults = {
                'previous': {
                    transition: { duration: 400, curve: Easing.outCubic },
                    animation: AnimationController.Animation.Slide.Right
                },
                'next': {
                    transition: { duration: 400, curve: Easing.outCubic },
                    animation: AnimationController.Animation.Slide.Left
                }
            };
            return defaults[direction];
        }

        /* Different controller */
        if (this.specs && this.specs.hasOwnProperty(toController) && this.specs[toController].controllers) {
            let controllerSpecs = this.specs[toController].controllers;
            for (let specIndex in controllerSpecs) {
                let spec = controllerSpecs[specIndex];
                if (spec.activeFrom && spec.activeFrom.indexOf(fromController) !== -1) {
                    return spec;
                }
            }
        }
    }

    /**
     * Extracts a controller name from a given string, constructor, or controller instance. 'Controller' part is not included in the returned name.
     * E.g. _getControllerName(HomeController) -> 'Home'.
     * @param {Function|Object|String} controller String, constructor, or controller instance.
     * @returns {String} Name of the controller
     * @private
     */
    _getControllerName(controller) {
        if (typeof controller === 'string') {
            return controller.replace('Controller', '');
        } else if (typeof controller === 'function' && Object.getPrototypeOf(controller).constructor.name == 'Function') {
            /* The _name property is set by babel-plugin-transform-runtime-constructor-name.
             * This is done so Controller class names remain available in minimised code. */
            let controllerName = controller._name || controller.name;
            return controllerName.replace('Controller', '');
        } else {
            return typeof controller === 'object' ?
                Object.getPrototypeOf(controller).constructor.name.replace('Controller', '') : typeof controller;
        }
    }

}