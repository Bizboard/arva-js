/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Inject, annotate} from 'di.js';
import {Router}           from './Router';
import ObjectHelper       from '../utils/objectHelper';
import Context            from 'famous/core/Context';
import RenderController   from 'famous/Views/RenderController';

/**
 * The Controller class provides the highest level of control regarding the application features. Within the Controller context
 * each method will registered to receive calls from the Routing engine. With direct access to the Famo.us Context, every method can
 * control the creation of Views and Transitions.
 */
export class Controller extends RenderController {

    constructor(router, context) {
        super();

        this.router = router;
        this.context = context;
        // register the controller object in the router
        this.router.controllers.push(this);

        // add the controller to the rendercontext
        this.context.add(this);

        // add the controller route to the router
        var routeName = Object.getPrototypeOf(this).constructor.name.replace('Controller','');
        routeName += "/:method";

        // handle router url changes and execute the appropiate controller method
        this.router.add(routeName, function(r) {

            if (typeof(this[r.method]) == "function") {
                var result = this[r.method].apply(this, r.values);
                if (result) {
                    // assemble a callback based on the execution scope and have that called when rendering is completed
                    this.show(result, this._eventOutput.emit("rendered", r.method));
                }
            }
            else
                console.log("Route does not exist!");
        }.bind(this));

        ObjectHelper.bindAllMethods(this,this);
    }
}

annotate(Controller, new Inject(Router));
annotate(Controller, new Inject(Context));