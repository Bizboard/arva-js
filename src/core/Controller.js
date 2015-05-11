/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                    from 'lodash'
import {Inject, annotate}   from 'di.js'
import {Router}             from './Router'
import ObjectHelper         from '../utils/objectHelper'
import Context              from 'famous/core/Context'
import RenderController     from 'famous/Views/RenderController'
import EventHandler         from 'famous/core/EventHandler'
import AnimationController  from 'famous-flex/src/AnimationController'



/**
 * The Controller class provides the highest level of control regarding the application features. Within the Controller context
 * each method will registered to receive calls from the Routing engine. With direct access to the Famo.us Context, every method can
 * control the creation of Views and Transitions.
 */
export class Controller {

    constructor(router, context, spec) {
        //super();
        this.spec = spec;
        this.router = router;
        this.context = context;
        this._eventOutput = new EventHandler();

        // register the controller object in the router
        //this.router.controllers.push(this);


        ObjectHelper.bindAllMethods(this,this);


        // add the controller route to the router
        var routeName = Object.getPrototypeOf(this).constructor.name.replace('Controller','');
        routeName += "/:method";

        // handle router url changes and execute the appropiate controller method
        this.router.add(routeName, this.onRouteCalled);

        console.log(this.Transferables);
    }

    on(event, handler) {
        this._eventOutput.on(event, handler);
    }

    onRouteCalled(route) {
        if (typeof(this[route.method]) == "function") {
            var result = this[route.method].apply(this, route.values);
            if (result) {
                this._eventOutput.emit("renderstart", route.method);

                // assemble a callback based on the execution scope and have that called when rendering is completed
                this.context.show(result, _.extend(route.spec, this.spec), () => {this._eventOutput.emit("renderend", route.method)});
            }
        }
        else {
            console.log("Route does not exist!");
        }
    }
}

annotate(Controller, new Inject(Router));
annotate(Controller, new Inject(AnimationController));
