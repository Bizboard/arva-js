/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {Inject}             from 'di.js';
import {App}                from './core/App';
import {Router}             from './core/Router';
import {HomeController}     from './controllers/HomeController';
import {TestController }    from './controllers/TestController';
import Easing               from 'famous/transitions/Easing';
import AnimationController  from 'famous-flex/src/AnimationController';

@Inject(Router, HomeController, TestController)
export class DefaultApp extends App {

    constructor(router, homeController) {
        // make one of the controllers default
        router.setDefault(homeController, 'Main');


        router.setControllerSpecs({
            HomeController: {
                controllers: [
                    {
                        transition: {duration: 500, curve: Easing.outBack},
                        animation: AnimationController.Animation.Fade,
                        activeFrom: ['TestController']
                    }
                ],
                methods: {
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
            TestController: {
                controllers: [
                    {

                        show: {
                            transition: {duration: 500, curve: Easing.inBack},
                            animation: AnimationController.Animation.Fade.bind({opacity: 0})
                        },
                        hide: {
                            transition: {duration: 0, curve: Easing.inBack}
                            //animation: AnimationController.Animation.Fade.bind({opacity: 0})
                        },
                        activeFrom: ['HomeController']
                    }
                ]
            }
        });

        super(router);
    }
}
