/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Controller}         from '../core/Controller';
import {ProfileView}        from '../views/ProfileView';
import {NavBarView}         from '../views/NavBarView';
import Easing               from 'famous/transitions/Easing';

export default class TestController extends Controller {

    constructor(router, context) {
        super(router, context, {
            transfer: {
                transition: {duration: 500, curve: Easing.inOutExpo},
                zIndex: 1000,
                items: {
                    'image': ['image', 'navBarImage'],
                    'navBarImage': ['image', 'navBarImage']
                }
            }
        });
    }

    ReRouteExample() {
        this.router.go(this, 'Index', ['a', 'b']);
    }


    Profile() {
        return new ProfileView();
    }

    NavBar() {

        return new NavBarView();
    }
}

