/**
 This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 @author: Hans van den Akker (mysim1)
 @license MPL 2.0
 @copyright Bizboard, 2015

 */

import {Router}                     from '../core/Router';
import ObjectHelper                 from '../utils/objectHelper';
import {Provide, Inject, annotate}  from 'di.js';
import View                         from 'famous/core/View';

export class FamonizedRouter extends Router {

    constructor() {
        super();

        if (window==null) {
            return;
        }

        this.routes = {};
        this.decode = decodeURIComponent;

        window.addEventListener('hashchange', this.run);

    }

    setDefault(controller, method = null) {

        this.defaultController = Object.getPrototypeOf(controller).constructor.name
            .replace('Controller','');

        if (method!=null) this.defaultMethod = method;

        //var hash = '';//'#/' + method;
        //this.run();


        if (window.location.hash.length==0 || window.location.hash=="#") {
            //if (history.pushState) {
            //    history.replaceState(null, null, hash);
            //}
            //else {
            //    location.hash = hash;
            //}

            //this.run();
        }
    }

    go(controller, method, params) {

        var controllerName = Object.getPrototypeOf(controller).constructor.name;
        var routeRoot = controllerName
            .replace(this.defaultController,'')
            .replace('Controller','');

        var hash = '#' + (routeRoot.length>0?'/'+routeRoot:'')+('/'+method);

        if (history.pushState) {
            history.pushState(null, null, hash);
        }

        var result = controller[method].apply(controller, params);
        controller.show(result);
    }




    add(route, handler) {
        var pieces = route.split('/'),
            rules = this.routes;

        for (var i = 0; i < pieces.length; ++i) {
            var piece = pieces[i],
                name = piece[0] == ':' ? ':' : piece;

            rules = rules[name] || (rules[name] = {});

            if (name == ':') {
                rules['@name'] = piece.slice(1);
            }
        }

        rules['@'] = handler;

    }

    run() {

        //if (!url || typeof(url) == "object")
        var url = window.location.hash.replace('#',''); // || '#';

        if (url !== '') {
            url = url.replace('/?', '?');
            url[0] == '/' && (url = url.slice(1));
            url.slice(-1) == '/' && (url = url.slice(0, -1));
        }

        var rules = this.routes,
            querySplit = url.split('?'),
            pieces = querySplit[0].split('/'),
            values = [],
            keys = [],
            method = '';

        // if there is no controller reference, assume we have hit the default Controller
        if (pieces.length==1 && pieces[0].length==0) {
            pieces[0] = this.defaultController;
            pieces.push(this.defaultMethod);
        }
        else if (pieces.length==1 && pieces[0].length>0)
            pieces.unshift(this.defaultController);


        // Parse the non-query portion of the URL...
        for (var i = 0; i < pieces.length && rules; ++i) {
            var piece = this.decode(pieces[i]),
                rule = rules[piece];

            if (!rule && (rule = rules[':'])) {
                method = piece;
            }

            rules = rule;
        }

        (function parseQuery(q) {
            var query = q.split('&');

            for (var i = 0; i < query.length; ++i) {
                var nameValue = query[i].split('=');

                if (nameValue.length > 1) {
                    keys.push(nameValue[0]);
                    values.push(this.decode(nameValue[1]));
                }
            }
        }).call(this, querySplit.length > 1 ? querySplit[1] : '');

        if (rules && rules['@']) {
            let controller = 0;
            // have all controllers hide their state before we switch
            for (controller in this.controllers)
                this.controllers[controller].hide();

            // make the controller active for current scope
            rules['@']({
                url: url,
                method: method,
                keys: keys,
                values: values
            });

            return true;
        } else {
            console.log('Controller doesn\'t exist!');
        }

        return false;
    }

}

annotate(FamonizedRouter, new Provide(Router));