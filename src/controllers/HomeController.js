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
import {ChupPlayView}       from '../views/ChupPlayView';
import {NewChupsView}       from '../views/NewChupsView';
import {MainFlippedView}    from '../views/MainFlippedView';

import PlayController       from './PlayController';

import Easing               from 'famous/transitions/Easing';
import AnimationController  from 'famous-flex/src/AnimationController';


export default class HomeController extends Controller {


    constructor(router, context) {
        super(router, context, {
            transfer: {
                transition: {duration: 500, curve: Easing.outElastic},
                zIndex: 1000,
                items: {
                    'topleft': ['topleft', 'chupheader1'],
                    'topright': ['topright', 'chupheader2'],
                    'bottomleft': ['bottomleft', 'chupheader3'],
                    'bottomright': ['bottomright', 'chupheader4'],
                    'chupheader1': ['topleft', 'chupheader1'],
                    'chupheader2': ['topright', 'chupheader2'],
                    'chupheader3': ['bottomleft', 'chupheader3'],
                    'chupheader4': ['bottomright', 'chupheader4']
                }
            }
        });


        this.mainView = new NewChupsView();

        this.mainView.on('play', (id) => {
            this.router.go(PlayController, 'Chup', { id: id });
        });



        this.flip = new MainFlippedView();



        this.on('renderend', (arg)=>{
           console.log(arg);
        });
    }

    /**
     * Return the main app view
     * @returns {*}
     * @constructor
     */
    Main() {
        return this.mainView;
        //this.flip.setAngle(0, {curve : 'easeOutBounce', duration : 500});
        //return this.flip;//this.mainView;
    }

    Settings() {
        this.flip.setAngle(Math.PI, {curve : 'easeOutBounce', duration : 500});
        return this.flip;
    }
}

