/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import {provide}                    from 'di';
import {Router}                     from '../core/Router.js';
import Easing                       from 'famous/transitions/Easing.js';
import AnimationController          from 'famous-flex/AnimationController.js';

@provide(Router)
export class ArvaRouter extends Router {

    constructor() {
        super();

        if (window == null) {
            return;
        }

        this.routes = {};
        this.history = [];
        this.decode = decodeURIComponent;

        window.addEventListener('hashchange', this.run);

    }

    /**
     * Sets the initial controller and method to be activated whenever the controllers are activated.
     * @param {Controller|Function|String} controller Default controller instance, controller constructor, or controller name to go to.
     * @param {String} method Default method to call in given controller.
     * @returns {void}
     */
    setDefault(controller, method = null) {

        this.defaultController = this._getControllerName(controller);

        if (method != null) { this.defaultMethod = method; }
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
     * @param {Object} params Dictonary of key-value pairs containing named arguments (i.e. {id: 1, test: "yes"})
     * @returns {void}
     */
    go(controller, method, params = null) {

        let controllerName = this._getControllerName(controller);

        let routeRoot = controllerName
            .replace(this.defaultController, '')
            .replace('Controller', '');

        let hash = '#' + (routeRoot.length > 0 ? '/' + routeRoot : '') + ('/' + method);
        if (params !== null) {
            for (let i = 0; i < Object.keys(params).length; i++) {
                var key = Object.keys(params)[i];
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
     * Registers a single controller.
     * @param {String} route Route to trigger handler on.
     * @param {Function} handler Method to call on given route.
     * @returns {void}
     */
    add(route, handler,controller) {
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

        rules['@'] = handler;
        rules['controller'] = controller;

    }

    /**
     * On a route change, calls the corresponding controller method with the given parameter values.
     * @returns {Boolean} Whether the current route was successfully ran.
     */
    run() {

        //if (!url || typeof(url) == 'object')
        let url = window.location.hash.replace('#', ''); // || '#';


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
            method = '';
        for (let piece in pieces) {
            if (pieces[piece].indexOf('=')>-1) {
                let splitted = pieces[piece].split('=');
                pieces[piece] = splitted[0];
                querySplit.push(pieces[piece] + '=' + splitted[1]);
            }
        }

        let rule = null;
        let controller;

        // if there is no controller reference, assume we have hit the default Controller
        if (pieces.length === 1 && pieces[0].length === 0) {
            pieces[0] = this.defaultController;
            pieces.push(this.defaultMethod);
        } else if (pieces.length === 1 && pieces[0].length > 0) {
            pieces.unshift(this.defaultController);
        }

        controller = pieces[0];

        // Parse the non-query portion of the URL...
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
                    keys.push(nameValue[0]);
                    values.push(this.decode(nameValue[1]));
                }
            }
        }).call(this, querySplit.length > 1 ? querySplit[1] : '');

        if (rule && rule['@']) {

            /* Push current route to the history stack for later use */
            let previousRoute = this.history.length ? this.history[this.history.length - 1] : undefined;
            let currentRoute = {
                url: url,
                controller: controller,
                controllerObject: rule['controller'],
                method: method,
                keys: keys,
                values: values
            };
            currentRoute.spec = previousRoute ? this._getAnimationSpec(previousRoute, currentRoute) : (this._initialSpec || {});
            this._setHistory(currentRoute);

            this._executeRoute(rule, currentRoute);

            return true;
        } else {
            console.log('Controller doesn\'t exist!');
        }

        return false;
    }

    setInitialSpec(spec) {
        this._initialSpec = spec;
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
        if(rule['@'](route)) {
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
        for (let i = 0; i < this.history.length; i++) {
            let previousRoute = this.history[i];
            if (currentRoute.controller === previousRoute.controller &&
                currentRoute.method === previousRoute.method &&
                _.isEqual(currentRoute.values, previousRoute.values)) {
                this.history.splice(i, this.history.length - i);
                break;
            }
        }

        this.history.push(currentRoute);
    }

    /**
     * CheckS whether a route is already present in the history stack.
     * @param {Object} currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {Boolean} Whether the route has been visited previously.
     * @private
     */
    _hasVisited(currentRoute) {
        for (let i = 0; i < this.history.length; i++) {
            let previousRoute = this.history[i];
            if (currentRoute.controller === previousRoute.controller &&
                currentRoute.method === previousRoute.method &&
                _.isEqual(currentRoute.values, previousRoute.values)) {
                return true;
            }
        }

        return false;
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
            _.isEqual(currentRoute.values, previousRoute.values)) {
            return {};
        }

        /* Same controller, different method or different parameters */
        if (currentRoute.controller === previousRoute.controller) {

            let direction = this._hasVisited(currentRoute) ? 'previous' : 'next';
            if (this.specs && this.specs[fromController] && this.specs[fromController].methods) {
                return this.specs[fromController].methods[direction];
            }

            /* Default method-to-method animations, used only if not overridden in app's controllers spec. */
            let defaults = {
                'previous': {
                    transition: {duration: 1000, curve: Easing.outBack},
                    animation: AnimationController.Animation.Slide.Right
                },
                'next': {
                    transition: {duration: 1000, curve: Easing.outBack},
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

        console.log('No spec defined from ' + fromController + ' to ' + toController + '. Please check router.setControllerSpecs() in your app constructor.');
    }

    /**
     * Extracts a controller name from a given string, constructor, or controller instance. 'Controller' part is not included in the returned name.
     * E.g. _getControllerName(HomeController) -> 'Home'.
     * @param {Function|Object|String} controller String, constructor, or controller instance.
     * @returns {String} Name of the controller
     * @private
     */
    _getControllerName(controller) {
        if(typeof controller === 'string') {
            return controller.replace('Controller', '');
        } else if (typeof controller === 'function' && Object.getPrototypeOf(controller).constructor.name == 'Function'){
            return controller.name.replace('Controller', '');
        } else{
            return typeof controller === 'object' ?
                Object.getPrototypeOf(controller).constructor.name.replace('Controller', '') : typeof controller;
        }
    }

}