/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import Engine               from 'famous/core/Engine';
import Surface              from 'famous/core/Surface';
import {Controller}         from '../core/Controller';
import {ProfileView}        from '../views/ProfileView';
import {FullImageView}      from '../views/FullImageView';
import {NavBarView}         from '../views/NavBarView';
import Easing               from 'famous/transitions/Easing';
import AnimationController  from 'famous-flex/src/AnimationController';


export default class TestController extends Controller {



    constructor(router, context) {
        super(router, context, {
            transition: {duration: 500, curve: Easing.outBack},
            animation: AnimationController.Animation.Slide.Right,
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
        this.router.go(this, "Index", ['a','b']);
    }


    Profile() {
        return new ProfileView();
    }

    NavBar() {

        return new NavBarView();
    }
}

