/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Inject, annotate}   from 'di.js';
import {App}                from './core/App';
import HomeController       from './controllers/HomeController';
import TestController       from './controllers/TestController';
import Easing               from 'famous/transitions/Easing';
import AnimationController  from 'famous-flex/src/AnimationController';


export class DefaultApp extends App {


    constructor(router, homeController) {
        // make one of the controllers default
        router.setDefault(homeController, 'Index');

        router.setControllerSpecs({
            HomeController: {
                controllers: [
                    {
                        transition: {duration: 1000, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Left,
                        activeFrom: ['TestController']
                    }
                ],
                methods: {
                    /* Optional: define how URL changes with the same controller but different methods are animated. */
                    next: {
                        transition: {duration: 1000, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Up
                    },
                    previous: {
                        transition: {duration: 1000, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Down
                    }
                }
            },
            TestController: {
                controllers: [
                    {
                        transition: {duration: 1000, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Down,
                        activeFrom: ['HomeController']
                    }
                ]
            }
        });

        super(router);
    }
}

annotate(DefaultApp, new Inject(HomeController));
annotate(DefaultApp, new Inject(TestController));
