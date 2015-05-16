/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                            from 'lodash';
import {Router}                     from '../core/Router';
import {Provide, annotate}  from 'di.js';
import Easing                       from 'famous/transitions/Easing';
import AnimationController          from 'famous-flex/src/AnimationController';

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
     * Set the initial controller and method to be activated whenever the controllers are activated.
     * @param controller
     * @param method
     */
    setDefault(controller, method = null) {

        let controllerName = '';
        if (Object.getPrototypeOf(controller).constructor.name=="Function")
            controllerName = controller.name;
        else controllerName = Object.getPrototypeOf(controller).constructor.name;
        this.defaultController = controllerName
            .replace('Controller', '');

        if (method != null) { this.defaultMethod = method; }
    }

    setControllerSpecs(specs) {
        this.specs = specs;
    }

    /**
     * Force navigation to one of the controllers
     * @param controller
     * @param method
     * @param params
     */
    go(controller, method, params=null) {

        let controllerName = '';
        if (Object.getPrototypeOf(controller).constructor.name=="Function")
            controllerName = controller.name;
        else controllerName = Object.getPrototypeOf(controller).constructor.name;

        let routeRoot = controllerName
            .replace(this.defaultController, '')
            .replace('Controller', '');

        let hash = '#' + (routeRoot.length > 0 ? '/' + routeRoot : '') + ('/' + method);
        if (params) {
            for(let i=0;i< Object.keys(params).length;i++) {
                var key = Object.keys(params)[i];
                hash+=i==0?'?':'&';
                hash+=(key+'='+params[key]);
            }
        }

        if (history.pushState) {
            history.pushState(null, null, hash);
        }

        this.run();
    }


    /**
     * Register a single controller
     * @param {String} route
     * @param {Function} handler
     */
    add(route, handler) {
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

    }

    /**
     * On a route change, call the corresponding controller method with the given parameter values.
     * @returns {boolean}
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
        let rule = null;
        let controller = null;

        // if there is no controller reference, assume we have hit the default Controller
        if (pieces.length === 1 && pieces[0].length === 0) {
            pieces[0] = this.defaultController;
            pieces.push(this.defaultMethod);
        }
        else if (pieces.length === 1 && pieces[0].length > 0) {
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
                method: method,
                keys: keys,
                values: values
            };
            currentRoute.spec = previousRoute ? this._getAnimationSpec(previousRoute, currentRoute) : {};
            this._setHistory(currentRoute);

            // make the controller active for current scope
            rule['@'](currentRoute);

            return true;
        } else {
            console.log('Controller doesn\'t exist!');
        }

        return false;
    }

    /**
     * Checks if the current route is already present in the history stack, and if so removes all entries after
     * and including the first occurrence. It will then append the current route to the history stack.
     * @param currentRoute Route object containing url, controller, method, keys, and values.
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
     * Method to check whether a route is already present in the history stack.
     * @param currentRoute Route object containing url, controller, method, keys, and values.
     * @returns {boolean}
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
     * @param previousRoute Previous route object containing url, controller, method, keys, and values.
     * @param currentRoute Current route object containing url, controller, method, keys, and values.
     * @returns {*} A spec object if one is found, or an empty object otherwise.
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

        console.log('No spec defined from ' + fromController + ' to ' + toController + '. Please check router.setControllerSpecs() in your app constructor.')
    }

}

annotate(ArvaRouter, new Provide(Router));