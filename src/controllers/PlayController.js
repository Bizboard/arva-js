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
import HomeController       from './HomeController';
import Easing               from 'famous/transitions/Easing';
import AnimationController  from 'famous-flex/src/AnimationController';


export default class PlayController extends Controller {


    constructor(router, context) {
        super(router, context, {
            transfer: {
                transition: {duration: 200, curve: Easing.inQuad},
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



        this.on('renderend', (arg)=>{
            console.log(arg);
        });
    }


    Chup(id) {
        var newChup = new ChupPlayView(id);

        newChup.on('play', (id) => {
            this.router.go(this, 'Chup', { id: id });
        });

        newChup.on('home', (id) => {
            this.router.go(HomeController, 'Main');
        });

        return newChup;
    }
}

