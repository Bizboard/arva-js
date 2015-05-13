/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Inject, annotate}   from 'di.js'
import {App}                from './core/App'
import HomeController       from './controllers/HomeController'
import PlayController       from './controllers/PlayController'
import Easing               from 'famous/transitions/Easing'
import AnimationController  from 'famous-flex/src/AnimationController'


export class DefaultApp extends App {


    constructor(router, homeController, playController) {
        // make one of the controllers default
        router.setDefault(homeController, 'Main');

        router.setControllerSpecs({
            HomeController: {
                controllers: [
                    {
                        transition: {duration: 500, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Up,
                        activeFrom: ['PlayController']
                    }
                ],
                methods: {
                    /* Optional: define how URL changes with the same controller but different methods are animated. */
                    next: {
                        transition: {duration: 500, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Right
                    },
                    previous: {
                        transition: {duration: 500, curve: Easing.outBack},
                        animation: AnimationController.Animation.Slide.Left
                    }
                }
            },
            PlayController: {
                controllers: [
                    {
                        transition: {duration: 500, curve: Easing.outBack},
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
annotate(DefaultApp, new Inject(PlayController));
