/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import ObjectHelper                 from '../utils/objectHelper';

/**
 * Abstract Router class which can be implemented to be used in an MVP setup.
 */
export default class Router {


    constructor() {
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
     * Check the routes and see which one should be activated.
     */
    run() {
    }


    /**
     * Set the Default Controller endpoint on startup.
     */
    setDefault(controller, method) {
    }

    /**
     * Register a route to a Controller
     */
    add(route, handler) {
    }

    /**
     * Go render a View from the Controller and passively update the HASH
     */
    go(controller, method, params) {
    }
}